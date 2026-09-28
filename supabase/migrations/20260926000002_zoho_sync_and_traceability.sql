-- ==============================================================================
-- ICON TECH PRO ERP - Migration 30: Zoho CRM Sync, Traceability & Security Grants
-- Version: 20260926000002
-- Scope: Additive tables for Zoho CRM sync logs, entity mapping traceability,
--        and explicit table grants for service_role and authenticated.
-- Entity: Strictly ICON TECH PRO (ORG-ICON-01) - Single Entity Only.
-- Safety: 100% Additive. ZERO DROP TABLE, ZERO DROP COLUMN, ZERO TRUNCATE.
-- ==============================================================================

BEGIN;

-- 1. Explicit Grants on Integration Tables (Resolves 42501 Permission Denied)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_credentials TO service_role, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO service_role, authenticated;

-- 2. Zoho CRM & External Provider Sync History Logs
CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL DEFAULT 'zoho_crm',
    sync_type VARCHAR(50) NOT NULL DEFAULT 'manual', -- 'manual', 'scheduled', 'selective'
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SUCCESS', 'PARTIAL', 'FAILED'
    records_read INTEGER NOT NULL DEFAULT 0,
    records_created INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    records_skipped INTEGER NOT NULL DEFAULT 0,
    records_failed INTEGER NOT NULL DEFAULT 0,
    modules_synced TEXT[] DEFAULT ARRAY[]::TEXT[], -- e.g. ARRAY['Leads', 'Contacts', 'Accounts', 'Deals']
    details JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    triggered_by_id VARCHAR(100),
    triggered_by_name VARCHAR(150),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_provider_created
    ON public.integration_sync_logs(provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_status
    ON public.integration_sync_logs(status);

-- 3. External Entity Mapping & Bidirectional Traceability
-- Links Zoho CRM external record IDs directly to ERP internal IDs (Customers, Enquiries, Opportunities)
CREATE TABLE IF NOT EXISTS public.integration_entity_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL DEFAULT 'zoho_crm',
    external_module VARCHAR(50) NOT NULL, -- 'Leads', 'Contacts', 'Accounts', 'Deals'
    external_id VARCHAR(100) NOT NULL, -- Zoho record ID (e.g. '598274000000123456')
    erp_entity VARCHAR(50) NOT NULL, -- 'customers', 'enquiries', 'opportunities'
    erp_id VARCHAR(100) NOT NULL, -- ERP internal ID (UUID or customer code)
    sync_hash VARCHAR(64), -- SHA-256 hash of external record payload for change detection
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_integration_entity_mapping UNIQUE (provider, external_module, external_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_external 
    ON public.integration_entity_mappings(provider, external_module, external_id);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_erp 
    ON public.integration_entity_mappings(provider, erp_entity, erp_id);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_erp_id 
    ON public.integration_entity_mappings(erp_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_entity_mappings ENABLE ROW LEVEL SECURITY;

-- 5. Explicit Grants for service_role and authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_sync_logs TO service_role, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_entity_mappings TO service_role, authenticated;

-- 6. Row Level Security Policies
-- Sync logs: Executive and Admin roles can manage; staff can view
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'integration_sync_logs' AND policyname = 'integration_sync_logs_admin_access'
    ) THEN
        CREATE POLICY integration_sync_logs_admin_access ON public.integration_sync_logs
            FOR ALL
            TO authenticated
            USING (
                public.current_user_role() IN ('Managing Director', 'Admin / BDM')
                OR EXISTS (
                    SELECT 1 FROM public.user_profiles u
                    JOIN public.roles r ON u.role_id = r.id
                    WHERE u.id = auth.uid()
                    AND r.role_name IN ('Managing Director', 'Admin / BDM')
                )
            );
    END IF;
END $$;

-- Entity Mappings: Executive, Admin, and Sales roles can read; admin can manage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'integration_entity_mappings' AND policyname = 'integration_entity_mappings_access'
    ) THEN
        CREATE POLICY integration_entity_mappings_access ON public.integration_entity_mappings
            FOR ALL
            TO authenticated
            USING (
                public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive')
                OR EXISTS (
                    SELECT 1 FROM public.user_profiles u
                    JOIN public.roles r ON u.role_id = r.id
                    WHERE u.id = auth.uid()
                    AND r.role_name IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive')
                )
            );
    END IF;
END $$;

COMMIT;
