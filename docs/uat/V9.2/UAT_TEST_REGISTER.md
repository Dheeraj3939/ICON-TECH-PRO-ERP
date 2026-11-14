# ICON TECH PRO ERP V9.2 — UAT TEST REGISTER

**Document ID:** UAT-TEST-V9.2-005  
**Release Target:** ICON TECH PRO ERP V9.2  
**Date:** 2026-11-09  
**Classification:** Master Functional & Verification Test Register  
**Automated Pass Rate:** 172 / 172 Tests (100% Pass)  

---

## 1. AUTOMATED TEST SUITE SUMMARY

| Suite Ref | Test Suite File Name | Tests | Result | Execution Time | Functional Coverage |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **TS-01** | `v9-2-audit-concurrency-and-tampering.test.mjs` | 6 | **PASS** | 19.2 ms | Serialized hash chain, tampering detection, checkpoint HMAC |
| **TS-02** | `v9-2-customer-source-and-technical-evaluation.test.mjs`| 13 | **PASS** | 65.6 ms | Canonical customer sources, technical evaluation Sections A-H |
| **TS-03** | `v9-2-distributed-audit-and-gap-closure.test.mjs` | 12 | **PASS** | 684.5 ms | Cross-process audit concurrency, email idempotency, session revoke |
| **TS-04** | `v9-2-email-failover-and-mfa-policy.test.mjs` | 21 | **PASS** | 45.1 ms | Zoho-to-Gmail failover criteria, 14-day MFA grace period |
| **TS-05** | `v9-2-enterprise-security-and-audit.test.mjs` | 22 | **PASS** | 59.3 ms | 3-attempt lockout, TOTP Base32, AES-256-GCM cipher round-trips |
| **TS-06** | `v9-2-final-consolidated-master.test.mjs` | 10 | **PASS** | 144.8 ms | Additive migration DDL, 3 status dimensions, closure gates |
| **TS-07** | `v9-2-hmac-fail-closed.test.mjs` | 11 | **PASS** | 35.2 ms | Live transpiled HMAC fail-closed anti-downgrade logic |
| **TS-08** | `v9-2-in-memory-demonstration-isolation.test.mjs` | 7 | **PASS** | 15.4 ms | Sandbox demo isolation, zero production leakage |
| **TS-09** | `v9-2-independent-business-logic-verification.test.mjs` | 10 | **PASS** | 106.9 ms | Open file state machine, PO handoff, cross-month margin math |
| **TS-10** | `v9-2-master-deep-remediation.test.mjs` | 7 | **PASS** | 22.1 ms | Dynamic session cutoff, least privilege, audit trigger immutability |
| **TS-11** | `v9-2-master-enterprise-readiness.test.mjs` | 11 | **PASS** | 42.5 ms | INR words formatting, proforma invoices, Rule 55 delivery challan |
| **TS-12** | `v9-2-master-ux-phase1-to-phase5.test.mjs` | 22 | **PASS** | 74.4 ms | CPQ steppers, Spec Intelligence review gate, CSV formula guards |
| **TS-13** | `v9-2-production-hardening-regression.test.mjs` | 8 | **PASS** | 21.8 ms | GST pricing mathematics, quotation conversion routes |
| **TS-14** | `v9-2-version-consistency.test.mjs` | 12 | **PASS** | 31.3 ms | Authoritative V9.2 constant across all UI headers and portals |
| **TOTAL** | **14 Core Automated Suites** | **172** | **100% PASS** | **879.9 ms** | **Zero Failures Across All Suites** |

---

## 2. DETAILED BUSINESS WORKFLOW TEST SCENARIOS

### 2.1 Open File Management Workflows

| Test Case ID | Role | Workflow Step | Expected Business Outcome | Actual Verified Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **UAT-FILE-01** | Sales Exec | Create new project file | Formats `FILE-2026-XXXX`, assigns department to Sales, sets status `New Lead` | Generated `FILE-2026-9001` with correct defaults | **PASS** |
| **UAT-FILE-02** | Sales Exec | Upload Customer PO | Attaches PO number, date, value, payment terms (`30 Days`); sets `has_confirmed_order=true`; hands off owner to Accounts | PO attached; department owner updated to `Accounts` | **PASS** |
| **UAT-FILE-03** | Sales Exec | Close file as Lost (No order) | Presales enquiry with no PO closes immediately as `Lost Enquiry` without requiring financial reconciliation | File closed immediately; status set to `Lost` | **PASS** |
| **UAT-FILE-04** | Sales Exec | Close file as Lost (Order exists)| System rejects Lost closure when confirmed order exists; instructs use of cancellation review | Request rejected with descriptive operational error | **PASS** |
| **UAT-FILE-05** | MD / Admin | Close as Cancelled Order | Privileged role confirms order cancellation with mandatory explanation | Successfully cancelled; recorded in audit ledger | **PASS** |
| **UAT-FILE-06** | Accounts | Settle Invoices & Fulfilment | Checks `is_ready_for_closure` gatekeeper | Only marks ready when BOTH fulfilment & financials settled | **PASS** |
| **UAT-FILE-07** | Admin | Close as Successfully Completed | Both fulfilment done & financials settled -> successfully closes file as `Completed` | File closed as `Successfully Completed`; archived | **PASS** |
| **UAT-FILE-08** | Sales Exec | Request File Reopening | Submits formal reopen request with business justification; sets status `PENDING` | Request logged; file remains in pending reopen state | **PASS** |
| **UAT-FILE-09** | MD / Admin | Approve File Reopening | Re-activates file to `Follow-up` / `In Execution`; preserves original closure record in `reopen_history` | File reactivated; complete audit history preserved | **PASS** |
| **UAT-FILE-10** | Admin | Transfer File Ownership | Reassigns file from one salesperson to another with mandatory reason; logs in `ownership_history` | Transferred cleanly; prior owner recorded in history | **PASS** |

---

### 2.2 Customer 360 & Quotations CPQ Workflows

| Test Case ID | Role | Workflow Step | Expected Business Outcome | Actual Verified Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **UAT-C360-01** | Sales Exec | Search customer dossier | Aggregates all open files, quotes, orders, invoices, and timeline events in one view | All related records populated accurately | **PASS** |
| **UAT-C360-02** | Sales Exec | Inspect Customer 360 pricing | Commercial purchase costs and margins are completely redacted (`purchase_price: 0`) | Zero confidential supplier pricing leaked | **PASS** |
| **UAT-C360-03** | MD | Inspect Customer 360 pricing | Commercial purchase costs, margins, and gross profit are fully displayed | Full margin visibility (28.8% gross profit) | **PASS** |
| **UAT-CPQ-01** | Sales Exec | Create ad-hoc quote line | Allows dynamic custom products without requiring item in Product Master | Custom line item added with GST calculation | **PASS** |
| **UAT-CPQ-02** | Sales Exec | Generate Quotation PDF | Generates formal branded PDF with Indian currency words, bank details, and terms | PDF generated with zero supplier costs displayed | **PASS** |

---

### 2.3 Accounts Workspace & Tally Reconciliations

| Test Case ID | Role | Workflow Step | Expected Business Outcome | Actual Verified Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **UAT-ACC-01** | Accounts | Switch Company Profile | Allows selecting `ICON TECH PRO - 2026-27` as live writable, while past years are locked | Company switched cleanly; past years locked | **PASS** |
| **UAT-ACC-02** | Accounts | Reconcile Customer Ledger | Matches ERP customer to Tally ledger via EXACT_GSTIN and FUZZY_NAME with verification audit | Ledger verified by Hemalath; audit event created | **PASS** |
| **UAT-ACC-03** | Accounts | Cross-Month Margin Audit | Calculates order gross margin across Nov purchase (GSTR-2B) and Dec sale (GSTR-1) | Authentic margin ₹90,000 (17.65%) calculated | **PASS** |
| **UAT-ACC-04** | Accounts | Allocate Unallocated Receipt | Matches ₹55,000 from on-account receipt to invoice; prevents over-allocation | Receipt allocated; unallocated balance updated to ₹0 | **PASS** |
| **UAT-ACC-05** | Accounts | Pre-Closure Financial Clearance| Audits open file to ensure all invoices are settled and vendor bills reconciled | Cleared for files with ₹0 balance; blocked if dues | **PASS** |

---
*Certified by Independent Verification Agent on 2026-11-09.*
