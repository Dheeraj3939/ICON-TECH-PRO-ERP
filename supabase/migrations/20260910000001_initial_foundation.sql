-- ==============================================================================
-- ICON TECH PRO ERP - Migration 01: Initial Foundation & RBAC
-- Version: 20260910000001
-- Scope: Organizations, Roles, Permissions, User Profiles, Discount Rules,
--        System Settings, Audit Logs, and Row Level Security.
-- ==============================================================================

BEGIN;

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Organizations & Business Entities (ICON TECH PRO vs. Sreeja Enterprises)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_code VARCHAR(50) UNIQUE NOT NULL, -- 'ICON_TECH_PRO', 'SREEJA_ENTERPRISES'
    legal_name VARCHAR(150) NOT NULL,
    tagline VARCHAR(255),
    gstin VARCHAR(15),
    pan VARCHAR(10),
    state_code CHAR(2) NOT NULL DEFAULT '36', -- Telangana State Code
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100) DEFAULT 'Hyderabad',
    state VARCHAR(100) DEFAULT 'Telangana',
    pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(100),
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_ifsc VARCHAR(20),
    bank_branch VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. User Roles & Granular Permissions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    UNIQUE (module, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ------------------------------------------------------------------------------
-- 3. User Profiles (Bound 1:1 to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role_id UUID NOT NULL REFERENCES roles(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. Configurable Discount Approval Rules (Dynamic, Non-Hardcoded)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discount_approval_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    max_discount_percentage NUMERIC(5, 2) NOT NULL,
    requires_approval_from_role_id UUID REFERENCES roles(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (role_id)
);

-- ------------------------------------------------------------------------------
-- 5. Operational System Settings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES user_profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. Immutable Audit Logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    module VARCHAR(60) NOT NULL DEFAULT 'SYSTEM',
    entity_name VARCHAR(60),
    table_name VARCHAR(60),
    record_id TEXT,
    action VARCHAR(50) NOT NULL,
    performed_by UUID REFERENCES user_profiles(id),
    performed_by_name VARCHAR(120),
    old_data JSONB,
    new_data JSONB,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Trigger Function
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    INSERT INTO audit_logs (
        table_name,
        module,
        entity_name,
        record_id,
        action,
        old_data,
        new_data,
        performed_by,
        ip_address
    ) VALUES (
        TG_TABLE_NAME,
        TG_TABLE_NAME,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id)::TEXT,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        auth.uid(),
        inet_client_addr()::TEXT
    );
    RETURN NEW;
END;
$$;

-- Attach audit trigger to organizations and discount rules (idempotent)
DROP TRIGGER IF EXISTS trg_audit_organizations ON organizations;
CREATE TRIGGER trg_audit_organizations
AFTER INSERT OR UPDATE OR DELETE ON organizations
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS trg_audit_discount_approval_rules ON discount_approval_rules;
CREATE TRIGGER trg_audit_discount_approval_rules
AFTER INSERT OR UPDATE OR DELETE ON discount_approval_rules
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- ------------------------------------------------------------------------------
-- 7. Row-Level Security (RLS) Policies
-- ------------------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: get logged-in user's role name (in public schema for safe Supabase permissions)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT r.role_name
    FROM public.user_profiles u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();
$$;

-- Read policy: Authenticated staff can read organizations, roles, permissions, settings
DROP POLICY IF EXISTS "Authenticated users can read organizations" ON organizations;
CREATE POLICY "Authenticated users can read organizations"
ON organizations FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read roles" ON roles;
CREATE POLICY "Authenticated users can read roles"
ON roles FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read permissions" ON permissions;
CREATE POLICY "Authenticated users can read permissions"
ON permissions FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read role_permissions" ON role_permissions;
CREATE POLICY "Authenticated users can read role_permissions"
ON role_permissions FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "User profiles read access" ON user_profiles;
CREATE POLICY "User profiles read access"
ON user_profiles FOR SELECT TO authenticated
USING (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
    OR id = auth.uid()
);

DROP POLICY IF EXISTS "Users can update own user profile" ON user_profiles;

DROP POLICY IF EXISTS "Admins can manage user profiles" ON user_profiles;
CREATE POLICY "Admins can manage user profiles"
ON user_profiles FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'))
WITH CHECK (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "Authenticated users can read discount rules" ON discount_approval_rules;
CREATE POLICY "Authenticated users can read discount rules"
ON discount_approval_rules FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read system_settings" ON system_settings;
CREATE POLICY "Authenticated users can read system_settings"
ON system_settings FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins full write organizations" ON organizations;
CREATE POLICY "Admins full write organizations"
ON organizations FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "Admins full write discount rules" ON discount_approval_rules;
CREATE POLICY "Admins full write discount rules"
ON discount_approval_rules FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "Admins full write system_settings" ON system_settings;
CREATE POLICY "Admins full write system_settings"
ON system_settings FOR ALL TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

DROP POLICY IF EXISTS "Admins can read audit_logs" ON audit_logs;
CREATE POLICY "Admins can read audit_logs"
ON audit_logs FOR SELECT TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

-- ------------------------------------------------------------------------------
-- 8. Seed Initial Organizations (Legal/tax/banking fields configured via ERP Settings)
-- ------------------------------------------------------------------------------
INSERT INTO organizations (
    entity_code, legal_name, state_code, is_active
) VALUES
(
    'ICON_TECH_PRO',
    'ICON TECH PRO',
    '36',
    TRUE
),
(
    'SREEJA_ENTERPRISES',
    'Sreeja Enterprises',
    '36',
    TRUE
)
ON CONFLICT (entity_code) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 9. Seed Initial Roles
-- ------------------------------------------------------------------------------
INSERT INTO roles (id, role_name, description) VALUES
('11111111-1111-1111-1111-111111111111', 'Managing Director', 'Enterprise Super Admin with unrestricted ERP access across all entities.'),
('22222222-2222-2222-2222-222222222222', 'Admin / BDM', 'Operational Administrator with full management across sales, inventory, and procurement.'),
('33333333-3333-3333-3333-333333333333', 'BDM', 'Business Development Manager managing enterprise B2B sales, leads, quotes, and orders.'),
('44444444-4444-4444-4444-444444444444', 'Sales Executive', 'Field sales executive handling customer enquiries, site visits, and standard quotations.'),
('55555555-5555-5555-5555-555555555555', 'Accounts', 'Finance and billing officer handling tax invoices, payments, receivables, and ledger exports.'),
('66666666-6666-6666-6666-666666666666', 'Office Assistant', 'Operations and office administration handling lead intake, customer records, and filing.')
ON CONFLICT (role_name) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 10. Seed Initial Discount Approval Rules (Dynamic, Non-Hardcoded)
-- ------------------------------------------------------------------------------
INSERT INTO discount_approval_rules (role_id, max_discount_percentage, requires_approval_from_role_id) VALUES
-- Salesperson: Up to 5.00% (exceeding requires BDM)
('44444444-4444-4444-4444-444444444444', 5.00, '33333333-3333-3333-3333-333333333333'),
-- BDM: Up to 15.00% (exceeding requires Admin / BDM)
('33333333-3333-3333-3333-333333333333', 15.00, '22222222-2222-2222-2222-222222222222'),
-- Admin / BDM: Up to 25.00% (exceeding requires Managing Director)
('22222222-2222-2222-2222-222222222222', 25.00, '11111111-1111-1111-1111-111111111111'),
-- Managing Director: 100.00% (Unrestricted Super Admin override)
('11111111-1111-1111-1111-111111111111', 100.00, NULL)
ON CONFLICT (role_id) DO UPDATE SET
    max_discount_percentage = EXCLUDED.max_discount_percentage,
    requires_approval_from_role_id = EXCLUDED.requires_approval_from_role_id;

-- ------------------------------------------------------------------------------
-- 11. Seed Initial System Settings
-- ------------------------------------------------------------------------------
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('company_profile', '{"active_fy": "2026-27", "default_currency": "INR", "state_code": "36"}'::jsonb, 'Corporate operating parameters'),
('quotation_terms', '{"default_validity_days": 15, "standard_payment_terms": "100% advance against PI or 50% advance and balance before dispatch"}'::jsonb, 'Standard commercial quotation conditions')
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;
