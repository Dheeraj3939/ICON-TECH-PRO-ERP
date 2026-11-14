-- ==============================================================================
-- ICON TECH PRO ERP - Migration 38: Zoho Organization, Mail & Dynamic Mapping Architecture
-- Version: 20261006000001
-- Scope: Additive tables for Zoho Organization metadata, Zoho Mail Organization users,
--        Dynamic employee-to-mailbox mappings, sync schedule configurations,
--        and granular RLS policies.
-- Entity: Strictly ICON TECH PRO (ORG-ICON-01) - Single Entity Only.
-- Safety: 100% Additive. ZERO DROP TABLE, ZERO DROP COLUMN, ZERO TRUNCATE.
-- ==============================================================================

BEGIN;

-- 1. Zoho Organization Master Record
-- Stores tenant metadata, health telemetry, authorized identity, and domain configuration
CREATE TABLE IF NOT EXISTS public.zoho_organizations (
    id VARCHAR(100) PRIMARY KEY, -- 'ORG-ZOHO-01' or Zoho ZGID
    zoho_org_id VARCHAR(100) NOT NULL UNIQUE, -- Numeric/alphanumeric Zoho Org ID (e.g. '60012345678')
    org_name VARCHAR(200) NOT NULL DEFAULT 'ICON TECH PRO',
    domain_name VARCHAR(200) NOT NULL DEFAULT 'icontechpro.in',
    primary_admin_email VARCHAR(200) NOT NULL DEFAULT 'sales@icontechpro.in',
    authorized_by_user_id VARCHAR(100),
    authorized_by_name VARCHAR(150),
    connection_status VARCHAR(50) NOT NULL DEFAULT 'CONNECTED', -- 'CONNECTED', 'NOT_CONNECTED', 'DEGRADED', 'REAUTH_REQUIRED'
    health_status VARCHAR(50) NOT NULL DEFAULT 'HEALTHY', -- 'HEALTHY', 'WARNING', 'ERROR'
    mail_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    crm_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    active_mailboxes_count INTEGER NOT NULL DEFAULT 0,
    mapped_employees_count INTEGER NOT NULL DEFAULT 0,
    last_sync_at TIMESTAMPTZ,
    last_token_refresh_at TIMESTAMPTZ,
    last_error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_zoho_org_status 
    ON public.zoho_organizations(connection_status, health_status);

-- 2. Zoho Discovered Organization Mail Users
-- Raw representation of accounts returned from Zoho Mail Organization directory APIs
CREATE TABLE IF NOT EXISTS public.zoho_mail_users (
    id VARCHAR(100) PRIMARY KEY, -- Zoho ZUID (e.g. 'zuid_60012345')
    zoho_org_id VARCHAR(100) NOT NULL,
    email_address VARCHAR(200) NOT NULL,
    display_name VARCHAR(200),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'admin', 'member'
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'DISABLED', 'SUSPENDED'
    is_shared_mailbox BOOLEAN NOT NULL DEFAULT FALSE,
    mailbox_zuid VARCHAR(100),
    raw_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_zoho_mail_user_org_email UNIQUE (zoho_org_id, email_address)
);

CREATE INDEX IF NOT EXISTS idx_zoho_mail_users_email 
    ON public.zoho_mail_users(email_address);

CREATE INDEX IF NOT EXISTS idx_zoho_mail_users_status 
    ON public.zoho_mail_users(status);

-- 3. Dynamic Employee-to-Zoho Mailbox Mappings
-- Links ERP internal users (user_profiles) to Zoho Mail organization accounts
CREATE TABLE IF NOT EXISTS public.employee_zoho_mailbox_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(100) NOT NULL, -- Compatible with both UUIDs and string IDs like 'USR001'
    zoho_org_id VARCHAR(100) NOT NULL,
    zoho_user_id VARCHAR(100) NOT NULL, -- References zoho_mail_users(id)
    email_address VARCHAR(200) NOT NULL, -- Corporate email, e.g. 'dheeraj@icontechpro.in'
    mailbox_type VARCHAR(50) NOT NULL DEFAULT 'INDIVIDUAL', -- 'INDIVIDUAL' or 'SHARED'
    mailbox_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'DISABLED', 'SUSPENDED'
    mapping_status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED', -- 'CONFIRMED', 'PROPOSED', 'HUMAN_REVIEW_REQUIRED', 'DEACTIVATED'
    sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    last_synced_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_employee_zoho_mapping UNIQUE (zoho_org_id, email_address)
);

CREATE INDEX IF NOT EXISTS idx_emp_zoho_map_employee 
    ON public.employee_zoho_mailbox_mappings(employee_id);

CREATE INDEX IF NOT EXISTS idx_emp_zoho_map_email 
    ON public.employee_zoho_mailbox_mappings(email_address);

CREATE INDEX IF NOT EXISTS idx_emp_zoho_map_status 
    ON public.employee_zoho_mailbox_mappings(mapping_status, sync_enabled);

-- 4. Background Sync Schedules & Reconciliation Runs
CREATE TABLE IF NOT EXISTS public.zoho_sync_schedules (
    id VARCHAR(100) PRIMARY KEY, -- e.g. 'SCHED-ZOHO-MAIL-DAILY'
    integration_type VARCHAR(50) NOT NULL DEFAULT 'ZOHO_MAIL', -- 'ZOHO_MAIL', 'ZOHO_CRM', 'ZOHO_ORG'
    cron_expression VARCHAR(50) NOT NULL DEFAULT '0 */1 * * *', -- Hourly reconciliation
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(50) DEFAULT 'IDLE', -- 'IDLE', 'RUNNING', 'SUCCESS', 'FAILED'
    last_run_details JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Explicit Grants for service_role and authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoho_organizations TO service_role, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoho_mail_users TO service_role, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_zoho_mailbox_mappings TO service_role, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoho_sync_schedules TO service_role, authenticated;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.zoho_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_mail_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_zoho_mailbox_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_sync_schedules ENABLE ROW LEVEL SECURITY;

-- 7. Row Level Security Policies
-- Organization master: MD & Admin can manage; staff can view read-only
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'zoho_organizations' AND policyname = 'zoho_org_admin_manage'
    ) THEN
        CREATE POLICY zoho_org_admin_manage ON public.zoho_organizations
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

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'employee_zoho_mailbox_mappings' AND policyname = 'zoho_mappings_admin_manage'
    ) THEN
        CREATE POLICY zoho_mappings_admin_manage ON public.employee_zoho_mailbox_mappings
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

COMMIT;
