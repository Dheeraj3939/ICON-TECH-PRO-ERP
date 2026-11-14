# ICON TECH PRO ERP — TALLYPRIME INTEGRATION: ACCOUNTS DEPARTMENT REVIEW CHECKLIST & QUESTIONNAIRE

**Review Assignee:** Hemalath (Accounts Head, ICON TECH PRO)  
**Co-Reviewer:** Borra Narsimulu (Managing Director)  
**Technical Facilitator:** Release Engineering & Systems Architecture Team  
**Status:** **PENDING ACCOUNTS COMPLETION & FORMAL SIGN-OFF**  
**Instructions:** Please review each of the 20 questions below. Record your current operational practices, specific business requirements, and operational decisions in the allocated space. **Do not leave sections blank; where a decision is pending, mark as "PENDING DECISION".**

---

## SECTION I: TALLY COMPANIES & HISTORICAL FINANCIAL YEARS

### Question 1: Active Accounting Company
*Which Tally company or companies are currently used for daily, live accounting transactions?*
- **Known Baseline:** `ICON TECH PRO - 2026-27` (FY: 1 April 2026 to 31 March 2027).
- **Accounts Confirmation Required:** Is this the sole active company, or are there separate sister concerns, branch books, or proprietorships currently maintained in Tally?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Confirm exact company name and GUID`

---

### Question 2: Historical Datasets to Import
*Which historical companies must be imported into the ERP for customer ledger history, past sales analysis, and warranty verification?*
- **Known Datasets on Office PC:**
  - `ICON TECH PRO - 2025-26`
  - `ICON TECH PRO - 2025-26 (from 1-Apr-25)`
  - `ICON TECH PRO - 2024-25 Old Data`
  - `ICON TECH PRO - 2019-2024`
- **Accounts Confirmation Required:** Which of these specific datasets should be imported as read-only historical archives in the ERP?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Select specific historical company folders for archival import`

---

### Question 3: Duplicate & Overlapping Financial Years
*Notice that both `ICON TECH PRO - 2025-26` and `ICON TECH PRO - 2025-26 (from 1-Apr-25)` exist on the computer. Which one is the audited, authoritative book of accounts?*
- **Operational Risk:** If both folders are imported, historical sales figures and customer balances will be duplicated.
- **Accounts Confirmation Required:** Which folder contains the final audited entries submitted for Income Tax and GST Annual Returns (GSTR-9)?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Designate authoritative FY 25-26 folder; archive duplicate folder`

---

## SECTION II: MASTER DATA & LEDGER MAPPING

### Question 4: Master Data Completeness in Tally
*Are all customer and supplier records maintained directly in Tally with complete GSTINs, state codes, and billing addresses?*
- **Context:** If Tally customer ledgers are missing GSTINs or addresses, syncing them to the ERP could result in incomplete customer profiles.
- **Accounts Confirmation Required:** What is the approximate percentage of customer ledgers that currently have verified GSTINs and complete addresses in Tally?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Audit sundry debtor ledgers for missing GSTINs prior to sync`

---

### Question 14: Existing TDL Customizations & Accounting Habits
*Are there any existing TDL customizations, add-ons, or custom invoice formats currently installed in Tally that must be preserved?*
- **Known Baseline:** Configuration screen indicates 1 TDL add-on and 1 plug-in active.
- **Accounts Confirmation Required:** What do these customizations do (e.g. custom tax invoice print format, specific HSN summary, custom barcode/serial field)?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Technical review of active TDL scripts to ensure XML compatibility`

---

## SECTION III: SALES INVOICING & BILLING

### Question 5: Invoice Creation Hierarchy
*Are customer sales invoices ALWAYS created in Tally first, or does Accounts want to generate and approve invoices in the ERP and push them to Tally?*
- **Proposed Baseline:** Tally is the sole creator of official tax invoices; ERP imports them as read-only accounting records.
- **Accounts Confirmation Required:** Does Accounts agree that Tally remains the primary invoice generator, or is there a requirement for ERP-to-Tally outbound invoicing?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Confirm one-way (Tally → ERP) or two-way invoicing direction`

---

### Question 6: Customer PO Reference Capture
*In Tally sales invoices, is the Customer PO Number consistently entered into the standard "Buyer's Order No." field?*
- **Context:** To automatically link Tally invoices with customer PO scans in the ERP, the PO number in Tally must match the customer's purchase order document.
- **Accounts Confirmation Required:** Is this field populated on 100% of corporate sales invoices, or are PO numbers sometimes entered in the Narration?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Standardize PO number entry in Buyer's Order No. field in Tally`

---

### Question 7: Payment Terms & Due Dates
*Are payment credit periods (e.g. 30 days, 45 days) maintained on the Tally ledger master, or are payment terms governed solely by the customer's PO?*
- **Operational Reality:** A customer might have a standard 30-day term in Tally, but a specific enterprise tender PO allows 60 days from installation.
- **Accounts Confirmation Required:** When a conflict occurs between Tally's credit period and the uploaded Customer PO terms, which one should govern the overdue aging report in the ERP?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Define terms hierarchy: PO Terms Override vs Tally Ledger Defaults`

---

## SECTION IV: CUSTOMER RECEIPTS & BILL-WISE ALLOCATIONS

### Question 8: Bill-Wise Allocation Consistency
*When customer payments are entered as Receipts in Tally, are they consistently allocated against specific invoices using "Against Reference" (`Agst Ref`)?*
- **Context:** If receipts are entered as "On Account" rather than allocated against specific invoice numbers, the ERP cannot automatically mark individual invoices as PAID.
- **Accounts Confirmation Required:** Are bill-wise allocations maintained for all corporate receipts?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Review bill-wise allocation compliance across Sundry Debtors`

---

### Question 9: Handling of Advance Receipts
*How are customer advance payments recorded in Tally, and how are they later adjusted when the tax invoice is issued?*
- **Context:** Advance receipts in GST require advance tax vouchers or receipt vouchers with "Advance" allocation type.
- **Accounts Confirmation Required:** Does Accounts record advances using Tally's "Advance" bill-wise type, and how should advances appear on the Salesperson's Customer 360 screen?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Define Advance Receipt display rules in Customer 360`

---

## SECTION V: ACCOUNTING VOUCHERS & ADJUSTMENTS

### Question 10: Active Voucher Types in Daily Use
*Which specific voucher types are currently used in the active company `ICON TECH PRO - 2026-27`?*
- **Checklist for Accounts:**
  - [ ] Sales Invoices
  - [ ] Customer Receipts
  - [ ] Purchase Bills
  - [ ] Supplier Payments
  - [ ] Credit Notes
  - [ ] Debit Notes
  - [ ] Journal Vouchers
  - [ ] Contra Vouchers
  - [ ] Physical Stock Vouchers
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Check active voucher types to configure integration filters`

---

### Question 11: Credit Notes & Debit Notes Usage
*How frequently are Credit Notes and Debit Notes issued, and what are the primary reasons (e.g. price difference, hardware return, post-sale volume discount)?*
- **Accounts Confirmation Required:** Should Credit Notes automatically adjust the outstanding invoice balance in the ERP?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Establish Credit Note automatic invoice offset logic`

---

## SECTION VI: SUPPLIERS & PROCUREMENT

### Question 12: Supplier Procurement Bills & Payments
*How are distributor purchase bills (e.g. from Optoma, Samsung, Crestron distributors) entered in Tally, and are distributor PO numbers captured?*
- **Context:** Linking Tally purchase bills to ERP Procurement Orders requires matching vendor invoice numbers and distributor references.
- **Accounts Confirmation Required:** Does Accounts record line-item hardware serial numbers in Tally, or only total taxable value and tax heads?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Define procurement 3-way matching rules (PO vs GRN vs Bill)`

---

## SECTION VII: E-WAY BILLS & LOGISTICS

### Question 13: E-Way Bill Generation Source
*Where are E-Way Bills currently generated for material dispatches?*
- **Options:**
  - Option A: Generated directly within TallyPrime via GSP integration.
  - Option B: Generated manually on the government E-Way Bill Portal (`ewaybillgst.gov.in`).
  - Option C: Generated by third-party logistics transporters.
- **Accounts Confirmation Required:** Which method is used, and how should E-Way Bill numbers be synced to ERP Delivery Challans?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Clarify E-Way Bill generation workflow for dispatch linking`

---

## SECTION VIII: EXISTING TALLY ISSUES & DESIRED FIXES

### Question 15: Existing Tally Pain Points
*What are the specific operational difficulties, errors, or frustrations that the Accounts Department currently experiences in Tally that must be solved?*
- **Examples:** Slow ledger balance lookup, duplicate customer ledgers, difficulty tracking overdue collections from sales staff, reconciling bank entries.
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Document accounts pain points to ensure integration directly resolves them`

---

### Question 16: Non-Negotiable Manual Processes & Reports
*Are there specific manual reports, Excel spreadsheets, or filing procedures that Accounts currently uses that must NOT be changed or replaced by the ERP?*
- **Accounts Confirmation Required:** What existing daily or monthly routines must remain exactly as they are?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Protect critical established manual accounting procedures`

---

## SECTION IX: EMPLOYEE ACCESS, PERMISSIONS & PRIVACY

### Question 17: Information Visible to Sales Executives
*Exactly what financial information should Sales Executives (B Vineet Babu, Reshma) be permitted to see on their dashboards and Customer 360 screens?*
- **Proposed Baseline:**
  - [x] Total invoice value
  - [x] Payment received status (PAID / PARTIAL / UNPAID)
  - [x] Outstanding balance on their assigned customers
  - [x] Overdue age in days
  - [ ] Detailed company bank account statements (Recommended: HIDE)
  - [ ] Total company monthly turnover (Recommended: HIDE)
  - [ ] Internal profit margins and supplier purchase prices (Recommended: HIDE)
- **Hemalath & MD Confirmation Required:** Does Accounts approve this visibility boundary?
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS & MD SIGN-OFF`
- **Action Required:** `Lock field-level permission masks in ERP RBAC registry`

---

### Question 18: Information Restricted Strictly to Accounts & MD
*What confidential accounting data must be restricted strictly to Hemalath and the Managing Director (Borra Narsimulu)?*
- **Proposed Restricted Data:**
  - Company Bank balances & Contra transactions.
  - Supplier payables ledger and distributor payment aging.
  - Overall company Profit & Loss and Trial Balance summaries.
  - Tally Synchronization configuration and manual sync controls.
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS & MD SIGN-OFF`
- **Action Required:** `Enforce server-side role boundaries on restricted ledgers`

---

## SECTION X: REPORTING & PRE-INTEGRATION PREREQUISITES

### Question 19: Reports Required by Accounts
*What reports does the Accounts Department need the ERP to generate automatically?*
- **Checklist:**
  - [ ] Daily Collections & Receipts Register
  - [ ] Weekly Debtors Aging Analysis (0-30, 31-60, 61-90, 90+ days)
  - [ ] Monthly GSTR-1 vs Tally Sales Register Reconciliation
  - [ ] Monthly Creditors Outstanding & Payment Due Schedule
  - [ ] Customer PO vs Billed Amount Variance Report
  - [ ] E-Way Bill Expiration & Pending Dispatch Report
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS INPUT`
- **Action Required:** `Configure automated reporting cadences in ERP report builder`

---

### Question 20: Pre-Integration Approval Gate
*What specific tests and verifications must be completed in a test environment before Accounts will approve connecting the integration to the live Tally company?*
- **Proposed Prerequisites:**
  1. Full backup of all Tally company folders stored on external secure media.
  2. Proof that sync agent causes zero freezing or performance degradation on Tally.
  3. Trial run on a copy of the company data with 100% matched balances.
  4. Written sign-off from Hemalath and Managing Director.
- **Hemalath's Answer / Decision:**
  > [Enter Answer Here]
- **Decision Status:** `PENDING ACCOUNTS & MD SIGN-OFF`
- **Action Required:** `Establish formal pre-cutover testing protocol`

---

## SECTION XI: FORMAL REVIEW SIGN-OFF BLOCKS

| Stakeholder Role | Name | Signature / Approval Status | Date |
| :--- | :--- | :---: | :---: |
| **Accounts Head** | Hemalath | `[ PENDING REVIEW ]` | `____ / ____ / 2026` |
| **Managing Director** | Borra Narsimulu | `[ PENDING REVIEW ]` | `____ / ____ / 2026` |
| **Systems Architect** | Technical Lead | `[ ARCHITECTURE READY ]` | `06 / 11 / 2026` |

---

*Accounts Review Checklist prepared for immediate physical review by Hemalath and the Managing Director.*
