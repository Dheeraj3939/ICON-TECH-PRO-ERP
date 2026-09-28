-- ==============================================================================
-- ICON TECH PRO ERP - Migration 03: Complete ERP Suite Foundation
-- Version: 20260911000003
-- Scope: All remaining operational modules:
--        1. Generic Annual Sequence Generator (ENQ, QT, SO, INV, PO, DC, PAY, SRV, AMC, RNT)
--        2. Product Catalog (Categories, Brands, Products, HSN/SAC, Margins)
--        3. Presales (Enquiries, Site Visits, Follow-ups)
--        4. Multi-Warehouse Inventory (Warehouses, Stock, Serials, Stock Movements)
--        5. Commercial Proposals (Quotations, Quotation Items, Discount Approvals)
--        6. Sales Orders (Orders, Order Items, Fulfillment Tracking)
--        7. Procurement (Suppliers, Purchase Requisitions, Purchase Orders, GRN)
--        8. Billing & Logistics (Invoices, Invoice Items, Payments, Dispatches, Challans)
--        9. Service & Rentals (Installations, Service Tickets, AMC Contracts, Rentals)
--       10. Audit & Notifications (Documents, Notifications, System Audit Trail)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Universal Transaction Sequence Tracker & ID Generator
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_sequences (
    doc_type VARCHAR(20) NOT NULL, -- 'ENQ', 'QT', 'SO', 'INV', 'PO', 'DC', 'PAY', 'SRV', 'AMC', 'RNT'
    year_prefix CHAR(2) NOT NULL,   -- '26', '27', etc.
    last_sequence INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (doc_type, year_prefix)
);

CREATE OR REPLACE FUNCTION generate_next_document_code(p_doc_type VARCHAR, p_prefix VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    current_yy CHAR(2);
    next_seq INT;
    generated_code VARCHAR(30);
BEGIN
    current_yy := TO_CHAR(CURRENT_DATE, 'YY');

    INSERT INTO document_sequences (doc_type, year_prefix, last_sequence, updated_at)
    VALUES (p_doc_type, current_yy, 1, NOW())
    ON CONFLICT (doc_type, year_prefix)
    DO UPDATE SET
        last_sequence = document_sequences.last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO next_seq;

    generated_code := p_prefix || current_yy || LPAD(next_seq::TEXT, 4, '0');
    RETURN generated_code;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. Product Catalog Master
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(60) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category_id UUID REFERENCES product_categories(id),
    category_name VARCHAR(100),
    brand_id UUID REFERENCES product_brands(id),
    brand_name VARCHAR(100),
    model_name VARCHAR(150),
    description TEXT,
    unit VARCHAR(20) NOT NULL DEFAULT 'Nos.',
    hsn_sac VARCHAR(10) NOT NULL DEFAULT '85286900',
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    mrp NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    target_margin_pct NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    current_stock INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 2,
    is_serialized BOOLEAN NOT NULL DEFAULT TRUE,
    is_service BOOLEAN NOT NULL DEFAULT FALSE,
    supplier_name VARCHAR(150),
    purchase_depot VARCHAR(150),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed 22 Official Product Categories
INSERT INTO product_categories (name) VALUES
    ('Projector'), ('Home Theater'), ('AV Solution'), ('Acoustic'),
    ('Printer'), ('Laptop & Desktop'), ('Interactive Boards'), ('CCTV'),
    ('Servers'), ('Board Room Solution'), ('LED'), ('Display Solution'),
    ('EPABX'), ('Access Points'), ('Biometric Solution'), ('Networking'),
    ('Software Solution'), ('UPS & Batteries'), ('Sound Systems'),
    ('Home Automation'), ('Installation'), ('Others')
ON CONFLICT (name) DO NOTHING;

-- Seed Major Brands
INSERT INTO product_brands (name) VALUES
    ('Epson'), ('Dell Enterprise'), ('HPE'), ('ViewSonic'),
    ('Denon'), ('Hikvision'), ('Cisco'), ('Aruba'), ('BenQ'),
    ('Samsung'), ('Sony'), ('Optoma'), ('D-Link'), ('Honeywell')
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. Presales: Enquiries, Site Visits, Follow-ups
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_number VARCHAR(30) UNIQUE NOT NULL, -- ENQ260001
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_name VARCHAR(150) NOT NULL,
    company_name VARCHAR(200),
    customer_type VARCHAR(20) NOT NULL DEFAULT 'COMPANY',
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(120),
    source VARCHAR(80) NOT NULL DEFAULT 'Direct',
    salesperson_id UUID REFERENCES user_profiles(id),
    salesperson_name VARCHAR(120) NOT NULL DEFAULT 'Dheeraj',
    product_category VARCHAR(100) NOT NULL,
    requirement_summary TEXT NOT NULL,
    estimated_budget NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'Enquiry', -- 'Enquiry', 'Site Visit Scheduled', 'Quotation sent', 'Follow up', 'Order done', 'Lost', 'Cancelled'
    loss_reason TEXT,
    follow_up_date DATE,
    site_visit_required BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_number VARCHAR(30) UNIQUE NOT NULL, -- SV260001
    enquiry_id UUID REFERENCES enquiries(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_name VARCHAR(150) NOT NULL,
    assigned_technician VARCHAR(120) NOT NULL,
    site_address TEXT NOT NULL,
    room_type VARCHAR(100),
    measurements VARCHAR(100),
    scheduled_date TIMESTAMPTZ NOT NULL,
    completed_date TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'COMPLETED', 'RESCHEDULED', 'CANCELLED'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_id UUID REFERENCES enquiries(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(150),
    salesperson_name VARCHAR(120) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    channel VARCHAR(30) NOT NULL DEFAULT 'Phone Call', -- 'Phone Call', 'WhatsApp', 'In-Person', 'Email'
    discussion_summary TEXT NOT NULL,
    next_action TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. Multi-Warehouse Inventory & Serials
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO warehouses (code, name, address) VALUES
    ('WH-HYD-MAIN', 'Central Hyderabad Depot (SR Nagar)', 'Ameer Estate, SR Nagar, Hyderabad'),
    ('WH-HYD-RENTAL', 'Sreeja Rental & Demo Hub', 'Banjara Hills Road No. 12, Hyderabad')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS inventory_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    current_stock INT NOT NULL DEFAULT 0,
    reserved_stock INT NOT NULL DEFAULT 0,
    available_stock INT GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS inventory_serials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id),
    serial_number VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'RESERVED', 'DISPATCHED', 'INSTALLED', 'RENTED_OUT', 'DEFECTIVE'
    allocated_order_number VARCHAR(40),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, serial_number)
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_type VARCHAR(30) NOT NULL, -- 'PURCHASE_RECEIPT', 'SALES_DISPATCH', 'STOCK_ADJUSTMENT', 'RENTAL_OUT', 'RENTAL_RETURN'
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL,
    reference_module VARCHAR(50) NOT NULL,
    reference_number VARCHAR(50) NOT NULL,
    notes TEXT,
    created_by_name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. Quotations & Pricing Governance
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number VARCHAR(40) UNIQUE NOT NULL, -- QT260001
    revision_number INT NOT NULL DEFAULT 1,
    entity_code VARCHAR(30) NOT NULL DEFAULT 'ICON_TECH_PRO',
    enquiry_id UUID REFERENCES enquiries(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_name VARCHAR(150) NOT NULL,
    company_name VARCHAR(200),
    customer_type VARCHAR(20) NOT NULL DEFAULT 'COMPANY',
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(120),
    address TEXT,
    salesperson_name VARCHAR(120) NOT NULL,
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    validity_days INT NOT NULL DEFAULT 15,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    margin_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    payment_terms TEXT,
    delivery_terms TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'Draft', -- 'Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'
    notes TEXT,
    order_id VARCHAR(40),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    sku VARCHAR(60),
    product_name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(20) NOT NULL DEFAULT 'Nos.',
    quantity INT NOT NULL CHECK (quantity > 0),
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    hsn_sac VARCHAR(10) NOT NULL DEFAULT '85286900',
    total_amount NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS discount_approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    quotation_number VARCHAR(40) NOT NULL,
    requested_by_name VARCHAR(120) NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    discount_percent NUMERIC(5, 2) NOT NULL,
    required_approver_role VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    approved_by_name VARCHAR(120),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. Sales Orders
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(40) UNIQUE NOT NULL, -- ORD260001
    entity_code VARCHAR(30) NOT NULL DEFAULT 'ICON_TECH_PRO',
    quotation_id UUID REFERENCES quotations(id),
    quotation_number VARCHAR(40),
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_name VARCHAR(150) NOT NULL,
    company_name VARCHAR(200),
    salesperson_name VARCHAR(120) NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery DATE,
    total_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Confirmed', -- 'Confirmed', 'Pending Material', 'Pending Invoice', 'Pending Dispatch', 'Completed', 'Cancelled'
    material_status VARCHAR(30) NOT NULL DEFAULT 'Stock Reserved', -- 'In Stock', 'Stock Reserved', 'PO Required', 'Partially Received'
    dispatch_status VARCHAR(40) NOT NULL DEFAULT 'Not Dispatched', -- 'Not Dispatched', 'Partial', 'Dispatched', 'Installed & Handed Over'
    invoice_id VARCHAR(40),
    courier_tracking VARCHAR(150),
    customer_po_reference VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    sku VARCHAR(60),
    product_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    selling_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    reserved_quantity INT NOT NULL DEFAULT 0,
    dispatched_quantity INT NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------------------------
-- 7. Procurement & Suppliers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_code VARCHAR(30) UNIQUE NOT NULL,
    supplier_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    billing_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Hyderabad',
    payment_terms_days INT NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(30) UNIQUE NOT NULL, -- PO260001
    entity_code VARCHAR(30) NOT NULL DEFAULT 'ICON_TECH_PRO',
    supplier_id UUID REFERENCES suppliers(id),
    supplier_name VARCHAR(150) NOT NULL,
    supplier_contact VARCHAR(100),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery DATE,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'Draft', -- 'Draft', 'Issued', 'Partially Received', 'Received', 'Cancelled'
    created_by_name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    total_cost NUMERIC(12, 2) NOT NULL,
    received_quantity INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS goods_receipt_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number VARCHAR(30) UNIQUE NOT NULL, -- GRN260001
    po_id UUID REFERENCES purchase_orders(id),
    po_number VARCHAR(30),
    supplier_name VARCHAR(150) NOT NULL,
    vendor_challan_no VARCHAR(60),
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_by_name VARCHAR(120) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. Invoices, Payments, & Logistics (Dispatches)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(40) UNIQUE NOT NULL, -- INV260001
    invoice_type VARCHAR(30) NOT NULL DEFAULT 'TAX_INVOICE',
    entity_code VARCHAR(30) NOT NULL DEFAULT 'ICON_TECH_PRO',
    order_id UUID REFERENCES sales_orders(id),
    order_number VARCHAR(40),
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_name VARCHAR(150) NOT NULL,
    company_name VARCHAR(200),
    gstin VARCHAR(15),
    address TEXT,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    balance_amount NUMERIC(12, 2) GENERATED ALWAYS AS (grand_total - paid_amount) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'Unpaid', -- 'Unpaid', 'Partially Paid', 'Paid', 'Overdue'
    created_by_name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    description TEXT NOT NULL,
    hsn_code VARCHAR(10) NOT NULL DEFAULT '85286900',
    quantity INT NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL DEFAULT 'Nos.',
    rate NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    gst_amount NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(30) UNIQUE NOT NULL, -- PAY260001
    invoice_id UUID REFERENCES invoices(id),
    invoice_number VARCHAR(40),
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(150) NOT NULL,
    company_name VARCHAR(200),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    mode VARCHAR(30) NOT NULL, -- 'Bank Transfer', 'UPI', 'Cheque', 'Cash'
    reference_number VARCHAR(100) NOT NULL, -- UTR or Cheque No
    bank_name VARCHAR(100),
    recorded_by_name VARCHAR(120) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number VARCHAR(30) UNIQUE NOT NULL, -- DSP260001
    delivery_challan_number VARCHAR(40) UNIQUE NOT NULL, -- DC260001
    order_id UUID REFERENCES sales_orders(id),
    order_number VARCHAR(40),
    invoice_id UUID REFERENCES invoices(id),
    invoice_number VARCHAR(40),
    customer_name VARCHAR(150) NOT NULL,
    shipping_address TEXT NOT NULL,
    transporter_name VARCHAR(100),
    vehicle_number VARCHAR(30),
    eway_bill_number VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'Dispatched', -- 'Packed', 'Dispatched', 'Delivered', 'Returned'
    dispatched_by_name VARCHAR(120) NOT NULL,
    dispatch_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. Field Operations: Installations, Service Tickets, AMC, Rentals
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_number VARCHAR(30) UNIQUE NOT NULL, -- INS260001
    order_id UUID REFERENCES sales_orders(id),
    order_number VARCHAR(40),
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_name VARCHAR(150) NOT NULL,
    lead_technician_name VARCHAR(120) NOT NULL,
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'Assigned', -- 'Assigned', 'In Progress', 'Completed', 'On Hold'
    handover_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(30) UNIQUE NOT NULL, -- SRV260001
    entity_code VARCHAR(30) NOT NULL DEFAULT 'SREEJA_ENTERPRISES',
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_name VARCHAR(150) NOT NULL,
    product_name VARCHAR(200),
    serial_number VARCHAR(100),
    complaint_description TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium', -- 'Low', 'Medium', 'High', 'Critical'
    assigned_technician_name VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'Open', -- 'Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'
    resolution_details TEXT,
    service_charge NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS amc_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(40) UNIQUE NOT NULL, -- AMC260001
    entity_code VARCHAR(30) NOT NULL DEFAULT 'SREEJA_ENTERPRISES',
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_name VARCHAR(150) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    annual_visits_count INT NOT NULL DEFAULT 4,
    contract_value NUMERIC(12, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment_rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_number VARCHAR(40) UNIQUE NOT NULL, -- RNT260001
    entity_code VARCHAR(30) NOT NULL DEFAULT 'SREEJA_ENTERPRISES',
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_name VARCHAR(150) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    serial_number VARCHAR(100),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    security_deposit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    rental_fee NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active', -- 'Active', 'Returned', 'Overdue'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. System Indexes
-- ------------------------------------------------------------------------------
-- Indexes for maximum query performance
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs(module);

COMMIT;
