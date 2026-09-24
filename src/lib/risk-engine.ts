import { IdentifierType, RiskEvaluationResult, RiskLevel, RiskTier, Recommendation, RiskMatrixFactors, FraudTypology } from './types';
import { computeBlindHashSync, generateCryptographicProof } from './crypto';
import { db } from './db';
import { redis } from './redis';

// ─────────────────────────────────────────────────────────────────
// PESOS BASE POR TIPOLOGÍA (ΔS)
// Tabla acordada con el equipo de operaciones antifraude
// ─────────────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<FraudTypology | 'OK', number> = {
  ROBO_DE_CUENTA:         90,   // Fraude crítico, daño deliberado grave
  IDENTIDAD_SINTETICA:    90,   // Asimilado a robo de identidad
  MULA_DE_DINERO:         85,   // Estructura de lavado / movimiento ilícito
  TRIANGULACION_FONDOS:   85,   // Misma naturaleza que cuenta mula
  PHISHING:               70,   // Vector de ataque activo verificado
  CONTRACARGO_REITERADO:  40,   // Puede ser fraude amistoso o disputa legítima
  OPERACION_SOSPECHOSA:   20,   // Alerta temprana, anomalía comportamental
  PROMO_ABUSE:            20,   // Bajo impacto, volátil
  OK:                    -35,   // Mitigación / validación cruzada (voto "legítimo")
};

// ─────────────────────────────────────────────────────────────────
// VIDA MEDIA (HALF-LIFE) POR CATEGORÍA DE TIPOLOGÍA
// λ = ln(2) / halfLifeDays → Decaimiento exponencial
// ─────────────────────────────────────────────────────────────────

const HALF_LIFE_DAYS: Record<FraudTypology, number> = {
  ROBO_DE_CUENTA:        90,   // Fraude crítico mantiene score alto 3 meses
  IDENTIDAD_SINTETICA:   90,
  MULA_DE_DINERO:        90,
  TRIANGULACION_FONDOS:  90,
  PHISHING:              60,   // Vida media moderada
  CONTRACARGO_REITERADO: 30,   // Volátil: decae rápido si nadie más reporta
  OPERACION_SOSPECHOSA:  30,
  PROMO_ABUSE:           30,
};

/**
 * Calcula el peso actual de un reporte aplicando decaimiento exponencial.
 * Peso Actual = Peso Base × e^(−λ × t)
 * donde λ = ln(2) / halfLifeDays  y  t = días transcurridos
 */
function decayedWeight(baseWeight: number, typology: FraudTypology, lastReportedAt?: string): number {
  if (!lastReportedAt) return baseWeight;
  const halfLife = HALF_LIFE_DAYS[typology] ?? 30;
  const lambda = Math.LN2 / halfLife;
  const t = Math.max(0, (Date.now() - new Date(lastReportedAt).getTime()) / 86_400_000);
  return baseWeight * Math.exp(-lambda * t);
}

// ─────────────────────────────────────────────────────────────────
// MULTIPLICADOR DE RED (Consenso Multi-entidad)
// M_red = 1 + 0.2 × (n_entidades_distintas − 1)
// ─────────────────────────────────────────────────────────────────

function networkMultiplier(distinctEntities: number): number {
  if (distinctEntities <= 1) return 1.0;
  return Math.min(2.0, 1 + 0.2 * (distinctEntities - 1));
}

// ─────────────────────────────────────────────────────────────────
// CLASIFICACIÓN EN 4 NIVELES ACCIONABLES
// ─────────────────────────────────────────────────────────────────

function classifyScore(score: number): { tier: RiskTier; level: RiskLevel; recommendation: Recommendation } {
  if (score >= 76) return { tier: 'CRITICO',     level: 'ALTO',  recommendation: 'BLOQUEAR' };
  if (score >= 51) return { tier: 'ALTO_RIESGO', level: 'MEDIO', recommendation: 'REVISION_MANUAL' };
  if (score >= 21) return { tier: 'ALERTA',      level: 'MEDIO', recommendation: 'DESAFIO_2FA' };
  return             { tier: 'CONFIABLE',   level: 'BAJO',  recommendation: 'APROBAR' };
}

// ─────────────────────────────────────────────────────────────────
// MOTOR PRINCIPAL DE EVALUACIÓN DE RIESGO  (<50ms)
// ─────────────────────────────────────────────────────────────────

export async function evaluateRisk(
  type: IdentifierType,
  rawValue: string,
  tenantId: string = 'tenant-mp',
  ipAddress: string = '127.0.0.1'
): Promise<RiskEvaluationResult> {
  const startTime = performance.now();
  const tenant = (await db.getTenantById(tenantId)) || (await db.getTenantById('tenant-mp'))!;

  // 1. Blind Hash determinístico
  const { blindHash } = computeBlindHashSync(type, rawValue);
  const cacheKey = `risk_eval_v3:${blindHash}`;

  // 2. Caché Redis (300s)
  const cached = await redis.get<RiskEvaluationResult>(cacheKey);
  if (cached) {
    const elapsed = Math.round(performance.now() - startTime) + 1;
    await db.logAudit({
      tenantId: tenant.id,
      tenantName: tenant.name,
      endpoint: '/api/v1/risk/evaluate',
      identifierType: type,
      blindHashPreview: `${blindHash.slice(0, 8)}...${blindHash.slice(-6)}`,
      latencyMs: elapsed,
      statusCode: 200,
      ipAddress,
      actionType: 'API_CALL',
    });
    return { ...cached, latencyMs: elapsed, cached: true };
  }

  // 3. Buscar entidad en base de datos comunitaria
  const entity = await db.getFraudEntity(blindHash);

  // ── Variables base ────────────────────────────────────────────
  let distinctCount    = 0;
  let networkMatches   = 0;
  let severity         = 1;
  let primaryReason: FraudTypology | undefined;
  let lastReportedAt: string | undefined;
  let rehabilitated    = false;
  let rehabilitationReason: string | undefined;
  let hasOKVotes       = false;

  if (entity) {
    networkMatches        = entity.reportCount;
    distinctCount         = entity.distinctTenantsCount;
    severity              = entity.severity;
    primaryReason         = entity.primaryReason;
    lastReportedAt        = entity.lastReportedAt;
    rehabilitated         = entity.rehabilitated;
    rehabilitationReason  = entity.rehabilitationReason;
    hasOKVotes            = rehabilitated; // rehabilitación = voto OK aprobado
  }

  // ── PASO 1: Impacto decaído de los reportes de fraude ────────
  // Si no hay entidad → Score = 0 (identificador limpio)
  let fraudImpact = 0;

  if (entity && primaryReason && !rehabilitated) {
    const baseWeight = SEVERITY_WEIGHT[primaryReason] ?? 20;
    fraudImpact = decayedWeight(baseWeight, primaryReason, lastReportedAt);
  }

  // ── PASO 2: Multiplicador de red (consenso multi-entidad) ────
  // M_red = 1 + 0.2 × (n_entidades_distintas − 1)
  const Mred = entity && !rehabilitated ? networkMultiplier(distinctCount) : 1.0;

  // ── PASO 3: Atenuación por votos "OK" / rehabilitación ──────
  const okAttenuation = hasOKVotes ? Math.abs(SEVERITY_WEIGHT['OK']) : 0;

  // ── PASO 4: Score final clampado 0-100 ───────────────────────
  // S = min(100, max(0, Σ(ImpactoDecaído × M_red) − Σ(AtenuaciónOK)))
  let calculatedScore = 0;

  if (entity) {
    if (rehabilitated) {
      // Rehabilitado: score residual mínimo (10) para conservar trazabilidad
      calculatedScore = 10;
    } else {
      calculatedScore = Math.min(100, Math.max(0,
        Math.round(fraudImpact * Mred - okAttenuation)
      ));
    }
  }

  // ── PASO 5: Clasificación en 4 niveles ───────────────────────
  const { tier, level, recommendation } = rehabilitated
    ? { tier: 'CONFIABLE' as RiskTier, level: 'BAJO' as RiskLevel, recommendation: 'APROBAR' as Recommendation }
    : classifyScore(calculatedScore);

  const killSwitch = calculatedScore >= 90 && tier === 'CRITICO';

  // ── PASO 6: Construcción de la Risk Matrix para el breakdown ─
  const halfLifeDays = primaryReason ? (HALF_LIFE_DAYS[primaryReason] ?? 30) : 30;
  const lambda       = Math.LN2 / halfLifeDays;
  const t            = lastReportedAt
    ? Math.max(0, (Date.now() - new Date(lastReportedAt).getTime()) / 86_400_000)
    : 0;
  const decayFactor  = Math.round(Math.exp(-lambda * t) * 100); // 0-100%

  const riskMatrix: RiskMatrixFactors = {
    // Re-mapeamos a la estructura existente para no romper el componente de UI
    consensusScore:    Math.round(Math.min(100, distinctCount > 0 ? (distinctCount / 4) * 100 : 0)),
    consensusWeight:   20,   // ahora vía M_red multiplicador, no peso directo
    velocityScore:     Math.round(Math.min(100, (entity?.attemptsLast24h ?? 0) * 12)),
    velocityWeight:    0,    // integrado en M_red
    severityScore:     primaryReason ? (SEVERITY_WEIGHT[primaryReason] ?? 0) : 0,
    severityWeight:    100,  // es el peso base real
    recencyScore:      decayFactor,
    recencyWeight:     100,  // es el factor de decaimiento real
    totalWeightedScore: calculatedScore,
    // Campos extendidos del nuevo modelo
    networkMultiplier:  Math.round(Mred * 100) / 100,
    fraudImpactDecayed: Math.round(fraudImpact),
    okAttenuation,
    halfLifeDays,
    riskTier: tier,
  } as RiskMatrixFactors;

  const timestamp       = new Date().toISOString();
  const cryptoProof     = generateCryptographicProof(blindHash, calculatedScore, timestamp);
  const latencyMs       = Math.max(1, Math.round(performance.now() - startTime) + 4);

  const result: RiskEvaluationResult = {
    blindHash,
    identifierType:            type,
    riskScore:                 calculatedScore,
    riskLevel:                 level,
    riskTier:                  tier,
    recommendation,
    networkMatches,
    distinctInstitutionsCount: distinctCount,
    primaryReason,
    severity,
    lastReportedAt,
    rehabilitated,
    rehabilitationReason,
    cryptographicProof:        cryptoProof,
    latencyMs,
    cached:                    false,
    timestamp,
    riskMatrix,
    killSwitchTriggered:       killSwitch,
  };

  // Guardar en caché Redis
  await redis.set(cacheKey, result, 300);

  // Registro de auditoría
  await db.logAudit({
    tenantId:           tenant.id,
    tenantName:         tenant.name,
    endpoint:           '/api/v1/risk/evaluate',
    identifierType:     type,
    blindHashPreview:   `${blindHash.slice(0, 8)}...${blindHash.slice(-6)}`,
    latencyMs,
    statusCode:         200,
    ipAddress,
    actionType:         'API_CALL',
  });

  return result;
}
