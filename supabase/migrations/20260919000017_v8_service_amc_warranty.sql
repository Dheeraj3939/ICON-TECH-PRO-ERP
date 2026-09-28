-- ==============================================================================
-- ICON TECH PRO ERP V8 — Phase I: Service / AMC & Warranty Migration
-- Migration: 20260919000017_v8_service_amc_warranty.sql
-- 
-- Safety: 100% Additive, Idempotent, Zero DROP/TRUNCATE.
-- Purpose:
--   1. Create warranty_claims table for unit-level serial warranty tracking.
--   2. Add additive columns to amc_contracts for SLA, type, and visit tracking.
--   3. Add additive foreign keys to service_tickets for warranty and AMC links.
-- ==============================================================================

-- 1. Warranty Claims Table
CREATE TABLE IF NOT EXISTS public.warranty_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_number VARCHAR(40) UNIQUE NOT NULL,
    serial_number VARCHAR(100) NOT NULL,
    customer_id UUID REFERENCES public.customers(id),
    customer_name VARCHAR(150) NOT NULL,
    product_name VARCHAR(200),
    claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
    issue_description TEXT NOT NULL,
    claim_type VARCHAR(30) NOT NULL DEFAULT 'REPAIR',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Additive columns on amc_contracts
ALTER TABLE public.amc_contracts
    ADD COLUMN IF NOT EXISTS amc_type VARCHAR(30) DEFAULT 'COMPREHENSIVE',
    ADD COLUMN IF NOT EXISTS sla_hours INT DEFAULT 24,
    ADD COLUMN IF NOT EXISTS scheduled_visits_count INT DEFAULT 4,
    ADD COLUMN IF NOT EXISTS completed_visits_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS renewal_status VARCHAR(30) DEFAULT 'ACTIVE';

-- 3. Additive columns on service_tickets
ALTER TABLE public.service_tickets
    ADD COLUMN IF NOT EXISTS warranty_claim_id UUID REFERENCES public.warranty_claims(id),
    ADD COLUMN IF NOT EXISTS amc_contract_id UUID REFERENCES public.amc_contracts(id);

-- 4. Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_warranty_claims_serial ON public.warranty_claims(serial_number);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_status ON public.warranty_claims(status);
CREATE INDEX IF NOT EXISTS idx_amc_contracts_renewal ON public.amc_contracts(renewal_status);
CREATE INDEX IF NOT EXISTS idx_amc_contracts_end_date ON public.amc_contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_service_tickets_status ON public.service_tickets(status);
