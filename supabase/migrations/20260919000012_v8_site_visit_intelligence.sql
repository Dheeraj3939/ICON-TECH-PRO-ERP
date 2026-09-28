-- ==============================================================================
-- ICON TECH PRO ERP V8 — Phase C.3: Site Visit Intelligence Migration
-- Migration: 20260919000012_v8_site_visit_intelligence.sql
-- 
-- Safety: 100% Additive, Idempotent, Zero DROP/TRUNCATE.
-- Purpose:
--   1. Additive columns on public.site_visits for pre-brief and survey intelligence.
--   2. Dedicated public.site_visit_intelligence table for structured surveys,
--      equipment checklists, technical questionnaires, and extracted requirements.
-- ==============================================================================

-- 1. Additive columns on existing site_visits table
ALTER TABLE public.site_visits
    ADD COLUMN IF NOT EXISTS pre_visit_brief JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS requirement_checklist JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS technical_questions JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS equipment_checklist JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS post_visit_summary JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS extracted_requirements JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS converted_to_enquiry_at TIMESTAMPTZ;

-- 2. Dedicated site_visit_intelligence table
CREATE TABLE IF NOT EXISTS public.site_visit_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_visit_id UUID REFERENCES public.site_visits(id) ON DELETE CASCADE,
    visit_number VARCHAR(30) NOT NULL,
    enquiry_id UUID REFERENCES public.enquiries(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    pre_visit_brief JSONB NOT NULL DEFAULT '{}'::jsonb,
    requirement_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    technical_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    equipment_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    post_visit_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    extracted_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED', -- 'PLANNED', 'BRIEF_READY', 'IN_PROGRESS', 'SURVEYED', 'SYNTHESIZED', 'CONVERTED'
    converted_to_enquiry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_site_visit_intelligence_visit_number 
    ON public.site_visit_intelligence(visit_number);

CREATE INDEX IF NOT EXISTS idx_site_visit_intelligence_enquiry_id 
    ON public.site_visit_intelligence(enquiry_id);

CREATE INDEX IF NOT EXISTS idx_site_visit_intelligence_customer_id 
    ON public.site_visit_intelligence(customer_id);

-- Enable RLS
ALTER TABLE public.site_visit_intelligence ENABLE ROW LEVEL SECURITY;

-- Staff view policy
DROP POLICY IF EXISTS "Staff can view site visit intelligence" ON public.site_visit_intelligence;
CREATE POLICY "Staff can view site visit intelligence"
    ON public.site_visit_intelligence FOR SELECT TO authenticated
    USING (TRUE);

-- Operations & Sales staff manage policy
DROP POLICY IF EXISTS "Staff can manage site visit intelligence" ON public.site_visit_intelligence;
CREATE POLICY "Staff can manage site visit intelligence"
    ON public.site_visit_intelligence FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Technician', 'Office Assistant')
        )
    );

-- Service role bypass policy
DROP POLICY IF EXISTS "Service role can manage site visit intelligence" ON public.site_visit_intelligence;
CREATE POLICY "Service role can manage site visit intelligence"
    ON public.site_visit_intelligence FOR ALL TO service_role
    USING (TRUE);
