-- ==============================================================================
-- ICON TECH PRO ERP — UAT RBAC PERMISSION REMEDIATION
-- Migration: 20261001000001_uat_user_profiles_rbac_grants.sql
-- Target: Supabase UAT Project njylssodwvaonbeebvjq
-- ==============================================================================

GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
