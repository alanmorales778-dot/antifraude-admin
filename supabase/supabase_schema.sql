-- =====================================================================
-- SANDBOX PREVENCIÓN FRAUDE & RED INTERBANCARIA (v2)
-- SCRIPT DDL SUPABASE POSTGRESQL + ROW LEVEL SECURITY (RLS) + REALTIME
-- =====================================================================
-- Este script crea todas las tablas, índices, políticas RLS y datos
-- semilla requeridos para el almacenamiento persistente y seguro con
-- arquitectura Zero-Knowledge (únicamente hashes SHA-256 + salt).
-- =====================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 2. TABLA: fintech_entities (Entidades Financieras / Participantes)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.fintech_entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    trust_weight NUMERIC(3,2) NOT NULL DEFAULT 0.70 CHECK (trust_weight >= 0.0 AND trust_weight <= 1.0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    queries_count INTEGER NOT NULL DEFAULT 0,
    reports_count INTEGER NOT NULL DEFAULT 0,
    false_positives_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 3. TABLA: identity_nodes (Nodos del Grafo de Identidad ZK)
-- =====================================================================
-- Almacena únicamente hashes normalizados con salting. Jamás PII en claro.
CREATE TABLE IF NOT EXISTS public.identity_nodes (
    id TEXT PRIMARY KEY, -- Hash o identificador único
    identifier_type TEXT NOT NULL CHECK (identifier_type IN ('DNI', 'EMAIL', 'PHONE', 'IP', 'CBU', 'CBU_CVU', 'TAX_ID', 'CARD_BIN', 'DEVICE', 'CUIT')),
    hash TEXT NOT NULL,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_lookups INTEGER NOT NULL DEFAULT 0,
    lookups_last_hour INTEGER NOT NULL DEFAULT 0,
    scope TEXT NOT NULL DEFAULT 'CONSORTIUM' CHECK (scope IN ('INTERNAL', 'CONSORTIUM')),
    tenant_id TEXT REFERENCES public.fintech_entities(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_nodes_hash ON public.identity_nodes(hash);
CREATE INDEX IF NOT EXISTS idx_identity_nodes_scope ON public.identity_nodes(scope);
CREATE INDEX IF NOT EXISTS idx_identity_nodes_tenant ON public.identity_nodes(tenant_id);

-- =====================================================================
-- 4. TABLA: graph_edges (Aristas del Grafo de Correlación de Fraude)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.graph_edges (
    id TEXT PRIMARY KEY,
    source_hash TEXT NOT NULL,
    target_hash TEXT NOT NULL,
    reported_by_entity_id TEXT NOT NULL REFERENCES public.fintech_entities(id) ON DELETE CASCADE,
    incident_category TEXT NOT NULL CHECK (incident_category IN (
        'MULE_ACCOUNT',
        'IDENTITY_THEFT',
        'CHARGEBACK',
        'PHISHING',
        'SUSPICIOUS',
        'FRAUD_CONFIRMED',
        'ACCOUNT_TAKEOVER'
    )),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_false_positive BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_fields TEXT,
    upload_method TEXT DEFAULT 'MANUAL' CHECK (upload_method IN ('MANUAL', 'CSV_BULK', 'API')),
    entity_name TEXT,
    scope TEXT NOT NULL DEFAULT 'CONSORTIUM' CHECK (scope IN ('INTERNAL', 'CONSORTIUM')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON public.graph_edges(source_hash);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON public.graph_edges(target_hash);
CREATE INDEX IF NOT EXISTS idx_graph_edges_reported_by ON public.graph_edges(reported_by_entity_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_scope ON public.graph_edges(scope);
CREATE INDEX IF NOT EXISTS idx_graph_edges_timestamp ON public.graph_edges(timestamp DESC);

-- =====================================================================
-- 5. TABLA: device_cuit_links (Detección de Device Farm)
-- =====================================================================
-- Correlaciona hashes de dispositivo con hashes de CUIT para detectar granjas (>=3 CUITs)
CREATE TABLE IF NOT EXISTS public.device_cuit_links (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    token_device TEXT NOT NULL,
    token_cuit TEXT NOT NULL,
    entity_id TEXT NOT NULL REFERENCES public.fintech_entities(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_cuit_links_device ON public.device_cuit_links(token_device);
CREATE INDEX IF NOT EXISTS idx_device_cuit_links_cuit ON public.device_cuit_links(token_cuit);
CREATE INDEX IF NOT EXISTS idx_device_cuit_links_timestamp ON public.device_cuit_links(timestamp DESC);

-- =====================================================================
-- 6. TABLA: network_alerts (Alertas Interbancarias e Internas)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.network_alerts (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'CONFIRMED', 'DISMISSED_FP')),
    entities_involved TEXT[] DEFAULT '{}',
    risk_score INTEGER NOT NULL DEFAULT 80 CHECK (risk_score >= 0 AND risk_score <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scope TEXT NOT NULL DEFAULT 'CONSORTIUM' CHECK (scope IN ('INTERNAL', 'CONSORTIUM')),
    resolution JSONB,
    created_by_entity_id TEXT REFERENCES public.fintech_entities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_network_alerts_status ON public.network_alerts(status);
CREATE INDEX IF NOT EXISTS idx_network_alerts_severity ON public.network_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_network_alerts_scope ON public.network_alerts(scope);
CREATE INDEX IF NOT EXISTS idx_network_alerts_created_at ON public.network_alerts(created_at DESC);

-- =====================================================================
-- 7. TABLA: audit_logs (Trazabilidad Inmutable para Cumplimiento)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'CONSORTIUM' CHECK (scope IN ('INTERNAL', 'CONSORTIUM'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_scope ON public.audit_logs(scope);

-- =====================================================================
-- 8. ROW LEVEL SECURITY (RLS) - AISLAMIENTO POR SERVICIO
-- =====================================================================
-- Habilitar RLS en todas las tablas
ALTER TABLE public.fintech_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_cuit_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura/escritura (para rol anon / authenticated en sandbox)
-- Políticas de lectura/escritura (para rol anon / authenticated en sandbox)
DROP POLICY IF EXISTS "Consortium entities read policy" ON public.fintech_entities;
CREATE POLICY "Consortium entities read policy" ON public.fintech_entities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Consortium entities write policy" ON public.fintech_entities;
CREATE POLICY "Consortium entities write policy" ON public.fintech_entities FOR ALL USING (true);

DROP POLICY IF EXISTS "Identity nodes access policy" ON public.identity_nodes;
CREATE POLICY "Identity nodes access policy" ON public.identity_nodes FOR ALL USING (true);

DROP POLICY IF EXISTS "Graph edges access policy" ON public.graph_edges;
CREATE POLICY "Graph edges access policy" ON public.graph_edges FOR ALL USING (true);

DROP POLICY IF EXISTS "Device CUIT links access policy" ON public.device_cuit_links;
CREATE POLICY "Device CUIT links access policy" ON public.device_cuit_links FOR ALL USING (true);

DROP POLICY IF EXISTS "Network alerts access policy" ON public.network_alerts;
CREATE POLICY "Network alerts access policy" ON public.network_alerts FOR ALL USING (true);

DROP POLICY IF EXISTS "Audit logs access policy" ON public.audit_logs;
CREATE POLICY "Audit logs access policy" ON public.audit_logs FOR ALL USING (true);

-- =====================================================================
-- 9. HABILITAR REALTIME (WebSockets para actualización inmediata en UI)
-- =====================================================================
DO $$
BEGIN
  -- Agregar tablas a la publicación de realtime si aún no están
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'network_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.network_alerts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'graph_edges'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.graph_edges;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'identity_nodes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.identity_nodes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Si realtime no está disponible, continuar sin fallar
END $$;

-- =====================================================================
-- 10. DATOS SEMILLA INICIALES
-- =====================================================================
INSERT INTO public.fintech_entities (id, name, api_key, trust_weight, status, queries_count, reports_count, false_positives_count)
VALUES
    ('fintech-alpha', 'Fintech Alpha', 'antf_live_alpha_a1b2c3d4e5f6', 1.00, 'ACTIVE', 142, 3, 0),
    ('banco-beta', 'Banco Beta', 'antf_live_beta_f6e5d4c3b2a1', 0.80, 'ACTIVE', 87, 1, 0),
    ('neobank-gamma', 'NeoBank Gamma', 'antf_live_gamma_9988776655', 0.90, 'ACTIVE', 54, 2, 0)
ON CONFLICT (id) DO UPDATE SET
    trust_weight = EXCLUDED.trust_weight,
    status = EXCLUDED.status;

-- Alerta Semilla Crítica
INSERT INTO public.network_alerts (id, code, title, category, severity, status, entities_involved, risk_score, created_at, scope)
VALUES
    ('alt-001', 'ALT-2026-9041', 'Triangulación Inmediata mediante Cuentas Mula Correlativas', 'MULE_ACCOUNT', 'CRITICAL', 'OPEN', ARRAY['Fintech Alpha', 'Banco Beta'], 96, NOW() - INTERVAL '15 minutes', 'CONSORTIUM'),
    ('alt-002', 'ALT-2026-8812', 'Dispositivo Compartido Detectado en Múltiples Solicitudes de Crédito', 'IDENTITY_THEFT', 'HIGH', 'IN_REVIEW', ARRAY['Fintech Alpha'], 82, NOW() - INTERVAL '2 hours', 'CONSORTIUM')
ON CONFLICT (id) DO NOTHING;

-- Log de auditoría inicial
INSERT INTO public.audit_logs (actor, action, details, scope)
VALUES
    ('Sistema Central', 'DB_INIT', 'Base de datos Supabase conectada e inicializada para el consorcio v2', 'CONSORTIUM')
ON CONFLICT DO NOTHING;
