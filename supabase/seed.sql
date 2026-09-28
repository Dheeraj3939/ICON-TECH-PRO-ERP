-- ==============================================================================
-- ICON TECH PRO ERP - Staff Profiles Seed Script
-- Description: Seeds the 6 designated staff user profiles linked to their corporate emails.
-- ==============================================================================

-- NOTE: In Supabase, auth.users records are generated via Supabase Auth (Invite/Signup/Admin API).
-- This script creates a trigger or idempotent upsert linking existing or newly created
-- auth.users to their user_profiles and assigned roles.

DO $$
DECLARE
    role_md_id UUID := '11111111-1111-1111-1111-111111111111';
    role_admin_id UUID := '22222222-2222-2222-2222-222222222222';
    role_bdm_id UUID := '33333333-3333-3333-3333-333333333333';
    role_sales_id UUID := '44444444-4444-4444-4444-444444444444';
    role_accounts_id UUID := '55555555-5555-5555-5555-555555555555';
    role_office_id UUID := '66666666-6666-6666-6666-666666666666';
BEGIN
    -- Function to safely link a user profile if auth.users already contains the email
    -- 1. Narsimha Naidu (Managing Director - Super Admin)
    INSERT INTO user_profiles (id, full_name, email, phone, role_id, is_active, status, can_login, department, designation)
    SELECT id, 'Narsimha Naidu', email, '+91 9800000001', role_md_id, TRUE, 'ACTIVE', TRUE, 'Executive Management', 'Managing Director'
    FROM auth.users WHERE email IN ('md@icontechpro.in', 'narsimha@icontechpro.in')
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        status = EXCLUDED.status,
        can_login = EXCLUDED.can_login,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation;

    -- 2. Dheeraj (Admin / BDM)
    INSERT INTO user_profiles (id, full_name, email, phone, role_id, is_active, status, can_login, department, designation)
    SELECT id, 'Dheeraj', email, '+91 9800000002', role_admin_id, TRUE, 'ACTIVE', TRUE, 'Administration & Business Development', 'System Administrator & BDM'
    FROM auth.users WHERE email = 'dheeraj@icontechpro.in'
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        status = EXCLUDED.status,
        can_login = EXCLUDED.can_login,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation;

    -- 3. Vineet Babu (BDM)
    INSERT INTO user_profiles (id, full_name, email, phone, role_id, is_active, status, can_login, department, designation)
    SELECT id, 'Vineet Babu', email, '+91 9800000003', role_bdm_id, TRUE, 'ACTIVE', TRUE, 'Corporate Sales', 'Senior Business Development Manager'
    FROM auth.users WHERE email = 'vineet@icontechpro.in'
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        status = EXCLUDED.status,
        can_login = EXCLUDED.can_login,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation;

    -- 4. Reshma (Sales Executive)
    INSERT INTO user_profiles (id, full_name, email, phone, role_id, is_active, status, can_login, department, designation)
    SELECT id, 'Reshma', email, '+91 9800000004', role_sales_id, TRUE, 'ACTIVE', TRUE, 'Field Sales', 'Executive - Client Relations'
    FROM auth.users WHERE email = 'reshma@icontechpro.in'
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        status = EXCLUDED.status,
        can_login = EXCLUDED.can_login,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation;

    -- 5. Hemalatha (Accounts)
    INSERT INTO user_profiles (id, full_name, email, phone, role_id, is_active, status, can_login, department, designation)
    SELECT id, 'Hemalatha', email, '+91 9800000005', role_accounts_id, TRUE, 'ACTIVE', TRUE, 'Finance & Accounts', 'Accounts & Compliance Officer'
    FROM auth.users WHERE email IN ('accounts@icontechpro.in', 'hemalatha@icontechpro.in')
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        status = EXCLUDED.status,
        can_login = EXCLUDED.can_login,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation;

    -- 6. Manisha (Office Assistant)
    INSERT INTO user_profiles (id, full_name, email, phone, role_id, is_active, status, can_login, department, designation)
    SELECT id, 'Manisha', email, '+91 9800000006', role_office_id, TRUE, 'ACTIVE', TRUE, 'Operations Support', 'Office & Operations Assistant'
    FROM auth.users WHERE email IN ('admin@icontechpro.in', 'manisha@icontechpro.in')
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        status = EXCLUDED.status,
        can_login = EXCLUDED.can_login,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation;

END $$;
