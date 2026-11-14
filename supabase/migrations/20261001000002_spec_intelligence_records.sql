-- ==============================================================================
-- ICON TECH PRO ERP — V9.2 SPEC INTELLIGENCE RECORDS
-- Migration: 20261001000002_spec_intelligence_records.sql
-- Description: Reusable product specification records for CPQ & Spec Intelligence
-- Target: UAT & Production Environments
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.spec_intelligence_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand VARCHAR(120) NOT NULL,
    model VARCHAR(120) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
    specs_text TEXT,
    description TEXT,
    source_name VARCHAR(200),
    source_url TEXT,
    research_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by VARCHAR(120),
    updated_by VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for fast CPQ retrieval by brand and model
CREATE INDEX IF NOT EXISTS idx_spec_intelligence_brand_model
    ON public.spec_intelligence_records (brand, model);

CREATE INDEX IF NOT EXISTS idx_spec_intelligence_created_at
    ON public.spec_intelligence_records (created_at DESC);

-- Row-Level Security
ALTER TABLE public.spec_intelligence_records ENABLE ROW LEVEL SECURITY;

DO $policies$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'spec_intelligence_records' 
          AND policyname = 'Authenticated users can read spec records'
    ) THEN
        CREATE POLICY "Authenticated users can read spec records"
            ON public.spec_intelligence_records FOR SELECT TO authenticated
            USING (TRUE);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'spec_intelligence_records' 
          AND policyname = 'Authenticated users can insert spec records'
    ) THEN
        CREATE POLICY "Authenticated users can insert spec records"
            ON public.spec_intelligence_records FOR INSERT TO authenticated
            WITH CHECK (TRUE);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'spec_intelligence_records' 
          AND policyname = 'Authenticated users can update spec records'
    ) THEN
        CREATE POLICY "Authenticated users can update spec records"
            ON public.spec_intelligence_records FOR UPDATE TO authenticated
            USING (TRUE)
            WITH CHECK (TRUE);
    END IF;
END
$policies$;

-- Least-Privilege Grants
GRANT SELECT, INSERT, UPDATE ON public.spec_intelligence_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spec_intelligence_records TO service_role;
