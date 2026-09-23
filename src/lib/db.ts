import {
  Tenant,
  FraudEntity,
  FraudEvent,
  AuditLog,
  IdentifierType,
  FraudTypology,
  DynamicRule,
  BlindWarRoom,
  WebhookConfig,
  GraphNode,
  GraphEdge,
  DeviceFingerprintHash,
} from './types';
import {
  INITIAL_TENANTS,
  SEED_ENTITIES,
  SEED_EVENTS,
  INITIAL_DYNAMIC_RULES,
  INITIAL_WAR_ROOMS,
  INITIAL_WEBHOOKS,
  INITIAL_GRAPH_NODES,
  INITIAL_GRAPH_EDGES,
  INITIAL_DEVICE_FINGERPRINTS,
} from './data-seed';

class InMemoryConsortiumDb {
  public tenants: Map<string, Tenant> = new Map();
  public fraudEntities: Map<string, FraudEntity> = new Map();
  public fraudEvents: FraudEvent[] = [];
  public auditLogs: AuditLog[] = [];
  public customApiKeys: Map<string, { tenantId: string; name: string; key: string; createdAt: string }> = new Map();
  public rules: DynamicRule[] = [];
  public warRooms: BlindWarRoom[] = [];
  public webhooks: WebhookConfig[] = [];
  public graphNodes: GraphNode[] = [];
  public graphEdges: GraphEdge[] = [];
  public deviceFingerprints: DeviceFingerprintHash[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    // Inicializar Tenants
    INITIAL_TENANTS.forEach(t => this.tenants.set(t.id, { ...t }));

    // Inicializar Entidades de Fraude
    SEED_ENTITIES.forEach(e => this.fraudEntities.set(e.blindHash, { ...e }));

    // Inicializar Eventos
    this.fraudEvents = [...SEED_EVENTS];

    // Inicializar Reglas
    this.rules = [...INITIAL_DYNAMIC_RULES];

    // Inicializar War Rooms
    this.warRooms = JSON.parse(JSON.stringify(INITIAL_WAR_ROOMS));

    // Inicializar Webhooks
    this.webhooks = [...INITIAL_WEBHOOKS];

    // Inicializar Grafos y Fingerprints
    this.graphNodes = [...INITIAL_GRAPH_NODES];
    this.graphEdges = [...INITIAL_GRAPH_EDGES];
    this.deviceFingerprints = [...INITIAL_DEVICE_FINGERPRINTS];

    // Inicializar logs de auditoría representativos
    const now = Date.now();
    const mockEndpoints = [
      '/api/v1/risk/evaluate',
      '/api/v1/risk/evaluate',
      '/api/v1/fraud/report',
      '/api/v1/risk/evaluate',
    ];
    for (let i = 0; i < 30; i++) {
      const tenant = INITIAL_TENANTS[i % INITIAL_TENANTS.length];
      const endpoint = mockEndpoints[i % mockEndpoints.length];
      this.auditLogs.unshift({
        id: `aud-${i + 1000}`,
        tenantId: tenant.id,
        tenantName: tenant.name,
        endpoint,
        identifierType: (i % 2 === 0 ? 'EMAIL' : 'DNI') as IdentifierType,
        blindHashPreview: `a8f5c3...${(i * 37).toString(16).slice(-4)}`,
        latencyMs: Math.floor(Math.random() * 16) + 4, // 4ms a 20ms
        statusCode: 200,
        ipAddress: `190.210.${10 + (i % 50)}.${1 + (i % 200)}`,
        timestamp: new Date(now - i * 180000).toISOString(),
        actionType: (i % 5 === 0 ? 'RULE_MODIFIED' : 'API_CALL'),
      });
    }
  }

  // --- Tenants & Quarantine ---
  async getTenantByApiKey(apiKey: string): Promise<Tenant | null> {
    for (const tenant of this.tenants.values()) {
      if (tenant.apiKey === apiKey) return tenant;
    }
    for (const custom of this.customApiKeys.values()) {
      if (custom.key === apiKey) {
        return this.tenants.get(custom.tenantId) || null;
      }
    }
    return null;
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) || null;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return Array.from(this.tenants.values());
  }

  async setTenantQuarantine(tenantId: string, inQuarantine: boolean): Promise<Tenant | null> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return null;
    tenant.inQuarantine = inQuarantine;
    if (inQuarantine) {
      tenant.trustScore = Math.max(50, tenant.trustScore - 20);
    } else {
      tenant.trustScore = Math.min(99, tenant.trustScore + 10);
    }
    this.tenants.set(tenantId, tenant);

    await this.logAudit({
      tenantId: tenant.id,
      tenantName: tenant.name,
      endpoint: '/admin/quarantine',
      latencyMs: 3,
      statusCode: 200,
      ipAddress: '127.0.0.1 (SuperAdmin IP Fija)',
      actionType: 'QUARANTINE_TOGGLED',
    });

    return { ...tenant };
  }

  // --- Fraud Entities ---
  async getFraudEntity(blindHash: string): Promise<FraudEntity | null> {
    const entity = this.fraudEntities.get(blindHash);
    return entity ? { ...entity } : null;
  }

  async upsertFraudReport(params: {
    blindHash: string;
    entityType: IdentifierType;
    tenantId: string;
    tenantName: string;
    reason: FraudTypology;
    severity: number;
    incidentDate?: string;
    nonPiiNotes?: string;
  }): Promise<{ entity: FraudEntity; event: FraudEvent }> {
    const { blindHash, entityType, tenantId, tenantName, reason, severity, incidentDate, nonPiiNotes } = params;

    const nowIso = new Date().toISOString();
    const event: FraudEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      blindHash,
      tenantId,
      tenantName,
      reason,
      severity,
      incidentDate: incidentDate || nowIso,
      nonPiiNotes,
      createdAt: nowIso,
    };
    this.fraudEvents.unshift(event);

    let entity = this.fraudEntities.get(blindHash);
    if (!entity) {
      const initialScore = Math.min(100, 35 + severity * 12);
      entity = {
        blindHash,
        entityType,
        riskScore: initialScore,
        reportCount: 1,
        distinctTenantsCount: 1,
        reportingTenantIds: [tenantId],
        primaryReason: reason,
        severity,
        lastReportedAt: nowIso,
        rehabilitated: false,
        createdAt: nowIso,
        updatedAt: nowIso,
        attemptsLast24h: 1,
      };
    } else {
      const hasTenantReported = entity.reportingTenantIds.includes(tenantId);
      const newReportingTenantIds = hasTenantReported
        ? entity.reportingTenantIds
        : [...entity.reportingTenantIds, tenantId];

      const distinctCount = newReportingTenantIds.length;
      const newReportCount = entity.reportCount + 1;
      const maxSeverity = Math.max(entity.severity, severity);
      const calculatedScore = Math.min(100, Math.round(distinctCount * 25 + newReportCount * 6 + maxSeverity * 10));

      entity = {
        ...entity,
        riskScore: calculatedScore,
        reportCount: newReportCount,
        distinctTenantsCount: distinctCount,
        reportingTenantIds: newReportingTenantIds,
        severity: maxSeverity,
        primaryReason: reason,
        lastReportedAt: nowIso,
        rehabilitated: false,
        updatedAt: nowIso,
        attemptsLast24h: (entity.attemptsLast24h || 1) + 1,
      };
    }

    this.fraudEntities.set(blindHash, entity);
    return { entity, event };
  }

  // --- Rehabilitation ---
  async rehabilitateEntity(blindHash: string, reason: string): Promise<FraudEntity | null> {
    const entity = this.fraudEntities.get(blindHash);
    if (!entity) return null;

    const nowIso = new Date().toISOString();
    const updated: FraudEntity = {
      ...entity,
      riskScore: 10,
      rehabilitated: true,
      rehabilitatedAt: nowIso,
      rehabilitationReason: reason,
      updatedAt: nowIso,
    };

    this.fraudEntities.set(blindHash, updated);
    return updated;
  }

  // --- Audit Logs ---
  async logAudit(logData: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const entry: AuditLog = {
      ...logData,
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 500) {
      this.auditLogs.length = 500;
    }
    return entry;
  }

  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    return this.auditLogs.slice(0, limit);
  }

  // --- Dynamic Rule Engine ---
  getDynamicRules(): DynamicRule[] {
    return [...this.rules];
  }

  toggleDynamicRule(ruleId: string): boolean {
    const r = this.rules.find(rule => rule.id === ruleId);
    if (!r) return false;
    r.enabled = !r.enabled;
    return true;
  }

  addDynamicRule(rule: Omit<DynamicRule, 'id'>): DynamicRule {
    const newRule: DynamicRule = {
      ...rule,
      id: `rule-${Date.now()}`,
    };
    this.rules.unshift(newRule);
    return newRule;
  }

  // --- Blind War Rooms ---
  getWarRooms(): BlindWarRoom[] {
    return this.warRooms;
  }

  addWarRoomMessage(roomId: string, senderAlias: string, text: string): boolean {
    const room = this.warRooms.find(r => r.id === roomId);
    if (!room) return false;
    room.messages.push({
      id: `msg-${Date.now()}`,
      senderAlias,
      text,
      timestamp: 'Ahora',
    });
    return true;
  }

  // --- Webhooks Center ---
  getWebhooks(tenantId?: string): WebhookConfig[] {
    if (!tenantId) return this.webhooks;
    return this.webhooks.filter(w => w.tenantId === tenantId);
  }

  createWebhook(webhook: Omit<WebhookConfig, 'id' | 'successRate'>): WebhookConfig {
    const newWebhook: WebhookConfig = {
      ...webhook,
      id: `wh-${Date.now()}`,
      successRate: 100.0,
    };
    this.webhooks.unshift(newWebhook);
    return newWebhook;
  }

  toggleWebhook(id: string): boolean {
    const wh = this.webhooks.find(w => w.id === id);
    if (!wh) return false;
    wh.status = wh.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    return true;
  }

  // --- Graph & Device Analytics ---
  getGraphData(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: this.graphNodes,
      edges: this.graphEdges,
    };
  }

  getDeviceFingerprints(): DeviceFingerprintHash[] {
    return this.deviceFingerprints;
  }

  // --- SuperAdmin Infrastructure Health ---
  getSuperAdminInfrastructure() {
    return {
      p95LatencyMs: 9,
      p99LatencyMs: 14,
      redisHitRate: '99.4%',
      redisTotalKeys: 18450,
      supabaseDbPool: {
        activeConnections: 12,
        maxConnections: 100,
        queryAvgMs: 2.1,
        status: 'HEALTHY',
      },
      quarantinedTenantsCount: Array.from(this.tenants.values()).filter(t => t.inQuarantine).length,
      edgeNodes: [
        { name: 'Buenos Aires Edge 1 (Retiro Datacenter)', status: 'ONLINE', ping: '2ms', load: '18%' },
        { name: 'Buenos Aires Edge 2 (Pilar Datacenter)', status: 'ONLINE', ping: '4ms', load: '22%' },
        { name: 'Córdoba Central Edge', status: 'ONLINE', ping: '11ms', load: '14%' },
      ],
    };
  }

  // --- Analytics & KPIs ---
  async getAnalytics() {
    const totalEntities = this.fraudEntities.size;
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;
    let rehabilitatedCount = 0;

    for (const entity of this.fraudEntities.values()) {
      if (entity.rehabilitated) {
        rehabilitatedCount++;
      } else if (entity.riskScore >= 75) {
        highRiskCount++;
      } else if (entity.riskScore >= 40) {
        mediumRiskCount++;
      } else {
        lowRiskCount++;
      }
    }

    const typologyCounts: Record<string, number> = {};
    for (const event of this.fraudEvents) {
      typologyCounts[event.reason] = (typologyCounts[event.reason] || 0) + 1;
    }

    return {
      totalEntities,
      totalEvents: this.fraudEvents.length,
      activeTenantsCount: this.tenants.size,
      totalQueriesProcessed: 142850 + this.auditLogs.length,
      fraudAvoidedMonth: 1248 + highRiskCount,
      estimatedMoneySavedARS: 842500000 + highRiskCount * 1450000,
      estimatedMoneySavedUSD: 720000 + Math.round((highRiskCount * 1450000) / 1200),
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      rehabilitatedCount,
      typologyCounts,
      p99LatencyMs: 14,
    };
  }

  // --- API Key Management ---
  async generateApiKey(tenantId: string, keyName: string): Promise<{ id: string; name: string; key: string; createdAt: string }> {
    const randomHex = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const key = `antf_live_${tenantId.slice(0, 4)}_${randomHex}`;
    const id = `key-${Date.now()}`;
    const item = {
      tenantId,
      name: keyName,
      key,
      createdAt: new Date().toISOString(),
    };
    this.customApiKeys.set(id, item);
    return { id, ...item };
  }

  async getApiKeysForTenant(tenantId: string) {
    const tenant = this.tenants.get(tenantId);
    const result = [];
    if (tenant) {
      result.push({
        id: 'primary-key',
        tenantId,
        name: 'Clave Primaria de Producción',
        key: tenant.apiKey,
        createdAt: tenant.joinedAt,
        isPrimary: true,
      });
    }
    for (const [id, custom] of this.customApiKeys.entries()) {
      if (custom.tenantId === tenantId) {
        result.push({
          id,
          ...custom,
          isPrimary: false,
        });
      }
    }
    return result;
  }

  async revokeApiKey(keyId: string): Promise<boolean> {
    if (this.customApiKeys.has(keyId)) {
      this.customApiKeys.delete(keyId);
      return true;
    }
    return false;
  }
}

const globalForDb = global as unknown as { consortiumDb: InMemoryConsortiumDb };
export const db = globalForDb.consortiumDb || new InMemoryConsortiumDb();
if (process.env.NODE_ENV !== 'production') globalForDb.consortiumDb = db;
