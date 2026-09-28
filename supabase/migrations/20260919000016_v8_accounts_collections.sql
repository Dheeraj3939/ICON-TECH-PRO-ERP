-- ==============================================================================
-- ICON TECH PRO ERP V8 — Phase H: Accounts / Collections & Receivables Migration
-- Migration: 20260919000016_v8_accounts_collections.sql
-- 
-- Safety: 100% Additive, Idempotent, Zero DROP/TRUNCATE.
-- Purpose:
--   1. Additive indexes on invoices for customer-level outstanding queries and aging.
--   2. Additive indexes on payments for fast ledger lookups.
-- ==============================================================================

-- 1. Optimized indexes for aging & receivables calculation
CREATE INDEX IF NOT EXISTS idx_invoices_customer_status 
    ON public.invoices(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_due_date 
    ON public.invoices(due_date);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_number 
    ON public.payments(invoice_number);

CREATE INDEX IF NOT EXISTS idx_payments_payment_date 
    ON public.payments(payment_date DESC);
