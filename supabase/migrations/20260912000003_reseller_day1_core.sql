-- ==============================================================================
-- ICON TECH PRO ERP - Migration 07: Reseller Day 1 Core Schema
-- Version: 20260912000003
-- Scope:
--   1. Quotation Revisioning & Margin Tracking Columns
--   2. Product Suppliers (Distributor Master Mapping & Preferred Flags)
--   3. Serial & Warranty Records (Serialized Inventory & Handover Lifecycle)
--   4. Generic Commercial Approval Engine (Rules & Requests with Self-Approval Guard)
--   5. Centralized Communication Outbox & Per-User Identities
-- Safety: Additive only. Zero DROP TABLE, zero TRUNCATE, zero data loss.
-- DO NOT execute automatically on production without explicit approval.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Quotations: Versioning & Multi-Stage Margin Tracking
-- ------------------------------------------------------------------------------
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_tag VARCHAR(10) NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS versions JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS quoted_margin_pct NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS approved_margin_pct NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS order_margin_pct NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS actual_margin_pct NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(120),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 2. Product Suppliers (Distributor Master Mapping)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  distributor_sku VARCHAR(100),
  purchase_cost NUMERIC(12, 2) NOT NULL,
  lead_time_days INT NOT NULL DEFAULT 3,
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_product_supplier UNIQUE (product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_supp_product_id ON public.product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_supp_supplier_id ON public.product_suppliers(supplier_id);

ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_suppliers' AND policyname = 'Authenticated users can view product suppliers'
  ) THEN
    CREATE POLICY "Authenticated users can view product suppliers"
      ON public.product_suppliers FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_suppliers' AND policyname = 'Procurement and Admins can manage product suppliers'
  ) THEN
    CREATE POLICY "Procurement and Admins can manage product suppliers"
      ON public.product_suppliers FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          JOIN public.roles r ON up.role_id = r.id
          WHERE up.id = auth.uid()
            AND r.name IN ('Managing Director', 'Admin / BDM', 'Operations / Purchase')
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_suppliers TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Serial Records & Warranty Tracking
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.serial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name VARCHAR(150) NOT NULL,
  serial_number VARCHAR(100) NOT NULL UNIQUE,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  installation_id UUID REFERENCES public.installations(id) ON DELETE SET NULL,
  warranty_start_date DATE,
  warranty_end_date DATE,
  warranty_provider VARCHAR(30) NOT NULL DEFAULT 'OEM',
  warranty_terms TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'IN_STOCK',
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serial_number ON public.serial_records(serial_number);
CREATE INDEX IF NOT EXISTS idx_serial_customer_id ON public.serial_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_serial_status ON public.serial_records(status);

ALTER TABLE public.serial_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'serial_records' AND policyname = 'Authenticated users can view serial records'
  ) THEN
    CREATE POLICY "Authenticated users can view serial records"
      ON public.serial_records FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'serial_records' AND policyname = 'Operations and Admins can manage serial records'
  ) THEN
    CREATE POLICY "Operations and Admins can manage serial records"
      ON public.serial_records FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          JOIN public.roles r ON up.role_id = r.id
          WHERE up.id = auth.uid()
            AND r.name IN ('Managing Director', 'Admin / BDM', 'Operations / Purchase', 'Technician')
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.serial_records TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. Commercial Approval Engine (Rules & Requests)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_type VARCHAR(50) NOT NULL,
  threshold_value NUMERIC(12, 2) NOT NULL,
  required_role VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(40) NOT NULL UNIQUE,
  approval_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  entity_number VARCHAR(60) NOT NULL,
  requested_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name VARCHAR(120) NOT NULL,
  required_role VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  approved_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by_name VARCHAR(120),
  actioned_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appr_req_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_appr_req_entity ON public.approval_requests(entity_type, entity_id);

ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'approval_rules' AND policyname = 'Authenticated users can view approval rules'
  ) THEN
    CREATE POLICY "Authenticated users can view approval rules"
      ON public.approval_rules FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'approval_requests' AND policyname = 'Users can view approval requests'
  ) THEN
    CREATE POLICY "Users can view approval requests"
      ON public.approval_requests FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'approval_requests' AND policyname = 'Authorized roles can update approval requests'
  ) THEN
    CREATE POLICY "Authorized roles can update approval requests"
      ON public.approval_requests FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          JOIN public.roles r ON up.role_id = r.id
          WHERE up.id = auth.uid()
            AND (r.name IN ('Managing Director', 'Admin / BDM') OR r.name = required_role)
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.approval_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. Centralized Communication Outbox & Per-User Identities
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(50) NOT NULL UNIQUE,
  channel VARCHAR(20) NOT NULL,
  sender_identity VARCHAR(100) NOT NULL,
  recipient VARCHAR(150) NOT NULL,
  subject VARCHAR(250),
  body TEXT NOT NULL,
  template_id VARCHAR(100),
  template_params JSONB,
  status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_communication_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name VARCHAR(120) NOT NULL,
  user_email VARCHAR(150) NOT NULL,
  whatsapp_display_number VARCHAR(30),
  email_sender_alias VARCHAR(150),
  smtp_configured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_comm_identity UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON public.communication_outbox(status);

ALTER TABLE public.communication_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_communication_identities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'communication_outbox' AND policyname = 'Authenticated users can manage outbox'
  ) THEN
    CREATE POLICY "Authenticated users can manage outbox"
      ON public.communication_outbox FOR ALL
      TO authenticated
      USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_communication_identities' AND policyname = 'Users can view communication identities'
  ) THEN
    CREATE POLICY "Users can view communication identities"
      ON public.user_communication_identities FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.communication_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_communication_identities TO authenticated;

COMMIT;
