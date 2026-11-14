-- ==============================================================================
-- ICON TECH PRO ERP V9.2 — GATE C DATABASE REMEDIATION ROLLBACK SCRIPT
-- Target Environment: UAT Supabase (njylssodwvaonbeebvjq)
-- Purpose: Safely reverts all Gate C remediation policies, restores known historical
--          policies from migrations M01-M34, reverts RLS on previously unshielded
--          tables, and restores baseline sequence functions.
--
-- LIMITATIONS & RECOVERY NOTICE:
-- Reconstructs the exact state established by version-controlled migrations M01-M34.
-- Any uncommitted policies applied manually via the Supabase Dashboard SQL Editor
-- cannot be discovered offline and would require forward re-application.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PHASE 1: DROP ALL POLICIES CREATED BY GATE C LEAST-PRIVILEGE REMEDIATION
-- ==============================================================================

-- Drop Gate C policies on all 47 tables
DROP POLICY IF EXISTS "system_settings_delete_policy" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_update_policy" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_insert_policy" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_select_policy" ON public.system_settings;

DROP POLICY IF EXISTS "customer_id_sequences_select_policy" ON public.customer_id_sequences;
DROP POLICY IF EXISTS "document_sequences_select_policy" ON public.document_sequences;

DROP POLICY IF EXISTS "user_communication_identities_manage_policy" ON public.user_communication_identities;
DROP POLICY IF EXISTS "user_communication_identities_select_policy" ON public.user_communication_identities;

DROP POLICY IF EXISTS "communication_outbox_delete_policy" ON public.communication_outbox;
DROP POLICY IF EXISTS "communication_outbox_insert_policy" ON public.communication_outbox;
DROP POLICY IF EXISTS "communication_outbox_select_policy" ON public.communication_outbox;

DROP POLICY IF EXISTS "discount_approval_requests_delete_policy" ON public.discount_approval_requests;
DROP POLICY IF EXISTS "discount_approval_requests_update_policy" ON public.discount_approval_requests;
DROP POLICY IF EXISTS "discount_approval_requests_insert_policy" ON public.discount_approval_requests;
DROP POLICY IF EXISTS "discount_approval_requests_select_policy" ON public.discount_approval_requests;

DROP POLICY IF EXISTS "approval_requests_delete_policy" ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_update_policy" ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_insert_policy" ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_select_policy" ON public.approval_requests;

DROP POLICY IF EXISTS "discount_approval_rules_manage_policy" ON public.discount_approval_rules;
DROP POLICY IF EXISTS "discount_approval_rules_select_policy" ON public.discount_approval_rules;

DROP POLICY IF EXISTS "approval_rules_manage_policy" ON public.approval_rules;
DROP POLICY IF EXISTS "approval_rules_select_policy" ON public.approval_rules;

DROP POLICY IF EXISTS "role_permissions_manage_policy" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_select_policy" ON public.role_permissions;
DROP POLICY IF EXISTS "permissions_manage_policy" ON public.permissions;
DROP POLICY IF EXISTS "permissions_select_policy" ON public.permissions;
DROP POLICY IF EXISTS "roles_manage_policy" ON public.roles;
DROP POLICY IF EXISTS "roles_select_policy" ON public.roles;
DROP POLICY IF EXISTS "organizations_manage_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;

DROP POLICY IF EXISTS "warehouses_delete_policy" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_update_policy" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_insert_policy" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_select_policy" ON public.warehouses;

DROP POLICY IF EXISTS "product_categories_delete_policy" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_update_policy" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_insert_policy" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_select_policy" ON public.product_categories;

DROP POLICY IF EXISTS "product_brands_delete_policy" ON public.product_brands;
DROP POLICY IF EXISTS "product_brands_update_policy" ON public.product_brands;
DROP POLICY IF EXISTS "product_brands_insert_policy" ON public.product_brands;
DROP POLICY IF EXISTS "product_brands_select_policy" ON public.product_brands;

DROP POLICY IF EXISTS "goods_receipt_notes_delete_policy" ON public.goods_receipt_notes;
DROP POLICY IF EXISTS "goods_receipt_notes_update_policy" ON public.goods_receipt_notes;
DROP POLICY IF EXISTS "goods_receipt_notes_insert_policy" ON public.goods_receipt_notes;
DROP POLICY IF EXISTS "goods_receipt_notes_select_policy" ON public.goods_receipt_notes;

DROP POLICY IF EXISTS "purchase_order_items_delete_policy" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_update_policy" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_insert_policy" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_select_policy" ON public.purchase_order_items;

DROP POLICY IF EXISTS "purchase_orders_delete_policy" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_update_policy" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_insert_policy" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_select_policy" ON public.purchase_orders;

DROP POLICY IF EXISTS "suppliers_delete_policy" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update_policy" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert_policy" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_select_policy" ON public.suppliers;

DROP POLICY IF EXISTS "inventory_transactions_insert_policy" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_select_policy" ON public.inventory_transactions;
DROP POLICY IF EXISTS "stock_movements_insert_policy" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_select_policy" ON public.stock_movements;

DROP POLICY IF EXISTS "serial_records_delete_policy" ON public.serial_records;
DROP POLICY IF EXISTS "serial_records_update_policy" ON public.serial_records;
DROP POLICY IF EXISTS "serial_records_insert_policy" ON public.serial_records;
DROP POLICY IF EXISTS "serial_records_select_policy" ON public.serial_records;

DROP POLICY IF EXISTS "inventory_serials_delete_policy" ON public.inventory_serials;
DROP POLICY IF EXISTS "inventory_serials_update_policy" ON public.inventory_serials;
DROP POLICY IF EXISTS "inventory_serials_insert_policy" ON public.inventory_serials;
DROP POLICY IF EXISTS "inventory_serials_select_policy" ON public.inventory_serials;

DROP POLICY IF EXISTS "inventory_stock_delete_policy" ON public.inventory_stock;
DROP POLICY IF EXISTS "inventory_stock_update_policy" ON public.inventory_stock;
DROP POLICY IF EXISTS "inventory_stock_insert_policy" ON public.inventory_stock;
DROP POLICY IF EXISTS "inventory_stock_select_policy" ON public.inventory_stock;

DROP POLICY IF EXISTS "products_delete_policy" ON public.products;
DROP POLICY IF EXISTS "products_update_policy" ON public.products;
DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
DROP POLICY IF EXISTS "products_select_policy" ON public.products;

DROP POLICY IF EXISTS "equipment_rentals_delete_policy" ON public.equipment_rentals;
DROP POLICY IF EXISTS "equipment_rentals_update_policy" ON public.equipment_rentals;
DROP POLICY IF EXISTS "equipment_rentals_insert_policy" ON public.equipment_rentals;
DROP POLICY IF EXISTS "equipment_rentals_select_policy" ON public.equipment_rentals;

DROP POLICY IF EXISTS "follow_ups_delete_policy" ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_update_policy" ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_insert_policy" ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_select_policy" ON public.follow_ups;

DROP POLICY IF EXISTS "site_visits_delete_policy" ON public.site_visits;
DROP POLICY IF EXISTS "site_visits_update_policy" ON public.site_visits;
DROP POLICY IF EXISTS "site_visits_insert_policy" ON public.site_visits;
DROP POLICY IF EXISTS "site_visits_select_policy" ON public.site_visits;

DROP POLICY IF EXISTS "installations_delete_policy" ON public.installations;
DROP POLICY IF EXISTS "installations_update_policy" ON public.installations;
DROP POLICY IF EXISTS "installations_insert_policy" ON public.installations;
DROP POLICY IF EXISTS "installations_select_policy" ON public.installations;

DROP POLICY IF EXISTS "service_tickets_delete_policy" ON public.service_tickets;
DROP POLICY IF EXISTS "service_tickets_update_policy" ON public.service_tickets;
DROP POLICY IF EXISTS "service_tickets_insert_policy" ON public.service_tickets;
DROP POLICY IF EXISTS "service_tickets_select_policy" ON public.service_tickets;

DROP POLICY IF EXISTS "dispatches_delete_policy" ON public.dispatches;
DROP POLICY IF EXISTS "dispatches_update_policy" ON public.dispatches;
DROP POLICY IF EXISTS "dispatches_insert_policy" ON public.dispatches;
DROP POLICY IF EXISTS "dispatches_select_policy" ON public.dispatches;

DROP POLICY IF EXISTS "enquiries_delete_policy" ON public.enquiries;
DROP POLICY IF EXISTS "enquiries_update_policy" ON public.enquiries;
DROP POLICY IF EXISTS "enquiries_insert_policy" ON public.enquiries;
DROP POLICY IF EXISTS "enquiries_select_policy" ON public.enquiries;

DROP POLICY IF EXISTS "customers_delete_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_update_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_select_policy" ON public.customers;

DROP POLICY IF EXISTS "payments_delete_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_update_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_select_policy" ON public.payments;

DROP POLICY IF EXISTS "invoice_items_delete_policy" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_update_policy" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert_policy" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_select_policy" ON public.invoice_items;

DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;

DROP POLICY IF EXISTS "amc_contracts_delete_policy" ON public.amc_contracts;
DROP POLICY IF EXISTS "amc_contracts_update_policy" ON public.amc_contracts;
DROP POLICY IF EXISTS "amc_contracts_insert_policy" ON public.amc_contracts;
DROP POLICY IF EXISTS "amc_contracts_select_policy" ON public.amc_contracts;

DROP POLICY IF EXISTS "sales_order_items_delete_policy" ON public.sales_order_items;
DROP POLICY IF EXISTS "sales_order_items_update_policy" ON public.sales_order_items;
DROP POLICY IF EXISTS "sales_order_items_insert_policy" ON public.sales_order_items;
DROP POLICY IF EXISTS "sales_order_items_select_policy" ON public.sales_order_items;

DROP POLICY IF EXISTS "sales_orders_delete_policy" ON public.sales_orders;
DROP POLICY IF EXISTS "sales_orders_update_policy" ON public.sales_orders;
DROP POLICY IF EXISTS "sales_orders_insert_policy" ON public.sales_orders;
DROP POLICY IF EXISTS "sales_orders_select_policy" ON public.sales_orders;

DROP POLICY IF EXISTS "quotation_items_delete_policy" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_update_policy" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_insert_policy" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_select_policy" ON public.quotation_items;

DROP POLICY IF EXISTS "quotations_delete_policy" ON public.quotations;
DROP POLICY IF EXISTS "quotations_update_policy" ON public.quotations;
DROP POLICY IF EXISTS "quotations_insert_policy" ON public.quotations;
DROP POLICY IF EXISTS "quotations_select_policy" ON public.quotations;

DROP POLICY IF EXISTS "product_suppliers_delete_policy" ON public.product_suppliers;
DROP POLICY IF EXISTS "product_suppliers_update_policy" ON public.product_suppliers;
DROP POLICY IF EXISTS "product_suppliers_insert_policy" ON public.product_suppliers;
DROP POLICY IF EXISTS "product_suppliers_select_policy" ON public.product_suppliers;

DROP POLICY IF EXISTS "security_audit_logs_insert_policy" ON public.security_audit_logs;
DROP POLICY IF EXISTS "security_audit_logs_select_policy" ON public.security_audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;

DROP POLICY IF EXISTS "user_profiles_delete_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;

-- ==============================================================================
-- PHASE 2: REVERT RLS STATE ON THE 17 TABLES ORIGINALLY DISABLED IN UAT
-- ==============================================================================

ALTER TABLE public.product_brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories DISABLE ROW LEVEL SECURITY;
-- Note: products_catalog is a view (M06), not a physical table; RLS does not apply
ALTER TABLE public.warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.installations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_serials DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_rentals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_id_sequences DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences DISABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- PHASE 3: RECONSTRUCT HISTORICAL BASELINE POLICIES (MIGRATIONS M01 - M34)
-- ==============================================================================

-- 1. Migration 20260910000001 (Foundation)
DROP POLICY IF EXISTS "Authenticated users can read organizations" ON public.organizations;
CREATE POLICY "Authenticated users can read organizations"
  ON public.organizations FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins full write organizations" ON public.organizations;
CREATE POLICY "Admins full write organizations"
  ON public.organizations FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.roles;
CREATE POLICY "Authenticated users can read roles"
  ON public.roles FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read permissions" ON public.permissions;
CREATE POLICY "Authenticated users can read permissions"
  ON public.permissions FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read role_permissions" ON public.role_permissions;
CREATE POLICY "Authenticated users can read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "User profiles read access" ON public.user_profiles;
CREATE POLICY "User profiles read access"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can manage user profiles" ON public.user_profiles;
CREATE POLICY "Admins can manage user profiles"
  ON public.user_profiles FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'))
  WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "Authenticated users can read discount rules" ON public.discount_approval_rules;
CREATE POLICY "Authenticated users can read discount rules"
  ON public.discount_approval_rules FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins full write discount rules" ON public.discount_approval_rules;
CREATE POLICY "Admins full write discount rules"
  ON public.discount_approval_rules FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "Authenticated users can read system_settings" ON public.system_settings;
CREATE POLICY "Authenticated users can read system_settings"
  ON public.system_settings FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins full write system_settings" ON public.system_settings;
CREATE POLICY "Admins full write system_settings"
  ON public.system_settings FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "Admins can read audit_logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit_logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

-- 2. Migration 20260911000002 (Customer Master)
DROP POLICY IF EXISTS "Authenticated users can read customers" ON public.customers;
CREATE POLICY "Authenticated users can read customers"
  ON public.customers FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authorized staff can insert customers" ON public.customers;
CREATE POLICY "Authorized staff can insert customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant'));

DROP POLICY IF EXISTS "Staff can update customers" ON public.customers;
CREATE POLICY "Staff can update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant'));

DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
CREATE POLICY "Admins can delete customers"
  ON public.customers FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

-- 3. Migration 20260911000004 (Core Commercial & Inventory)
DROP POLICY IF EXISTS "Authenticated staff can view products" ON public.products;
CREATE POLICY "Authenticated staff can view products"
  ON public.products FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'))
  WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "Staff can view enquiries" ON public.enquiries;
CREATE POLICY "Staff can view enquiries"
  ON public.enquiries FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Sales staff can manage enquiries" ON public.enquiries;
CREATE POLICY "Sales staff can manage enquiries"
  ON public.enquiries FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant'))
  WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant'));

DROP POLICY IF EXISTS "Staff can view quotations" ON public.quotations;
CREATE POLICY "Staff can view quotations"
  ON public.quotations FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Sales staff can modify quotations" ON public.quotations;
CREATE POLICY "Sales staff can modify quotations"
  ON public.quotations FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'))
  WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'));

DROP POLICY IF EXISTS "Staff can view quotation items" ON public.quotation_items;
CREATE POLICY "Staff can view quotation items"
  ON public.quotation_items FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Sales staff can modify quotation items" ON public.quotation_items;
CREATE POLICY "Sales staff can modify quotation items"
  ON public.quotation_items FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'))
  WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'));

DROP POLICY IF EXISTS "Staff can view sales orders" ON public.sales_orders;
CREATE POLICY "Staff can view sales orders"
  ON public.sales_orders FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Management can modify sales orders" ON public.sales_orders;
CREATE POLICY "Management can modify sales orders"
  ON public.sales_orders FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM'))
  WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM'));

DROP POLICY IF EXISTS "Staff can view invoices" ON public.invoices;
CREATE POLICY "Staff can view invoices"
  ON public.invoices FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Accounts and Admins can manage invoices" ON public.invoices;
CREATE POLICY "Accounts and Admins can manage invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'))
  WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));

DROP POLICY IF EXISTS "Staff can view payments" ON public.payments;
CREATE POLICY "Staff can view payments"
  ON public.payments FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Accounts and Admins can manage payments" ON public.payments;
CREATE POLICY "Accounts and Admins can manage payments"
  ON public.payments FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'))
  WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));

DROP POLICY IF EXISTS "Staff can view suppliers" ON public.suppliers;
CREATE POLICY "Staff can view suppliers"
  ON public.suppliers FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage suppliers" ON public.suppliers;
CREATE POLICY "Admins can manage suppliers"
  ON public.suppliers FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'))
  WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "Staff can view purchase orders" ON public.purchase_orders;
CREATE POLICY "Staff can view purchase orders"
  ON public.purchase_orders FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage purchase orders" ON public.purchase_orders;
CREATE POLICY "Admins can manage purchase orders"
  ON public.purchase_orders FOR ALL TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'))
  WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "Staff can view inventory transactions" ON public.inventory_transactions;
CREATE POLICY "Staff can view inventory transactions"
  ON public.inventory_transactions FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins can insert inventory transactions" ON public.inventory_transactions;
CREATE POLICY "Admins can insert inventory transactions"
  ON public.inventory_transactions FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

-- 4. Migration 20260912000001 (Security Logs)
DROP POLICY IF EXISTS "Administrators can view security audit logs" ON public.security_audit_logs;
CREATE POLICY "Administrators can view security audit logs"
  ON public.security_audit_logs FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "System can insert security audit logs" ON public.security_audit_logs;
CREATE POLICY "System can insert security audit logs"
  ON public.security_audit_logs FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- 5. Migration 20260929000001 (Day-1 Core Recovery)
DROP POLICY IF EXISTS "product_suppliers_cost_roles_read" ON public.product_suppliers;
CREATE POLICY "product_suppliers_cost_roles_read"
  ON public.product_suppliers FOR SELECT TO authenticated
  USING (public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts'));

DROP POLICY IF EXISTS "serial_records_staff_read" ON public.serial_records;
CREATE POLICY "serial_records_staff_read"
  ON public.serial_records FOR SELECT TO authenticated
  USING (public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'));

DROP POLICY IF EXISTS "approval_rules_approver_read" ON public.approval_rules;
CREATE POLICY "approval_rules_approver_read"
  ON public.approval_rules FOR SELECT TO authenticated
  USING (public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts'));

DROP POLICY IF EXISTS "approval_requests_requester_or_approver_read" ON public.approval_requests;
CREATE POLICY "approval_requests_requester_or_approver_read"
  ON public.approval_requests FOR SELECT TO authenticated
  USING (
    requested_by_id = auth.uid()
    OR public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
  );

DROP POLICY IF EXISTS "communication_outbox_sender_or_manager_read" ON public.communication_outbox;
CREATE POLICY "communication_outbox_sender_or_manager_read"
  ON public.communication_outbox FOR SELECT TO authenticated
  USING (
    sender_user_id = auth.uid()
    OR public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
  );

DROP POLICY IF EXISTS "communication_identities_self_or_admin_read" ON public.user_communication_identities;
CREATE POLICY "communication_identities_self_or_admin_read"
  ON public.user_communication_identities FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_erp_role() IN ('Managing Director', 'Admin / BDM')
  );

-- ==============================================================================
-- PHASE 4: RESTORE BASELINE SEQUENCE FUNCTIONS (MIGRATIONS M03 & M06)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_next_sequence_code(p_doc_type VARCHAR, p_prefix VARCHAR)
RETURNS VARCHAR
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_yy CHAR(2);
    next_seq INT;
BEGIN
    current_yy := TO_CHAR(CURRENT_DATE, 'YY');

    INSERT INTO public.document_sequences (doc_type, year_prefix, last_sequence, updated_at)
    VALUES (p_doc_type, current_yy, 1, NOW())
    ON CONFLICT (doc_type, year_prefix)
    DO UPDATE SET
        last_sequence = document_sequences.last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO next_seq;

    RETURN p_prefix || current_yy || LPAD(next_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_next_document_code(p_doc_type VARCHAR, p_prefix VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_yy CHAR(2);
    next_seq INT;
    generated_code VARCHAR(30);
BEGIN
    current_yy := TO_CHAR(CURRENT_DATE, 'YY');

    INSERT INTO public.document_sequences (doc_type, year_prefix, last_sequence, updated_at)
    VALUES (p_doc_type, current_yy, 1, NOW())
    ON CONFLICT (doc_type, year_prefix)
    DO UPDATE SET
        last_sequence = document_sequences.last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO next_seq;

    generated_code := p_prefix || current_yy || LPAD(next_seq::TEXT, 4, '0');
    RETURN generated_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_sequence_code(VARCHAR, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_next_document_code(VARCHAR, VARCHAR) TO authenticated, service_role;

-- ==============================================================================
-- PHASE 5: RESTORE OBJECT GRANTS (HISTORICAL M01 - M06 BASELINE)
-- ==============================================================================

GRANT SELECT, INSERT, UPDATE ON TABLE public.document_sequences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customer_id_sequences TO authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.security_audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.suppliers TO authenticated;
GRANT SELECT ON public.products_catalog TO authenticated;

COMMIT;
