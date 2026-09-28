-- ============================================================================
-- ICON TECH PRO ERP V8 — Phase N: Executive Reporting & AI Briefings
-- Migration: 20260919000022_v8_executive_reporting.sql
-- 100% Additive: Tables and indexes for executive briefings and 5 reporting schedules
-- ============================================================================

CREATE TABLE IF NOT EXISTS executive_briefings (
  id TEXT PRIMARY KEY,
  schedule TEXT NOT NULL CHECK (schedule IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL')),
  report_type TEXT NOT NULL CHECK (report_type IN ('SALES_PIPELINE', 'FINANCIAL_SUMMARY', 'OPERATIONS_DISPATCH', 'COLLECTIONS_AGING', 'EXECUTIVE_STRATEGY')),
  title TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  summary_headline TEXT NOT NULL,
  key_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks_and_alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_by TEXT NOT NULL DEFAULT 'SYSTEM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executive_briefings_schedule 
  ON executive_briefings(schedule);

CREATE INDEX IF NOT EXISTS idx_executive_briefings_report_type 
  ON executive_briefings(report_type);

CREATE INDEX IF NOT EXISTS idx_executive_briefings_created_at 
  ON executive_briefings(created_at DESC);

-- Schedule configuration for automated executive briefings
CREATE TABLE IF NOT EXISTS executive_schedule_configs (
  id TEXT PRIMARY KEY,
  schedule TEXT NOT NULL UNIQUE CHECK (schedule IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL')),
  cron_expression TEXT,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  channels JSONB NOT NULL DEFAULT '["IN_APP"]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default schedule configurations for all 5 schedules
INSERT INTO executive_schedule_configs (id, schedule, cron_expression, recipients, channels, is_active)
VALUES 
  ('sched-daily', 'DAILY', '0 8 * * *', '["Managing Director", "Admin / BDM"]'::jsonb, '["IN_APP", "EMAIL"]'::jsonb, TRUE),
  ('sched-weekly', 'WEEKLY', '0 9 * * 1', '["Managing Director", "Admin / BDM", "BDM"]'::jsonb, '["IN_APP", "EMAIL"]'::jsonb, TRUE),
  ('sched-monthly', 'MONTHLY', '0 9 1 * *', '["Managing Director", "Admin / BDM", "Accounts"]'::jsonb, '["IN_APP", "EMAIL"]'::jsonb, TRUE),
  ('sched-quarterly', 'QUARTERLY', '0 10 1 1,4,7,10 *', '["Managing Director", "Admin / BDM"]'::jsonb, '["IN_APP", "EMAIL"]'::jsonb, TRUE),
  ('sched-annual', 'ANNUAL', '0 10 1 4 *', '["Managing Director"]'::jsonb, '["IN_APP", "EMAIL"]'::jsonb, TRUE)
ON CONFLICT (schedule) DO NOTHING;
