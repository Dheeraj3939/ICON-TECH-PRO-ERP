-- ==============================================================================
-- ICON TECH PRO ERP - Migration 28: Phase 1 Company & Document Settings
-- Version: 20260924000001
-- Scope: UAT-safe Company Profile and Document Defaults only,
--        Document Numbering Prefixes, and Standardized Terms & Conditions.
-- Entity: Strictly ICON TECH PRO (ORG-ICON-01) - Single Entity Only.
-- Safety: 100% Additive. ZERO DROP TABLE, ZERO DROP COLUMN, ZERO TRUNCATE.
-- ==============================================================================

BEGIN;

-- 1. Centralized Company Settings Table
CREATE TABLE IF NOT EXISTS company_settings (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'ORG-ICON-01',
    legal_name VARCHAR(255) NOT NULL DEFAULT 'ICON TECH PRO',
    trade_name VARCHAR(255) NOT NULL DEFAULT 'ICON TECH PRO',
    gstin VARCHAR(20) NOT NULL DEFAULT 'UAT TEST ONLY',
    pan VARCHAR(20) NOT NULL DEFAULT 'UAT TEST ONLY',
    msme_number VARCHAR(50) DEFAULT NULL,
    cin_number VARCHAR(50),
    gst_state VARCHAR(100) NOT NULL DEFAULT 'UAT TEST ONLY',
    registered_address TEXT NOT NULL DEFAULT 'UAT / TEST ENVIRONMENT',
    office_address TEXT NOT NULL DEFAULT 'UAT / TEST ENVIRONMENT',
    phone VARCHAR(50) NOT NULL DEFAULT '0000000000',
    email VARCHAR(120) NOT NULL DEFAULT 'uat@example.invalid',
    website VARCHAR(120) NOT NULL DEFAULT 'example.invalid',
    authorized_signatory VARCHAR(120) NOT NULL DEFAULT 'UAT TEST ONLY',
    commercial_defaults JSONB NOT NULL DEFAULT '{"default_gst_rate":18,"payment_terms":"UAT / TEST ONLY","quotation_validity_days":15,"warranty_terms":"UAT / TEST ONLY","delivery_terms":"UAT / TEST ONLY","freight_terms":"UAT / TEST ONLY","installation_terms":"Synthetic UAT configuration."}'::jsonb,
    bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(120) DEFAULT 'System Migration'
);

-- Seed initial record if table was just created
INSERT INTO company_settings (id)
VALUES ('ORG-ICON-01')
ON CONFLICT (id) DO NOTHING;

-- 2. Centralized Document Settings Table (Prefixes & Print Standards)
CREATE TABLE IF NOT EXISTS document_settings (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'DOC-SETTINGS-01',
    prefixes JSONB NOT NULL DEFAULT '{
        "enquiry": "ENQ-",
        "quotation": "QT-",
        "sales_order": "ORD-",
        "invoice": "INV-",
        "purchase_order": "PO-",
        "delivery_challan": "DC-",
        "service": "SRV-",
        "customer": "ICON"
    }'::jsonb,
    standard_terms JSONB NOT NULL DEFAULT '{"quotation_terms":"UAT / TEST ONLY. Not a customer offer.","invoice_terms":"UAT / TEST ONLY. Not an invoice.","payment_instructions":"UAT / TEST ONLY. No payment destination configured."}'::jsonb,
    print_settings JSONB NOT NULL DEFAULT '{"show_header_logo":true,"show_bank_details":false,"show_authorized_stamp":false,"footer_disclaimer":"UAT / TEST ENVIRONMENT - TEST DOCUMENT ONLY."}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(120) DEFAULT 'System Migration'
);

-- Seed initial record if table was just created
INSERT INTO document_settings (id)
VALUES ('DOC-SETTINGS-01')
ON CONFLICT (id) DO NOTHING;

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_settings ENABLE ROW LEVEL SECURITY;

-- company_settings: Authenticated users can view; only MD & Admin can update
DROP POLICY IF EXISTS "Authenticated users view company settings" ON company_settings;
CREATE POLICY "Authenticated users view company settings"
ON company_settings FOR SELECT TO authenticated
USING (public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'));

DROP POLICY IF EXISTS "Administrators update company settings" ON company_settings;
CREATE POLICY "Administrators update company settings"
ON company_settings FOR UPDATE TO authenticated
USING (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
)
WITH CHECK (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
);

-- document_settings: Authenticated users can view; only MD & Admin can update
DROP POLICY IF EXISTS "Authenticated users view document settings" ON document_settings;
CREATE POLICY "Authenticated users view document settings"
ON document_settings FOR SELECT TO authenticated
USING (public.current_erp_role() IN ('Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'));

DROP POLICY IF EXISTS "Administrators update document settings" ON document_settings;
CREATE POLICY "Administrators update document settings"
ON document_settings FOR UPDATE TO authenticated
USING (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
)
WITH CHECK (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
);

COMMIT;
