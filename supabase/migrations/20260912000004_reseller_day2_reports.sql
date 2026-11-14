-- ==============================================================================
-- ICON TECH PRO ERP - Migration 08: Reseller Day 2 Reporting & Intelligence
-- Version: 20260912000004
-- Scope:
--   1. report_definitions: Stored standard and custom report queries
--   2. report_subscriptions: Automated recurring email/whatsapp report delivery
--   3. report_delivery_logs: Immutable delivery audit records
-- Safety: Additive only. Zero DROP TABLE, zero TRUNCATE, zero data loss.
-- DO NOT execute automatically on production without explicit approval.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Report Definitions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  description TEXT,
  data_source VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'CUSTOM',
  selected_fields JSONB NOT NULL DEFAULT '[]',
  group_by_field VARCHAR(100),
  calculation VARCHAR(30),
  calculation_field VARCHAR(100),
  filters JSONB NOT NULL DEFAULT '[]',
  is_company_report BOOLEAN NOT NULL DEFAULT FALSE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpt_def_category ON public.report_definitions(category);
CREATE INDEX IF NOT EXISTS idx_rpt_def_source ON public.report_definitions(data_source);

ALTER TABLE public.report_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view reports" ON public.report_definitions;
DROP POLICY IF EXISTS "Authenticated users can create custom reports" ON public.report_definitions;
DROP POLICY IF EXISTS "Authorized managers can create company reports" ON public.report_definitions;
DROP POLICY IF EXISTS "Report owners and managers can update reports" ON public.report_definitions;

CREATE POLICY "Authenticated users can view reports"
  ON public.report_definitions FOR SELECT TO authenticated
  USING (
    public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant')
    AND (is_company_report OR created_by_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create custom reports"
  ON public.report_definitions FOR INSERT TO authenticated
  WITH CHECK (
    public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts')
    AND created_by_id = auth.uid()
    AND is_company_report = FALSE
  );

CREATE POLICY "Authorized managers can create company reports"
  ON public.report_definitions FOR INSERT TO authenticated
  WITH CHECK (
    public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM')
    AND created_by_id = auth.uid()
    AND is_company_report = TRUE
  );

CREATE POLICY "Report owners and managers can update reports"
  ON public.report_definitions FOR UPDATE TO authenticated
  USING (
    created_by_id = auth.uid()
    OR public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM')
  )
  WITH CHECK (
    created_by_id = auth.uid()
    OR public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM')
  );

REVOKE ALL ON public.report_definitions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.report_definitions TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. Report Subscriptions (Recurring Email & WhatsApp Delivery)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.report_definitions(id) ON DELETE CASCADE,
  report_title VARCHAR(150) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name VARCHAR(120) NOT NULL,
  recipient_target VARCHAR(150) NOT NULL,
  frequency VARCHAR(30) NOT NULL DEFAULT 'WEEKLY',
  channel VARCHAR(30) NOT NULL DEFAULT 'EMAIL',
  include_ai_summary BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpt_sub_user ON public.report_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_rpt_sub_next_run ON public.report_subscriptions(next_run_at) WHERE is_active = TRUE;

ALTER TABLE public.report_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.report_subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.report_subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON public.report_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Administrators can view all subscriptions"
  ON public.report_subscriptions FOR SELECT TO authenticated
  USING (public.current_erp_role() IN ('Managing Director', 'Admin / BDM'));
CREATE POLICY "Users can create own subscriptions"
  ON public.report_subscriptions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant')
  );
CREATE POLICY "Users can update own subscriptions"
  ON public.report_subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own subscriptions"
  ON public.report_subscriptions FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant')
  );

REVOKE ALL ON public.report_subscriptions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_subscriptions TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Report Delivery Logs (Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.report_subscriptions(id) ON DELETE SET NULL,
  report_id UUID REFERENCES public.report_definitions(id) ON DELETE SET NULL,
  report_title VARCHAR(150) NOT NULL,
  recipient VARCHAR(150) NOT NULL,
  channel VARCHAR(30) NOT NULL,
  outbox_message_id UUID REFERENCES public.communication_outbox(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
  error_details TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.report_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view delivery logs" ON public.report_delivery_logs;
CREATE POLICY "Finance and administrators can view delivery logs"
  ON public.report_delivery_logs FOR SELECT TO authenticated
  USING (public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));

REVOKE ALL ON public.report_delivery_logs FROM PUBLIC, anon;
GRANT SELECT ON public.report_delivery_logs TO authenticated;

COMMIT;
