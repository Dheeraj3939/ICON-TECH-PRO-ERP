-- ==============================================================================
-- ICON TECH PRO ERP V9.2 — GATE C DATABASE LEAST-PRIVILEGE REMEDIATION
-- Target Environment: UAT Supabase (njylssodwvaonbeebvjq)
-- STRICTLY EXCLUDES Production (xogynsnfzsvimwtvvhpx)
-- Ground Truth: Verified against 47 live exposed tables in UAT OpenAPI schema
-- Concurrency & Sequencing: Fully compatible with src/lib/utils/sequence.ts
-- Commercial Isolation: Enforces RBAC; shields costs & margins from unauthorized roles
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- SECTION 1: SCHEMA GRANTS & ANONYMOUS ACCESS ELIMINATION
-- ==============================================================================

-- Completely revoke all privileges on all objects from anon
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
REVOKE USAGE ON SCHEMA public FROM anon;

-- Ensure schema usage for authenticated, service_role, and authenticator
GRANT USAGE ON SCHEMA public TO authenticated, service_role, authenticator;

-- Grant baseline DML to authenticated (strictly scoped and enforced by RLS policies below)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Explicitly revoke INSERT, UPDATE, DELETE on audit logs from authenticated (Audit Integrity)
-- System audit trails are strictly appended via SECURITY DEFINER triggers and server-side service_role
REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.security_audit_logs FROM authenticated;

-- Ensure service_role retains full administrative maintenance access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- ==============================================================================
-- SECTION 2: CONCURRENCY-SAFE SEQUENCE ENCAPSULATION & PROCEDURE COMPATIBILITY
-- Protects sequence tracking tables from direct client tampering.
-- Fully compatible with src/lib/utils/sequence.ts callers and Indian FY formatting.
-- ==============================================================================

-- Revoke direct DML on sequence tables from authenticated; grant SELECT only
REVOKE ALL ON TABLE public.document_sequences FROM authenticated;
REVOKE ALL ON TABLE public.customer_id_sequences FROM authenticated;
GRANT SELECT ON TABLE public.document_sequences TO authenticated;
GRANT SELECT ON TABLE public.customer_id_sequences TO authenticated;

-- Drop legacy sequence function signatures to eliminate ambiguous RPC resolution (without CASCADE to protect dependents)
DROP FUNCTION IF EXISTS public.get_next_sequence_code(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.get_next_sequence_code(VARCHAR, CHAR);
DROP FUNCTION IF EXISTS public.get_next_sequence_code(VARCHAR);
DROP FUNCTION IF EXISTS public.generate_next_document_code(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.generate_next_document_code(VARCHAR);

-- Hardened get_next_sequence_code compatible with sequence.ts fetchDatabaseSequence
CREATE OR REPLACE FUNCTION public.get_next_sequence_code(
  p_doc_type VARCHAR,
  p_prefix VARCHAR DEFAULT NULL
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw_type VARCHAR(20);
  v_doc_type VARCHAR(20);
  v_year_prefix CHAR(2);
  v_next_year_prefix CHAR(2);
  v_fy VARCHAR(10);
  v_curr_seq INT;
  v_next_seq INT;
BEGIN
  v_raw_type := UPPER(TRIM(p_doc_type));

  -- Normalize aliases to canonical ERP sequence keys used across modules
  IF v_raw_type = 'SERVICE' THEN
    v_doc_type := 'SRV';
  ELSIF v_raw_type = 'RENTAL' THEN
    v_doc_type := 'RNT';
  ELSIF v_raw_type = 'INSTALLATION' THEN
    v_doc_type := 'INS';
  ELSIF v_raw_type = 'DSP' THEN
    v_doc_type := 'DC';
  ELSE
    v_doc_type := v_raw_type;
  END IF;

  -- Whitelist validation covering all canonical ERP document types actually used
  IF v_doc_type NOT IN (
    'CUSTOMER', 'ENQ', 'QT', 'SO', 'INV', 'PAY', 'PO', 'DC',
    'GRN', 'APR', 'TSK', 'CN', 'DN', 'PI', 'SRV', 'RNT', 'AMC', 'INS'
  ) THEN
    RAISE EXCEPTION 'Invalid document type "%". Allowed types: CUSTOMER, ENQ, QT, SO, INV, PAY, PO, DC, GRN, APR, TSK, CN, DN, PI, SRV (SERVICE), RNT (RENTAL), AMC, INS (INSTALLATION)', p_doc_type;
  END IF;

  -- 2-digit Indian financial year prefix (FY runs April 1 to March 31)
  -- If current month is Jan, Feb, or Mar (months 1-3), FY started in previous calendar year
  IF EXTRACT(MONTH FROM CURRENT_DATE) < 4 THEN
    v_year_prefix := TO_CHAR(CURRENT_DATE - INTERVAL '1 year', 'YY');
  ELSE
    v_year_prefix := TO_CHAR(CURRENT_DATE, 'YY');
  END IF;
  v_next_year_prefix := LPAD(((v_year_prefix::INT + 1) % 100)::TEXT, 2, '0');
  v_fy := v_year_prefix || '-' || v_next_year_prefix;

  -- 1. Handle CUSTOMER sequence table (ICON{YY}{0001})
  IF v_doc_type = 'CUSTOMER' THEN
    SELECT last_sequence INTO v_curr_seq
    FROM public.customer_id_sequences
    WHERE year_prefix = v_year_prefix
    FOR UPDATE;

    IF NOT FOUND THEN
      v_next_seq := 1;
      INSERT INTO public.customer_id_sequences (year_prefix, last_sequence, updated_at)
      VALUES (v_year_prefix, v_next_seq, NOW());
    ELSE
      v_next_seq := v_curr_seq + 1;
      UPDATE public.customer_id_sequences
      SET last_sequence = v_next_seq, updated_at = NOW()
      WHERE year_prefix = v_year_prefix;
    END IF;

    IF p_prefix IS NOT NULL AND p_prefix <> '' THEN
      RETURN p_prefix || LPAD(v_next_seq::TEXT, 4, '0');
    ELSE
      RETURN 'ICON' || v_year_prefix || LPAD(v_next_seq::TEXT, 4, '0');
    END IF;
  END IF;

  -- 2. Handle general document sequence table
  SELECT last_sequence INTO v_curr_seq
  FROM public.document_sequences
  WHERE doc_type IN (v_doc_type, v_raw_type) AND year_prefix = v_year_prefix
  ORDER BY (doc_type = v_doc_type) DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    v_next_seq := 1;
    INSERT INTO public.document_sequences (doc_type, year_prefix, last_sequence, updated_at)
    VALUES (v_doc_type, v_year_prefix, v_next_seq, NOW());
  ELSE
    v_next_seq := v_curr_seq + 1;
    UPDATE public.document_sequences
    SET last_sequence = v_next_seq, updated_at = NOW()
    WHERE doc_type IN (v_doc_type, v_raw_type) AND year_prefix = v_year_prefix;
  END IF;

  -- 3. Output formatting matching sequence.ts callers:
  -- If caller passed a structured prefix (e.g. 'ICON/26-27/QT-', 'ICON/26-27/SRV-'), append sequence:
  IF p_prefix IS NOT NULL AND p_prefix <> '' THEN
    RETURN p_prefix || LPAD(v_next_seq::TEXT, 4, '0');
  END IF;

  -- Default canonical format if called without prefix:
  RETURN 'ICON/' || v_fy || '/' || v_doc_type || '-' || LPAD(v_next_seq::TEXT, 4, '0');
END;
$$;

-- Compatible wrapper procedure
CREATE OR REPLACE FUNCTION public.generate_next_document_code(
  p_doc_type VARCHAR,
  p_prefix VARCHAR DEFAULT NULL
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.get_next_sequence_code(p_doc_type, p_prefix);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_sequence_code(VARCHAR, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_next_document_code(VARCHAR, VARCHAR) TO authenticated, service_role;

-- ==============================================================================
-- SECTION 3: ENABLE RLS ON ALL 47 VERIFIED TABLES IN UAT
-- ==============================================================================

ALTER TABLE public.amc_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_id_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- Note: products_catalog is a view (defined in M06), not a physical table; RLS is not enabled on views
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_communication_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- SECTION 4: USER PROFILES — STRICT PRIVACY
-- ==============================================================================

DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON public.user_profiles;

CREATE POLICY "user_profiles_select_policy" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

CREATE POLICY "user_profiles_insert_policy" ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

CREATE POLICY "user_profiles_update_policy" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR current_erp_role() IN ('Managing Director', 'Admin / BDM')
  )
  WITH CHECK (
    id = auth.uid()
    OR current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

CREATE POLICY "user_profiles_delete_policy" ON public.user_profiles
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- ==============================================================================
-- SECTION 5: AUDIT LOGS — APPEND-ONLY IMMUTABILITY
-- ==============================================================================

DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "security_audit_logs_select_policy" ON public.security_audit_logs;
DROP POLICY IF EXISTS "security_audit_logs_insert_policy" ON public.security_audit_logs;

CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

-- Note: Zero INSERT, UPDATE, or DELETE policies are granted to authenticated on audit_logs.
-- Legitimate system audit records are strictly written via SECURITY DEFINER trigger (log_audit_trail)
-- or server-side service_role (src/lib/audit/logger.ts), eliminating client-side actor forgery.

CREATE POLICY "security_audit_logs_select_policy" ON public.security_audit_logs
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

-- Note: Zero INSERT, UPDATE, or DELETE policies are granted to authenticated on security_audit_logs.
-- Client-side security event forgery is blocked; administrative security logging uses service_role.

-- ==============================================================================
-- SECTION 6: COMMERCIAL CONFIDENTIALITY — PURCHASING, QUOTATIONS & ORDERS
-- Shields internal margins and purchase costs from Office Assistant and lower roles
-- ==============================================================================

-- 1. Product Suppliers (Vendor Cost Confidentiality)
DROP POLICY IF EXISTS "product_suppliers_select_policy" ON public.product_suppliers;
DROP POLICY IF EXISTS "product_suppliers_insert_policy" ON public.product_suppliers;
DROP POLICY IF EXISTS "product_suppliers_update_policy" ON public.product_suppliers;
DROP POLICY IF EXISTS "product_suppliers_delete_policy" ON public.product_suppliers;

CREATE POLICY "product_suppliers_select_policy" ON public.product_suppliers
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
  );

CREATE POLICY "product_suppliers_insert_policy" ON public.product_suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "product_suppliers_update_policy" ON public.product_suppliers
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "product_suppliers_delete_policy" ON public.product_suppliers
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- 2. Quotations & Items (Office Assistant Excluded from Commercial Quoting Data)
DROP POLICY IF EXISTS "quotations_select_policy" ON public.quotations;
DROP POLICY IF EXISTS "quotations_insert_policy" ON public.quotations;
DROP POLICY IF EXISTS "quotations_update_policy" ON public.quotations;
DROP POLICY IF EXISTS "quotations_delete_policy" ON public.quotations;

CREATE POLICY "quotations_select_policy" ON public.quotations
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts')
  );

CREATE POLICY "quotations_insert_policy" ON public.quotations
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive')
  );

CREATE POLICY "quotations_update_policy" ON public.quotations
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive')
  );

CREATE POLICY "quotations_delete_policy" ON public.quotations
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

DROP POLICY IF EXISTS "quotation_items_select_policy" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_insert_policy" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_update_policy" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_delete_policy" ON public.quotation_items;

CREATE POLICY "quotation_items_select_policy" ON public.quotation_items
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts')
  );

CREATE POLICY "quotation_items_insert_policy" ON public.quotation_items
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive')
  );

CREATE POLICY "quotation_items_update_policy" ON public.quotation_items
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive')
  );

CREATE POLICY "quotation_items_delete_policy" ON public.quotation_items
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- 3. Sales Orders & Items (Commercial Contract Data: Sales Exec & OA Excluded from DB Read)
DROP POLICY IF EXISTS "sales_orders_select_policy" ON public.sales_orders;
DROP POLICY IF EXISTS "sales_orders_insert_policy" ON public.sales_orders;
DROP POLICY IF EXISTS "sales_orders_update_policy" ON public.sales_orders;
DROP POLICY IF EXISTS "sales_orders_delete_policy" ON public.sales_orders;

CREATE POLICY "sales_orders_select_policy" ON public.sales_orders
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
  );

CREATE POLICY "sales_orders_insert_policy" ON public.sales_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM')
  );

CREATE POLICY "sales_orders_update_policy" ON public.sales_orders
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM')
  );

CREATE POLICY "sales_orders_delete_policy" ON public.sales_orders
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

DROP POLICY IF EXISTS "sales_order_items_select_policy" ON public.sales_order_items;
DROP POLICY IF EXISTS "sales_order_items_insert_policy" ON public.sales_order_items;
DROP POLICY IF EXISTS "sales_order_items_update_policy" ON public.sales_order_items;
DROP POLICY IF EXISTS "sales_order_items_delete_policy" ON public.sales_order_items;

CREATE POLICY "sales_order_items_select_policy" ON public.sales_order_items
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
  );

CREATE POLICY "sales_order_items_insert_policy" ON public.sales_order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM')
  );

CREATE POLICY "sales_order_items_update_policy" ON public.sales_order_items
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM')
  );

CREATE POLICY "sales_order_items_delete_policy" ON public.sales_order_items
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- 4. AMC Contracts (Commercial Values & Renewal Terms: OA Excluded)
DROP POLICY IF EXISTS "amc_contracts_select_policy" ON public.amc_contracts;
DROP POLICY IF EXISTS "amc_contracts_insert_policy" ON public.amc_contracts;
DROP POLICY IF EXISTS "amc_contracts_update_policy" ON public.amc_contracts;
DROP POLICY IF EXISTS "amc_contracts_delete_policy" ON public.amc_contracts;

CREATE POLICY "amc_contracts_select_policy" ON public.amc_contracts
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
  );

CREATE POLICY "amc_contracts_insert_policy" ON public.amc_contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM')
  );

CREATE POLICY "amc_contracts_update_policy" ON public.amc_contracts
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

CREATE POLICY "amc_contracts_delete_policy" ON public.amc_contracts
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- ==============================================================================
-- SECTION 7: BILLING & PAYMENT COLLECTIONS
-- ==============================================================================

-- Invoices & Items
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;

CREATE POLICY "invoices_select_policy" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts', 'Sales Executive')
  );

CREATE POLICY "invoices_insert_policy" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "invoices_update_policy" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "invoices_delete_policy" ON public.invoices
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

DROP POLICY IF EXISTS "invoice_items_select_policy" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert_policy" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_update_policy" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_delete_policy" ON public.invoice_items;

CREATE POLICY "invoice_items_select_policy" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts', 'Sales Executive')
  );

CREATE POLICY "invoice_items_insert_policy" ON public.invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "invoice_items_update_policy" ON public.invoice_items
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "invoice_items_delete_policy" ON public.invoice_items
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Payments
DROP POLICY IF EXISTS "payments_select_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_update_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_policy" ON public.payments;

CREATE POLICY "payments_select_policy" ON public.payments
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
  );

CREATE POLICY "payments_insert_policy" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "payments_update_policy" ON public.payments
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "payments_delete_policy" ON public.payments
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- ==============================================================================
-- SECTION 8: COLLABORATIVE OPERATIONS & FIELD SERVICE
-- ==============================================================================

-- Customers
DROP POLICY IF EXISTS "customers_select_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_update_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_policy" ON public.customers;

CREATE POLICY "customers_select_policy" ON public.customers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "customers_insert_policy" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
  );

CREATE POLICY "customers_update_policy" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
  );

CREATE POLICY "customers_delete_policy" ON public.customers
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Enquiries
DROP POLICY IF EXISTS "enquiries_select_policy" ON public.enquiries;
DROP POLICY IF EXISTS "enquiries_insert_policy" ON public.enquiries;
DROP POLICY IF EXISTS "enquiries_update_policy" ON public.enquiries;
DROP POLICY IF EXISTS "enquiries_delete_policy" ON public.enquiries;

CREATE POLICY "enquiries_select_policy" ON public.enquiries
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "enquiries_insert_policy" ON public.enquiries
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
  );

CREATE POLICY "enquiries_update_policy" ON public.enquiries
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
  );

CREATE POLICY "enquiries_delete_policy" ON public.enquiries
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Dispatches
DROP POLICY IF EXISTS "dispatches_select_policy" ON public.dispatches;
DROP POLICY IF EXISTS "dispatches_insert_policy" ON public.dispatches;
DROP POLICY IF EXISTS "dispatches_update_policy" ON public.dispatches;
DROP POLICY IF EXISTS "dispatches_delete_policy" ON public.dispatches;

CREATE POLICY "dispatches_select_policy" ON public.dispatches
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dispatches_insert_policy" ON public.dispatches
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant', 'Sales Executive')
  );

CREATE POLICY "dispatches_update_policy" ON public.dispatches
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant')
  );

CREATE POLICY "dispatches_delete_policy" ON public.dispatches
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Service Tickets
DROP POLICY IF EXISTS "service_tickets_select_policy" ON public.service_tickets;
DROP POLICY IF EXISTS "service_tickets_insert_policy" ON public.service_tickets;
DROP POLICY IF EXISTS "service_tickets_update_policy" ON public.service_tickets;
DROP POLICY IF EXISTS "service_tickets_delete_policy" ON public.service_tickets;

CREATE POLICY "service_tickets_select_policy" ON public.service_tickets
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "service_tickets_insert_policy" ON public.service_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant', 'Sales Executive')
  );

CREATE POLICY "service_tickets_update_policy" ON public.service_tickets
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant')
  );

CREATE POLICY "service_tickets_delete_policy" ON public.service_tickets
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Installations
DROP POLICY IF EXISTS "installations_select_policy" ON public.installations;
DROP POLICY IF EXISTS "installations_insert_policy" ON public.installations;
DROP POLICY IF EXISTS "installations_update_policy" ON public.installations;
DROP POLICY IF EXISTS "installations_delete_policy" ON public.installations;

CREATE POLICY "installations_select_policy" ON public.installations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "installations_insert_policy" ON public.installations
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant')
  );

CREATE POLICY "installations_update_policy" ON public.installations
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant')
  );

CREATE POLICY "installations_delete_policy" ON public.installations
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Site Visits
DROP POLICY IF EXISTS "site_visits_select_policy" ON public.site_visits;
DROP POLICY IF EXISTS "site_visits_insert_policy" ON public.site_visits;
DROP POLICY IF EXISTS "site_visits_update_policy" ON public.site_visits;
DROP POLICY IF EXISTS "site_visits_delete_policy" ON public.site_visits;

CREATE POLICY "site_visits_select_policy" ON public.site_visits
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "site_visits_insert_policy" ON public.site_visits
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
  );

CREATE POLICY "site_visits_update_policy" ON public.site_visits
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
  );

CREATE POLICY "site_visits_delete_policy" ON public.site_visits
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Follow-ups
DROP POLICY IF EXISTS "follow_ups_select_policy" ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_insert_policy" ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_update_policy" ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_delete_policy" ON public.follow_ups;

CREATE POLICY "follow_ups_select_policy" ON public.follow_ups
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "follow_ups_insert_policy" ON public.follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
  );

CREATE POLICY "follow_ups_update_policy" ON public.follow_ups
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
  );

CREATE POLICY "follow_ups_delete_policy" ON public.follow_ups
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Equipment Rentals (Hire rate protection: commercial roles only)
DROP POLICY IF EXISTS "equipment_rentals_select_policy" ON public.equipment_rentals;
DROP POLICY IF EXISTS "equipment_rentals_insert_policy" ON public.equipment_rentals;
DROP POLICY IF EXISTS "equipment_rentals_update_policy" ON public.equipment_rentals;
DROP POLICY IF EXISTS "equipment_rentals_delete_policy" ON public.equipment_rentals;

CREATE POLICY "equipment_rentals_select_policy" ON public.equipment_rentals
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
  );

CREATE POLICY "equipment_rentals_insert_policy" ON public.equipment_rentals
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

CREATE POLICY "equipment_rentals_update_policy" ON public.equipment_rentals
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

CREATE POLICY "equipment_rentals_delete_policy" ON public.equipment_rentals
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- ==============================================================================
-- SECTION 9: INVENTORY, SERIALS & STOCK MOVEMENTS
-- ==============================================================================

-- Products
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
DROP POLICY IF EXISTS "products_update_policy" ON public.products;
DROP POLICY IF EXISTS "products_delete_policy" ON public.products;

-- Products (Cost Confidentiality: purchase_price, target_margin_pct, supplier_name, purchase_depot)
-- Direct SELECT on products table is strictly restricted to commercial roles.
-- Non-commercial roles (Office Assistant, Sales Executive, Field Engineer, Store Keeper) browse
-- catalog equipment via public.products_catalog view, which safely omits purchase costs and margins.
CREATE POLICY "products_select_policy" ON public.products
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
  );

CREATE POLICY "products_insert_policy" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

CREATE POLICY "products_update_policy" ON public.products
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

CREATE POLICY "products_delete_policy" ON public.products
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Inventory Stock
DROP POLICY IF EXISTS "inventory_stock_select_policy" ON public.inventory_stock;
DROP POLICY IF EXISTS "inventory_stock_insert_policy" ON public.inventory_stock;
DROP POLICY IF EXISTS "inventory_stock_update_policy" ON public.inventory_stock;
DROP POLICY IF EXISTS "inventory_stock_delete_policy" ON public.inventory_stock;

CREATE POLICY "inventory_stock_select_policy" ON public.inventory_stock
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "inventory_stock_insert_policy" ON public.inventory_stock
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts', 'Office Assistant')
  );

CREATE POLICY "inventory_stock_update_policy" ON public.inventory_stock
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "inventory_stock_delete_policy" ON public.inventory_stock
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Inventory Serials & Serial Records
DROP POLICY IF EXISTS "inventory_serials_select_policy" ON public.inventory_serials;
DROP POLICY IF EXISTS "inventory_serials_insert_policy" ON public.inventory_serials;
DROP POLICY IF EXISTS "inventory_serials_update_policy" ON public.inventory_serials;
DROP POLICY IF EXISTS "inventory_serials_delete_policy" ON public.inventory_serials;

CREATE POLICY "inventory_serials_select_policy" ON public.inventory_serials
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "inventory_serials_insert_policy" ON public.inventory_serials
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant', 'Accounts', 'BDM')
  );

CREATE POLICY "inventory_serials_update_policy" ON public.inventory_serials
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant')
  );

CREATE POLICY "inventory_serials_delete_policy" ON public.inventory_serials
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

DROP POLICY IF EXISTS "serial_records_select_policy" ON public.serial_records;
DROP POLICY IF EXISTS "serial_records_insert_policy" ON public.serial_records;
DROP POLICY IF EXISTS "serial_records_update_policy" ON public.serial_records;
DROP POLICY IF EXISTS "serial_records_delete_policy" ON public.serial_records;

CREATE POLICY "serial_records_select_policy" ON public.serial_records
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "serial_records_insert_policy" ON public.serial_records
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant', 'Accounts', 'BDM')
  );

CREATE POLICY "serial_records_update_policy" ON public.serial_records
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Office Assistant')
  );

CREATE POLICY "serial_records_delete_policy" ON public.serial_records
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Stock Movements & Inventory Transactions (Immutable Ledgers)
DROP POLICY IF EXISTS "stock_movements_select_policy" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert_policy" ON public.stock_movements;
DROP POLICY IF EXISTS "inventory_transactions_select_policy" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_insert_policy" ON public.inventory_transactions;

CREATE POLICY "stock_movements_select_policy" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "stock_movements_insert_policy" ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts', 'Office Assistant')
  );

CREATE POLICY "inventory_transactions_select_policy" ON public.inventory_transactions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "inventory_transactions_insert_policy" ON public.inventory_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

-- ==============================================================================
-- SECTION 10: PROCUREMENT & VENDOR SOURCING
-- ==============================================================================

-- Suppliers
DROP POLICY IF EXISTS "suppliers_select_policy" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert_policy" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update_policy" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_delete_policy" ON public.suppliers;

-- Suppliers (Confidentiality: payment_terms_days, GSTIN, PAN, and vendor contact records)
-- Restricted to procurement, accounts, warehouse, and management roles
CREATE POLICY "suppliers_select_policy" ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts', 'Store Keeper', 'BDM')
  );

CREATE POLICY "suppliers_insert_policy" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "suppliers_update_policy" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "suppliers_delete_policy" ON public.suppliers
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Purchase Orders & Items
DROP POLICY IF EXISTS "purchase_orders_select_policy" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_insert_policy" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_update_policy" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_delete_policy" ON public.purchase_orders;

CREATE POLICY "purchase_orders_select_policy" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts', 'BDM')
  );

CREATE POLICY "purchase_orders_insert_policy" ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "purchase_orders_update_policy" ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "purchase_orders_delete_policy" ON public.purchase_orders
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

DROP POLICY IF EXISTS "purchase_order_items_select_policy" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_insert_policy" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_update_policy" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_delete_policy" ON public.purchase_order_items;

CREATE POLICY "purchase_order_items_select_policy" ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts', 'BDM')
  );

CREATE POLICY "purchase_order_items_insert_policy" ON public.purchase_order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "purchase_order_items_update_policy" ON public.purchase_order_items
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts')
  );

CREATE POLICY "purchase_order_items_delete_policy" ON public.purchase_order_items
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- Goods Receipt Notes (GRN)
DROP POLICY IF EXISTS "goods_receipt_notes_select_policy" ON public.goods_receipt_notes;
DROP POLICY IF EXISTS "goods_receipt_notes_insert_policy" ON public.goods_receipt_notes;
DROP POLICY IF EXISTS "goods_receipt_notes_update_policy" ON public.goods_receipt_notes;
DROP POLICY IF EXISTS "goods_receipt_notes_delete_policy" ON public.goods_receipt_notes;

CREATE POLICY "goods_receipt_notes_select_policy" ON public.goods_receipt_notes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "goods_receipt_notes_insert_policy" ON public.goods_receipt_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts', 'Office Assistant')
  );

CREATE POLICY "goods_receipt_notes_update_policy" ON public.goods_receipt_notes
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts', 'Office Assistant')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'Accounts', 'Office Assistant')
  );

CREATE POLICY "goods_receipt_notes_delete_policy" ON public.goods_receipt_notes
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

-- ==============================================================================
-- SECTION 11: REFERENCE CATALOGS & WAREHOUSES
-- ==============================================================================

-- Product Brands
DROP POLICY IF EXISTS "product_brands_select_policy" ON public.product_brands;
DROP POLICY IF EXISTS "product_brands_insert_policy" ON public.product_brands;
DROP POLICY IF EXISTS "product_brands_update_policy" ON public.product_brands;
DROP POLICY IF EXISTS "product_brands_delete_policy" ON public.product_brands;

CREATE POLICY "product_brands_select_policy" ON public.product_brands
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "product_brands_insert_policy" ON public.product_brands
  FOR INSERT TO authenticated WITH CHECK (current_erp_role() IN ('Managing Director', 'Admin / BDM'));

CREATE POLICY "product_brands_update_policy" ON public.product_brands
  FOR UPDATE TO authenticated
  USING (current_erp_role() IN ('Managing Director', 'Admin / BDM'))
  WITH CHECK (current_erp_role() IN ('Managing Director', 'Admin / BDM'));

CREATE POLICY "product_brands_delete_policy" ON public.product_brands
  FOR DELETE TO authenticated USING (current_erp_role() = 'Managing Director');

-- Product Categories
DROP POLICY IF EXISTS "product_categories_select_policy" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_insert_policy" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_update_policy" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_delete_policy" ON public.product_categories;

CREATE POLICY "product_categories_select_policy" ON public.product_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "product_categories_insert_policy" ON public.product_categories
  FOR INSERT TO authenticated WITH CHECK (current_erp_role() IN ('Managing Director', 'Admin / BDM'));

CREATE POLICY "product_categories_update_policy" ON public.product_categories
  FOR UPDATE TO authenticated
  USING (current_erp_role() IN ('Managing Director', 'Admin / BDM'))
  WITH CHECK (current_erp_role() IN ('Managing Director', 'Admin / BDM'));

CREATE POLICY "product_categories_delete_policy" ON public.product_categories
  FOR DELETE TO authenticated USING (current_erp_role() = 'Managing Director');

-- Products Catalog View (Public catalog view defined in M06 omitting purchase costs and margins)
-- Enables all authenticated staff to browse equipment catalog safely without cost exposure
GRANT SELECT ON public.products_catalog TO authenticated;

-- Warehouses
DROP POLICY IF EXISTS "warehouses_select_policy" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_insert_policy" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_update_policy" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_delete_policy" ON public.warehouses;

CREATE POLICY "warehouses_select_policy" ON public.warehouses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "warehouses_insert_policy" ON public.warehouses
  FOR INSERT TO authenticated WITH CHECK (current_erp_role() IN ('Managing Director', 'Admin / BDM'));

CREATE POLICY "warehouses_update_policy" ON public.warehouses
  FOR UPDATE TO authenticated
  USING (current_erp_role() IN ('Managing Director', 'Admin / BDM'))
  WITH CHECK (current_erp_role() IN ('Managing Director', 'Admin / BDM'));

CREATE POLICY "warehouses_delete_policy" ON public.warehouses
  FOR DELETE TO authenticated USING (current_erp_role() = 'Managing Director');

-- ==============================================================================
-- SECTION 12: GOVERNANCE, RBAC, APPROVALS & SYSTEM CONFIGURATION
-- ==============================================================================

-- Organizations
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_manage_policy" ON public.organizations;

CREATE POLICY "organizations_select_policy" ON public.organizations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "organizations_manage_policy" ON public.organizations
  FOR ALL TO authenticated
  USING (current_erp_role() IN ('Managing Director', 'Admin / BDM'))
  WITH CHECK (current_erp_role() IN ('Managing Director', 'Admin / BDM'));

-- Roles, Permissions & Role Permissions
DROP POLICY IF EXISTS "roles_select_policy" ON public.roles;
DROP POLICY IF EXISTS "roles_manage_policy" ON public.roles;
DROP POLICY IF EXISTS "permissions_select_policy" ON public.permissions;
DROP POLICY IF EXISTS "permissions_manage_policy" ON public.permissions;
DROP POLICY IF EXISTS "role_permissions_select_policy" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_manage_policy" ON public.role_permissions;

CREATE POLICY "roles_select_policy" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_manage_policy" ON public.roles FOR ALL TO authenticated
  USING (current_erp_role() = 'Managing Director')
  WITH CHECK (current_erp_role() = 'Managing Director');

CREATE POLICY "permissions_select_policy" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_manage_policy" ON public.permissions FOR ALL TO authenticated
  USING (current_erp_role() = 'Managing Director')
  WITH CHECK (current_erp_role() = 'Managing Director');

CREATE POLICY "role_permissions_select_policy" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_manage_policy" ON public.role_permissions FOR ALL TO authenticated
  USING (current_erp_role() = 'Managing Director')
  WITH CHECK (current_erp_role() = 'Managing Director');

-- Approval Rules & Discount Approval Rules
DROP POLICY IF EXISTS "approval_rules_select_policy" ON public.approval_rules;
DROP POLICY IF EXISTS "approval_rules_manage_policy" ON public.approval_rules;
DROP POLICY IF EXISTS "discount_approval_rules_select_policy" ON public.discount_approval_rules;
DROP POLICY IF EXISTS "discount_approval_rules_manage_policy" ON public.discount_approval_rules;

CREATE POLICY "approval_rules_select_policy" ON public.approval_rules
  FOR SELECT TO authenticated
  USING (current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts'));

CREATE POLICY "approval_rules_manage_policy" ON public.approval_rules
  FOR ALL TO authenticated
  USING (current_erp_role() IN ('Managing Director', 'Admin / BDM'))
  WITH CHECK (current_erp_role() IN ('Managing Director', 'Admin / BDM'));

CREATE POLICY "discount_approval_rules_select_policy" ON public.discount_approval_rules
  FOR SELECT TO authenticated
  USING (current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts'));

CREATE POLICY "discount_approval_rules_manage_policy" ON public.discount_approval_rules
  FOR ALL TO authenticated
  USING (current_erp_role() IN ('Managing Director', 'Admin / BDM'))
  WITH CHECK (current_erp_role() IN ('Managing Director', 'Admin / BDM'));

-- Approval Requests & Discount Approval Requests
DROP POLICY IF EXISTS "approval_requests_select_policy" ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_insert_policy" ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_update_policy" ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_delete_policy" ON public.approval_requests;

CREATE POLICY "approval_requests_select_policy" ON public.approval_requests
  FOR SELECT TO authenticated
  USING (
    requested_by_id = auth.uid()
    OR current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
  );

CREATE POLICY "approval_requests_insert_policy" ON public.approval_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "approval_requests_update_policy" ON public.approval_requests
  FOR UPDATE TO authenticated
  USING (current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts'))
  WITH CHECK (current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts'));

CREATE POLICY "approval_requests_delete_policy" ON public.approval_requests
  FOR DELETE TO authenticated
  USING (current_erp_role() = 'Managing Director');

DROP POLICY IF EXISTS "discount_approval_requests_select_policy" ON public.discount_approval_requests;
DROP POLICY IF EXISTS "discount_approval_requests_insert_policy" ON public.discount_approval_requests;
DROP POLICY IF EXISTS "discount_approval_requests_update_policy" ON public.discount_approval_requests;
DROP POLICY IF EXISTS "discount_approval_requests_delete_policy" ON public.discount_approval_requests;

CREATE POLICY "discount_approval_requests_select_policy" ON public.discount_approval_requests
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts', 'Sales Executive')
  );

CREATE POLICY "discount_approval_requests_insert_policy" ON public.discount_approval_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "discount_approval_requests_update_policy" ON public.discount_approval_requests
  FOR UPDATE TO authenticated
  USING (current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM'))
  WITH CHECK (current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM'));

CREATE POLICY "discount_approval_requests_delete_policy" ON public.discount_approval_requests
  FOR DELETE TO authenticated
  USING (current_erp_role() = 'Managing Director');

-- Communication Outbox & User Communication Identities
DROP POLICY IF EXISTS "communication_outbox_select_policy" ON public.communication_outbox;
DROP POLICY IF EXISTS "communication_outbox_insert_policy" ON public.communication_outbox;
DROP POLICY IF EXISTS "communication_outbox_delete_policy" ON public.communication_outbox;

CREATE POLICY "communication_outbox_select_policy" ON public.communication_outbox
  FOR SELECT TO authenticated
  USING (
    sender_user_id = auth.uid()
    OR current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
  );

CREATE POLICY "communication_outbox_insert_policy" ON public.communication_outbox
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "communication_outbox_delete_policy" ON public.communication_outbox
  FOR DELETE TO authenticated
  USING (current_erp_role() = 'Managing Director');

DROP POLICY IF EXISTS "user_communication_identities_select_policy" ON public.user_communication_identities;
DROP POLICY IF EXISTS "user_communication_identities_manage_policy" ON public.user_communication_identities;

CREATE POLICY "user_communication_identities_select_policy" ON public.user_communication_identities
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

CREATE POLICY "user_communication_identities_manage_policy" ON public.user_communication_identities
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR current_erp_role() IN ('Managing Director', 'Admin / BDM'))
  WITH CHECK (user_id = auth.uid() OR current_erp_role() IN ('Managing Director', 'Admin / BDM'));

-- Sequence Tables Read Policies
DROP POLICY IF EXISTS "document_sequences_select_policy" ON public.document_sequences;
DROP POLICY IF EXISTS "customer_id_sequences_select_policy" ON public.customer_id_sequences;

CREATE POLICY "document_sequences_select_policy" ON public.document_sequences
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "customer_id_sequences_select_policy" ON public.customer_id_sequences
  FOR SELECT TO authenticated USING (true);

-- System Settings
DROP POLICY IF EXISTS "system_settings_select_policy" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_insert_policy" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_update_policy" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_delete_policy" ON public.system_settings;

CREATE POLICY "system_settings_select_policy" ON public.system_settings
  FOR SELECT TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

CREATE POLICY "system_settings_insert_policy" ON public.system_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

CREATE POLICY "system_settings_update_policy" ON public.system_settings
  FOR UPDATE TO authenticated
  USING (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  )
  WITH CHECK (
    current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

CREATE POLICY "system_settings_delete_policy" ON public.system_settings
  FOR DELETE TO authenticated
  USING (
    current_erp_role() = 'Managing Director'
  );

COMMIT;
