-- ==============================================================================
-- ICON TECH PRO ERP V9.2 — Master Comprehensive Enterprise Security Hardening Rollback
-- Migration Version: 20261105000001_rollback
-- Scope: Safely reverses migration 20261105000001 without data loss
-- ==============================================================================

BEGIN;

-- 1. Drop check constraints
DO $$
BEGIN
    IF to_regclass('public.quotations') IS NOT NULL THEN
        ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS chk_quotations_grand_total_positive;
    END IF;
    IF to_regclass('public.invoices') IS NOT NULL THEN
        ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS chk_invoices_grand_total_positive;
    END IF;
    IF to_regclass('public.payments') IS NOT NULL THEN
        ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS chk_payments_amount_positive;
    END IF;
END $$;

-- 2. Drop added indexes
DROP INDEX IF EXISTS idx_quotations_customer_id;
DROP INDEX IF EXISTS idx_quotations_enquiry_id;
DROP INDEX IF EXISTS idx_quotations_status;
DROP INDEX IF EXISTS idx_quotations_created_at;
DROP INDEX IF EXISTS idx_quotation_items_quotation_id;
DROP INDEX IF EXISTS idx_quotation_items_product_id;
DROP INDEX IF EXISTS idx_site_visits_customer_id;
DROP INDEX IF EXISTS idx_site_visits_enquiry_id;
DROP INDEX IF EXISTS idx_site_visits_assigned_to;
DROP INDEX IF EXISTS idx_tech_eval_customer_id;
DROP INDEX IF EXISTS idx_tech_eval_enquiry_id;
DROP INDEX IF EXISTS idx_tech_eval_site_visit_id;
DROP INDEX IF EXISTS idx_invoices_customer_id;
DROP INDEX IF EXISTS idx_invoices_order_id;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_proforma_customer_id;
DROP INDEX IF EXISTS idx_proforma_quotation_id;
DROP INDEX IF EXISTS idx_challans_customer_id;
DROP INDEX IF EXISTS idx_challans_quotation_id;
DROP INDEX IF EXISTS idx_payments_invoice_id;
DROP INDEX IF EXISTS idx_payments_customer_id;

-- 3. Drop added security policies
DROP POLICY IF EXISTS "salary_history_select_policy" ON public.employee_salary_history;
DROP POLICY IF EXISTS "salary_history_modify_policy" ON public.employee_salary_history;
DROP POLICY IF EXISTS "payroll_runs_select_policy" ON public.payroll_runs;
DROP POLICY IF EXISTS "payroll_runs_modify_policy" ON public.payroll_runs;
DROP POLICY IF EXISTS "payslips_select_policy" ON public.payslips;
DROP POLICY IF EXISTS "executive_briefings_select_policy" ON public.executive_briefings;
DROP POLICY IF EXISTS "executive_briefings_all_policy" ON public.executive_briefings;
DROP POLICY IF EXISTS "executive_schedules_select_policy" ON public.executive_schedule_configs;
DROP POLICY IF EXISTS "executive_schedules_all_policy" ON public.executive_schedule_configs;
DROP POLICY IF EXISTS "customers_modify_policy" ON public.customers;
DROP POLICY IF EXISTS "quotations_modify_policy" ON public.quotations;
DROP POLICY IF EXISTS "technical_evaluations_modify_policy" ON public.technical_evaluations;
DROP POLICY IF EXISTS "invoices_modify_policy" ON public.invoices;

-- 4. Drop helper security functions
DROP FUNCTION IF EXISTS public.fn_user_has_role(VARIADIC TEXT[]);
DROP FUNCTION IF EXISTS public.fn_is_active_non_suspended_user();

COMMIT;
