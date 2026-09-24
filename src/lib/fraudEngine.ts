import {
  FintechEntity,
  IdentityNode,
  SpecGraphEdge,
  ScoreBreakdown,
  LookupResult,
  IncidentCategory,
} from './types';
import { normalizeIdentifier, hashData, CONSORTIUM_SALT } from './crypto';

// ─────────────────────────────────────────────────────────────────
// PESOS BASE POR CATEGORÍA (ΔS) — Modelo Probabilístico Dinámico
// ─────────────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<IncidentCategory, number> = {
  IDENTITY_THEFT: 90,   // Fraude crítico, daño deliberado grave
  MULE_ACCOUNT:   85,   // Estructura de lavado / movimiento ilícito
  PHISHING:       70,   // Vector de ataque activo verificado
  CHARGEBACK:     40,   // Puede ser fraude amistoso o disputa comercial legítima
  SUSPICIOUS:     20,   // Alerta temprana, anomalía comportamental
};

const OK_ATTENUATION = -35; // Voto "legítimo" / falso positivo confirmado

// ─────────────────────────────────────────────────────────────────
// VIDA MEDIA (HALF-LIFE) EN DÍAS POR CATEGORÍA
// λ = ln(2) / halfLifeDays
// Fraudes críticos: 90d | Phishing: 60d | Volátiles: 30d
// ─────────────────────────────────────────────────────────────────

const HALF_LIFE_DAYS: Record<IncidentCategory, number> = {
  IDENTITY_THEFT: 90,
  MULE_ACCOUNT:   90,
  PHISHING:       60,
  CHARGEBACK:     30,
  SUSPICIOUS:     30,
};

/**
 * Peso decaído usando la fórmula de vida media exponencial:
 * Peso Actual = Peso Base × e^(−λ × t)
 * donde λ = ln(2) / halfLifeDays  y  t = días desde el reporte
 */
function decayedWeight(category: IncidentCategory, isoTimestamp: string): number {
  const base     = SEVERITY_WEIGHT[category] ?? 20;
  const halfLife = HALF_LIFE_DAYS[category] ?? 30;
  const lambda   = Math.LN2 / halfLife;
  const t        = Math.max(0, (Date.now() - new Date(isoTimestamp).getTime()) / 86_400_000);
  return base * Math.exp(-lambda * t);
}

// ─────────────────────────────────────────────────────────────────
// MULTIPLICADOR DE RED (Consenso Multi-entidad)
// M_red = 1 + 0.2 × (n_entidades_distintas − 1)
// Ejemplo: 1 entidad → ×1.0 | 2 → ×1.2 | 4 → ×1.6 | tope ×2.0
// ─────────────────────────────────────────────────────────────────

function networkMultiplier(distinctEntities: number): number {
  if (distinctEntities <= 1) return 1.0;
  return Math.min(2.0, 1 + 0.2 * (distinctEntities - 1));
}

// ─────────────────────────────────────────────────────────────────
// CLASIFICACIÓN EN 4 NIVELES ACCIONABLES
// 0-20  → CONFIABLE  (Verde)   → APROBAR
// 21-50 → ALERTA     (Amarillo) → 2FA / Step-up
// 51-75 → ALTO_RIESGO (Naranja) → Revisión Manual
// 76-100→ CRITICO    (Rojo)    → Bloqueo Automático
// ─────────────────────────────────────────────────────────────────

export type RiskTier = 'CONFIABLE' | 'ALERTA' | 'ALTO_RIESGO' | 'CRITICO';

function classifyScore(score: number): { tier: RiskTier; level: 'BAJO' | 'MEDIO' | 'ALTO' } {
  if (score >= 76) return { tier: 'CRITICO',     level: 'ALTO' };
  if (score >= 51) return { tier: 'ALTO_RIESGO', level: 'MEDIO' };
  if (score >= 21) return { tier: 'ALERTA',      level: 'MEDIO' };
  return             { tier: 'CONFIABLE',   level: 'BAJO' };
}

// ─────────────────────────────────────────────────────────────────
// FUNCIÓN DE HASH (re-exporta usando CONSORTIUM_SALT)
// ─────────────────────────────────────────────────────────────────

export async function computeHash(
  type: 'DNI' | 'EMAIL' | 'PHONE' | 'IP',
  rawValue: string
): Promise<string> {
  const normalized = normalizeIdentifier(type, rawValue);
  return hashData(`${type}:${normalized}`, CONSORTIUM_SALT);
}

// ─────────────────────────────────────────────────────────────────
// EVALUACIÓN PRINCIPAL — Modelo Probabilístico Dinámico
// ─────────────────────────────────────────────────────────────────

export async function evaluateRisk(params: {
  dni?: string;
  email?: string;
  phone?: string;
  fintechId: string;
  fintechs: FintechEntity[];
  identityNodes: IdentityNode[];
  graphEdges: SpecGraphEdge[];
}): Promise<LookupResult> {
  const { dni, email, phone, fintechId, fintechs, identityNodes, graphEdges } = params;

  // ── Hashes de los identificadores provistos ──────────────────
  const dniHash   = dni   ? await computeHash('DNI',   dni)   : null;
  const emailHash = email ? await computeHash('EMAIL', email) : null;
  const phoneHash = phone ? await computeHash('PHONE', phone) : null;
  const inputHashes = [dniHash, emailHash, phoneHash].filter(Boolean) as string[];

  // ── Aristas activas que coincidan con los hashes consultados ─
  const matchingEdges: SpecGraphEdge[] = [];
  const falsePositiveEdges: SpecGraphEdge[] = [];

  for (const edge of graphEdges) {
    const isMatch = inputHashes.includes(edge.sourceHash) || inputHashes.includes(edge.targetHash);
    if (!isMatch) continue;
    if (edge.isFalsePositive) {
      falsePositiveEdges.push(edge);
    } else {
      matchingEdges.push(edge);
    }
  }

  // ── PASO 1: Impacto decaído de cada reporte de fraude ────────
  // Σ (Peso Base × Trust Weight × e^(−λ×t))
  // Trust weight del reporter escala el impacto (entidad de alta
  // confianza pesa más que una entidad nueva o cuestionada)
  let totalFraudImpact = 0;

  for (const edge of matchingEdges) {
    const reportingFintech = fintechs.find(f => f.id === edge.reportedByEntityId);
    const trustWeight      = reportingFintech ? reportingFintech.trustWeight : 0.7;
    const decayed          = decayedWeight(edge.incidentCategory, edge.timestamp);
    totalFraudImpact      += decayed * trustWeight;
  }

  // ── PASO 2: Multiplicador de red (consenso multi-entidad) ────
  const distinctReporters = new Set(matchingEdges.map(e => e.reportedByEntityId)).size;
  const Mred = networkMultiplier(distinctReporters);

  // ── PASO 3: Atenuación por votos "OK" (falsos positivos) ─────
  // Cada voto OK reduce el score en 35 pts DECAÍDOS
  // (también aplica decaimiento para que un "OK" viejo no limpie eternamente)
  let totalOkAttenuation = 0;
  for (const edge of falsePositiveEdges) {
    const fpDecay = Math.exp(-Math.LN2 / 30 * Math.max(0,
      (Date.now() - new Date(edge.timestamp).getTime()) / 86_400_000
    ));
    totalOkAttenuation += Math.abs(OK_ATTENUATION) * fpDecay;
  }

  // ── PASO 4: Score final S = min(100, max(0, Σ(FraudDecayed × M_red) − Σ(OK))) ──
  const rawScore     = totalFraudImpact * Mred - totalOkAttenuation;
  const finalScore   = Math.min(100, Math.max(0, Math.round(rawScore)));
  const { tier, level } = classifyScore(finalScore);

  // ── PASO 5: Identity Mismatch (penalización adicional) ───────
  // Si DNI + Email/Phone están vinculados a DISTINTOS DNIs en la red
  let mismatchDetected = false;
  let mismatchPenalty  = 0;

  if (dniHash && (emailHash || phoneHash)) {
    for (const edge of graphEdges) {
      if (edge.isFalsePositive) continue;
      const secondaryHash = emailHash || phoneHash;
      if (!secondaryHash) continue;
      const secondaryInEdge = edge.sourceHash === secondaryHash || edge.targetHash === secondaryHash;
      if (secondaryInEdge) {
        const otherHash = edge.sourceHash === secondaryHash ? edge.targetHash : edge.sourceHash;
        if (otherHash !== dniHash) {
          mismatchDetected = true;
          break;
        }
      }
    }
    if (mismatchDetected) mismatchPenalty = 30; // penalización moderada, no catastrófica
  }

  // ── PASO 6: Velocity check (ráfaga de consultas recientes) ───
  let velocityTriggered = false;
  let velocityPenalty   = 0;

  for (const hash of inputHashes) {
    const node = identityNodes.find(n => n.hash === hash);
    if (node && node.lookupsLastHour >= 3) {
      velocityTriggered = true;
      break;
    }
  }
  if (velocityTriggered) velocityPenalty = 20;

  // Score final incluyendo mismatch y velocity
  const adjustedScore = Math.min(100, Math.max(0, finalScore + mismatchPenalty + velocityPenalty));
  const { tier: finalTier, level: finalLevel } = classifyScore(adjustedScore);

  // ── Indicador de conflicto comunitario ───────────────────────
  const hasCommunityConflict = matchingEdges.length > 0 && falsePositiveEdges.length > 0;

  const breakdown: ScoreBreakdown = {
    historicalReportsScore: Math.round(totalFraudImpact),
    mismatchPenalty,
    velocityPenalty,
    finalScore:             adjustedScore,
    riskLevel:              finalLevel,
    riskTier:               finalTier,
    mismatchDetected,
    velocityTriggered,
    matchingEdges,
    // Campos extendidos del nuevo modelo
    networkMultiplier:      Math.round(Mred * 100) / 100,
    distinctReporters,
    okAttenuation:          Math.round(totalOkAttenuation),
    hasCommunityConflict,
  } as ScoreBreakdown;

  return {
    dniHash,
    emailHash,
    phoneHash,
    breakdown,
    timestamp: new Date().toISOString(),
    fintechId,
  };
}

// ─────────────────────────────────────────────────────────────────
// HELPERS DE GRAFO (sin cambios)
// ─────────────────────────────────────────────────────────────────

export function upsertIdentityNode(
  nodes: IdentityNode[],
  type: 'DNI' | 'EMAIL' | 'PHONE' | 'IP',
  hash: string,
  isLookup: boolean
): IdentityNode[] {
  const now = new Date().toISOString();
  const existing = nodes.find(n => n.hash === hash);

  if (existing) {
    return nodes.map(n => {
      if (n.hash !== hash) return n;
      return {
        ...n,
        lastSeen:       now,
        totalLookups:   n.totalLookups + (isLookup ? 1 : 0),
        lookupsLastHour: n.lookupsLastHour + (isLookup ? 1 : 0),
      };
    });
  }

  return [...nodes, {
    type,
    hash,
    firstSeen:       now,
    lastSeen:        now,
    totalLookups:    isLookup ? 1 : 0,
    lookupsLastHour: isLookup ? 1 : 0,
  }];
}

export function buildEdgesFromReport(params: {
  dniHash: string | null;
  emailHash: string | null;
  phoneHash: string | null;
  reportedByEntityId: string;
  incidentCategory: IncidentCategory;
}): SpecGraphEdge[] {
  const { dniHash, emailHash, phoneHash, reportedByEntityId, incidentCategory } = params;
  const hashes = [dniHash, emailHash, phoneHash].filter(Boolean) as string[];
  const edges: SpecGraphEdge[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < hashes.length; i++) {
    for (let j = i + 1; j < hashes.length; j++) {
      edges.push({
        id: `edge-${Date.now()}-${i}-${j}-${Math.random().toString(36).slice(2, 6)}`,
        sourceHash:        hashes[i],
        targetHash:        hashes[j],
        reportedByEntityId,
        incidentCategory,
        timestamp:         now,
        isFalsePositive:   false,
      });
    }
  }

  return edges;
}
