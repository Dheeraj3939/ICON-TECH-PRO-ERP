# ICON TECH PRO ERP — TALLYPRIME INTEGRATION: MASTER BUSINESS REQUIREMENTS DOCUMENT (BRD)

**Document Identifier:** `ITP-TALLY-BRD-V1.0`  
**Target System:** TallyPrime 7.2 (Silver Edition, Single-User) &bull; Gateway: 9999, ODBC: 9000, Scheduler: 10089  
**Target ERP:** ICON TECH PRO Enterprise Resource Planning (ERP) Suite  
**Primary Business Owner:** Accounts Department (Hemalath, Accounts Head)  
**Executive Sponsor:** Borra Narsimulu (Managing Director)  
**Status:** **PLANNING & REQUIREMENTS BASELINE ONLY — INTEGRATION ON HOLD PENDING ACCOUNTS APPROVAL**  

---

## 1. Executive Summary & Integration Purpose

### 1.1 The Business Problem
ICON TECH PRO operates as a leading value-added technology reseller and project integrator specializing in professional audiovisual systems, unified communications, large-venue laser projection, smart interactive displays, and enterprise networking.

Currently, commercial operations and accounting operate in distinct software silos:
1. **Sales & Operations Silo:** The sales, engineering, and project management teams manage leads, site visits, technical evaluations, complex multi-line quotations, and delivery dispatches inside the ERP.
2. **Accounting Silo:** The accounts department manually re-enters every client master, supplier ledger, sales invoice, tax detail, customer purchase order, and bank receipt into **TallyPrime 7.2**.

### 1.2 The Cost of Double Entry
This operational disconnect causes severe commercial bottlenecks:
- **Billing Delays:** Customer invoices generated in Tally are not immediately visible to field sales executives, leading to duplicate customer follow-ups and uncoordinated payment requests.
- **Master Data Mismatches:** Slight differences in spelling, addresses, or GSTINs between ERP customer profiles and Tally ledgers result in reconciliation variances and filing friction.
- **Cash Flow Blindspots:** Payments received and allocated in Tally are not reflected in real-time on sales dashboards, preventing sales engineers from knowing whether a client has cleared overdue balances before booking new hardware orders.
- **Margin Exposure Risks:** Sales personnel asking accounts for payment status often inadvertently gain visibility into sensitive company-wide accounting ledgers, cash flows, and supplier payables.

### 1.3 The Integrated Solution Vision
The ICON TECH PRO ERP &ndash; TallyPrime Integration will establish a secure, automated, and governed bridge between the operational ERP and the accounting ledger. 

```
┌─────────────────────────────────────────────────────────────┐
│                 ICON TECH PRO ERP (Cloud)                   │
│  [CRM] → [Enquiries] → [Quotes] → [Orders] → [Customer 360] │
└──────────────────────────────▲──────────────────────────────┘
                               │ Secure Outbound Sync Agent
                               ▼ (Read Accounting Truth)
┌─────────────────────────────────────────────────────────────┐
│              TALLYPRIME 7.2 (Office Server)                 │
│  [Sundry Debtors] → [Sales Vouchers] → [Receipts/Agst Ref]  │
│  [Sundry Creditors] → [Purchase Bills] → [Bank/Cash Books]  │
└─────────────────────────────────────────────────────────────┘
```

**Key Business Goals:**
1. **Zero Double-Entry:** Customers, products, sales invoices, receipts, and vendor bills flow seamlessly without human re-keying.
2. **100% Tax & Bill Reconciliation:** Automatic bill-by-bill matching (`New Ref` &harr; `Agst Ref`) maintaining identical outstanding balances across systems.
3. **Role-Based Financial Shielding:** Sales executives see payment status and overdue flags for their assigned accounts without exposing private company bank accounts or supplier costs.
4. **Preservation of Single Accounting Truth:** TallyPrime remains the statutory and legal accounting book of record; the ERP acts as the operational and customer relationship engine.

---

## 2. Existing TallyPrime Operating Environment Baseline

Based on the verified configuration details of the ICON TECH PRO office installation:

| Environment Attribute | Verified Office Configuration | Business Operational Context |
| :--- | :--- | :--- |
| **Software Version** | **TallyPrime 7.2** | Latest enterprise-grade release with advanced JSON/XML interfaces. |
| **Licence Type** | **Silver Edition (Single-User)** | **Critical Constraint:** Licensed for one concurrent user (Hemalath). Automated sync routines must **never** lock or block her active daily accounting work. |
| **Main Company** | **ICON TECH PRO - 2026-27** | Current active legal book of accounts covering FY 2026-2027. |
| **Active Financial Year** | **1 April 2026 to 31 March 2027** | Current live transactions. |
| **Gateway Server Port** | **9999** | Core Tally internal communications gateway. |
| **ODBC Port** | **9000** | Read-only SQL query port (Note: Must not be confused with HTTP XML/JSON API endpoint). |
| **Scheduler Port** | **10089** | Background scheduler and background task port. |
| **TSS Subscription Expiry** | **31 July 2027** | Fully active software services subscription. |
| **Installed Customizations**| **1 TDL Add-on, 1 Plug-in** | Customizations currently running on the office machine must be audited to prevent conflicts. |

### Historical Company Datasets on Record:
The office computer contains several past financial year companies:
1. `ICON TECH PRO - 2025-26`
2. `ICON TECH PRO - 2025-26 (from 1-Apr-25)`
3. `ICON TECH PRO - 2024-25 Old Data`
4. `ICON TECH PRO - 2019-2024`
5. Older historical archives, some flagged as **"Migration Required"**.

**Absolute Invariant:** Historical companies contain overlapping financial years and legacy schemas. They must **never** be merged automatically into the ERP. Each company dataset must be imported, verified, and mapped separately under explicit Accounts department supervision.

---

## 3. Customer and Supplier Master Management Workflows

### 3.1 Canonical Master Identity Principle
- **ERP Customer Master is Canonical for Sales:** The ERP Customer record owns commercial relationship data, sales assignments, enquiry history, contact persons, site visit records, and technical evaluations.
- **Tally Ledger is Canonical for Accounting:** Tally owns accounting groups, opening balances, bill-wise credit terms, statutory tax registrations, and bank details.

```
[Tally Sundry Debtors] ──(Sync)──► [Match by GSTIN / PAN / Name] ──► [Link to ERP Customer]
                                              │
                                              ▼ (Uncertain Match)
                                   [Accounts Review Queue]
```

### 3.2 Master Inbound Synchronization Rules
1. **Matching Precedence:**
   - **Step 1: GSTIN Match:** Exact 15-character GSTIN match links the Tally ledger directly to the ERP customer.
   - **Step 2: PAN Match:** If GSTIN is unregistered (Composition/Consumer), match by 10-character PAN.
   - **Step 3: Normalized Legal Name & Address:** Case-insensitive, whitespace-trimmed legal entity name matching.
2. **Ambiguity & Review Queue:**
   - If a Tally ledger matches multiple ERP customers or has a borderline similarity score, the system **never** creates duplicate records or auto-merges them.
   - The item is staged in the **Accounts Review Queue** for Hemalath to confirm or link manually.
3. **Data Preservation:**
   - Synchronizing customer data from Tally must **never** overwrite existing ERP sales assignments (`salesperson_id`), ongoing enquiry notes, or site visit data.
   - Missing fields in Tally (e.g. mobile number, website) must remain blank in the ERP rather than being filled with dummy values.
4. **Supplier Masters:**
   - Ledgers under "Sundry Creditors" are synchronized to the ERP Procurement Supplier Directory.
   - Payment terms, supplier bank details, and GSTIN are synchronized to support back-to-back purchase order validation.

---

## 4. End-to-End Salesperson Workflow (Practical Example)

### Scenario: The "SWAN Technologies" Workflow
*A prominent corporate client, **SWAN Technologies Pvt Ltd**, exists in Tally as an established accounting ledger (`Sundry Debtors`) but was never formally entered into the ERP sales database.*

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Master Sync: Tally ledger "SWAN Technologies" imported to ERP       │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Salesperson opens ERP Customer Search → Types "SWAN"                │
│    ✓ Record found! Displays GSTIN, City, and Payment Clearance         │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Salesperson clicks [Create Enquiry]                                 │
│    → Selects source: "Existing Client / Repeat Business"               │
│    → Enters requirement: "Executive Boardroom 4K Display Upgrade"      │
│    → Assigns Sales Executive: B Vineet Babu                            │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Operational Milestones Progress Inside ERP:                         │
│    → Site Visit scheduled & conducted (Site Report filed)              │
│    → Technical Evaluation completed (Sections A to H)                  │
│    → Quotation QT-26-0142 created & approved                           │
├────────────────────────────────────────────────────────────────────────┤
│ 5. Customer issues PO: "SWAN/PO/2026/891"                              │
│    → Accounts (Hemalath) uploads scanned PO PDF to ERP                 │
│    → ERP Sales Order ORD-26-0095 booked                                │
├────────────────────────────────────────────────────────────────────────┤
│ 6. Billing & Accounting Bridge:                                        │
│    → Accounts issues Tax Invoice in Tally: INV-26-0084                 │
│    → Tally Invoice links to PO "SWAN/PO/2026/891" & ORD-26-0095        │
│    → ERP imports invoice details; shows ₹4,50,000 Outstanding          │
├────────────────────────────────────────────────────────────────────────┤
│ 7. Payment Receipt:                                                    │
│    → SWAN transfers ₹4,50,000 via NEFT to HDFC Bank                    │
│    → Hemalath enters Receipt in Tally (Allocated Agst Ref INV-26-0084) │
│    → ERP syncs receipt: Invoice Marked PAID; Customer Balance ₹0.00    │
└────────────────────────────────────────────────────────────────────────┘
```

**Key Business Benefit:** The salesperson never had to create a duplicate customer record or ask accounts for banking details. The entire journey was traceable from enquiry to cash realization.

---

## 5. Sales Invoices and Customer Receipts Lifecycle

### 5.1 Sales Invoices Inbound Import
The ERP must import all official sales invoices generated in TallyPrime:
- **Voucher Metadata:** Voucher Type (`Sales`), Voucher Number (e.g. `ICON/26-27/INV-0042`), Voucher Date, Effective Due Date.
- **Header Details:** Customer Ledger Name, GSTIN, State Code, Place of Supply, Customer PO Number reference.
- **Line Item Particulars:** Product/Service Description, HSN/SAC Code, Quantity, Billing Unit, Unit Rate, Line Item Discount, Taxable Amount.
- **Tax Breakdown:** Output CGST, Output SGST, Output IGST, RCM applicability.
- **Financial Status in ERP:** Total Invoice Value, Allocated Receipts, Current Balance Due, Overdue Age (Days), Payment Status (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`).

### 5.2 Customer Receipts & Bill-Wise Allocations
In Indian commercial B2B operations, payments rarely follow a simple 1:1 structure. The integration must support all real-world payment modes:

```
Tally Receipt Types Supported:
├── 1. Full Payment: Exact single invoice settlement
├── 2. Partial Payment: Client pays ₹50,000 against ₹1,20,000 invoice (₹70,000 remains due)
├── 3. Multi-Invoice Settlement: Single ₹5,00,000 NEFT settling 3 invoices via Bill-wise Agst Ref
├── 4. Advance Receipt: Client pays advance prior to invoicing (Staged as Advance Credit)
├── 5. On-Account Receipt: Payment received without specific bill allocation (Kept on customer account)
└── 6. Reversals & Bounces: Cheque bounce or receipt cancellation immediately restores invoice balance
```

**Accounting Rules:**
1. **Bill-Wise Allocation Fidelity:** If Tally provides `BILLALLOCATIONS_LIST` with `Agst Ref`, the ERP must match the payment to the exact corresponding invoice numbers.
2. **Unallocated Fallback:** If Tally records an unallocated or "On-Account" receipt, the ERP must **never** randomly guess which invoice was paid. It must credit the customer's total ledger balance and flag the receipt for Accounts review.
3. **Reversal Audit:** If a receipt voucher is cancelled or deleted in Tally, the ERP must restore the outstanding invoice balance and log a `RECEIPT_CANCELLED_IN_TALLY` security audit event with the original timestamp and actor.

---

## 6. Dedicated Customer Purchase Orders (PO) Facility

### 6.1 Operational Reality in Reseller Projects
Enterprise corporate clients (e.g. Cyient, Tech Mahindra, T-Hub) issue legally binding Customer Purchase Orders. These documents contain delivery schedules, liquidated damages clauses, and strict payment milestones that dictate when invoices can be raised and when payments fall due.

### 6.2 Proposed Accounts PO Management Module
Hemalath (Accounts) will have a dedicated facility to upload, verify, and monitor Customer POs:
1. **Document Upload:** Secure PDF and high-resolution scanned image upload.
2. **Structured Metadata Capture:**
   - Customer Name & Code.
   - Customer PO Number & Official PO Date.
   - Total PO Value (Inclusive of GST).
   - Validity Period / Delivery Deadline.
   - Approved Payment Terms (e.g. 15, 30, 45, 60, 90 Days or Milestone-based).
   - Due Date Starting Event (Critical: Specify whether the payment clock starts from **Invoice Date**, **Delivery / LR Date**, **Material Acceptance / GRN Date**, or **Installation Sign-off**).
3. **Invoice-to-PO Reconciliation:**
   - When a Tally sales invoice is imported, the system parses the `PO Number` field.
   - The invoice is automatically linked to the active uploaded Customer PO.
   - Tracks **Cumulative Invoiced Value** vs **Total PO Value** to prevent over-billing or unbilled balances.
4. **Conflict Resolution:**
   - If Tally's default ledger credit period (e.g. 30 days) conflicts with the uploaded PO payment terms (e.g. 60 days from GRN), the system flags a **Payment Terms Conflict** for Accounts adjudication.

---

## 7. Dispatch, Delivery Challans & E-Way Bill Integration

### 7.1 Statutory Context (Rule 55 CGST Rules 2017)
Goods transported for site installation, testing, or back-to-back delivery require Delivery Challans and, where value exceeds ₹50,000, statutory **E-Way Bills**.

### 7.2 Proposed E-Way Bill Tracking Features
1. **Visibility in ERP Dispatch:**
   - Link E-Way Bill numbers to Delivery Challans and Tax Invoices.
   - Track E-Way Bill Number (12 digits), Generation Date, Validity Date/Time, Distance (KM), Transporter ID/Name, and Vehicle Number.
2. **Expiry Alerts:**
   - Automated alert generated 8 hours prior to E-Way Bill expiration if goods have not been confirmed as delivered.
3. **Manual Capture Fallback:**
   - If E-Way Bills are generated directly on the government portal rather than inside Tally, provide an authorized manual entry and PDF upload option in the ERP.
4. **Decoupled Delivery Status:**
   - Generating an E-Way Bill or Delivery Challan **never** automatically marks an order as delivered. Official delivery requires an acknowledged physical stamp or customer sign-off scan in `signed-documents.ts`.

---

## 8. Comprehensive Accounting Voucher Scope

The integration architecture will accommodate all relevant accounting voucher types used in ICON TECH PRO:

| Voucher Category | Voucher Types | Business Function in ICON TECH PRO | Inbound/Outbound Scope |
| :--- | :--- | :--- | :--- |
| **Sales** | `Sales` | Official customer GST tax invoices. | Tally &rarr; ERP Import |
| | `Credit Note` | Commercial rate revisions, discount allowances, sales returns. | Tally &rarr; ERP Import |
| **Purchase** | `Purchase` | Distributor hardware procurement bills (Optoma, Samsung, etc.). | Tally &rarr; ERP Import |
| | `Debit Note` | Distributor rate protections, hardware returns, warranty claims. | Tally &rarr; ERP Import |
| **Receipts** | `Receipt` | Client bank transfers (NEFT/RTGS/IMPS), cheques, on-account funds. | Tally &rarr; ERP Import |
| **Payments** | `Payment` | Vendor bill clearances, statutory GST/TDS tax payments. | Tally &rarr; ERP Import |
| **Banking** | `Contra` | Cash deposits, cash withdrawals, inter-bank transfers. | Internal Tally (Excluded from Sales UI) |
| **Adjustments**| `Journal` | Year-end adjustments, depreciation, provision allocations. | Internal Tally (Audit View Only) |

**Explicit Exclusions from Integration:**
- **Payroll & Salary Vouchers:** Managed independently inside ERP HR module (`employee_salary_history`, `payslips`); not synced to Tally.
- **Manufacturing & Bill of Materials (BOM):** ICON TECH PRO is a value-added reseller; no assembly or manufacturing vouchers are used.
- **Point of Sale (POS):** Retail counter POS vouchers are outside business scope.

---

## 9. Customer 360 &ndash; Unified Commercial & Financial Dossier

The Customer 360 screen will present a comprehensive view uniting operational sales history with accounting balances:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER 360 DOSSIER                            │
├──────────────────────────────────┬─────────────────────────────────────┤
│   ERP OPERATIONAL MILESTONES     │      TALLY FINANCIAL LEDGER         │
│  • Primary Contacts & Locations  │  • Current Outstanding Balance      │
│  • Assigned Salesperson (BDM)    │  • Total Overdue Amount (>30/60d)   │
│  • Enquiries & Lead Sources      │  • Active Credit Limit & Terms      │
│  • Site Visit Reports            │  • Invoices (Paid / Unpaid)         │
│  • Technical Evaluations (A-H)   │  • Bill-Wise Receipt History        │
│  • Approved Quotations & Revisions│ • Credit Notes & Adjustments       │
│  • Booked Sales Orders           │  • Advance Payments on Account      │
│  • Material Delivery Challans    │  • Uploaded Customer Purchase Orders │
│  • Installation & AMC Contracts  │  • Invoice-to-PO Match Status       │
└──────────────────────────────────┴─────────────────────────────────────┘
```

**Privacy & Security Boundary:**
- Sales Executives see: Invoices raised, payments received, remaining balance, and overdue days.
- Sales Executives **do not see**: Company bank account numbers, total company-wide revenues, or internal accounting journal adjustments.

---

## 10. Supplier and Procurement Integration

1. **Procurement Linking:** Match Tally purchase bills to ERP Purchase Orders (`PurchaseOrder` in `procurement.ts`) using distributor PO numbers and GSTIN.
2. **3-Way Match Verification:** Compare ERP Purchase Order &rarr; Goods Receipt Note (GRN) &rarr; Tally Purchase Bill. Highlight quantity or price variances.
3. **Payment Decoupling:** Recording a payment to a distributor in Tally does **not** automatically mark physical materials as received at the Hyderabad site. Material receipt must be independently verified by the logistics team.

---

## 11. Role-Based Financial Security & Access Control

Financial data access must strictly conform to the organizational hierarchy:

| User Role | Designated Person(s) | Authorized Financial & Tally Access Scope |
| :--- | :--- | :--- |
| **Managing Director** | Borra Narsimulu | Full executive dashboards, company-wide P&L, aging receivables/payables summaries, audit logs. No direct technical sync controls by default. |
| **Accounts Head** | **Hemalath** | **Sole Authorized Integration Operator:** Full access to Tally Workspace, sync controls, ledger mapping, voucher registers, PO uploads, reconciliations, and error queues. |
| **Admin / BDM** | B V Dheeraj Reddy | Operational system oversight, user role administration, senior sales escalations, high-value quotation approvals. |
| **BDM** | Corporate BDM | Team sales performance, collection tracking for assigned corporate accounts. No unrestricted company-wide ledger view. |
| **Sales Executive** | B Vineet Babu, Reshma | Assigned client payment status, overdue warnings, invoice clearance flags. Zero access to private banking or supplier purchase costs. |
| **Office Assistant** | Manisha | Material dispatch tracking, delivery challan generation, customer delivery acknowledgement archiving. |
| **Service Engineer** | Field Engineers | Simple payment clearance indicator (e.g. "Account Clear for Installation") without numerical ledger figures. |

**Server-Side Invariant:** All access restrictions are enforced at the database and server action layer via `requireRole(...)`. Financial metrics are never sent to client bundles and hidden with CSS.

---

## 12. Multi-Channel Notification & Alerting Engine

The integration will feed into the central ERP notification engine for real-time operational coordination:

| Notification Trigger | Trigger Condition | Primary Recipient(s) | Delivery Mode |
| :--- | :--- | :--- | :--- |
| **Customer PO Uploaded** | New PO PDF uploaded by Accounts | Assigned Sales Executive, BDM | In-App ERP |
| **Payment Received** | Customer receipt synced from Tally | Assigned Sales Executive, Accounts | In-App ERP |
| **Partial Payment** | Partial receipt allocated to invoice | Assigned Sales Executive, Accounts | In-App ERP |
| **Invoice Due Soon** | 7 days prior to payment due date | Assigned Sales Executive | In-App ERP |
| **Invoice Overdue** | 1 day past agreed payment terms | Sales Exec, Accounts, BDM | In-App ERP + Escalation |
| **E-Way Bill Expiring** | 8 hours prior to transit validity expiry | Dispatch Team, Office Assistant | In-App ERP (High Priority) |
| **Invoice-to-PO Mismatch**| Invoice amount exceeds PO value | Accounts (Hemalath) | In-App ERP Review Queue |
| **Unmapped Ledger Alert**| New customer in Tally without match | Accounts (Hemalath) | In-App ERP Action Item |
| **Sync Failure Alert** | Office sync agent unreachable or error | Accounts (Hemalath), Admin | In-App ERP Diagnostic Banner |
| **Reconciliation Variance**| Balance discrepancy > ₹1.00 detected | Accounts (Hemalath), MD | In-App Weekly Digest |

*Note: Initial launch will use In-App ERP notification bells and dashboard action queues. External automated Email and WhatsApp dispatches will be activated only after formal approval of credentials and templates.*

---

## 13. Historical Multi-Company & Financial Year Governance

### 13.1 Company Datasets Identification
The Tally environment holds multiple financial years:
1. `ICON TECH PRO - 2026-27` (Live Active FY)
2. `ICON TECH PRO - 2025-26`
3. `ICON TECH PRO - 2025-26 (from 1-Apr-25)`
4. `ICON TECH PRO - 2024-25 Old Data`
5. `ICON TECH PRO - 2019-2024`
6. Older migration-required archives.

### 13.2 Governance Rules
1. **Isolation Invariant:** Historical datasets must be imported into distinct, partitioned company contexts in the ERP database.
2. **Duplicate Detection:** Identify and eliminate duplicate vouchers between `2025-26` and `2025-26 (from 1-Apr-25)` prior to import.
3. **Read-Only Archival:** All historical records prior to 1 April 2026 are marked **STRICTLY READ-ONLY** in the ERP. No edits or adjustments can be made to historical records.
4. **Opening Balance Reconciliation:** Verify that the closing debtor and creditor balances of FY 2025-26 match the opening balances of FY 2026-27 to the exact rupee before importing transactions.

---

## 14. Data Governance, Master Ownership & Conflict Resolution Rules

Clear system boundaries prevent data corruption and conflicting records:

| Data Entity | Authoritative System of Record | ERP Operational Role | Conflict Resolution Rule |
| :--- | :--- | :--- | :--- |
| **Chart of Accounts & Ledgers** | **TallyPrime** | Synced Directory | Tally ledger names and groupings are immutable in ERP. |
| **Sales Leads & Enquiries** | **ICON TECH PRO ERP** | Native CRM Master | Not synced to Tally. Managed exclusively in ERP. |
| **Quotations & Revisions** | **ICON TECH PRO ERP** | Native CPQ Engine | Not synced to Tally until converted to an official Tax Invoice. |
| **Customer Purchase Orders** | **ICON TECH PRO ERP** | Native Document Repository| Accounts uploads PO to ERP; links to Tally invoice. |
| **Tax Invoices (Official)** | **TallyPrime** | Read-Only Import & Mirror | Invoice numbers, dates, and amounts are owned by Tally. |
| **Payment Receipts & Banking** | **TallyPrime** | Read-Only Import & Mirror | Bank transactions and bill allocations are owned by Tally. |
| **Delivery Challans (Rule 55)**| **ICON TECH PRO ERP** | Native Logistics Module | Created in ERP; E-Way Bill numbers linked from portal/Tally. |
| **Procurement & GRN** | **ICON TECH PRO ERP** | Native Logistics Module | ERP tracks physical goods receipt; Tally tracks financial bill. |

---

## 15. Statutory Compliance & Audit Requirements

1. **Section 128 Companies Act (Books of Account):**
   - The integration ensures that books of account maintained electronically in Tally remain complete, unaltered, and accessible in accordance with statutory accounting rules.
2. **GST Compliance (CGST Act 2017):**
   - Tax rates (0%, 5%, 12%, 18%, 28%) and HSN/SAC codes must match exactly across ERP quotation line items and Tally invoice line items.
3. **Immutable Audit Ledger:**
   - Every synchronization event, retry attempt, mapping approval, and reconciliation discrepancy resolution is permanently recorded in the ERP's SHA-256 cryptographic audit ledger.

---

*Master Business Requirements Document approved for review by the Accounts Department and Executive Leadership.*
