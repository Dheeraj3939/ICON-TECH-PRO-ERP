# ICON TECH PRO ERP — TALLYPRIME INTEGRATION: IMPLEMENTATION READINESS REPORT

**Document Identifier:** `ITP-TALLY-READINESS-V1.0`  
**Target Release:** Post-V9.2 Enterprise Integration Track (Future Implementation)  
**Current State:** **INTEGRATION STRICTLY ON HOLD — PLANNING & DOCUMENTATION COMPLETE**  
**Executive Sponsor:** Borra Narsimulu (Managing Director)  
**Lead Approver:** Hemalath (Accounts Head)  
**Technical Lead:** Systems Architecture & Security Assurance Team  

---

## 1. Executive Readiness Statement

The TallyPrime 7.2 integration for ICON TECH PRO ERP has completed its exhaustive requirements definition, architectural design, and operational planning phase.

In strict compliance with executive directives:
- **No live code changes, database migrations, or background sync connectors have been implemented.**
- The ERP core remains on its frozen, fully verified release candidate `ICON-TECH-PRO-ERP-V9.2-RELEASE-20261105-03`.
- The current `/dashboard/tally` UI remains in **Demonstration Preview Mode**, transparently staging payloads without making live network calls to the office workstation.

This report establishes the clear boundary between what is confirmed, what is proposed, what requires Accounts approval, and what technical milestones must be completed prior to any future implementation.

---

## 2. Category 1: Confirmed Business Requirements (Ready for Future Implementation)

These requirements represent universally agreed architectural invariants that have been vetted against existing ERP business workflows:

1. **ERP Customer Master Canonical Priority (`REQ-MST-04`):**
   - The ERP Customer directory remains the authoritative source of truth for CRM relationships, salesperson assignments, enquiries, site visits, and technical evaluations.
   - Syncing customer ledgers from Tally will **never** overwrite or reset sales operational data.
2. **Deterministic SHA-256 Idempotency (`REQ-ARC-03`):**
   - Every transaction payload carries a deterministic cryptographic hash. Repeated synchronization runs will never create duplicate vouchers or double-count revenue.
3. **Role-Based Financial Privacy Masking (`REQ-C360-02`):**
   - Sales Executives (B Vineet Babu, Reshma) and Field Engineers are permitted to see payment status (`PAID` / `PARTIALLY_PAID` / `UNPAID`), outstanding balances, and overdue days for their assigned clients.
   - Private company bank account numbers, total company turnover, and internal supplier costs are strictly masked on the server.
4. **Air-Gapped Network Topology (`REQ-ARC-01`):**
   - The office computer running Tally will **never** expose listening ports to the public internet. All integration traffic will flow outbound over encrypted TLS 1.3 tunnels.
5. **Decoupled Delivery & Physical Receipt (`REQ-EWB-03`, `REQ-PRC-02`):**
   - Generating an E-Way Bill or recording a supplier payment in Tally does **not** automatically mark goods as delivered to a client or received from a distributor. Physical material movement requires an acknowledged signed Delivery Challan or GRN scan.
6. **Statutory Voucher Exclusions (`REQ-VCH-02`):**
   - Payroll vouchers, manufacturing BOMs, and retail POS entries are explicitly excluded from the Tally sync scope.

---

## 3. Category 2: Proposed Requirements (Awaiting Stakeholder Review)

These requirements have been designed and documented in detail but require formal review and concurrence from Hemalath and the sales team:

1. **Dedicated Customer Purchase Order Facility (`REQ-CPO-01` to `REQ-CPO-06`):**
   - A dedicated Accounts interface for uploading scanned Customer POs, tracking payment terms clocks (e.g. 30 days from GRN vs 30 days from Invoice), and automatically reconciling cumulative billed invoices against total PO value.
2. **Automated Multi-Invoice Settlement Splitting (`REQ-RCP-04`):**
   - An intelligent parsing algorithm to allocate a single large client bank transfer across multiple unpaid invoices in accordance with Tally's `Agst Ref` bill allocations.
3. **E-Way Bill Expiration Alerting (`REQ-EWB-02`):**
   - Automatic dispatch dashboard alerts triggered 8 hours prior to transit validity expiry to prevent GST penalties during material transport.
4. **Automated Two-Way Midnight Reconciliation Engine (`REQ-REC-01`):**
   - A scheduled job executing at 00:00 IST comparing Tally closing debtor balances with ERP invoice balances, generating an exception snapshot for variances $> ₹1.00$.

---

## 4. Category 3: Accounts Department Approval Pending (Decisions for Hemalath)

Implementation cannot begin until Hemalath formally reviews and completes the **Accounts Review Checklist** (`docs/tally_integration/TALLY_PRIME_INTEGRATION_ACCOUNTS_REVIEW_CHECKLIST.md`):

| Decision Item | Core Issue Requiring Accounts Input | Operational Impact |
| :--- | :--- | :--- |
| **Authoritative FY 25-26 Company** | Office PC contains both `ICON TECH PRO - 2025-26` and `ICON TECH PRO - 2025-26 (from 1-Apr-25)`. | Prevents importing duplicate historical transactions and incorrect opening balances. |
| **Historical Import Scope** | Which past years (`2019-2024`, `2024-25 Old Data`) must be brought into ERP? | Determines database storage sizing and historical data mapping workload. |
| **Invoicing Directionality** | Confirm that sales invoices are created in Tally and imported to ERP (or vice versa). | Locks data flow architecture (One-way read vs two-way push). |
| **PO Terms vs Tally Credit Days** | When customer PO terms conflict with Tally ledger terms, which governs overdue aging? | Dictates logic for sales collection follow-up alarms. |
| **Bill-Wise Allocation Discipline** | Are client receipts consistently tagged with `Agst Ref` in Tally? | If not, requires an established Accounts policy for handling "On-Account" receipts. |
| **Credit Note Offset Rules** | Should Credit Notes automatically reduce customer invoice outstanding balances in ERP? | Affects accounts receivable ledger balances and customer statements. |

---

## 5. Category 4: Technical Feasibility Verification Pending (Workstation POC)

The following technical checks must be physically executed on the office computer before development begins:

1. **Verification of HTTP XML Server Port (`U1`):**
   - Inspect `F12 > Advanced Configuration > Client/Server configuration` in TallyPrime 7.2.
   - Confirm whether Tally's HTTP XML Server is enabled and identify its exact listening port.
   - *Technical Note:* Port `9000` is currently labeled as ODBC. ODBC is a read-only relational SQL interface and cannot be used for REST/XML voucher posting. The actual HTTP XML port must be verified.
2. **Installed TDL Add-on and Plug-in Audit (`U3`):**
   - Inspect the 1 active TDL add-on and 1 plug-in visible in the configuration screenshots.
   - Ensure these customizations do not alter standard Tally XML schema elements (`ALLLEDGERENTRIES.LIST`, `BILLALLOCATIONS.LIST`).
3. **Office Network Egress & Stability Test:**
   - Verify that the Windows workstation has stable outbound internet connectivity to communicate with the cloud ERP gateway over TLS 1.3 without proxy interference.

---

## 6. Category 5: Tally Vendor / Licence Confirmation Pending

1. **Silver Edition Single-User Concurrency Verification (`U2`):**
   - TallyPrime Silver is licensed for **one concurrent user**.
   - **Mandatory Test:** Execute a scripted background XML collection export while Hemalath is actively typing and saving a test voucher in Tally.
   - **Verification Goal:** Confirm that Tally does not throw concurrency error dialogs (`Another process is accessing data`) or introduce noticeable typing lag.
2. **Tally Solutions TSS Expiry & Support:**
   - Verified TSS subscription expires on **31 July 2027**. Software is eligible for official Tally technical updates and schema definitions.

---

## 7. Category 6: Future ERP Changes Required (Post-Approval Roadmap)

When executive approval to proceed is formally granted, implementation will follow these phased engineering steps:

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASING ROADMAP (FUTURE IMPLEMENTATION ONLY)                           │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Additive Database Migrations (PostgreSQL Tables & RLS)        │
│   • Land `tally_companies`, `tally_ledger_mappings`, `tally_vouchers`  │
│   • Land `customer_purchase_orders` and `tally_bill_allocations`       │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Lightweight Windows Office Agent Development                  │
│   • Standalone C# .NET / Node.js Windows service running on office PC   │
│   • Micro-batch polling using `ALTERID > LastSyncAlterId`              │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Cloud Ingestion Gateway & Parser Pipeline                     │
│   • Implement `/api/integrations/tally/sync` with HMAC authentication  │
│   • Ingestion state machine and bill-wise allocation processor         │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: Dedicated Accounts Workspace & Review Queues                  │
│   • Transform `/dashboard/tally` into Hemalath's live control center    │
│   • Unmatched master matching tool, PO upload modal, DLQ inspector     │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: Automated Invariant Test Suites & Staging Trial               │
│   • 100% automated test coverage on concurrency, retries, and balances │
│   • Trial import on a copy of `ICON TECH PRO - 2026-27` company data   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Category 7: Production Cutover Gate Pre-Requisites

Under no circumstances will the integration be connected to the live production Tally company without satisfying all of the following conditions:

- [ ] **External Backup Gate:** Full, verified offline backup of the entire `Data` directory of TallyPrime stored on a dedicated external drive.
- [ ] **Accounts Department Sign-Off:** Signed completion of the 20-question review checklist by Hemalath.
- [ ] **Managing Director Authorization:** Formal written cutover approval from Borra Narsimulu.
- [ ] **Zero-Variance Staging Trial:** A simulated import of the FY 2026-27 company in an isolated staging environment producing **₹0.00 variance** against Tally's Trial Balance.
- [ ] **Preservation of Core Stability:** Clean execution of all 103 existing ERP invariant tests.

---

*Implementation Readiness Report compiled and submitted for executive governance.*
