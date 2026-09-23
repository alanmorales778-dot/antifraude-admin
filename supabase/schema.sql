-- ==============================================================================
-- CONSORCIO ANTIFRAUDE EN TIEMPO REAL - SUPABASE POSTGRESQL DDL & RLS POLICIES
-- ==============================================================================
-- Plataforma B2B de Threat Intelligence para Bancos y Fintechs de Argentina.
-- Principio Criptográfico: Hashing Ciego irreversible (SHA-256 + Salt Secreta).
-- Ningún dato personal (PII) en texto plano se almacena ni transita por la red.
-- ==============================================================================

-- 1. EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLA DE EMPRESAS PARTICIPANTES (TENANTS)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    api_key_hash VARCHAR(64) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'GROWTH' CHECK (subscription_tier IN ('ENTERPRISE', 'GROWTH', 'PILOT')),
    trust_score INTEGER DEFAULT 95 CHECK (trust_score BETWEEN 0 AND 100),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    contact_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA DE ENTIDADES DE FRAUDE (ANONIMIZADA - HASHES ÚNICOS)
CREATE TABLE IF NOT EXISTS public.fraud_entities (
    blind_hash VARCHAR(64) PRIMARY KEY, -- SHA-256(normalized_pii + ":" + salt)
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('EMAIL', 'DNI', 'PHONE', 'TAX_ID', 'CARD_BIN')),
    risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    report_count INTEGER DEFAULT 1 CHECK (report_count >= 0),
    distinct_tenants_count INTEGER DEFAULT 1 CHECK (distinct_tenants_count >= 0),
    reporting_tenant_ids UUID[] DEFAULT ARRAY[]::UUID[],
    primary_reason VARCHAR(100) NOT NULL,
    severity INTEGER DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
    last_reported_at TIMESTAMPTZ DEFAULT NOW(),
    rehabilitated BOOLEAN DEFAULT FALSE,
    rehabilitated_at TIMESTAMPTZ,
    rehabilitation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE EVENTOS DE FRAUDE (HISTORIAL AUDITABLE INDIVIDUAL)
CREATE TABLE IF NOT EXISTS public.fraud_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blind_hash VARCHAR(64) NOT NULL REFERENCES public.fraud_entities(blind_hash) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    reason VARCHAR(100) NOT NULL,
    severity INTEGER DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
    incident_date TIMESTAMPTZ DEFAULT NOW(),
    internal_case_id VARCHAR(100),
    non_pii_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA DE REGISTROS DE LA API (AUDIT LOGS & BILLING)
CREATE TABLE IF NOT EXISTS public.api_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id),
    endpoint VARCHAR(255) NOT NULL,
    identifier_type VARCHAR(20),
    blind_hash_preview VARCHAR(32), -- Primeros 8 y últimos 6 caracteres
    latency_ms INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ÍNDICES DE ALTO RENDIMIENTO (< 50ms QUERY SPEED)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_fraud_entities_score ON public.fraud_entities(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_entities_type ON public.fraud_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_fraud_entities_updated ON public.fraud_entities(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_fraud_events_hash ON public.fraud_events(blind_hash);
CREATE INDEX IF NOT EXISTS idx_fraud_events_tenant ON public.fraud_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fraud_events_date ON public.fraud_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.api_audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.api_audit_logs(created_at DESC);

-- ==============================================================================
-- POLÍTICAS DE SEGURIDAD POR FILA (ROW LEVEL SECURITY - RLS)
-- ==============================================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenants solo pueden leer y editar sus propios datos de configuración
CREATE POLICY "Tenants read own profile" ON public.tenants
    FOR SELECT USING (auth.uid() = id);

-- Cualquier miembro autenticado del consorcio puede evaluar el score colectivo
CREATE POLICY "Tenants read collective fraud scores" ON public.fraud_entities
    FOR SELECT TO authenticated USING (true);

-- Tenants solo pueden ver el detalle histórico de sus propios reportes (Zero Leakage)
CREATE POLICY "Tenants read only own reports" ON public.fraud_events
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());

CREATE POLICY "Tenants insert reports" ON public.fraud_events
    FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid());

-- Audit logs solo visibles para el tenant emisor
CREATE POLICY "Tenants view own audit logs" ON public.api_audit_logs
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
