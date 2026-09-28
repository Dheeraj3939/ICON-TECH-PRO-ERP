-- ==============================================================================
-- ICON TECH PRO ERP - Migration 02: Customer Master & Annual Reset ID Engine
-- Version: 20260911000002
-- Scope: Customer ID Sequence Generator (ICONYYXXXX), Customers Table,
--        Immutability Triggers, Audit Triggers, and Row Level Security.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Annual Reset Customer ID Sequence Tracker
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_id_sequences (
    year_prefix CHAR(2) PRIMARY KEY, -- '26', '27', etc.
    last_sequence INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Atomic Customer ID Generator Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_customer_id()
RETURNS TRIGGER AS $$
DECLARE
    current_yy CHAR(2);
    next_seq INT;
BEGIN
    -- Extract 2-digit calendar year (e.g. '26' for 2026, '27' for 2027)
    current_yy := TO_CHAR(CURRENT_DATE, 'YY');

    -- Insert new year starting at 1, or atomically increment existing year sequence
    INSERT INTO customer_id_sequences (year_prefix, last_sequence, updated_at)
    VALUES (current_yy, 1, NOW())
    ON CONFLICT (year_prefix)
    DO UPDATE SET
        last_sequence = customer_id_sequences.last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO next_seq;

    -- Format ID: ICON + YY + 4-digit zero-padded sequence (e.g. ICON260001)
    NEW.customer_code := 'ICON' || current_yy || LPAD(next_seq::TEXT, 4, '0');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. Core Customers Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(16) UNIQUE NOT NULL, -- Auto-generated ICONYYXXXX (Non-editable)
    customer_type VARCHAR(20) NOT NULL CHECK (customer_type IN ('COMPANY', 'INDIVIDUAL')),
    
    -- Primary names
    customer_name VARCHAR(150) NOT NULL,
    company_name VARCHAR(200),
    contact_person VARCHAR(120),
    designation VARCHAR(100),
    
    -- Contact numbers & email
    phone VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    email VARCHAR(120),
    
    -- Address details
    billing_address TEXT,
    shipping_address TEXT,
    city VARCHAR(100) NOT NULL DEFAULT 'Hyderabad',
    state VARCHAR(100) NOT NULL DEFAULT 'Telangana',
    state_code CHAR(2) NOT NULL DEFAULT '36',
    pincode VARCHAR(10),
    
    -- Tax & Commercial compliance
    gstin VARCHAR(15),
    pan VARCHAR(10),
    credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- ERP Operational governance
    enquiry_source VARCHAR(80) NOT NULL DEFAULT 'Walk-in',
    salesperson_id UUID REFERENCES user_profiles(id),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    notes TEXT,
    
    -- Audit fields
    created_by UUID REFERENCES user_profiles(id),
    updated_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index frequently filtered and searched columns
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_salesperson ON customers(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_name);

-- ------------------------------------------------------------------------------
-- 4. Triggers: Automatic ID Assignment & Immutability Protection
-- ------------------------------------------------------------------------------
-- Trigger to generate ICONYYXXXX on INSERT
DROP TRIGGER IF EXISTS trg_generate_customer_id ON customers;
CREATE TRIGGER trg_generate_customer_id
BEFORE INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION generate_customer_id();

-- Immutability Trigger: Prevents modifying customer_code
CREATE OR REPLACE FUNCTION protect_customer_code_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.customer_code IS DISTINCT FROM NEW.customer_code THEN
        RAISE EXCEPTION 'Customer ID (%) is permanent and cannot be modified.', OLD.customer_code;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_customer_code ON customers;
CREATE TRIGGER trg_protect_customer_code
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION protect_customer_code_immutability();

-- Attach immutable audit logging
DROP TRIGGER IF EXISTS trg_audit_customers ON customers;
CREATE TRIGGER trg_audit_customers
AFTER INSERT OR UPDATE OR DELETE ON customers
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- ------------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) Policies
-- ------------------------------------------------------------------------------
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Read policy: Authenticated staff can read customer records
DROP POLICY IF EXISTS "Authenticated users can read customers" ON customers;
CREATE POLICY "Authenticated users can read customers"
ON customers FOR SELECT TO authenticated USING (TRUE);

-- Insert policy: Authorized staff can create customer records
DROP POLICY IF EXISTS "Authorized staff can insert customers" ON customers;
CREATE POLICY "Authorized staff can insert customers"
ON customers FOR INSERT TO authenticated
WITH CHECK (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant')
);

-- Update policy: Admins can update any customer; BDM & Sales Executive can update assigned or self-created records
DROP POLICY IF EXISTS "Staff can update customers" ON customers;
CREATE POLICY "Staff can update customers"
ON customers FOR UPDATE TO authenticated
USING (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
    OR (
        public.current_user_role() IN ('BDM', 'Sales Executive')
        AND (salesperson_id = auth.uid() OR created_by = auth.uid())
    )
);

-- Delete policy: Restricted strictly to Enterprise Super Admin & Operations Head
DROP POLICY IF EXISTS "Admins can delete customers" ON customers;
CREATE POLICY "Admins can delete customers"
ON customers FOR DELETE TO authenticated
USING (public.current_user_role() IN ('Managing Director', 'Admin / BDM'));

COMMIT;
