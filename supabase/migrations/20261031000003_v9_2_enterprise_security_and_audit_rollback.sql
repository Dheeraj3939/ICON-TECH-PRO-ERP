-- ====================================================================================
-- ICON TECH PRO ERP V9.2 — STAGE 2 ROLLBACK SCRIPT
-- Reverts 20261031000003_v9_2_enterprise_security_and_audit.sql
-- Date: 2026-10-31
-- Target Environment: Authorised development / UAT schema (STRICTLY NOT EXECUTED ON PROD)
-- ====================================================================================

-- 1. Drop RLS Policies
DROP POLICY IF EXISTS "Executives manage session invalidations" ON public.user_session_invalidations;
DROP POLICY IF EXISTS "Authenticated users view session invalidations" ON public.user_session_invalidations;
DROP POLICY IF EXISTS "Authenticated users access email idempotency" ON public.email_idempotency_records;
DROP POLICY IF EXISTS "Executives insert checkpoints" ON public.audit_integrity_checkpoints;
DROP POLICY IF EXISTS "Executives view checkpoints" ON public.audit_integrity_checkpoints;
DROP POLICY IF EXISTS "Service role can insert audit records" ON public.enterprise_audit_ledger;
DROP POLICY IF EXISTS "System can insert audit records" ON public.enterprise_audit_ledger;
DROP POLICY IF EXISTS "Employees view own audit records" ON public.enterprise_audit_ledger;
DROP POLICY IF EXISTS "Executives view full audit ledger" ON public.enterprise_audit_ledger;
DROP POLICY IF EXISTS "Users view own security record" ON public.account_security_records;
DROP POLICY IF EXISTS "Executives manage account security" ON public.account_security_records;

-- 2. Drop Immutability Trigger and Functions
DROP TRIGGER IF EXISTS trg_audit_ledger_immutable ON public.enterprise_audit_ledger;
DROP FUNCTION IF EXISTS public.prevent_audit_ledger_tampering();
DROP FUNCTION IF EXISTS public.fn_insert_audit_entry_atomic(text, timestamptz, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, text, text, text, text, boolean, text);

-- 3. Drop Tables
DROP TABLE IF EXISTS public.user_session_invalidations;
DROP TABLE IF EXISTS public.email_idempotency_records;
DROP TABLE IF EXISTS public.audit_integrity_checkpoints;
DROP TABLE IF EXISTS public.enterprise_audit_ledger;
DROP TABLE IF EXISTS public.account_security_records;
