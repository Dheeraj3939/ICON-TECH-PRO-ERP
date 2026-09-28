-- ==============================================================================
-- ICON TECH PRO ERP - Migration 28: Phase 1 Company & Document Settings
-- Version: 20260924000001
-- Scope: Centralized Company Profile, Commercial Defaults, Bank Details,
--        Document Numbering Prefixes, and Standardized Terms & Conditions.
-- Entity: Strictly ICON TECH PRO (ORG-ICON-01) - Single Entity Only.
-- Safety: 100% Additive. ZERO DROP TABLE, ZERO DROP COLUMN, ZERO TRUNCATE.
-- ==============================================================================

BEGIN;

-- 1. Centralized Company Settings Table
CREATE TABLE IF NOT EXISTS company_settings (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'ORG-ICON-01',
    legal_name VARCHAR(255) NOT NULL DEFAULT 'ICON TECH PRO PRIVATE LIMITED',
    trade_name VARCHAR(255) NOT NULL DEFAULT 'ICON TECH PRO',
    gstin VARCHAR(20) NOT NULL DEFAULT '36AAACI1234F1Z5',
    pan VARCHAR(20) NOT NULL DEFAULT 'AAACI1234F',
    msme_number VARCHAR(50) DEFAULT 'UDYAM-TS-02-0012345',
    cin_number VARCHAR(50),
    gst_state VARCHAR(100) NOT NULL DEFAULT 'Telangana (36)',
    registered_address TEXT NOT NULL DEFAULT 'Ameer Estate, 503 A Block, SR Nagar, Hyderabad, Telangana - 500038',
    office_address TEXT NOT NULL DEFAULT 'Ameer Estate, 503 A Block, SR Nagar, Hyderabad, Telangana - 500038',
    phone VARCHAR(50) NOT NULL DEFAULT '+91 98490 00001',
    email VARCHAR(120) NOT NULL DEFAULT 'info@icontechpro.in',
    website VARCHAR(120) NOT NULL DEFAULT 'www.icontechpro.in',
    authorized_signatory VARCHAR(120) NOT NULL DEFAULT 'Narsimha Naidu',
    commercial_defaults JSONB NOT NULL DEFAULT '{
        "default_gst_rate": 18,
        "payment_terms": "100% advance against proforma or 30 days credit for approved corporate accounts",
        "quotation_validity_days": 15,
        "warranty_terms": "1 Year Comprehensive Onsite Warranty standard on all AV and IT equipment",
        "delivery_terms": "Ex-stock immediate dispatch or 5-7 business days for sourced distributor products",
        "freight_terms": "Standard freight included within Hyderabad; actuals applicable for outstation dispatches",
        "installation_terms": "Standard installation and demo included by certified ICON TECH PRO field technicians"
    }'::jsonb,
    bank_details JSONB NOT NULL DEFAULT '{
        "bank_name": "IDBI Bank",
        "account_name": "ICON TECH PRO PRIVATE LIMITED",
        "account_number": "0123102000012345",
        "ifsc_code": "IBKL0000123",
        "branch": "SR Nagar, Hyderabad",
        "account_type": "Current Account",
        "upi_id": "icontechpro@idbi"
    }'::jsonb,
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
    standard_terms JSONB NOT NULL DEFAULT '{
        "quotation_terms": "1. Prices are inclusive of 18% GST unless specified otherwise.\n2. Quotation is valid for 15 days from issue date.\n3. Goods once sold will not be taken back without prior authorization.\n4. Subject to Hyderabad jurisdiction.",
        "invoice_terms": "1. Payment is due strictly per agreed commercial terms.\n2. Interest @ 18% p.a. will be charged on overdue payments beyond due date.\n3. All disputes subject to Hyderabad jurisdiction.",
        "payment_instructions": "Please transfer funds via NEFT/RTGS to our official IDBI Bank Current Account and share the UTR reference number."
    }'::jsonb,
    print_settings JSONB NOT NULL DEFAULT '{
        "show_header_logo": true,
        "show_bank_details": true,
        "show_authorized_stamp": true,
        "footer_disclaimer": "This is a computer-generated document issued by ICON TECH PRO under GST Rule 46."
    }'::jsonb,
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
USING (TRUE);

DROP POLICY IF EXISTS "Administrators update company settings" ON company_settings;
CREATE POLICY "Administrators update company settings"
ON company_settings FOR ALL TO authenticated
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
USING (TRUE);

DROP POLICY IF EXISTS "Administrators update document settings" ON document_settings;
CREATE POLICY "Administrators update document settings"
ON document_settings FOR ALL TO authenticated
USING (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
)
WITH CHECK (
    public.current_user_role() IN ('Managing Director', 'Admin / BDM')
);

COMMIT;
