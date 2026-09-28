-- ============================================================================
-- MIGRATION: 20260913000006_reseller_day45_finance_ai.sql
-- DESCRIPTION: Day 4 & Day 5 Schema Extensions for ICON TECH PRO ERP
-- INCLUDES:
--   1. Payment Allocations & Advances
--   2. Credit Notes & Debit Notes
--   3. Promises to Pay (PTP)
--   4. E-Invoice (IRN) & E-Way Bill Records
--   5. TallyPrime Reconciliation Engine
--   6. 15-Agent AI Architecture & Voice Sessions
--   7. Data Quality Issues & Business Risk Radar
--   8. Customer Opportunities & Workflow Automation Rules
--   9. Document Sequences for Credit/Debit Notes & Challans
--
-- STRICT INVARIANTS:
--   - Non-destructive, additive only (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS)
--   - Idempotent and versioned
--   - Full RLS enabled on all new tables
--   - DO NOT EXECUTE AUTOMATICALLY AGAINST PRODUCTION DATABASE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PAYMENT ALLOCATIONS (Multi-invoice payment mapping)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  payment_number VARCHAR(64) NOT NULL,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(64) NOT NULL,
  allocated_amount DECIMAL(14, 2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_alloc_payment_id ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_alloc_invoice_id ON payment_allocations(invoice_id);

-- ----------------------------------------------------------------------------
-- 2. CREDIT NOTES (Customer adjustments, returns, commercial discounts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number VARCHAR(64) UNIQUE NOT NULL,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(64) NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  customer_name VARCHAR(255) NOT NULL,
  total_amount DECIMAL(14, 2) NOT NULL CHECK (total_amount > 0),
  cgst_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  sgst_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  igst_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'VOID', 'CANCELLED')),
  created_by_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_customer_id ON credit_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id ON credit_notes(invoice_id);

-- ----------------------------------------------------------------------------
-- 3. DEBIT NOTES (Supplier cost adjustments, RMA, price discrepancies)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS debit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debit_note_number VARCHAR(64) UNIQUE NOT NULL,
  supplier_invoice_id VARCHAR(64) NOT NULL,
  supplier_invoice_number VARCHAR(64) NOT NULL,
  supplier_id VARCHAR(64) NOT NULL,
  supplier_name VARCHAR(255) NOT NULL,
  total_amount DECIMAL(14, 2) NOT NULL CHECK (total_amount > 0),
  cgst_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  sgst_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  igst_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'VOID', 'CANCELLED')),
  created_by_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debit_notes_supplier_id ON debit_notes(supplier_id);

-- ----------------------------------------------------------------------------
-- 4. PROMISES TO PAY (Collections Tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promises_to_pay (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(64) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  promised_amount DECIMAL(14, 2) NOT NULL CHECK (promised_amount > 0),
  promised_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'HONOURED', 'BROKEN')),
  notes TEXT,
  recorded_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ptp_customer_id ON promises_to_pay(customer_id);
CREATE INDEX IF NOT EXISTS idx_ptp_promised_date ON promises_to_pay(promised_date);

-- ----------------------------------------------------------------------------
-- 5. E-INVOICE & E-WAY BILL RECORDS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS einvoice_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id VARCHAR(64) NOT NULL,
  invoice_number VARCHAR(64) NOT NULL,
  irn VARCHAR(64),
  ack_number VARCHAR(32),
  ack_date TIMESTAMPTZ,
  signed_invoice TEXT,
  signed_qr_data TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'READY' CHECK (status IN ('NOT_CONFIGURED', 'READY', 'SUBMITTED', 'SUCCESS', 'FAILED', 'CANCELLED')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_einvoice_invoice_id ON einvoice_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_einvoice_irn ON einvoice_records(irn);

CREATE TABLE IF NOT EXISTS ewaybill_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id VARCHAR(64) NOT NULL,
  invoice_number VARCHAR(64) NOT NULL,
  ewb_number VARCHAR(32),
  valid_until TIMESTAMPTZ,
  transporter_id VARCHAR(64),
  transporter_name VARCHAR(255),
  vehicle_number VARCHAR(32),
  distance_km INTEGER,
  status VARCHAR(32) NOT NULL DEFAULT 'READY' CHECK (status IN ('NOT_CONFIGURED', 'READY', 'GENERATED', 'REJECTED', 'CANCELLED')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ewaybill_invoice_id ON ewaybill_records(invoice_id);

-- ----------------------------------------------------------------------------
-- 6. TALLY RECONCILIATION ITEMS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tally_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(32) NOT NULL CHECK (entity_type IN ('INVOICE', 'PAYMENT', 'PURCHASE_INVOICE', 'CUSTOMER')),
  erp_id VARCHAR(64) NOT NULL,
  erp_number VARCHAR(64) NOT NULL,
  erp_amount DECIMAL(14, 2) NOT NULL,
  erp_date DATE NOT NULL,
  tally_guid VARCHAR(128),
  tally_voucher_number VARCHAR(64),
  tally_amount DECIMAL(14, 2),
  tally_date DATE,
  recon_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (recon_status IN ('MATCHED', 'ERP_ONLY', 'TALLY_ONLY', 'VALUE_MISMATCH', 'DATE_MISMATCH', 'PARTIAL', 'PENDING')),
  difference_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tally_recon_erp_id ON tally_reconciliations(erp_id);
CREATE INDEX IF NOT EXISTS idx_tally_recon_status ON tally_reconciliations(recon_status);

-- ----------------------------------------------------------------------------
-- 7. 15-AGENT AI SESSIONS & VOICE SESSIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_role VARCHAR(64) NOT NULL,
  agent_type VARCHAR(64) NOT NULL,
  preferred_language VARCHAR(16) NOT NULL DEFAULT 'en',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_user ON ai_agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_type ON ai_agent_sessions(agent_type);

CREATE TABLE IF NOT EXISTS voice_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_phone VARCHAR(32) NOT NULL,
  direction VARCHAR(16) NOT NULL DEFAULT 'INBOUND' CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  language VARCHAR(16) NOT NULL DEFAULT 'en',
  status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('INITIATED', 'IN_PROGRESS', 'COMPLETED', 'TRANSFERRED_TO_HUMAN', 'FAILED')),
  identified_customer_id VARCHAR(64),
  identified_customer_name VARCHAR(255),
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  human_handoff_requested BOOLEAN NOT NULL DEFAULT FALSE,
  recording_consented BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_voice_caller_phone ON voice_call_sessions(caller_phone);
CREATE INDEX IF NOT EXISTS idx_voice_status ON voice_call_sessions(status);

-- ----------------------------------------------------------------------------
-- 8. DATA QUALITY ISSUES & BUSINESS RISKS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_quality_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  issue_description TEXT NOT NULL,
  resolution_action TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dqi_severity ON data_quality_issues(severity);
CREATE INDEX IF NOT EXISTS idx_dqi_resolved ON data_quality_issues(is_resolved);

CREATE TABLE IF NOT EXISTS business_risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  related_entity_type VARCHAR(64),
  related_entity_id VARCHAR(64),
  metric_value DECIMAL(14, 2),
  threshold_value DECIMAL(14, 2),
  recommendation TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_severity ON business_risk_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_risk_status ON business_risk_alerts(status);

-- ----------------------------------------------------------------------------
-- 9. CUSTOMER OPPORTUNITIES & WORKFLOW AUTOMATION
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(64) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  opportunity_type VARCHAR(64) NOT NULL CHECK (opportunity_type IN ('AMC_RENEWAL', 'WARRANTY_EXT', 'CROSS_SELL', 'HARDWARE_UPGRADE', 'REPLACEMENT', 'DORMANT_REENGAGEMENT')),
  title VARCHAR(255) NOT NULL,
  pitch_summary TEXT NOT NULL,
  estimated_value DECIMAL(14, 2) NOT NULL DEFAULT 0,
  confidence_score INTEGER NOT NULL DEFAULT 50 CHECK (confidence_score BETWEEN 0 AND 100),
  supporting_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'CONVERTED', 'DISMISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opp_customer_id ON customer_opportunities(customer_id);
CREATE INDEX IF NOT EXISTS idx_opp_status ON customer_opportunities(status);

CREATE TABLE IF NOT EXISTS workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  trigger_event VARCHAR(64) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_type VARCHAR(64) NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_trigger ON workflow_rules(trigger_event);

-- ----------------------------------------------------------------------------
-- 10. DOCUMENT SEQUENCES SEEDING FOR DAY 4/5 DOC TYPES
-- ----------------------------------------------------------------------------
INSERT INTO document_sequences (doc_type, year_prefix, last_sequence, updated_at)
VALUES 
  ('CN', '26', 1, NOW()),
  ('DN', '26', 1, NOW()),
  ('DC', '26', 1, NOW()),
  ('PI', '26', 1, NOW())
ON CONFLICT (doc_type, year_prefix) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 11. ROW-LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promises_to_pay ENABLE ROW LEVEL SECURITY;
ALTER TABLE einvoice_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ewaybill_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tally_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_risk_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_allocations' AND policyname = 'Authenticated users can access payment allocations'
  ) THEN
    CREATE POLICY "Authenticated users can access payment allocations"
      ON payment_allocations FOR SELECT TO authenticated 
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts'));
    CREATE POLICY "Finance users can manage payment allocations"
      ON payment_allocations FOR ALL TO authenticated 
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'))
      WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_notes' AND policyname = 'Authenticated users can access credit notes'
  ) THEN
    CREATE POLICY "Authenticated users can access credit notes"
      ON credit_notes FOR SELECT TO authenticated 
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts'));
    CREATE POLICY "Finance users can manage credit notes"
      ON credit_notes FOR ALL TO authenticated 
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'))
      WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'debit_notes' AND policyname = 'Authenticated users can access debit notes'
  ) THEN
    CREATE POLICY "Authenticated users can access debit notes"
      ON debit_notes FOR ALL TO authenticated 
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'))
      WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tally_reconciliations' AND policyname = 'Authenticated users can access tally reconciliations'
  ) THEN
    CREATE POLICY "Authenticated users can access tally reconciliations"
      ON tally_reconciliations FOR ALL TO authenticated 
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'))
      WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_agent_sessions' AND policyname = 'Users can manage their own AI agent sessions'
  ) THEN
    CREATE POLICY "Users can manage their own AI agent sessions"
      ON ai_agent_sessions FOR ALL TO authenticated 
      USING (user_id = auth.uid()::text OR public.current_user_role() IN ('Managing Director', 'Admin / BDM'))
      WITH CHECK (user_id = auth.uid()::text OR public.current_user_role() IN ('Managing Director', 'Admin / BDM'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'data_quality_issues' AND policyname = 'Authenticated users can view data quality issues'
  ) THEN
    CREATE POLICY "Authenticated users can view data quality issues"
      ON data_quality_issues FOR SELECT TO authenticated 
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));
    CREATE POLICY "Admin users can manage data quality issues"
      ON data_quality_issues FOR ALL TO authenticated 
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'))
      WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_risk_alerts' AND policyname = 'Authenticated users can view business risk alerts'
  ) THEN
    CREATE POLICY "Authenticated users can view business risk alerts"
      ON business_risk_alerts FOR SELECT TO authenticated 
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts', 'BDM'));
    CREATE POLICY "Admin users can manage business risk alerts"
      ON business_risk_alerts FOR ALL TO authenticated 
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'))
      WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_opportunities' AND policyname = 'Authenticated users can access customer opportunities'
  ) THEN
    CREATE POLICY "Authenticated users can access customer opportunities"
      ON customer_opportunities FOR ALL TO authenticated 
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'))
      WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workflow_rules' AND policyname = 'Authenticated users can view workflow rules'
  ) THEN
    CREATE POLICY "Authenticated users can view workflow rules"
      ON workflow_rules FOR ALL TO authenticated 
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'))
      WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));
  END IF;
END $$;
