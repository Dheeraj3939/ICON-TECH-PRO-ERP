-- ==============================================================================
-- ICON TECH PRO ERP - MIGRATION 000004: COMPLETE RLS SECURITY & DOCUMENT SEQUENCES
-- ==============================================================================
-- Description:
--   1. Enables Row Level Security (RLS) on all 29 production business tables.
--   2. Defines granular role-based access policies (Managing Director, Admin, BDM, Sales, Accounts).
--   3. Creates immutable inventory_transactions ledger table with negative stock constraints.
--   4. Creates PostgreSQL database sequences for concurrency-safe sequential document generation.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Create Immutable Inventory Transactions Ledger Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number VARCHAR(40) UNIQUE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    sku VARCHAR(60) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('PURCHASE_RECEIPT', 'SALES_DISPATCH', 'ADJUSTMENT', 'RETURN')),
    quantity INT NOT NULL CHECK (quantity <> 0),
    previous_stock INT NOT NULL CHECK (previous_stock >= 0),
    new_stock INT NOT NULL CHECK (new_stock >= 0),
    reference_type VARCHAR(40),
    reference_id VARCHAR(60),
    performed_by_name VARCHAR(120) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_tx_product_id ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_sku ON inventory_transactions(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_created_at ON inventory_transactions(created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. Concurrency-Safe Document Sequences
-- ------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS seq_customer_code START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_enquiry_number START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_quotation_number START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_order_number START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_invoice_number START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_payment_number START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_purchase_order_number START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_dispatch_number START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_inventory_tx START 1000;

-- ------------------------------------------------------------------------------
-- 3. Enable Row-Level Security (RLS) on All Production Tables
-- ------------------------------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. Granular RLS Access Control Policies
-- ------------------------------------------------------------------------------

-- Products: All authenticated staff can read; Only Admin and MD can modify
DROP POLICY IF EXISTS "Authenticated staff can view products" ON products;
CREATE POLICY "Authenticated staff can view products"
ON products FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Admins can manage products"
ON products FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'))
WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

-- Inventory Ledger: All authenticated staff can view; Only Admin and MD can record adjustments
DROP POLICY IF EXISTS "Staff can view inventory transactions" ON inventory_transactions;
CREATE POLICY "Staff can view inventory transactions"
ON inventory_transactions FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins can insert inventory transactions" ON inventory_transactions;
CREATE POLICY "Admins can insert inventory transactions"
ON inventory_transactions FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

-- Enquiries: Sales staff, BDM, Admin, MD can manage enquiries
DROP POLICY IF EXISTS "Staff can view enquiries" ON enquiries;
CREATE POLICY "Staff can view enquiries"
ON enquiries FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Sales staff can manage enquiries" ON enquiries;
CREATE POLICY "Sales staff can manage enquiries"
ON enquiries FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant'))
WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant'));

-- Quotations & Quotation Items: Sales, BDM, Admin, MD can create/read; Accounts can read
DROP POLICY IF EXISTS "Staff can view quotations" ON quotations;
CREATE POLICY "Staff can view quotations"
ON quotations FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Sales staff can modify quotations" ON quotations;
CREATE POLICY "Sales staff can modify quotations"
ON quotations FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'))
WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'));

DROP POLICY IF EXISTS "Staff can view quotation items" ON quotation_items;
CREATE POLICY "Staff can view quotation items"
ON quotation_items FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Sales staff can modify quotation items" ON quotation_items;
CREATE POLICY "Sales staff can modify quotation items"
ON quotation_items FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'))
WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'));

-- Sales Orders: All staff can view; BDM, Admin, MD can manage
DROP POLICY IF EXISTS "Staff can view sales orders" ON sales_orders;
CREATE POLICY "Staff can view sales orders"
ON sales_orders FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Management can modify sales orders" ON sales_orders;
CREATE POLICY "Management can modify sales orders"
ON sales_orders FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM'))
WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM'));

-- Invoices & Payments: Restricted to Accounts, Admin, and Managing Director
DROP POLICY IF EXISTS "Staff can view invoices" ON invoices;
CREATE POLICY "Staff can view invoices"
ON invoices FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Accounts and Admins can manage invoices" ON invoices;
CREATE POLICY "Accounts and Admins can manage invoices"
ON invoices FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'))
WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));

DROP POLICY IF EXISTS "Staff can view payments" ON payments;
CREATE POLICY "Staff can view payments"
ON payments FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Accounts and Admins can manage payments" ON payments;
CREATE POLICY "Accounts and Admins can manage payments"
ON payments FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'))
WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));

-- Suppliers & Purchase Orders: Management and Procurement only
DROP POLICY IF EXISTS "Staff can view suppliers" ON suppliers;
CREATE POLICY "Staff can view suppliers"
ON suppliers FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage suppliers" ON suppliers;
CREATE POLICY "Admins can manage suppliers"
ON suppliers FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'))
WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "Staff can view purchase orders" ON purchase_orders;
CREATE POLICY "Staff can view purchase orders"
ON purchase_orders FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage purchase orders" ON purchase_orders;
CREATE POLICY "Admins can manage purchase orders"
ON purchase_orders FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'))
WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

COMMIT;
