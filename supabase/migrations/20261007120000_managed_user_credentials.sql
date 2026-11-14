-- ==============================================================================
-- ICON TECH PRO ERP V9.2 — Additive Migration: Managed User Credentials & Action Tokens
-- ==============================================================================
-- Persistent, restart-safe credentials store for managed employee accounts.
-- Stores PBKDF2 SHA-512 password hashes, salts, and password change metadata.
-- Purely additive: Does not modify or drop any existing tables or schemas.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.managed_user_credentials (
    user_id TEXT PRIMARY KEY,
    erp_login_email VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL DEFAULT '',
    algorithm VARCHAR(50) NOT NULL DEFAULT 'pbkdf2_sha512',
    password_algorithm VARCHAR(50) NOT NULL DEFAULT 'pbkdf2_sha512',
    iterations INTEGER NOT NULL DEFAULT 100000,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive index for fast email authentication lookup
CREATE INDEX IF NOT EXISTS idx_managed_user_credentials_erp_email 
ON public.managed_user_credentials (lower(erp_login_email));

CREATE INDEX IF NOT EXISTS idx_managed_user_credentials_email 
ON public.managed_user_credentials (lower(email));

-- Track consumed single-use tokens persistently to prevent replay attacks across restarts
CREATE TABLE IF NOT EXISTS public.consumed_action_tokens (
    token_signature VARCHAR(255) PRIMARY KEY,
    token_hash VARCHAR(128) UNIQUE,
    token_payload TEXT,
    consumed_by_email VARCHAR(255),
    action_type VARCHAR(64) NOT NULL DEFAULT 'action',
    purpose VARCHAR(64) NOT NULL DEFAULT 'action',
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_consumed_action_tokens_expires 
ON public.consumed_action_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_consumed_action_tokens_email 
ON public.consumed_action_tokens (lower(consumed_by_email));

-- Grants for Supabase service role and authenticated application access
GRANT ALL ON TABLE public.managed_user_credentials TO postgres, service_role, authenticated, anon;
GRANT ALL ON TABLE public.consumed_action_tokens TO postgres, service_role, authenticated, anon;

-- Enable RLS
ALTER TABLE public.managed_user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumed_action_tokens ENABLE ROW LEVEL SECURITY;

-- Allow service_role full unrestricted access (bypasses RLS)
DROP POLICY IF EXISTS "service_role_full_access_managed_credentials" ON public.managed_user_credentials;
CREATE POLICY "service_role_full_access_managed_credentials" 
ON public.managed_user_credentials 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_consumed_tokens" ON public.consumed_action_tokens;
CREATE POLICY "service_role_full_access_consumed_tokens" 
ON public.consumed_action_tokens 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);
