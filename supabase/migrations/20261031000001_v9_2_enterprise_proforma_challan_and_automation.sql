-- ==============================================================================
-- ICON TECH PRO ERP V9.2 — MASTER ENTERPRISE MODULES & AUTOMATION MIGRATION
-- Migration: 20261031000001_v9_2_enterprise_proforma_challan_and_automation.sql
-- Modules:
--   1. Proforma Invoices & Items (ITP/PI/2026-27/0001 sequence, non-accounting)
--   2. Delivery Challans & Items (ITP/DC/2026-27/0001 sequence, Rule 55 CGST)
--   3. Signed Physical Documents Archival & Customer 360 Aggregation
--   4. Scheduled Executive Reporting (6 Asia/Kolkata 12:00 AM schedules, role-isolated)
--   5. Durable Email Automation Queue (retries, DLQ, customer/supplier triggers)
--
-- Safety:
--   - Additive-only (CREATE TABLE IF NOT EXISTS)
--   - Strict RLS enablement on all tables
--   - Explicit REVOKE TRUNCATE and REVOKE from anon
--   - Zero destructive drops, zero data modification
-- ==============================================================================

BEGIN;

DO $$
BEGIN
  RAISE NOTICE 'Starting ICON TECH PRO ERP V9.2 Master Enterprise Modules Migration...';
  RAISE NOTICE 'Execution Timestamp: %', CLOCK_TIMESTAMP();
END $$;

-- ------------------------------------------------------------------------------
-- 1. PROFORMA INVOICES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.proforma_invoices (
  id TEXT PRIMARY KEY,
  proforma_number TEXT NOT NULL UNIQUE,
  proforma_date DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_days INTEGER NOT NULL DEFAULT 15,
  expiry_date DATE,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  company_name TEXT,
  gstin TEXT,
  billing_address TEXT,
  shipping_address TEXT,
  place_of_supply TEXT NOT NULL DEFAULT '36-Telangana',
  quotation_id TEXT,
  quotation_number TEXT,
  order_id TEXT,
  order_number TEXT,
  is_gst_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  pricing_mode TEXT NOT NULL DEFAULT 'EXCLUSIVE' CHECK (pricing_mode IN ('INCLUSIVE', 'EXCLUSIVE')),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_discount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  taxable_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  gst_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  cgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  sgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  igst_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  round_off NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  advance_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  balance_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  amount_in_words TEXT,
  payment_terms TEXT,
  delivery_terms TEXT,
  terms_conditions TEXT,
  bank_name TEXT NOT NULL DEFAULT 'IDBI Bank',
  bank_account_number TEXT NOT NULL DEFAULT '0426653800000161',
  bank_ifsc TEXT NOT NULL DEFAULT 'IBKL0000426',
  bank_branch TEXT NOT NULL DEFAULT 'Bandri Complex, SR Nagar, Hyderabad',
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Issued', 'Sent', 'Partially Paid', 'Converted to Order', 'Cancelled', 'Expired')),
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  created_by_name TEXT NOT NULL DEFAULT 'System',
  created_by_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proforma_number ON public.proforma_invoices(proforma_number);
CREATE INDEX IF NOT EXISTS idx_proforma_customer_id ON public.proforma_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_proforma_status ON public.proforma_invoices(status);
CREATE INDEX IF NOT EXISTS idx_proforma_created_at ON public.proforma_invoices(created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. PROFORMA INVOICE ITEMS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.proforma_invoice_items (
  id TEXT PRIMARY KEY,
  proforma_id TEXT NOT NULL REFERENCES public.proforma_invoices(id) ON DELETE CASCADE,
  product_id TEXT,
  description TEXT NOT NULL,
  model_name TEXT,
  brand_name TEXT,
  hsn_sac TEXT NOT NULL DEFAULT '85285200',
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1.00,
  unit TEXT NOT NULL DEFAULT 'Nos.',
  rate NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  taxable_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  gst_rate NUMERIC(6,2) NOT NULL DEFAULT 18.00,
  cgst_rate NUMERIC(6,2) NOT NULL DEFAULT 9.00,
  cgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  sgst_rate NUMERIC(6,2) NOT NULL DEFAULT 9.00,
  sgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  igst_rate NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  igst_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proforma_items_proforma_id ON public.proforma_invoice_items(proforma_id);

-- ------------------------------------------------------------------------------
-- 3. DELIVERY CHALLANS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.delivery_challans (
  id TEXT PRIMARY KEY,
  challan_number TEXT NOT NULL UNIQUE,
  challan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  company_name TEXT,
  gstin TEXT,
  customer_address TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('Supply against Order', 'Demo / Testing', 'Job Work / Repair', 'Exhibition / Display', 'Returnable Gate Pass', 'Transit Transfer', 'Other Non-Sale Movement')),
  reference_type TEXT CHECK (reference_type IN ('QUOTATION', 'SALES_ORDER', 'TAX_INVOICE', 'MANUAL')),
  reference_id TEXT,
  reference_number TEXT,
  transporter_name TEXT,
  vehicle_number TEXT,
  eway_bill_number TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Issued', 'Sent', 'Delivered/Acknowledged', 'Returned', 'Cancelled')),
  receiver_name TEXT,
  receiver_phone TEXT,
  pod_date TIMESTAMPTZ,
  pod_signature_url TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  created_by_name TEXT NOT NULL DEFAULT 'System',
  created_by_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challan_number ON public.delivery_challans(challan_number);
CREATE INDEX IF NOT EXISTS idx_challan_customer_id ON public.delivery_challans(customer_id);
CREATE INDEX IF NOT EXISTS idx_challan_status ON public.delivery_challans(status);
CREATE INDEX IF NOT EXISTS idx_challan_created_at ON public.delivery_challans(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. DELIVERY CHALLAN ITEMS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.delivery_challan_items (
  id TEXT PRIMARY KEY,
  challan_id TEXT NOT NULL REFERENCES public.delivery_challans(id) ON DELETE CASCADE,
  product_id TEXT,
  description TEXT NOT NULL,
  model_name TEXT,
  brand_name TEXT,
  hsn_sac TEXT NOT NULL DEFAULT '85285200',
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1.00,
  unit TEXT NOT NULL DEFAULT 'Nos.',
  serial_numbers JSONB NOT NULL DEFAULT '[]'::jsonb,
  remarks TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challan_items_challan_id ON public.delivery_challan_items(challan_id);

-- ------------------------------------------------------------------------------
-- 5. SIGNED PHYSICAL DOCUMENTS ARCHIVE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.signed_documents (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (document_type IN ('QUOTATION', 'PROFORMA_INVOICE', 'DELIVERY_CHALLAN', 'TAX_INVOICE', 'PURCHASE_ORDER', 'ENTERPRISE_CONTRACT', 'OTHER')),
  document_number TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  company_name TEXT,
  related_transaction_id TEXT,
  related_transaction_number TEXT,
  original_generated_pdf_url TEXT,
  signed_scan_file_url TEXT NOT NULL,
  signed_scan_file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  signed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by_id TEXT,
  uploaded_by_name TEXT NOT NULL DEFAULT 'System Staff',
  signer_name TEXT NOT NULL,
  signer_designation TEXT,
  has_company_stamp BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  audit_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signed_docs_number ON public.signed_documents(document_number);
CREATE INDEX IF NOT EXISTS idx_signed_docs_customer ON public.signed_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_signed_docs_type ON public.signed_documents(document_type);

-- ------------------------------------------------------------------------------
-- 6. SCHEDULED REPORT CONFIGURATIONS & RUN LOGS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.report_schedules (
  id TEXT PRIMARY KEY,
  report_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL')),
  formats TEXT[] NOT NULL DEFAULT ARRAY['PDF', 'EXCEL'],
  schedule_cron TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  delivery_hour INTEGER NOT NULL DEFAULT 0,
  allowed_roles TEXT[] NOT NULL,
  include_gross_margin BOOLEAN NOT NULL DEFAULT FALSE,
  filter_by_salesperson BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scheduled_report_runs (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL,
  report_code TEXT NOT NULL,
  report_name TEXT NOT NULL,
  frequency TEXT NOT NULL,
  period_label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recipient_email TEXT NOT NULL,
  recipient_role TEXT NOT NULL,
  recipient_user_id TEXT,
  salesperson_id TEXT,
  status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_runs_idempotency ON public.scheduled_report_runs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_scheduled_runs_report_code ON public.scheduled_report_runs(report_code);
CREATE INDEX IF NOT EXISTS idx_scheduled_runs_generated_at ON public.scheduled_report_runs(generated_at DESC);

-- ------------------------------------------------------------------------------
-- 7. DURABLE EMAIL AUTOMATION QUEUE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_queue (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  category TEXT NOT NULL CHECK (category IN ('TRANSACTIONAL', 'AUTOMATION', 'SCHEDULED_REPORT', 'SECURITY_ALERT')),
  trigger_type TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id TEXT,
  related_entity_number TEXT,
  customer_id TEXT,
  supplier_id TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'DEAD_LETTER')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status_attempt ON public.email_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_related_entity ON public.email_queue(related_entity_type, related_entity_id);

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY & LEAST-PRIVILEGE PERMISSIONS
-- ------------------------------------------------------------------------------

-- Enable RLS on all 8 new tables
ALTER TABLE public.proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_challan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signed_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Revoke dangerous TRUNCATE and PUBLIC grants
REVOKE TRUNCATE ON public.proforma_invoices FROM anon, authenticated, PUBLIC;
REVOKE TRUNCATE ON public.proforma_invoice_items FROM anon, authenticated, PUBLIC;
REVOKE TRUNCATE ON public.delivery_challans FROM anon, authenticated, PUBLIC;
REVOKE TRUNCATE ON public.delivery_challan_items FROM anon, authenticated, PUBLIC;
REVOKE TRUNCATE ON public.signed_documents FROM anon, authenticated, PUBLIC;
REVOKE TRUNCATE ON public.report_schedules FROM anon, authenticated, PUBLIC;
REVOKE TRUNCATE ON public.scheduled_report_runs FROM anon, authenticated, PUBLIC;
REVOKE TRUNCATE ON public.email_queue FROM anon, authenticated, PUBLIC;

-- Completely block anonymous callers
REVOKE ALL ON public.proforma_invoices FROM anon;
REVOKE ALL ON public.proforma_invoice_items FROM anon;
REVOKE ALL ON public.delivery_challans FROM anon;
REVOKE ALL ON public.delivery_challan_items FROM anon;
REVOKE ALL ON public.signed_documents FROM anon;
REVOKE ALL ON public.report_schedules FROM anon;
REVOKE ALL ON public.scheduled_report_runs FROM anon;
REVOKE ALL ON public.email_queue FROM anon;

-- Grant baseline DML to authenticated users (governed by RLS policies below)
GRANT SELECT, INSERT, UPDATE ON public.proforma_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.proforma_invoice_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.delivery_challans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.delivery_challan_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.signed_documents TO authenticated;
GRANT SELECT ON public.report_schedules TO authenticated;
GRANT SELECT, INSERT ON public.scheduled_report_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.email_queue TO authenticated;

-- Service role retains maintenance overrides
GRANT ALL ON public.proforma_invoices TO service_role;
GRANT ALL ON public.proforma_invoice_items TO service_role;
GRANT ALL ON public.delivery_challans TO service_role;
GRANT ALL ON public.delivery_challan_items TO service_role;
GRANT ALL ON public.signed_documents TO service_role;
GRANT ALL ON public.report_schedules TO service_role;
GRANT ALL ON public.scheduled_report_runs TO service_role;
GRANT ALL ON public.email_queue TO service_role;

-- ------------------------------------------------------------------------------
-- RLS POLICIES
-- ------------------------------------------------------------------------------

-- Drop any conflicting policy names if previously created
DROP POLICY IF EXISTS "proforma_authenticated_select" ON public.proforma_invoices;
DROP POLICY IF EXISTS "proforma_authenticated_insert" ON public.proforma_invoices;
DROP POLICY IF EXISTS "proforma_authenticated_update" ON public.proforma_invoices;

CREATE POLICY "proforma_authenticated_select" ON public.proforma_invoices
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "proforma_authenticated_insert" ON public.proforma_invoices
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "proforma_authenticated_update" ON public.proforma_invoices
  FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Proforma Items
DROP POLICY IF EXISTS "proforma_items_authenticated_select" ON public.proforma_invoice_items;
DROP POLICY IF EXISTS "proforma_items_authenticated_all" ON public.proforma_invoice_items;

CREATE POLICY "proforma_items_authenticated_select" ON public.proforma_invoice_items
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "proforma_items_authenticated_all" ON public.proforma_invoice_items
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Delivery Challans
DROP POLICY IF EXISTS "challan_authenticated_select" ON public.delivery_challans;
DROP POLICY IF EXISTS "challan_authenticated_insert" ON public.delivery_challans;
DROP POLICY IF EXISTS "challan_authenticated_update" ON public.delivery_challans;

CREATE POLICY "challan_authenticated_select" ON public.delivery_challans
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "challan_authenticated_insert" ON public.delivery_challans
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "challan_authenticated_update" ON public.delivery_challans
  FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Challan Items
DROP POLICY IF EXISTS "challan_items_authenticated_select" ON public.delivery_challan_items;
DROP POLICY IF EXISTS "challan_items_authenticated_all" ON public.delivery_challan_items;

CREATE POLICY "challan_items_authenticated_select" ON public.delivery_challan_items
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "challan_items_authenticated_all" ON public.delivery_challan_items
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Signed Documents
DROP POLICY IF EXISTS "signed_docs_authenticated_select" ON public.signed_documents;
DROP POLICY IF EXISTS "signed_docs_authenticated_insert" ON public.signed_documents;
DROP POLICY IF EXISTS "signed_docs_authenticated_update" ON public.signed_documents;

CREATE POLICY "signed_docs_authenticated_select" ON public.signed_documents
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "signed_docs_authenticated_insert" ON public.signed_documents
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "signed_docs_authenticated_update" ON public.signed_documents
  FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Report Schedules & Runs
DROP POLICY IF EXISTS "report_schedules_read" ON public.report_schedules;
CREATE POLICY "report_schedules_read" ON public.report_schedules
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "report_runs_read" ON public.scheduled_report_runs;
CREATE POLICY "report_runs_read" ON public.scheduled_report_runs
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "report_runs_insert" ON public.scheduled_report_runs;
CREATE POLICY "report_runs_insert" ON public.scheduled_report_runs
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- Email Queue
DROP POLICY IF EXISTS "email_queue_authenticated_read" ON public.email_queue;
CREATE POLICY "email_queue_authenticated_read" ON public.email_queue
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "email_queue_authenticated_write" ON public.email_queue;
CREATE POLICY "email_queue_authenticated_write" ON public.email_queue
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

COMMIT;

-- Pre-fill standard reporting schedules (idempotent ON CONFLICT DO NOTHING)
INSERT INTO public.report_schedules (
  id, report_code, name, frequency, formats, schedule_cron, timezone, delivery_hour, allowed_roles, include_gross_margin, filter_by_salesperson, is_active
) VALUES
  ('REP-SCHED-01', 'REP-DAILY-OPS', 'Daily Operations & Sales Pulse', 'DAILY', ARRAY['PDF', 'EXCEL'], '0 0 * * *', 'Asia/Kolkata', 0, ARRAY['Managing Director', 'Admin / BDM', 'Accounts', 'All Salespeople'], TRUE, TRUE, TRUE),
  ('REP-SCHED-02', 'REP-WEEKLY-CORP', 'Weekly Corporate Performance & AR', 'WEEKLY', ARRAY['PDF', 'EXCEL'], '0 0 * * 6', 'Asia/Kolkata', 0, ARRAY['Managing Director', 'Admin / BDM', 'Accounts'], TRUE, TRUE, TRUE),
  ('REP-SCHED-03', 'REP-MONTHLY-EXEC', 'Monthly Executive Business & GST Review', 'MONTHLY', ARRAY['PDF', 'EXCEL'], '0 0 1 * *', 'Asia/Kolkata', 0, ARRAY['Managing Director', 'Accounts', 'Admin / BDM'], TRUE, FALSE, TRUE),
  ('REP-SCHED-04', 'REP-QUARTERLY-BD', 'Quarterly Commercial & Margin Audit', 'QUARTERLY', ARRAY['PDF', 'EXCEL'], '0 0 1 1,4,7,10 *', 'Asia/Kolkata', 0, ARRAY['Managing Director', 'Admin / BDM', 'Accounts'], TRUE, FALSE, TRUE),
  ('REP-SCHED-05', 'REP-HALFYEAR-CORP', 'Half-Yearly Corporate Trajectory & Sourcing', 'HALF_YEARLY', ARRAY['PDF', 'EXCEL'], '0 0 1 4,10 *', 'Asia/Kolkata', 0, ARRAY['Managing Director', 'Admin / BDM'], TRUE, FALSE, TRUE),
  ('REP-SCHED-06', 'REP-ANNUAL-CLOSING', 'Annual Financial Year Comprehensive Closing', 'ANNUAL', ARRAY['PDF', 'EXCEL'], '0 0 1 4 *', 'Asia/Kolkata', 0, ARRAY['Managing Director', 'Accounts'], TRUE, FALSE, TRUE)
ON CONFLICT (report_code) DO NOTHING;
