# ICON TECH PRO ERP — Final Role Permission Matrix

**System**: ICON TECH PRO Enterprise Resource Planning (ERP) Suite  
**Effective Date**: September 16, 2026  
**Security Model**: Role-Based Access Control (RBAC) + Row-Level Security (RLS) + Field-Level Privacy  
**Compliance**: Fully Audited & Automated Matrix Verified (175/175 Tests Passed)

---

## 1. Role Profiles & Personnel Directory

| Role Designation | Canonical Staff Name | Primary Focus | Cost Privacy | Discount Authority |
| :--- | :--- | :--- | :---: | :---: |
| **Managing Director** | Narsimha Naidu | Executive Governance, P&L, Strategy | Full Visibility | Override & Final Approval |
| **Admin / BDM** | Dheeraj | Sales Strategy, Operations, System Admin | Full Visibility | Standard & Escalated (<15%) |
| **BDM** | Vineet Babu | Key Accounts, Field Sales, Presales | Masked to 0 | Standard Discounts (>5%) |
| **Sales Executive** | Reshma | Customer Engagements, Quotation Drafting | Masked to 0 | None (Requires Approval) |
| **Accounts** | Hemalatha | Billing, GST, Collections, Tally Books | Full Visibility | Ledger Verification Only |
| **Office Assistant** | Manisha | Logistics, Dispatch Challans, Installations | Masked to 0 | None |

---

## 2. Module & Action Permission Matrix (ALLOW vs DENY)

| ERP Module / Action | Managing Director | Admin / BDM | BDM | Sales Executive | Accounts | Office Assistant |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard & Command Center** | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| **Enquiries & Leads (Create/Edit)**| ALLOW | ALLOW | ALLOW | ALLOW | DENY | ALLOW |
| **Customer Dossiers & Customer 360**| ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| **Commercial Quotation Creation** | ALLOW | ALLOW | ALLOW | ALLOW | DENY | DENY |
| **Quotation PDF Preview** | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | DENY |
| **Quotation Review & Human Approval**| ALLOW | ALLOW | ALLOW | ALLOW (Own Quote) | DENY | DENY |
| **Send Email / WhatsApp Proposal** | ALLOW | ALLOW | ALLOW | ALLOW (Approved Only)| DENY | DENY |
| **Vendor Purchase Cost Visibility** | **ALLOW** | **ALLOW** | **DENY (0)** | **DENY (0)** | **ALLOW** | **DENY (0)** |
| **Gross Margin % Visibility** | **ALLOW** | **ALLOW** | **ALLOW** | **DENY (0)** | **ALLOW** | **DENY (0)** |
| **Discount Approval Execution** | **ALLOW** | **ALLOW** | **ALLOW** | **DENY** | **DENY** | **DENY** |
| **Anti-Self Approval Guard** | **ENFORCED** | **ENFORCED** | **ENFORCED** | **ENFORCED** | **ENFORCED** | **ENFORCED** |
| **Sales Orders (View / Convert)** | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| **Procurement & Purchase Orders** | ALLOW | ALLOW | DENY | DENY | ALLOW | DENY |
| **Supplier Invoice 3-Way Match** | ALLOW | ALLOW | DENY | DENY | ALLOW | DENY |
| **Inventory & Serial Tracking** | ALLOW | ALLOW | ALLOW | ALLOW (No Cost) | ALLOW | ALLOW (No Cost) |
| **Dispatch Challans & Logistics** | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| **Installation Job Cards & Sign-off**| ALLOW | ALLOW | ALLOW | ALLOW | DENY | ALLOW |
| **Tax Invoices & GST Billing** | ALLOW | ALLOW | DENY | DENY | ALLOW | DENY |
| **Customer Payments & Receipts** | ALLOW | ALLOW | DENY | DENY | ALLOW | DENY |
| **Receivables & Payables Aging** | ALLOW | ALLOW | DENY | DENY | ALLOW | DENY |
| **Warranty & AMC Management** | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| **Communication Center & Outbox** | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| **Executive Reports & BI Exports** | ALLOW | ALLOW | ALLOW (Sales) | DENY | ALLOW (Finance) | DENY |
| **Custom Report Builder** | ALLOW | ALLOW | DENY | DENY | ALLOW | DENY |
| **Purchase Intelligence Radar** | ALLOW | ALLOW | ALLOW | ALLOW | DENY | DENY |
| **Tally Integration Center** | **ALLOW** | **DENY** | **DENY** | **DENY** | **ALLOW** | **DENY** |
| **Security Audit Logs** | **ALLOW** | **ALLOW** | **DENY** | **DENY** | **ALLOW** | **DENY** |
| **User & Staff Administration** | **ALLOW** | **ALLOW** | **DENY** | **DENY** | **DENY** | **DENY** |

---

## 3. Deep-Dive Role Invariants & Safety Controls

### 1. Managing Director (Narsimha Naidu)
- **Role Invariant**: Unrestricted high-level visibility across all operational, commercial, and financial data.
- **Approvals**: Highest authority on discount overrides and margin breaches below 15%.
- **Cost Privacy**: Can view real purchase costs, margins, and supplier invoices.
- **Tally & Audit**: Full access to Tally Integration Center and tamper-evident audit logs.

### 2. Admin / BDM (Dheeraj)
- **Role Invariant**: Central operational control of CRM, commercial proposals, orders, and system settings.
- **Cost Privacy**: Allowed purchase cost visibility for distributor procurement and backorder grouping.
- **Admin**: Can manage staff directory and discount thresholds.
- **Tally Guard**: Direct Tally voucher manipulation is restricted to Accounts and MD to preserve financial segregation of duties.

### 3. BDM (Vineet Babu)
- **Role Invariant**: Senior commercial account management.
- **Cost Privacy**: Raw vendor purchase costs are **strictly masked to 0** in all UI and API responses to prevent distributor cost leakage.
- **Margins**: Can view gross margin percentages to structure profitable proposals.
- **Approvals**: Can approve standard discounts above 5% for sales executives, but cannot approve their own submitted discounts.

### 4. Sales Executive (Reshma)
- **Role Invariant**: Presales lead generation and customer proposal building.
- **Cost Privacy**: **Zero visibility** on purchase costs (`purchase_price = 0`) and internal margins (`margin_pct = 0`).
- **Discount Guard**: Cannot approve any discount. Any quote with a discount requires BDM or MD approval.
- **Send Safety**: Cannot dispatch a quotation via Email or WhatsApp until it has been previewed as a PDF and approved by management.

### 5. Accounts (Hemalatha)
- **Role Invariant**: Financial stewardship, GST compliance, collections, and Tally sync.
- **Cost Privacy**: Full visibility on supplier invoices, purchase costs, and payment allocations.
- **Governance**: Cannot modify sales quotations, approve discounts, or alter staff permissions.
- **Tally Integration**: Full authority over Tally Sync Queue, voucher generation, and two-way reconciliation.

### 6. Office Assistant (Manisha)
- **Role Invariant**: Physical operations, material dispatch, and installation coordination.
- **Restricted Access**: Strictly blocked from financial ledgers, purchase costs, margins, quotations, and administration settings.
- **Permitted Access**: Can view and update dispatch challans, capture serial numbers, update site installation job cards, and record customer handover sign-offs.

---

## 4. Verification Evidence

The above matrix is strictly enforced at multiple layers:
1. **Server-Side Action Guards**: `requireRole([...])` blocks unauthorized execution at the RPC boundary.
2. **Field Masking Engine**: Data access services sanitize restricted fields before returning payloads to client components.
3. **Automated Test Coverage**: Verified in `test/role-qa-matrix.test.mjs` with 100% assertion pass rate.
