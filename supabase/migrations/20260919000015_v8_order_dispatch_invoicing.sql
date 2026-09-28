-- ==============================================================================
-- ICON TECH PRO ERP V8 — Phase G: Order → Dispatch → Invoicing Migration
-- Migration: 20260919000015_v8_order_dispatch_invoicing.sql
-- 
-- Safety: 100% Additive, Idempotent, Zero DROP/TRUNCATE.
-- Purpose:
--   1. Additive columns on public.sales_orders for distinct fulfillment_status and DC references.
--   2. Additive columns on public.dispatches for POD tracking, carrier URL, and notes.
-- ==============================================================================

-- 1. Additive columns on existing sales_orders table
ALTER TABLE public.sales_orders
    ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(50) DEFAULT 'Pending Procurement',
    ADD COLUMN IF NOT EXISTS delivery_challan_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS delivery_challan_number VARCHAR(100);

-- 2. Additive columns on existing dispatches table
ALTER TABLE public.dispatches
    ADD COLUMN IF NOT EXISTS pod_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pod_reference VARCHAR(100),
    ADD COLUMN IF NOT EXISTS carrier_tracking_url TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_orders_fulfillment_status 
    ON public.sales_orders(fulfillment_status);

CREATE INDEX IF NOT EXISTS idx_sales_orders_dc_number 
    ON public.sales_orders(delivery_challan_number);

CREATE INDEX IF NOT EXISTS idx_dispatches_order_number 
    ON public.dispatches(order_number);
