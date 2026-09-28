-- ==============================================================================
-- ICON TECH PRO ERP V8 — Phase C.2: Opportunity & Sales Intelligence Migration
-- Migration: 20260919000011_v8_opportunity_sales_intelligence.sql
-- 
-- Safety: 100% Additive, Idempotent, Zero DROP/TRUNCATE.
-- Purpose:
--   1. Stores AI Sales Briefs and Opportunity Intelligence synthesized for Enquiries.
--   2. Preserves advisory intelligence linked to enquiries, customers, and prospect dossiers.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.enquiry_sales_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_id UUID NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    prospect_dossier_id UUID REFERENCES public.prospect_companies(id) ON DELETE SET NULL,
    health_score INTEGER NOT NULL DEFAULT 70 CHECK (health_score >= 0 AND health_score <= 100),
    health_status VARCHAR(30) NOT NULL DEFAULT 'MODERATE', -- 'STRONG', 'MODERATE', 'AT_RISK', 'CRITICAL'
    requirement_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
    customer_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    buying_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
    decision_maker_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    project_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
    vendor_intelligence JSONB NOT NULL DEFAULT '{}'::jsonb,
    opportunity_risks JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_information JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_next_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    follow_up_intelligence JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_by VARCHAR(120) NOT NULL DEFAULT 'AI Sales Intelligence',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by enquiry_id
CREATE INDEX IF NOT EXISTS idx_enquiry_sales_briefs_enquiry_id 
    ON public.enquiry_sales_briefs(enquiry_id);

-- Index for customer cross-reference
CREATE INDEX IF NOT EXISTS idx_enquiry_sales_briefs_customer_id 
    ON public.enquiry_sales_briefs(customer_id);

-- Index for prospect dossier cross-reference
CREATE INDEX IF NOT EXISTS idx_enquiry_sales_briefs_prospect_dossier_id 
    ON public.enquiry_sales_briefs(prospect_dossier_id);

-- Enable RLS
ALTER TABLE public.enquiry_sales_briefs ENABLE ROW LEVEL SECURITY;

-- Staff view policy
DROP POLICY IF EXISTS "Staff can view enquiry sales briefs" ON public.enquiry_sales_briefs;
CREATE POLICY "Staff can view enquiry sales briefs"
    ON public.enquiry_sales_briefs FOR SELECT TO authenticated
    USING (TRUE);

-- Sales staff manage policy
DROP POLICY IF EXISTS "Sales staff can manage enquiry sales briefs" ON public.enquiry_sales_briefs;
CREATE POLICY "Sales staff can manage enquiry sales briefs"
    ON public.enquiry_sales_briefs FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive')
        )
    );

-- Service role bypass policy
DROP POLICY IF EXISTS "Service role can manage enquiry sales briefs" ON public.enquiry_sales_briefs;
CREATE POLICY "Service role can manage enquiry sales briefs"
    ON public.enquiry_sales_briefs FOR ALL TO service_role
    USING (TRUE);
