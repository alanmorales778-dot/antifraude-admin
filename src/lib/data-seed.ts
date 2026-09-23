import {
  Tenant,
  FraudEntity,
  FraudEvent,
  DynamicRule,
  BlindWarRoom,
  WebhookConfig,
  GraphNode,
  GraphEdge,
  DeviceFingerprintHash,
} from './types';
import { computeBlindHashSync } from './crypto';

export const INITIAL_TENANTS: Tenant[] = [
  {
    id: 'tenant-mp',
    name: 'Mercado Pago Argentina',
    code: 'MP_ARG',
    apiKey: 'antf_live_mp_9812739182371239',
    apiKeyHash: 'hash_mp_9812739182371239',
    subscriptionTier: 'ENTERPRISE',
    trustScore: 99,
    status: 'ACTIVE',
    inQuarantine: false,
    noiseRate: 1.2,
    joinedAt: '2025-01-15T10:00:00Z',
    logo: '💳',
  },
  {
    id: 'tenant-uala',
    name: 'Ualá (Bancop)',
    code: 'UALA_ARG',
    apiKey: 'antf_live_uala_8723618273618273',
    apiKeyHash: 'hash_uala_8723618273618273',
    subscriptionTier: 'ENTERPRISE',
    trustScore: 98,
    status: 'ACTIVE',
    inQuarantine: false,
    noiseRate: 1.8,
    joinedAt: '2025-01-20T10:00:00Z',
    logo: '🦄',
  },
  {
    id: 'tenant-galicia',
    name: 'Banco Galicia',
    code: 'GALICIA',
    apiKey: 'antf_live_gal_7625341827364512',
    apiKeyHash: 'hash_gal_7625341827364512',
    subscriptionTier: 'ENTERPRISE',
    trustScore: 99,
    status: 'ACTIVE',
    inQuarantine: false,
    noiseRate: 0.9,
    joinedAt: '2025-02-01T10:00:00Z',
    logo: '🏦',
  },
  {
    id: 'tenant-santander',
    name: 'Banco Santander Argentina',
    code: 'SANTANDER',
    apiKey: 'antf_live_san_6514238719283746',
    apiKeyHash: 'hash_san_6514238719283746',
    subscriptionTier: 'ENTERPRISE',
    trustScore: 99,
    status: 'ACTIVE',
    inQuarantine: false,
    noiseRate: 1.1,
    joinedAt: '2025-02-10T10:00:00Z',
    logo: '🔴',
  },
  {
    id: 'tenant-lemon',
    name: 'Lemon Cash',
    code: 'LEMON',
    apiKey: 'antf_live_lem_5423187291823746',
    apiKeyHash: 'hash_lem_5423187291823746',
    subscriptionTier: 'GROWTH',
    trustScore: 96,
    status: 'ACTIVE',
    inQuarantine: false,
    noiseRate: 2.4,
    joinedAt: '2025-03-01T10:00:00Z',
    logo: '🍋',
  },
  {
    id: 'tenant-belo',
    name: 'Belo App',
    code: 'BELO',
    apiKey: 'antf_live_bel_4312879182736451',
    apiKeyHash: 'hash_bel_4312879182736451',
    subscriptionTier: 'GROWTH',
    trustScore: 95,
    status: 'ACTIVE',
    inQuarantine: false,
    noiseRate: 2.1,
    joinedAt: '2025-03-15T10:00:00Z',
    logo: '⚡',
  },
  {
    id: 'tenant-naranja',
    name: 'Naranja X',
    code: 'NARANJA_X',
    apiKey: 'antf_live_nx_3291827364518273',
    apiKeyHash: 'hash_nx_3291827364518273',
    subscriptionTier: 'ENTERPRISE',
    trustScore: 97,
    status: 'ACTIVE',
    inQuarantine: false,
    noiseRate: 1.6,
    joinedAt: '2025-03-20T10:00:00Z',
    logo: '🍊',
  },
  {
    id: 'tenant-personalpay',
    name: 'Personal Pay',
    code: 'PERSONAL_PAY',
    apiKey: 'antf_live_pp_2182736451928374',
    apiKeyHash: 'hash_pp_2182736451928374',
    subscriptionTier: 'GROWTH',
    trustScore: 94,
    status: 'ACTIVE',
    inQuarantine: false,
    noiseRate: 3.2,
    joinedAt: '2025-04-01T10:00:00Z',
    logo: '📱',
  },
  {
    id: 'tenant-brubank',
    name: 'Brubank',
    code: 'BRUBANK',
    apiKey: 'antf_live_bru_1928374651928374',
    apiKeyHash: 'hash_bru_1928374651928374',
    subscriptionTier: 'ENTERPRISE',
    trustScore: 98,
    status: 'ACTIVE',
    inQuarantine: false,
    noiseRate: 1.4,
    joinedAt: '2025-04-10T10:00:00Z',
    logo: '🟣',
  },
  {
    id: 'tenant-modo',
    name: 'MODO (Play Digital)',
    code: 'MODO',
    apiKey: 'antf_live_mod_0192837465192837',
    apiKeyHash: 'hash_mod_0192837465192837',
    subscriptionTier: 'ENTERPRISE',
    trustScore: 99,
    status: 'ACTIVE',
    inQuarantine: false,
    noiseRate: 0.8,
    joinedAt: '2025-05-01T10:00:00Z',
    logo: '🟩',
  },
];

// Helper para crear entidades precomputadas
function createSeedEntity(
  type: 'EMAIL' | 'DNI' | 'PHONE',
  rawValue: string,
  reason: any,
  severity: number,
  reportingTenants: string[],
  rehabilitated: boolean = false,
  rehabReason?: string,
  attempts24h: number = 3
): { entity: FraudEntity; events: FraudEvent[] } {
  const { blindHash } = computeBlindHashSync(type, rawValue);
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

  let score = Math.min(100, reportingTenants.length * 24 + severity * 12);
  if (rehabilitated) score = 12;

  const entity: FraudEntity = {
    blindHash,
    entityType: type,
    riskScore: score,
    reportCount: reportingTenants.length + 1,
    distinctTenantsCount: reportingTenants.length,
    reportingTenantIds: reportingTenants,
    primaryReason: reason,
    severity,
    lastReportedAt: daysAgo(1),
    rehabilitated,
    rehabilitatedAt: rehabilitated ? daysAgo(0) : undefined,
    rehabilitationReason: rehabReason,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(1),
    attemptsLast24h: attempts24h,
  };

  const events: FraudEvent[] = reportingTenants.map((tId, idx) => {
    const tenant = INITIAL_TENANTS.find(t => t.id === tId);
    return {
      id: `evt-${blindHash.slice(0, 8)}-${idx}`,
      blindHash,
      tenantId: tId,
      tenantName: tenant ? tenant.name : 'Entidad Confidencial',
      reason,
      severity,
      incidentDate: daysAgo(idx * 3 + 1),
      nonPiiNotes: `Incidente reportado formalmente. Clasificación automatizada de riesgo operacional.`,
      createdAt: daysAgo(idx * 3 + 1),
    };
  });

  return { entity, events };
}

const seed1 = createSeedEntity('EMAIL', 'estafador.red@gmail.com', 'MULA_DE_DINERO', 5, [
  'tenant-mp',
  'tenant-uala',
  'tenant-galicia',
  'tenant-santander',
  'tenant-lemon',
], false, undefined, 8);

const seed2 = createSeedEntity('DNI', '20-41882991-3', 'IDENTIDAD_SINTETICA', 4, [
  'tenant-naranja',
  'tenant-personalpay',
  'tenant-brubank',
], false, undefined, 5);

const seed3 = createSeedEntity('PHONE', '+54 9 11 4055-8891', 'PHISHING', 3, [
  'tenant-mp',
  'tenant-modo',
], false, undefined, 3);

const seed4 = createSeedEntity('EMAIL', 'compras.sospechosas@hotmail.com', 'CONTRACARGO_REITERADO', 3, [
  'tenant-uala',
  'tenant-lemon',
], false, undefined, 2);

const seed5 = createSeedEntity(
  'EMAIL',
  'juan.perez.reclamado@gmail.com',
  'ROBO_DE_CUENTA',
  2,
  ['tenant-mp'],
  true,
  'Titular legítimo acreditó titularidad mediante validación biométrica RENAPER. Falso positivo cerrado.',
  0
);

export const SEED_ENTITIES: FraudEntity[] = [
  seed1.entity,
  seed2.entity,
  seed3.entity,
  seed4.entity,
  seed5.entity,
];

export const SEED_EVENTS: FraudEvent[] = [
  ...seed1.events,
  ...seed2.events,
  ...seed3.events,
  ...seed4.events,
  ...seed5.events,
];

export const SAMPLE_TEST_CASES = [
  {
    label: '🚨 Alerta Crítica (5 Bancos - Mula)',
    type: 'EMAIL',
    value: 'estafador.red@gmail.com',
    expectedScore: 96,
    expectedLevel: 'ALTO',
  },
  {
    label: '⚠️ DNI Sintético (3 Entidades)',
    type: 'DNI',
    value: '20-41882991-3',
    expectedScore: 88,
    expectedLevel: 'ALTO',
  },
  {
    label: '📱 Teléfono Phishing (2 Entidades)',
    type: 'PHONE',
    value: '+54 9 11 4055-8891',
    expectedScore: 68,
    expectedLevel: 'MEDIO',
  },
  {
    label: '💳 Contracargos Frecuentes',
    type: 'EMAIL',
    value: 'compras.sospechosas@hotmail.com',
    expectedScore: 58,
    expectedLevel: 'MEDIO',
  },
  {
    label: '✅ Falso Positivo Rehabilitado',
    type: 'EMAIL',
    value: 'juan.perez.reclamado@gmail.com',
    expectedScore: 12,
    expectedLevel: 'BAJO',
  },
  {
    label: '🟢 Usuario Limpio (Sin Reportes)',
    type: 'EMAIL',
    value: 'usuario.verificado@empresa.com.ar',
    expectedScore: 0,
    expectedLevel: 'BAJO',
  },
];

// Reglas Dinámicas Precargadas para el Rule Engine
export const INITIAL_DYNAMIC_RULES: DynamicRule[] = [
  {
    id: 'rule-1',
    name: 'Bloqueo Inmediato por Cuenta Mula Confirmada',
    conditionDescription: 'Si Tipo = MULA_DE_DINERO o TRIANGULACION_FONDOS con severidad >= 4',
    actionDescription: 'Aplicar Bloqueo Preventivo Automático e Intercepción Kill-Switch (<15ms)',
    enabled: true,
    backtestAccuracy: 99.4,
    backtestFpRate: 0.6,
    ruleJson: {
      eventType: 'MULA_DE_DINERO',
      action: 'AUTO_BLOCK',
    },
  },
  {
    id: 'rule-2',
    name: 'Desafío Biométrico Multientidad',
    conditionDescription: 'Si Risk Score > 80 AND Entidades que reportaron >= 2',
    actionDescription: 'Exigir Prueba de Vida y Validación Facial RENAPER obligatoria',
    enabled: true,
    backtestAccuracy: 96.8,
    backtestFpRate: 1.8,
    ruleJson: {
      minScore: 80,
      minTenants: 2,
      action: 'REQUIRE_BIOMETRICS',
    },
  },
  {
    id: 'rule-3',
    name: 'Auto-pausa Preventiva de Fondos (Kill-Switch 45s)',
    conditionDescription: 'Si Risk Score >= 90 AND Frecuencia 24h > 5 intentos',
    actionDescription: 'Retener salida de fondos por 45 segundos para chequeo de botnet',
    enabled: true,
    backtestAccuracy: 98.1,
    backtestFpRate: 0.9,
    ruleJson: {
      minScore: 90,
      action: 'DELAY_FUNDS',
    },
  },
];

// Salas de Crisis Ciegas (Blind War Rooms)
export const INITIAL_WAR_ROOMS: BlindWarRoom[] = [
  {
    id: 'room-rio-plata',
    title: 'Operación Río de la Plata: Ataque Coordinado de Cuentas Mula',
    attackVector: 'Triangulación automatizada mediante API botnet con CVU de apertura reciente',
    affectedCount: 5,
    severity: 'CRITICAL',
    status: 'ACTIVE_CRISIS',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    messages: [
      {
        id: 'msg-1',
        senderAlias: 'Consorcio Sentinel Bot',
        text: 'ALERTA DE RED: Se ha detectado una tasa anómala de 48 transferencias cruzadas en 12 minutos involucrando 4 entidades participantes.',
        timestamp: 'Hace 45 min',
        isTelemetryAlert: true,
      },
      {
        id: 'msg-2',
        senderAlias: 'Analista Banco Galicia',
        text: 'Detectamos 14 aperturas rápidas con IPs de VPN de Países Bajos y números de trámite DNI correlativos. Procedimos al bloqueo cautelar.',
        timestamp: 'Hace 38 min',
      },
      {
        id: 'msg-3',
        senderAlias: 'Analista Mercado Pago',
        text: 'Confirmamos coincidencia de 9 hashes ciegos en transferencias entrantes con destino inmediato a exchange cripto. Bloqueo aplicado.',
        timestamp: 'Hace 29 min',
      },
      {
        id: 'msg-4',
        senderAlias: 'Analista Ualá',
        text: 'Agregamos regla dinámica preventiva. Kill-Switch activado para cuentas con menos de 48h de vida.',
        timestamp: 'Hace 14 min',
      },
    ],
  },
  {
    id: 'room-phishing-bancario',
    title: 'Campaña de Smishing Masivo suplantando Billeteras Virtuales',
    attackVector: 'Envío de SMS con dominios falsos solicitando verificación de clave token',
    affectedCount: 3,
    severity: 'HIGH',
    status: 'CONTAINED',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    messages: [
      {
        id: 'msg-p1',
        senderAlias: 'Analista Santander',
        text: 'Identificamos 120 denuncias de clientes que recibieron SMS con enlaces .ar.app-segura.com. Hashes de teléfono ingresados al consorcio.',
        timestamp: 'Ayer 18:20',
      },
      {
        id: 'msg-p2',
        senderAlias: 'Consorcio Sentinel Bot',
        text: 'Los 120 hashes telefónicos fueron clasificados con score 70 (MEDIO - REQUERIR 2FA) en toda la red comunitaria.',
        timestamp: 'Ayer 18:25',
        isTelemetryAlert: true,
      },
    ],
  },
];

// Webhooks de prueba
export const INITIAL_WEBHOOKS: WebhookConfig[] = [
  {
    id: 'wh-1',
    tenantId: 'tenant-mp',
    url: 'https://api.mercadopago.com/v1/fraud-events/webhook',
    events: ['SCORE_CRITICAL', 'MULTI_TENANT_MATCH', 'FALSE_POSITIVE_REHABILITATED'],
    secretKey: 'whsec_mp_live_8371928374619283',
    status: 'ACTIVE',
    lastTriggeredAt: new Date(Date.now() - 1800000).toISOString(),
    successRate: 99.8,
  },
  {
    id: 'wh-2',
    tenantId: 'tenant-uala',
    url: 'https://security.uala.com.ar/webhooks/antifraude-consorcio',
    events: ['SCORE_CRITICAL', 'KILL_SWITCH_TRIGGERED'],
    secretKey: 'whsec_uala_live_7261524381927364',
    status: 'ACTIVE',
    lastTriggeredAt: new Date(Date.now() - 4200000).toISOString(),
    successRate: 100.0,
  },
];

// Datos para Graph Analytics (Visualizador de Grafos de Fraude)
export const INITIAL_GRAPH_NODES: GraphNode[] = [
  { id: 'node-hash-1', label: 'Hash: a8f5c3... (DNI 38.912.441)', type: 'IDENTIFIER', riskScore: 96 },
  { id: 'node-mule-1', label: 'Cuenta Mula #1 (CVU Galicia)', type: 'MULE_ACCOUNT', riskScore: 92 },
  { id: 'node-mule-2', label: 'Cuenta Mula #2 (CVU MP)', type: 'MULE_ACCOUNT', riskScore: 94 },
  { id: 'node-mule-3', label: 'Cuenta Mula #3 (CVU Lemon)', type: 'MULE_ACCOUNT', riskScore: 89 },
  { id: 'node-dev-1', label: 'Device Farm Fingerprint #771', type: 'DEVICE', riskScore: 98 },
  { id: 'node-ip-1', label: 'Subred Tor / VPN Node (190.210.45.0/24)', type: 'IP', riskScore: 85 },
];

export const INITIAL_GRAPH_EDGES: GraphEdge[] = [
  { id: 'e1', source: 'node-hash-1', target: 'node-mule-1', label: 'Transferencia Giros' },
  { id: 'e2', source: 'node-hash-1', target: 'node-mule-2', label: 'Cuenta Receptora' },
  { id: 'e3', source: 'node-mule-2', target: 'node-mule-3', label: 'Triangulación Cripto' },
  { id: 'e4', source: 'node-hash-1', target: 'node-dev-1', label: 'Mismo Emulador' },
  { id: 'e5', source: 'node-mule-1', target: 'node-dev-1', label: 'Hardware Hash' },
  { id: 'e6', source: 'node-dev-1', target: 'node-ip-1', label: 'Conexión VPN' },
];

export const INITIAL_DEVICE_FINGERPRINTS: DeviceFingerprintHash[] = [
  {
    hardwareHash: 'dev_fingerprint_8f9c12b7a9e0441d',
    ipSubnet: '186.138.21.0/24 (Telecom Fibertel - Proxy Residencial)',
    screenSpec: '1080x2400 @ 120Hz (Virtual Display)',
    gpuSignature: 'ANGLE (Google, Vulkan 1.3.0 SwiftShader Device)',
    isDeviceFarmSuspect: true,
  },
  {
    hardwareHash: 'dev_fingerprint_3e1a78c90b4f6211',
    ipSubnet: '190.210.12.0/24 (Telecentro - Residencial Legítimo)',
    screenSpec: '390x844 @ 60Hz (Apple iPhone 14)',
    gpuSignature: 'Apple GPU (A15 Bionic)',
    isDeviceFarmSuspect: false,
  },
];
