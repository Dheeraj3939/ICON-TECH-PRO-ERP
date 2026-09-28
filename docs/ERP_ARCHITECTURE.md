# ICON TECH PRO ERP - System Architecture Specification

## 1. High-Level Architectural Pattern

The ICON TECH PRO ERP is designed around a **Modern Modular Monolith** utilizing a decoupled client-server architecture with reactive state management, high-performance edge compute, and a robust relational data store.

```
+----------------------------------------------------------------------------------------------------+
|                                    PRESENTATION LAYER (CLIENT)                                     |
|  Responsive Modern Web Application (Desktop Workstations, Tablets, Mobile Site Engineers)          |
|  Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS + Radix UI / shadcn/ui            |
+----------------------------------------------------------------------------------------------------+
                                                |
                                      HTTPS / WSS / REST / RPC
                                                |
+----------------------------------------------------------------------------------------------------+
|                                      API & APPLICATION LAYER                                       |
|  - Next.js Server Actions (Type-safe mutations & business transactions)                           |
|  - Supabase Edge Functions (Deno / TypeScript for asynchronous tasks, webhooks, document generation) |
|  - Granular RBAC Middleware & Session Guardian                                                     |
+----------------------------------------------------------------------------------------------------+
                                                |
                                     Direct / Connection Pooler
                                                |
+----------------------------------------------------------------------------------------------------+
|                                      DATABASE & STORAGE LAYER                                      |
|  - PostgreSQL 15+ (Hosted on Supabase)                                                             |
|  - Row Level Security (RLS) policies enforcing multi-tenant & role-level data isolation            |
|  - PostgreSQL Functions, Stored Procedures, & Triggers (ACID-safe stock reservation, ID sequences) |
|  - Supabase Storage (S3-compatible bucket for contracts, photos, invoices, and spec sheets)        |
+----------------------------------------------------------------------------------------------------+
                                                |
                                     Event Bus / Integration Layer
                                                |
+----------------------------------------------------------------------------------------------------+
|                                   EXTERNAL INTEGRATION ADAPTERS                                    |
|  - WhatsApp Business API (Order updates, Quotation PDFs, Visit reminders)                         |
|  - Transactional Email (Resend / Postmark for official quotations & tax invoices)                 |
|  - Tally Prime Sync Adapter (XML/JSON intermediate accounting interchange format)                   |
|  - GST E-Way Bill & E-Invoice Portal Adapter (Future phase)                                        |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Technology Stack Recommendation

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 15 (App Router) + React 19** | Industry standard for modern web apps; hybrid SSR/SSG enables fast initial load for dashboards, while React Server Components (RSC) drastically reduce client bundle size. |
| **Language** | **TypeScript 5.x** | End-to-end type safety eliminates runtime data mismatches across forms, API contracts, and database models. |
| **Styling & Design System** | **Tailwind CSS + shadcn/ui (Radix Primitives)** | Highly accessible, responsive, customizable component library with enterprise-grade data tables, sheets, dialogs, and forms. |
| **State & Data Fetching** | **TanStack Query (React Query) v5 + Zustand** | Optimistic UI updates, automatic cache invalidation, and lightweight client state for complex multi-line quotation builders. |
| **Table Management** | **TanStack Table v8** | Virtualized, high-performance data tables for sorting, filtering, and pagination over thousands of SKU inventory entries and enquiries. |
| **Backend & Database** | **Supabase (Managed PostgreSQL 15+)** | Open-source enterprise Postgres with built-in connection pooling (pgBouncer/Supavisor), Row-Level Security (RLS), real-time change streams, and automated daily backups. |
| **Authentication** | **Supabase Auth (GoTrue)** | Secure JWT-based authentication with refresh tokens, session persistence, role claims, and Multi-Factor Authentication (MFA) capabilities. |
| **File Storage** | **Supabase Storage (S3-compatible)** | Secure, CDN-backed object storage with signed URL access control for customer documents, site visit photos, and signed handover receipts. |
| **PDF Generation Engine** | **`@react-pdf/renderer` + Serverless Chromium** | Generates pixel-perfect, GST-compliant Quotations, Delivery Challans, and Invoices with precise page-break algorithms and custom brand styling. |
| **Validation Layer** | **Zod** | Schema-first runtime validation for all forms (client-side) and API payloads (server-side). |

---

## 3. Database Architecture & Single-Entity Model

### 3.1 Single-Entity Architecture (ICON TECH PRO)
The ERP operates strictly as a single-business enterprise system for **ICON TECH PRO** (`ORG-ICON-01`), housing Sales, Engineering, Procurement, Dispatch, Installation, Service, and Rental operations under unified governance:

```
                       +-----------------------------------+
                       |        SHARED MASTER DATA         |
                       |  - Users & Employees              |
                       |  - Roles & Permissions            |
                       |  - Customer Master (Polymorphic)  |
                       |  - Product / Item Catalog         |
                       +-----------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------+
|                      ICON TECH PRO DOMAIN                       |
|  - Commercial Quotations & Sales Orders                         |
|  - Resale Inventory & Procurement (Backorder POs)               |
|  - Tax Invoices & Delivery Challans                             |
|  - Service Tickets, RMA & Installation Jobs                     |
|  - AMC Contracts & Equipment Rental Operations                  |
+-----------------------------------------------------------------+
```

1. **Single Entity Architecture (`ORG-ICON-01`):**
   * The ERP operates strictly as a single-business ERP for **ICON TECH PRO**.
   * All transactional records (`quotations`, `sales_orders`, `invoices`, `inventory_items`, `service_tickets`, `rental_agreements`) belong to `ICON_TECH_PRO`.
2. **Unified Operations:**
   * Sales, Procurement, Dispatch, Installation, Service, AMC, and Rental operate under unified ICON TECH PRO governance.
3. **Equipment & Rental Ledger:**
   * Rental and demo equipment is tracked under ICON TECH PRO assets with unit-level serial number lifecycle tracking.

---

### 3.2 Live Supabase Cloud Deployment & Migration Management
* **Production Database:** Hosted on a live Supabase Cloud project, offering enterprise PostgreSQL, connection pooling (Supavisor), automated point-in-time recovery (PITR), and global CDN edge routing.
* **Migration-Driven Schema Version Control:**
  * All database schemas, tables, RLS policies, functions, and triggers are authored as version-controlled SQL files in `supabase/migrations/` (e.g. `20260910000001_core_schema.sql`).
  * Changes are deployed using the Supabase CLI (`supabase db push`) or direct migration runners, guaranteeing 100% reproducibility across environments without manual database edits.
* **Zero Hard-Coded Secrets & Environment Variable Architecture:**
  * No secrets, API keys, or database URLs are ever hard-coded in the repository.
  * Three primary environment variables govern system connectivity:
    * `NEXT_PUBLIC_SUPABASE_URL`: Public Supabase Project URL (safe for client and server).
    * `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public Anonymous Key (safe for client-side queries, strictly constrained by Row-Level Security).
    * `SUPABASE_SERVICE_ROLE_KEY`: Administrative Service Role Key (strictly restricted to server-side Server Actions, background tasks, or system migrations). **NEVER bundled in client JavaScript or exposed to the browser.**

---

## 4. Automatic ID Generation Engine (Annual Reset Architecture)

### 4.1 Specification
Customer IDs must follow the format `ICONYYXXXX`:
* `ICON`: Fixed corporate identifier prefix.
* `YY`: Two-digit calendar year (e.g., `26` for 2026, `27` for 2027).
* `XXXX`: 4-digit zero-padded sequential number starting from `0001` per calendar year.
* **Annual Sequence Reset:**
  * In year 2026: `ICON260001`, `ICON260002`, `ICON260003`...
  * In year 2027: Resets to `ICON270001`, `ICON270002`, `ICON270003`...
* **Zero-Collision & Non-Editable Integrity:**
  * Customer IDs are generated atomically inside PostgreSQL at `INSERT` time using row-level sequence locking.
  * Users are strictly prevented from manually entering or modifying Customer IDs in the application.

### 4.2 Database Logic Pattern
```sql
CREATE TABLE IF NOT EXISTS customer_id_sequences (
    year_prefix CHAR(2) PRIMARY KEY, -- '26', '27', etc.
    last_sequence INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION generate_customer_id()
RETURNS TRIGGER AS $$
DECLARE
    current_yy CHAR(2);
    next_seq INT;
    generated_id VARCHAR(16);
BEGIN
    -- Extract 2-digit current calendar year (e.g., '26' in 2026, '27' in 2027)
    current_yy := TO_CHAR(CURRENT_DATE, 'YY');

    -- Atomically lock and increment counter for the current year.
    -- If new year, initialize sequence at 1 (Annual Reset).
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

CREATE TRIGGER trg_generate_customer_id
BEFORE INSERT ON customers
FOR EACH ROW
WHEN (NEW.customer_code IS NULL OR NEW.customer_code = '')
EXECUTE FUNCTION generate_customer_id();
```

---

## 5. Dynamic Pricing & Configurable Discount Approval Engine

### 5.1 Business Requirement & Governance
Discount approval thresholds must **never be hard-coded**. The system incorporates a dedicated, configurable approval engine managed through the ERP Settings / Admin module.

```
+-----------------------------------------------------------------------------------------+
|                    CONFIGURABLE DISCOUNT APPROVAL HIERARCHY                              |
+-----------------------------------------------------------------------------------------+
|  1. Salesperson Approval Limit  -> Maximum % self-approvable by Sales Executive         |
|  2. BDM Approval Limit          -> Maximum % approvable by Senior BDM                   |
|  3. Admin Approval Limit        -> Maximum % approvable by Admin / BDM (Dheeraj)        |
|  4. MD Approval Limit           -> Final override tier by Managing Director (Narsimha)  |
+-----------------------------------------------------------------------------------------+
```

### 5.2 Architectural Implementation
* Managed via `discount_approval_rules` database table.
* When a quotation is submitted:
  1. The quotation engine calculates the total line-item and header discount percentage.
  2. It queries `discount_approval_rules` against the creator's role.
  3. If discount $\le$ user's role limit $\implies$ auto-approved or immediately sendable.
  4. If discount $>$ user's role limit $\implies$ quote is tagged `PENDING_APPROVAL` and routed to the designated superior role's approval inbox.
* Administrators can adjust percentages at any time via the ERP Settings UI without code modifications or redeployments.

---

## 5. Security & Access Control Architecture

### 5.1 Role-Based Access Control (RBAC)
* **Authentication:** Supabase Auth issues cryptographically signed JWT tokens containing the `user_id` and custom claims.
* **Permission Model:** A 3-tier structure consisting of `Users` -> `Roles` -> `Permissions`.
* **Row-Level Security (RLS):** All queries hitting PostgreSQL execute under RLS policies:
  * Sales Executives (`Reshma`, `Vineet`) can view all customers and products, but their draft quotations and assigned follow-ups are filtered to their assignments or collaborative team tags.
  * Accounts (`Hemalatha`) has read/write privileges over Invoices, Payments, and Purchase Bills, but cannot modify technical site survey notes or product BOMs.
  * Office Assistant (`Manisha`) has read-only or constrained data-entry permissions for lead creation and document uploads.
  * Admin / BDM (`Dheeraj`) and Managing Director (`Narsimha Naidu`) possess unrestricted administrative and supervisory visibility.

---

## 6. Document Generation & PDF Pipeline

1. **Quotation & Invoice Layouts:**
   * Dynamic header containing ICON TECH PRO logo, corporate registration, GSTIN, PAN, Bank Details (IFSC, Account Number, Branch), and Contact info.
   * Customer billing and shipping blocks with GSTIN validation tags.
   * Line-item table with Product Name, Description/Model, HSN/SAC code, Qty, Unit Price, Line Discount, Taxable Value, CGST+SGST or IGST columns, and Total.
   * Standard and customizable Terms & Conditions (Validity, Payment Terms, Delivery Timelines, Warranty terms).
   * Authorized Signatory stamp & signature placement.
2. **Server-Side Generation:**
   * Edge functions compile the document on demand, storing the generated immutable PDF in Supabase Storage and generating a permanent audit log reference.

---

## 7. Integration Architecture & Future Extensions

### 7.1 Tally Prime Accounting Sync
* **Design Strategy:** The accounting module is engineered with schema mappings mirroring standard Tally XML/JSON interchange structures.
* **Voucher Export:** Tax Invoices, Purchase Bills, Receipts, and Payments expose an Export Voucher API producing Tally-compatible XML (Masters, Ledger, and Accounting Vouchers) for seamless monthly reconciliation.

### 7.2 WhatsApp Business Notification Engine
* **Event-Driven Triggers:** Webhook triggers on key state changes:
  * Quotation Approved -> Send client download link.
  * Material Dispatched -> Send tracking number and delivery note.
  * Follow-up Scheduled -> Send automated reminder to customer & sales executive.
  * Service Ticket Logged -> Send ticket acknowledgement to customer.

### 7.3 Email Dispatch Pipeline
* Transactional emails dispatched via modern SMTP/REST API (e.g. Resend) using branded HTML email templates with embedded PDF attachments.
