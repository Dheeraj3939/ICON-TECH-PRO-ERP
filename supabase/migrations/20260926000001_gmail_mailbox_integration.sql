-- ==============================================================================
-- ICON TECH PRO ERP - Migration 30: Gmail Mailbox Upgrade (gmail.modify)
-- Version: 20260926000001
-- Scope: Upgrade OAuth integration scope to gmail.modify & support mailbox threading
-- Entity: Strictly ICON TECH PRO (ORG-ICON-01) - Single Entity Only.
-- Safety: 100% Additive. ZERO DROP TABLE, ZERO DROP COLUMN, ZERO TRUNCATE.
-- ==============================================================================

BEGIN;

-- 1. Update default scope for new integration credentials to gmail.modify
ALTER TABLE IF EXISTS integration_credentials 
    ALTER COLUMN scopes SET DEFAULT '["https://www.googleapis.com/auth/gmail.modify"]'::jsonb;

-- 2. Add performance index on provider_thread_id in email_logs if not exists
CREATE INDEX IF NOT EXISTS idx_email_logs_provider_thread_id 
    ON email_logs(provider_thread_id);

-- 3. Add performance index on provider_message_id in email_logs if not exists
CREATE INDEX IF NOT EXISTS idx_email_logs_provider_message_id 
    ON email_logs(provider_message_id);

COMMIT;
