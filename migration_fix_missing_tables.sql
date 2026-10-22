-- =====================================================================
-- MIGRACIÓN SUPABASE: TABLAS FALTANTES, RLS, RPC Y RECARGA DE SCHEMA
-- Proyecto: Consorcio Interbancario Antifraude (yaehffwiehzdzykrzuge)
-- =====================================================================

-- 1. EXTENSIONES BÁSICAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 2. TABLA: app_users (Usuarios de la plataforma, Roles RBAC y MFA)
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
CREATE POLICY "App users access policy" ON public.app_users FOR ALL USING (true) WITH CHECK (true);

-- Semilla de Administradores Autorizados Iniciales
INSERT INTO public.app_users (id, email, role, entity_id, entity_name, status, totp_enrolled, created_at)
VALUES
    ('usr-admin-1', 'andresalaniz8@gmail.com', 'admin', 'CONSORCIO', 'Gobernanza Central', 'ACTIVE', TRUE, NOW()),
    ('usr-admin-2', 'alan.morales778@gmail.com', 'admin', 'CONSORCIO', 'Gobernanza Central', 'ACTIVE', TRUE, NOW())
ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    totp_enrolled = EXCLUDED.totp_enrolled;

-- =====================================================================
-- 3. TABLA: scoring_config (Configuración y Baseline del Motor)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.scoring_config (
    id TEXT PRIMARY KEY,
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT DEFAULT 'superadmin@consorcio-antifraude.org'
);

ALTER TABLE public.scoring_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Scoring config access policy" ON public.scoring_config;
CREATE POLICY "Scoring config access policy" ON public.scoring_config FOR ALL USING (true) WITH CHECK (true);

-- Insertar configuración baseline requerida por el frontend (ID: consortium_baseline y global-network-config)
INSERT INTO public.scoring_config (id, config, updated_at, updated_by)
VALUES 
(
    'consortium_baseline',
    '{
      "highRiskThreshold": 75,
      "mediumRiskThreshold": 35,
      "criticalAlertThreshold": 60,
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
),
(
    'global-network-config',
    '{
      "highRiskThreshold": 75,
      "mediumRiskThreshold": 35,
      "criticalAlertThreshold": 60,
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
-- 4. FUNCIÓN RPC: traverse_mule_network (SQL Recursive CTE a 3 Saltos)
-- =====================================================================
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

-- =====================================================================
-- 5. PUBLICACIÓN REALTIME
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'app_users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_users;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'scoring_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scoring_config;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- =====================================================================
-- 6. RECARGA INMEDIATA DEL SCHEMA CACHE DE POSTGREST
-- =====================================================================
NOTIFY pgrst, 'reload schema';
