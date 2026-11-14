-- ==============================================================================
-- ICON TECH PRO ERP V9.2 — MASTER ENTERPRISE MODULES ROLLBACK SCRIPT
-- Migration Rollback: 20261031000001_v9_2_enterprise_proforma_challan_and_automation_rollback.sql
-- Strictly reverts 20261031000001_v9_2_enterprise_proforma_challan_and_automation.sql
-- Drops added enterprise tables in reverse dependency order
-- ==============================================================================

BEGIN;

DO $$
BEGIN
  RAISE NOTICE 'Rolling back ICON TECH PRO ERP V9.2 Master Enterprise Modules Migration...';
  RAISE NOTICE 'Execution Timestamp: %', CLOCK_TIMESTAMP();
END $$;

-- 1. Drop email queue and report run records
DROP TABLE IF EXISTS public.email_queue CASCADE;
DROP TABLE IF EXISTS public.scheduled_report_runs CASCADE;
DROP TABLE IF EXISTS public.report_schedules CASCADE;

-- 2. Drop signed physical documents
DROP TABLE IF EXISTS public.signed_documents CASCADE;

-- 3. Drop delivery challan items and challans
DROP TABLE IF EXISTS public.delivery_challan_items CASCADE;
DROP TABLE IF EXISTS public.delivery_challans CASCADE;

-- 4. Drop proforma invoice items and proformas
DROP TABLE IF EXISTS public.proforma_invoice_items CASCADE;
DROP TABLE IF EXISTS public.proforma_invoices CASCADE;

DO $$
BEGIN
  RAISE NOTICE 'Rollback completed successfully.';
END $$;

COMMIT;
