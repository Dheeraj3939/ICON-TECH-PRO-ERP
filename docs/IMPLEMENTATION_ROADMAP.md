# ICON TECH PRO ERP - Implementation Roadmap & Phase-by-Phase Plan

## 1. Incremental Phased Delivery Philosophy

To guarantee operational stability, avoid regressions, and ensure thorough verification, the ICON TECH PRO ERP will be developed in **16 disciplined, sequential phases**. 

* **Rule 1:** Each phase is self-contained, fully typed, tested, and validated before advancing.
* **Rule 2:** Zero destructive database migrations without explicit user sign-off.
* **Rule 3:** Dedicated Git commit checkpoints at the culmination of every milestone.
* **Rule 4:** Business logic is kept completely isolated from UI presentation layers.

```
PHASE 1: Foundation, DB, Auth, RBAC & Layout
   |
PHASE 2: Customer Master (Company & Individual) with Auto ICONYYXXXX ID
   |
PHASE 3: Enquiries & Lead Pipeline
   |
PHASE 4: Site Visits, Surveys & Follow-up Scheduler
   |
PHASE 5: Product Catalog (Categories, HSN, Tax slabs, Cost & Selling)
   |
PHASE 6: Quotation Builder, Approvals & PDF Engine
   |
PHASE 7: Sales Orders & Auto Stock Allocation / Shortage Logic
   |
PHASE 8: Multi-Warehouse Inventory, Serials & Stock Ledger
   |
PHASE 9: Procurement, Suppliers, POs & Goods Receipt (GRN)
   |
PHASE 10: GST Tax Invoices, Proforma & Accounts Receivable
   |
PHASE 11: Payment Receipts, Advances & Bank Reconciliation
   |
PHASE 12: Warehouse Dispatch, Delivery Challan & Logistics
   |
PHASE 13: Real-time Executive Dashboards & Operational Reports
   |
PHASE 14: ICON TECH PRO - Service Ticketing & AMC
   |
PHASE 15: ICON TECH PRO - Equipment Rental Subsystem
   |
PHASE 16: External Integrations (Tally XML, WhatsApp, Email)
```

---

## 2. Phase-by-Phase Breakdown

### Phase 1: Project Foundation, Database, Authentication & Core Shell
* **Scope & Deliverables:**
  * Next.js 15 App Router initialization with TypeScript, Tailwind CSS, and shadcn/ui.
  * Live Supabase Cloud integration using strict environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`).
  * Migration-driven database versioning setup under `supabase/migrations/` (reproducible schema).
  * Core database initialization: `organizations`, `roles`, `permissions`, `role_permissions`, `user_profiles`, `discount_approval_rules`, `system_settings`, and `audit_logs`.
  * Pre-seeding the 6 designated staff users:
    1. `Narsimha Naidu` (Managing Director)
    2. `Dheeraj` (Admin / BDM)
    3. `Vineet Babu` (BDM)
    4. `Reshma` (Sales Executive)
    5. `Hemalatha` (Accounts)
    6. `Manisha` (Office Assistant)
  * Responsive sidebar navigation, authenticated layout, user profile chip, and business entity badge (`ICON TECH PRO`).
* **Verification & Acceptance Criteria:**
  * All 6 staff accounts authenticate successfully via Supabase Auth.
  * RBAC session middleware redirects users based on assigned roles.
  * Zero client-side leakage of the Service Role Key.

---

### Phase 2: Customer Master Management & Annual Reset Auto-ID Engine
* **Scope & Deliverables:**
  * Deployment of `customers`, `company_details`, `individual_details`, and `customer_id_sequences` tables with RLS.
  * PostgreSQL atomic trigger enforcing the **Annual Reset** `ICONYYXXXX` sequence (`ICON260001` in 2026, `ICON270001` in 2027), restarting at `0001` every calendar year.
  * Customer registration form with conditional rendering:
    * **Company Form:** Company Name, Contact Person, Designation, Phone, Alternate Phone, Email, GSTIN, PAN, Billing Address, Shipping Address, City, State, PIN, Salesperson, Source, Status.
    * **Individual Form:** Customer Name, Phone, Alternate Phone, Email, Address, City, State, PIN, Requirement, Salesperson, Source, Status.
  * Searchable TanStack customer table with filters (Company vs Individual, Salesperson, City, Status).
* **Verification & Acceptance Criteria:**
  * Concurrent customer submissions generate non-overlapping, strictly sequential `ICONYYXXXX` IDs with annual reset logic.
  * Customer IDs are completely read-only and non-editable across all interfaces.
  * Input validation enforces 15-digit GSTIN, 10-digit PAN, and 10-digit Indian phone formatting.

---

### Phase 3: Enquiries & Lead Pipeline
* **Scope & Deliverables:**
  * Enquiries database module with automatic numbering (`ENQ-26-XXXX`).
  * Lead ingestion modal linked to customer master.
  * Kanban / List view showing enquiry status stages (`NEW`, `SITE_VISIT_SCHEDULED`, `QUOTED`, `UNDER_NEGOTIATION`, `ORDER_DONE`, `LOST`, `CANCELLED`, `NA`).
  * Salesperson assignment and priority flagging.
* **Verification & Acceptance Criteria:**
  * Sales executives (`Reshma`) view only their own assigned leads, while Admin/BDM (`Dheeraj`, `Vineet`) see full pipeline.

---

### Phase 4: Follow-ups & Technical Site Visits
* **Scope & Deliverables:**
  * `site_visits` module with surveyor assignment, room dimensions, acoustic checks, and photo uploads to Supabase Storage.
  * `follow_ups` activity timeline with scheduled reminders and outcome logging.
  * Overdue follow-up alert badges.
* **Verification & Acceptance Criteria:**
  * Site survey notes and photos persist to cloud storage and render in the lead profile.
  * Completed follow-ups automatically calculate the next scheduled touchpoint.

---

### Phase 5: Product Catalog, Brands & Pricing Engine
* **Scope & Deliverables:**
  * Product master supporting all 22 categories (Projector, Home Theater, AV Solution, Interactive Boards, CCTV, etc.).
  * Brand and model master tables.
  * Pricing fields: Purchase Cost, Selling Price, MRP, HSN/SAC code, GST rate (18% / 28%).
  * Purchase price visibility restricted from sales executives via RLS.
* **Verification & Acceptance Criteria:**
  * Only MD, Admin, and Accounts can view or edit procurement cost figures.

---

### Phase 6: Quotation Builder & Dynamic PDF Engine
* **Scope & Deliverables:**
  * Interactive multi-line quotation builder with live client-side tax calculations (CGST+SGST vs IGST based on customer state).
  * Dynamic, non-hardcoded discount approval governance evaluating proposals against `discount_approval_rules` (Salesperson limit, BDM limit, Admin limit, MD override).
  * Automated routing to `PENDING_APPROVAL` when discounts exceed user's role authorization limit.
  * Quotation revision tracking (`Q-26-0001-R1`, `R2`).
  * Dynamic, branded PDF generation containing terms, bank coordinates, and sign-off blocks.
* **Verification & Acceptance Criteria:**
  * Quotation PDF compiles with zero visual distortion and matches exact Telangana GST math.
  * Approval limits function dynamically based on values configured in ERP Settings without code redeployment.

---

### Phase 7: Sales Order Conversion & Stock Reservation
* **Scope & Deliverables:**
  * 1-click conversion of Approved Quotations into binding Sales Orders (`SO-26-XXXX`).
  * Concurrency-safe PostgreSQL stock check:
    * If available stock >= order quantity -> Atomically increment `reserved_stock`.
    * If available stock < order quantity -> Mark shortage as Backorder and auto-create Purchase Requisition.
* **Verification & Acceptance Criteria:**
  * Stock reservation prevents duplicate overselling of physical units.

---

### Phase 8: Multi-Warehouse Inventory & Serial Number Tracking
* **Scope & Deliverables:**
  * Physical warehouse locations (`WH-HYD-MAIN`, `WH-HYD-RENTAL`) with Rack/Bin coordinates.
  * Serial number tracker (`inventory_serials`) tracking individual hardware lifecycle (`AVAILABLE` -> `RESERVED` -> `DISPATCHED` -> `INSTALLED`).
  * Stock movement ledger capturing all inbound, outbound, and adjustment transactions.
  * Low-stock threshold alerts.
* **Verification & Acceptance Criteria:**
  * Every inventory quantity shift has an immutable corresponding record in `stock_movements`.

---

### Phase 9: Procurement, Suppliers & Goods Receipt (GRN)
* **Scope & Deliverables:**
  * Supplier master directory with GSTIN and payment terms.
  * Purchase Requisition (PR) to Purchase Order (PO) approval flow.
  * Inward Goods Receipt Note (GRN) module with serial number ingestion and quality inspection.
* **Verification & Acceptance Criteria:**
  * Inward GRN automatically updates physical `current_stock` and fulfills awaiting customer backorders.

---

### Phase 10: GST Tax Invoices & Accounts Receivable
* **Scope & Deliverables:**
  * Generation of statutory Tax Invoices (`INV-26-XXXX`) and Proforma Invoices (`PI-26-XXXX`).
  * Automated Telangana CGST/SGST vs IGST calculation with round-off.
  * Customer outstanding balance tracking and aging buckets (0-30, 31-60, 61-90, 90+ days).
* **Verification & Acceptance Criteria:**
  * Invoices lock upon issuance and prevent unauthorized post-facto edits.

---

### Phase 11: Payment Collection & Bank Reconciliation
* **Scope & Deliverables:**
  * Recording payments (NEFT/RTGS, UPI, Cheque, Cash) tied to specific invoices.
  * Auto-updating invoice status from `ISSUED` to `PARTIALLY_PAID` and `PAID`.
  * Accounts receivable ledger reporting managed by `Hemalatha`.
* **Verification & Acceptance Criteria:**
  * Payments adjust customer outstanding balance in real time.

---

### Phase 12: Warehouse Dispatch & Logistics
* **Scope & Deliverables:**
  * Dispatch staging and barcode/serial number verification against packing list.
  * Delivery Challan (`DC-26-XXXX`) generation with vehicle, transporter, and E-Way bill metadata.
  * Material gate pass documentation.
* **Verification & Acceptance Criteria:**
  * Dispatches cannot be processed without selecting specific registered serial numbers for serialized SKUs.

---

### Phase 13: Executive Dashboards & Operational Reports
* **Scope & Deliverables:**
  * Role-specific KPI boards:
    * **MD / Admin:** Revenue pipeline, gross margins, overdue receivables, stock valuation, salesperson leaderboards.
    * **BDM / Sales Executive:** Personal active pipeline, quotation conversion rates, pending follow-ups.
    * **Accounts:** Daily receipts, pending supplier bills, GST tax liability.
  * Exportable reports in Excel / CSV / PDF.
* **Verification & Acceptance Criteria:**
  * Dashboard data refreshes with sub-second latency using indexed Postgres aggregations.

---

### Phase 14: ICON TECH PRO - Service Ticketing & AMC
* **Scope & Deliverables:**
  * Customer complaint ticket logging (`ICON/26-27/SRV-0001`) with serial number warranty validation.
  * Technician field assignment, diagnosis, spare parts consumption, and digital customer sign-off.
  * AMC contract management with preventive visit scheduling.
* **Verification & Acceptance Criteria:**
  * ICON TECH PRO service transactions operate with transparent labor and spare parts accounting.

---

### Phase 15: ICON TECH PRO - Equipment Rental Subsystem
* **Scope & Deliverables:**
  * Rental agreement contracting with daily/weekly rates and security deposit tracking.
  * Dedicated rental asset fleet management.
  * Return inspection workflow with damage assessment surcharge deduction.
* **Verification & Acceptance Criteria:**
  * Equipment checked out for rental updates status to `RENTED_OUT` and prevents simultaneous commercial resale.

---

### Phase 16: External Integrations & System Hardening
* **Scope & Deliverables:**
  * Tally Prime XML accounting export (Sales, Purchases, Receipts, Payments).
  * Automated WhatsApp Business API notification hooks.
  * Email notification engine (Resend / Postmark).
  * Automated offsite database backup verification and final security pen-testing.
* **Verification & Acceptance Criteria:**
  * Exported XML vouchers successfully import into Tally Prime with zero ledger errors.
