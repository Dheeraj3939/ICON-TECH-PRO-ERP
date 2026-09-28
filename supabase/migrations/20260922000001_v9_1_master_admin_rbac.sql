-- ==============================================================================
-- ICON TECH PRO ERP - Migration 27: V9.1 Master Administration & Dynamic RBAC
-- Version: 20260922000001
-- Scope: User Permission Overrides, Time-Bounded Temporary Access,
--        Extended Custom Field Schema, Dynamic Dropdown Taxonomies,
--        Controlled Module Permissions, and Strict RLS Enforcement.
-- Entity: Strictly ICON TECH PRO (ORG-ICON-01) - Single Entity Only.
-- Safety: 100% Additive. ZERO DROP TABLE, ZERO DROP COLUMN, ZERO TRUNCATE.
-- ==============================================================================

BEGIN;

-- 1. Ensure user_profiles has account lifecycle fields
ALTER TABLE IF EXISTS user_profiles
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS can_login BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS designation VARCHAR(100),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Populate newly registered controlled modules into permissions table
DO $$
DECLARE
    new_modules TEXT[] := ARRAY[
        'HR & Employees',
        'Attendance & Time',
        'Payroll & Compensation',
        'Demo Updates'
    ];
    actions TEXT[] := ARRAY['view', 'create', 'edit', 'delete', 'approve', 'export'];
    m TEXT;
    a TEXT;
BEGIN
    FOREACH m IN ARRAY new_modules LOOP
        FOREACH a IN ARRAY actions LOOP
            INSERT INTO permissions (module, action, description)
            VALUES (m, a, 'Allows ' || a || ' operations on ' || m)
            ON CONFLICT (module, action) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 3. Dedicated User Permission Overrides & Temporary Access Table
CREATE TABLE IF NOT EXISTS user_permission_overrides (
    id VARCHAR(100) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    module VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT TRUE,
    reason TEXT NOT NULL,
    granted_by VARCHAR(120) NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_temporary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_perm_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_perm_overrides_mod_act ON user_permission_overrides(module, action);
CREATE INDEX IF NOT EXISTS idx_user_perm_overrides_temp ON user_permission_overrides(is_temporary, end_date);

-- 4. Custom Field Definitions Table (9 modules support)
CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id VARCHAR(100) PRIMARY KEY,
    module VARCHAR(100) NOT NULL,
    field_key VARCHAR(100) NOT NULL,
    field_label VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    options JSONB,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_searchable BOOLEAN NOT NULL DEFAULT TRUE,
    is_filterable BOOLEAN NOT NULL DEFAULT TRUE,
    is_reportable BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    visible_to_roles JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_custom_field_module_key UNIQUE (module, field_key)
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_module ON custom_field_definitions(module, is_active);

-- 5. Custom Dropdown Options Table
CREATE TABLE IF NOT EXISTS custom_dropdown_options (
    id VARCHAR(100) PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dropdown_category_value UNIQUE (category, value)
);

CREATE INDEX IF NOT EXISTS idx_dropdown_category ON custom_dropdown_options(category, is_active, sort_order);

-- 6. Row Level Security (RLS) Configuration
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_dropdown_options ENABLE ROW LEVEL SECURITY;

-- user_permission_overrides RLS
DROP POLICY IF EXISTS "Administrators manage user permission overrides" ON user_permission_overrides;
CREATE POLICY "Administrators manage user permission overrides"
ON user_permission_overrides FOR ALL TO authenticated
USING (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
)
WITH CHECK (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
);

DROP POLICY IF EXISTS "Authenticated users view their own overrides" ON user_permission_overrides;
CREATE POLICY "Authenticated users view their own overrides"
ON user_permission_overrides FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
);

-- custom_field_definitions RLS
DROP POLICY IF EXISTS "Administrators manage custom field definitions" ON custom_field_definitions;
CREATE POLICY "Administrators manage custom field definitions"
ON custom_field_definitions FOR ALL TO authenticated
USING (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
)
WITH CHECK (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
);

DROP POLICY IF EXISTS "Authenticated users read active custom fields" ON custom_field_definitions;
CREATE POLICY "Authenticated users read active custom fields"
ON custom_field_definitions FOR SELECT TO authenticated
USING (
    is_active = TRUE
);

-- custom_dropdown_options RLS
DROP POLICY IF EXISTS "Administrators manage custom dropdown options" ON custom_dropdown_options;
CREATE POLICY "Administrators manage custom dropdown options"
ON custom_dropdown_options FOR ALL TO authenticated
USING (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
)
WITH CHECK (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
);

DROP POLICY IF EXISTS "Authenticated users read active dropdown options" ON custom_dropdown_options;
CREATE POLICY "Authenticated users read active dropdown options"
ON custom_dropdown_options FOR SELECT TO authenticated
USING (
    is_active = TRUE
);

COMMIT;
