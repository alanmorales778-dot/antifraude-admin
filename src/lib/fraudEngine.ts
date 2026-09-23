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
// CONSTANTES DE SCORING
// ─────────────────────────────────────────────────────────────────

const SEVERITY_BASE: Record<IncidentCategory, number> = {
  MULE_ACCOUNT: 40,
  IDENTITY_THEFT: 35,
  CHARGEBACK: 20,
  PHISHING: 25,
  SUSPICIOUS: 15,
};

const MISMATCH_PENALTY = 45;
const VELOCITY_PENALTY = 25;
const VELOCITY_THRESHOLD = 3; // lookups en 60min desde entidades distintas
const VELOCITY_WINDOW_MS = 60 * 60 * 1000; // 60 minutos

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
// FACTOR DE DECAIMIENTO TEMPORAL
// ─────────────────────────────────────────────────────────────────

function timeDecayFactor(isoTimestamp: string): number {
  const daysSince =
    (Date.now() - new Date(isoTimestamp).getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-0.005 * Math.max(0, daysSince));
}

// ─────────────────────────────────────────────────────────────────
// EVALUACIÓN PRINCIPAL
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

  // Hashes de los identificadores provistos
  const dniHash = dni ? await computeHash('DNI', dni) : null;
  const emailHash = email ? await computeHash('EMAIL', email) : null;
  const phoneHash = phone ? await computeHash('PHONE', phone) : null;

  const inputHashes = [dniHash, emailHash, phoneHash].filter(Boolean) as string[];

  // ── FACTOR 1: Base por Reportes Históricos ───────────────────
  // Para cada arista activa que involucre alguno de los hashes consultados,
  // sumar (Severidad_Base * trustWeight * TimeDecayFactor)
  let historicalReportsScore = 0;
  const matchingEdges: SpecGraphEdge[] = [];

  for (const edge of graphEdges) {
    if (edge.isFalsePositive) continue;
    const isMatch =
      inputHashes.includes(edge.sourceHash) || inputHashes.includes(edge.targetHash);
    if (!isMatch) continue;

    matchingEdges.push(edge);

    const reportingFintech = fintechs.find(f => f.id === edge.reportedByEntityId);
    const trustWeight = reportingFintech ? reportingFintech.trustWeight : 0.5;
    const severityBase = SEVERITY_BASE[edge.incidentCategory] ?? 15;
    const decay = timeDecayFactor(edge.timestamp);

    historicalReportsScore += severityBase * trustWeight * decay;
  }

  // Clamp parcial (puede ser > 100 si hay muchos reportes)
  historicalReportsScore = Math.min(100, historicalReportsScore);

  // ── FACTOR 2: Penalización por Identity Mismatch ─────────────
  // Si se envían DNI + Email (o DNI + Teléfono), verificar si en las
  // GraphEdges ese email/teléfono estuvo vinculado a un DNI distinto.
  let mismatchDetected = false;
  let mismatchPenalty = 0;

  if (dniHash && (emailHash || phoneHash)) {
    for (const edge of graphEdges) {
      if (edge.isFalsePositive) continue;

      // Caso Email-DNI: el email está en una arista con un DNI diferente al consultado
      if (emailHash) {
        const emailInEdge =
          edge.sourceHash === emailHash || edge.targetHash === emailHash;
        if (emailInEdge) {
          const otherHash =
            edge.sourceHash === emailHash ? edge.targetHash : edge.sourceHash;
          // Si el otro extremo NO es el dniHash consultado, es un mismatch
          if (otherHash !== dniHash) {
            mismatchDetected = true;
            break;
          }
        }
      }

      // Caso Phone-DNI: el teléfono está en una arista con un DNI diferente al consultado
      if (!mismatchDetected && phoneHash) {
        const phoneInEdge =
          edge.sourceHash === phoneHash || edge.targetHash === phoneHash;
        if (phoneInEdge) {
          const otherHash =
            edge.sourceHash === phoneHash ? edge.targetHash : edge.sourceHash;
          if (otherHash !== dniHash) {
            mismatchDetected = true;
            break;
          }
        }
      }
    }
    if (mismatchDetected) {
      mismatchPenalty = MISMATCH_PENALTY;
    }
  }

  // ── FACTOR 3: Penalización por Velocity ──────────────────────
  // Si el hash fue consultado >= 3 veces en los últimos 60 min
  // desde entidades distintas (basado en IdentityNodes).
  let velocityTriggered = false;
  let velocityPenalty = 0;

  for (const hash of inputHashes) {
    const node = identityNodes.find(n => n.hash === hash);
    if (node && node.lookupsLastHour >= VELOCITY_THRESHOLD) {
      velocityTriggered = true;
      break;
    }
  }

  // También chequear si hay múltiples fintechs distintas que consultaron
  // este hash en la ventana de 60 minutos (usando timestamps de los edges)
  if (!velocityTriggered && inputHashes.length > 0) {
    const recentEdges = graphEdges.filter(e => {
      if (e.isFalsePositive) return false;
      const isMatch =
        inputHashes.includes(e.sourceHash) || inputHashes.includes(e.targetHash);
      const isRecent =
        Date.now() - new Date(e.timestamp).getTime() < VELOCITY_WINDOW_MS;
      return isMatch && isRecent;
    });

    const distinctEntities = new Set(recentEdges.map(e => e.reportedByEntityId));
    if (distinctEntities.size >= VELOCITY_THRESHOLD) {
      velocityTriggered = true;
    }
  }

  if (velocityTriggered) {
    velocityPenalty = VELOCITY_PENALTY;
  }

  // ── SCORE FINAL ───────────────────────────────────────────────
  const rawScore = historicalReportsScore + mismatchPenalty + velocityPenalty;
  const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  const riskLevel: 'BAJO' | 'MEDIO' | 'ALTO' =
    finalScore >= 70 ? 'ALTO' : finalScore >= 30 ? 'MEDIO' : 'BAJO';

  const breakdown: ScoreBreakdown = {
    historicalReportsScore: Math.round(historicalReportsScore),
    mismatchPenalty,
    velocityPenalty,
    finalScore,
    riskLevel,
    mismatchDetected,
    velocityTriggered,
    matchingEdges,
  };

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
// HELPERS DE GRAFO
// ─────────────────────────────────────────────────────────────────

/**
 * Crea o actualiza un IdentityNode cuando se registra un nuevo reporte/lookup.
 */
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
        lastSeen: now,
        totalLookups: n.totalLookups + (isLookup ? 1 : 0),
        lookupsLastHour: n.lookupsLastHour + (isLookup ? 1 : 0),
      };
    });
  }

  const newNode: IdentityNode = {
    type,
    hash,
    firstSeen: now,
    lastSeen: now,
    totalLookups: isLookup ? 1 : 0,
    lookupsLastHour: isLookup ? 1 : 0,
  };

  return [...nodes, newNode];
}

/**
 * Crea las aristas del grafo al reportar un fraude.
 * Genera aristas entre cada par de hashes provistos.
 */
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
        sourceHash: hashes[i],
        targetHash: hashes[j],
        reportedByEntityId,
        incidentCategory,
        timestamp: now,
        isFalsePositive: false,
      });
    }
  }

  return edges;
}
