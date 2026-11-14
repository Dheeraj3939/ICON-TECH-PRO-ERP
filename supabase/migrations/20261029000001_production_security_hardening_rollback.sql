-- ==============================================================================
-- ICON TECH PRO ERP V9.2 — PRODUCTION SECURITY HARDENING ROLLBACK
-- Target Environment: Production Supabase (xogynsnfzsvimwtvvhpx)
-- Reverts changes made by 20261029000001_production_security_hardening.sql
-- STRICT GUARANTEE: Zero data loss, conditional execution, preserves existing tables
-- ==============================================================================

BEGIN;

DO $$
BEGIN
  RAISE NOTICE 'Starting Rollback for ICON TECH PRO ERP V9.2 Production Security Hardening...';
  RAISE NOTICE 'Rollback Timestamp: %', CLOCK_TIMESTAMP();
END $$;

-- ==============================================================================
-- SECTION 1: RESTORE SYSTEM SETTINGS POLICIES
-- ==============================================================================

DO $$
BEGIN
  IF to_regclass('public.system_settings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "system_settings_select_policy" ON public.system_settings';
    EXECUTE 'DROP POLICY IF EXISTS "system_settings_manage_policy" ON public.system_settings';

    -- Restore baseline foundation policies
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can read system_settings" ON public.system_settings';
    EXECUTE 'CREATE POLICY "Authenticated users can read system_settings"
      ON public.system_settings FOR SELECT TO authenticated USING (TRUE)';

    EXECUTE 'DROP POLICY IF EXISTS "Admins full write system_settings" ON public.system_settings';
    EXECUTE 'CREATE POLICY "Admins full write system_settings"
      ON public.system_settings FOR ALL TO authenticated
      USING (current_erp_role() IN (''Managing Director'', ''Admin / BDM''))
      WITH CHECK (current_erp_role() IN (''Managing Director'', ''Admin / BDM''))';
  END IF;
END $$;

-- ==============================================================================
-- SECTION 2: RESTORE PRODUCTS POLICIES
-- ==============================================================================

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "products_select_policy" ON public.products';
    EXECUTE 'DROP POLICY IF EXISTS "products_insert_policy" ON public.products';
    EXECUTE 'DROP POLICY IF EXISTS "products_update_policy" ON public.products';
    EXECUTE 'DROP POLICY IF EXISTS "products_delete_policy" ON public.products';

    -- Restore general read access to authenticated
    EXECUTE 'CREATE POLICY "products_select_policy" ON public.products
      FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "products_insert_policy" ON public.products
      FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "products_update_policy" ON public.products
      FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- ==============================================================================
-- SECTION 3: RESTORE AUDIT LOG POLICIES
-- ==============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['audit_logs', 'security_audit_logs'])
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "%I_select_policy" ON public.%I', t, t);
      EXECUTE format('GRANT SELECT, INSERT ON TABLE public.%I TO authenticated', t);
      EXECUTE format('CREATE POLICY "%I_select_policy" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
      EXECUTE format('CREATE POLICY "%I_insert_policy" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)', t, t);
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- SECTION 4: RESTORE CREDENTIAL TABLE GRANTS (IF PREVIOUSLY ACCESSED)
-- ==============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['managed_user_credentials', 'consumed_action_tokens', 'integration_credentials'])
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- SECTION 5: RESTORE SEQUENCE POLICIES
-- ==============================================================================

DO $$
BEGIN
  IF to_regclass('public.document_sequences') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "document_sequences_select_policy" ON public.document_sequences';
    EXECUTE 'GRANT SELECT, UPDATE, INSERT ON TABLE public.document_sequences TO authenticated';
    EXECUTE 'CREATE POLICY "document_sequences_all_policy" ON public.document_sequences FOR ALL TO authenticated USING (true)';
  END IF;

  IF to_regclass('public.customer_id_sequences') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "customer_id_sequences_select_policy" ON public.customer_id_sequences';
    EXECUTE 'GRANT SELECT, UPDATE, INSERT ON TABLE public.customer_id_sequences TO authenticated';
    EXECUTE 'CREATE POLICY "customer_id_sequences_all_policy" ON public.customer_id_sequences FOR ALL TO authenticated USING (true)';
  END IF;
END $$;

-- ==============================================================================
-- SECTION 6: RESTORE BASELINE ROLE FUNCTION
-- ==============================================================================

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

DO $$
BEGIN
  RAISE NOTICE 'ICON TECH PRO ERP V9.2 Production Security Hardening Rollback completed.';
END $$;

COMMIT;
