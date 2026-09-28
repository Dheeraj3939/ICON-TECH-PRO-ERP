# ICON TECH PRO ERP - User Roles, Staff Directory, & RBAC Matrix

## 1. Staff Directory & Assigned Roles

| Staff Member | Designated ERP Role | Strategic Scope & Authority | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Narsimha Naidu** | **Managing Director** | Enterprise Super Admin (Unrestricted) | Executive governance, organization setup, margin/discount overrides, financial reports, final sign-offs. Has 100% unrestricted access across all ERP modules, settings, approvals, and data. |
| **Dheeraj** | **Admin / BDM** | Operational Administrator & Business Head | Full operational control, user management, sales pipeline oversight, inventory allocations, procurement approvals. |
| **Vineet Babu** | **BDM** | Senior Presales & Enterprise Accounts | Corporate B2B lead qualification, client negotiations, quotation builder, sales order conversion. |
| **Reshma** | **Sales Executive** | Field Sales & Solution Engineering | B2C/B2B lead generation, scheduling site visits, client follow-ups, standard quotation preparation. |
| **Hemalatha** | **Accounts** | Finance, Billing & Audit | Tax invoice generation, payment receipts, accounts receivable, vendor bills, GST filing reconciliations. |
| **Manisha** | **Office Assistant** | Operations & Administration Support | Walk-in / inbound enquiry entry, customer directory upkeep, document uploads, dispatch filing. |

> [!IMPORTANT]
> **Super Admin Status:** Narsimha Naidu (Managing Director) is the designated Enterprise Super Admin. He has total, unrestricted access to all data, financial records, system settings, user credentials, approval overrides, and audit trails for ICON TECH PRO.

---

## 2. Granular Role-Based Access Control (RBAC) Matrix

### Legend:
* **F:** Full Access (Create, Read All, Edit All, Delete, Export)
* **W:** Read & Write All (Create, Read All, Edit All)
* **O:** Own Record Only (Create, Read Own, Edit Own)
* **R:** Read Only (Global View)
* **RO:** Read Own Only
* **A:** Approve Authority
* **-:** No Access (Denied by RLS)

| ERP Module | Managing Director (Narsimha Naidu) | Admin / BDM (Dheeraj) | BDM (Vineet Babu) | Sales Executive (Reshma) | Accounts (Hemalatha) | Office Assistant (Manisha) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Enquiries / Leads** | F | F | W | O | R | W |
| **Customer Master (Company/Ind.)** | F | F | W | W | R | W (Create/Edit) |
| **Site Visits & Surveys** | F | F | W | O | - | R |
| **Follow-ups & CRM Touchpoints** | F | F | W | O | - | R |
| **Quotations (Draft/Send)** | F | F | W | O | R | R |
| **Quotation Discount Approval** | A (Full/Override) | A (Up to Admin Limit) | A (Up to BDM Limit) | Self-Limit Only | - | - |
| **Sales Orders (Confirmation)** | F | F | W (Convert) | O (Convert) | R | - |
| **Product Master & Catalog** | F | F | R | R | R | R |
| **Product Cost / Purchase Price** | F | F | - | - | R | - |
| **Inventory Stock (View/Audit)** | F | F | R | R | R | R |
| **Stock Adjustments & Transfers** | F | F | - | - | - | - |
| **Procurement & POs** | F | F | R | - | W | - |
| **Goods Receipt (GRN)** | F | F | - | - | W | - |
| **Tax Invoices & Proforma** | F | F | R | R | F | - |
| **Payments & Receipts** | F | F | - | - | F | - |
| **Receivables Aging / Ledgers** | F | F | R | R | F | - |
| **Dispatch & Delivery Challans** | F | F | R | R | R | W (Pack/Dispatch) |
| **Installation & Handover** | F | F | R | R | - | R |
| **Service Tickets & AMC** | F | F | R | R | R | R |
| **Rental Contracts & Fleet** | F | F | R | - | R | R |
| **Executive Dashboards** | F | F | Sales KPI | Sales KPI | Finance KPI | Basic Activity |
| **Audit Logs** | F | F (View) | - | - | - | - |
| **User & Role Management** | F | F | - | - | - | - |

---

## 3. Row-Level Security (RLS) Implementation Architecture

Supabase PostgreSQL RLS policies enforce access control directly at the SQL query execution layer. Even if an API request is tampered with on the client side, the database engine blocks unauthorized access.

### 3.1 Customer & Enquiry Policy Pattern
```sql
-- Enable RLS on Enquiries
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

-- Managing Director & Admin have unrestricted access
CREATE POLICY "Admins have full access to enquiries"
ON enquiries FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid()
        AND r.role_name IN ('Managing Director', 'Admin / BDM')
    )
);

-- BDM & Office Assistant can read all enquiries
CREATE POLICY "BDM and Office Assistant read all enquiries"
ON enquiries FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid()
        AND r.role_name IN ('BDM', 'Office Assistant')
    )
);

-- Sales Executives can only view their own assigned enquiries
CREATE POLICY "Sales Executive read own enquiries"
ON enquiries FOR SELECT
TO authenticated
USING (
    salesperson_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM user_profiles u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid()
        AND r.role_name = 'Sales Executive'
    )
);
```

### 3.2 Accounting & Financial Separation Policy Pattern
```sql
-- Enable RLS on Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Only Accounts, Admin, and MD can create or edit payment records
CREATE POLICY "Accounts and Executive access to payments"
ON payments FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid()
        AND r.role_name IN ('Managing Director', 'Admin / BDM', 'Accounts')
    )
);

-- Sales team cannot view raw bank payment transaction ledgers
-- They can only view invoice balance_amount via read-only invoice view
```

---

## 4. Special Security Guards & Anti-Tamper Mechanisms

1. **Configurable Quotation Discount & Pricing Rules:**
   * Discount thresholds are dynamic and configured via the ERP Settings / Admin module across 4 tiers:
     - *Salesperson Approval Limit:* Maximum discount self-approvable by Sales Executive (`Reshma`).
     - *BDM Approval Limit:* Maximum discount approvable by BDM (`Vineet Babu`).
     - *Admin Approval Limit:* Maximum discount approvable by Admin / BDM (`Dheeraj`).
     - *Managing Director Limit:* Final override tier by Managing Director (`Narsimha Naidu`).
   * Any quotation exceeding a user's role threshold automatically halts the workflow with status `PENDING_APPROVAL` until approved by an authorized higher role.
2. **Post-Invoice Immutable Locks:**
   * Once a Tax Invoice is issued by `Hemalatha`, the corresponding Sales Order, Quotation, and Dispatch records are permanently locked.
   * Any change requires an official Credit Note or cancellation approval from the Managing Director.
3. **Serial Number Allocation Integrity:**
   * Dispatches cannot be confirmed without attaching distinct, scanned serial numbers corresponding to physical inventory items marked as `AVAILABLE` in the designated warehouse.
