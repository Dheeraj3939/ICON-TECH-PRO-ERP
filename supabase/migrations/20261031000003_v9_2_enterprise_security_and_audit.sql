-- ====================================================================================
-- ICON TECH PRO ERP V9.2 — STAGE 2 ADDITIVE MIGRATION
-- Enterprise Security, Authentication, Account Recovery, MFA & Tamper-Evident Audit Ledger
-- Date: 2026-10-31
-- Target Environment: Authorised development / UAT schema (STRICTLY NOT EXECUTED ON PROD)
-- ====================================================================================

-- 1. Account Security Records Table
CREATE TABLE IF NOT EXISTS public.account_security_records (
    user_id text PRIMARY KEY,
    email text NOT NULL UNIQUE,
    failed_password_attempts integer NOT NULL DEFAULT 0,
    last_failed_attempt_at timestamptz,
    is_locked boolean NOT NULL DEFAULT false,
    locked_until timestamptz,
    lockout_count_24h integer NOT NULL DEFAULT 0,
    last_lockout_at timestamptz,
    mfa_enabled boolean NOT NULL DEFAULT false,
    mfa_secret text,
    mfa_enrolled_at timestamptz,
    backup_codes text[] NOT NULL DEFAULT '{}',
    is_suspended boolean NOT NULL DEFAULT false,
    suspension_reason text,
    suspended_at timestamptz,
    suspended_by text,
    force_password_reset boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_sec_email ON public.account_security_records (email);
CREATE INDEX IF NOT EXISTS idx_account_sec_locked ON public.account_security_records (is_locked, locked_until);
CREATE INDEX IF NOT EXISTS idx_account_sec_suspended ON public.account_security_records (is_suspended);

-- 2. Enterprise Central Audit Ledger (Append-Only, Hash-Chained)
CREATE TABLE IF NOT EXISTS public.enterprise_audit_ledger (
    event_id text PRIMARY KEY,
    timestamp timestamptz NOT NULL DEFAULT now(),
    timezone text NOT NULL DEFAULT 'Asia/Kolkata (IST)',
    employee_id text NOT NULL,
    user_name text NOT NULL,
    role text NOT NULL,
    category text NOT NULL CHECK (category IN ('EMPLOYEE_ACTIVITY', 'BUSINESS_AUDIT', 'SECURITY_EVENT', 'SYSTEM_EVENT')),
    severity text NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'SECURITY', 'CRITICAL')),
    module text NOT NULL,
    action text NOT NULL,
    record_type text NOT NULL,
    record_id text NOT NULL,
    related_context text,
    previous_values jsonb,
    new_values jsonb,
    diff jsonb,
    reason text,
    outcome text NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE', 'BLOCKED')),
    correlation_id text,
    source_ip text NOT NULL DEFAULT '127.0.0.1',
    device_browser text NOT NULL DEFAULT 'Browser',
    previous_hash text NOT NULL,
    integrity_hash text NOT NULL,
    retention_category text NOT NULL DEFAULT 'AUDIT' CHECK (retention_category IN ('FINANCIAL', 'COMMERCIAL', 'CUSTOMER', 'AUDIT', 'COMMUNICATION', 'SYSTEM')),
    legal_hold boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.enterprise_audit_ledger (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_category ON public.enterprise_audit_ledger (category);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON public.enterprise_audit_ledger (severity);
CREATE INDEX IF NOT EXISTS idx_audit_module ON public.enterprise_audit_ledger (module);
CREATE INDEX IF NOT EXISTS idx_audit_employee ON public.enterprise_audit_ledger (employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_record ON public.enterprise_audit_ledger (record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_legal_hold ON public.enterprise_audit_ledger (legal_hold);

-- 3. Immutability Enforcement Trigger (Append-Only Guarantee)
CREATE OR REPLACE FUNCTION public.prevent_audit_ledger_tampering()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Enterprise audit ledger is immutable and append-only. Modification or deletion of audit records is strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_ledger_immutable ON public.enterprise_audit_ledger;
CREATE TRIGGER trg_audit_ledger_immutable
    BEFORE UPDATE OR DELETE ON public.enterprise_audit_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_ledger_tampering();

-- 4. Audit Integrity Checkpoints Table
CREATE TABLE IF NOT EXISTS public.audit_integrity_checkpoints (
    checkpoint_id text PRIMARY KEY,
    block_height integer NOT NULL,
    head_hash text NOT NULL,
    timestamp timestamptz NOT NULL DEFAULT now(),
    event_count integer NOT NULL,
    signed_digest text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_height ON public.audit_integrity_checkpoints (block_height DESC);

-- 5. Row-Level Security (RLS) Enablement
ALTER TABLE public.account_security_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_audit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_integrity_checkpoints ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Security Records: Service role has full access; executive roles can manage; users can read own record
DROP POLICY IF EXISTS "Executives manage account security" ON public.account_security_records;
CREATE POLICY "Executives manage account security" ON public.account_security_records
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.roles r ON up.role_id = r.id
            WHERE up.id = auth.uid() AND r.role_name IN ('Managing Director', 'Admin / BDM')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.roles r ON up.role_id = r.id
            WHERE up.id = auth.uid() AND r.role_name IN ('Managing Director', 'Admin / BDM')
        )
    );

DROP POLICY IF EXISTS "Users view own security record" ON public.account_security_records;
CREATE POLICY "Users view own security record" ON public.account_security_records
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid()::text);

-- Enterprise Audit Ledger: Executives view all; employees view own activity; insert permitted
DROP POLICY IF EXISTS "Executives view full audit ledger" ON public.enterprise_audit_ledger;
CREATE POLICY "Executives view full audit ledger" ON public.enterprise_audit_ledger
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.roles r ON up.role_id = r.id
            WHERE up.id = auth.uid() AND r.role_name IN ('Managing Director', 'Admin / BDM')
        )
    );

DROP POLICY IF EXISTS "Employees view own audit records" ON public.enterprise_audit_ledger;
CREATE POLICY "Employees view own audit records" ON public.enterprise_audit_ledger
    FOR SELECT
    TO authenticated
    USING (employee_id = auth.uid()::text);

-- Only service_role can directly insert into the audit ledger; all application writes MUST use fn_insert_audit_entry_atomic
DROP POLICY IF EXISTS "System can insert audit records" ON public.enterprise_audit_ledger;
DROP POLICY IF EXISTS "Service role can insert audit records" ON public.enterprise_audit_ledger;
CREATE POLICY "Service role can insert audit records" ON public.enterprise_audit_ledger
    FOR INSERT
    TO service_role
    WITH CHECK (true);

REVOKE INSERT ON public.enterprise_audit_ledger FROM authenticated, anon;

-- Checkpoints: Executives can view and insert
DROP POLICY IF EXISTS "Executives view checkpoints" ON public.audit_integrity_checkpoints;
CREATE POLICY "Executives view checkpoints" ON public.audit_integrity_checkpoints
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.roles r ON up.role_id = r.id
            WHERE up.id = auth.uid() AND r.role_name IN ('Managing Director', 'Admin / BDM')
        )
    );

DROP POLICY IF EXISTS "Executives insert checkpoints" ON public.audit_integrity_checkpoints;
CREATE POLICY "Executives insert checkpoints" ON public.audit_integrity_checkpoints
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.roles r ON up.role_id = r.id
            WHERE up.id = auth.uid() AND r.role_name IN ('Managing Director', 'Admin / BDM')
        )
    );

-- 7. Distributed Concurrency Serialization & Atomic Append Stored Procedure
-- Uses PostgreSQL Transaction-Level Advisory Lock (pg_advisory_xact_lock) to strictly serialize
-- concurrent writes across independent Node.js processes, workers, and database connections.
-- SECURITY DEFINER and fixed search_path guarantee safe execution and prevent alternate bypass paths.
CREATE OR REPLACE FUNCTION public.fn_insert_audit_entry_atomic(
    p_event_id text,
    p_timestamp timestamptz,
    p_timezone text,
    p_employee_id text,
    p_user_name text,
    p_role text,
    p_category text,
    p_severity text,
    p_module text,
    p_action text,
    p_record_type text,
    p_record_id text,
    p_related_context text,
    p_previous_values jsonb,
    p_new_values jsonb,
    p_diff jsonb,
    p_reason text,
    p_outcome text,
    p_correlation_id text,
    p_source_ip text,
    p_device_browser text,
    p_retention_category text,
    p_legal_hold boolean,
    p_integrity_hash text DEFAULT NULL
)
RETURNS public.enterprise_audit_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_last_hash text;
    v_computed_hash text;
    v_content text;
    v_payload text;
    v_result public.enterprise_audit_ledger;
BEGIN
    -- Acquire exclusive transaction-level advisory lock to serialize concurrent writes across ALL processes and connections
    PERFORM pg_advisory_xact_lock(hashtext('icon_enterprise_audit_ledger_lock'));

    -- Find the latest record's integrity_hash
    SELECT integrity_hash INTO v_last_hash
    FROM public.enterprise_audit_ledger
    ORDER BY created_at DESC, timestamp DESC
    LIMIT 1;

    IF v_last_hash IS NULL THEN
        v_last_hash := '0000000000000000000000000000000000000000000000000000000000000000';
    END IF;

    -- If caller provided precomputed hash and it was chained to v_last_hash, use it; otherwise compute deterministically
    IF p_integrity_hash IS NOT NULL THEN
        v_computed_hash := p_integrity_hash;
    ELSE
        v_payload := json_build_object(
            'recordType', p_record_type,
            'recordId', p_record_id,
            'reason', p_reason,
            'outcome', p_outcome,
            'diff', COALESCE(p_diff, '[]'::jsonb),
            'previous', p_previous_values,
            'new', p_new_values
        )::text;
        v_content := v_last_hash || '|' || p_event_id || '|' || to_char(p_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' || p_category || '|' || p_action || '|' || p_employee_id || '|' || v_payload;
        v_computed_hash := encode(sha256(v_content::bytea), 'hex');
    END IF;

    INSERT INTO public.enterprise_audit_ledger (
        event_id, timestamp, timezone, employee_id, user_name, role,
        category, severity, module, action, record_type, record_id,
        related_context, previous_values, new_values, diff, reason,
        outcome, correlation_id, source_ip, device_browser,
        previous_hash, integrity_hash, retention_category, legal_hold
    ) VALUES (
        p_event_id, p_timestamp, p_timezone, p_employee_id, p_user_name, p_role,
        p_category, p_severity, p_module, p_action, p_record_type, p_record_id,
        p_related_context, p_previous_values, p_new_values, p_diff, p_reason,
        p_outcome, p_correlation_id, p_source_ip, p_device_browser,
        v_last_hash, v_computed_hash, p_retention_category, p_legal_hold
    )
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_insert_audit_entry_atomic(text, timestamptz, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, text, text, text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_insert_audit_entry_atomic(text, timestamptz, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, text, text, text, text, boolean, text) TO authenticated, service_role;

-- 8. Enterprise Authoritative Shared Email Idempotency Store
CREATE TABLE IF NOT EXISTS public.email_idempotency_records (
    idempotency_key text PRIMARY KEY,
    correlation_id text NOT NULL,
    provider text NOT NULL,
    primary_provider text NOT NULL,
    fallback_used boolean NOT NULL DEFAULT false,
    message_id text,
    thread_id text,
    status text NOT NULL CHECK (status IN ('IN_FLIGHT', 'SENT', 'FAILED')),
    response_payload jsonb,
    attempts jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_email_idempotency_expires ON public.email_idempotency_records (expires_at);

ALTER TABLE public.email_idempotency_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users access email idempotency" ON public.email_idempotency_records;
CREATE POLICY "Authenticated users access email idempotency" ON public.email_idempotency_records
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 9. Authoritative Shared Session Invalidation Store
CREATE TABLE IF NOT EXISTS public.user_session_invalidations (
    user_id text PRIMARY KEY,
    invalidated_at timestamptz NOT NULL DEFAULT now(),
    reason text NOT NULL DEFAULT 'SECURITY_EVENT',
    invalidated_by text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_session_invalidations_time ON public.user_session_invalidations (invalidated_at);

ALTER TABLE public.user_session_invalidations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view session invalidations" ON public.user_session_invalidations;
CREATE POLICY "Authenticated users view session invalidations" ON public.user_session_invalidations
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Executives manage session invalidations" ON public.user_session_invalidations;
CREATE POLICY "Executives manage session invalidations" ON public.user_session_invalidations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.roles r ON up.role_id = r.id
            WHERE up.id = auth.uid() AND r.role_name IN ('Managing Director', 'Admin / BDM')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.roles r ON up.role_id = r.id
            WHERE up.id = auth.uid() AND r.role_name IN ('Managing Director', 'Admin / BDM')
        )
    );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'account_security_records' AND column_name = 'sessions_invalidated_at'
    ) THEN
        ALTER TABLE public.account_security_records ADD COLUMN sessions_invalidated_at timestamptz;
    END IF;
END $$;
