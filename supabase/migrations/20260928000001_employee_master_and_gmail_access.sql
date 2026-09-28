-- ==============================================================================
-- ICON TECH PRO ERP - Migration 32: Official Employee Master Synchronization
-- Version: 20260928000001
-- Scope: Synchronizes the 6 official ICON TECH PRO employee records in the
--        employees table with verified names, corporate emails, phone numbers,
--        and department designations from the Master Specification.
-- Entity: Strictly ICON TECH PRO (ORG-ICON-01) - Single Entity Only.
-- Safety: 100% Additive. ZERO DROP TABLE, ZERO DROP COLUMN, ZERO TRUNCATE.
-- Invariant: Logical separation preserved. NO auth accounts automatically created.
-- ==============================================================================

BEGIN;

-- 1. Ensure employees table exists (defined in 20260914000007_reseller_day7_hr_and_demo.sql)
-- Safely upsert the 6 canonical employee master records
DO $$
BEGIN
    -- 1. Borra Narsimulu (Managing Director / MD)
    INSERT INTO public.employees (
        employee_id, full_name, gender, phone, corporate_email, personal_email,
        department, designation, employment_type, joining_date, work_location_type,
        status, probation_status, skills, notes
    ) VALUES (
        'EMP-0001', 'Borra Narsimulu', 'Male', '+91 80999 09997', 'icontechpro@gmail.com', 'icontechpro@gmail.com',
        'Executive Management', 'Managing Director', 'Full Time', '2020-01-01', 'Office',
        'Active', 'Confirmed',
        ARRAY['Managing Director', 'Business Oversight', 'Management Approvals', 'Business Reports', 'Financial Visibility'],
        'Managing Director & Principal Executive Officer. Primary Gmail account owner.'
    )
    ON CONFLICT (employee_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        corporate_email = EXCLUDED.corporate_email,
        personal_email = EXCLUDED.personal_email,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation,
        notes = EXCLUDED.notes,
        updated_at = NOW();

    -- 2. B V Dheeraj Reddy (Sales Executive / Admin)
    INSERT INTO public.employees (
        employee_id, full_name, gender, phone, corporate_email, personal_email,
        department, designation, employment_type, joining_date, work_location_type,
        status, probation_status, skills, notes
    ) VALUES (
        'EMP-0002', 'B V Dheeraj Reddy', 'Male', '+91 80999 09921', 'dheeraj@icontechpro.in', 'dheeraj@icontechpro.in',
        'Administration & Sales', 'Sales Executive / Admin', 'Full Time', '2021-03-15', 'Office',
        'Active', 'Confirmed',
        ARRAY['Sales', 'Enquiries', 'Quotations', 'Administration', 'ERP Administration', 'Business Development'],
        'Sales Executive & System Administrator with BDM permissions.'
    )
    ON CONFLICT (employee_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        corporate_email = EXCLUDED.corporate_email,
        personal_email = EXCLUDED.personal_email,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation,
        notes = EXCLUDED.notes,
        updated_at = NOW();

    -- 3. B Vineet Babu (Sales Executive)
    INSERT INTO public.employees (
        employee_id, full_name, gender, phone, corporate_email, personal_email,
        department, designation, employment_type, joining_date, work_location_type,
        status, probation_status, skills, notes
    ) VALUES (
        'EMP-0003', 'B Vineet Babu', 'Male', '+91 80999 09918', 'vineet@icontechpro.in', 'vineet@icontechpro.in',
        'Corporate Sales', 'Sales Executive', 'Full Time', '2022-06-01', 'Hybrid',
        'Active', 'Confirmed',
        ARRAY['Lead Handling', 'Enquiries', 'Customer Follow-ups', 'Quotations', 'Sales', 'Order Coordination'],
        'Corporate Sales Executive handling lead progression and client quotations.'
    )
    ON CONFLICT (employee_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        corporate_email = EXCLUDED.corporate_email,
        personal_email = EXCLUDED.personal_email,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation,
        notes = EXCLUDED.notes,
        updated_at = NOW();

    -- 4. Reshma (Sales Executive)
    INSERT INTO public.employees (
        employee_id, full_name, gender, phone, corporate_email, personal_email,
        department, designation, employment_type, joining_date, work_location_type,
        status, probation_status, skills, notes
    ) VALUES (
        'EMP-0004', 'Reshma', 'Female', '+91 7569909997', 'sales@icontechpro.in', 'sales@icontechpro.in',
        'Sales', 'Sales Executive', 'Full Time', '2023-08-01', 'Field',
        'Active', 'Confirmed',
        ARRAY['Lead Handling', 'Enquiries', 'Customer Follow-ups', 'Quotations', 'Sales Activities', 'Order Coordination'],
        'Field Sales Executive handling client communication and sales order coordination.'
    )
    ON CONFLICT (employee_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        corporate_email = EXCLUDED.corporate_email,
        personal_email = EXCLUDED.personal_email,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation,
        notes = EXCLUDED.notes,
        updated_at = NOW();

    -- 5. Hemalath (Accounts)
    INSERT INTO public.employees (
        employee_id, full_name, gender, phone, corporate_email, personal_email,
        department, designation, employment_type, joining_date, work_location_type,
        status, probation_status, skills, notes
    ) VALUES (
        'EMP-0005', 'Hemalath', 'Female', '+91 8099909920', 'accounts@icontechpro.in', 'accounts@icontechpro.in',
        'Finance & Accounts', 'Accounts', 'Full Time', '2021-11-15', 'Office',
        'Active', 'Confirmed',
        ARRAY['Accounts', 'Invoices', 'Payments', 'Collections', 'Financial Records', 'Financial Workflow'],
        'Finance and accounts manager handling GST invoicing, collections, and financial records.'
    )
    ON CONFLICT (employee_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        corporate_email = EXCLUDED.corporate_email,
        personal_email = EXCLUDED.personal_email,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation,
        notes = EXCLUDED.notes,
        updated_at = NOW();

    -- 6. Manisha (Office Assistant)
    INSERT INTO public.employees (
        employee_id, full_name, gender, phone, corporate_email, personal_email,
        department, designation, employment_type, joining_date, work_location_type,
        status, probation_status, skills, notes
    ) VALUES (
        'EMP-0006', 'Manisha', 'Female', '+91 8099909914', 'service01@icontechpro.in', 'service01@icontechpro.in',
        'Office Administration', 'Office Assistant', 'Full Time', '2023-01-10', 'Office',
        'Active', 'Confirmed',
        ARRAY['Office Administration', 'Service Coordination', 'Operational Support', 'Document Handling', 'Assigned ERP Activities'],
        'Office Assistant handling service dispatch coordination, documentation, and office administration.'
    )
    ON CONFLICT (employee_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        corporate_email = EXCLUDED.corporate_email,
        personal_email = EXCLUDED.personal_email,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation,
        notes = EXCLUDED.notes,
        updated_at = NOW();

END $$;

COMMIT;
