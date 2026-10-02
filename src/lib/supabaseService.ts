import {
  FintechEntity,
  IdentityNode,
  SpecGraphEdge,
  StoreAuditLog,
  NetworkAlert,
  DeviceCUITLink,
  ServiceScope,
} from './types';
import { supabaseFetch, getSupabaseConfig } from './supabaseClient';

/**
 * Servicio de sincronización y persistencia con Supabase
 */
export class SupabaseService {
  /**
   * Indica si la configuración de Supabase está activa
   */
  static isAvailable(): boolean {
    return getSupabaseConfig().isConfigured;
  }

  // =================================================================
  // LECTURA / HIDRATACIÓN
  // =================================================================

  /**
   * Carga todo el estado persistente desde Supabase para inicializar el store
   */
  static async loadAllData(scope: ServiceScope = 'CONSORTIUM'): Promise<{
    fintechs: FintechEntity[];
    identityNodes: IdentityNode[];
    graphEdges: SpecGraphEdge[];
    networkAlerts: NetworkAlert[];
    auditLogs: StoreAuditLog[];
    deviceCUITLinks: DeviceCUITLink[];
  } | null> {
    if (!this.isAvailable()) return null;

    try {
      const [
        fintechsRes,
        nodesRes,
        edgesRes,
        alertsRes,
        auditRes,
        deviceLinksRes,
      ] = await Promise.all([
        supabaseFetch<any[]>('fintech_entities?select=*'),
        supabaseFetch<any[]>('identity_nodes?select=*'),
        supabaseFetch<any[]>('graph_edges?select=*&order=timestamp.desc&limit=1000'),
        supabaseFetch<any[]>('network_alerts?select=*&order=created_at.desc'),
        supabaseFetch<any[]>('audit_logs?select=*&order=timestamp.desc&limit=200'),
        supabaseFetch<any[]>('device_cuit_links?select=*&order=timestamp.desc&limit=1000'),
      ]);

      if (fintechsRes.error && nodesRes.error && edgesRes.error) {
        console.warn('[SupabaseService] No se pudieron leer las tablas remotas:', fintechsRes.error);
        return null;
      }

      // Mapear entidades
      const fintechs: FintechEntity[] = (fintechsRes.data || []).map(f => ({
        id: f.id,
        name: f.name,
        apiKey: f.api_key,
        trustWeight: Number(f.trust_weight) || 0.7,
        status: f.status as 'ACTIVE' | 'SUSPENDED',
        queriesCount: Number(f.queries_count) || 0,
        reportsCount: Number(f.reports_count) || 0,
        falsePositivesCount: Number(f.false_positives_count) || 0,
      }));

      // Mapear nodos de identidad
      const identityNodes: IdentityNode[] = (nodesRes.data || []).map(n => ({
        type: n.identifier_type,
        hash: n.hash,
        firstSeen: n.first_seen,
        lastSeen: n.last_seen,
        totalLookups: Number(n.total_lookups) || 0,
        lookupsLastHour: Number(n.lookups_last_hour) || 0,
      }));

      // Mapear aristas del grafo
      const graphEdges: SpecGraphEdge[] = (edgesRes.data || []).map(e => ({
        id: e.id,
        sourceHash: e.source_hash,
        targetHash: e.target_hash,
        reportedByEntityId: e.reported_by_entity_id,
        incidentCategory: e.incident_category,
        timestamp: e.timestamp,
        isFalsePositive: Boolean(e.is_false_positive),
        uploadedFields: e.uploaded_fields || undefined,
        uploadMethod: e.upload_method || 'MANUAL',
        entityName: e.entity_name || undefined,
        scope: e.scope as ServiceScope,
      }));

      // Mapear alertas
      const networkAlerts: NetworkAlert[] = (alertsRes.data || []).map(a => ({
        id: a.id,
        code: a.code,
        title: a.title,
        category: a.category,
        severity: a.severity,
        status: a.status,
        entitiesInvolved: a.entities_involved || [],
        riskScore: Number(a.risk_score) || 80,
        createdAt: a.created_at,
        lastActivityAt: a.last_activity_at || a.created_at,
        scope: a.scope as ServiceScope,
        resolution: a.resolution || undefined,
      }));

      // Mapear audit logs
      const auditLogs: StoreAuditLog[] = (auditRes.data || []).map(l => ({
        timestamp: l.timestamp,
        actor: l.actor,
        action: l.action,
        details: l.details,
      }));

      // Mapear device-cuit links
      const deviceCUITLinks: DeviceCUITLink[] = (deviceLinksRes.data || []).map(d => ({
        tokenDevice: d.token_device,
        tokenCuit: d.token_cuit,
        timestamp: d.timestamp,
        entityId: d.entity_id,
      }));

      return {
        fintechs,
        identityNodes,
        graphEdges,
        networkAlerts,
        auditLogs,
        deviceCUITLinks,
      };
    } catch (err) {
      console.error('[SupabaseService] Error durante loadAllData:', err);
      return null;
    }
  }

  // =================================================================
  // ESCRITURA / PERSISTENCIA
  // =================================================================

  /**
   * Persiste un nuevo reporte de fraude completo
   */
  static async persistFraudReport(params: {
    edges: SpecGraphEdge[];
    nodes: IdentityNode[];
    deviceCUITLinks: DeviceCUITLink[];
    entityId: string;
    auditLog: StoreAuditLog;
    scope: ServiceScope;
  }): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const promises: Promise<any>[] = [];

      // 1. Guardar aristas
      if (params.edges.length > 0) {
        const edgeRows = params.edges.map(e => ({
          id: e.id,
          source_hash: e.sourceHash,
          target_hash: e.targetHash,
          reported_by_entity_id: e.reportedByEntityId,
          incident_category: e.incidentCategory,
          timestamp: e.timestamp,
          is_false_positive: e.isFalsePositive,
          uploaded_fields: e.uploadedFields,
          upload_method: e.uploadMethod || 'MANUAL',
          entity_name: e.entityName,
          scope: e.scope || params.scope,
        }));
        promises.push(
          supabaseFetch('graph_edges', {
            method: 'POST',
            body: edgeRows,
            prefer: 'resolution=merge-duplicates',
          })
        );
      }

      // 2. Upsert nodos de identidad
      if (params.nodes.length > 0) {
        const nodeRows = params.nodes.map(n => ({
          id: n.hash,
          identifier_type: n.type,
          hash: n.hash,
          first_seen: n.firstSeen,
          last_seen: n.lastSeen,
          total_lookups: n.totalLookups,
          lookups_last_hour: n.lookupsLastHour,
          scope: params.scope,
          tenant_id: params.entityId,
        }));
        promises.push(
          supabaseFetch('identity_nodes', {
            method: 'POST',
            body: nodeRows,
            prefer: 'resolution=merge-duplicates',
          })
        );
      }

      // 3. Device-CUIT links si existen
      if (params.deviceCUITLinks.length > 0) {
        const linkRows = params.deviceCUITLinks.map(l => ({
          token_device: l.tokenDevice,
          token_cuit: l.tokenCuit,
          entity_id: l.entityId,
          timestamp: l.timestamp,
        }));
        promises.push(
          supabaseFetch('device_cuit_links', {
            method: 'POST',
            body: linkRows,
          })
        );
      }

      // 4. Registrar Audit Log
      promises.push(
        supabaseFetch('audit_logs', {
          method: 'POST',
          body: {
            timestamp: params.auditLog.timestamp,
            actor: params.auditLog.actor,
            action: params.auditLog.action,
            details: params.auditLog.details,
            scope: params.scope,
          },
        })
      );

      // 5. Incrementar contador en entidad
      promises.push(
        supabaseFetch(`fintech_entities?id=eq.${encodeURIComponent(params.entityId)}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: {
            // Se actualiza en background
            updated_at: new Date().toISOString(),
          },
        })
      );

      await Promise.all(promises);
      return true;
    } catch (err) {
      console.error('[SupabaseService] Error persistiendo fraude:', err);
      return false;
    }
  }

  /**
   * Persiste una consulta de riesgo (Lookup) y sus estadísticas
   */
  static async persistLookup(params: {
    nodes: IdentityNode[];
    entityId: string;
    auditLog: StoreAuditLog;
    scope: ServiceScope;
  }): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const promises: Promise<any>[] = [];

      // Upsert nodos consultados para actualizar total_lookups y last_seen
      if (params.nodes.length > 0) {
        const nodeRows = params.nodes.map(n => ({
          id: n.hash,
          identifier_type: n.type,
          hash: n.hash,
          first_seen: n.firstSeen,
          last_seen: n.lastSeen,
          total_lookups: n.totalLookups,
          lookups_last_hour: n.lookupsLastHour,
          scope: params.scope,
        }));
        promises.push(
          supabaseFetch('identity_nodes', {
            method: 'POST',
            body: nodeRows,
            prefer: 'resolution=merge-duplicates',
          })
        );
      }

      // Guardar log de auditoría
      promises.push(
        supabaseFetch('audit_logs', {
          method: 'POST',
          body: {
            timestamp: params.auditLog.timestamp,
            actor: params.auditLog.actor,
            action: params.auditLog.action,
            details: params.auditLog.details,
            scope: params.scope,
          },
        })
      );

      await Promise.all(promises);
      return true;
    } catch (err) {
      console.error('[SupabaseService] Error persistiendo lookup:', err);
      return false;
    }
  }

  /**
   * Marca una arista como Falso Positivo en la base de datos central
   */
  static async markFalsePositive(edgeId: string, entityId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const res = await supabaseFetch(`graph_edges?id=eq.${encodeURIComponent(edgeId)}`, {
        method: 'PATCH',
        body: { is_false_positive: true },
      });
      return !res.error;
    } catch {
      return false;
    }
  }

  /**
   * Actualiza el estado y resolución de una alerta de red
   */
  static async updateAlertStatus(
    alertId: string,
    status: string,
    resolution?: any
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const res = await supabaseFetch(`network_alerts?id=eq.${encodeURIComponent(alertId)}`, {
        method: 'PATCH',
        body: {
          status,
          resolution: resolution || null,
          last_activity_at: new Date().toISOString(),
        },
      });
      return !res.error;
    } catch {
      return false;
    }
  }

  /**
   * Registra una nueva entidad financiera en Supabase
   */
  static async persistFintech(entity: FintechEntity): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const res = await supabaseFetch('fintech_entities', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: {
          id: entity.id,
          name: entity.name,
          api_key: entity.apiKey,
          trust_weight: entity.trustWeight,
          status: entity.status,
          queries_count: entity.queriesCount,
          reports_count: entity.reportsCount,
          false_positives_count: entity.falsePositivesCount,
          updated_at: new Date().toISOString(),
        },
      });
      return !res.error;
    } catch {
      return false;
    }
  }

  /**
   * Actualiza el peso de confianza de una entidad en Supabase
   */
  static async updateTrustWeight(id: string, weight: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const res = await supabaseFetch(`fintech_entities?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: {
          trust_weight: weight,
          updated_at: new Date().toISOString(),
        },
      });
      return !res.error;
    } catch {
      return false;
    }
  }

  /**
   * Modifica el estado activo/suspendido de una entidad en Supabase
   */
  static async toggleFintechStatus(id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const res = await supabaseFetch(`fintech_entities?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: {
          status,
          updated_at: new Date().toISOString(),
        },
      });
      return !res.error;
    } catch {
      return false;
    }
  }

  /**
   * Persiste un registro de auditoría individual en Supabase
   */
  static async recordAuditLog(
    actor: string,
    action: string,
    details: string,
    scope: ServiceScope = 'CONSORTIUM'
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const res = await supabaseFetch('audit_logs', {
        method: 'POST',
        body: {
          timestamp: new Date().toISOString(),
          actor,
          action,
          details,
          scope,
        },
      });
      return !res.error;
    } catch {
      return false;
    }
  }
}
