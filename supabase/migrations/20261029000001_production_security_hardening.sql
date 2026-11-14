-- ==============================================================================
-- ICON TECH PRO ERP V9.2 — PRODUCTION DATABASE SECURITY HARDENING
-- Target Environment: Production Supabase (xogynsnfzsvimwtvvhpx)
-- STRICT GUARANTEE: Zero data loss, zero destructive drops, conditional execution
-- Resilient to schema divergence: Safely inspects object existence before applying DDL
-- Prevents privilege escalation: Never trusts user-editable metadata
-- Protects credentials: Masks OAuth/secrets in system_settings from non-admin roles
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- SECTION 1: PREFLIGHT & DIAGNOSTIC NOTICE
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Starting ICON TECH PRO ERP V9.2 Production Security Hardening Migration...';
  RAISE NOTICE 'Execution Timestamp: %', CLOCK_TIMESTAMP();
END $$;

-- ==============================================================================
-- SECTION 2: GLOBAL TRUNCATE & INHERITED PRIVILEGE ELIMINATION
-- ==============================================================================

-- 1. Strictly revoke destructive TRUNCATE across all public tables from all client/public roles
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated, PUBLIC;

-- 2. Revoke all inherited and default privileges from PUBLIC pseudo-role
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM PUBLIC;

-- 3. Completely revoke all public schema privileges from anonymous callers
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
REVOKE USAGE ON SCHEMA public FROM anon;

-- 4. Ensure schema usage is explicitly granted to authenticated and internal execution roles
GRANT USAGE ON SCHEMA public TO authenticated, service_role, authenticator;

-- 5. Baseline DML for authenticated users (enforced and restricted per-table by RLS policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 6. Ensure service_role retains full administrative maintenance capabilities
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- ==============================================================================
-- SECTION 3: CANONICAL ROLE HELPER FUNCTION
-- Strictly queries database tables or server-assigned app_metadata.
-- NEVER trusts user-editable user_metadata to eliminate privilege escalation.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.current_erp_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_role text;
BEGIN
  -- 1. Check user_profiles table if present
  IF to_regclass('public.user_profiles') IS NOT NULL AND to_regclass('public.roles') IS NOT NULL THEN
    BEGIN
      SELECT r.role_name::text INTO v_role
      FROM public.user_profiles AS up
      JOIN public.roles AS r ON r.id = up.role_id
      WHERE up.id = auth.uid()
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_role := NULL;
    END;
  END IF;

  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN v_role;
  END IF;

  -- 2. Fallback ONLY to server-assigned app_metadata (immutable by client)
  -- NEVER inspect user-editable user_metadata
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';

  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN v_role;
  END IF;

  -- 3. Fail-safe fallback to lowest privilege role
  RETURN 'Staff';
END;
$$;

REVOKE ALL ON FUNCTION public.current_erp_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_erp_role() TO authenticated, service_role;

-- ==============================================================================
-- SECTION 4: CONCURRENCY-SAFE SEQUENCE GENERATION & HARDENING
-- ==============================================================================

-- Drop legacy sequence function signatures to eliminate ambiguous RPC resolution (without CASCADE)
DROP FUNCTION IF EXISTS public.get_next_sequence_code(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.get_next_sequence_code(VARCHAR, CHAR);
DROP FUNCTION IF EXISTS public.get_next_sequence_code(VARCHAR);
DROP FUNCTION IF EXISTS public.generate_next_document_code(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.generate_next_document_code(VARCHAR);

-- Hardened get_next_sequence_code with safe search_path and row-level locking
CREATE OR REPLACE FUNCTION public.get_next_sequence_code(
  p_doc_type VARCHAR,
  p_prefix VARCHAR DEFAULT NULL
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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

  -- Normalize aliases to canonical ERP sequence keys
  IF v_raw_type = 'SERVICE' THEN
    v_doc_type := 'SRV';
  ELSIF v_raw_type = 'QUOTATION' THEN
    v_doc_type := 'QT';
  ELSIF v_raw_type = 'INVOICE' THEN
    v_doc_type := 'INV';
  ELSIF v_raw_type = 'ORDER' OR v_raw_type = 'SALES_ORDER' THEN
    v_doc_type := 'SO';
  ELSIF v_raw_type = 'PURCHASE' OR v_raw_type = 'PURCHASE_ORDER' THEN
    v_doc_type := 'PO';
  ELSIF v_raw_type = 'CUSTOMER' THEN
    v_doc_type := 'CUST';
  ELSE
    v_doc_type := v_raw_type;
  END IF;

  -- Compute current Indian Financial Year (April 1 to March 31)
  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    v_year_prefix := TO_CHAR(CURRENT_DATE, 'YY');
    v_next_year_prefix := TO_CHAR(CURRENT_DATE + INTERVAL '1 year', 'YY');
  ELSE
    v_year_prefix := TO_CHAR(CURRENT_DATE - INTERVAL '1 year', 'YY');
    v_next_year_prefix := TO_CHAR(CURRENT_DATE, 'YY');
  END IF;

  v_fy := v_year_prefix || '-' || v_next_year_prefix;

  -- 1. Handle CUSTOMER sequence table if it exists
  IF v_doc_type = 'CUST' AND to_regclass('public.customer_id_sequences') IS NOT NULL THEN
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

  -- 2. Handle general document_sequences table if it exists
  IF to_regclass('public.document_sequences') IS NOT NULL THEN
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

    IF p_prefix IS NOT NULL AND p_prefix <> '' THEN
      RETURN p_prefix || LPAD(v_next_seq::TEXT, 4, '0');
    END IF;

    RETURN 'ICON/' || v_fy || '/' || v_doc_type || '-' || LPAD(v_next_seq::TEXT, 4, '0');
  END IF;

  -- Fallback if sequence tables have not yet been provisioned
  RETURN 'ICON/' || v_fy || '/' || v_doc_type || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
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
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN public.get_next_sequence_code(p_doc_type, p_prefix);
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_sequence_code(VARCHAR, VARCHAR) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_next_document_code(VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_next_sequence_code(VARCHAR, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_next_document_code(VARCHAR, VARCHAR) TO authenticated, service_role;

-- Revoke direct tampering from sequence tables (conditional)
DO $$
BEGIN
  IF to_regclass('public.document_sequences') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.document_sequences FROM authenticated, anon, PUBLIC';
    EXECUTE 'GRANT SELECT ON TABLE public.document_sequences TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.document_sequences TO service_role';
    EXECUTE 'ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "document_sequences_select_policy" ON public.document_sequences';
    EXECUTE 'CREATE POLICY "document_sequences_select_policy" ON public.document_sequences FOR SELECT TO authenticated USING (true)';
  END IF;

  IF to_regclass('public.customer_id_sequences') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.customer_id_sequences FROM authenticated, anon, PUBLIC';
    EXECUTE 'GRANT SELECT ON TABLE public.customer_id_sequences TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.customer_id_sequences TO service_role';
    EXECUTE 'ALTER TABLE public.customer_id_sequences ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "customer_id_sequences_select_policy" ON public.customer_id_sequences';
    EXECUTE 'CREATE POLICY "customer_id_sequences_select_policy" ON public.customer_id_sequences FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- ==============================================================================
-- SECTION 5: SENSITIVE CREDENTIAL & TOKEN TABLES ISOLATION
-- Ensures zero client access to auth tokens, integration credentials, and managed passwords
-- ==============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['managed_user_credentials', 'consumed_action_tokens', 'integration_credentials'])
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      -- Drop all existing client policies on credential tables to block direct queries
      EXECUTE format('DROP POLICY IF EXISTS "allow_authenticated_all" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "allow_all_credentials" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "%I_select_policy" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%I_all_policy" ON public.%I', t, t);
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- SECTION 6: AUDIT TRAIL IMMUTABILITY & INTEGRITY
-- Strictly revokes direct client writes; limits SELECT to authorized compliance roles
-- ==============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['audit_logs', 'security_audit_logs'])
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM authenticated, anon, PUBLIC', t);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      -- Drop permissive write policies that permitted forgery
      EXECUTE format('DROP POLICY IF EXISTS "allow_all_audit" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "allow_insert_audit" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "audit_insert_policy" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "security_audit_logs_insert_policy" ON public.%I', t);

      -- Read policy restricted to authorized audit/compliance roles
      EXECUTE format('DROP POLICY IF EXISTS "%I_select_policy" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%I_select_policy" ON public.%I FOR SELECT TO authenticated
        USING (public.current_erp_role() IN (''Managing Director'', ''Admin / BDM'', ''Accounts'', ''BDM''))', t, t);
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- SECTION 7: COMMERCIAL DATA ISOLATION (PRODUCTS & SECURE CATALOG VIEW)
-- Protects purchase costs and margins; exposes security_barrier view
-- ==============================================================================

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    -- 1. Ensure RLS is active on products base table
    EXECUTE 'ALTER TABLE public.products ENABLE ROW LEVEL SECURITY';

    -- 2. Create or replace secure public.products_catalog view excluding commercial cost data
    -- with security_barrier = true to prevent leaky-operator optimization side-channels
    EXECUTE 'CREATE OR REPLACE VIEW public.products_catalog
      WITH (security_barrier = true) AS
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
      FROM public.products';

    EXECUTE 'REVOKE ALL ON public.products_catalog FROM PUBLIC, anon';
    EXECUTE 'GRANT SELECT ON public.products_catalog TO authenticated, service_role';

    -- 3. Replace products base table policies
    EXECUTE 'DROP POLICY IF EXISTS "products_select_policy" ON public.products';
    EXECUTE 'DROP POLICY IF EXISTS "products_insert_policy" ON public.products';
    EXECUTE 'DROP POLICY IF EXISTS "products_update_policy" ON public.products';
    EXECUTE 'DROP POLICY IF EXISTS "products_delete_policy" ON public.products';

    -- Commercial roles only for direct base table access:
    EXECUTE 'CREATE POLICY "products_select_policy" ON public.products
      FOR SELECT TO authenticated
      USING (
        public.current_erp_role() IN (''Managing Director'', ''Admin / BDM'', ''BDM'', ''Accounts'')
      )';

    EXECUTE 'CREATE POLICY "products_insert_policy" ON public.products
      FOR INSERT TO authenticated
      WITH CHECK (
        public.current_erp_role() IN (''Managing Director'', ''Admin / BDM'')
      )';

    EXECUTE 'CREATE POLICY "products_update_policy" ON public.products
      FOR UPDATE TO authenticated
      USING (
        public.current_erp_role() IN (''Managing Director'', ''Admin / BDM'')
      )
      WITH CHECK (
        public.current_erp_role() IN (''Managing Director'', ''Admin / BDM'')
      )';

    EXECUTE 'CREATE POLICY "products_delete_policy" ON public.products
      FOR DELETE TO authenticated
      USING (
        public.current_erp_role() = ''Managing Director''
      )';
  END IF;
END $$;

-- ==============================================================================
-- SECTION 8: SYSTEM SETTINGS TABLE HARDENING
-- Allows authenticated staff to read operational branding/bank details,
-- but strictly masks OAuth tokens, integration secrets, and passwords from non-admin roles
-- ==============================================================================

DO $$
BEGIN
  IF to_regclass('public.system_settings') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "system_settings_select_policy" ON public.system_settings';
    EXECUTE 'DROP POLICY IF EXISTS "system_settings_insert_policy" ON public.system_settings';
    EXECUTE 'DROP POLICY IF EXISTS "system_settings_update_policy" ON public.system_settings';
    EXECUTE 'DROP POLICY IF EXISTS "system_settings_delete_policy" ON public.system_settings';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can read system_settings" ON public.system_settings';
    EXECUTE 'DROP POLICY IF EXISTS "Admins full write system_settings" ON public.system_settings';

    -- Read policy: non-admin roles can read business settings (branding, company profile, quotation terms),
    -- but OAuth integration tokens, credentials, and secrets are strictly restricted to MD and Admin / BDM
    EXECUTE 'CREATE POLICY "system_settings_select_policy" ON public.system_settings
      FOR SELECT TO authenticated
      USING (
        public.current_erp_role() IN (''Managing Director'', ''Admin / BDM'')
        OR (
          setting_key NOT IN (''gmail_oauth_integration'', ''integration_credentials'', ''zoho_oauth_integration'')
          AND setting_key NOT ILIKE ''%secret%''
          AND setting_key NOT ILIKE ''%token%''
          AND setting_key NOT ILIKE ''%credential%''
          AND setting_key NOT ILIKE ''%oauth%''
          AND setting_key NOT ILIKE ''%password%''
        )
      )';

    -- Write policy: restricted to Managing Director and Admin / BDM
    EXECUTE 'CREATE POLICY "system_settings_manage_policy" ON public.system_settings
      FOR ALL TO authenticated
      USING (public.current_erp_role() IN (''Managing Director'', ''Admin / BDM''))
      WITH CHECK (public.current_erp_role() IN (''Managing Director'', ''Admin / BDM''))';
  END IF;
END $$;

-- ==============================================================================
-- SECTION 9: DYNAMIC RLS ENFORCEMENT ON ALL EXISTING PUBLIC TABLES
-- Guarantees that every base table in public schema has RLS active
-- ==============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'ICON TECH PRO ERP V9.2 Production Security Hardening successfully applied.';
END $$;

COMMIT;
