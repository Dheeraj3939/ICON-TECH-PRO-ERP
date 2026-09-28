-- ==============================================================================
-- ICON TECH PRO ERP V8 — Phase E: Procurement & Supplier Intelligence Migration
-- Migration: 20260919000013_v8_procurement_intelligence.sql
-- 
-- Safety: 100% Additive, Idempotent, Zero DROP/TRUNCATE.
-- Purpose:
--   1. Additive columns on public.purchase_orders for notes, closed_at, and evaluation tracking.
--   2. Dedicated public.supplier_evaluations table for scorecard tracking,
--      on-time delivery scores, quality ratings, and vendor tiering.
-- ==============================================================================

-- 1. Additive columns on existing purchase_orders table
ALTER TABLE public.purchase_orders
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closed_by_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS on_time_status VARCHAR(30) DEFAULT 'PENDING'; -- 'ON_TIME', 'DELAYED', 'PENDING'

-- 2. Dedicated supplier_evaluations table
CREATE TABLE IF NOT EXISTS public.supplier_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id VARCHAR(100) NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    evaluation_period VARCHAR(50) NOT NULL, -- e.g. '2026-Q1', '2026-09'
    on_time_delivery_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    quality_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    pricing_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    support_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    overall_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'PREFERRED', 'ACTIVE', 'PROBATION', 'SUSPENDED'
    total_orders_evaluated INT NOT NULL DEFAULT 0,
    total_spend_evaluated NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    evaluated_by_name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_supplier_evaluations_supplier_id 
    ON public.supplier_evaluations(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_evaluations_period 
    ON public.supplier_evaluations(evaluation_period);

-- Enable RLS
ALTER TABLE public.supplier_evaluations ENABLE ROW LEVEL SECURITY;

-- Staff view policy
DROP POLICY IF EXISTS "Staff can view supplier evaluations" ON public.supplier_evaluations;
CREATE POLICY "Staff can view supplier evaluations"
    ON public.supplier_evaluations FOR SELECT TO authenticated
    USING (TRUE);

-- Management & Accounts manage policy
DROP POLICY IF EXISTS "Management can manage supplier evaluations" ON public.supplier_evaluations;
CREATE POLICY "Management can manage supplier evaluations"
    ON public.supplier_evaluations FOR ALL TO authenticated
    USING (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_evaluations TO authenticated;
