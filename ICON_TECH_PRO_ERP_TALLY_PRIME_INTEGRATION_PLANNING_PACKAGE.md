# ICON TECH PRO ERP — TALLYPRIME INTEGRATION: FINAL MASTER REQUIREMENTS, BUSINESS WORKFLOW & IMPLEMENTATION-READY PLANNING PACKAGE

**Package Identifier:** `ITP-TALLY-MASTER-PACKAGE-20261106`  
**Classification:** Strategic Planning, Business Process Engineering & Technical Architecture  
**Target Accounting Platform:** TallyPrime 7.2 (Silver Edition Single-User &bull; Gateway: 9999, ODBC: 9000, Scheduler: 10089, TSS: 31-Jul-2027)  
**Target ERP Platform:** ICON TECH PRO ERP (`https://erp.icontechpro.in` &bull; Next.js 15 + Supabase PostgreSQL)  
**Primary Business Stakeholders:**  
- **Borra Narsimulu** (Managing Director & Executive Sponsor)  
- **Hemalath** (Accounts Head & Lead Operational User)  
- **B V Dheeraj Reddy** (Admin / BDM & Operations Coordinator)  
- **B Vineet Babu** (Senior Sales Executive)  
**Current Operational Status:** **PLANNING & REQUIREMENTS BASELINE COMPLETE — ACTUAL INTEGRATION STRICTLY ON HOLD PENDING ACCOUNTS APPROVAL**  

---

## 1. Executive Summary & Context

This consolidated master planning package completes the end-to-end integration planning exercise between **ICON TECH PRO ERP** and **TallyPrime 7.2**.

In accordance with executive directives:
1. **Zero Premature Development:** No integration code, database tables, Supabase migrations, API endpoints, or background agents have been deployed.
2. **Preservation of Release Baseline:** The core ERP remains frozen on verified candidate `ICON-TECH-PRO-ERP-V9.2-RELEASE-20261105-03` with all 103 enterprise invariant tests passing.
3. **Comprehensive Documentation Suite:** All discussions regarding masters, vouchers, receipts, customer POs, E-Way Bills, historical companies, customer 360, notifications, and security have been formalized into five actionable documents.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        TALLYPRIME INTEGRATION DOCUMENTATION SUITE                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  1. Master Business Requirements Document (BRD)                                        │
│     file:///C:/ICON-TECH-PRO-ERP/docs/tally_integration/TALLY_PRIME_INTEGRATION_MASTER_BUSINESS_REQUIREMENTS.md   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  2. Detailed Technical Architecture Document                                           │
│     file:///C:/ICON-TECH-PRO-ERP/docs/tally_integration/TALLY_PRIME_INTEGRATION_TECHNICAL_ARCHITECTURE.md         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  3. Accounts Review Checklist & Questionnaire (20 Critical Decisions)                  │
│     file:///C:/ICON-TECH-PRO-ERP/docs/tally_integration/TALLY_PRIME_INTEGRATION_ACCOUNTS_REVIEW_CHECKLIST.md      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  4. Final Requirements Traceability Matrix (RTM - 38 Granular Requirements)            │
│     file:///C:/ICON-TECH-PRO-ERP/docs/tally_integration/TALLY_PRIME_INTEGRATION_TRACEABILITY_MATRIX.md         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  5. Implementation Readiness Report                                                    │
│     file:///C:/ICON-TECH-PRO-ERP/docs/tally_integration/TALLY_PRIME_INTEGRATION_IMPLEMENTATION_READINESS_REPORT.md   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Existing TallyPrime Operating Environment & Crucial Technical Caveats

### 2.1 Verified Office Workstation Configuration
- **Software Edition:** **TallyPrime 7.2** (Latest release with advanced reporting and XML/JSON schema support).
- **Licence Level:** **Silver Edition (Single-User)**.
- **Active Accounting Company:** `ICON TECH PRO - 2026-27` (Covering 1 April 2026 to 31 March 2027).
- **Gateway Server Port:** **9999** (Internal Tally communication gateway).
- **ODBC Port:** **9000** (SQL read-only interface).
- **Scheduler Port:** **10089** (Automated statutory task port).
- **TSS Subscription Expiry:** **31 July 2027** (Active software services).
- **Installed Add-ons:** 1 active TDL add-on and 1 plug-in identified.
- **Historical Company Datasets Identified:**
  - `ICON TECH PRO - 2025-26`
  - `ICON TECH PRO - 2025-26 (from 1-Apr-25)`
  - `ICON TECH PRO - 2024-25 Old Data`
  - `ICON TECH PRO - 2019-2024`
  - Older migration-required archives.

### 2.2 Critical Technical Clarification on Port 9000
- **Operational Reality:** Port `9000` is labeled as the **ODBC Port**. ODBC is a read-only relational SQL driver intended for Excel/Access exports. **ODBC cannot be used for bidirectional JSON or XML voucher synchronization.**
- **Integration Invariant:** The actual integration endpoint is the **Tally HTTP Server** (configured under `F12 > Advanced Configuration > Client/Server configuration`). While Tally often defaults to sharing port 9000 for both ODBC and HTTP, physical verification on the office computer is required before development.

### 2.3 Silver Edition Single-User Concurrency Protection
Because Tally is licensed for a single user, an automated script that locks Tally data would freeze Hemalath's screen or trigger concurrency errors.
- **The Safeguard:** The proposed **Office Integration Agent** uses non-intrusive micro-batch delta polling (`ALTERID > LastSyncAlterId`) executing in $< 150$ milliseconds during user idle times, with full synchronization scheduled during off-hours or triggered manually via a "Sync Now" button.

---

## 3. Core Business Workflows & Functional Architecture

### 3.1 Customer & Supplier Master Synchronization
- **Canonical Priority:** The ERP Customer Master remains the authoritative source of truth for CRM relationships, sales assignments, enquiry history, contact details, site visits, and technical evaluations.
- **Matching Precedence:** Exact 15-character **GSTIN** match $\rightarrow$ 10-character **PAN** match $\rightarrow$ Normalized Legal Name.
- **Zero Automatic Duplication:** Ambiguous or uncertain matches are staged in an **Accounts Review Queue** for Hemalath's manual confirmation.
- **No Overwriting:** Tally sync will **never** reset an assigned salesperson or overwrite sales notes. Missing Tally fields remain blank (never invented).
- **Supplier Masters:** Synced from "Sundry Creditors" to the ERP procurement supplier directory.

### 3.2 End-to-End Salesperson Journey (The SWAN Example)
A practical demonstration of how master sync empowers field sales:
1. Client `SWAN Technologies Pvt Ltd` exists in Tally as a Sundry Debtor.
2. Master sync imports SWAN into the ERP customer directory with verified GSTIN and payment clearance status.
3. Sales Executive (B Vineet Babu) searches for "SWAN" in the ERP; selects the existing customer.
4. Creates a new enquiry for an "Executive Boardroom 4K Display Upgrade", selecting source "Existing Client".
5. Schedules site visit $\rightarrow$ Completes Technical Evaluation $\rightarrow$ Generates approved Quotation `QT-26-0142`.
6. Client issues Customer PO `SWAN/PO/2026/891`. Accounts uploads scanned PO to ERP.
7. Accounts raises Tax Invoice `INV-26-0084` in Tally; ERP mirrors invoice and displays ₹4,50,000 outstanding balance.
8. Client transfers payment; Hemalath enters Receipt in Tally allocated `Agst Ref INV-26-0084`.
9. ERP syncs receipt: Invoice marked `PAID`, customer balance updates to ₹0.00, and salesperson receives instant in-app notification.
*Outcome: Zero double-entry, zero duplicate records, and complete financial clarity without exposing private bank books.*

### 3.3 Sales Invoices & Real-World Receipt Allocations
- **Invoices Import:** Captures voucher number, date, customer ledger, PO number, line items, quantities, rates, discounts, HSN codes, and exact CGST/SGST/IGST tax splits.
- **Bill-Wise Allocation Realities:** Supports:
  1. *Full Payments:* Exact 1:1 invoice settlement.
  2. *Partial Payments:* Client pays ₹50,000 against ₹1,20,000 invoice (₹70,000 balance cleanly maintained).
  3. *Multi-Invoice Settlement:* Single ₹5,00,000 transfer settling multiple bills via Tally's `Agst Ref`.
  4. *Advance Receipts:* Credited to customer account and adjusted upon subsequent invoicing.
  5. *On-Account Receipts:* Unallocated funds held on customer ledger without guessing invoice links.
  6. *Reversals & Bounces:* Cheque bounce or receipt cancellation immediately restores invoice outstanding balance and logs a traceable audit entry.

### 3.4 Dedicated Customer Purchase Order (PO) Facility
A dedicated facility for Hemalath (Accounts) to manage client POs:
- **PDF & Scan Upload:** Secure storage of customer contract documents.
- **Metadata Management:** Customer, PO Number, Date, Total Value, Payment Terms (15, 30, 45, 60, 90 days or custom), Validity Deadline, and Special Conditions.
- **Due Date Starting Event:** Accounts specifies whether the payment clock begins from **Invoice Date**, **Delivery / LR Date**, **Material Acceptance / GRN Date**, or **Installation Sign-off**.
- **Invoice-to-PO Reconciliation:** Automatically matches the PO number in Tally sales invoices with uploaded ERP POs, tracking cumulative billed amounts vs total PO value.
- **Terms Conflict Flag:** Yellow warning badge displayed if Tally's default ledger credit period conflicts with the customer's agreed PO payment terms.

### 3.5 Dispatch, Delivery Challans & E-Way Bill Integration
- **Delivery Challan Correlation:** Delivery Challans generated in accordance with Rule 55 CGST Rules 2017 (`ITP/DC/2026-27/XXXX`) link to Tax Invoices and Customer POs.
- **E-Way Bill Tracking:** Captures 12-digit E-Way Bill Number, Generation Date, Transit Validity, Distance (KM), Transporter ID/Name, and Vehicle Number.
- **Expiry Alerts:** Automated dispatch dashboard alert triggered 8 hours prior to validity expiration if transit is uncompleted.
- **Manual Capture Fallback:** Support for entering portal-generated E-Way Bills if not created inside Tally.
- **Decoupled Delivery Invariant:** E-Way Bill generation **never** marks an order as delivered. Physical delivery requires an acknowledged signed delivery challan scan.

### 3.6 Customer 360 &ndash; Unified Commercial & Financial Dossier
Combines ERP operational history with Tally financial balances on a single screen:
- **Operational Column:** Contacts, salesperson assignment, enquiries, site visits, technical evaluations, quotations, sales orders, delivery challans, and service tickets.
- **Accounting Column:** Current outstanding balance, overdue aging (>30, >60, >90 days), active credit limit, bill-wise receipt history, credit notes, advance receipts, uploaded customer POs, and invoice-to-PO matching.
- **Security Boundary:** Sales Executives see payment status and overdue flags needed for collections, but private company bank statements and supplier purchase costs are masked.

### 3.7 Supplier & Procurement Integration
- **Distributor Bills:** Inbound sync of purchase bills and debit notes linked to ERP Purchase Orders (`procurement.ts`).
- **3-Way Matching:** Compares ERP Purchase Order &rarr; Delivery GRN &rarr; Tally Purchase Bill to identify price or quantity discrepancies.
- **Decoupled Fulfillment:** Paying a distributor in Tally does **not** mark hardware as physically received at the Hyderabad site until an official GRN is filed.

### 3.8 Central Notification & Alerting Engine
14 critical event triggers routed strictly by employee assignment and role:
- Customer PO uploaded $\rightarrow$ Sales Executive, BDM.
- Payment received / Partial payment $\rightarrow$ Sales Executive, Accounts.
- Invoice due soon (7d) / Invoice overdue (+1d) $\rightarrow$ Sales Executive, Accounts, BDM.
- E-Way Bill expiring (8h) $\rightarrow$ Dispatch Team, Office Assistant.
- Invoice-to-PO mismatch / Unmapped ledger $\rightarrow$ Accounts (Hemalath).
- Sync agent failure / Reconciliation variance $\rightarrow$ Accounts, Managing Director.
*Launch Strategy: In-app ERP notification bells and review queues first; external WhatsApp/Email alerts deferred pending formal authorization.*

### 3.9 Dedicated Accounts Workspace for Hemalath
18 proposed controls inside `/dashboard/tally`:
1. Active Tally company and FY selector.
2. Inbound sync status and health indicators.
3. Customer and supplier master matching console.
4. Ledger mapping review queue.
5. Inbound voucher register.
6. Sales invoice register.
7. Receipt and payment register.
8. Bill-wise payment allocation inspector.
9. Outstanding receivables aging ledger.
10. Outstanding payables schedule.
11. Customer PO upload and matching interface.
12. E-Way Bill dispatch tracker.
13. Complete synchronization history log.
14. Failed synchronization review queue.
15. Manual "Sync Now" button.
16. Automated daily reconciliation reports.
17. Discrepancy resolution console.
18. Permanent immutable audit trail.

---

## 4. Employee Permissions & Security Hierarchy

Financial data access is strictly enforced on the server via `requireRole(...)`:

```
┌────────────────────────────────────────────────────────────────────────┐
│ ORGANIZATIONAL FINANCIAL ACCESS MATRIX                                 │
├───────────────────┬────────────────────────────────────────────────────┤
│ Managing Director │ Full company P&L, aging debtors/creditors, audit   │
│ (Borra Narsimulu) │ logs, executive summaries. No direct sync controls.│
├───────────────────┼────────────────────────────────────────────────────┤
│ Accounts Head     │ SOLE AUTHORIZED OPERATOR: Full Tally workspace,    │
│ (Hemalath)        │ sync controls, mapping, PO uploads, reconciliation.│
├───────────────────┼────────────────────────────────────────────────────┤
│ Admin / BDM       │ Senior sales oversight, high-value quote approvals,│
│ (Dheeraj Reddy)   │ user administration. No raw Tally sync controls.   │
├───────────────────┼────────────────────────────────────────────────────┤
│ Corporate BDM     │ Assigned team sales progress, collection tracking. │
│ (BDM Lead)        │ No unrestricted company-wide ledger view.          │
├───────────────────┼────────────────────────────────────────────────────┤
│ Sales Executive   │ Assigned client payment status, overdue flags.     │
│ (Vineet, Reshma)  │ ZERO access to company bank books or supplier costs│
├───────────────────┼────────────────────────────────────────────────────┤
│ Office Assistant  │ Material dispatch tracking, delivery challans.     │
│ (Manisha)         │ No financial ledger or voucher access.             │
├───────────────────┼────────────────────────────────────────────────────┤
│ Service Engineer  │ Simple "Account Clear for Installation" indicator. │
│ (Field Engineers) │ No numerical financial figures visible.            │
└───────────────────┴────────────────────────────────────────────────────┘
```

---

## 5. Historical Multi-Company & Financial Year Governance

1. **Dataset Integrity:** The office PC contains multiple historical folders (`2025-26`, `2025-26 (from 1-Apr-25)`, `2024-25 Old Data`, `2019-2024`, and older archives marked "Migration Required").
2. **Non-Merging Rule:** Historical datasets must **never** be merged automatically. Each dataset will be imported into a partitioned historical context.
3. **Audited Company Determination:** Accounts must officially designate which of the two FY 2025-26 folders is the audited return book.
4. **Read-Only Archival:** All historical records prior to 1 April 2026 are marked **STRICTLY READ-ONLY** in the ERP.
5. **Opening Balance Verification:** Closing debtor/creditor balances of FY 2025-26 must match the opening balances of FY 2026-27 to the exact rupee before importing transactions.

---

## 6. Proposed Technical Architecture & Safeguards

1. **Air-Gapped Invariant:** Tally ports (9000, 9999, 10089) will **never** be exposed to the public internet.
2. **Outbound TLS 1.3 Topology:** A lightweight Windows office agent initiates all requests outbound to the Cloud ERP Ingestion Gateway (`/api/integrations/tally/sync`).
3. **Deterministic Idempotency:** Payloads carry SHA-256 hashes; identical re-syncs will never generate duplicate vouchers.
4. **Voucher Identity Invariant:** Entities are tracked by immutable system attributes (`VOUCHER_GUID`, `ALTERID`) rather than editable voucher numbers.
5. **Raw Source Archive:** Inbound XML/JSON envelopes are preserved in `tally_vouchers_raw` for non-repudiation and auditor inspection.
6. **Two-Way Automated Reconciliation:** Nightly automated audit at 00:00 IST comparing Tally closing debtor balances with ERP invoice balances, flagging any variance $> ₹1.00$.

---

## 7. Data Ownership & Governance Matrix

| Domain / Entity | Authoritative System of Record | ERP Operational Role | Conflict Resolution Rule |
| :--- | :--- | :--- | :--- |
| **Chart of Accounts & Ledgers** | **TallyPrime** | Synced Master | Tally ledger names and groupings are immutable in ERP. |
| **Sales Leads & Enquiries** | **ICON TECH PRO ERP** | Native Master | Never synced to Tally. Managed exclusively in ERP. |
| **Quotations & Revisions** | **ICON TECH PRO ERP** | Native CPQ Engine | Synced to Tally only upon conversion to Tax Invoice. |
| **Customer Purchase Orders** | **ICON TECH PRO ERP** | Native Document Repository| Accounts uploads PO to ERP; links to Tally invoice. |
| **Official Tax Invoices** | **TallyPrime** | Read-Only Import & Mirror | Invoice numbers, dates, and amounts are owned by Tally. |
| **Payment Receipts & Banking** | **TallyPrime** | Read-Only Import & Mirror | Bank transactions and bill allocations owned by Tally. |
| **Delivery Challans (Rule 55)**| **ICON TECH PRO ERP** | Native Logistics Module | Created in ERP; E-Way Bill numbers linked from portal/Tally. |
| **Procurement & Goods Receipt**| **ICON TECH PRO ERP** | Native Logistics Module | ERP tracks physical goods receipt; Tally tracks financial bill. |

---

## 8. Accounts Department Review Questionnaire (Summary of 20 Critical Questions)

The complete questionnaire is formalized in `docs/tally_integration/TALLY_PRIME_INTEGRATION_ACCOUNTS_REVIEW_CHECKLIST.md`. Key decision points for Hemalath:
1. *Active Company:* Confirm `ICON TECH PRO - 2026-27` is the sole live active company.
2. *Historical Scope:* Designate which past financial years must be imported into ERP.
3. *FY 25-26 Duplicate:* Identify whether `ICON TECH PRO - 2025-26` or `(from 1-Apr-25)` is the audited book.
4. *Master Data Quality:* Approximate percentage of customer ledgers with complete GSTINs in Tally.
5. *Invoicing Flow:* Confirm whether invoices are always generated in Tally first.
6. *PO Number Field:* Confirm that customer PO numbers are consistently entered in "Buyer's Order No.".
7. *Payment Terms Hierarchy:* Establish whether customer PO terms override default Tally credit days.
8. *Bill-Wise Allocation Discipline:* Confirm consistency of `Agst Ref` allocations on customer receipts.
9. *Advance Receipts:* Define accounting treatment for unallocated client advance payments.
10. *Voucher Types in Use:* Confirm exact active voucher types in the 2026-27 company.
11. *Credit & Debit Notes:* Clarify frequency and automatic invoice offset rules.
12. *Supplier Procurement Bills:* Confirm capture of distributor PO references and serial tracking.
13. *E-Way Bill Generation Source:* Identify whether E-Way Bills are generated in Tally or on the government portal.
14. *Active TDL Add-ons:* Confirm business function of the 1 installed TDL add-on and 1 plug-in.
15. *Existing Tally Pain Points:* Specific accounting frustrations Accounts wants resolved.
16. *Critical Manual Processes:* Identify manual spreadsheets or routines that must remain unchanged.
17. *Sales Visibility Boundary:* Confirm financial fields visible to sales executives.
18. *Restricted Financial Data:* Confirm data restricted strictly to Hemalath and Managing Director.
19. *Automated Reports Required:* Select daily, weekly, and monthly reports needed by Accounts.
20. *Pre-Cutover Testing Gate:* Establish mandatory prerequisites before connecting live integration.

---

## 9. Implementation Phasing Roadmap (Future Execution Only)

```
┌────────────────────────────────────────────────────────────────────────┐
│ POST-V9.2 IMPLEMENTATION PHASING (FUTURE EXECUTION ONLY)               │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 0: Accounts Department & Executive Formal Approval                │
│   • Hemalath completes 20-question checklist with written sign-off     │
│   • Managing Director approves implementation roadmap                  │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 1: On-Site Technical Proof of Concept (POC)                       │
│   • Verify HTTP XML port configuration in TallyPrime 7.2               │
│   • Run single-user concurrency load test during active voucher entry  │
│   • Audit TDL add-on compatibility with standard XML schemas           │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 2: Additive Database Schema Deployment (PostgreSQL Migrations)    │
│   • Deploy `tally_companies`, `tally_ledger_mappings`, `tally_vouchers`│
│   • Deploy `customer_purchase_orders` and `tally_bill_allocations`     │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 3: Windows Office Agent & Cloud Ingestion Gateway Development     │
│   • Build lightweight C# / Node.js Windows service                     │
│   • Implement `/api/integrations/tally/sync` with HMAC signatures      │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 4: Accounts Workspace & Review Queues Activation                  │
│   • Wire `/dashboard/tally` to live database tables and review queues  │
│   • Activate Customer PO upload modal and reconciliation dashboards    │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 5: Staging Trial & Production Cutover                             │
│   • Full offline backup of Tally data directory                        │
│   • Trial import on copy of FY 2026-27 achieving ₹0.00 variance        │
│   • Production go-live authorization                                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Mandatory Compliance & Protection Invariants

In strict adherence to the project instructions:
1. **NO CODE OR CONFIGURATION CHANGES:** No integration endpoints, database tables, migrations, secrets, or services have been created, modified, or started.
2. **NO TALLY CONNECTION:** TallyPrime on the office computer has not been connected to, queried, or modified.
3. **PRESERVED REPOSITORY:** All 100 tracked modified files, 2 deletions, and untracked files remain intact.
4. **RELEASE REMAINS FROZEN:** The production release candidate `ICON-TECH-PRO-ERP-V9.2-RELEASE-20261105-03` is undisturbed and ready for production cutover gate review.

**CONCLUSION:** The TallyPrime integration planning exercise is complete, fully documented, and ready for review by Hemalath and the Managing Director. Actual integration development will commence only after formal written approval.
