-- ==============================================================================
-- ICON TECH PRO ERP V9.2 — ADDITIVE MIGRATION SCRIPT
-- Migration: 20261031000002_v9_2_technical_evaluations_and_sources.sql
-- Scope: Technical Evaluations, Controlled Enquiry Sources & Site Survey Expansion
-- Execution Policy: Additive, Idempotent, Zero Downtime, Strictly Preserves Existing Data
-- Target Database: Supabase PostgreSQL (UAT / Production Cutover)
-- ==============================================================================

-- 1. CONTROLLED ENQUIRY SOURCES DEFINITION
-- Controlled canonical sources:
-- 'Just Dial', 'India Mart', 'Google ADS', 'Existing Customers', 'Referrals', 'Website', 'Walk-in'
-- Existing historical values are strictly preserved (no destructive check constraints).

COMMENT ON COLUMN public.customers.enquiry_source IS 
  'Customer acquisition channel. Canonical values: Just Dial, India Mart, Google ADS, Existing Customers, Referrals, Website, Walk-in. Legacy strings preserved.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'enquiries' AND column_name = 'source') THEN
    COMMENT ON COLUMN public.enquiries.source IS 
      'Enquiry acquisition source. Canonical values: Just Dial, India Mart, Google ADS, Existing Customers, Referrals, Website, Walk-in.';
  END IF;
END $$;


-- 2. SITE VISITS TABLE EXPANSION
-- Ensures project category, contact, purpose, and next actions are persisted if table exists or is created.

CREATE TABLE IF NOT EXISTS public.site_visits (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  visit_number text UNIQUE NOT NULL,
  customer_id text,
  customer_name text NOT NULL,
  company_name text,
  enquiry_id text,
  enquiry_number text,
  site_address text NOT NULL,
  contact_person text,
  contact_phone text,
  salesperson_name text,
  assigned_technician text NOT NULL,
  project_category text DEFAULT 'Audio-Visual Solutions' NOT NULL,
  other_project_description text,
  purpose text DEFAULT 'Physical Site Measurement & Feasibility Survey',
  room_type text DEFAULT 'Home Theater',
  measurements text,
  wall_type text DEFAULT 'Brick / Concrete',
  conduit_verified boolean DEFAULT true,
  power_available boolean DEFAULT true,
  scheduled_date date NOT NULL,
  scheduled_time text DEFAULT '11:00 AM',
  completed_date date,
  next_action text DEFAULT 'Prepare Technical Evaluation & BoM',
  follow_up_date date,
  status text DEFAULT 'SCHEDULED' NOT NULL,
  notes text,
  photos jsonb DEFAULT '[]'::jsonb,
  drawings jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Ensure columns exist in case table was pre-existing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'project_category') THEN
    ALTER TABLE public.site_visits ADD COLUMN project_category text DEFAULT 'Audio-Visual Solutions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'other_project_description') THEN
    ALTER TABLE public.site_visits ADD COLUMN other_project_description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'contact_person') THEN
    ALTER TABLE public.site_visits ADD COLUMN contact_person text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'contact_phone') THEN
    ALTER TABLE public.site_visits ADD COLUMN contact_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'purpose') THEN
    ALTER TABLE public.site_visits ADD COLUMN purpose text DEFAULT 'Site Inspection & Feasibility';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'scheduled_time') THEN
    ALTER TABLE public.site_visits ADD COLUMN scheduled_time text DEFAULT '11:00 AM';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'next_action') THEN
    ALTER TABLE public.site_visits ADD COLUMN next_action text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'follow_up_date') THEN
    ALTER TABLE public.site_visits ADD COLUMN follow_up_date date;
  END IF;
END $$;


-- 3. TECHNICAL EVALUATIONS TABLE (SECTIONS A TO H)
CREATE TABLE IF NOT EXISTS public.technical_evaluations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  evaluation_number text UNIQUE NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  status text DEFAULT 'Draft' NOT NULL,

  -- Section A: Reference Information
  customer_id text NOT NULL,
  customer_name text NOT NULL,
  company_name text,
  enquiry_id text,
  enquiry_number text,
  site_visit_id text,
  site_visit_number text,
  project_category text NOT NULL,
  other_project_description text,
  evaluation_date date DEFAULT CURRENT_DATE NOT NULL,
  evaluated_by_id text,
  evaluated_by_name text NOT NULL,
  assigned_technical_employee_id text,
  assigned_technical_employee_name text,

  -- Section B: Customer Requirements & Scope
  stated_requirement text NOT NULL,
  project_objectives text,
  number_of_rooms integer DEFAULT 1,
  room_or_endpoint_locations text,
  expected_capacity_usage text,
  commercial_budget_constraints text,

  -- Section C: Existing Infrastructure
  existing_equipment_details text,
  network_infrastructure text,
  electrical_power_availability text,
  cabling_conduits_status text,
  rack_mounting_arrangements text,
  compatibility_requirements text,

  -- Section D: Technical Observations & Feasibility
  site_measurements text,
  physical_constraints text,
  technical_limitations text,
  existing_infrastructure_issues text,
  photographs_and_drawings jsonb DEFAULT '[]'::jsonb,

  -- Section E: Proposed Technical Solution (Bill of Materials)
  recommended_items jsonb DEFAULT '[]'::jsonb NOT NULL,
  system_architecture_summary text,
  connectivity_matrix text,
  required_accessories text,
  cabling_installation_scope text,
  configuration_commissioning_scope text,

  -- Section F: Risks, Dependencies & Site Readiness
  technical_risks text,
  installation_limitations text,
  civil_electrical_dependency text,
  third_party_dependencies text,
  customer_responsibilities text,
  unconfirmed_specifications text,

  -- Section G: Recommendations & Remarks
  proposed_solution_summary text NOT NULL,
  alternative_options text,
  technical_recommendations text,
  internal_engineer_remarks text, -- STRICTLY QUARANTINED FROM CUSTOMER QUOTATIONS

  -- Section H: Review and Audit History
  submitted_at timestamptz,
  submitted_by_name text,
  reviewed_at timestamptz,
  reviewed_by_name text,
  review_notes text,
  revision_requested_at timestamptz,
  revision_requested_by_name text,
  revision_notes text,
  closed_at timestamptz,
  closed_by_name text,
  revisions jsonb DEFAULT '[]'::jsonb,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for performant lookups
CREATE INDEX IF NOT EXISTS idx_tech_eval_customer_id ON public.technical_evaluations(customer_id);
CREATE INDEX IF NOT EXISTS idx_tech_eval_enquiry_number ON public.technical_evaluations(enquiry_number);
CREATE INDEX IF NOT EXISTS idx_tech_eval_site_visit_number ON public.technical_evaluations(site_visit_number);
CREATE INDEX IF NOT EXISTS idx_tech_eval_status ON public.technical_evaluations(status);
CREATE INDEX IF NOT EXISTS idx_tech_eval_category ON public.technical_evaluations(project_category);


-- 4. ROW-LEVEL SECURITY & GRANTS
ALTER TABLE public.technical_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- Allow authenticated ERP users full read access
DROP POLICY IF EXISTS "Authenticated users can read technical evaluations" ON public.technical_evaluations;
CREATE POLICY "Authenticated users can read technical evaluations"
  ON public.technical_evaluations
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update technical evaluations
DROP POLICY IF EXISTS "Authenticated users can insert technical evaluations" ON public.technical_evaluations;
CREATE POLICY "Authenticated users can insert technical evaluations"
  ON public.technical_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update technical evaluations" ON public.technical_evaluations;
CREATE POLICY "Authenticated users can update technical evaluations"
  ON public.technical_evaluations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Site visits policies
DROP POLICY IF EXISTS "Authenticated users can manage site visits" ON public.site_visits;
CREATE POLICY "Authenticated users can manage site visits"
  ON public.site_visits
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.technical_evaluations TO authenticated;
GRANT ALL ON public.technical_evaluations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_visits TO authenticated;
GRANT ALL ON public.site_visits TO service_role;

-- ==============================================================================
-- END OF ADDITIVE MIGRATION SCRIPT
-- ==============================================================================
