-- =====================================================================
-- ICON TECH PRO ERP V9.2 — OPEN FILES & TALLY FOUNDATION ROLLBACK SCRIPT
-- Script Identifier: 20261107000001_v9_2_open_files_and_tally_foundation_rollback.sql
-- Classification: Safe Structural Rollback
-- =====================================================================

BEGIN;

-- 1. DROP RLS POLICIES & TABLES
DROP TABLE IF EXISTS public.tally_unallocated_receipts CASCADE;
DROP TABLE IF EXISTS public.eway_bill_register CASCADE;
DROP TABLE IF EXISTS public.tally_customer_ledger_matches CASCADE;
DROP TABLE IF EXISTS public.tally_company_profiles CASCADE;

-- 2. DROP ADDED INDEXES ON PROJECTS
DROP INDEX IF EXISTS public.idx_projects_file_id;
DROP INDEX IF EXISTS public.idx_projects_sales_status;
DROP INDEX IF EXISTS public.idx_projects_fulfilment_status;
DROP INDEX IF EXISTS public.idx_projects_financial_status;
DROP INDEX IF EXISTS public.idx_projects_department_owner;

-- 3. DROP ADDED COLUMNS ON PROJECTS (OPTIONAL / NON-DESTRUCTIVE DEFAULT)
ALTER TABLE IF EXISTS public.projects
  DROP COLUMN IF EXISTS file_id,
  DROP COLUMN IF EXISTS sales_status,
  DROP COLUMN IF EXISTS fulfilment_status,
  DROP COLUMN IF EXISTS financial_status,
  DROP COLUMN IF EXISTS closure_category,
  DROP COLUMN IF EXISTS closure_reason,
  DROP COLUMN IF EXISTS closure_explanation,
  DROP COLUMN IF EXISTS closed_at,
  DROP COLUMN IF EXISTS closed_by,
  DROP COLUMN IF EXISTS is_ready_for_closure,
  DROP COLUMN IF EXISTS reopen_requested,
  DROP COLUMN IF EXISTS reopen_requested_by,
  DROP COLUMN IF EXISTS reopen_requested_at,
  DROP COLUMN IF EXISTS reopen_reason,
  DROP COLUMN IF EXISTS reopen_history,
  DROP COLUMN IF EXISTS file_owner_id,
  DROP COLUMN IF EXISTS file_owner_name,
  DROP COLUMN IF EXISTS department_owner,
  DROP COLUMN IF EXISTS ownership_history,
  DROP COLUMN IF EXISTS customer_po;

COMMIT;
