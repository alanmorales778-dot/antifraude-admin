// ─────────────────────────────────────────────────────────────────
// INTERFACES DEL SPEC (Store Client-Side / fraudEngine.ts)
// ─────────────────────────────────────────────────────────────────

export type IncidentCategory =
  | 'MULE_ACCOUNT'
  | 'IDENTITY_THEFT'
  | 'CHARGEBACK'
  | 'PHISHING'
  | 'SUSPICIOUS'
  | 'FRAUD_CONFIRMED'
  | 'ACCOUNT_TAKEOVER';

export type ReasonCode =
  | 'CLEAN_RECORD'
  | 'MULE_ACCOUNT_RECENT'
  | 'FRAUD_CONFIRMED_HIT'
  | 'MULTI_BANK_HIT'
  | 'MULTI_IDENTITY_DEVICE_FARM'
  | 'AGED_INCIDENT_DECAYED'
  | 'CRITICAL_OVERRIDE'
  | 'VELOCITY_SPIKE'
  | 'IDENTITY_MISMATCH'
  | 'ACCOUNT_TAKEOVER_FLAG'
  | 'PHISHING_ORIGIN'
  | 'CHARGEBACK_HISTORY'
  | 'DEVICE_LINKED_FRAUD'
  | 'INTERNAL_RECURRENCE';

export type ServiceScope = 'INTERNAL' | 'CONSORTIUM';

export interface FintechEntity {
  id: string;
  name: string;
  apiKey: string;
  trustWeight: number; // 0.0 a 1.0
  status: 'ACTIVE' | 'SUSPENDED';
  queriesCount: number;
  reportsCount: number;
  falsePositivesCount: number;
}

export interface IdentityNode {
  type: 'DNI' | 'EMAIL' | 'PHONE' | 'IP' | 'CBU' | 'DEVICE' | 'CUIT';
  hash: string; // SHA-256 con salt
  firstSeen: string; // ISO
  lastSeen: string; // ISO
  totalLookups: number;
  lookupsLastHour: number;
}

export interface SpecGraphEdge {
  id: string;
  sourceHash: string;
  targetHash: string;
  reportedByEntityId: string;
  incidentCategory: IncidentCategory;
  timestamp: string; // ISO
  isFalsePositive: boolean;
  uploadedFields?: string;
  uploadMethod?: 'MANUAL' | 'CSV_BULK' | 'API';
  entityName?: string;
  scope?: ServiceScope; // Internal vs Consortium
}

export interface StoreAuditLog {
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

export interface DeviceCUITLink {
  tokenDevice: string;
  tokenCuit: string;
  timestamp: string;
  entityId: string;
}

export interface IdentifierMatchDetail {
  type: 'DNI' | 'EMAIL' | 'PHONE' | 'IP' | 'CBU' | 'DEVICE' | 'CUIT';
  valueMasked: string;
  matched: boolean;
  reportsCount: number;
  distinctEntitiesCount: number;
  categories: IncidentCategory[];
  scope?: ServiceScope;
  lastSeenDaysAgo?: number;
  decayedScore?: number;
}

export interface ScoreBreakdown {
  // ── Score Dual: Entidad vs Consorcio ──
  internalRiskScore: number;
  internalRiskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
  consortiumRiskScore: number;
  consortiumRiskLevel: 'BAJO' | 'MEDIO' | 'ALTO';

  // ── Dimensión 1: Severidad Base ──
  historicalReportsScore: number;
  // ── Dimensión 2: Multi-Entity / Velocity ──
  mismatchPenalty: number;
  velocityPenalty: number;
  multiEntityMultiplier: number;
  // ── Dimensión 3: Decaimiento Temporal ──
  timeDecayApplied: boolean;
  timeDecayFactor: number;
  // ── Dimensión 4: Device Farm ──
  deviceFarmDetected: boolean;
  deviceFarmScore: number;
  // ── Email ──
  emailPenalty?: number;
  emailVerification?: {
    email: string;
    domain: string;
    status: 'EXISTING' | 'NON_EXISTENT' | 'DISPOSABLE' | 'INVALID_FORMAT';
    isDeliverable: boolean;
    isDisposable: boolean;
    mxValid: boolean;
    scorePenalty: number;
    badgeText: string;
    alertTitle?: string;
    alertMessage?: string;
  } | null;
  // ── Score Final ──
  finalScore: number;
  riskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
  recommendation: 'ALLOW' | 'REVIEW' | 'BLOCK';
  criticalOverride: boolean;
  criticalOverrideSource?: string;
  // ── Explicabilidad ──
  reasonCodes: ReasonCode[];
  compositeStrategy: 'SINGLE_PARAM' | 'MAX_SEVERITY_WEIGHTED';
  // ── Desglose ──
  mismatchDetected: boolean;
  velocityTriggered: boolean;
  matchingEdges: SpecGraphEdge[];
  identifierDetails?: IdentifierMatchDetail[];
}

export interface LookupResult {
  dniHash: string | null;
  emailHash: string | null;
  phoneHash: string | null;
  ipHash?: string | null;
  cbuHash?: string | null;
  deviceHash?: string | null;
  cuitHash?: string | null;
  internalRiskScore: number;
  internalRiskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
  consortiumRiskScore: number;
  consortiumRiskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
  breakdown: ScoreBreakdown;
  timestamp: string;
  fintechId: string;
  scope: ServiceScope;
}

// ─────────────────────────────────────────────────────────────────
// TIPOS LEGACY (API server-side / db.ts / risk-engine.ts)
// ─────────────────────────────────────────────────────────────────

export type IdentifierType = 'EMAIL' | 'DNI' | 'PHONE' | 'IP' | 'CBU' | 'CBU_CVU' | 'TAX_ID' | 'CARD_BIN' | 'DEVICE' | 'CUIT';

export type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO';

export type Recommendation = 'APROBAR' | 'DESAFIO_2FA' | 'BLOQUEAR';

export type FraudTypology =
  | 'MULA_DE_DINERO'
  | 'ROBO_DE_CUENTA'
  | 'IDENTIDAD_SINTETICA'
  | 'CONTRACARGO_REITERADO'
  | 'PHISHING'
  | 'PROMO_ABUSE'
  | 'TRIANGULACION_FONDOS'
  | 'OPERACION_SOSPECHOSA'
  | 'FRAUDE_CONFIRMADO'
  | 'TAKEOVER_CUENTA';

export type UserRole = 'ANALYST_L1' | 'ANALYST_L2' | 'TENANT_ADMIN' | 'SUPER_ADMIN' | 'SUPERADMIN';

export type PortalType = 'ENTITY_PORTAL' | 'SUPERADMIN_PORTAL';

export interface Tenant {
  id: string;
  name: string;
  code: string;
  apiKey: string;
  apiKeyHash: string;
  subscriptionTier: 'ENTERPRISE' | 'GROWTH' | 'PILOT';
  trustScore: number;
  status: 'ACTIVE' | 'SUSPENDED';
  inQuarantine: boolean;
  joinedAt: string;
  logo: string;
  noiseRate: number;
}

export interface RiskMatrixFactors {
  consensusScore: number;
  consensusWeight: number;
  velocityScore: number;
  velocityWeight: number;
  severityScore: number;
  severityWeight: number;
  recencyScore: number;
  recencyWeight: number;
  totalWeightedScore: number;
}

export interface FraudEvent {
  id: string;
  blindHash: string;
  tenantId: string;
  tenantName: string;
  reason: FraudTypology;
  severity: number;
  incidentDate: string;
  nonPiiNotes?: string;
  createdAt: string;
}

export interface FraudEntity {
  blindHash: string;
  entityType: IdentifierType;
  riskScore: number;
  reportCount: number;
  distinctTenantsCount: number;
  reportingTenantIds: string[];
  primaryReason: FraudTypology;
  severity: number;
  lastReportedAt: string;
  rehabilitated: boolean;
  rehabilitatedAt?: string;
  rehabilitationReason?: string;
  createdAt: string;
  updatedAt: string;
  attemptsLast24h?: number;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  tenantName: string;
  endpoint: string;
  identifierType?: IdentifierType;
  blindHashPreview?: string;
  latencyMs: number;
  statusCode: number;
  ipAddress: string;
  timestamp: string;
  actionType?: 'API_CALL' | 'MANUAL_LOOKUP' | 'RULE_MODIFIED' | 'AUTH_FAILED' | 'QUARANTINE_TOGGLED';
}

export interface RiskEvaluationResult {
  blindHash: string;
  identifierType: IdentifierType;
  riskScore: number;
  internalRiskScore?: number;
  internalRiskLevel?: RiskLevel;
  consortiumRiskScore?: number;
  consortiumRiskLevel?: RiskLevel;
  riskLevel: RiskLevel;
  recommendation: Recommendation;
  networkMatches: number;
  distinctInstitutionsCount: number;
  primaryReason?: FraudTypology;
  severity: number;
  lastReportedAt?: string;
  rehabilitated: boolean;
  rehabilitationReason?: string;
  cryptographicProof: string;
  latencyMs: number;
  cached: boolean;
  timestamp: string;
  riskMatrix: RiskMatrixFactors;
  killSwitchTriggered?: boolean;
}

export interface WebhookConfig {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secretKey: string;
  status: 'ACTIVE' | 'PAUSED';
  lastTriggeredAt?: string;
  successRate: number;
}

export interface DynamicRule {
  id: string;
  name: string;
  conditionDescription: string;
  actionDescription: string;
  enabled: boolean;
  backtestAccuracy: number;
  backtestFpRate: number;
  ruleJson: {
    minScore?: number;
    minTenants?: number;
    eventType?: string;
    action: 'REQUIRE_BIOMETRICS' | 'AUTO_BLOCK' | 'DELAY_FUNDS' | 'NOTIFY_ANALYST';
  };
}

export interface BlindWarRoom {
  id: string;
  title: string;
  attackVector: string;
  affectedCount: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  status: 'ACTIVE_CRISIS' | 'CONTAINED' | 'RESOLVED';
  createdAt: string;
  messages: {
    id: string;
    senderAlias: string;
    text: string;
    timestamp: string;
    isTelemetryAlert?: boolean;
  }[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'IDENTIFIER' | 'DEVICE' | 'IP' | 'MULE_ACCOUNT';
  riskScore: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface DeviceFingerprintHash {
  hardwareHash: string;
  ipSubnet: string;
  screenSpec: string;
  gpuSignature: string;
  isDeviceFarmSuspect: boolean;
}

// ─────────────────────────────────────────────────────────────────
// ALERTAS DE RED COMUNITARIA (PORTAL ENTIDADES)
// ─────────────────────────────────────────────────────────────────

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type AlertStatus =
  | 'PENDING_REVIEW'
  | 'IN_ANALYSIS'
  | 'CONFIRMED_BLOCKED'
  | 'CHALLENGED_2FA'
  | 'DISMISSED_FP';

export interface BlindAlertIdentifier {
  type: 'DNI' | 'EMAIL' | 'PHONE' | 'IP' | 'DEVICE' | 'CUIT';
  hash: string;
  maskedPreview: string;
  lookupsCount24h: number;
  velocityScore: number;
}

export interface NetworkAlert {
  id: string;
  code: string;
  title: string;
  category: IncidentCategory;
  severity: AlertSeverity;
  status: AlertStatus;
  riskScore: number;
  createdAt: string;
  lastActivityAt: string;
  targetEntityId: string;
  reportingEntitiesCount: number;
  reportingEntitiesNames: string[];
  blindIdentifiers: BlindAlertIdentifier[];
  triggerRule: {
    ruleId: string;
    ruleName: string;
    description: string;
    conditionHit: string;
  };
  telemetry: {
    ipSubnet?: string;
    asnName?: string;
    deviceFarmSuspect?: boolean;
    vpnOrProxyDetected?: boolean;
    crossEntityVelocity?: string;
  };
  communityNotes: string;
  recommendation: 'AUTO_BLOCK' | 'REQUIRE_BIOMETRICS' | 'DELAY_FUNDS' | 'NOTIFY_ANALYST';
  resolution?: {
    resolvedAt: string;
    resolvedByRole: string;
    actionTaken: string;
    notes?: string;
  };
}

export type DatabaseSyncStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONFIG_NEEDED' | 'SYNCING' | 'ERROR';

export interface AdminSession {
  isAuthenticated: boolean;
  email: string;
  name: string;
  role: 'SUPER_ADMIN';
  token: string;
  loginTime: string;
}

export interface PartnerSession {
  isAuthenticated: boolean;
  entityId: string;
  entityName: string;
  operatorEmail: string;
  operatorRole: UserRole;
  token: string;
  loginTime: string;
}

export type AppRoute =
  | 'landing'
  | 'admin-login'
  | 'admin-portal'
  | 'partner-login'
  | 'partner-portal';

