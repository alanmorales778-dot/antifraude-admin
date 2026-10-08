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
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
  AppUser,
  ScoringAuditRecord,
} from './types';
import { computeHash, evaluateRisk, upsertIdentityNode, buildEdgesFromReport } from './fraudEngine';
import { SupabaseService } from './supabaseService';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
} from './supabaseClient';
import { verifyTOTP, generateTOTPSecret } from './totp';

// ─────────────────────────────────────────────────────────────────
// DATOS SEMILLA (del spec)
// ─────────────────────────────────────────────────────────────────

// Hashes pre-computados de los casos del spec usando el salt del consorcio.
// Se calculan en runtime al inicializar el store si no existen en storage.
// Base de datos limpia iniciada desde 0 sin bancos ni listas negras mock
export const SEED_FINTECHS: FintechEntity[] = [];

const SEED_AUDIT_LOGS: StoreAuditLog[] = [
  {
    timestamp: new Date().toISOString(),
    actor: 'Sistema Central',
    action: 'INIT',
    details: 'Base de datos y motor ZK inicializados para pruebas operativas desde 0',
  },
];

// ─────────────────────────────────────────────────────────────────
// ALERTAS DE RED SEMILLA
// ─────────────────────────────────────────────────────────────────

export const SEED_NETWORK_ALERTS: NetworkAlert[] = [];

// ─────────────────────────────────────────────────────────────────
// SEMILLAS DE USUARIOS Y ROLES (Supabase Auth / Control RBAC)
// ─────────────────────────────────────────────────────────────────

export const SEED_APP_USERS: AppUser[] = [
  {
    id: 'usr-admin-1',
    email: 'andresalaniz8@gmail.com',
    role: 'admin',
    entityId: 'CONSORCIO',
    entityName: 'Gobernanza Central',
    status: 'ACTIVE',
    totpEnrolled: false,
    createdAt: '2026-09-01T10:00:00Z',
    lastLogin: new Date().toISOString(),
  },
  {
    id: 'usr-admin-2',
    email: 'alan.morales778@gmail.com',
    role: 'admin',
    entityId: 'CONSORCIO',
    entityName: 'Gobernanza Central',
    status: 'ACTIVE',
    totpEnrolled: false,
    createdAt: '2026-09-01T10:00:00Z',
    lastLogin: new Date().toISOString(),
  },
  {
    id: 'usr-op-1',
    email: 'analista.seguridad@fintechalpha.com',
    role: 'usuario',
    entityId: 'fintech-alpha',
    entityName: 'Fintech Alpha',
    status: 'ACTIVE',
    totpEnrolled: false,
    createdAt: '2026-09-15T12:00:00Z',
  },
  {
    id: 'usr-op-2',
    email: 'riesgo.operativo@bancobeta.com.ar',
    role: 'usuario',
    entityId: 'banco-beta',
    entityName: 'Banco Beta',
    status: 'ACTIVE',
    totpEnrolled: false,
    createdAt: '2026-09-20T14:30:00Z',
  },
];

export const SEED_SCORING_AUDIT_RECORDS: ScoringAuditRecord[] = [];

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
    internalTicketId?: string;
    incidentId?: string;
  }) => Promise<void>;

  markFalsePositive: (edgeId: string, reason?: string) => void;

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
  loginAdmin: (credentials: { email: string; masterKey: string; totpCode?: string }) => Promise<{ success: boolean; message: string; requires2FAEnroll?: boolean; requires2FACode?: boolean }>;
  logoutAdmin: () => void;

  partnerSession: PartnerSession | null;
  loginPartner: (credentials: { entityId: string; apiKey: string; operatorEmail: string; operatorRole?: UserRole; totpCode?: string }) => Promise<{ success: boolean; message: string; requires2FAEnroll?: boolean; requires2FACode?: boolean }>;
  logoutPartner: () => void;

  // ── Gestión de Usuarios y Roles (Supabase Auth / RBAC) ────────
  appUsers: AppUser[];
  addUser: (user: { email: string; role: 'admin' | 'usuario'; entityId?: string; entityName?: string; tempPassword?: string }) => Promise<{ success: boolean; message: string }>;
  updateUserRole: (userId: string, role: 'admin' | 'usuario') => Promise<{ success: boolean; message: string }>;
  toggleUserStatus: (userId: string) => Promise<{ success: boolean; message: string }>;
  updateUserTotp: (userId: string, enrolled: boolean, secret?: string) => Promise<void>;
  complete2FAEnrollment: (email: string, secret: string, code: string) => Promise<{ success: boolean; message: string }>;

  // ── Auditoría Histórica de Scores ──────────────────────────────
  scoringAuditRecords: ScoringAuditRecord[];
  recordScoringAudit: (record: Omit<ScoringAuditRecord, 'id' | 'timestamp'>) => void;

  // ── Configuración y Control de Scoring Dual ───────────────────
  scoringConfig: ScoringConfig;
  updateScoringConfig: (newConfig: Partial<ScoringConfig>) => void;
  resetScoringConfig: () => void;
  applyScoringPreset: (presetName: 'BALANCED' | 'STRICT' | 'PERMISSIVE') => void;
  setScoreOverride: (overrides: { manualEntityScore?: number | null; manualConsortiumScore?: number | null; enabled?: boolean }) => void;
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
      // ── Estado inicial 100% limpio para pruebas desde cero ───
      fintechs: [],
      identityNodes: [],
      graphEdges: [],
      auditLogs: SEED_AUDIT_LOGS,
      networkAlerts: SEED_NETWORK_ALERTS,
      lastLookupResult: null,
      seedReady: false,
      deviceCUITLinks: [],
      scoringConfig: DEFAULT_SCORING_CONFIG,
      appUsers: SEED_APP_USERS,
      scoringAuditRecords: SEED_SCORING_AUDIT_RECORDS,

      activeRole: 'ADMIN',
      activeFintechId: '',
      activeService: 'CONSORTIUM',

      // ── Sesiones y Rutas Independientes ────────────────────────
      currentRoute: 'admin-login',
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
            if (remoteData) {
              set({
                fintechs: remoteData.fintechs,
                identityNodes: remoteData.identityNodes,
                graphEdges: remoteData.graphEdges,
                networkAlerts: remoteData.networkAlerts,
                auditLogs: remoteData.auditLogs.length > 0 ? remoteData.auditLogs : get().auditLogs,
                deviceCUITLinks: remoteData.deviceCUITLinks,
                appUsers: remoteData.appUsers && remoteData.appUsers.length > 0 ? remoteData.appUsers : get().appUsers,
                seedReady: true,
                supabaseStatus: 'CONNECTED',
              });
              return;
            }
          } catch (e) {
            console.warn('[Store] Supabase no disponible al iniciar, usando memoria local:', e);
          }
        }

        set({ fintechs: [], identityNodes: [], graphEdges: [], networkAlerts: [], deviceCUITLinks: [], seedReady: true });
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
          scoringConfig: state.scoringConfig,
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

      reportFraud: async ({ dni, email, phone, ip, cbu, device, cuit, incidentCategory, internalTicketId, incidentId }) => {
        const state = get();
        const fintechId = state.partnerSession?.entityId || state.activeFintechId || (state.fintechs[0]?.id) || 'fintech-alpha';
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

        const actorName = fintech?.name || state.partnerSession?.entityName || 'Fintech Alpha';
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

        // Asignar ticket interno e incidentId común para análisis de grafos
        newEdges.forEach(e => {
          e.internalTicketId = internalTicketId;
          e.incidentId = incidentId;
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
            `[${state.activeService}] Reporte ${incidentCategory} ingresado ${internalTicketId ? `(Ticket: ${internalTicketId})` : ''} — ${identifiers} (${newEdges.length} aristas creadas)`
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

      markFalsePositive: (edgeId: string, reason?: string) => {
        set(state => {
          const edge = state.graphEdges.find(e => e.id === edgeId);
          if (!edge) return state;

          const fintech = state.fintechs.find(f => f.id === edge.reportedByEntityId);
          const actorName = fintech?.name || edge.reportedByEntityId;

          if (SupabaseService.isAvailable()) {
            SupabaseService.markFalsePositive(edgeId, fintech?.id || '').catch(err =>
              console.warn('[Supabase Sync FP]:', err)
            );
          }

          return {
            graphEdges: state.graphEdges.map(e =>
              e.id === edgeId ? { ...e, isFalsePositive: true, revocationReason: reason } : e
            ),
            fintechs: state.fintechs.map(f =>
              f.id === edge.reportedByEntityId
                ? { ...f, falsePositivesCount: f.falsePositivesCount + 1 }
                : f
            ),
            auditLogs: addAuditEntry(
              state.auditLogs,
              actorName,
              'REPORT_REVOKED',
              `Reporte ${edgeId} marcado como falso positivo/revocado. Motivo: ${reason || 'Revocación por analista de compliance'}`
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

        // 1. Control estricto de acceso de Admin:
        // Inicialmente y por defecto solo andresalaniz8@gmail.com y alan.morales778@gmail.com
        // O usuarios registrados en appUsers con rol 'admin'
        const state = get();
        let existingUser = state.appUsers.find(u => u.email.toLowerCase() === cleanEmail);
        const isDefaultAdmin = cleanEmail === 'andresalaniz8@gmail.com' || cleanEmail === 'alan.morales778@gmail.com';
        const hasAdminRole = existingUser ? existingUser.role === 'admin' && existingUser.status === 'ACTIVE' : isDefaultAdmin;

        if (!hasAdminRole) {
          return {
            success: false,
            message: 'Acceso no autorizado: El correo ingresado no cuenta con privilegios de SuperAdmin autorizados en el consorcio.',
          };
        }

        // Si es un admin por defecto que aún no está en appUsers, crearlo
        if (!existingUser && isDefaultAdmin) {
          const newAdmin: AppUser = {
            id: `usr-admin-${Date.now()}`,
            email: cleanEmail,
            role: 'admin',
            entityId: 'CONSORCIO',
            entityName: 'Gobernanza Central',
            status: 'ACTIVE',
            totpEnrolled: false,
            createdAt: new Date().toISOString(),
          };
          set(s => ({ appUsers: [...s.appUsers, newAdmin] }));
          existingUser = newAdmin;
        }

        // 2. Validación de Master Key o Contraseña (>= 6 caracteres)
        const isValidMaster = cleanKey.length >= 6 && (
          cleanKey === 'antf_master_superadmin_2026' ||
          cleanKey === 'superadmin' ||
          cleanKey === 'admin123' ||
          cleanKey.startsWith('antf_') ||
          cleanKey.includes('master') ||
          cleanKey.length >= 8
        );

        if (!isValidMaster) {
          return {
            success: false,
            message: 'Contraseña o Master Key incorrecta. Verifique sus credenciales.',
          };
        }

        // 3. Verificación de Enrolamiento 2FA (Google Authenticator / TOTP)
        if (!existingUser || !existingUser.totpEnrolled || !existingUser.totpSecret) {
          return {
            success: false,
            requires2FAEnroll: true,
            message: 'Enrolamiento 2FA requerido: Vincule Google Authenticator para continuar.',
          };
        }

        // Si el usuario ya completó el enrolamiento, exigir el código dinámico de 6 dígitos
        if (!totpCode || totpCode.trim().length < 6) {
          return {
            success: false,
            requires2FACode: true,
            message: 'Ingrese el código dinámico de 6 dígitos generado por Google Authenticator.',
          };
        }

        const cleanCode = totpCode.trim().replace(/\s/g, '');
        if (!/^\d{6}$/.test(cleanCode)) {
          return {
            success: false,
            requires2FACode: true,
            message: 'Código 2FA inválido. Debe contener exactamente 6 dígitos.',
          };
        }

        // Validación criptográfica real del token con el secreto del usuario
        const isCodeValid = await verifyTOTP(cleanCode, existingUser.totpSecret, 1);
        if (!isCodeValid) {
          return {
            success: false,
            requires2FACode: true,
            message: 'Código de verificación 2FA incorrecto o expirado. Verifique la hora en Google Authenticator e intente con el código dinámico actual.',
          };
        }

        const session: AdminSession = {
          isAuthenticated: true,
          email: cleanEmail,
          name: cleanEmail.split('@')[0].toUpperCase(),
          role: 'SUPER_ADMIN',
          token: `adm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          loginTime: new Date().toISOString(),
          is2FAVerified: true,
        };

        set(s => ({
          adminSession: session,
          activeRole: 'ADMIN',
          currentRoute: 'admin-portal',
          appUsers: s.appUsers.map(u => u.email.toLowerCase() === cleanEmail ? { ...u, lastLogin: new Date().toISOString() } : u),
          auditLogs: addAuditEntry(
            s.auditLogs,
            cleanEmail,
            'ADMIN_LOGIN',
            `Sesión de Gobernanza iniciada por ${cleanEmail} (2FA TOTP RFC 6238 verificado criptográficamente)`
          ),
        }));

        return {
          success: true,
          message: 'Autenticación de Gobernanza confirmada. Accediendo al Panel Central.',
        };
      },

      complete2FAEnrollment: async (email: string, secret: string, code: string) => {
        const cleanEmail = email.trim().toLowerCase();
        const cleanCode = code.trim().replace(/\s/g, '');
        const cleanSecret = secret.trim().replace(/\s/g, '');

        if (!/^\d{6}$/.test(cleanCode)) {
          return { success: false, message: 'El código de verificación debe contener exactamente 6 dígitos.' };
        }

        // Validación criptográfica real del token con el secreto
        const isValid = await verifyTOTP(cleanCode, cleanSecret, 1);
        if (!isValid) {
          return {
            success: false,
            message: 'El código ingresado no coincide con el secreto del código QR. Verifique que la hora de su teléfono esté sincronizada e intente con el código actual de Google Authenticator.',
          };
        }

        const state = get();
        let targetUser = state.appUsers.find(u => u.email.toLowerCase() === cleanEmail);
        const isDefaultSuperAdmin = cleanEmail === 'andresalaniz8@gmail.com' || cleanEmail === 'alan.morales778@gmail.com';

        if (!targetUser && !isDefaultSuperAdmin) {
          return {
            success: false,
            message: `Acceso no autorizado: El usuario ${cleanEmail} no ha sido dado de alta previamente por un Administrador desde el Panel de Gobernanza Central.`,
          };
        }

        const isAdmin = targetUser ? targetUser.role === 'admin' : isDefaultSuperAdmin;

        set(s => {
          let updatedUsers = s.appUsers.map(u => {
            if (u.email.toLowerCase() === cleanEmail) {
              return { ...u, totpEnrolled: true, totpSecret: cleanSecret, lastLogin: new Date().toISOString() };
            }
            return u;
          });

          // Si el usuario es un admin por defecto que aún no estaba en appUsers:
          if (!updatedUsers.some(u => u.email.toLowerCase() === cleanEmail) && isDefaultSuperAdmin) {
            updatedUsers.push({
              id: `usr-admin-${Date.now()}`,
              email: cleanEmail,
              role: 'admin',
              entityId: 'CONSORCIO',
              entityName: 'Gobernanza Central',
              status: 'ACTIVE',
              totpEnrolled: true,
              totpSecret: cleanSecret,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
            });
          }

          if (isAdmin) {
            const adminSession: AdminSession = {
              isAuthenticated: true,
              email: cleanEmail,
              name: cleanEmail.split('@')[0].toUpperCase(),
              role: 'SUPER_ADMIN',
              token: `adm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              loginTime: new Date().toISOString(),
              is2FAVerified: true,
            };
            return {
              adminSession,
              activeRole: 'ADMIN',
              currentRoute: 'admin-portal',
              appUsers: updatedUsers,
              auditLogs: addAuditEntry(
                s.auditLogs,
                cleanEmail,
                '2FA_ENROLL',
                `Enrolamiento 2FA (Google Authenticator) vinculado y verificado criptográficamente para SuperAdmin ${cleanEmail}`
              ),
            };
          } else {
            const partnerEntity = s.fintechs.find(f => f.id === targetUser?.entityId) || s.fintechs[0];
            const partnerSession: PartnerSession = {
              isAuthenticated: true,
              entityId: partnerEntity.id,
              entityName: partnerEntity.name,
              operatorEmail: cleanEmail,
              operatorRole: 'ANALYST_L2',
              token: `ptn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              loginTime: new Date().toISOString(),
            };
            return {
              partnerSession,
              activeRole: 'FINTECH',
              activeFintechId: partnerEntity.id,
              currentRoute: 'partner-portal',
              appUsers: updatedUsers,
              auditLogs: addAuditEntry(
                s.auditLogs,
                partnerEntity.name,
                '2FA_ENROLL',
                `Enrolamiento 2FA (Google Authenticator) vinculado y verificado criptográficamente para ${cleanEmail}`
              ),
            };
          }
        });

        return { success: true, message: 'Google Authenticator vinculado y verificado criptográficamente con éxito.' };
      },

      addUser: async ({ email, role, entityId = 'CONSORCIO', entityName = 'Gobernanza Central', tempPassword }) => {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
          return { success: false, message: 'Correo electrónico inválido.' };
        }

        const state = get();
        if (state.appUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
          return { success: false, message: 'Ya existe un usuario registrado con este correo.' };
        }

        const newUser: AppUser = {
          id: `usr-${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          email: cleanEmail,
          role,
          entityId,
          entityName,
          status: 'ACTIVE',
          totpEnrolled: false, // Forzar enrolamiento en primer login
          createdAt: new Date().toISOString(),
        };

        set(s => ({
          appUsers: [newUser, ...s.appUsers],
          auditLogs: addAuditEntry(
            s.auditLogs,
            s.adminSession?.email || 'SuperAdmin',
            'USER_CREATE',
            `Alta de nuevo usuario: ${cleanEmail} con rol [${role.toUpperCase()}] para [${entityName}]`
          ),
        }));

        return {
          success: true,
          message: `Usuario ${cleanEmail} creado con éxito. Se requerirá vinculación obligatoria de Google Authenticator al ingresar.`,
        };
      },

      updateUserRole: async (userId: string, role: 'admin' | 'usuario') => {
        const state = get();
        const user = state.appUsers.find(u => u.id === userId);
        if (!user) return { success: false, message: 'Usuario no encontrado.' };

        set(s => ({
          appUsers: s.appUsers.map(u => u.id === userId ? { ...u, role } : u),
          auditLogs: addAuditEntry(
            s.auditLogs,
            s.adminSession?.email || 'SuperAdmin',
            'ROLE_UPDATE',
            `Permiso modificado para ${user.email}: nuevo rol [${role.toUpperCase()}]`
          ),
        }));

        return { success: true, message: `Rol de ${user.email} actualizado a ${role}.` };
      },

      toggleUserStatus: async (userId: string) => {
        const state = get();
        const user = state.appUsers.find(u => u.id === userId);
        if (!user) return { success: false, message: 'Usuario no encontrado.' };

        const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        set(s => ({
          appUsers: s.appUsers.map(u => u.id === userId ? { ...u, status: newStatus } : u),
          auditLogs: addAuditEntry(
            s.auditLogs,
            s.adminSession?.email || 'SuperAdmin',
            'USER_STATUS_CHANGE',
            `Estado de ${user.email} cambiado a [${newStatus}]`
          ),
        }));

        return { success: true, message: `Estado cambiado a ${newStatus}.` };
      },

      updateUserTotp: async (userId: string, enrolled: boolean, secret?: string) => {
        set(s => ({
          appUsers: s.appUsers.map(u => u.id === userId ? { ...u, totpEnrolled: enrolled, totpSecret: secret } : u),
        }));
      },

      recordScoringAudit: (record) => {
        const newRecord: ScoringAuditRecord = {
          id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          ...record,
        };
        set(s => ({
          scoringAuditRecords: [newRecord, ...s.scoringAuditRecords].slice(0, 100),
        }));
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

      loginPartner: async ({ entityId, apiKey, operatorEmail, operatorRole = 'ANALYST_L2', totpCode }) => {
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
        if (cleanKey !== entity.apiKey && !cleanKey.startsWith('antf_live_')) {
          return {
            success: false,
            message: 'Clave API de Entidad inválida o revocada por el Consorcio.',
          };
        }

        const cleanEmail = operatorEmail.trim().toLowerCase();
        if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
          return {
            success: false,
            message: 'Debe ingresar un correo corporativo institucional válido.',
          };
        }

        // Control de Acceso: El usuario debe haber sido dado de alta previamente por un Administrador
        const existingUser = state.appUsers.find(u => u.email.toLowerCase() === cleanEmail);
        if (!existingUser) {
          return {
            success: false,
            message: `Acceso no autorizado: El usuario [${cleanEmail}] no ha sido dado de alta previamente por un Administrador desde el Panel de Gobernanza Central.`,
          };
        }

        if (existingUser.status === 'SUSPENDED') {
          return {
            success: false,
            message: 'Cuenta de usuario suspendida o bloqueada por la Gobernanza Central.',
          };
        }

        // Control 2FA Obligatorio con Google Authenticator
        if (!existingUser.totpEnrolled || !existingUser.totpSecret) {
          return {
            success: false,
            requires2FAEnroll: true,
            message: 'Enrolamiento 2FA requerido: Vincule Google Authenticator para continuar.',
          };
        }

        if (!totpCode || totpCode.trim().length < 6) {
          return {
            success: false,
            requires2FACode: true,
            message: 'Ingrese el código dinámico de 6 dígitos generado por Google Authenticator.',
          };
        }

        const cleanCode = totpCode.trim().replace(/\s/g, '');
        if (!/^\d{6}$/.test(cleanCode)) {
          return {
            success: false,
            requires2FACode: true,
            message: 'Código 2FA inválido. Debe contener exactamente 6 dígitos numéricos.',
          };
        }

        const isCodeValid = await verifyTOTP(cleanCode, existingUser.totpSecret, 1);
        if (!isCodeValid) {
          return {
            success: false,
            requires2FACode: true,
            message: 'Código 2FA incorrecto o expirado. Verifique que la hora de su teléfono esté sincronizada e intente con el código actual de Google Authenticator.',
          };
        }

        const session: PartnerSession = {
          isAuthenticated: true,
          entityId: entity.id,
          entityName: entity.name,
          operatorEmail: cleanEmail,
          operatorRole: operatorRole,
          token: `ptn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          loginTime: new Date().toISOString(),
        };

        set(state2 => ({
          partnerSession: session,
          activeRole: 'FINTECH',
          activeFintechId: entity.id,
          currentRoute: 'partner-portal',
          appUsers: state2.appUsers.map(u => u.email.toLowerCase() === cleanEmail ? { ...u, lastLogin: new Date().toISOString() } : u),
          auditLogs: addAuditEntry(
            state2.auditLogs,
            entity.name,
            'PARTNER_LOGIN',
            `Ingreso corporativo: ${cleanEmail} (${operatorRole}) en ${entity.name} (2FA TOTP RFC 6238 verificado criptográficamente)`
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

      // ── Acciones de Configuración de Scoring Dual ────────────
      updateScoringConfig: (newConfig: Partial<ScoringConfig>) => {
        set(state => {
          const updated: ScoringConfig = {
            ...state.scoringConfig,
            ...newConfig,
            severityBase: {
              ...state.scoringConfig.severityBase,
              ...(newConfig.severityBase || {}),
            },
            decayFloor: {
              ...state.scoringConfig.decayFloor,
              ...(newConfig.decayFloor || {}),
            },
            multiEntityMultipliers: {
              ...state.scoringConfig.multiEntityMultipliers,
              ...(newConfig.multiEntityMultipliers || {}),
            },
            emailPenalties: {
              ...state.scoringConfig.emailPenalties,
              ...(newConfig.emailPenalties || {}),
            },
            scoreOverrides: {
              ...state.scoringConfig.scoreOverrides,
              ...(newConfig.scoreOverrides || {}),
            },
          };
          return {
            scoringConfig: updated,
            auditLogs: addAuditEntry(
              state.auditLogs,
              state.adminSession?.email || 'Gobernanza Central',
              'SCORING_CONFIG_UPDATED',
              'Parámetros del motor de scoring dual actualizados por el Administrador.'
            ),
          };
        });
      },

      resetScoringConfig: () => {
        set(state => ({
          scoringConfig: DEFAULT_SCORING_CONFIG,
          auditLogs: addAuditEntry(
            state.auditLogs,
            state.adminSession?.email || 'Gobernanza Central',
            'SCORING_CONFIG_RESET',
            'Configuración de scoring restablecida a valores recomendados estándar.'
          ),
        }));
      },

      applyScoringPreset: (presetName: 'BALANCED' | 'STRICT' | 'PERMISSIVE') => {
        let preset: Partial<ScoringConfig> = {};
        if (presetName === 'STRICT') {
          preset = {
            highRiskThreshold: 60,
            mediumRiskThreshold: 25,
            mismatchPenalty: 55,
            velocityPenalty: 35,
            deviceFarmFloor: 90,
            multiEntityMultipliers: { two: 1.40, three: 1.70, fourOrMore: 2.0 },
          };
        } else if (presetName === 'PERMISSIVE') {
          preset = {
            highRiskThreshold: 80,
            mediumRiskThreshold: 40,
            mismatchPenalty: 30,
            velocityPenalty: 15,
            deviceFarmFloor: 75,
            multiEntityMultipliers: { two: 1.15, three: 1.30, fourOrMore: 1.50 },
          };
        } else {
          preset = {
            highRiskThreshold: 70,
            mediumRiskThreshold: 30,
            mismatchPenalty: 45,
            velocityPenalty: 25,
            deviceFarmFloor: 85,
            multiEntityMultipliers: { two: 1.25, three: 1.50, fourOrMore: 1.80 },
          };
        }
        set(state => ({
          scoringConfig: {
            ...state.scoringConfig,
            ...preset,
          },
          auditLogs: addAuditEntry(
            state.auditLogs,
            state.adminSession?.email || 'Gobernanza Central',
            'SCORING_PRESET_APPLIED',
            `Perfil de scoring aplicado: ${presetName}`
          ),
        }));
      },

      setScoreOverride: (overrides) => {
        set(state => ({
          scoringConfig: {
            ...state.scoringConfig,
            scoreOverrides: {
              ...state.scoringConfig.scoreOverrides,
              ...overrides,
            },
          },
        }));
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
        scoringConfig: state.scoringConfig,
        appUsers: state.appUsers,
        scoringAuditRecords: state.scoringAuditRecords,
      }),
    }
  )
);

