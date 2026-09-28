-- ==============================================================================
-- ICON TECH PRO ERP - Migration 33: Document Center, AMC Intelligence & Notifications
-- Version: 20260928000002
-- Scope: Additive tables for:
--        1. enterprise_documents (Private Document Center with Expiry & Attachments)
--        2. amc_opportunities (AMC Intelligence & Proactive Expiry Automation)
--        3. enterprise_notifications (Centralized Role-Based Notifications Engine)
-- Entity: Strictly ICON TECH PRO (ORG-ICON-01) - Single Entity Only.
-- Safety: 100% Additive. ZERO DROP TABLE, ZERO DROP COLUMN, ZERO TRUNCATE.
-- ==============================================================================

BEGIN;

-- 1. Private Enterprise Document Center Table
CREATE TABLE IF NOT EXISTS public.enterprise_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'COMMERCIAL',
    folder_path VARCHAR(255) NOT NULL DEFAULT '/',
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    entity_name VARCHAR(200),
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    sensitivity VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    expiry_date DATE,
    version INT NOT NULL DEFAULT 1,
    previous_version_id UUID REFERENCES public.enterprise_documents(id),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    uploaded_by_id VARCHAR(100),
    uploaded_by_name VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_enterprise_docs_entity 
    ON public.enterprise_documents(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_docs_expiry 
    ON public.enterprise_documents(expiry_date);

CREATE INDEX IF NOT EXISTS idx_enterprise_docs_category 
    ON public.enterprise_documents(category);

CREATE INDEX IF NOT EXISTS idx_enterprise_docs_sensitivity 
    ON public.enterprise_documents(sensitivity);

-- 2. AMC Intelligence & Automation Opportunities Table
CREATE TABLE IF NOT EXISTS public.amc_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    company_name VARCHAR(200),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(100),
    source_contract_id VARCHAR(100),
    source_contract_number VARCHAR(100),
    source_service_ticket_id VARCHAR(100),
    source_invoice_id VARCHAR(100),
    opportunity_type VARCHAR(50) NOT NULL DEFAULT 'RENEWAL',
    expiry_date DATE,
    days_until_expiry INT DEFAULT 0,
    target_annual_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    recommended_package VARCHAR(50) NOT NULL DEFAULT 'COMPREHENSIVE',
    responsible_employee_name VARCHAR(150) NOT NULL DEFAULT 'Borra Narsimulu',
    status VARCHAR(40) NOT NULL DEFAULT 'IDENTIFIED',
    ai_recommendation TEXT,
    draft_message TEXT,
    draft_channel VARCHAR(30) NOT NULL DEFAULT 'WHATSAPP',
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by_name VARCHAR(150),
    approved_at TIMESTAMPTZ,
    outreach_sent_at TIMESTAMPTZ,
    last_follow_up_at TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_amc_opps_status 
    ON public.amc_opportunities(status);

CREATE INDEX IF NOT EXISTS idx_amc_opps_customer 
    ON public.amc_opportunities(customer_id);

CREATE INDEX IF NOT EXISTS idx_amc_opps_expiry 
    ON public.amc_opportunities(expiry_date);

-- 3. Centralized Enterprise Notifications Table
CREATE TABLE IF NOT EXISTS public.enterprise_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_role VARCHAR(50),
    user_id VARCHAR(100),
    category VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    action_url VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_role_read 
    ON public.enterprise_notifications(user_role, is_read, created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.enterprise_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_notifications ENABLE ROW LEVEL SECURITY;

-- 5. Explicit Grants for service_role and authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_documents TO service_role, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.amc_opportunities TO service_role, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_notifications TO service_role, authenticated;

-- 6. RLS Policies
-- Documents: Field/sensitivity level protection
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'enterprise_documents' AND policyname = 'enterprise_documents_access_policy'
    ) THEN
        CREATE POLICY enterprise_documents_access_policy ON public.enterprise_documents
            FOR ALL
            TO authenticated
            USING (
                -- Executive roles can see all documents
                public.current_user_role() IN ('Managing Director', 'Admin / BDM')
                OR (
                    -- Accounts can see normal, commercial, financial, and confidential
                    public.current_user_role() = 'Accounts'
                    AND sensitivity IN ('NORMAL', 'CONFIDENTIAL')
                )
                OR (
                    -- Sales / BDM / Assistant can see normal documents
                    public.current_user_role() IN ('BDM', 'Sales Executive', 'Office Assistant')
                    AND sensitivity = 'NORMAL'
                )
                OR EXISTS (
                    SELECT 1 FROM public.user_profiles u
                    JOIN public.roles r ON u.role_id = r.id
                    WHERE u.id = auth.uid()
                    AND r.role_name IN ('Managing Director', 'Admin / BDM')
                )
            );
    END IF;
END $$;

-- AMC Opportunities: Management and sales access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'amc_opportunities' AND policyname = 'amc_opportunities_access_policy'
    ) THEN
        CREATE POLICY amc_opportunities_access_policy ON public.amc_opportunities
            FOR ALL
            TO authenticated
            USING (
                public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
                OR EXISTS (
                    SELECT 1 FROM public.user_profiles u
                    JOIN public.roles r ON u.role_id = r.id
                    WHERE u.id = auth.uid()
                    AND r.role_name IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
                )
            );
    END IF;
END $$;

-- Notifications: User/Role targeted
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'enterprise_notifications' AND policyname = 'notifications_access_policy'
    ) THEN
        CREATE POLICY notifications_access_policy ON public.enterprise_notifications
            FOR ALL
            TO authenticated
            USING (
                user_role IS NULL
                OR user_role = public.current_user_role()
                OR user_id = auth.uid()::text
                OR public.current_user_role() IN ('Managing Director', 'Admin / BDM')
            );
    END IF;
END $$;

COMMIT;
