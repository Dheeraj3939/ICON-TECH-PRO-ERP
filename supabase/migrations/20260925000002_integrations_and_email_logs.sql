-- ==============================================================================
-- ICON TECH PRO ERP - Migration 29: Integrations & Email Activity Logging
-- Version: 20260925000002
-- Scope: Encrypted OAuth Integration Credentials Storage & Comprehensive Email Logs
-- Entity: Strictly ICON TECH PRO (ORG-ICON-01) - Single Entity Only.
-- Safety: 100% Additive. ZERO DROP TABLE, ZERO DROP COLUMN, ZERO TRUNCATE.
-- ==============================================================================

BEGIN;

-- 1. OAuth & External Integration Credentials Store
-- Secure, AES-256 encrypted storage for external service tokens (Gmail, WhatsApp, etc.)
CREATE TABLE IF NOT EXISTS integration_credentials (
    id VARCHAR(100) PRIMARY KEY, -- e.g. 'gmail_icontechpro'
    provider VARCHAR(50) NOT NULL, -- 'gmail', 'whatsapp', 'msg91'
    account_identifier VARCHAR(150) NOT NULL, -- 'icontechpro@gmail.com'
    encrypted_refresh_token TEXT NOT NULL,
    encrypted_access_token TEXT,
    token_expires_at TIMESTAMPTZ,
    scopes JSONB NOT NULL DEFAULT '["https://www.googleapis.com/auth/gmail.send"]'::jsonb,
    iv VARCHAR(64) NOT NULL,
    tag VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED', 'EXPIRED'
    connected_by_id VARCHAR(100),
    connected_by_name VARCHAR(150),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick provider lookups
CREATE INDEX IF NOT EXISTS idx_integration_creds_provider 
    ON integration_credentials(provider, account_identifier);

-- 2. Email Activity & Audit Log Table
-- Tracks every email sent from the ERP with full enterprise context & attachment metadata
CREATE TABLE IF NOT EXISTS email_logs (
    id VARCHAR(100) PRIMARY KEY, -- 'EML-YYYYMMDD-XXXXX'
    provider VARCHAR(50) NOT NULL DEFAULT 'gmail',
    from_email VARCHAR(150) NOT NULL DEFAULT 'icontechpro@gmail.com',
    to_email TEXT NOT NULL,
    cc_email TEXT,
    bcc_email TEXT,
    subject TEXT NOT NULL,
    has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
    attachment_count INTEGER NOT NULL DEFAULT 0,
    attachment_names JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'SENT', -- 'SENT', 'FAILED', 'QUEUED'
    provider_message_id VARCHAR(150),
    provider_thread_id VARCHAR(150),
    error_message TEXT,
    sent_by_user_id VARCHAR(100),
    sent_by_user_name VARCHAR(150),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(150),
    enquiry_id VARCHAR(100),
    quotation_id VARCHAR(100),
    invoice_id VARCHAR(100),
    entity_type VARCHAR(50), -- 'customer', 'quotation', 'invoice', 'test', 'general'
    entity_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & entity relationship lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_entity 
    ON email_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_customer 
    ON email_logs(customer_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_quotation 
    ON email_logs(quotation_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_invoice 
    ON email_logs(invoice_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at 
    ON email_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_status 
    ON email_logs(status);

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Integration Credentials Policies: Admin & MD restricted only
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'integration_credentials' AND policyname = 'integration_creds_admin_access'
    ) THEN
        CREATE POLICY integration_creds_admin_access ON integration_credentials
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

-- Email Logs Policies: Viewable by staff, Insertable on email dispatch
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'email_logs' AND policyname = 'email_logs_read_access'
    ) THEN
        CREATE POLICY email_logs_read_access ON email_logs
            FOR SELECT
            TO authenticated
            USING (TRUE);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'email_logs' AND policyname = 'email_logs_insert_access'
    ) THEN
        CREATE POLICY email_logs_insert_access ON email_logs
            FOR INSERT
            TO authenticated
            WITH CHECK (TRUE);
    END IF;
END $$;

COMMIT;
