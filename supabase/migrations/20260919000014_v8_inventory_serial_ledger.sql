-- ==============================================================================
-- ICON TECH PRO ERP V8 — Phase F: Inventory & Serial Movement Migration
-- Migration: 20260919000014_v8_inventory_serial_ledger.sql
-- 
-- Safety: 100% Additive, Idempotent, Zero DROP/TRUNCATE.
-- Purpose:
--   1. Additive columns on public.stock_movements for auditability and previous/new stock.
--   2. Dedicated public.serial_ledger table for immutable unit-level serial traceability.
-- ==============================================================================

-- 1. Additive columns on existing stock_movements table
ALTER TABLE public.stock_movements
    ADD COLUMN IF NOT EXISTS previous_stock INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS new_stock INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS warehouse_code VARCHAR(50) DEFAULT 'WH-HYD-MAIN';

-- 2. Dedicated serial_ledger table (Immutable unit-level lifecycle history)
CREATE TABLE IF NOT EXISTS public.serial_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number VARCHAR(100) NOT NULL,
    product_id VARCHAR(100),
    product_name VARCHAR(200) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'INWARD_GRN', 'RESERVE', 'DISPATCH', 'INSTALL', 'RETURN', 'DEFECTIVE'
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL, -- 'AVAILABLE', 'RESERVED', 'DISPATCHED', 'INSTALLED', 'DEFECTIVE', 'RETURNED'
    reference_module VARCHAR(50), -- 'PO', 'SO', 'INVOICE', 'INSTALLATION', 'RMA'
    reference_number VARCHAR(50),
    customer_name VARCHAR(150),
    warehouse_code VARCHAR(50) DEFAULT 'WH-HYD-MAIN',
    notes TEXT,
    actor_name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high performance serial lookup & auditing
CREATE INDEX IF NOT EXISTS idx_serial_ledger_serial_number 
    ON public.serial_ledger(serial_number);

CREATE INDEX IF NOT EXISTS idx_serial_ledger_action 
    ON public.serial_ledger(action);

CREATE INDEX IF NOT EXISTS idx_serial_ledger_reference 
    ON public.serial_ledger(reference_module, reference_number);

CREATE INDEX IF NOT EXISTS idx_serial_ledger_created_at 
    ON public.serial_ledger(created_at DESC);

-- Enable RLS
ALTER TABLE public.serial_ledger ENABLE ROW LEVEL SECURITY;

-- Staff view policy
DROP POLICY IF EXISTS "Staff can view serial ledger" ON public.serial_ledger;
CREATE POLICY "Staff can view serial ledger"
    ON public.serial_ledger FOR SELECT TO authenticated
    USING (TRUE);

-- Staff manage policy (insert only for ledger immutability)
DROP POLICY IF EXISTS "Staff can insert serial ledger" ON public.serial_ledger;
CREATE POLICY "Staff can insert serial ledger"
    ON public.serial_ledger FOR INSERT TO authenticated
    WITH CHECK (TRUE);

GRANT SELECT, INSERT ON public.serial_ledger TO authenticated;
