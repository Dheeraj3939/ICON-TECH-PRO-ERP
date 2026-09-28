-- ==============================================================================
-- ICON TECH PRO ERP - Migration 05: Admin User, Role & Granular Permission Management
-- Version: 20260912000001
-- Scope: Roles enhancement, Granular 18-module permissions, User access flags,
--        Security audit trail, and Administrative RLS policies.
-- ==============================================================================

BEGIN;

-- 1. Ensure 'is_system' flag on roles to protect core system roles
ALTER TABLE IF EXISTS roles 
ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark the standard 6 organizational roles as core system roles
UPDATE roles 
SET is_system = TRUE 
WHERE role_name IN (
    'Managing Director',
    'Admin / BDM',
    'BDM',
    'Sales Executive',
    'Accounts',
    'Office Assistant'
);

-- 2. Enhance user_profiles with status, login capability, and metadata
ALTER TABLE IF EXISTS user_profiles 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS can_login BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS designation VARCHAR(100),
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 3. Populate Granular Permissions Table across 18 ERP Modules & 6 Actions
-- Modules: Dashboard, Enquiries / Leads, Customers, Site Visits, Follow-ups,
--          Quotations, Sales Orders, Product Catalog, Purchases, Inventory & Serials,
--          Invoices & Billing, Payments, Dispatch & Challans, Installations,
--          Reports, User Management, Role & Permission Management, System Settings
-- Actions: view, create, edit, delete, approve, export

DO $$
DECLARE
    modules TEXT[] := ARRAY[
        'Dashboard',
        'Enquiries / Leads',
        'Customers',
        'Site Visits',
        'Follow-ups',
        'Quotations',
        'Sales Orders',
        'Product Catalog',
        'Purchases',
        'Inventory & Serials',
        'Invoices & Billing',
        'Payments',
        'Dispatch & Challans',
        'Installations',
        'Reports',
        'User Management',
        'Role & Permission Management',
        'System Settings'
    ];
    actions TEXT[] := ARRAY['view', 'create', 'edit', 'delete', 'approve', 'export'];
    m TEXT;
    a TEXT;
BEGIN
    FOREACH m IN ARRAY modules LOOP
        FOREACH a IN ARRAY actions LOOP
            INSERT INTO permissions (module, action, description)
            VALUES (m, a, 'Allows ' || a || ' operations on ' || m)
            ON CONFLICT (module, action) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 4. Dedicated Security Audit Log Table
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    actor_name VARCHAR(120) NOT NULL,
    action VARCHAR(60) NOT NULL, -- 'USER_CREATED', 'ROLE_CHANGED', 'PERMISSION_UPDATED', 'STATUS_CHANGED', etc.
    module VARCHAR(60) NOT NULL DEFAULT 'USER_MANAGEMENT',
    affected_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    affected_user_name VARCHAR(120),
    old_value JSONB,
    new_value JSONB,
    details TEXT NOT NULL,
    ip_address VARCHAR(45) DEFAULT '127.0.0.1'
);

-- Index for rapid searching
CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_actor ON security_audit_logs(actor_name);
CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_logs(action);

-- 5. Row Level Security for Admin Tables
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Administrators can view security audit logs" ON security_audit_logs;
CREATE POLICY "Administrators can view security audit logs"
ON security_audit_logs FOR SELECT TO authenticated
USING (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
);

DROP POLICY IF EXISTS "System can insert security audit logs" ON security_audit_logs;
CREATE POLICY "System can insert security audit logs"
ON security_audit_logs FOR INSERT TO authenticated
WITH CHECK (TRUE);

COMMIT;
