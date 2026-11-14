-- ==============================================================================
-- ICON TECH PRO ERP V9.2 — ROLLBACK SCRIPT
-- Migration: 20261031000002_v9_2_technical_evaluations_and_sources_rollback.sql
-- Scope: Revert Technical Evaluations & Site Survey Additions
-- Target Database: Supabase PostgreSQL (UAT / Production)
-- ==============================================================================

-- 1. DROP POLICIES AND GRANTS
DROP POLICY IF EXISTS "Authenticated users can read technical evaluations" ON public.technical_evaluations;
DROP POLICY IF EXISTS "Authenticated users can insert technical evaluations" ON public.technical_evaluations;
DROP POLICY IF EXISTS "Authenticated users can update technical evaluations" ON public.technical_evaluations;
DROP POLICY IF EXISTS "Authenticated users can manage site visits" ON public.site_visits;

-- 2. DROP TECHNICAL EVALUATIONS TABLE
DROP TABLE IF EXISTS public.technical_evaluations CASCADE;

-- 3. REMOVE EXPANDED COLUMNS FROM SITE VISITS (IF DESIRED)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'other_project_description') THEN
    ALTER TABLE public.site_visits DROP COLUMN IF EXISTS other_project_description;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'next_action') THEN
    ALTER TABLE public.site_visits DROP COLUMN IF EXISTS next_action;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'follow_up_date') THEN
    ALTER TABLE public.site_visits DROP COLUMN IF EXISTS follow_up_date;
  END IF;
END $$;

-- ==============================================================================
-- END OF ROLLBACK SCRIPT
-- ==============================================================================
