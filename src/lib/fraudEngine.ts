import {
  FintechEntity,
  IdentityNode,
  SpecGraphEdge,
  ScoreBreakdown,
  LookupResult,
  IncidentCategory,
  IdentifierMatchDetail,
  ReasonCode,
  ServiceScope,
  DeviceCUITLink,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
} from './types';
import { normalizeIdentifier, hashData, CONSORTIUM_SALT } from './crypto';
import { verifyEmailExistence } from './emailVerifier';

// ─────────────────────────────────────────────────────────────────
// CONSTANTES DE SCORING v2 — 4 DIMENSIONES
// ─────────────────────────────────────────────────────────────────

/** Dimensión 1: Pesos base por categoría de incidente */
export const SEVERITY_BASE: Record<IncidentCategory, number> = {
  FRAUD_CONFIRMED: 95,
  MULE_ACCOUNT: 90,
  ACCOUNT_TAKEOVER: 80,
  IDENTITY_THEFT: 75,
  PHISHING: 55,
  CHARGEBACK: 50,
  SUSPICIOUS: 40,
};

/** Pisos mínimos residuales para categorías severas (nunca decae a 0) */
export const DECAY_FLOOR: Record<IncidentCategory, number> = {
  FRAUD_CONFIRMED: 45,
  MULE_ACCOUNT: 40,
  ACCOUNT_TAKEOVER: 25,
  IDENTITY_THEFT: 20,
  PHISHING: 10,
  CHARGEBACK: 10,
  SUSPICIOUS: 0,
};

/** Dimensión 2: Velocity & Multi-Entity */
export const MISMATCH_PENALTY = 45;
export const VELOCITY_PENALTY = 25;
export const VELOCITY_THRESHOLD = 3;
const VELOCITY_WINDOW_MS = 60 * 60 * 1000;

/** Multi-entity: ≥2 entidades distintas en <7 días → multiplicador */
const MULTI_ENTITY_THRESHOLD = 2;
const MULTI_ENTITY_WINDOW_DAYS = 7;
const MULTI_ENTITY_CRITICAL_SCORE = 97;

/** Dimensión 3: Device Farm Detection */
const DEVICE_FARM_CUIT_THRESHOLD = 3;
const DEVICE_FARM_WINDOW_DAYS = 14;
const DEVICE_FARM_CRITICAL_SCORE = 95;

/** Dimensión 4: Critical Override threshold */
const CRITICAL_OVERRIDE_THRESHOLD = 85;

// ─────────────────────────────────────────────────────────────────
// FUNCIÓN DE HASH (re-exporta usando CONSORTIUM_SALT)
// ─────────────────────────────────────────────────────────────────

export async function computeHash(
  type: 'DNI' | 'EMAIL' | 'PHONE' | 'IP' | 'CBU' | 'DEVICE' | 'CUIT',
  rawValue: string
): Promise<string> {
  const normalized = normalizeIdentifier(type, rawValue);
  return hashData(`${type}:${normalized}`, CONSORTIUM_SALT);
}

// ─────────────────────────────────────────────────────────────────
// FACTOR DE DECAIMIENTO TEMPORAL v2
// ─────────────────────────────────────────────────────────────────

/**
 * Curva de decaimiento con pisos residuales:
 * - 0-30 días: decay mínimo (factor ~0.86-1.0)
 * - 30-60 días: decay moderado (factor ~0.74-0.86)
 * - 60-90 días: decay significativo (factor ~0.64-0.74)
 * - 90-180 días: decay fuerte (factor ~0.41-0.64)
 * - >180 días: floor residual
 */
function timeDecayFactor(isoTimestamp: string): number {
  const daysSince =
    (Date.now() - new Date(isoTimestamp).getTime()) / (1000 * 60 * 60 * 24);
  // Exponential decay con constante calibrada para ventana de 180 días
  return Math.exp(-0.005 * Math.max(0, daysSince));
}

/**
 * Aplica decaimiento con piso residual según la categoría.
 */
function applyDecayWithFloor(
  baseScore: number,
  isoTimestamp: string,
  category: IncidentCategory
): number {
  const factor = timeDecayFactor(isoTimestamp);
  const decayed = baseScore * factor;
  const floor = DECAY_FLOOR[category] ?? 0;
  return Math.max(decayed, floor);
}

// ─────────────────────────────────────────────────────────────────
// DEVICE FARM DETECTION
// ─────────────────────────────────────────────────────────────────

export function detectDeviceFarm(
  deviceHash: string,
  deviceCUITLinks: DeviceCUITLink[]
): { isDeviceFarm: boolean; linkedCUITs: number; linkedCUITHashes: string[] } {
  const windowMs = DEVICE_FARM_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const recentLinks = deviceCUITLinks.filter(
    link =>
      link.tokenDevice === deviceHash &&
      now - new Date(link.timestamp).getTime() < windowMs
  );

  const distinctCUITs = Array.from(new Set(recentLinks.map(l => l.tokenCuit)));

  return {
    isDeviceFarm: distinctCUITs.length >= DEVICE_FARM_CUIT_THRESHOLD,
    linkedCUITs: distinctCUITs.length,
    linkedCUITHashes: distinctCUITs,
  };
}

// ─────────────────────────────────────────────────────────────────
// MULTI-ENTITY DETECTION
// ─────────────────────────────────────────────────────────────────

function detectMultiEntity(
  inputHashes: string[],
  graphEdges: SpecGraphEdge[]
): { isMultiEntity: boolean; distinctEntities: number; entityNames: string[] } {
  const windowMs = MULTI_ENTITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const recentEdges = graphEdges.filter(e => {
    if (e.isFalsePositive) return false;
    const isMatch =
      inputHashes.includes(e.sourceHash) || inputHashes.includes(e.targetHash);
    const isRecent = now - new Date(e.timestamp).getTime() < windowMs;
    return isMatch && isRecent;
  });

  const entityMap = new Map<string, string>();
  recentEdges.forEach(e => {
    entityMap.set(e.reportedByEntityId, e.entityName || e.reportedByEntityId);
  });

  return {
    isMultiEntity: entityMap.size >= MULTI_ENTITY_THRESHOLD,
    distinctEntities: entityMap.size,
    entityNames: Array.from(entityMap.values()),
  };
}

// ─────────────────────────────────────────────────────────────────
// REASON CODES ENGINE
// ─────────────────────────────────────────────────────────────────

function buildReasonCodes(params: {
  matchingEdges: SpecGraphEdge[];
  multiEntityDetected: boolean;
  deviceFarmDetected: boolean;
  velocityTriggered: boolean;
  mismatchDetected: boolean;
  criticalOverride: boolean;
  timeDecayApplied: boolean;
  finalScore: number;
}): ReasonCode[] {
  const codes: ReasonCode[] = [];

  if (params.finalScore === 0 && params.matchingEdges.length === 0) {
    codes.push('CLEAN_RECORD');
    return codes;
  }

  // Categorías presentes
  const categories = new Set(params.matchingEdges.map(e => e.incidentCategory));

  if (categories.has('FRAUD_CONFIRMED')) codes.push('FRAUD_CONFIRMED_HIT');
  if (categories.has('MULE_ACCOUNT')) codes.push('MULE_ACCOUNT_RECENT');
  if (categories.has('ACCOUNT_TAKEOVER')) codes.push('ACCOUNT_TAKEOVER_FLAG');
  if (categories.has('PHISHING')) codes.push('PHISHING_ORIGIN');
  if (categories.has('CHARGEBACK')) codes.push('CHARGEBACK_HISTORY');

  if (params.deviceFarmDetected) codes.push('MULTI_IDENTITY_DEVICE_FARM');
  if (params.multiEntityDetected) codes.push('MULTI_BANK_HIT');
  if (params.velocityTriggered) codes.push('VELOCITY_SPIKE');
  if (params.mismatchDetected) codes.push('IDENTITY_MISMATCH');
  if (params.criticalOverride) codes.push('CRITICAL_OVERRIDE');
  if (params.timeDecayApplied) codes.push('AGED_INCIDENT_DECAYED');

  // Priorizar por severidad
  const priority: Record<ReasonCode, number> = {
    MULTI_IDENTITY_DEVICE_FARM: 100,
    CRITICAL_OVERRIDE: 95,
    FRAUD_CONFIRMED_HIT: 90,
    MULE_ACCOUNT_RECENT: 85,
    MULTI_BANK_HIT: 80,
    ACCOUNT_TAKEOVER_FLAG: 75,
    VELOCITY_SPIKE: 70,
    IDENTITY_MISMATCH: 65,
    DEVICE_LINKED_FRAUD: 60,
    PHISHING_ORIGIN: 55,
    CHARGEBACK_HISTORY: 50,
    INTERNAL_RECURRENCE: 45,
    AGED_INCIDENT_DECAYED: 20,
    CLEAN_RECORD: 0,
  };

  return codes.sort((a, b) => (priority[b] || 0) - (priority[a] || 0));
}

// ─────────────────────────────────────────────────────────────────
// EVALUACIÓN PRINCIPAL v2
// ─────────────────────────────────────────────────────────────────

export async function evaluateRisk(params: {
  dni?: string;
  email?: string;
  phone?: string;
  ip?: string;
  cbu?: string;
  device?: string;
  cuit?: string;
  fintechId: string;
  fintechs: FintechEntity[];
  identityNodes: IdentityNode[];
  graphEdges: SpecGraphEdge[];
  deviceCUITLinks?: DeviceCUITLink[];
  scope?: ServiceScope;
  scoringConfig?: ScoringConfig;
}): Promise<LookupResult> {
  const {
    dni, email, phone, ip, cbu, device, cuit,
    fintechId, fintechs, identityNodes, graphEdges,
    deviceCUITLinks = [],
    scope = 'CONSORTIUM',
    scoringConfig = DEFAULT_SCORING_CONFIG,
  } = params;

  // Hashes de los identificadores provistos
  const dniHash = dni ? await computeHash('DNI', dni) : null;
  const emailHash = email ? await computeHash('EMAIL', email) : null;
  const phoneHash = phone ? await computeHash('PHONE', phone) : null;
  const ipHash = ip ? await computeHash('IP', ip) : null;
  const cbuHash = cbu ? await computeHash('CBU', cbu) : null;
  const deviceHash = device ? await computeHash('DEVICE', device) : null;
  const cuitHash = cuit ? await computeHash('CUIT', cuit) : null;

  const inputHashes = [dniHash, emailHash, phoneHash, ipHash, cbuHash, deviceHash, cuitHash]
    .filter(Boolean) as string[];

  const paramCount = inputHashes.length;

  const highThresh = scoringConfig?.highRiskThreshold ?? 70;
  const medThresh = scoringConfig?.mediumRiskThreshold ?? 30;

  // ─────────────────────────────────────────────────────────────────
  // EVALUADOR MODULAR POR ÁMBITO (INTERNAL vs CONSORTIUM)
  // ─────────────────────────────────────────────────────────────────
  const evaluateScope = (edges: SpecGraphEdge[], isConsortium: boolean) => {
    let historicalReportsScore = 0;
    const matchingEdges: SpecGraphEdge[] = [];
    let timeDecayApplied = false;
    let worstDecayFactor = 1;

    for (const edge of edges) {
      if (edge.isFalsePositive) continue;
      const isMatch =
        inputHashes.includes(edge.sourceHash) || inputHashes.includes(edge.targetHash);
      if (!isMatch) continue;

      matchingEdges.push(edge);

      const reportingFintech = fintechs.find(f => f.id === edge.reportedByEntityId);
      const trustWeight = reportingFintech ? reportingFintech.trustWeight : 0.5;
      const severityBase = (scoringConfig?.severityBase && scoringConfig.severityBase[edge.incidentCategory]) ?? SEVERITY_BASE[edge.incidentCategory] ?? 15;
      const decay = timeDecayFactor(edge.timestamp);

      if (decay < 0.95) timeDecayApplied = true;
      worstDecayFactor = Math.min(worstDecayFactor, decay);

      const decayedScore = applyDecayWithFloor(
        severityBase * trustWeight,
        edge.timestamp,
        edge.incidentCategory
      );

      historicalReportsScore += decayedScore;
    }

    historicalReportsScore = Math.min(100, historicalReportsScore);

    // Mismatch
    let mismatchDetected = false;
    let mismatchPenalty = 0;

    if (dniHash && (emailHash || phoneHash || cbuHash)) {
      for (const edge of edges) {
        if (edge.isFalsePositive) continue;
        if (edge.sourceHash === edge.targetHash) continue;

        const checkMismatch = (targetHash: string) => {
          const inEdge =
            edge.sourceHash === targetHash || edge.targetHash === targetHash;
          if (inEdge) {
            const otherHash =
              edge.sourceHash === targetHash ? edge.targetHash : edge.sourceHash;
            if (otherHash !== dniHash) return true;
          }
          return false;
        };

        if (emailHash && checkMismatch(emailHash)) { mismatchDetected = true; break; }
        if (phoneHash && checkMismatch(phoneHash)) { mismatchDetected = true; break; }
        if (cbuHash && checkMismatch(cbuHash)) { mismatchDetected = true; break; }
      }
      if (mismatchDetected) mismatchPenalty = scoringConfig?.mismatchPenalty ?? MISMATCH_PENALTY;
    }

    // Velocity
    let velocityTriggered = false;
    let velocityPenalty = 0;
    const velThreshold = scoringConfig?.velocityThreshold ?? VELOCITY_THRESHOLD;

    for (const hash of inputHashes) {
      const node = identityNodes.find(n => n.hash === hash);
      if (node && node.lookupsLastHour >= velThreshold) {
        velocityTriggered = true;
        break;
      }
    }

    if (!velocityTriggered && inputHashes.length > 0) {
      const recentEdges = edges.filter(e => {
        if (e.isFalsePositive) return false;
        const isMatch =
          inputHashes.includes(e.sourceHash) || inputHashes.includes(edge.targetHash);
        const isRecent =
          Date.now() - new Date(e.timestamp).getTime() < VELOCITY_WINDOW_MS;
        return isMatch && isRecent;
      });

      const distinctEntities = new Set(recentEdges.map(e => e.reportedByEntityId));
      if (distinctEntities.size >= velThreshold) {
        velocityTriggered = true;
      }
    }

    if (velocityTriggered) velocityPenalty = scoringConfig?.velocityPenalty ?? VELOCITY_PENALTY;

    // Multi-Entity Multiplier (solo aplica al consorcio)
    const multiEntity = isConsortium
      ? detectMultiEntity(inputHashes, edges)
      : { isMultiEntity: false, distinctEntities: 1, entityNames: [] };
    let multiEntityMultiplier = 1;

    if (multiEntity.isMultiEntity) {
      if (multiEntity.distinctEntities >= 4) {
        multiEntityMultiplier = scoringConfig?.multiEntityMultipliers?.fourOrMore ?? 1.80;
      } else if (multiEntity.distinctEntities === 3) {
        multiEntityMultiplier = scoringConfig?.multiEntityMultipliers?.three ?? 1.50;
      } else {
        multiEntityMultiplier = scoringConfig?.multiEntityMultipliers?.two ?? 1.25;
      }
    }

    // Device Farm
    let deviceFarmDetected = false;
    let deviceFarmScore = 0;
    const farmThreshold = scoringConfig?.deviceFarmThreshold ?? DEVICE_FARM_CUIT_THRESHOLD;

    if (deviceHash) {
      const farmLinks = isConsortium
        ? deviceCUITLinks
        : deviceCUITLinks.filter(l => l.entityId === fintechId);
      const farmResult = detectDeviceFarm(deviceHash, farmLinks);
      if (farmResult.isDeviceFarm || farmResult.linkedCUITs >= farmThreshold) {
        deviceFarmDetected = true;
        deviceFarmScore = scoringConfig?.deviceFarmFloor ?? DEVICE_FARM_CRITICAL_SCORE;
      }
    }

    // Email
    const emailVerification = email ? verifyEmailExistence(email) : null;
    let emailPenalty = 0;
    if (emailVerification) {
      if (emailVerification.status === 'NON_EXISTENT') {
        emailPenalty += scoringConfig?.emailPenalties?.nonExistent ?? 35;
      } else if (emailVerification.status === 'DISPOSABLE') {
        emailPenalty += scoringConfig?.emailPenalties?.disposable ?? 40;
      }
      if (emailVerification.domainAgeDays != null) {
        if (emailVerification.domainAgeDays < 30) {
          emailPenalty += scoringConfig?.emailPenalties?.newDomain ?? 25;
        } else if (emailVerification.domainAgeDays < 365) {
          emailPenalty += scoringConfig?.emailPenalties?.mediumDomain ?? 10;
        }
      }
      if (emailPenalty === 0 && emailVerification.scorePenalty > 0) {
        emailPenalty = emailVerification.scorePenalty;
      }
    }

    // Score bruto
    let rawScore =
      historicalReportsScore + mismatchPenalty + velocityPenalty + emailPenalty;

    if (multiEntity.isMultiEntity && rawScore > 0) {
      rawScore = Math.min(MULTI_ENTITY_CRITICAL_SCORE, rawScore * multiEntityMultiplier);
    }

    if (deviceFarmDetected) {
      rawScore = Math.max(rawScore, deviceFarmScore);
    }

    // Critical Override
    let criticalOverride = false;
    let criticalOverrideSource: string | undefined;
    const compositeStrategy = paramCount > 1 ? 'MAX_SEVERITY_WEIGHTED' : 'SINGLE_PARAM';
    const critOverrideThresh = scoringConfig?.criticalOverrideThreshold ?? CRITICAL_OVERRIDE_THRESHOLD;

    if (paramCount > 1) {
      const individualScores: { type: string; score: number }[] = [];

      const calcIndividualScore = (hash: string | null, type: string) => {
        if (!hash) return;
        let score = 0;
        for (const edge of matchingEdges) {
          if (edge.sourceHash === hash || edge.targetHash === hash) {
            const fintech = fintechs.find(f => f.id === edge.reportedByEntityId);
            const tw = fintech ? fintech.trustWeight : 0.5;
            const sev = (scoringConfig?.severityBase && scoringConfig.severityBase[edge.incidentCategory]) ?? SEVERITY_BASE[edge.incidentCategory] ?? 15;
            score += applyDecayWithFloor(
              sev * tw,
              edge.timestamp,
              edge.incidentCategory
            );
          }
        }
        individualScores.push({ type, score: Math.min(100, score) });
      };

      calcIndividualScore(dniHash, 'DNI');
      calcIndividualScore(emailHash, 'EMAIL');
      calcIndividualScore(phoneHash, 'PHONE');
      calcIndividualScore(ipHash, 'IP');
      calcIndividualScore(cbuHash, 'CBU');
      calcIndividualScore(deviceHash, 'DEVICE');
      calcIndividualScore(cuitHash, 'CUIT');

      const maxIndividual = individualScores.reduce(
        (max, cur) => (cur.score > max.score ? cur : max),
        { type: '', score: 0 }
      );

      if (maxIndividual.score >= critOverrideThresh) {
        criticalOverride = true;
        criticalOverrideSource = maxIndividual.type;
        rawScore = Math.max(rawScore, Math.min(100, maxIndividual.score * 1.05));
      }
    }

    const score = Math.min(100, Math.max(0, Math.round(rawScore)));
    const level: 'BAJO' | 'MEDIO' | 'ALTO' =
      score >= highThresh ? 'ALTO' : score >= medThresh ? 'MEDIO' : 'BAJO';

    return {
      score,
      level,
      historicalReportsScore,
      matchingEdges,
      timeDecayApplied,
      worstDecayFactor,
      mismatchDetected,
      mismatchPenalty,
      velocityTriggered,
      velocityPenalty,
      multiEntity,
      multiEntityMultiplier,
      deviceFarmDetected,
      deviceFarmScore,
      emailVerification,
      emailPenalty,
      criticalOverride,
      criticalOverrideSource,
      compositeStrategy,
    };
  };

  // ── 1. SCORE DE LA ENTIDAD (Reportes e Historial Propios de esa Entidad) ──
  const internalEdges = graphEdges.filter(
    e => !e.isFalsePositive && (e.reportedByEntityId === fintechId || e.scope === 'INTERNAL')
  );
  const internalEval = evaluateScope(internalEdges, false);
  const internalRiskScore = (scoringConfig?.scoreOverrides?.enabled && scoringConfig.scoreOverrides.manualEntityScore != null)
    ? scoringConfig.scoreOverrides.manualEntityScore
    : internalEval.score;
  const internalRiskLevel: 'BAJO' | 'MEDIO' | 'ALTO' =
    internalRiskScore >= highThresh ? 'ALTO' : internalRiskScore >= medThresh ? 'MEDIO' : 'BAJO';

  // ── 2. SCORE DEL CONSORCIO (Inteligencia Colectiva y Red Federal) ──────────
  const consortiumEdges = graphEdges.filter(e => !e.isFalsePositive);
  const consortiumEval = evaluateScope(consortiumEdges, true);
  const consortiumRiskScore = (scoringConfig?.scoreOverrides?.enabled && scoringConfig.scoreOverrides.manualConsortiumScore != null)
    ? scoringConfig.scoreOverrides.manualConsortiumScore
    : consortiumEval.score;
  const consortiumRiskLevel: 'BAJO' | 'MEDIO' | 'ALTO' =
    consortiumRiskScore >= highThresh ? 'ALTO' : consortiumRiskScore >= medThresh ? 'MEDIO' : 'BAJO';

  // Selección del contexto activo según scope
  const activeEval = scope === 'INTERNAL' ? internalEval : consortiumEval;
  const finalScore = scope === 'INTERNAL' ? internalRiskScore : consortiumRiskScore;
  const riskLevel = scope === 'INTERNAL' ? internalRiskLevel : consortiumRiskLevel;

  const recommendation: 'ALLOW' | 'REVIEW' | 'BLOCK' =
    finalScore >= highThresh ? 'BLOCK' : finalScore >= medThresh ? 'REVIEW' : 'ALLOW';

  // Reason codes
  const reasonCodes = buildReasonCodes({
    matchingEdges: activeEval.matchingEdges,
    multiEntityDetected: activeEval.multiEntity.isMultiEntity,
    deviceFarmDetected: activeEval.deviceFarmDetected,
    velocityTriggered: activeEval.velocityTriggered,
    mismatchDetected: activeEval.mismatchDetected,
    criticalOverride: activeEval.criticalOverride,
    timeDecayApplied: activeEval.timeDecayApplied,
    finalScore,
  });

  // ── DESGLOSE DATO POR DATO ────────────────────────────────────
  const maskValue = (type: string, val: string) => {
    if (type === 'DNI') return `${val.slice(0, 2)}***${val.slice(-3)}`;
    if (type === 'EMAIL') {
      const [u, d] = val.split('@');
      return `${u.slice(0, 3)}***@${d || '?'}`;
    }
    if (type === 'PHONE') return `${val.slice(0, 4)}***${val.slice(-3)}`;
    if (type === 'IP') {
      const parts = val.split('.');
      return parts.length === 4 ? `${parts[0]}.${parts[1]}.***.${parts[3]}` : val;
    }
    if (type === 'CBU') return `${val.slice(0, 4)}***${val.slice(-4)}`;
    if (type === 'CUIT') return `${val.slice(0, 2)}-***-${val.slice(-1)}`;
    if (type === 'DEVICE') return `${val.slice(0, 8)}...${val.slice(-6)}`;
    return val;
  };

  const identifierDetails: IdentifierMatchDetail[] = [];
  const scopedEdges = scope === 'INTERNAL' ? internalEdges : consortiumEdges;

  const checkIdentifier = (
    type: 'DNI' | 'EMAIL' | 'PHONE' | 'IP' | 'CBU' | 'DEVICE' | 'CUIT',
    rawVal?: string,
    hash?: string | null
  ) => {
    if (!rawVal || !hash) return;
    const matched = scopedEdges.filter(
      e => !e.isFalsePositive && (e.sourceHash === hash || e.targetHash === hash)
    );
    const distinctEntities = new Set(matched.map(e => e.reportedByEntityId)).size;
    const categories = Array.from(new Set(matched.map(e => e.incidentCategory)));

    let lastSeenDaysAgo: number | undefined;
    if (matched.length > 0) {
      const latest = matched.reduce((max, e) =>
        new Date(e.timestamp).getTime() > new Date(max.timestamp).getTime() ? e : max
      );
      lastSeenDaysAgo = Math.floor(
        (Date.now() - new Date(latest.timestamp).getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    let decayedScore = 0;
    for (const edge of matched) {
      const fintech = fintechs.find(f => f.id === edge.reportedByEntityId);
      const tw = fintech ? fintech.trustWeight : 0.5;
      decayedScore += applyDecayWithFloor(
        (SEVERITY_BASE[edge.incidentCategory] ?? 15) * tw,
        edge.timestamp,
        edge.incidentCategory
      );
    }

    identifierDetails.push({
      type,
      valueMasked: maskValue(type, rawVal),
      matched: matched.length > 0,
      reportsCount: matched.length,
      distinctEntitiesCount: distinctEntities,
      categories,
      scope,
      lastSeenDaysAgo,
      decayedScore: Math.min(100, Math.round(decayedScore)),
    });
  };

  checkIdentifier('DNI', dni, dniHash);
  checkIdentifier('EMAIL', email, emailHash);
  checkIdentifier('PHONE', phone, phoneHash);
  checkIdentifier('IP', ip, ipHash);
  checkIdentifier('CBU', cbu, cbuHash);
  checkIdentifier('DEVICE', device, deviceHash);
  checkIdentifier('CUIT', cuit, cuitHash);

  const breakdown: ScoreBreakdown = {
    // Score Dual
    internalRiskScore,
    internalRiskLevel,
    consortiumRiskScore,
    consortiumRiskLevel,
    // Dimensión 1
    historicalReportsScore: Math.round(activeEval.historicalReportsScore),
    // Dimensión 2
    mismatchPenalty: activeEval.mismatchPenalty,
    velocityPenalty: activeEval.velocityPenalty,
    multiEntityMultiplier: activeEval.multiEntityMultiplier,
    // Dimensión 3 - Time Decay
    timeDecayApplied: activeEval.timeDecayApplied,
    timeDecayFactor: activeEval.worstDecayFactor,
    // Dimensión 4 - Device Farm
    deviceFarmDetected: activeEval.deviceFarmDetected,
    deviceFarmScore: activeEval.deviceFarmScore,
    // Email
    emailPenalty: activeEval.emailPenalty,
    emailVerification: activeEval.emailVerification,
    // Score Final
    finalScore,
    riskLevel,
    recommendation,
    criticalOverride: activeEval.criticalOverride,
    criticalOverrideSource: activeEval.criticalOverrideSource,
    // Explicabilidad
    reasonCodes,
    compositeStrategy: activeEval.compositeStrategy,
    // Desglose
    mismatchDetected: activeEval.mismatchDetected,
    velocityTriggered: activeEval.velocityTriggered,
    matchingEdges: activeEval.matchingEdges,
    identifierDetails,
  };

  return {
    dniHash,
    emailHash,
    phoneHash,
    ipHash,
    cbuHash,
    deviceHash,
    cuitHash,
    internalRiskScore,
    internalRiskLevel,
    consortiumRiskScore,
    consortiumRiskLevel,
    breakdown,
    timestamp: new Date().toISOString(),
    fintechId,
    scope,
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
  type: 'DNI' | 'EMAIL' | 'PHONE' | 'IP' | 'CBU' | 'DEVICE' | 'CUIT',
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
  ipHash?: string | null;
  cbuHash?: string | null;
  deviceHash?: string | null;
  cuitHash?: string | null;
  reportedByEntityId: string;
  incidentCategory: IncidentCategory;
  uploadedFields?: string;
  uploadMethod?: 'MANUAL' | 'CSV_BULK' | 'API';
  entityName?: string;
  scope?: ServiceScope;
}): SpecGraphEdge[] {
  const {
    dniHash,
    emailHash,
    phoneHash,
    ipHash,
    cbuHash,
    deviceHash,
    cuitHash,
    reportedByEntityId,
    incidentCategory,
    uploadedFields,
    uploadMethod = 'MANUAL',
    entityName,
    scope = 'CONSORTIUM',
  } = params;
  const hashes = [dniHash, emailHash, phoneHash, ipHash, cbuHash, deviceHash, cuitHash]
    .filter(Boolean) as string[];
  const edges: SpecGraphEdge[] = [];
  const now = new Date().toISOString();

  // Si solo se proveyó un identificador (ej: solo DNI o solo CBU),
  // se genera una arista unitaria/self-edge para que quede indexado en el grafo
  // y compute para el score de riesgo en futuras consultas.
  if (hashes.length === 1) {
    edges.push({
      id: `edge-${Date.now()}-0-0-${Math.random().toString(36).slice(2, 6)}`,
      sourceHash: hashes[0],
      targetHash: hashes[0],
      reportedByEntityId,
      incidentCategory,
      timestamp: now,
      isFalsePositive: false,
      uploadedFields,
      uploadMethod,
      entityName,
      scope,
    });
    return edges;
  }

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
        uploadedFields,
        uploadMethod,
        entityName,
        scope,
      });
    }
  }

  return edges;
}
