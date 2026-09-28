-- ==============================================================================
-- ICON TECH PRO ERP - Migration 09: Reseller Day 3 Complete Operations Suite
-- Version: 20260913000005
-- Scope:
--   1. tasks: Operational follow-ups, payment collections, warranty/AMC renewals
--   2. supplier_invoices: Distributor invoices, 3-way matching, discrepancy logs
--   3. supplier_invoice_items: Item-level invoice lines with PO unit cost verification
--   4. tally_sync_queue: TallyPrime XML voucher sync queue (idempotent, local bridge)
--   5. tally_ledger_mappings: ERP entity to Tally master ledger mapping
--   6. notifications: Role-based operational and alert triggers
--   7. ai_audit_logs: Safe AI action execution audit trail and human verification
--   8. Additive columns: communication_outbox, approval_requests
-- Safety: Additive only. Zero DROP TABLE, zero TRUNCATE, zero data loss.
-- IMPORTANT: DO NOT execute automatically on production without explicit approval.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Tasks & Follow-ups Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number VARCHAR(50) UNIQUE NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  related_entity_type VARCHAR(50) NOT NULL,
  related_entity_id VARCHAR(100) NOT NULL,
  related_entity_number VARCHAR(100),
  title TEXT NOT NULL,
  notes TEXT,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_user_name VARCHAR(120) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  completed_at TIMESTAMPTZ,
  completed_by_name VARCHAR(120),
  created_by_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_due_status ON public.tasks(due_date, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user ON public.tasks(assigned_user_name);
CREATE INDEX IF NOT EXISTS idx_tasks_related_entity ON public.tasks(related_entity_type, related_entity_id);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Authenticated users can view tasks'
  ) THEN
    CREATE POLICY "Authenticated users can view tasks"
      ON public.tasks FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Authenticated users can create tasks'
  ) THEN
    CREATE POLICY "Authenticated users can create tasks"
      ON public.tasks FOR INSERT
      TO authenticated
      WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Authenticated users can update tasks'
  ) THEN
    CREATE POLICY "Authenticated users can update tasks"
      ON public.tasks FOR UPDATE
      TO authenticated
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Supplier Invoices (Distributor Invoices & 3-Way Match)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_ref VARCHAR(50) UNIQUE NOT NULL,
  supplier_id VARCHAR(100),
  supplier_name VARCHAR(200) NOT NULL,
  distributor_invoice_number VARCHAR(100) NOT NULL,
  distributor_invoice_date DATE NOT NULL,
  po_id VARCHAR(100),
  po_number VARCHAR(100) NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  match_status VARCHAR(50) NOT NULL DEFAULT 'UNMATCHED',
  discrepancy_notes TEXT,
  grn_number VARCHAR(100),
  staged_for_tally BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sup_inv_po ON public.supplier_invoices(po_number);
CREATE INDEX IF NOT EXISTS idx_sup_inv_match_status ON public.supplier_invoices(match_status);

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoices' AND policyname = 'Authenticated users can view supplier invoices'
  ) THEN
    CREATE POLICY "Authenticated users can view supplier invoices"
      ON public.supplier_invoices FOR SELECT
      TO authenticated
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoices' AND policyname = 'Authenticated users can manage supplier invoices'
  ) THEN
    CREATE POLICY "Authenticated users can manage supplier invoices"
      ON public.supplier_invoices FOR ALL
      TO authenticated
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'))
      WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Supplier Invoice Items
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  sku VARCHAR(100),
  billed_quantity INTEGER NOT NULL,
  billed_unit_cost NUMERIC(15,2) NOT NULL,
  po_unit_cost NUMERIC(15,2),
  received_quantity INTEGER,
  total_cost NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sup_inv_items_parent ON public.supplier_invoice_items(supplier_invoice_id);

ALTER TABLE public.supplier_invoice_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoice_items' AND policyname = 'Authenticated users can view supplier invoice items'
  ) THEN
    CREATE POLICY "Authenticated users can view supplier invoice items"
      ON public.supplier_invoice_items FOR SELECT
      TO authenticated
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Accounts'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoice_items' AND policyname = 'Authenticated users can manage supplier invoice items'
  ) THEN
    CREATE POLICY "Authenticated users can manage supplier invoice items"
      ON public.supplier_invoice_items FOR ALL
      TO authenticated
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'))
      WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. TallyPrime Integration Queue
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tally_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  entity_number VARCHAR(100) NOT NULL,
  tally_voucher_type VARCHAR(50) NOT NULL,
  payload_summary TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  tally_guid VARCHAR(100),
  tally_alter_id INTEGER,
  synced_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tally_queue_status ON public.tally_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_tally_queue_entity ON public.tally_sync_queue(entity_type, entity_id);

ALTER TABLE public.tally_sync_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tally_sync_queue' AND policyname = 'Authenticated users can view tally queue'
  ) THEN
    CREATE POLICY "Authenticated users can view tally queue"
      ON public.tally_sync_queue FOR SELECT
      TO authenticated
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tally_sync_queue' AND policyname = 'Authenticated users can manage tally queue'
  ) THEN
    CREATE POLICY "Authenticated users can manage tally queue"
      ON public.tally_sync_queue FOR ALL
      TO authenticated
      USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'))
      WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'Accounts'));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. Tally Ledger Mappings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tally_ledger_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_id VARCHAR(100) NOT NULL,
  erp_name VARCHAR(200) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  tally_ledger_name VARCHAR(200) NOT NULL,
  tally_group VARCHAR(100) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tally_map_erp_id ON public.tally_ledger_mappings(erp_id);

ALTER TABLE public.tally_ledger_mappings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tally_ledger_mappings' AND policyname = 'Authenticated users can view tally mappings'
  ) THEN
    CREATE POLICY "Authenticated users can view tally mappings"
      ON public.tally_ledger_mappings FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tally_ledger_mappings' AND policyname = 'Authenticated users can manage tally mappings'
  ) THEN
    CREATE POLICY "Authenticated users can manage tally mappings"
      ON public.tally_ledger_mappings FOR ALL
      TO authenticated
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. Operational Notifications
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role VARCHAR(50),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  related_entity_type VARCHAR(50),
  related_entity_id VARCHAR(100),
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON public.notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_role ON public.notifications(recipient_role, is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view own notifications'
  ) THEN
    CREATE POLICY "Users can view own notifications"
      ON public.notifications FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can manage notifications'
  ) THEN
    CREATE POLICY "Users can manage notifications"
      ON public.notifications FOR ALL
      TO authenticated
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7. AI Action Execution Audit Logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  user_name VARCHAR(120) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  prompt TEXT,
  parameters JSONB,
  changes_preview TEXT,
  confirmed_by_human BOOLEAN NOT NULL DEFAULT FALSE,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  block_reason TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON public.ai_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_action ON public.ai_audit_logs(action_type);

ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_audit_logs' AND policyname = 'Authenticated users can view ai audit logs'
  ) THEN
    CREATE POLICY "Authenticated users can view ai audit logs"
      ON public.ai_audit_logs FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_audit_logs' AND policyname = 'Authenticated users can insert ai audit logs'
  ) THEN
    CREATE POLICY "Authenticated users can insert ai audit logs"
      ON public.ai_audit_logs FOR INSERT
      TO authenticated
      WITH CHECK (TRUE);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 8. Additive Columns to Existing Tables (Zero data loss)
-- ------------------------------------------------------------------------------
ALTER TABLE public.communication_outbox
  ADD COLUMN IF NOT EXISTS organization_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contact_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS enquiry_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS quotation_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sales_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS service_ticket_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'en_US',
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(100);

ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS old_value JSONB,
  ADD COLUMN IF NOT EXISTS proposed_value JSONB,
  ADD COLUMN IF NOT EXISTS rule_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS decision VARCHAR(30),
  ADD COLUMN IF NOT EXISTS decision_date TIMESTAMPTZ;

COMMIT;
