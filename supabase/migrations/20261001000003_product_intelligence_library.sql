-- ==============================================================================
-- ICON TECH PRO ERP — V9.2 PRODUCT INTELLIGENCE LIBRARY
-- Migration: 20261001000003_product_intelligence_library.sql
-- Description: Additive extension for database-first product intelligence library
-- Target: UAT & Production Environments (Additive Only)
-- ==============================================================================

-- 1. Additive Columns to spec_intelligence_records
ALTER TABLE public.spec_intelligence_records
    ADD COLUMN IF NOT EXISTS normalized_brand VARCHAR(120),
    ADD COLUMN IF NOT EXISTS normalized_model VARCHAR(120),
    ADD COLUMN IF NOT EXISTS category VARCHAR(120),
    ADD COLUMN IF NOT EXISTS subcategory VARCHAR(120),
    ADD COLUMN IF NOT EXISTS key_specifications TEXT,
    ADD COLUMN IF NOT EXISTS customer_description TEXT,
    ADD COLUMN IF NOT EXISTS datasheet_url TEXT,
    ADD COLUMN IF NOT EXISTS source_confidence INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(60) DEFAULT 'VERIFIED',
    ADD COLUMN IF NOT EXISTS verification_date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS research_timestamp TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS last_verified_timestamp TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS search_aliases TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(80),
    ADD COLUMN IF NOT EXISTS conflict_info TEXT,
    ADD COLUMN IF NOT EXISTS suggested_price NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS suggested_cost NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS suggested_distributor VARCHAR(200),
    ADD COLUMN IF NOT EXISTS hsn_sac VARCHAR(30),
    ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 18;

-- 2. Performance Indexes for Database-First Fast Retrieval
CREATE INDEX IF NOT EXISTS idx_spec_intel_norm_brand_model
    ON public.spec_intelligence_records (normalized_brand, normalized_model);

CREATE INDEX IF NOT EXISTS idx_spec_intel_category
    ON public.spec_intelligence_records (category);

CREATE INDEX IF NOT EXISTS idx_spec_intel_aliases
    ON public.spec_intelligence_records USING GIN (search_aliases);

CREATE INDEX IF NOT EXISTS idx_spec_intel_verification_status
    ON public.spec_intelligence_records (verification_status);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE ON public.spec_intelligence_records TO authenticated;
GRANT ALL ON public.spec_intelligence_records TO service_role;
