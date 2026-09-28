-- ==============================================================================
-- ICON TECH PRO ERP - Migration 06: Reseller Priority 1 Foundation
-- Version: 20260912000002
-- Scope: 
--   1. Sales Orders: Place of Supply & Procurement Summary
--   2. Sales Order Items: Line-Item Procurement Tracking & Stock Allocation
--   3. Purchase Orders: Consolidated Procurement & Drop-Shipment Tracking
--   4. Purchase Order Items: Source Order Traceability
--   5. Installations: Real Operational Job Cards, Checklists & Sign-Off
--   6. Products Catalog: Secure Public View (Protecting Purchase Price)
--   7. Document Sequences: Atomic Database Concurrency Sequence Generator
-- Safety: Additive only. Zero DROP TABLE, zero TRUNCATE, zero data loss.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Sales Orders: Place of Supply & GST Audit Fields
-- ------------------------------------------------------------------------------
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(50) NOT NULL DEFAULT '36-TELANGANA',
  ADD COLUMN IF NOT EXISTS customer_billing_state VARCHAR(100) DEFAULT 'Telangana',
  ADD COLUMN IF NOT EXISTS procurement_summary JSONB DEFAULT '{}';

-- ------------------------------------------------------------------------------
-- 2. Sales Order Items: Line-Item Procurement Tracking
-- ------------------------------------------------------------------------------
ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS procurement_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_EVALUATION',
  ADD COLUMN IF NOT EXISTS office_stock_available INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS procurement_required_qty INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS po_number VARCHAR(40),
  ADD COLUMN IF NOT EXISTS incoming_quantity INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fulfilled_quantity INT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_so_item_procurement_status'
  ) THEN
    ALTER TABLE public.sales_order_items
      ADD CONSTRAINT chk_so_item_procurement_status 
      CHECK (procurement_status IN (
        'PENDING_EVALUATION',
        'IN_OFFICE_STOCK',
        'PARTIALLY_RESERVED',
        'PO_REQUIRED',
        'PO_ISSUED',
        'IN_TRANSIT',
        'RECEIVED',
        'DROPSHIPPED',
        'FULFILLED'
      ));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Purchase Orders: Consolidated Procurement & Drop-Shipping
-- ------------------------------------------------------------------------------
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_order_number VARCHAR(40),
  ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(30) NOT NULL DEFAULT 'OFFICE_RECEIPT',
  ADD COLUMN IF NOT EXISTS consignee_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consignee_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS consignee_address TEXT,
  ADD COLUMN IF NOT EXISTS consignee_contact VARCHAR(100),
  ADD COLUMN IF NOT EXISTS consignee_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS distributor_invoice_number VARCHAR(60),
  ADD COLUMN IF NOT EXISTS distributor_invoice_date DATE,
  ADD COLUMN IF NOT EXISTS courier_transporter VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS proof_of_delivery_ref TEXT,
  ADD COLUMN IF NOT EXISTS delivery_date DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_po_delivery_type'
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT chk_po_delivery_type
      CHECK (delivery_type IN ('OFFICE_RECEIPT', 'DIRECT_CUSTOMER_DROPSHIP'));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Purchase Order Items: Source Order Traceability
-- ------------------------------------------------------------------------------
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_order_item_id UUID REFERENCES public.sales_order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(40);

-- ------------------------------------------------------------------------------
-- 5. Installations: Real Operational Job Cards & Handover Sign-Off
-- ------------------------------------------------------------------------------
ALTER TABLE public.installations
  ADD COLUMN IF NOT EXISTS site_address TEXT,
  ADD COLUMN IF NOT EXISTS site_contact_person VARCHAR(120),
  ADD COLUMN IF NOT EXISTS site_contact_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS installed_products JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS customer_signoff_by VARCHAR(120),
  ADD COLUMN IF NOT EXISTS customer_signoff_date DATE,
  ADD COLUMN IF NOT EXISTS handover_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_HANDOVER',
  ADD COLUMN IF NOT EXISTS remarks TEXT;

-- ------------------------------------------------------------------------------
-- 6. Secure Public Products Catalog View (Hiding Sensitive Purchase Costs)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.products_catalog AS
SELECT 
  id, 
  sku, 
  name, 
  category_id, 
  category_name, 
  brand_id, 
  brand_name, 
  model_name, 
  description, 
  unit, 
  hsn_sac, 
  gst_rate, 
  selling_price, 
  mrp, 
  current_stock, 
  reorder_level, 
  is_serialized, 
  is_service, 
  is_active, 
  created_at
FROM public.products;

GRANT SELECT ON public.products_catalog TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. Document Sequences: Atomic Concurrency-Safe Sequence Stored Procedure
-- ------------------------------------------------------------------------------
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

GRANT EXECUTE ON FUNCTION public.get_next_sequence_code(VARCHAR, VARCHAR) TO authenticated;

COMMIT;
