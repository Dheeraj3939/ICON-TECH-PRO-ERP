# ICON TECH PRO ERP - Database Design & Schema Specification

## 1. Design Principles & Data Modeling Approach

1. **Normalized Relational Architecture (3NF):** Elimination of update anomalies and redundancy while maintaining query efficiency.
2. **Polymorphic / Clean Customer Master:** A unified `customers` base table coupled with specialized 1-to-1 extension tables (`company_details` and `individual_details`). This prevents sparse nullable columns and preserves relational integrity.
3. **Single-Entity Architecture:** Operations center on `ICON_TECH_PRO` (`ORG-ICON-01`), housing sales, procurement, installation, service, and rentals under unified governance.
4. **Zero Data Tampering (Immutable Financial & Audit Records):** Invoices, Stock Movement Ledgers, and Audit Logs are strictly append-only. Cancellations and adjustments are executed via compensatory reversing entries (Credit Notes, Adjustments).
5. **Concurrency-Safe Stock & Financial Counters:** Stock balances and sequential identifiers use row locks and sequences rather than client-calculated values.

---

## 2. Master Entity-Relationship (ER) Architecture

```
+------------------+         1:1         +------------------------+
| company_details  |<-------------------|       customers        |
+------------------+                    | - id (UUID, PK)        |
                                        | - customer_code (UK)   |
+--------------------+       1:1        | - customer_type (ENUM) |
| individual_details |<-------------------| - salesperson_id (FK)  |
+--------------------+                  +------------------------+
                                                    |
             +-----------------------+--------------+-----------------------+
             | 1:N                   | 1:N                                  | 1:N
             v                       v                                      v
    +-----------------+     +-----------------+                    +-------------------+
    |    enquiries    |     |   quotations    |                    |   sales_orders    |
    | - id (PK)       |     | - id (PK)       |------------------->| - id (PK)         |
    | - status (ENUM) |     | - status (ENUM) | 1:1 (on approval)  | - status (ENUM)   |
    +-----------------+     +-----------------+                    +-------------------+
             | 1:N                   | 1:N                                  | 1:N
             v                       v                                      v
    +-----------------+     +--------------------+                 +-------------------+
    |   site_visits   |     |  quotation_items   |                 | sales_order_items |
    +-----------------+     +--------------------+                 +-------------------+
             |                       |                                      |
             |                       | references                           | references
             |                       v                                      v
             |              +----------------------------------------------------------+
             |              |                         products                         |
             |              | - id (PK), sku (UK), category_id (FK), brand_id (FK)    |
             |              +----------------------------------------------------------+
             |                                           ^
             v                                           |
    +-----------------+                                  | 1:N
    |   follow_ups    |                                  v
    +-----------------+                         +--------------------+
                                                |  inventory_stock   |
                                                |  inventory_serials |
                                                +--------------------+
```

---

## 3. Core Database Tables & SQL DDL Specification

### 3.1 Organizations & Multi-Entity Master

```sql
CREATE TYPE business_entity_enum AS ENUM ('ICON_TECH_PRO');

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_code business_entity_enum UNIQUE NOT NULL,
    legal_name VARCHAR(150) NOT NULL,
    tagline VARCHAR(255),
    gstin VARCHAR(15) NOT NULL,
    pan VARCHAR(10) NOT NULL,
    state_code CHAR(2) NOT NULL DEFAULT '36', -- Telangana State Code
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city VARCHAR(100) NOT NULL DEFAULT 'Hyderabad',
    state VARCHAR(100) NOT NULL DEFAULT 'Telangana',
    pincode VARCHAR(10) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    bank_ifsc VARCHAR(20) NOT NULL,
    bank_branch VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.2 User Directory & Role-Based Access Control (RBAC)

```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) UNIQUE NOT NULL, -- 'Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module VARCHAR(50) NOT NULL,    -- 'enquiries', 'customers', 'quotations', 'orders', 'inventory', 'invoices', etc.
    action VARCHAR(50) NOT NULL,    -- 'create', 'read_all', 'read_own', 'update_all', 'update_own', 'delete', 'approve'
    description TEXT,
    UNIQUE (module, action)
);

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY, -- Maps directly to auth.users(id) in Supabase
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role_id UUID NOT NULL REFERENCES roles(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configurable Discount Approval Rules (Admin Configured, Non-Hardcoded)
CREATE TABLE discount_approval_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    max_discount_percentage NUMERIC(5, 2) NOT NULL, -- Configurable threshold percentage per role
    requires_approval_from_role_id UUID REFERENCES roles(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (role_id)
);

-- General System & Operational Settings
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES user_profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.3 Customer Master & Polymorphic Subtypes (Annual Reset Auto-ID)

```sql
CREATE TYPE customer_type_enum AS ENUM ('COMPANY', 'INDIVIDUAL');
CREATE TYPE customer_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- Sequence counter table enforcing Annual Reset (ICONYYXXXX -> restarts at 0001 per year)
CREATE TABLE customer_id_sequences (
    year_prefix CHAR(2) PRIMARY KEY, -- '26', '27', etc.
    last_sequence INT NOT NULL DEFAULT 0
);

-- Atomic Customer ID Generator Procedure (Zero Collision, Concurrency Safe)
CREATE OR REPLACE FUNCTION generate_customer_id()
RETURNS TRIGGER AS $$
DECLARE
    current_yy CHAR(2);
    next_seq INT;
    generated_id VARCHAR(16);
BEGIN
    current_yy := TO_CHAR(CURRENT_DATE, 'YY');

    -- Insert new year starting at 1, or increment existing year atomically
    INSERT INTO customer_id_sequences (year_prefix, last_sequence)
    VALUES (current_yy, 1)
    ON CONFLICT (year_prefix)
    DO UPDATE SET last_sequence = customer_id_sequences.last_sequence + 1
    RETURNING last_sequence INTO next_seq;

    -- Format ID: ICON + YY + 4-digit zero-padded sequence (e.g. ICON260001)
    generated_id := 'ICON' || current_yy || LPAD(next_seq::TEXT, 4, '0');
    NEW.customer_code := generated_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(16) UNIQUE NOT NULL, -- Auto-generated ICONYYXXXX (Non-editable)
    customer_type customer_type_enum NOT NULL,
    salesperson_id UUID REFERENCES user_profiles(id),
    enquiry_source VARCHAR(80) NOT NULL,       -- 'Walk-in', 'Referral', 'Website', 'Cold Call', 'Architect'
    status customer_status_enum NOT NULL DEFAULT 'ACTIVE',
    credit_limit NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_generate_customer_id
BEFORE INSERT ON customers
FOR EACH ROW
WHEN (NEW.customer_code IS NULL OR NEW.customer_code = '')
EXECUTE FUNCTION generate_customer_id();

-- Company (B2B) Extension
CREATE TABLE company_details (
    customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(120) NOT NULL,
    designation VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    email VARCHAR(120) NOT NULL,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    billing_address TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Hyderabad',
    state VARCHAR(100) NOT NULL DEFAULT 'Telangana',
    pin VARCHAR(10) NOT NULL
);

-- Individual (B2C) Extension
CREATE TABLE individual_details (
    customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(120) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    email VARCHAR(120),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Hyderabad',
    state VARCHAR(100) NOT NULL DEFAULT 'Telangana',
    pin VARCHAR(10) NOT NULL,
    requirement TEXT
);
```

### 3.4 Enquiries, Site Surveys, and Follow-ups

```sql
CREATE TYPE enquiry_status_enum AS ENUM (
    'NEW', 'SITE_VISIT_SCHEDULED', 'SURVEY_DONE', 'QUOTATION_PENDING',
    'QUOTED', 'UNDER_NEGOTIATION', 'ORDER_DONE', 'LOST', 'CANCELLED', 'NA'
);

CREATE TABLE enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_number VARCHAR(30) UNIQUE NOT NULL, -- ENQ-26-0001
    customer_id UUID NOT NULL REFERENCES customers(id),
    salesperson_id UUID NOT NULL REFERENCES user_profiles(id),
    requirement_summary TEXT NOT NULL,
    estimated_budget NUMERIC(12, 2),
    status enquiry_status_enum NOT NULL DEFAULT 'NEW',
    loss_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE visit_status_enum AS ENUM ('SCHEDULED', 'COMPLETED', 'RESCHEDULED', 'CANCELLED');

CREATE TABLE site_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_number VARCHAR(30) UNIQUE NOT NULL, -- SV-26-0001
    enquiry_id UUID NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    assigned_technician_id UUID NOT NULL REFERENCES user_profiles(id),
    scheduled_date TIMESTAMPTZ NOT NULL,
    completed_date TIMESTAMPTZ,
    status visit_status_enum NOT NULL DEFAULT 'SCHEDULED',
    room_dimensions VARCHAR(100),            -- Length x Width x Height
    acoustic_treatment_needed BOOLEAN DEFAULT FALSE,
    power_backup_available BOOLEAN DEFAULT TRUE,
    cable_conduit_status VARCHAR(150),
    survey_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE follow_up_channel_enum AS ENUM ('PHONE_CALL', 'WHATSAPP', 'IN_PERSON_MEETING', 'EMAIL');

CREATE TABLE follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_id UUID REFERENCES enquiries(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    salesperson_id UUID NOT NULL REFERENCES user_profiles(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    channel follow_up_channel_enum NOT NULL DEFAULT 'PHONE_CALL',
    discussion_summary TEXT,
    next_action TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.5 Product Catalog & Multi-Warehouse Inventory

```sql
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL, -- 'Projector', 'Interactive Boards', etc.
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE product_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(60) UNIQUE NOT NULL,
    category_id UUID NOT NULL REFERENCES product_categories(id),
    brand_id UUID NOT NULL REFERENCES product_brands(id),
    model_name VARCHAR(150) NOT NULL,
    description TEXT,
    hsn_sac VARCHAR(10) NOT NULL,             -- e.g. 85286200 for projectors
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00, -- 18.00, 28.00, etc.
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    mrp NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reorder_level INT NOT NULL DEFAULT 2,
    is_serialized BOOLEAN NOT NULL DEFAULT TRUE,  -- Requires individual serial tracking
    is_service BOOLEAN NOT NULL DEFAULT FALSE,     -- Labor/Installation (Non-physical)
    default_supplier_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL, -- 'WH-HYD-MAIN', 'WH-HYD-RENTAL'
    name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE inventory_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    rack_location VARCHAR(50),
    bin_location VARCHAR(50),
    opening_stock INT NOT NULL DEFAULT 0,
    current_stock INT NOT NULL DEFAULT 0,     -- Physical stock inside warehouse
    reserved_stock INT NOT NULL DEFAULT 0,    -- Allocated to confirmed Sales Orders
    available_stock INT GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
    UNIQUE (product_id, warehouse_id)
);

CREATE TYPE serial_status_enum AS ENUM (
    'AVAILABLE', 'RESERVED', 'DISPATCHED', 'INSTALLED',
    'RENTED_OUT', 'UNDER_SERVICE', 'DEFECTIVE'
);

CREATE TABLE inventory_serials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    serial_number VARCHAR(100) NOT NULL,
    status serial_status_enum NOT NULL DEFAULT 'AVAILABLE',
    allocated_order_id UUID,
    allocated_rental_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, serial_number)
);

CREATE TYPE stock_movement_type_enum AS ENUM (
    'PURCHASE_RECEIPT', 'SALES_DISPATCH', 'ORDER_RESERVATION',
    'RESERVATION_RELEASE', 'RETURN_CUSTOMER', 'RETURN_SUPPLIER',
    'STOCK_ADJUSTMENT', 'SERVICE_REPLACEMENT', 'RENTAL_OUT', 'RENTAL_RETURN'
);

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_type stock_movement_type_enum NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    quantity INT NOT NULL,                    -- Positive or negative impact
    reference_module VARCHAR(50) NOT NULL,    -- 'sales_orders', 'purchase_orders', etc.
    reference_id UUID NOT NULL,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.6 Quotations Engine & Commercial Proposals

```sql
CREATE TYPE quotation_status_enum AS ENUM (
    'DRAFT', 'SENT', 'UNDER_DISCUSSION', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'
);

CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number VARCHAR(40) UNIQUE NOT NULL, -- Q-26-0001
    revision_number INT NOT NULL DEFAULT 1,
    entity_id business_entity_enum NOT NULL DEFAULT 'ICON_TECH_PRO',
    customer_id UUID NOT NULL REFERENCES customers(id),
    enquiry_id UUID REFERENCES enquiries(id),
    salesperson_id UUID NOT NULL REFERENCES user_profiles(id),
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    validity_date DATE NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    round_off NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    terms_and_conditions TEXT NOT NULL,
    notes TEXT,
    status quotation_status_enum NOT NULL DEFAULT 'DRAFT',
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    description TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    hsn_sac VARCHAR(10) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    taxable_amount NUMERIC(12, 2) NOT NULL,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL
);
```

### 3.7 Sales Orders & Order Execution

```sql
CREATE TYPE order_delivery_status_enum AS ENUM ('UNFULFILLED', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'DELIVERED');
CREATE TYPE order_payment_status_enum AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');
CREATE TYPE order_status_enum AS ENUM ('CONFIRMED', 'PROCESSING', 'ORDER_DONE', 'CANCELLED');

CREATE TABLE sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(40) UNIQUE NOT NULL, -- SO-26-0001
    entity_id business_entity_enum NOT NULL DEFAULT 'ICON_TECH_PRO',
    quotation_id UUID REFERENCES quotations(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    salesperson_id UUID NOT NULL REFERENCES user_profiles(id),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    grand_total NUMERIC(12, 2) NOT NULL,
    delivery_status order_delivery_status_enum NOT NULL DEFAULT 'UNFULFILLED',
    payment_status order_payment_status_enum NOT NULL DEFAULT 'UNPAID',
    order_status order_status_enum NOT NULL DEFAULT 'CONFIRMED',
    customer_po_reference VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    description TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_rate NUMERIC(5, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    reserved_quantity INT NOT NULL DEFAULT 0,
    dispatched_quantity INT NOT NULL DEFAULT 0
);
```

### 3.8 Suppliers & Procurement Lifecycle

```sql
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_code VARCHAR(30) UNIQUE NOT NULL,
    supplier_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    billing_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pin VARCHAR(10) NOT NULL,
    payment_terms_days INT NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE pr_status_enum AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PO_CREATED', 'REJECTED');

CREATE TABLE purchase_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_number VARCHAR(30) UNIQUE NOT NULL, -- PR-26-0001
    sales_order_id UUID REFERENCES sales_orders(id), -- Linked if triggered by SO backorder
    requested_by UUID NOT NULL REFERENCES user_profiles(id),
    status pr_status_enum NOT NULL DEFAULT 'DRAFT',
    required_by_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_requisition_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE TYPE po_status_enum AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(30) UNIQUE NOT NULL, -- PO-26-0001
    entity_id business_entity_enum NOT NULL DEFAULT 'ICON_TECH_PRO',
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status po_status_enum NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_purchase_price NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    received_quantity INT NOT NULL DEFAULT 0
);

CREATE TABLE goods_receipt_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number VARCHAR(30) UNIQUE NOT NULL, -- GRN-26-0001
    po_id UUID NOT NULL REFERENCES purchase_orders(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor_delivery_challan VARCHAR(60),
    received_by UUID NOT NULL REFERENCES user_profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
    po_item_id UUID NOT NULL REFERENCES purchase_order_items(id),
    product_id UUID NOT NULL REFERENCES products(id),
    received_quantity INT NOT NULL CHECK (received_quantity >= 0),
    accepted_quantity INT NOT NULL CHECK (accepted_quantity >= 0),
    rejected_quantity INT NOT NULL DEFAULT 0
);
```

### 3.9 Invoices, Payments, & Logistics (Dispatch)

```sql
CREATE TYPE invoice_type_enum AS ENUM ('TAX_INVOICE', 'PROFORMA_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE');
CREATE TYPE invoice_status_enum AS ENUM ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(40) UNIQUE NOT NULL, -- INV-26-0001
    invoice_type invoice_type_enum NOT NULL DEFAULT 'TAX_INVOICE',
    entity_id business_entity_enum NOT NULL DEFAULT 'ICON_TECH_PRO',
    sales_order_id UUID REFERENCES sales_orders(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    taxable_amount NUMERIC(12, 2) NOT NULL,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    balance_amount NUMERIC(12, 2) GENERATED ALWAYS AS (grand_total - paid_amount) STORED,
    status invoice_status_enum NOT NULL DEFAULT 'ISSUED',
    pdf_url TEXT,
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    description TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    hsn_sac VARCHAR(10) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL,
    taxable_amount NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL
);

CREATE TYPE payment_mode_enum AS ENUM ('NEFT_RTGS', 'UPI', 'CHEQUE', 'CASH', 'CREDIT_CARD');

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(30) UNIQUE NOT NULL, -- PAY-26-0001
    invoice_id UUID REFERENCES invoices(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_mode payment_mode_enum NOT NULL,
    reference_transaction_id VARCHAR(100),    -- UTR or Cheque number
    bank_name VARCHAR(100),
    recorded_by UUID NOT NULL REFERENCES user_profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE dispatch_status_enum AS ENUM ('PACKED', 'DISPATCHED', 'DELIVERED', 'RETURNED');

CREATE TABLE dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number VARCHAR(30) UNIQUE NOT NULL, -- DSP-26-0001
    delivery_challan_number VARCHAR(40) UNIQUE NOT NULL, -- DC-26-0001
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id),
    invoice_id UUID REFERENCES invoices(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    dispatch_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transporter_name VARCHAR(100),
    vehicle_number VARCHAR(30),
    eway_bill_number VARCHAR(50),
    status dispatch_status_enum NOT NULL DEFAULT 'DISPATCHED',
    dispatched_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dispatch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    allocated_serials TEXT[] -- Array of allocated serial numbers
);
```

### 3.10 Field Installation, Service, & Rental (ICON TECH PRO)

```sql
CREATE TYPE installation_status_enum AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD');

CREATE TABLE installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_number VARCHAR(30) UNIQUE NOT NULL, -- INS-26-0001
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    lead_technician_id UUID NOT NULL REFERENCES user_profiles(id),
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    status installation_status_enum NOT NULL DEFAULT 'ASSIGNED',
    handover_notes TEXT,
    customer_signoff_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE service_ticket_status_enum AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE service_priority_enum AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE service_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(30) UNIQUE NOT NULL, -- SRV-26-0001
    entity_id business_entity_enum NOT NULL DEFAULT 'ICON_TECH_PRO',
    customer_id UUID NOT NULL REFERENCES customers(id),
    product_id UUID REFERENCES products(id),
    serial_number VARCHAR(100),
    complaint_description TEXT NOT NULL,
    priority service_priority_enum NOT NULL DEFAULT 'MEDIUM',
    assigned_technician_id UUID REFERENCES user_profiles(id),
    status service_ticket_status_enum NOT NULL DEFAULT 'OPEN',
    resolution_details TEXT,
    spare_parts_cost NUMERIC(10, 2) DEFAULT 0.00,
    service_charge NUMERIC(10, 2) DEFAULT 0.00,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE amc_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(40) UNIQUE NOT NULL, -- AMC-26-0001
    entity_id business_entity_enum NOT NULL DEFAULT 'ICON_TECH_PRO',
    customer_id UUID NOT NULL REFERENCES customers(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    annual_visits_count INT NOT NULL DEFAULT 4,
    contract_value NUMERIC(12, 2) NOT NULL,
    terms TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE rental_status_enum AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE', 'CANCELLED');

CREATE TABLE rental_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_number VARCHAR(40) UNIQUE NOT NULL, -- RNT-26-0001
    entity_id business_entity_enum NOT NULL DEFAULT 'ICON_TECH_PRO',
    customer_id UUID NOT NULL REFERENCES customers(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    security_deposit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    rental_fee NUMERIC(12, 2) NOT NULL,
    status rental_status_enum NOT NULL DEFAULT 'ACTIVE',
    terms TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rental_allocated_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_agreement_id UUID NOT NULL REFERENCES rental_agreements(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    serial_number VARCHAR(100) NOT NULL,
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    damage_assessment TEXT,
    damage_charge NUMERIC(10, 2) DEFAULT 0.00
);
```

### 3.11 Documents, Notifications, & Immutable Audit Trail

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    related_entity_type VARCHAR(50) NOT NULL, -- 'quotations', 'site_visits', 'customers', etc.
    related_entity_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(60) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB,
    new_data JSONB,
    performed_by UUID REFERENCES user_profiles(id),
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Performance Indexes & Optimization Strategy

```sql
-- Customer Indexes
CREATE INDEX idx_customers_code ON customers(customer_code);
CREATE INDEX idx_customers_salesperson ON customers(salesperson_id);
CREATE INDEX idx_customers_type ON customers(customer_type);
CREATE INDEX idx_company_name ON company_details(company_name);
CREATE INDEX idx_company_gstin ON company_details(gstin);

-- Enquiries & Presales Indexes
CREATE INDEX idx_enquiries_status ON enquiries(status);
CREATE INDEX idx_enquiries_salesperson ON enquiries(salesperson_id);
CREATE INDEX idx_site_visits_enquiry ON site_visits(enquiry_id);
CREATE INDEX idx_follow_ups_scheduled ON follow_ups(scheduled_at) WHERE is_completed = FALSE;

-- Inventory & Serial Indexes
CREATE INDEX idx_inventory_product ON inventory_stock(product_id);
CREATE INDEX idx_inventory_warehouse ON inventory_stock(warehouse_id);
CREATE INDEX idx_serials_product_status ON inventory_serials(product_id, status);
CREATE INDEX idx_serials_number ON inventory_serials(serial_number);

-- Commercial Transactions Indexes
CREATE INDEX idx_quotations_number ON quotations(quotation_number);
CREATE INDEX idx_quotations_customer ON quotations(customer_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(order_status);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);

-- Audit & Operations
CREATE INDEX idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
```
