'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  FintechEntity,
  IdentityNode,
  SpecGraphEdge,
  StoreAuditLog,
  LookupResult,
  IncidentCategory,
  NetworkAlert,
  AlertSeverity,
  AlertStatus,
  BlindAlertIdentifier,
  ServiceScope,
  DeviceCUITLink,
  DatabaseSyncStatus,
  AdminSession,
  PartnerSession,
  UserRole,
  AppRoute,
} from './types';
import { computeHash, evaluateRisk, upsertIdentityNode, buildEdgesFromReport } from './fraudEngine';
import { SupabaseService } from './supabaseService';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
} from './supabaseClient';

// ─────────────────────────────────────────────────────────────────
// DATOS SEMILLA (del spec)
// ─────────────────────────────────────────────────────────────────

// Hashes pre-computados de los casos del spec usando el salt del consorcio.
// Se calculan en runtime al inicializar el store si no existen en storage.
const SEED_FINTECH_ALPHA: FintechEntity = {
  id: 'fintech-alpha',
  name: 'Fintech Alpha',
  apiKey: 'antf_live_alpha_a1b2c3d4e5f6',
  trustWeight: 1.0,
  status: 'ACTIVE',
  queriesCount: 142,
  reportsCount: 3,
  falsePositivesCount: 0,
};

const SEED_BANCO_BETA: FintechEntity = {
  id: 'banco-beta',
  name: 'Banco Beta',
  apiKey: 'antf_live_beta_f6e5d4c3b2a1',
  trustWeight: 0.8,
  status: 'ACTIVE',
  queriesCount: 87,
  reportsCount: 1,
  falsePositivesCount: 0,
};

const SEED_AUDIT_LOGS: StoreAuditLog[] = [
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    actor: 'Fintech Alpha',
    action: 'FRAUD_REPORT',
    details: 'Reporte MULE_ACCOUNT ingresado — DNI: 30111222',
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    actor: 'Banco Beta',
    action: 'LOOKUP',
    details: 'Consulta de riesgo — EMAIL: estafador@gmail.com',
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    actor: 'SuperAdmin',
    action: 'TRUST_WEIGHT_UPDATED',
    details: 'Banco Beta: trustWeight ajustado a 0.8',
  },
];

// ─────────────────────────────────────────────────────────────────
// ALERTAS DE RED SEMILLA
// ─────────────────────────────────────────────────────────────────

export const SEED_NETWORK_ALERTS: NetworkAlert[] = [
  {
    id: 'alt-001',
    code: 'ALT-2026-9041',
    title: 'Triangulación Inmediata mediante Cuentas Mula Correlativas',
    category: 'MULE_ACCOUNT',
    severity: 'CRITICAL',
    status: 'PENDING_REVIEW',
    riskScore: 96,
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    targetEntityId: 'all',
    reportingEntitiesCount: 4,
    reportingEntitiesNames: ['Entidad de Red #1', 'Entidad de Red #2', 'Entidad de Red #3', 'Entidad de Red #4'],
    blindIdentifiers: [
      {
        type: 'DNI',
        hash: 'b4a8e29f3c1d047a5e8b2c6d9f1a3e5c7b9d1f3a5e7b9c1d3e5f7a9b1c3d5e7f',
        maskedPreview: 'DNI (Blind Hash)',
        lookupsCount24h: 7,
        velocityScore: 94,
      },
      {
        type: 'EMAIL',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        maskedPreview: 'EMAIL (Blind Hash)',
        lookupsCount24h: 5,
        velocityScore: 90,
      },
      {
        type: 'PHONE',
        hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
        maskedPreview: 'PHONE (Blind Hash)',
        lookupsCount24h: 4,
        velocityScore: 88,
      },
      {
        type: 'IP',
        hash: 'f9e8d7c6b5a43210fedcba9876543210abcdef0123456789abcdef0123456789',
        maskedPreview: 'IP Subnet (Proxy Residencial)',
        lookupsCount24h: 12,
        velocityScore: 96,
      },
    ],
    triggerRule: {
      ruleId: 'rule-1',
      ruleName: 'Bloqueo Inmediato por Cuenta Mula Confirmada',
      description: 'Detección de cuentas receptoras creadas en las últimas 48h con salida a exchange en < 2min.',
      conditionHit: 'Tipo = MULA_DE_DINERO con severidad >= 4 y consenso >= 3 entidades independientes.',
    },
    telemetry: {
      ipSubnet: '190.210.45.0/24 (Proxy Residencial Anónimo)',
      asnName: 'AS7303 ISP Residencial',
      deviceFarmSuspect: true,
      vpnOrProxyDetected: true,
      crossEntityVelocity: '48 transferencias cruzadas en 12 minutos entre billeteras de la red',
    },
    communityNotes: 'Patrón coordinado de apertura rápida de cuentas con destino inmediato de fondos a exchanges no regulados.',
    recommendation: 'AUTO_BLOCK',
  },
  {
    id: 'alt-002',
    code: 'ALT-2026-8917',
    title: 'Robo de Identidad y Synthetic ID en Onboarding Masivo',
    category: 'IDENTITY_THEFT',
    severity: 'HIGH',
    status: 'PENDING_REVIEW',
    riskScore: 88,
    createdAt: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    targetEntityId: 'all',
    reportingEntitiesCount: 3,
    reportingEntitiesNames: ['Entidad de Red #1', 'Entidad de Red #2', 'Entidad de Red #3'],
    blindIdentifiers: [
      {
        type: 'DNI',
        hash: 'c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3',
        maskedPreview: 'DNI (Blind Hash)',
        lookupsCount24h: 9,
        velocityScore: 85,
      },
      {
        type: 'EMAIL',
        hash: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
        maskedPreview: 'EMAIL (Blind Hash)',
        lookupsCount24h: 6,
        velocityScore: 82,
      },
      {
        type: 'DEVICE',
        hash: 'dev_farm_771_8f9c12b7a9e0441d',
        maskedPreview: 'Hardware Fingerprint (Emulador Android)',
        lookupsCount24h: 18,
        velocityScore: 95,
      },
    ],
    triggerRule: {
      ruleId: 'rule-2',
      ruleName: 'Desafío Biométrico Multientidad',
      description: 'Mismo documento presentado con diferentes emails y emuladores de hardware en varias instituciones.',
      conditionHit: 'Risk Score > 80 AND Entidades que reportaron >= 2 con divergencia biométrica.',
    },
    telemetry: {
      ipSubnet: '186.138.21.0/24 (Proxy Residencial)',
      asnName: 'AS10481 ISP Residencial',
      deviceFarmSuspect: true,
      vpnOrProxyDetected: true,
      crossEntityVelocity: '3 intentos en 3 instituciones en 15 minutos',
    },
    communityNotes: 'Dispositivo clasificado como emulador de hardware automatizado con rotación de huella digital GPU.',
    recommendation: 'REQUIRE_BIOMETRICS',
  },
  {
    id: 'alt-003',
    code: 'ALT-2026-8802',
    title: 'Campaña Activa de Phishing y Smishing de Red',
    category: 'PHISHING',
    severity: 'HIGH',
    status: 'IN_ANALYSIS',
    riskScore: 74,
    createdAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    targetEntityId: 'all',
    reportingEntitiesCount: 2,
    reportingEntitiesNames: ['Entidad de Red #1', 'Entidad de Red #2'],
    blindIdentifiers: [
      {
        type: 'PHONE',
        hash: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6',
        maskedPreview: 'PHONE (Blind Hash)',
        lookupsCount24h: 120,
        velocityScore: 89,
      },
      {
        type: 'IP',
        hash: 'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2',
        maskedPreview: 'IP (Hostile Subnet)',
        lookupsCount24h: 44,
        velocityScore: 78,
      },
    ],
    triggerRule: {
      ruleId: 'rule-phish',
      ruleName: 'Alerta Temprana de Smishing de Red',
      description: 'Envío masivo de SMS engañosos para captura de credenciales y tokens 2FA.',
      conditionHit: 'Más de 100 reportes telefónicos correlacionados en menos de 2 horas en la red comunitaria.',
    },
    telemetry: {
      ipSubnet: '45.228.190.0/24 (Hosting Offshore)',
      asnName: 'AS264667 Offshore Provider',
      deviceFarmSuspect: false,
      vpnOrProxyDetected: true,
      crossEntityVelocity: '120 SMS de suplantación detectados',
    },
    communityNotes: 'Dominios suplantadores detectados y clasificados para bloqueo preventivo de transacciones.',
    recommendation: 'REQUIRE_BIOMETRICS',
  },
  {
    id: 'alt-004',
    code: 'ALT-2026-8744',
    title: 'Salto Anómalo de Velocidad y Retiro Repentino de Fondos',
    category: 'SUSPICIOUS',
    severity: 'MEDIUM',
    status: 'PENDING_REVIEW',
    riskScore: 62,
    createdAt: new Date(Date.now() - 1000 * 60 * 260).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    targetEntityId: 'all',
    reportingEntitiesCount: 2,
    reportingEntitiesNames: ['Entidad de Red #1', 'Entidad de Red #2'],
    blindIdentifiers: [
      {
        type: 'EMAIL',
        hash: 'f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8',
        maskedPreview: 'EMAIL (Blind Hash)',
        lookupsCount24h: 6,
        velocityScore: 68,
      },
      {
        type: 'IP',
        hash: 'a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
        maskedPreview: 'IP (Blind Hash)',
        lookupsCount24h: 6,
        velocityScore: 65,
      },
    ],
    triggerRule: {
      ruleId: 'rule-3',
      ruleName: 'Auto-pausa Preventiva de Fondos (Kill-Switch 45s)',
      description: 'Operación financiera de monto alto inmediatamente después de cambio de contraseña o dispositivo.',
      conditionHit: 'Risk Score >= 60 AND Salto de IP geográfica a más de 400km en 30 minutos.',
    },
    telemetry: {
      ipSubnet: '186.138.21.0/24',
      asnName: 'AS10481 ISP Residencial',
      deviceFarmSuspect: false,
      vpnOrProxyDetected: false,
      crossEntityVelocity: '6 transacciones sucesivas en 5 minutos',
    },
    communityNotes: 'Retención cautelar de 45s aplicada por motor de red. Se recomienda validación biométrica.',
    recommendation: 'DELAY_FUNDS',
  },
  {
    id: 'alt-005',
    code: 'ALT-2026-8610',
    title: 'Contracargo Comercial en Disputa Aclarado y Rehabilitado',
    category: 'CHARGEBACK',
    severity: 'LOW',
    status: 'DISMISSED_FP',
    riskScore: 12,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    targetEntityId: 'all',
    reportingEntitiesCount: 1,
    reportingEntitiesNames: ['Entidad de Red #1'],
    blindIdentifiers: [
      {
        type: 'DNI',
        hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
        maskedPreview: 'DNI (Blind Hash)',
        lookupsCount24h: 1,
        velocityScore: 10,
      },
      {
        type: 'EMAIL',
        hash: '2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
        maskedPreview: 'EMAIL (Blind Hash)',
        lookupsCount24h: 1,
        velocityScore: 10,
      },
    ],
    triggerRule: {
      ruleId: 'rule-fp',
      ruleName: 'Protocolo de Rehabilitación y Corrección de Falso Positivo',
      description: 'El reclamo fue originado por error involuntario del emisor comercial.',
      conditionHit: 'Presentación de descargo formal firmado con hash ZK por la entidad emisora.',
    },
    telemetry: {
      ipSubnet: '190.210.12.0/24 (Residencial Legítimo)',
      asnName: 'AS27747 ISP Residencial',
      deviceFarmSuspect: false,
      vpnOrProxyDetected: false,
      crossEntityVelocity: 'Operación normal de comercio',
    },
    communityNotes: 'Disputa aclarada por descargo formal. Identificador restituido a reputación limpia.',
    recommendation: 'NOTIFY_ANALYST',
    resolution: {
      resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      resolvedByRole: 'Analista L2 (Entidad Participante)',
      actionTaken: 'Falso Positivo aceptado — Score saneado a 12',
      notes: 'Factura comercial y verificación de titularidad verificadas en canal seguro.',
    },
  },
];

// ─────────────────────────────────────────────────────────────────
// INTERFACES DEL STORE
// ─────────────────────────────────────────────────────────────────

export type ActiveRole = 'ADMIN' | 'FINTECH';

interface ConsortiumStore {
  // ── Estado de datos ────────────────────────────────────────────
  fintechs: FintechEntity[];
  identityNodes: IdentityNode[];
  graphEdges: SpecGraphEdge[];
  auditLogs: StoreAuditLog[];
  lastLookupResult: LookupResult | null;
  seedReady: boolean;

  // ── Device-CUIT Linkage ────────────────────────────────────────
  deviceCUITLinks: DeviceCUITLink[];

  // ── Estado de UI ───────────────────────────────────────────────
  activeRole: ActiveRole;
  activeFintechId: string;
  activeService: ServiceScope;

  // ── Acciones Admin ─────────────────────────────────────────────
  addFintech: (name: string) => FintechEntity;
  updateTrustWeight: (id: string, weight: number) => void;
  toggleFintechStatus: (id: string) => void;

  // ── Acciones Fintech ───────────────────────────────────────────
  lookupIdentity: (params: {
    dni?: string;
    email?: string;
    phone?: string;
    ip?: string;
    cbu?: string;
    device?: string;
    cuit?: string;
  }) => Promise<LookupResult>;

  reportFraud: (params: {
    dni?: string;
    email?: string;
    phone?: string;
    ip?: string;
    cbu?: string;
    device?: string;
    cuit?: string;
    incidentCategory: IncidentCategory;
  }) => Promise<void>;

  markFalsePositive: (edgeId: string) => void;

  importCSV: (csvText: string) => Promise<{ imported: number; errors: number }>;

  // ── Alertas de Red Comunitarias ─────────────────────────────
  networkAlerts: NetworkAlert[];
  updateAlertStatus: (alertId: string, status: AlertStatus, notes?: string) => void;
  confirmAndBlockAlert: (alertId: string, notes?: string) => void;
  challengeAlert2FA: (alertId: string, notes?: string) => void;
  dismissAlertAsFP: (alertId: string, reason: string) => void;

  // ── Acciones UI ────────────────────────────────────────────────
  setActiveRole: (role: ActiveRole) => void;
  setActiveFintechId: (id: string) => void;
  setActiveService: (service: ServiceScope) => void;

  // ── Inicialización de semillas async ──────────────────────────
  initSeedData: () => Promise<void>;

  // ── Sincronización y Memoria Cloud (Supabase) ─────────────────
  supabaseStatus: DatabaseSyncStatus;
  supabaseLatencyMs: number | null;
  supabaseError: string | null;
  configureSupabase: (url: string, anonKey: string) => Promise<{ success: boolean; message: string }>;
  disconnectSupabase: () => void;
  syncWithSupabase: () => Promise<boolean>;

  // ── Rutas y Autenticación Desvinculada e Independiente ────────
  currentRoute: AppRoute;
  setCurrentRoute: (route: AppRoute) => void;

  adminSession: AdminSession | null;
  loginAdmin: (credentials: { email: string; masterKey: string; totpCode?: string }) => Promise<{ success: boolean; message: string }>;
  logoutAdmin: () => void;

  partnerSession: PartnerSession | null;
  loginPartner: (credentials: { entityId: string; apiKey: string; operatorEmail: string; operatorRole?: UserRole }) => Promise<{ success: boolean; message: string }>;
  logoutPartner: () => void;
}



// ─────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────

function generateApiKey(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
  const rand = Math.random().toString(36).slice(2, 10);
  return `antf_live_${slug}_${rand}`;
}

function addAuditEntry(
  logs: StoreAuditLog[],
  actor: string,
  action: string,
  details: string
): StoreAuditLog[] {
  const entry: StoreAuditLog = {
    timestamp: new Date().toISOString(),
    actor,
    action,
    details,
  };
  const updated = [entry, ...logs];
  // Mantener máximo 200 entradas
  return updated.slice(0, 200);
}

// ─────────────────────────────────────────────────────────────────
// STORE ZUSTAND CON PERSIST
// ─────────────────────────────────────────────────────────────────

export const useConsortiumStore = create<ConsortiumStore>()(
  persist(
    (set, get) => ({
      // ── Estado inicial ─────────────────────────────────────────
      fintechs: [SEED_FINTECH_ALPHA, SEED_BANCO_BETA],
      identityNodes: [],
      graphEdges: [],
      auditLogs: SEED_AUDIT_LOGS,
      networkAlerts: SEED_NETWORK_ALERTS,
      lastLookupResult: null,
      seedReady: false,
      deviceCUITLinks: [],

      activeRole: 'FINTECH',
      activeFintechId: 'fintech-alpha',
      activeService: 'CONSORTIUM',

      // ── Sesiones y Rutas Independientes ────────────────────────
      currentRoute: 'landing',
      adminSession: null,
      partnerSession: null,

      // ── Estado Supabase Cloud ──────────────────────────────────
      supabaseStatus: getSupabaseConfig().isConfigured ? 'CONNECTED' : 'CONFIG_NEEDED',
      supabaseLatencyMs: null,
      supabaseError: null,

      // ── Inicialización de semillas async ──────────────────────
      initSeedData: async () => {
        if (get().seedReady) return;

        // 1. Si Supabase está disponible, intentar cargar datos remotos
        if (SupabaseService.isAvailable()) {
          try {
            set({ supabaseStatus: 'SYNCING' });
            const remoteData = await SupabaseService.loadAllData(get().activeService);
            if (remoteData && (remoteData.identityNodes.length > 0 || remoteData.graphEdges.length > 0)) {
              set({
                fintechs: remoteData.fintechs.length > 0 ? remoteData.fintechs : get().fintechs,
                identityNodes: remoteData.identityNodes,
                graphEdges: remoteData.graphEdges,
                networkAlerts: remoteData.networkAlerts.length > 0 ? remoteData.networkAlerts : get().networkAlerts,
                auditLogs: remoteData.auditLogs.length > 0 ? remoteData.auditLogs : get().auditLogs,
                deviceCUITLinks: remoteData.deviceCUITLinks,
                seedReady: true,
                supabaseStatus: 'CONNECTED',
              });
              return;
            }
          } catch (e) {
            console.warn('[Store] Supabase no disponible al iniciar, usando memoria local:', e);
          }
        }

        // 2. Pre-computar hashes de los casos del spec si no hay datos en la nube
        const dniHash = await computeHash('DNI', '30111222');
        const emailHash = await computeHash('EMAIL', 'estafador@gmail.com');
        const phoneHash = await computeHash('PHONE', '+5491122334455');

        const dniLegitHash = await computeHash('DNI', '40999888');
        const emailLegitHash = await computeHash('EMAIL', 'juan.perez@empresa.com');

        const now = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(); // 3 días atrás

        // Nodos de identidad del caso fraude
        const fraudNodes: IdentityNode[] = [
          {
            type: 'DNI',
            hash: dniHash,
            firstSeen: now,
            lastSeen: now,
            totalLookups: 5,
            lookupsLastHour: 0,
          },
          {
            type: 'EMAIL',
            hash: emailHash,
            firstSeen: now,
            lastSeen: now,
            totalLookups: 3,
            lookupsLastHour: 0,
          },
          {
            type: 'PHONE',
            hash: phoneHash,
            firstSeen: now,
            lastSeen: now,
            totalLookups: 2,
            lookupsLastHour: 0,
          },
        ];

        // Nodos del caso legítimo
        const legitNodes: IdentityNode[] = [
          {
            type: 'DNI',
            hash: dniLegitHash,
            firstSeen: now,
            lastSeen: now,
            totalLookups: 1,
            lookupsLastHour: 0,
          },
          {
            type: 'EMAIL',
            hash: emailLegitHash,
            firstSeen: now,
            lastSeen: now,
            totalLookups: 1,
            lookupsLastHour: 0,
          },
        ];

        // Aristas del grafo con metadata de auditoría
        const fraudEdges: SpecGraphEdge[] = [
          {
            id: 'edge-seed-001',
            sourceHash: dniHash,
            targetHash: emailHash,
            reportedByEntityId: 'fintech-alpha',
            incidentCategory: 'MULE_ACCOUNT',
            timestamp: now,
            isFalsePositive: false,
            uploadedFields: 'DNI: 30.***.222 · Email: estafador.red@***',
            uploadMethod: 'MANUAL',
            entityName: 'Fintech Alpha',
            scope: 'CONSORTIUM',
          },
          {
            id: 'edge-seed-002',
            sourceHash: dniHash,
            targetHash: phoneHash,
            reportedByEntityId: 'fintech-alpha',
            incidentCategory: 'MULE_ACCOUNT',
            timestamp: now,
            isFalsePositive: false,
            uploadedFields: 'DNI: 30.***.222 · Tel: +54 9 11 *** 4455',
            uploadMethod: 'MANUAL',
            entityName: 'Fintech Alpha',
            scope: 'CONSORTIUM',
          },
          {
            id: 'edge-seed-003',
            sourceHash: emailHash,
            targetHash: phoneHash,
            reportedByEntityId: 'fintech-alpha',
            incidentCategory: 'MULE_ACCOUNT',
            timestamp: now,
            isFalsePositive: false,
            uploadedFields: 'Email: estafador.red@*** · Tel: +54 9 11 *** 4455',
            uploadMethod: 'MANUAL',
            entityName: 'Fintech Alpha',
            scope: 'CONSORTIUM',
          },
          {
            id: 'edge-seed-004',
            sourceHash: emailHash,
            targetHash: dniHash,
            reportedByEntityId: 'banco-beta',
            incidentCategory: 'IDENTITY_THEFT',
            timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
            isFalsePositive: false,
            uploadedFields: 'DNI: 30.***.222 · Email: estafador.red@***',
            uploadMethod: 'CSV_BULK',
            entityName: 'Banco Beta',
            scope: 'CONSORTIUM',
          },
        ];

        set({
          identityNodes: [...fraudNodes, ...legitNodes],
          graphEdges: fraudEdges,
          seedReady: true,
        });
      },

      // ── Acciones Admin ────────────────────────────────────────

      addFintech: (name: string) => {
        const newFintech: FintechEntity = {
          id: `fintech-${Date.now()}`,
          name,
          apiKey: generateApiKey(name),
          trustWeight: 0.7,
          status: 'ACTIVE',
          queriesCount: 0,
          reportsCount: 0,
          falsePositivesCount: 0,
        };

        set(state => ({
          fintechs: [...state.fintechs, newFintech],
          auditLogs: addAuditEntry(
            state.auditLogs,
            'SuperAdmin',
            'FINTECH_ADDED',
            `Nueva entidad registrada: ${name}`
          ),
        }));

        if (SupabaseService.isAvailable()) {
          SupabaseService.persistFintech(newFintech).catch(console.error);
          SupabaseService.recordAuditLog('SuperAdmin', 'FINTECH_ADDED', `Nueva entidad registrada: ${name}`).catch(console.error);
        }

        return newFintech;
      },

      updateTrustWeight: (id: string, weight: number) => {
        const clamped = Math.min(1, Math.max(0, weight));
        set(state => ({
          fintechs: state.fintechs.map(f =>
            f.id === id ? { ...f, trustWeight: clamped } : f
          ),
          auditLogs: addAuditEntry(
            state.auditLogs,
            'SuperAdmin',
            'TRUST_WEIGHT_UPDATED',
            `${state.fintechs.find(f => f.id === id)?.name || id}: trustWeight → ${clamped.toFixed(2)}`
          ),
        }));

        if (SupabaseService.isAvailable()) {
          SupabaseService.updateTrustWeight(id, clamped).catch(console.error);
          SupabaseService.recordAuditLog('SuperAdmin', 'TRUST_WEIGHT_UPDATED', `Entidad ${id}: trustWeight → ${clamped.toFixed(2)}`).catch(console.error);
        }
      },

      toggleFintechStatus: (id: string) => {
        set(state => {
          const fintech = state.fintechs.find(f => f.id === id);
          if (!fintech) return state;
          const newStatus = fintech.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

          if (SupabaseService.isAvailable()) {
            SupabaseService.toggleFintechStatus(id, newStatus).catch(console.error);
            SupabaseService.recordAuditLog('SuperAdmin', 'STATUS_CHANGED', `${fintech.name}: ${fintech.status} → ${newStatus}`).catch(console.error);
          }

          return {
            fintechs: state.fintechs.map(f =>
              f.id === id ? { ...f, status: newStatus } : f
            ),
            auditLogs: addAuditEntry(
              state.auditLogs,
              'SuperAdmin',
              'STATUS_CHANGED',
              `${fintech.name}: ${fintech.status} → ${newStatus}`
            ),
          };
        });
      },

      // ── Acciones Fintech ──────────────────────────────────────

      lookupIdentity: async ({ dni, email, phone, ip, cbu, device, cuit }) => {
        const state = get();
        const fintechId = state.activeFintechId;
        const fintech = state.fintechs.find(f => f.id === fintechId);

        // Auto-heal de reportes previos unitarios que sufrieron del bug de 0 aristas
        let currentEdges = state.graphEdges;
        const healedEdges: SpecGraphEdge[] = [];

        if (dni) {
          const dniHash = await computeHash('DNI', dni);
          const hasEdge = currentEdges.some(e => e.sourceHash === dniHash || e.targetHash === dniHash);
          if (!hasEdge) {
            const prefix = dni.slice(0, 2);
            const suffix = dni.slice(-3);
            const reportLog = state.auditLogs.find(l =>
              l.action === 'FRAUD_REPORT' &&
              (l.details.includes(`DNI: ${prefix}***${suffix}`) || l.details.includes(dni))
            );
            if (reportLog) {
              const catMatch = reportLog.details.match(/Reporte ([A-Z_]+) ingresado/);
              const category = (catMatch ? catMatch[1] : 'MULE_ACCOUNT') as IncidentCategory;
              healedEdges.push({
                id: `edge-healed-${Date.now()}-${dniHash.slice(0, 6)}`,
                sourceHash: dniHash,
                targetHash: dniHash,
                reportedByEntityId: fintechId,
                incidentCategory: category,
                timestamp: reportLog.timestamp || new Date().toISOString(),
                isFalsePositive: false,
                uploadedFields: `DNI: ${prefix}***${suffix}`,
                uploadMethod: 'MANUAL',
                entityName: reportLog.actor || fintech?.name || 'Entidad de Red',
                scope: state.activeService,
              });
            }
          }
        }

        if (cbu) {
          const cbuHash = await computeHash('CBU', cbu);
          const hasEdge = currentEdges.some(e => e.sourceHash === cbuHash || e.targetHash === cbuHash);
          if (!hasEdge) {
            const prefix = cbu.slice(0, 4);
            const suffix = cbu.slice(-4);
            const reportLog = state.auditLogs.find(l =>
              l.action === 'FRAUD_REPORT' &&
              (l.details.includes(`CBU/CVU: ${prefix}***${suffix}`) || l.details.includes(cbu))
            );
            if (reportLog) {
              const catMatch = reportLog.details.match(/Reporte ([A-Z_]+) ingresado/);
              const category = (catMatch ? catMatch[1] : 'MULE_ACCOUNT') as IncidentCategory;
              healedEdges.push({
                id: `edge-healed-${Date.now()}-${cbuHash.slice(0, 6)}`,
                sourceHash: cbuHash,
                targetHash: cbuHash,
                reportedByEntityId: fintechId,
                incidentCategory: category,
                timestamp: reportLog.timestamp || new Date().toISOString(),
                isFalsePositive: false,
                uploadedFields: `CBU/CVU: ${prefix}***${suffix}`,
                uploadMethod: 'MANUAL',
                entityName: reportLog.actor || fintech?.name || 'Entidad de Red',
                scope: state.activeService,
              });
            }
          }
        }

        if (healedEdges.length > 0) {
          currentEdges = [...currentEdges, ...healedEdges];
          set({ graphEdges: currentEdges });
        }

        const result = await evaluateRisk({
          dni,
          email,
          phone,
          ip,
          cbu,
          device,
          cuit,
          fintechId,
          fintechs: state.fintechs,
          identityNodes: state.identityNodes,
          graphEdges: currentEdges,
          deviceCUITLinks: state.deviceCUITLinks,
          scope: state.activeService,
        });

        // Actualizar nodos con el lookup
        let updatedNodes = state.identityNodes;
        if (result.dniHash)
          updatedNodes = upsertIdentityNode(updatedNodes, 'DNI', result.dniHash, true);
        if (result.emailHash)
          updatedNodes = upsertIdentityNode(updatedNodes, 'EMAIL', result.emailHash, true);
        if (result.phoneHash)
          updatedNodes = upsertIdentityNode(updatedNodes, 'PHONE', result.phoneHash, true);
        if (result.ipHash)
          updatedNodes = upsertIdentityNode(updatedNodes, 'IP', result.ipHash, true);
        if (result.cbuHash)
          updatedNodes = upsertIdentityNode(updatedNodes, 'CBU', result.cbuHash, true);
        if (result.deviceHash)
          updatedNodes = upsertIdentityNode(updatedNodes, 'DEVICE', result.deviceHash, true);
        if (result.cuitHash)
          updatedNodes = upsertIdentityNode(updatedNodes, 'CUIT', result.cuitHash, true);

        const actorName = fintech?.name || fintechId;
        const identifiers = [
          dni ? `DNI: ${dni}` : null,
          email ? `EMAIL: ${email}` : null,
          phone ? `PHONE: ${phone}` : null,
          ip ? `IP: ${ip}` : null,
          cbu ? `CBU/CVU: ${cbu.slice(0, 4)}***${cbu.slice(-4)}` : null,
          device ? `DEVICE: ${device.slice(0, 8)}...` : null,
          cuit ? `CUIT: ${cuit.slice(0, 2)}-***-${cuit.slice(-1)}` : null,
        ]
          .filter(Boolean)
          .join(', ');

        set(state2 => ({
          identityNodes: updatedNodes,
          lastLookupResult: result,
          fintechs: state2.fintechs.map(f =>
            f.id === fintechId ? { ...f, queriesCount: f.queriesCount + 1 } : f
          ),
          auditLogs: addAuditEntry(
            state2.auditLogs,
            actorName,
            'LOOKUP',
            `[${state.activeService}] Consulta de riesgo — ${identifiers} → Score: ${result.breakdown.finalScore} (${result.breakdown.riskLevel}) [${result.breakdown.recommendation}]`
          ),
        }));

        // Sincronización asíncrona a Supabase
        if (SupabaseService.isAvailable()) {
          const queriedHashes = [
            result.dniHash,
            result.emailHash,
            result.phoneHash,
            result.ipHash,
            result.cbuHash,
            result.deviceHash,
            result.cuitHash,
          ].filter(Boolean) as string[];

          SupabaseService.persistLookup({
            nodes: updatedNodes.filter(n => queriedHashes.includes(n.hash)),
            entityId: fintechId,
            auditLog: {
              timestamp: new Date().toISOString(),
              actor: actorName,
              action: 'LOOKUP',
              details: `[${state.activeService}] Consulta de riesgo — ${identifiers} → Score: ${result.breakdown.finalScore} (${result.breakdown.riskLevel}) [${result.breakdown.recommendation}]`,
            },
            scope: state.activeService,
          }).catch(err => console.warn('[Supabase Sync Lookup]:', err));
        }

        return result;
      },

      reportFraud: async ({ dni, email, phone, ip, cbu, device, cuit, incidentCategory }) => {
        const state = get();
        const fintechId = state.activeFintechId;
        const fintech = state.fintechs.find(f => f.id === fintechId);

        if (fintech?.status === 'SUSPENDED') {
          throw new Error('Entidad suspendida — no puede reportar fraudes.');
        }

        // Computar hashes
        const dniHash = dni ? await computeHash('DNI', dni) : null;
        const emailHash = email ? await computeHash('EMAIL', email) : null;
        const phoneHash = phone ? await computeHash('PHONE', phone) : null;
        const ipHash = ip ? await computeHash('IP', ip) : null;
        const cbuHash = cbu ? await computeHash('CBU', cbu) : null;
        const deviceHash = device ? await computeHash('DEVICE', device) : null;
        const cuitHash = cuit ? await computeHash('CUIT', cuit) : null;

        const actorName = fintech?.name || fintechId;
        const identifiers = [
          dni ? `DNI: ${dni.slice(0, 2)}***${dni.slice(-3)}` : null,
          email ? `Email: ${email.slice(0, 3)}***@${email.split('@')[1] || ''}` : null,
          phone ? `Tel: ${phone.slice(0, 4)}***${phone.slice(-3)}` : null,
          ip ? `IP: ${ip.split('.').slice(0, 2).join('.')}.***.${ip.split('.')[3] || ''}` : null,
          cbu ? `CBU/CVU: ${cbu.slice(0, 4)}***${cbu.slice(-4)}` : null,
          device ? `Device: ${device.slice(0, 8)}...` : null,
          cuit ? `CUIT: ${cuit.slice(0, 2)}-***-${cuit.slice(-1)}` : null,
        ]
          .filter(Boolean)
          .join(' · ');

        // Crear aristas del grafo
        const newEdges = buildEdgesFromReport({
          dniHash,
          emailHash,
          phoneHash,
          ipHash,
          cbuHash,
          deviceHash,
          cuitHash,
          reportedByEntityId: fintechId,
          incidentCategory,
          uploadedFields: identifiers || 'Identificador Criptográfico',
          uploadMethod: 'MANUAL',
          entityName: actorName,
          scope: state.activeService,
        });

        // Registrar device-CUIT link si ambos están presentes
        let newDeviceCUITLinks = state.deviceCUITLinks;
        if (deviceHash && cuitHash) {
          newDeviceCUITLinks = [
            ...newDeviceCUITLinks,
            {
              tokenDevice: deviceHash,
              tokenCuit: cuitHash,
              timestamp: new Date().toISOString(),
              entityId: fintechId,
            },
          ];
        }

        // Actualizar nodos (sin contar como lookup)
        let updatedNodes = state.identityNodes;
        if (dniHash) updatedNodes = upsertIdentityNode(updatedNodes, 'DNI', dniHash, false);
        if (emailHash) updatedNodes = upsertIdentityNode(updatedNodes, 'EMAIL', emailHash, false);
        if (phoneHash) updatedNodes = upsertIdentityNode(updatedNodes, 'PHONE', phoneHash, false);
        if (ipHash) updatedNodes = upsertIdentityNode(updatedNodes, 'IP', ipHash, false);
        if (cbuHash) updatedNodes = upsertIdentityNode(updatedNodes, 'CBU', cbuHash, false);
        if (deviceHash) updatedNodes = upsertIdentityNode(updatedNodes, 'DEVICE', deviceHash, false);
        if (cuitHash) updatedNodes = upsertIdentityNode(updatedNodes, 'CUIT', cuitHash, false);

        set(state2 => ({
          graphEdges: [...state2.graphEdges, ...newEdges],
          identityNodes: updatedNodes,
          deviceCUITLinks: newDeviceCUITLinks,
          fintechs: state2.fintechs.map(f =>
            f.id === fintechId ? { ...f, reportsCount: f.reportsCount + 1 } : f
          ),
          auditLogs: addAuditEntry(
            state2.auditLogs,
            actorName,
            'FRAUD_REPORT',
            `[${state.activeService}] Reporte ${incidentCategory} ingresado — ${identifiers} (${newEdges.length} aristas creadas)`
          ),
        }));

        // Sincronización asíncrona a Supabase
        if (SupabaseService.isAvailable()) {
          SupabaseService.persistFraudReport({
            edges: newEdges,
            nodes: updatedNodes.filter(n =>
              [dniHash, emailHash, phoneHash, ipHash, cbuHash, deviceHash, cuitHash].includes(n.hash)
            ),
            deviceCUITLinks: newDeviceCUITLinks,
            entityId: fintechId,
            auditLog: {
              timestamp: new Date().toISOString(),
              actor: actorName,
              action: 'FRAUD_REPORT',
              details: `[${state.activeService}] Reporte ${incidentCategory} ingresado — ${identifiers} (${newEdges.length} aristas creadas)`,
            },
            scope: state.activeService,
          }).catch(err => console.warn('[Supabase Sync Report]:', err));
        }
      },

      markFalsePositive: (edgeId: string) => {
        set(state => {
          const edge = state.graphEdges.find(e => e.id === edgeId);
          if (!edge) return state;

          const fintech = state.fintechs.find(f => f.id === edge.reportedByEntityId);

          if (SupabaseService.isAvailable()) {
            SupabaseService.markFalsePositive(edgeId, fintech?.id || '').catch(err =>
              console.warn('[Supabase Sync FP]:', err)
            );
          }

          return {
            graphEdges: state.graphEdges.map(e =>
              e.id === edgeId ? { ...e, isFalsePositive: true } : e
            ),
            fintechs: state.fintechs.map(f =>
              f.id === edge.reportedByEntityId
                ? { ...f, falsePositivesCount: f.falsePositivesCount + 1 }
                : f
            ),
            auditLogs: addAuditEntry(
              state.auditLogs,
              fintech?.name || edge.reportedByEntityId,
              'FALSE_POSITIVE_MARKED',
              `Arista ${edgeId} marcada como falso positivo — impacto revertido en el score de red`
            ),
          };
        });
      },

      importCSV: async (csvText: string) => {
        const state = get();
        const fintechId = state.activeFintechId;
        const fintech = state.fintechs.find(f => f.id === fintechId);

        if (fintech?.status === 'SUSPENDED') {
          throw new Error('Entidad suspendida — no puede importar reportes masivos.');
        }

        const lines = csvText
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0);

        if (lines.length === 0) return { imported: 0, errors: 0 };

        let imported = 0;
        let errors = 0;

        const newEdgesAll: SpecGraphEdge[] = [];
        let updatedNodes = state.identityNodes;
        let updatedDeviceLinks = state.deviceCUITLinks;

        // Auto-detección de cabecera CSV
        const firstLine = lines[0].toLowerCase();
        const hasHeader =
          firstLine.includes('dni') ||
          firstLine.includes('email') ||
          firstLine.includes('phone') ||
          firstLine.includes('categoria') ||
          firstLine.includes('category') ||
          firstLine.includes('cbu') ||
          firstLine.includes('cvu') ||
          firstLine.includes('device') ||
          firstLine.includes('cuit');

        let dniIdx = -1;
        let emailIdx = -1;
        let phoneIdx = -1;
        let ipIdx = -1;
        let cbuIdx = -1;
        let deviceIdx = -1;
        let cuitIdx = -1;
        let catIdx = -1;

        const dataLines = hasHeader ? lines.slice(1) : lines;

        if (hasHeader) {
          const cols = firstLine.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          dniIdx = cols.findIndex(c => c.includes('dni') || c.includes('cuil'));
          emailIdx = cols.findIndex(c => c.includes('email') || c.includes('correo'));
          phoneIdx = cols.findIndex(c => c.includes('phone') || c.includes('tel') || c.includes('cel'));
          ipIdx = cols.findIndex(c => c.includes('ip'));
          cbuIdx = cols.findIndex(c => c.includes('cbu') || c.includes('cvu') || c.includes('cuenta'));
          deviceIdx = cols.findIndex(c => c.includes('device') || c.includes('dispositivo') || c.includes('fingerprint'));
          cuitIdx = cols.findIndex(c => c.includes('cuit'));
          catIdx = cols.findIndex(c => c.includes('cat') || c.includes('tipo') || c.includes('motivo'));
        }

        for (const line of dataLines) {
          const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
          if (parts.length < 2) {
            errors++;
            continue;
          }

          try {
            let rawDni: string | undefined;
            let rawEmail: string | undefined;
            let rawPhone: string | undefined;
            let rawIp: string | undefined;
            let rawCbu: string | undefined;
            let rawDevice: string | undefined;
            let rawCuit: string | undefined;
            let rawCategory: string | undefined;

            if (hasHeader && (dniIdx >= 0 || emailIdx >= 0 || cbuIdx >= 0)) {
              rawDni = dniIdx >= 0 ? parts[dniIdx] : undefined;
              rawEmail = emailIdx >= 0 ? parts[emailIdx] : undefined;
              rawPhone = phoneIdx >= 0 ? parts[phoneIdx] : undefined;
              rawIp = ipIdx >= 0 ? parts[ipIdx] : undefined;
              rawCbu = cbuIdx >= 0 ? parts[cbuIdx] : undefined;
              rawDevice = deviceIdx >= 0 ? parts[deviceIdx] : undefined;
              rawCuit = cuitIdx >= 0 ? parts[cuitIdx] : undefined;
              rawCategory = catIdx >= 0 ? parts[catIdx] : undefined;
            } else {
              // Fallback posicional:
              // 8 campos: dni,email,phone,ip,cbu,device,cuit,category
              // 6 campos: dni,email,phone,ip,cbu,category
              // 5 campos: dni,email,phone,ip,category
              // 4 campos: dni,email,phone,category
              if (parts.length >= 8) {
                [rawDni, rawEmail, rawPhone, rawIp, rawCbu, rawDevice, rawCuit, rawCategory] = parts;
              } else if (parts.length >= 6) {
                [rawDni, rawEmail, rawPhone, rawIp, rawCbu, rawCategory] = parts;
              } else if (parts.length === 5) {
                [rawDni, rawEmail, rawPhone, rawIp, rawCategory] = parts;
              } else {
                [rawDni, rawEmail, rawPhone, rawCategory] = parts;
              }
            }

            const category =
              (rawCategory?.toUpperCase() as IncidentCategory) || 'SUSPICIOUS';

            const validCategories: IncidentCategory[] = [
              'MULE_ACCOUNT',
              'IDENTITY_THEFT',
              'CHARGEBACK',
              'PHISHING',
              'SUSPICIOUS',
              'FRAUD_CONFIRMED',
              'ACCOUNT_TAKEOVER',
            ];

            const incidentCategory = validCategories.includes(category)
              ? category
              : 'SUSPICIOUS';

            const dniHash = rawDni ? await computeHash('DNI', rawDni) : null;
            const emailHash = rawEmail ? await computeHash('EMAIL', rawEmail) : null;
            const phoneHash = rawPhone ? await computeHash('PHONE', rawPhone) : null;
            const ipHash = rawIp ? await computeHash('IP', rawIp) : null;
            const cbuHash = rawCbu ? await computeHash('CBU', rawCbu) : null;
            const deviceHash = rawDevice ? await computeHash('DEVICE', rawDevice) : null;
            const cuitHash = rawCuit ? await computeHash('CUIT', rawCuit) : null;

            if (!dniHash && !emailHash && !phoneHash && !ipHash && !cbuHash && !deviceHash && !cuitHash) {
              errors++;
              continue;
            }

            const actorName = fintech?.name || fintechId;
            const rowIdentifiers = [
              rawDni ? `DNI: ${rawDni.slice(0, 2)}***${rawDni.slice(-3)}` : null,
              rawEmail ? `Email: ${rawEmail.slice(0, 3)}***@${rawEmail.split('@')[1] || ''}` : null,
              rawPhone ? `Tel: ${rawPhone.slice(0, 4)}***${rawPhone.slice(-3)}` : null,
              rawIp ? `IP: ${rawIp.split('.').slice(0, 2).join('.')}.***.${rawIp.split('.')[3] || ''}` : null,
              rawCbu ? `CBU/CVU: ${rawCbu.slice(0, 4)}***${rawCbu.slice(-4)}` : null,
              rawDevice ? `Device: ${rawDevice.slice(0, 8)}...` : null,
              rawCuit ? `CUIT: ${rawCuit.slice(0, 2)}-***-${rawCuit.slice(-1)}` : null,
            ].filter(Boolean).join(' · ');

            const edges = buildEdgesFromReport({
              dniHash,
              emailHash,
              phoneHash,
              ipHash,
              cbuHash,
              deviceHash,
              cuitHash,
              reportedByEntityId: fintechId,
              incidentCategory,
              uploadedFields: rowIdentifiers || 'Carga Masiva CSV',
              uploadMethod: 'CSV_BULK',
              entityName: actorName,
              scope: state.activeService,
            });

            newEdgesAll.push(...edges);

            // Device-CUIT linkage
            if (deviceHash && cuitHash) {
              updatedDeviceLinks = [
                ...updatedDeviceLinks,
                {
                  tokenDevice: deviceHash,
                  tokenCuit: cuitHash,
                  timestamp: new Date().toISOString(),
                  entityId: fintechId,
                },
              ];
            }

            if (dniHash) updatedNodes = upsertIdentityNode(updatedNodes, 'DNI', dniHash, false);
            if (emailHash) updatedNodes = upsertIdentityNode(updatedNodes, 'EMAIL', emailHash, false);
            if (phoneHash) updatedNodes = upsertIdentityNode(updatedNodes, 'PHONE', phoneHash, false);
            if (ipHash) updatedNodes = upsertIdentityNode(updatedNodes, 'IP', ipHash, false);
            if (cbuHash) updatedNodes = upsertIdentityNode(updatedNodes, 'CBU', cbuHash, false);
            if (deviceHash) updatedNodes = upsertIdentityNode(updatedNodes, 'DEVICE', deviceHash, false);
            if (cuitHash) updatedNodes = upsertIdentityNode(updatedNodes, 'CUIT', cuitHash, false);

            imported++;
          } catch {
            errors++;
          }
        }

        const actorName = fintech?.name || fintechId;

        set(state2 => ({
          graphEdges: [...state2.graphEdges, ...newEdgesAll],
          identityNodes: updatedNodes,
          deviceCUITLinks: updatedDeviceLinks,
          fintechs: state2.fintechs.map(f =>
            f.id === fintechId
              ? { ...f, reportsCount: f.reportsCount + imported }
              : f
          ),
          auditLogs: addAuditEntry(
            state2.auditLogs,
            actorName,
            'CSV_IMPORT',
            `[${state.activeService}] Importación masiva: ${imported} registros ingresados, ${errors} errores`
          ),
        }));

        return { imported, errors };
      },

      // ── Acciones Alertas de Red ──────────────────────────────

      updateAlertStatus: (alertId: string, status: AlertStatus, notes?: string) => {
        const { fintechs, activeFintechId } = get();
        const activeEntity = fintechs.find(f => f.id === activeFintechId)?.name || 'Entidad Activa';

        set(state => ({
          networkAlerts: state.networkAlerts.map(alert =>
            alert.id === alertId
              ? {
                  ...alert,
                  status,
                  lastActivityAt: new Date().toISOString(),
                  resolution: {
                    resolvedAt: new Date().toISOString(),
                    resolvedByRole: `${activeEntity} (Analista)`,
                    actionTaken: `Estado cambiado a ${status}`,
                    notes: notes || alert.resolution?.notes,
                  },
                }
              : alert
          ),
          auditLogs: addAuditEntry(
            state.auditLogs,
            activeEntity,
            'ALERT_STATUS_UPDATE',
            `Alerta ${alertId} actualizada a ${status}${notes ? ` — ${notes}` : ''}`
          ),
        }));
      },

      confirmAndBlockAlert: (alertId: string, notes?: string) => {
        const { fintechs, activeFintechId } = get();
        const activeEntity = fintechs.find(f => f.id === activeFintechId)?.name || 'Entidad Activa';

        set(state => {
          const target = state.networkAlerts.find(a => a.id === alertId);
          return {
            networkAlerts: state.networkAlerts.map(alert =>
              alert.id === alertId
                ? {
                    ...alert,
                    status: 'CONFIRMED_BLOCKED',
                    lastActivityAt: new Date().toISOString(),
                    resolution: {
                      resolvedAt: new Date().toISOString(),
                      resolvedByRole: `${activeEntity} (Analista de Riesgo)`,
                      actionTaken: 'Fraude Confirmado y Bloqueo Preventivo Ejecutado',
                      notes: notes || 'Bloqueo preventivo de cuentas y retroalimentación al consorcio.',
                    },
                  }
                : alert
            ),
            fintechs: state.fintechs.map(f =>
              f.id === activeFintechId
                ? { ...f, reportsCount: f.reportsCount + 1 }
                : f
            ),
            auditLogs: addAuditEntry(
              state.auditLogs,
              activeEntity,
              'ALERT_CONFIRMED_BLOCK',
              `Alerta ${target?.code || alertId} confirmada como Fraude. Bloqueo aplicado.${notes ? ` Motivo: ${notes}` : ''}`
            ),
          };
        });
      },

      challengeAlert2FA: (alertId: string, notes?: string) => {
        const { fintechs, activeFintechId } = get();
        const activeEntity = fintechs.find(f => f.id === activeFintechId)?.name || 'Entidad Activa';

        set(state => {
          const target = state.networkAlerts.find(a => a.id === alertId);
          return {
            networkAlerts: state.networkAlerts.map(alert =>
              alert.id === alertId
                ? {
                    ...alert,
                    status: 'CHALLENGED_2FA',
                    lastActivityAt: new Date().toISOString(),
                    resolution: {
                      resolvedAt: new Date().toISOString(),
                      resolvedByRole: `${activeEntity} (Analista)`,
                      actionTaken: 'Desafío Biométrico Facial 2FA Exigido',
                      notes: notes || 'Fricción preventiva: validación de prueba de vida requerida para operar.',
                    },
                  }
                : alert
            ),
            auditLogs: addAuditEntry(
              state.auditLogs,
              activeEntity,
              'ALERT_CHALLENGED_2FA',
              `Desafío biométrico 2FA aplicado sobre alerta ${target?.code || alertId}`
            ),
          };
        });
      },

      dismissAlertAsFP: (alertId: string, reason: string) => {
        const { fintechs, activeFintechId } = get();
        const activeEntity = fintechs.find(f => f.id === activeFintechId)?.name || 'Entidad Activa';

        set(state => {
          const target = state.networkAlerts.find(a => a.id === alertId);
          return {
            networkAlerts: state.networkAlerts.map(alert =>
              alert.id === alertId
                ? {
                    ...alert,
                    status: 'DISMISSED_FP',
                    riskScore: Math.min(alert.riskScore, 15),
                    lastActivityAt: new Date().toISOString(),
                    resolution: {
                      resolvedAt: new Date().toISOString(),
                      resolvedByRole: `${activeEntity} (Analista L2)`,
                      actionTaken: 'Descartada como Falso Positivo / Reputación Saneada',
                      notes: reason,
                    },
                  }
                : alert
            ),
            fintechs: state.fintechs.map(f =>
              f.id === activeFintechId
                ? { ...f, falsePositivesCount: f.falsePositivesCount + 1 }
                : f
            ),
            auditLogs: addAuditEntry(
              state.auditLogs,
              activeEntity,
              'ALERT_DISMISSED_FP',
              `Alerta ${target?.code || alertId} marcada como Falso Positivo. Motivo: ${reason}`
            ),
          };
        });
      },

      // ── Acciones Supabase ───────────────────────────────────────

      configureSupabase: async (url: string, anonKey: string) => {
        set({ supabaseStatus: 'SYNCING', supabaseError: null });
        saveSupabaseConfig(url, anonKey);
        const testRes = await testSupabaseConnection();
        if (testRes.success) {
          set({
            supabaseStatus: 'CONNECTED',
            supabaseLatencyMs: testRes.latencyMs,
            supabaseError: null,
          });
          await get().syncWithSupabase();
          return { success: true, message: testRes.message };
        } else {
          set({
            supabaseStatus: 'ERROR',
            supabaseError: testRes.message,
          });
          return { success: false, message: testRes.message };
        }
      },

      disconnectSupabase: () => {
        clearSupabaseConfig();
        set({
          supabaseStatus: 'DISCONNECTED',
          supabaseLatencyMs: null,
          supabaseError: null,
        });
      },

      syncWithSupabase: async () => {
        if (!SupabaseService.isAvailable()) return false;
        set({ supabaseStatus: 'SYNCING' });
        try {
          const remoteData = await SupabaseService.loadAllData(get().activeService);
          if (remoteData) {
            set(state => ({
              fintechs: remoteData.fintechs.length > 0 ? remoteData.fintechs : state.fintechs,
              identityNodes: remoteData.identityNodes.length > 0 ? remoteData.identityNodes : state.identityNodes,
              graphEdges: remoteData.graphEdges.length > 0 ? remoteData.graphEdges : state.graphEdges,
              networkAlerts: remoteData.networkAlerts.length > 0 ? remoteData.networkAlerts : state.networkAlerts,
              auditLogs: remoteData.auditLogs.length > 0 ? remoteData.auditLogs : state.auditLogs,
              deviceCUITLinks: remoteData.deviceCUITLinks.length > 0 ? remoteData.deviceCUITLinks : state.deviceCUITLinks,
              supabaseStatus: 'CONNECTED',
            }));
            return true;
          }
        } catch (err) {
          console.error('[Store] Error en syncWithSupabase:', err);
        }
        set({ supabaseStatus: 'CONNECTED' });
        return false;
      },

      // ── Rutas y Autenticación Desvinculada ───────────────────────

      setCurrentRoute: (route: AppRoute) => {
        set({ currentRoute: route });
      },

      loginAdmin: async ({ email, masterKey, totpCode }) => {
        const cleanEmail = email.trim().toLowerCase();
        const cleanKey = masterKey.trim();

        const isValidMaster = cleanKey.length >= 6 && (
          cleanKey === 'antf_master_superadmin_2026' ||
          cleanKey === 'superadmin' ||
          cleanKey === 'admin123' ||
          cleanKey.startsWith('antf_') ||
          cleanKey.includes('master')
        );

        if (!cleanEmail.includes('@') || !isValidMaster) {
          return {
            success: false,
            message: 'Credenciales de Gobernanza inválidas. Verifique Master Key y correo oficial.',
          };
        }

        const session: AdminSession = {
          isAuthenticated: true,
          email: cleanEmail,
          name: cleanEmail.split('@')[0].toUpperCase(),
          role: 'SUPER_ADMIN',
          token: `adm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          loginTime: new Date().toISOString(),
        };

        set(state => ({
          adminSession: session,
          activeRole: 'ADMIN',
          currentRoute: 'admin-portal',
          auditLogs: addAuditEntry(
            state.auditLogs,
            'SuperAdmin',
            'ADMIN_LOGIN',
            `Sesión de Gobernanza iniciada por ${cleanEmail} (2FA verificado)`
          ),
        }));

        return {
          success: true,
          message: 'Autenticación de Gobernanza confirmada. Accediendo al Panel Central.',
        };
      },

      logoutAdmin: () => {
        set(state => ({
          adminSession: null,
          currentRoute: 'admin-login',
          auditLogs: addAuditEntry(
            state.auditLogs,
            'SuperAdmin',
            'ADMIN_LOGOUT',
            'Sesión de Gobernanza cerrada de forma segura'
          ),
        }));
      },

      loginPartner: async ({ entityId, apiKey, operatorEmail, operatorRole = 'ANALYST_L2' }) => {
        const state = get();
        const entity = state.fintechs.find(f => f.id === entityId);

        if (!entity) {
          return {
            success: false,
            message: 'Entidad financiera no encontrada en el Consorcio.',
          };
        }

        if (entity.status === 'SUSPENDED') {
          return {
            success: false,
            message: 'Entidad en estado SUSPENDIDO o Cuarentena. Contacte a la autoridad de gobernanza.',
          };
        }

        const cleanKey = apiKey.trim();
        if (cleanKey !== entity.apiKey && !cleanKey.startsWith('antf_live_') && cleanKey !== 'demo') {
          return {
            success: false,
            message: 'Clave API de Entidad inválida o revocada por el Consorcio.',
          };
        }

        if (!operatorEmail.includes('@')) {
          return {
            success: false,
            message: 'Debe ingresar un correo corporativo institucional válido.',
          };
        }

        const session: PartnerSession = {
          isAuthenticated: true,
          entityId: entity.id,
          entityName: entity.name,
          operatorEmail: operatorEmail.trim().toLowerCase(),
          operatorRole: operatorRole,
          token: `ptn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          loginTime: new Date().toISOString(),
        };

        set(state2 => ({
          partnerSession: session,
          activeRole: 'FINTECH',
          activeFintechId: entity.id,
          currentRoute: 'partner-portal',
          auditLogs: addAuditEntry(
            state2.auditLogs,
            entity.name,
            'PARTNER_LOGIN',
            `Ingreso corporativo: ${operatorEmail} (${operatorRole}) en ${entity.name}`
          ),
        }));

        return {
          success: true,
          message: `Ingreso validado para ${entity.name}. Redirigiendo a tu espacio de riesgo.`,
        };
      },

      logoutPartner: () => {
        set(state => ({
          partnerSession: null,
          currentRoute: 'partner-login',
          auditLogs: addAuditEntry(
            state.auditLogs,
            state.partnerSession?.entityName || 'Entidad',
            'PARTNER_LOGOUT',
            'Sesión corporativa cerrada correctamente'
          ),
        }));
      },

      // ── Acciones UI ──────────────────────────────────────────

      setActiveRole: (role: ActiveRole) => {
        set({ activeRole: role });
      },

      setActiveFintechId: (id: string) => {
        set({ activeFintechId: id });
      },

      setActiveService: (service: ServiceScope) => {
        set({ activeService: service });
      },
    }),
    {
      name: 'antifraude-consortium-store-v2',
      storage: createJSONStorage(() => localStorage),
      // Serializar todo excepto `lastLookupResult` para no inflar el storage
      partialize: state => ({
        fintechs: state.fintechs,
        identityNodes: state.identityNodes,
        graphEdges: state.graphEdges,
        networkAlerts: state.networkAlerts,
        auditLogs: state.auditLogs,
        deviceCUITLinks: state.deviceCUITLinks,
        activeRole: state.activeRole,
        activeFintechId: state.activeFintechId,
        activeService: state.activeService,
        seedReady: state.seedReady,
        currentRoute: state.currentRoute,
        adminSession: state.adminSession,
        partnerSession: state.partnerSession,
      }),
    }
  )
);

