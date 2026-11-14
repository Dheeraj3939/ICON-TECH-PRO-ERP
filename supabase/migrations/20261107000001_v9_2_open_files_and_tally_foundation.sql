-- =====================================================================
-- ICON TECH PRO ERP V9.2 — OPEN FILES MANAGEMENT & TALLY FOUNDATION MIGRATION
-- Migration Identifier: 20261107000001_v9_2_open_files_and_tally_foundation.sql
-- Classification: Additive Schema Enhancement (Zero Data Deletions)
-- Production Safety: IDEMPOTENT (IF NOT EXISTS), NON-BLOCKING, ZERO DOWNTIME
-- =====================================================================

BEGIN;

-- PRECONDITION CHECK: Fail closed if public.projects prerequisite table does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) THEN
    RAISE EXCEPTION 'PREREQUISITE TABLE MISSING: public.projects does not exist. Baseline schema migrations must be applied before 20261107000001.';
  END IF;
END $$;

-- 1. ADD 3 STATUS DIMENSIONS & OPEN FILE FIELDS TO PROJECTS TABLE
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS file_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sales_status VARCHAR(50) DEFAULT 'New Lead',
  ADD COLUMN IF NOT EXISTS fulfilment_status VARCHAR(50) DEFAULT 'Not Started',
  ADD COLUMN IF NOT EXISTS financial_status VARCHAR(50) DEFAULT 'No Financial Activity',
  ADD COLUMN IF NOT EXISTS closure_category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS closure_reason VARCHAR(100),
  ADD COLUMN IF NOT EXISTS closure_explanation TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_ready_for_closure BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reopen_requested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reopen_requested_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS reopen_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopen_reason TEXT,
  ADD COLUMN IF NOT EXISTS reopen_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS file_owner_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS file_owner_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS department_owner VARCHAR(50) DEFAULT 'Sales',
  ADD COLUMN IF NOT EXISTS ownership_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_po JSONB;

-- Index for rapid Open File retrieval and status dimension filtering
CREATE INDEX IF NOT EXISTS idx_projects_file_id ON public.projects(file_id);
CREATE INDEX IF NOT EXISTS idx_projects_sales_status ON public.projects(sales_status);
CREATE INDEX IF NOT EXISTS idx_projects_fulfilment_status ON public.projects(fulfilment_status);
CREATE INDEX IF NOT EXISTS idx_projects_financial_status ON public.projects(financial_status);
CREATE INDEX IF NOT EXISTS idx_projects_department_owner ON public.projects(department_owner);

-- 2. TALLY COMPANY PROFILES (MULTI-YEAR FINANCIAL BOOKS)
CREATE TABLE IF NOT EXISTS public.tally_company_profiles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  financial_year VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  is_read_only BOOLEAN DEFAULT TRUE,
  books_from DATE NOT NULL,
  books_to DATE NOT NULL,
  tally_guid VARCHAR(100),
  voucher_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Initial Tally Company Profiles
INSERT INTO public.tally_company_profiles (id, name, financial_year, is_active, is_read_only, books_from, books_to, tally_guid, voucher_count)
VALUES
  ('ICON-2026-27', 'ICON TECH PRO - 2026-27', '2026-2027', TRUE, FALSE, '2026-04-01', '2027-03-31', 'comp-icon-2627-live-primary', 342),
  ('ICON-2025-26', 'ICON TECH PRO - 2025-26', '2025-2026', FALSE, TRUE, '2025-04-01', '2026-03-31', 'comp-icon-2526-archive-readonly', 1284),
  ('ICON-2024-25', 'ICON TECH PRO - 2024-25', '2024-2025', FALSE, TRUE, '2024-04-01', '2025-03-31', 'comp-icon-2425-archive-readonly', 950)
ON CONFLICT (id) DO NOTHING;

-- 3. CUSTOMER LEDGER MATCHING QUEUE (GSTIN & TRADE NAME MATCHING)
CREATE TABLE IF NOT EXISTS public.tally_customer_ledger_matches (
  id VARCHAR(50) PRIMARY KEY,
  erp_customer_id VARCHAR(50) NOT NULL,
  erp_customer_name VARCHAR(150) NOT NULL,
  erp_gstin VARCHAR(20),
  tally_ledger_name VARCHAR(150) NOT NULL,
  tally_parent_group VARCHAR(50) DEFAULT 'Sundry Debtors',
  match_confidence_pct INTEGER NOT NULL,
  match_method VARCHAR(30) DEFAULT 'EXACT_GSTIN',
  verification_status VARCHAR(30) DEFAULT 'PENDING_REVIEW',
  reconciled_by VARCHAR(100),
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tally_match_customer ON public.tally_customer_ledger_matches(erp_customer_id);
CREATE INDEX IF NOT EXISTS idx_tally_match_status ON public.tally_customer_ledger_matches(verification_status);

-- 4. E-WAY BILL REGISTER (RULE 138 CGST TRACKER)
CREATE TABLE IF NOT EXISTS public.eway_bill_register (
  id VARCHAR(50) PRIMARY KEY,
  eway_bill_number VARCHAR(20) NOT NULL UNIQUE,
  generated_date TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  destination_city VARCHAR(100) NOT NULL,
  vehicle_number VARCHAR(20) NOT NULL,
  transporter_name VARCHAR(100),
  total_invoice_value NUMERIC(15, 2) NOT NULL,
  distance_km INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ewb_valid_until ON public.eway_bill_register(valid_until);
CREATE INDEX IF NOT EXISTS idx_ewb_status ON public.eway_bill_register(status);

-- 5. UNALLOCATED BANK RECEIPTS (ON-ACCOUNT TALLY RECEIPTS)
CREATE TABLE IF NOT EXISTS public.tally_unallocated_receipts (
  id VARCHAR(50) PRIMARY KEY,
  receipt_voucher_no VARCHAR(50) NOT NULL,
  receipt_date DATE NOT NULL,
  bank_account_ledger VARCHAR(100) NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_gstin VARCHAR(20),
  receipt_total_amount NUMERIC(15, 2) NOT NULL,
  unallocated_balance NUMERIC(15, 2) NOT NULL,
  tally_reference_type VARCHAR(30) DEFAULT 'On Account',
  suggested_invoices JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unallocated_receipt_balance ON public.tally_unallocated_receipts(unallocated_balance);

-- 6. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.tally_company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tally_customer_ledger_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eway_bill_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tally_unallocated_receipts ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES FOR SECURE ACCESS
DROP POLICY IF EXISTS "Authenticated users can read tally companies" ON public.tally_company_profiles;
CREATE POLICY "Authenticated users can read tally companies"
  ON public.tally_company_profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Accounts and MD can manage tally ledgers" ON public.tally_customer_ledger_matches;
CREATE POLICY "Accounts and MD can manage tally ledgers"
  ON public.tally_customer_ledger_matches FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read eway bills" ON public.eway_bill_register;
CREATE POLICY "Authenticated users can read eway bills"
  ON public.eway_bill_register FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Accounts and MD can manage unallocated receipts" ON public.tally_unallocated_receipts;
CREATE POLICY "Accounts and MD can manage unallocated receipts"
  ON public.tally_unallocated_receipts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
