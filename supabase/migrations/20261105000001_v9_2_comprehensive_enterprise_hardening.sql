-- ==============================================================================
-- ICON TECH PRO ERP V9.2 — Master Comprehensive Enterprise Security Hardening
-- Migration Version: 20261105000001
-- Scope:
--   1. Strict Role-Aware & Non-Suspended Account Evaluation Functions (Zero Bypasses)
--   2. Universal RLS Enforcement across all 27 previously unprotected/zero-policy tables
--   3. Remediation of Permissive USING (true) policies with Granular Role-Based Boundaries
--   4. Covering B-Tree Indexes on High-Frequency Foreign Keys & Query Paths
--   5. Financial Precision & Non-Negative Data Integrity Constraints
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SECURITY FUNCTIONS: Active Non-Suspended User & Role Evaluation
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_is_active_non_suspended_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- Service role bypass for background workers & migrations
    IF current_user = 'service_role' OR auth.role() = 'service_role' THEN
        RETURN TRUE;
    END IF;

    -- Anonymous users are never active staff
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check user_profiles active status
    IF to_regclass('public.user_profiles') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
              AND is_active = TRUE
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Check account_security_records suspension status
    IF to_regclass('public.account_security_records') IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.account_security_records
            WHERE (user_id = auth.uid()::text OR email = auth.jwt() ->> 'email')
              AND is_suspended = TRUE
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_user_has_role(VARIADIC allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Service role bypass
    IF current_user = 'service_role' OR auth.role() = 'service_role' THEN
        RETURN TRUE;
    END IF;

    -- Anonymous users have no enterprise role
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Verify active non-suspended state first
    IF NOT public.fn_is_active_non_suspended_user() THEN
        RETURN FALSE;
    END IF;

    -- Resolve role from user_profiles joined to roles
    IF to_regclass('public.user_profiles') IS NOT NULL AND to_regclass('public.roles') IS NOT NULL THEN
        SELECT r.role_name INTO v_role
        FROM public.user_profiles up
        JOIN public.roles r ON up.role_id = r.id
        WHERE up.id = auth.uid();
    END IF;

    -- Fallback to immutable app_metadata in JWT if user_profiles query returned null
    IF v_role IS NULL THEN
        v_role := auth.jwt() -> 'app_metadata' ->> 'role';
    END IF;

    IF v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN v_role = ANY(allowed_roles);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_is_active_non_suspended_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_is_active_non_suspended_user() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_user_has_role(VARIADIC allowed_roles TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_user_has_role(VARIADIC allowed_roles TEXT[]) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. UNIVERSAL RLS ENFORCEMENT ON ALL REMAINING TABLES
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    tbl text;
    tables_to_enable text[] := ARRAY[
        'warranty_claims',
        'communication_inbox',
        'communication_templates',
        'ai_sales_sessions',
        'ai_sales_messages',
        'telephony_calls',
        'telephony_transcripts',
        'executive_briefings',
        'executive_schedule_configs',
        'promises_to_pay',
        'einvoice_records',
        'ewaybill_records',
        'voice_call_sessions',
        'employee_salary_history',
        'employee_attendance',
        'attendance_corrections',
        'employee_leaves',
        'payroll_runs',
        'payroll_items',
        'payslips',
        'offer_letters',
        'employee_documents',
        'hr_audit_events',
        'demo_feature_registry',
        'zoho_mail_users',
        'zoho_sync_schedules',
        'salary_structures',
        'tax_slabs',
        'quotation_version_snapshots',
        'quotation_templates',
        'proforma_invoices',
        'proforma_invoice_items',
        'delivery_challans',
        'delivery_challan_items',
        'credit_notes',
        'credit_note_items',
        'debit_notes',
        'debit_note_items',
        'payment_allocations',
        'supplier_payables_ledger',
        'customer_receivables_ledger'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_enable LOOP
        IF to_regclass('public.' || tbl) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. REMEDIATION OF BROAD & MISSING POLICIES WITH GRANULAR ROLE CONTROLS
-- ------------------------------------------------------------------------------

-- HR & Payroll Security: Strictly MD and Accounts
DO $$
BEGIN
    IF to_regclass('public.employee_salary_history') IS NOT NULL THEN
        DROP POLICY IF EXISTS "salary_history_select_policy" ON public.employee_salary_history;
        CREATE POLICY "salary_history_select_policy" ON public.employee_salary_history
            FOR SELECT TO authenticated
            USING (public.fn_user_has_role('Managing Director', 'Accounts'));

        DROP POLICY IF EXISTS "salary_history_modify_policy" ON public.employee_salary_history;
        CREATE POLICY "salary_history_modify_policy" ON public.employee_salary_history
            FOR ALL TO authenticated
            USING (public.fn_user_has_role('Managing Director'))
            WITH CHECK (public.fn_user_has_role('Managing Director'));
    END IF;

    IF to_regclass('public.payroll_runs') IS NOT NULL THEN
        DROP POLICY IF EXISTS "payroll_runs_select_policy" ON public.payroll_runs;
        CREATE POLICY "payroll_runs_select_policy" ON public.payroll_runs
            FOR SELECT TO authenticated
            USING (public.fn_user_has_role('Managing Director', 'Accounts'));

        DROP POLICY IF EXISTS "payroll_runs_modify_policy" ON public.payroll_runs;
        CREATE POLICY "payroll_runs_modify_policy" ON public.payroll_runs
            FOR ALL TO authenticated
            USING (public.fn_user_has_role('Managing Director', 'Accounts'))
            WITH CHECK (public.fn_user_has_role('Managing Director', 'Accounts'));
    END IF;

    IF to_regclass('public.payslips') IS NOT NULL THEN
        DROP POLICY IF EXISTS "payslips_select_policy" ON public.payslips;
        CREATE POLICY "payslips_select_policy" ON public.payslips
            FOR SELECT TO authenticated
            USING (
                public.fn_user_has_role('Managing Director', 'Accounts')
                OR employee_id = auth.uid()::text
            );
    END IF;
END $$;

-- Executive Briefings: Strictly MD and Admin / BDM
DO $$
BEGIN
    IF to_regclass('public.executive_briefings') IS NOT NULL THEN
        DROP POLICY IF EXISTS "executive_briefings_select_policy" ON public.executive_briefings;
        CREATE POLICY "executive_briefings_select_policy" ON public.executive_briefings
            FOR SELECT TO authenticated
            USING (public.fn_user_has_role('Managing Director', 'Admin / BDM'));

        DROP POLICY IF EXISTS "executive_briefings_all_policy" ON public.executive_briefings;
        CREATE POLICY "executive_briefings_all_policy" ON public.executive_briefings
            FOR ALL TO authenticated
            USING (public.fn_user_has_role('Managing Director', 'Admin / BDM'))
            WITH CHECK (public.fn_user_has_role('Managing Director', 'Admin / BDM'));
    END IF;

    IF to_regclass('public.executive_schedule_configs') IS NOT NULL THEN
        DROP POLICY IF EXISTS "executive_schedules_select_policy" ON public.executive_schedule_configs;
        CREATE POLICY "executive_schedules_select_policy" ON public.executive_schedule_configs
            FOR SELECT TO authenticated
            USING (public.fn_user_has_role('Managing Director', 'Admin / BDM'));

        DROP POLICY IF EXISTS "executive_schedules_all_policy" ON public.executive_schedule_configs;
        CREATE POLICY "executive_schedules_all_policy" ON public.executive_schedule_configs
            FOR ALL TO authenticated
            USING (public.fn_user_has_role('Managing Director'))
            WITH CHECK (public.fn_user_has_role('Managing Director'));
    END IF;
END $$;

-- Hardening Core Business Entities against Suspended Users & Unauthenticated Access
DO $$
BEGIN
    -- Customers
    IF to_regclass('public.customers') IS NOT NULL THEN
        DROP POLICY IF EXISTS "customers_select_policy" ON public.customers;
        CREATE POLICY "customers_select_policy" ON public.customers
            FOR SELECT TO authenticated
            USING (public.fn_is_active_non_suspended_user());

        DROP POLICY IF EXISTS "customers_modify_policy" ON public.customers;
        CREATE POLICY "customers_modify_policy" ON public.customers
            FOR UPDATE TO authenticated
            USING (public.fn_user_has_role('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts'))
            WITH CHECK (public.fn_user_has_role('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts'));
    END IF;

    -- Quotations & Quotation Items
    IF to_regclass('public.quotations') IS NOT NULL THEN
        DROP POLICY IF EXISTS "quotations_select_policy" ON public.quotations;
        CREATE POLICY "quotations_select_policy" ON public.quotations
            FOR SELECT TO authenticated
            USING (public.fn_is_active_non_suspended_user());

        DROP POLICY IF EXISTS "quotations_modify_policy" ON public.quotations;
        CREATE POLICY "quotations_modify_policy" ON public.quotations
            FOR UPDATE TO authenticated
            USING (public.fn_user_has_role('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'))
            WITH CHECK (public.fn_user_has_role('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'));
    END IF;

    -- Technical Evaluations
    IF to_regclass('public.technical_evaluations') IS NOT NULL THEN
        DROP POLICY IF EXISTS "technical_evaluations_select_policy" ON public.technical_evaluations;
        CREATE POLICY "technical_evaluations_select_policy" ON public.technical_evaluations
            FOR SELECT TO authenticated
            USING (public.fn_is_active_non_suspended_user());

        DROP POLICY IF EXISTS "technical_evaluations_modify_policy" ON public.technical_evaluations;
        CREATE POLICY "technical_evaluations_modify_policy" ON public.technical_evaluations
            FOR UPDATE TO authenticated
            USING (public.fn_user_has_role('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Service Engineer'))
            WITH CHECK (public.fn_user_has_role('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Service Engineer'));
    END IF;

    -- Invoices & Receivables
    IF to_regclass('public.invoices') IS NOT NULL THEN
        DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
        CREATE POLICY "invoices_select_policy" ON public.invoices
            FOR SELECT TO authenticated
            USING (public.fn_is_active_non_suspended_user());

        DROP POLICY IF EXISTS "invoices_modify_policy" ON public.invoices;
        CREATE POLICY "invoices_modify_policy" ON public.invoices
            FOR UPDATE TO authenticated
            USING (public.fn_user_has_role('Managing Director', 'Admin / BDM', 'Accounts'))
            WITH CHECK (public.fn_user_has_role('Managing Director', 'Admin / BDM', 'Accounts'));
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. HIGH-PERFORMANCE COVERING INDEXES ON FOREIGN KEYS & FILTER PATHS
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    -- Quotation & Items
    IF to_regclass('public.quotations') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON public.quotations (customer_id);
        CREATE INDEX IF NOT EXISTS idx_quotations_enquiry_id ON public.quotations (enquiry_id);
        CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations (status);
        CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON public.quotations (created_at DESC);
    END IF;

    IF to_regclass('public.quotation_items') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON public.quotation_items (quotation_id);
        CREATE INDEX IF NOT EXISTS idx_quotation_items_product_id ON public.quotation_items (product_id);
    END IF;

    -- Site Visits & Technical Evaluations
    IF to_regclass('public.site_visits') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_site_visits_customer_id ON public.site_visits (customer_id);
        CREATE INDEX IF NOT EXISTS idx_site_visits_enquiry_id ON public.site_visits (enquiry_id);
        CREATE INDEX IF NOT EXISTS idx_site_visits_assigned_to ON public.site_visits (assigned_to);
    END IF;

    IF to_regclass('public.technical_evaluations') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_tech_eval_customer_id ON public.technical_evaluations (customer_id);
        CREATE INDEX IF NOT EXISTS idx_tech_eval_enquiry_id ON public.technical_evaluations (enquiry_id);
        CREATE INDEX IF NOT EXISTS idx_tech_eval_site_visit_id ON public.technical_evaluations (site_visit_id);
    END IF;

    -- Invoices, Proformas, Challans & Payments
    IF to_regclass('public.invoices') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices (customer_id);
        CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices (order_id);
        CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
    END IF;

    IF to_regclass('public.proforma_invoices') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_proforma_customer_id ON public.proforma_invoices (customer_id);
        CREATE INDEX IF NOT EXISTS idx_proforma_quotation_id ON public.proforma_invoices (quotation_id);
    END IF;

    IF to_regclass('public.delivery_challans') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_challans_customer_id ON public.delivery_challans (customer_id);
        CREATE INDEX IF NOT EXISTS idx_challans_quotation_id ON public.delivery_challans (quotation_id);
    END IF;

    IF to_regclass('public.payments') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments (invoice_id);
        CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments (customer_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. FINANCIAL PRECISION & INTEGRITY CHECK CONSTRAINTS
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    -- Quotation non-negative amounts
    IF to_regclass('public.quotations') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_quotations_grand_total_positive') THEN
            ALTER TABLE public.quotations ADD CONSTRAINT chk_quotations_grand_total_positive CHECK (grand_total >= 0);
        END IF;
    END IF;

    -- Invoice non-negative amounts
    IF to_regclass('public.invoices') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_grand_total_positive') THEN
            ALTER TABLE public.invoices ADD CONSTRAINT chk_invoices_grand_total_positive CHECK (grand_total >= 0);
        END IF;
    END IF;

    -- Payment amount positive
    IF to_regclass('public.payments') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_amount_positive') THEN
            ALTER TABLE public.payments ADD CONSTRAINT chk_payments_amount_positive CHECK (amount > 0);
        END IF;
    END IF;
END $$;

COMMIT;
