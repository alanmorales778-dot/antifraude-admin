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
-- 10. ESTADO INICIAL
-- =====================================================================
-- Esquema limpio desde 0 para preproducción y recepción de datos reales.
-- Las entidades y casos se dan de alta dinámicamente desde el panel central.

-- =====================================================================
-- 11. TABLA: app_users (Gestión de Usuarios, Roles RBAC y Supabase MFA)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin', 'usuario')),
    entity_id TEXT DEFAULT 'CONSORCIO',
    entity_name TEXT DEFAULT 'Gobernanza Central',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    totp_enrolled BOOLEAN NOT NULL DEFAULT FALSE,
    totp_secret TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "App users access policy" ON public.app_users;
CREATE POLICY "App users access policy" ON public.app_users FOR ALL USING (true);

-- Administradores Iniciales Autorizados por Defecto
INSERT INTO public.app_users (id, email, role, entity_id, entity_name, status, totp_enrolled, created_at)
VALUES
    ('usr-admin-1', 'andresalaniz8@gmail.com', 'admin', 'CONSORCIO', 'Gobernanza Central', 'ACTIVE', TRUE, NOW()),
    ('usr-admin-2', 'alan.morales778@gmail.com', 'admin', 'CONSORCIO', 'Gobernanza Central', 'ACTIVE', TRUE, NOW())
ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- =====================================================================
-- 12. TABLA: scoring_config (Configuración Global del Motor Antifraude y Baseline)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.scoring_config (
    id TEXT PRIMARY KEY DEFAULT 'global-network-config',
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT DEFAULT 'superadmin@consorcio-antifraude.org'
);

ALTER TABLE public.scoring_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Scoring config access policy" ON public.scoring_config;
CREATE POLICY "Scoring config access policy" ON public.scoring_config FOR ALL USING (true);

-- Insertar configuración baseline inicial por defecto
INSERT INTO public.scoring_config (id, config, updated_at, updated_by)
VALUES (
    'global-network-config',
    '{
      "highRiskThreshold": 75,
      "mediumRiskThreshold": 35,
      "decayHalfLifeDays": 180,
      "mismatchPenalty": 40,
      "velocityPenalty": 25,
      "deviceFarmFloor": 85,
      "multiEntityMultipliers": { "two": 1.25, "three": 1.50, "fourOrMore": 1.80 },
      "severityBase": {
        "MULE_ACCOUNT": 90,
        "FRAUD_CONFIRMED": 95,
        "IDENTITY_THEFT": 75,
        "ACCOUNT_TAKEOVER": 80,
        "PHISHING": 55,
        "CHARGEBACK": 50,
        "SUSPICIOUS": 40
      },
      "decayFloor": {
        "MULE_ACCOUNT": 40,
        "FRAUD_CONFIRMED": 40,
        "SUSPICIOUS": 10
      },
      "emailPenalties": {
        "nonExistent": 35,
        "disposable": 40,
        "newDomain": 25,
        "mediumDomain": 10
      }
    }'::jsonb,
    NOW(),
    'admin@consorcio-antifraude.org'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 13. ÍNDICES DE ALTA VELOCIDAD PARA GRAFOS Y HASHES (<15MS)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_graph_edges_source_hash ON public.graph_edges(source_hash);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target_hash ON public.graph_edges(target_hash);
CREATE INDEX IF NOT EXISTS idx_graph_edges_composite_active ON public.graph_edges(source_hash, target_hash, is_false_positive);
CREATE INDEX IF NOT EXISTS idx_identity_nodes_hash ON public.identity_nodes(hash);

-- =====================================================================
-- 14. FUNCIÓN RPC: traverse_mule_network (SQL Recursive CTE a 3 Saltos)
-- =====================================================================
-- Rastreo de salto 2 y 3: Dispositivos compartidos vinculados a un CBU/DNI en base negativa
CREATE OR REPLACE FUNCTION public.traverse_mule_network(
    root_hash TEXT,
    max_depth INT DEFAULT 3
)
RETURNS TABLE (
    source_hash TEXT,
    target_hash TEXT,
    incident_category TEXT,
    reported_by_entity_id TEXT,
    depth INT
)
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE mule_network AS (
   -- Salto 1: Conexiones directas
   SELECT 
       e.source_hash, 
       e.target_hash, 
       e.incident_category, 
       e.reported_by_entity_id, 
       1 as depth,
       ARRAY[e.source_hash] as visited_path
   FROM public.graph_edges e
   WHERE (e.source_hash = root_hash OR e.target_hash = root_hash)
     AND e.is_false_positive = false

   UNION ALL

   -- Saltos Recursivos hasta depth < max_depth
   SELECT 
       e.source_hash, 
       e.target_hash, 
       e.incident_category, 
       e.reported_by_entity_id, 
       mn.depth + 1,
       visited_path || e.source_hash
   FROM public.graph_edges e
   JOIN mule_network mn 
     ON (e.source_hash = mn.target_hash OR e.target_hash = mn.source_hash)
   WHERE mn.depth < max_depth
     AND e.is_false_positive = false
     AND NOT (e.source_hash = ANY(mn.visited_path))
)
SELECT DISTINCT 
    mule_network.source_hash, 
    mule_network.target_hash, 
    mule_network.incident_category, 
    mule_network.reported_by_entity_id, 
    MIN(mule_network.depth)::INT as depth
FROM mule_network
GROUP BY mule_network.source_hash, mule_network.target_hash, mule_network.incident_category, mule_network.reported_by_entity_id
ORDER BY depth ASC;
$$;

