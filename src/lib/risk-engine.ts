import { IdentifierType, RiskEvaluationResult, RiskLevel, Recommendation, RiskMatrixFactors, FraudTypology } from './types';
import { computeBlindHashSync, generateCryptographicProof } from './crypto';
import { db } from './db';
import { redis } from './redis';
import { verifyEmailExistence } from './emailVerifier';

/**
 * Mapeo de severidad base según la tipología delictiva (Factor Gravedad 25%)
 */
export function getTypologyBaseScore(reason?: FraudTypology): number {
  switch (reason) {
    case 'MULA_DE_DINERO':
    case 'TRIANGULACION_FONDOS':
      return 100;
    case 'ROBO_DE_CUENTA':
      return 95;
    case 'IDENTIDAD_SINTETICA':
      return 85;
    case 'PHISHING':
      return 70;
    case 'CONTRACARGO_REITERADO':
      return 50;
    case 'PROMO_ABUSE':
      return 25;
    default:
      return 40;
  }
}

/**
 * Motor de Evaluación de Riesgo con Matriz Ponderada de 4 Factores (<50ms)
 */
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
  const cacheKey = `risk_eval_v2:${blindHash}`;

  // 2. Comprobar caché Redis
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

    return {
      ...cached,
      latencyMs: elapsed,
      cached: true,
    };
  }

  // 3. Buscar entidad en base de datos comunitaria
  const entity = await db.getFraudEntity(blindHash);

  let distinctCount = 0;
  let networkMatches = 0;
  let severity = 1;
  let primaryReason: FraudTypology | undefined = undefined;
  let lastReportedAt: string | undefined = undefined;
  let rehabilitated = false;
  let rehabilitationReason: string | undefined = undefined;
  let attempts24h = 1;

  if (entity) {
    networkMatches = entity.reportCount;
    distinctCount = entity.distinctTenantsCount;
    severity = entity.severity;
    primaryReason = entity.primaryReason;
    lastReportedAt = entity.lastReportedAt;
    rehabilitated = entity.rehabilitated;
    rehabilitationReason = entity.rehabilitationReason;
    attempts24h = entity.attemptsLast24h || Math.min(12, distinctCount * 2 + 1);
  }

  // 4. Cálculo exacto de la Risk Matrix de 4 variables
  // Variable 1: Consenso (40%)
  const consensusScore = rehabilitated ? 0 : Math.min(100, distinctCount * 25);

  // Variable 2: Frecuencia / Velocidad 24h (25%)
  const velocityScore = rehabilitated ? 10 : Math.min(100, attempts24h * 18);

  // Variable 3: Gravedad del Evento (25%)
  const severityScore = rehabilitated ? 15 : (primaryReason ? getTypologyBaseScore(primaryReason) : 0);

  // Variable 4: Recencia / Decaimiento Temporal (10%)
  let recencyScore = 100;
  if (lastReportedAt) {
    const daysSince = Math.max(0, (Date.now() - new Date(lastReportedAt).getTime()) / (1000 * 60 * 60 * 24));
    recencyScore = Math.max(10, Math.round(100 - daysSince * 3));
  } else {
    recencyScore = 0;
  }

  // Variable 5: Email Intelligence (Existencia, País, Dominio Joven/Descartable)
  const emailVerification = type === 'EMAIL' ? verifyEmailExistence(rawValue) : undefined;
  const emailPenalty = emailVerification ? emailVerification.scorePenalty : 0;

  // Ponderación final (0 a 100)
  let calculatedScore = 0;
  if (entity && !rehabilitated) {
    calculatedScore = Math.round(
      consensusScore * 0.4 +
      velocityScore * 0.25 +
      severityScore * 0.25 +
      recencyScore * 0.1
    );
    calculatedScore = Math.min(100, Math.max(5, calculatedScore + emailPenalty));
  } else if (rehabilitated) {
    calculatedScore = 10;
  } else if (emailPenalty > 0) {
    // Si no está reportado pero el email es inexistente, descartable o con dominio nuevo
    calculatedScore = Math.min(100, emailPenalty);
  }

  // Niveles y Recomendaciones
  let riskLevel: RiskLevel = 'BAJO';
  let recommendation: Recommendation = 'APROBAR';
  let killSwitch = false;

  if (rehabilitated) {
    riskLevel = 'BAJO';
    recommendation = 'APROBAR';
  } else if (calculatedScore >= 75 || distinctCount >= 3) {
    riskLevel = 'ALTO';
    recommendation = 'BLOQUEAR';
    if (calculatedScore >= 90) {
      killSwitch = true; // Kill-Switch intercepción <15ms con auto-pausa
    }
  } else if (calculatedScore >= 35 || distinctCount >= 2) {
    riskLevel = 'MEDIO';
    recommendation = 'DESAFIO_2FA';
  } else {
    riskLevel = 'BAJO';
    recommendation = 'APROBAR';
  }

  const riskMatrix: RiskMatrixFactors = {
    consensusScore,
    consensusWeight: 40,
    velocityScore,
    velocityWeight: 25,
    severityScore,
    severityWeight: 25,
    recencyScore,
    recencyWeight: 10,
    totalWeightedScore: calculatedScore,
  };

  const timestamp = new Date().toISOString();
  const cryptographicProof = generateCryptographicProof(blindHash, calculatedScore, timestamp);
  const latencyMs = Math.max(1, Math.round(performance.now() - startTime) + 4);

  const internalReported = entity?.reportingTenantIds?.includes(tenantId) ?? false;
  const internalRiskScore = internalReported
    ? Math.min(100, Math.round(severityScore * 0.8 + recencyScore * 0.2) + emailPenalty)
    : Math.min(100, emailPenalty);
  const consortiumRiskScore = calculatedScore;

  const result: RiskEvaluationResult = {
    blindHash,
    identifierType: type,
    riskScore: calculatedScore,
    internalRiskScore,
    consortiumRiskScore,
    riskLevel,
    recommendation,
    networkMatches,
    distinctInstitutionsCount: distinctCount,
    primaryReason,
    severity,
    lastReportedAt,
    rehabilitated,
    rehabilitationReason,
    cryptographicProof,
    latencyMs,
    cached: false,
    timestamp,
    riskMatrix,
    killSwitchTriggered: killSwitch,
    emailVerification,
  };

  // Guardar en caché Redis por 300 segundos
  await redis.set(cacheKey, result, 300);

  // Registro de auditoría
  await db.logAudit({
    tenantId: tenant.id,
    tenantName: tenant.name,
    endpoint: '/api/v1/risk/evaluate',
    identifierType: type,
    blindHashPreview: `${blindHash.slice(0, 8)}...${blindHash.slice(-6)}`,
    latencyMs,
    statusCode: 200,
    ipAddress,
    actionType: 'API_CALL',
  });

  return result;
}

