-- ==============================================================================
-- ICON TECH PRO ERP - MIGRATION 20260919000009
-- VERSION 8 PHASE B: AI PROSPECT INTELLIGENCE CORE SCHEMA EXTENSION
-- 100% ADDITIVE & NON-DESTRUCTIVE (ZERO DROP, ZERO TRUNCATE, ZERO DATA LOSS)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Prospect Campaigns (Market Campaigns & Targeting Criteria)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospect_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  target_industry VARCHAR(100),
  target_geography VARCHAR(100),
  target_criteria JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (
    status IN ('ACTIVE', 'COMPLETED', 'PAUSED')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_campaigns_status ON public.prospect_campaigns(status);

-- ------------------------------------------------------------------------------
-- 2. Prospect Companies (Researched Companies & Primary Hub)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospect_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.prospect_campaigns(id) ON DELETE SET NULL,
  company_name VARCHAR(250) NOT NULL,
  normalized_name VARCHAR(250) NOT NULL, -- Lowercase stripped for deduplication
  domain VARCHAR(255),
  industry VARCHAR(100),
  headquarters_location VARCHAR(200),
  target_geography VARCHAR(100),
  estimated_revenue VARCHAR(100),
  employee_count_range VARCHAR(50),
  relevance_summary TEXT, -- "Why is this prospect relevant?"
  status VARCHAR(50) NOT NULL DEFAULT 'DISCOVERED' CHECK (
    status IN ('DISCOVERED', 'RESEARCHING', 'DOSSIER_READY', 'CONVERTED', 'ARCHIVED')
  ),
  crm_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  latest_run_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_companies_campaign ON public.prospect_companies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_prospect_companies_status ON public.prospect_companies(status);
CREATE INDEX IF NOT EXISTS idx_prospect_companies_norm_name ON public.prospect_companies(normalized_name);
CREATE INDEX IF NOT EXISTS idx_prospect_companies_domain ON public.prospect_companies(domain);
CREATE INDEX IF NOT EXISTS idx_prospect_companies_crm_id ON public.prospect_companies(crm_customer_id);

-- ------------------------------------------------------------------------------
-- 3. Prospect Research Runs (Append-Only Research History per Company)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospect_research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.prospect_companies(id) ON DELETE CASCADE,
  run_number INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED' CHECK (
    status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')
  ),
  summary TEXT,
  key_findings JSONB DEFAULT '[]'::jsonb,
  change_summary TEXT, -- Diff compared to previous run
  executed_by VARCHAR(120) NOT NULL DEFAULT 'AI_RESEARCH_ENGINE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_prospect_company_run_number UNIQUE (company_id, run_number)
);

CREATE INDEX IF NOT EXISTS idx_prospect_research_runs_company ON public.prospect_research_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_prospect_research_runs_created ON public.prospect_research_runs(created_at);

-- ------------------------------------------------------------------------------
-- 4. Prospect Decision Makers (Gated Contacts with Evidence & Verification)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospect_decision_makers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.prospect_companies(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.prospect_research_runs(id) ON DELETE CASCADE,
  full_name VARCHAR(150) NOT NULL,
  title VARCHAR(150) NOT NULL,
  department VARCHAR(50) NOT NULL CHECK (
    department IN ('PROJECTS', 'PURCHASE', 'MAINTENANCE', 'SECURITY', 'EXECUTIVE', 'OTHER')
  ),
  email VARCHAR(200),
  phone VARCHAR(50),
  linkedin_url VARCHAR(255),
  classification VARCHAR(50) NOT NULL DEFAULT 'LIKELY' CHECK (
    classification IN ('VERIFIED', 'LIKELY', 'HISTORICAL', 'UNKNOWN')
  ),
  confidence VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (
    confidence IN ('HIGH', 'MEDIUM', 'LOW')
  ),
  evidence_sources JSONB DEFAULT '[]'::jsonb,
  human_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by VARCHAR(120),
  verification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_dm_company ON public.prospect_decision_makers(company_id);
CREATE INDEX IF NOT EXISTS idx_prospect_dm_run ON public.prospect_decision_makers(run_id);
CREATE INDEX IF NOT EXISTS idx_prospect_dm_dept ON public.prospect_decision_makers(department);

-- ------------------------------------------------------------------------------
-- 5. Prospect Projects (Upcoming & Ongoing Capital/Expansion Projects)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospect_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.prospect_companies(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.prospect_research_runs(id) ON DELETE CASCADE,
  project_name VARCHAR(200) NOT NULL,
  location VARCHAR(200),
  estimated_value VARCHAR(100),
  timeline VARCHAR(100),
  description TEXT,
  technology_requirements JSONB DEFAULT '[]'::jsonb,
  classification VARCHAR(50) NOT NULL DEFAULT 'LIKELY' CHECK (
    classification IN ('VERIFIED', 'LIKELY', 'HISTORICAL', 'UNKNOWN')
  ),
  confidence VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (
    confidence IN ('HIGH', 'MEDIUM', 'LOW')
  ),
  evidence_sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_proj_company ON public.prospect_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_prospect_proj_run ON public.prospect_projects(run_id);

-- ------------------------------------------------------------------------------
-- 6. Prospect Vendor Intelligence (Incumbent Vendors & Expirations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospect_vendor_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.prospect_companies(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.prospect_research_runs(id) ON DELETE CASCADE,
  incumbent_vendor VARCHAR(200),
  category VARCHAR(100) NOT NULL,
  contract_status VARCHAR(100),
  pain_points TEXT,
  satisfaction_score VARCHAR(50),
  classification VARCHAR(50) NOT NULL DEFAULT 'LIKELY' CHECK (
    classification IN ('VERIFIED', 'LIKELY', 'HISTORICAL', 'UNKNOWN')
  ),
  confidence VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (
    confidence IN ('HIGH', 'MEDIUM', 'LOW')
  ),
  evidence_sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_vendor_company ON public.prospect_vendor_intelligence(company_id);
CREATE INDEX IF NOT EXISTS idx_prospect_vendor_run ON public.prospect_vendor_intelligence(run_id);

-- ------------------------------------------------------------------------------
-- 7. Prospect Technology Signals (Identified Infrastructure & Fit Score)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospect_technology_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.prospect_companies(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.prospect_research_runs(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  technologies_identified JSONB DEFAULT '[]'::jsonb,
  solution_fit_score INT NOT NULL DEFAULT 0 CHECK (solution_fit_score >= 0 AND solution_fit_score <= 100),
  notes TEXT,
  classification VARCHAR(50) NOT NULL DEFAULT 'LIKELY' CHECK (
    classification IN ('VERIFIED', 'LIKELY', 'HISTORICAL', 'UNKNOWN')
  ),
  confidence VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (
    confidence IN ('HIGH', 'MEDIUM', 'LOW')
  ),
  evidence_sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_tech_company ON public.prospect_technology_signals(company_id);
CREATE INDEX IF NOT EXISTS idx_prospect_tech_run ON public.prospect_technology_signals(run_id);

-- ------------------------------------------------------------------------------
-- 8. Prospect Opportunity Signals (Sales Angles & Entry Points)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospect_opportunity_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.prospect_companies(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.prospect_research_runs(id) ON DELETE CASCADE,
  signal_type VARCHAR(100) NOT NULL,
  headline VARCHAR(250) NOT NULL,
  detail TEXT,
  recommended_entry_angle TEXT,
  urgency VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (
    urgency IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
  ),
  classification VARCHAR(50) NOT NULL DEFAULT 'LIKELY' CHECK (
    classification IN ('VERIFIED', 'LIKELY', 'HISTORICAL', 'UNKNOWN')
  ),
  confidence VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (
    confidence IN ('HIGH', 'MEDIUM', 'LOW')
  ),
  evidence_sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_opp_company ON public.prospect_opportunity_signals(company_id);
CREATE INDEX IF NOT EXISTS idx_prospect_opp_run ON public.prospect_opportunity_signals(run_id);

-- ------------------------------------------------------------------------------
-- 9. Prospect Evidence Sources (Citations for Transparency & Audit)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospect_evidence_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.prospect_companies(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.prospect_research_runs(id) ON DELETE CASCADE,
  source_name VARCHAR(200) NOT NULL,
  source_url VARCHAR(500) NOT NULL,
  retrieval_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snippet_content TEXT NOT NULL,
  reliability VARCHAR(20) NOT NULL DEFAULT 'HIGH' CHECK (
    reliability IN ('HIGH', 'MEDIUM', 'LOW')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_evidence_company ON public.prospect_evidence_sources(company_id);
CREATE INDEX IF NOT EXISTS idx_prospect_evidence_run ON public.prospect_evidence_sources(run_id);

-- ------------------------------------------------------------------------------
-- 10. Additive Cross-Reference on Customers Table for CRM Conversion
-- ------------------------------------------------------------------------------
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS prospect_dossier_id UUID REFERENCES public.prospect_companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_customers_prospect_dossier_id ON public.customers(prospect_dossier_id);

-- ------------------------------------------------------------------------------
-- 11. Row-Level Security (RLS) & Access Controls
-- ------------------------------------------------------------------------------
ALTER TABLE public.prospect_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_decision_makers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_vendor_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_technology_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_opportunity_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_evidence_sources ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full read/write access to prospect intelligence
CREATE POLICY "Allow authenticated read prospect_campaigns" ON public.prospect_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write prospect_campaigns" ON public.prospect_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read prospect_companies" ON public.prospect_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write prospect_companies" ON public.prospect_companies FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read prospect_research_runs" ON public.prospect_research_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write prospect_research_runs" ON public.prospect_research_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read prospect_decision_makers" ON public.prospect_decision_makers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write prospect_decision_makers" ON public.prospect_decision_makers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read prospect_projects" ON public.prospect_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write prospect_projects" ON public.prospect_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read prospect_vendor_intelligence" ON public.prospect_vendor_intelligence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write prospect_vendor_intelligence" ON public.prospect_vendor_intelligence FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read prospect_technology_signals" ON public.prospect_technology_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write prospect_technology_signals" ON public.prospect_technology_signals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read prospect_opportunity_signals" ON public.prospect_opportunity_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write prospect_opportunity_signals" ON public.prospect_opportunity_signals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read prospect_evidence_sources" ON public.prospect_evidence_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write prospect_evidence_sources" ON public.prospect_evidence_sources FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service_role bypass for automated background research & migrations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;
