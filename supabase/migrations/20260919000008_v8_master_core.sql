-- ==============================================================================
-- ICON TECH PRO ERP - MIGRATION 20260919000008
-- VERSION 8 MASTER CORE SCHEMA EXTENSION
-- 100% ADDITIVE & NON-DESTRUCTIVE (ZERO DROP, ZERO TRUNCATE, ZERO DATA LOSS)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Sequences for Collision-Safe Document Numbering
-- ------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS project_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS supplier_offer_seq START WITH 1 INCREMENT BY 1;

-- ------------------------------------------------------------------------------
-- 2. Projects Table (Parent Orchestrator for 15-Stage Project Lifecycle)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. 'PRJ/2026-27/0001'
  project_name VARCHAR(200) NOT NULL,
  project_type VARCHAR(50) NOT NULL CHECK (
    project_type IN ('Home Theater', 'Conference Room', 'CCTV', 'Networking', 'AV Solutions', 'Projectors', 'Interactive Displays', 'Integrated Technology', 'Other')
  ),
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_name VARCHAR(200) NOT NULL,
  enquiry_id VARCHAR(100),
  site_visit_id VARCHAR(100),
  quotation_id VARCHAR(100),
  sales_order_id VARCHAR(100),
  lead_engineer_name VARCHAR(120),
  status VARCHAR(50) NOT NULL DEFAULT 'Planning' CHECK (
    status IN ('Planning', 'Site Survey', 'Costing & Quote', 'Client Approval', 'Advance Received', 'Procurement', 'In Execution', 'Commissioning', 'Handover', 'Completed', 'AMC Active', 'On Hold', 'Cancelled')
  ),
  total_project_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  margin_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  start_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON public.projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_project_number ON public.projects(project_number);

-- ------------------------------------------------------------------------------
-- 3. Project Milestones (Scheduled Execution & Billing Gates)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_number INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  due_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (
    status IN ('Pending', 'In Progress', 'Completed', 'Invoiced', 'Paid')
  ),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoice_number VARCHAR(100),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON public.project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_status ON public.project_milestones(status);

-- ------------------------------------------------------------------------------
-- 4. Supplier Price Offers (Human Sourcing History - Multi-Supplier Comparison)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_price_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. 'SPO/2026-27/0001'
  enquiry_id VARCHAR(100),
  quotation_id VARCHAR(100),
  product_id VARCHAR(100),
  product_name VARCHAR(200) NOT NULL,
  supplier_id VARCHAR(100) REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(120),
  phone VARCHAR(50),
  email VARCHAR(120),
  quoted_price NUMERIC(15,2) NOT NULL CHECK (quoted_price >= 0),
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18,
  lead_time_days INT NOT NULL DEFAULT 3,
  warranty_terms TEXT,
  communication_method VARCHAR(50) NOT NULL CHECK (
    communication_method IN ('Phone', 'Email', 'WhatsApp', 'In-Person', 'Portal', 'Other')
  ),
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  decision_notes TEXT,
  attachment_url TEXT,
  recorded_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_offers_enquiry ON public.supplier_price_offers(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_supplier_offers_product ON public.supplier_price_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_offers_selected ON public.supplier_price_offers(is_selected);

-- ------------------------------------------------------------------------------
-- 5. Quotation Revisions (Immutable Historical Snapshots: Rev 0 -> Rev 1 -> Rev 2)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotation_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id VARCHAR(100) NOT NULL,
  quotation_number VARCHAR(100) NOT NULL,
  revision_number INT NOT NULL DEFAULT 0,
  revision_tag VARCHAR(20) NOT NULL, -- 'Rev 0', 'Rev 1', 'Rev 2'
  customer_visible_items JSONB NOT NULL DEFAULT '[]',
  internal_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  margin_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  taxable_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  change_reason TEXT NOT NULL,
  changed_by_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_revisions_quote_id ON public.quotation_revisions(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quote_revisions_number ON public.quotation_revisions(quotation_number);

-- ------------------------------------------------------------------------------
-- 6. Record Attachments (Universal Polymorphic Evidence & Document Store)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.record_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_entity_type VARCHAR(50) NOT NULL CHECK (
    parent_entity_type IN ('Quotation', 'SalesOrder', 'SupplierOffer', 'CustomerConfirmation', 'Invoice', 'SiteVisit', 'Project', 'ServiceTicket', 'AMCContract', 'Customer')
  ),
  parent_entity_id VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  file_url TEXT NOT NULL,
  uploaded_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_parent ON public.record_attachments(parent_entity_type, parent_entity_id);

-- ------------------------------------------------------------------------------
-- 7. Additive Columns on Existing Tables (Non-Destructive Schema Extension)
-- ------------------------------------------------------------------------------

-- 7.1 sales_orders: Customer Confirmation Evidence
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS confirmation_type VARCHAR(50) DEFAULT 'Purchase Order';
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS confirmation_ref VARCHAR(100);
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS confirmed_by_person VARCHAR(120);
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS confirmation_notes TEXT;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS confirmation_attachment_url TEXT;

-- 7.2 products: Specification Intelligence & Verification Provenance
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS spec_source_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS spec_source_name VARCHAR(120);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS spec_retrieved_at TIMESTAMPTZ;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS spec_approved_by VARCHAR(120);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS spec_approved_at TIMESTAMPTZ;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS spec_status VARCHAR(50) DEFAULT 'PENDING_SPEC';

-- 7.3 quotations: Detailed Project Quotation Format & Room Sections
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS quotation_format VARCHAR(50) DEFAULT 'STANDARD';
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS project_sections JSONB DEFAULT '[]';
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS is_detailed_project BOOLEAN DEFAULT FALSE;

-- 7.4 invoices: Accounts Financial Lock Lifecycle & Project Linkage
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS financial_lock_status VARCHAR(50) DEFAULT 'DRAFT';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS locked_by VARCHAR(120);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS project_id VARCHAR(100);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS milestone_id VARCHAR(100);

-- 7.5 site_visits: Photos, Drawings, Voice Notes & Recommendations
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS drawings TEXT[] DEFAULT '{}';
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS voice_note_url TEXT;
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS customer_expectations TEXT;
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS recommended_solution TEXT;
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS follow_up_actions TEXT;

-- 7.6 enquiries: Follow-up Timeline History
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS follow_up_history JSONB DEFAULT '[]';

-- ------------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_price_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_attachments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Projects Policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Authenticated users can view projects') THEN
    CREATE POLICY "Authenticated users can view projects" ON public.projects FOR SELECT TO authenticated USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Staff can create projects') THEN
    CREATE POLICY "Staff can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Staff can update projects') THEN
    CREATE POLICY "Staff can update projects" ON public.projects FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
  END IF;

  -- Project Milestones Policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_milestones' AND policyname = 'Authenticated users can view project milestones') THEN
    CREATE POLICY "Authenticated users can view project milestones" ON public.project_milestones FOR SELECT TO authenticated USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_milestones' AND policyname = 'Staff can manage project milestones') THEN
    CREATE POLICY "Staff can manage project milestones" ON public.project_milestones FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
  END IF;

  -- Supplier Price Offers Policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_price_offers' AND policyname = 'Authenticated users can view supplier offers') THEN
    CREATE POLICY "Authenticated users can view supplier offers" ON public.supplier_price_offers FOR SELECT TO authenticated USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_price_offers' AND policyname = 'Staff can record supplier offers') THEN
    CREATE POLICY "Staff can record supplier offers" ON public.supplier_price_offers FOR INSERT TO authenticated WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_price_offers' AND policyname = 'Staff can update supplier offers') THEN
    CREATE POLICY "Staff can update supplier offers" ON public.supplier_price_offers FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
  END IF;

  -- Quotation Revisions Policies (Immutable Snapshots)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotation_revisions' AND policyname = 'Authenticated users can view quotation revisions') THEN
    CREATE POLICY "Authenticated users can view quotation revisions" ON public.quotation_revisions FOR SELECT TO authenticated USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotation_revisions' AND policyname = 'Staff can insert quotation revisions') THEN
    CREATE POLICY "Staff can insert quotation revisions" ON public.quotation_revisions FOR INSERT TO authenticated WITH CHECK (TRUE);
  END IF;

  -- Record Attachments Policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'record_attachments' AND policyname = 'Authenticated users can view attachments') THEN
    CREATE POLICY "Authenticated users can view attachments" ON public.record_attachments FOR SELECT TO authenticated USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'record_attachments' AND policyname = 'Authenticated users can upload attachments') THEN
    CREATE POLICY "Authenticated users can upload attachments" ON public.record_attachments FOR INSERT TO authenticated WITH CHECK (TRUE);
  END IF;
END $$;

COMMIT;
