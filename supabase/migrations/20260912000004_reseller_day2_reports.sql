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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_definitions' AND policyname = 'Authenticated users can view reports'
  ) THEN
    CREATE POLICY "Authenticated users can view reports"
      ON public.report_definitions FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_definitions' AND policyname = 'Authenticated users can create custom reports'
  ) THEN
    CREATE POLICY "Authenticated users can create custom reports"
      ON public.report_definitions FOR INSERT
      TO authenticated
      WITH CHECK (TRUE);
  END IF;
END $$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_subscriptions' AND policyname = 'Users can manage own subscriptions'
  ) THEN
    CREATE POLICY "Users can manage own subscriptions"
      ON public.report_subscriptions FOR ALL
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_subscriptions' AND policyname = 'Admins can view all subscriptions'
  ) THEN
    CREATE POLICY "Admins can view all subscriptions"
      ON public.report_subscriptions FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          JOIN public.roles r ON up.role_id = r.id
          WHERE up.id = auth.uid()
            AND r.name IN ('Managing Director', 'Admin / BDM')
        )
      );
  END IF;
END $$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_delivery_logs' AND policyname = 'Authenticated users can view delivery logs'
  ) THEN
    CREATE POLICY "Authenticated users can view delivery logs"
      ON public.report_delivery_logs FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;
END $$;

GRANT SELECT, INSERT ON public.report_delivery_logs TO authenticated;

COMMIT;
