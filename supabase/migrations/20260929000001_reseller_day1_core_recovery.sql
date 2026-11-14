-- ICON TECH PRO ERP V9.2 UAT forward recovery for the failed Day 1 migration.
-- Keep the released migration unchanged. This migration aligns the missing
-- Day 1 objects with src/types/erp.ts and the current server actions.
-- Additive only: no business data is seeded and no existing rows are removed.

BEGIN;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_tag varchar(10) NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS versions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quoted_margin_pct numeric(6, 2),
  ADD COLUMN IF NOT EXISTS approved_margin_pct numeric(6, 2),
  ADD COLUMN IF NOT EXISTS order_margin_pct numeric(6, 2),
  ADD COLUMN IF NOT EXISTS actual_margin_pct numeric(6, 2),
  ADD COLUMN IF NOT EXISTS approved_by varchar(120),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE TABLE IF NOT EXISTS public.product_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_sku varchar(100) NOT NULL,
  product_name varchar(200),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_name varchar(200) NOT NULL,
  distributor_part_number varchar(100),
  purchase_cost numeric(12, 2) NOT NULL CHECK (purchase_cost >= 0),
  lead_time_days integer NOT NULL DEFAULT 3 CHECK (lead_time_days >= 0),
  payment_terms_days integer NOT NULL DEFAULT 0 CHECK (payment_terms_days >= 0),
  is_preferred boolean NOT NULL DEFAULT false,
  is_backup boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  price_valid_until date,
  minimum_order_qty integer NOT NULL DEFAULT 1 CHECK (minimum_order_qty > 0),
  availability_status varchar(30) NOT NULL DEFAULT 'IN_STOCK',
  last_quote_reference varchar(100),
  last_quote_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_supplier UNIQUE (product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON public.product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier ON public.product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_active ON public.product_suppliers(is_preferred, is_active);

CREATE TABLE IF NOT EXISTS public.serial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number varchar(100) NOT NULL UNIQUE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name varchar(200) NOT NULL,
  sku varchar(100),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name varchar(200),
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  po_number varchar(100),
  grn_number varchar(100),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name varchar(200),
  sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  order_number varchar(100),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoice_number varchar(100),
  installation_id uuid REFERENCES public.installations(id) ON DELETE SET NULL,
  installation_number varchar(100),
  warranty_duration_months integer NOT NULL DEFAULT 12 CHECK (warranty_duration_months >= 0),
  warranty_start_date date,
  warranty_end_date date,
  warranty_provider varchar(40) NOT NULL DEFAULT 'OEM',
  warranty_source varchar(40) NOT NULL DEFAULT 'PRODUCT',
  status varchar(40) NOT NULL DEFAULT 'IN_OFFICE',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_serial_records_number ON public.serial_records(serial_number);
CREATE INDEX IF NOT EXISTS idx_serial_records_customer ON public.serial_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_serial_records_status ON public.serial_records(status);

CREATE TABLE IF NOT EXISTS public.approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_type varchar(60) NOT NULL,
  rule_name varchar(150) NOT NULL,
  threshold_metric varchar(60) NOT NULL,
  threshold_operator varchar(3) NOT NULL DEFAULT '>=',
  threshold_value numeric(14, 2) NOT NULL DEFAULT 0,
  min_role_required varchar(60) NOT NULL,
  prevent_self_approval boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_rules_active ON public.approval_rules(approval_type, is_active);

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id varchar(80) PRIMARY KEY,
  request_number varchar(40) NOT NULL UNIQUE,
  approval_type varchar(60) NOT NULL,
  entity_type varchar(60) NOT NULL,
  entity_id varchar(100) NOT NULL,
  entity_number varchar(100) NOT NULL,
  requested_by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name varchar(120) NOT NULL,
  requested_by_role varchar(60) NOT NULL,
  required_approver_role varchar(60) NOT NULL,
  approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_name varchar(120),
  threshold_metric varchar(60),
  requested_value numeric(14, 2) NOT NULL DEFAULT 0,
  threshold_limit numeric(14, 2) NOT NULL DEFAULT 0,
  old_value jsonb,
  proposed_value jsonb,
  rule_id uuid REFERENCES public.approval_rules(id) ON DELETE SET NULL,
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  approval_notes text,
  rejection_reason text,
  prevent_self_approval boolean NOT NULL DEFAULT true,
  decision varchar(30),
  decision_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_entity ON public.approval_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON public.approval_requests(requested_by_id);

CREATE TABLE IF NOT EXISTS public.communication_outbox (
  id varchar(80) PRIMARY KEY,
  organization_id varchar(80),
  customer_id varchar(80),
  contact_id varchar(80),
  enquiry_id varchar(80),
  quotation_id varchar(80),
  sales_order_id varchar(80),
  invoice_id varchar(80),
  service_ticket_id varchar(80),
  entity_type varchar(60),
  entity_id varchar(100),
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name varchar(120) NOT NULL,
  send_as_identity varchar(150),
  recipient varchar(200) NOT NULL,
  recipient_name varchar(150),
  channel varchar(30) NOT NULL,
  language varchar(12) NOT NULL DEFAULT 'en',
  subject varchar(300),
  message_body text NOT NULL,
  template_id varchar(100),
  template_data jsonb,
  attachment_url text,
  attachment_type varchar(30),
  handoff_requested boolean NOT NULL DEFAULT false,
  assigned_salesperson_phone varchar(40),
  assigned_salesperson_name varchar(120),
  status varchar(30) NOT NULL DEFAULT 'QUEUED',
  error_message text,
  failure_reason text,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries integer NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
  provider_name varchar(100),
  provider_message_id varchar(150),
  correlation_id varchar(100),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communication_outbox_status ON public.communication_outbox(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_outbox_sender ON public.communication_outbox(sender_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_communication_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name varchar(120) NOT NULL,
  phone_number varchar(40),
  phone_identity_id varchar(150),
  preferred_language varchar(12) NOT NULL DEFAULT 'en',
  secondary_language varchar(12),
  voice_enabled boolean NOT NULL DEFAULT false,
  ai_enabled boolean NOT NULL DEFAULT false,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  email_enabled boolean NOT NULL DEFAULT false,
  send_as_allowed_users uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Return only the caller's own role to allow policies to check RBAC without
-- granting authenticated users broad reads on user_profiles or roles.
CREATE OR REPLACE FUNCTION public.current_erp_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
  SELECT r.role_name::text
  FROM public.user_profiles AS up
  JOIN public.roles AS r ON r.id = up.role_id
  WHERE up.id = auth.uid()
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.current_erp_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_erp_role() TO authenticated;

ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_communication_identities ENABLE ROW LEVEL SECURITY;

DO $policies$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_suppliers' AND policyname = 'product_suppliers_cost_roles_read') THEN
    CREATE POLICY product_suppliers_cost_roles_read ON public.product_suppliers
      FOR SELECT TO authenticated
      USING (public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'serial_records' AND policyname = 'serial_records_staff_read') THEN
    CREATE POLICY serial_records_staff_read ON public.serial_records
      FOR SELECT TO authenticated
      USING (public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'approval_rules' AND policyname = 'approval_rules_approver_read') THEN
    CREATE POLICY approval_rules_approver_read ON public.approval_rules
      FOR SELECT TO authenticated
      USING (public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'approval_requests' AND policyname = 'approval_requests_requester_or_approver_read') THEN
    CREATE POLICY approval_requests_requester_or_approver_read ON public.approval_requests
      FOR SELECT TO authenticated
      USING (
        requested_by_id = auth.uid()
        OR public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communication_outbox' AND policyname = 'communication_outbox_sender_or_manager_read') THEN
    CREATE POLICY communication_outbox_sender_or_manager_read ON public.communication_outbox
      FOR SELECT TO authenticated
      USING (
        sender_user_id = auth.uid()
        OR public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_communication_identities' AND policyname = 'communication_identities_self_or_admin_read') THEN
    CREATE POLICY communication_identities_self_or_admin_read ON public.user_communication_identities
      FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR public.current_erp_role() IN ('Managing Director', 'Admin / BDM'));
  END IF;
END
$policies$;

-- Authenticated SELECT is scoped by the policies above. Writes are performed
-- by server actions after application-level role checks, using service_role.
GRANT SELECT ON public.product_suppliers TO authenticated;
GRANT SELECT ON public.serial_records TO authenticated;
GRANT SELECT ON public.approval_rules TO authenticated;
GRANT SELECT ON public.approval_requests TO authenticated;
GRANT SELECT ON public.communication_outbox TO authenticated;

COMMIT;
