# ICON TECH PRO ERP - Accounting, Invoicing, & Financial Workflow

## 1. Accounting Lifecycle & Invoicing Flow

```
[ Sales Order Confirmed ]
            |
            +---------------------------------------+
            | Advance Required Prior to Dispatch?   |
            | YES                                   | NO
            v                                       v
+-----------------------------------+   +-----------------------------------+
|  Generate Proforma Invoice (PI)   |   | Direct Dispatch Readiness         |
+-----------------------------------+   +-----------------------------------+
            |                                       |
            v                                       |
+-----------------------------------+               |
|  Advance Payment Received (Bank)  |               |
+-----------------------------------+               |
            |                                       |
            +-------------------+-------------------+
                                |
                                v
+---------------------------------------------------+
| 1. Issue Statutory Tax Invoice (INV-YY-XXXX)      |
|    - Telangana GST Engine (CGST+SGST vs. IGST)    |
|    - HSN/SAC Code Verification & Round-off        |
+---------------------------------------------------+
                                |
                                v
+---------------------------------------------------+
| 2. Accounts Receivable Tracking (Hemalatha)       |
|    - Customer Ledger Update                       |
|    - Aging Schedule: 0-30, 31-60, 61-90, 90+ Days |
+---------------------------------------------------+
                                |
                                v
+---------------------------------------------------+
| 3. Payment Receipt & Bank Reconciliation          |
|    - UTR / Cheque / UPI Verification              |
|    - Automated Status Update to "PAID"            |
+---------------------------------------------------+
                                |
                                v
+---------------------------------------------------+
| 4. Accounting Export (Tally Prime Interchange)    |
|    - Sales, Purchase, Receipt, & Payment Vouchers |
+---------------------------------------------------+
```

---

## 2. Indian GST Compliance & Calculation Engine

### 2.1 State Code Matrix & Tax Determination
* **Company Operating Entity:** ICON TECH PRO, Hyderabad, Telangana (State Code: `36`).
* **Tax Calculation Rules:**
  1. **Intra-State Sale (Customer State Code == '36'):**
     $$\text{CGST} = \text{Taxable Amount} \times \left(\frac{\text{GST Rate}}{2}\right)$$
     $$\text{SGST} = \text{Taxable Amount} \times \left(\frac{\text{GST Rate}}{2}\right)$$
     $$\text{IGST} = 0.00$$
  2. **Inter-State Sale (Customer State Code != '36'):**
     $$\text{CGST} = 0.00$$
     $$\text{SGST} = 0.00$$
     $$\text{IGST} = \text{Taxable Amount} \times \text{GST Rate}$$

### 2.2 Statutory Invoice Fields
* Legal Header with ICON TECH PRO GSTIN, PAN, and Registered Hyderabad Address.
* Consecutive unique invoice numbering: `INV-26-XXXX`.
* HSN codes for goods (6/8 digits) and SAC codes for services (e.g., `9987` for installation/maintenance).
* Pre-tax taxable subtotal, itemized tax rates, CGST/SGST/IGST breakdown, and mathematical round-off to nearest integer rupee.
* QR code / Bank details for NEFT/RTGS settlement.

---

## 3. Invoice Types & Billing Documents

| Document Type | Code Prefix | Purpose & Operational Use |
| :--- | :--- | :--- |
| **Tax Invoice** | `INV-YY-XXXX` | Final commercial tax document issued upon delivery or dispatch readiness. Formally increases Accounts Receivable. |
| **Proforma Invoice** | `PI-YY-XXXX` | Pre-sale estimation document used to request commercial advances from corporate clients. Does not affect financial ledger. |
| **Delivery Challan** | `DC-YY-XXXX` | Goods transit document accompanying physical vehicle without monetary tax claim (e.g. for demonstration or site approval). |
| **Credit Note** | `CN-YY-XXXX` | Reversal or discount issued to client for returned items or price revisions, decreasing customer balance. |
| **Debit Note** | `DN-YY-XXXX` | Issued to suppliers for rejected materials or price discrepancies. |

---

## 4. Accounts Receivable & Aging Matrix

The Accounts module (managed by `Hemalatha`) provides real-time debt monitoring:
* **Current (0-30 Days):** Active orders within standard payment terms.
* **Overdue Tier 1 (31-60 Days):** Automatic follow-up notification dispatched to assigned salesperson (`Vineet`, `Reshma`).
* **Overdue Tier 2 (61-90 Days):** Escalation flag visible on MD (`Narsimha Naidu`) and Admin (`Dheeraj`) dashboards.
* **Critical (> 90 Days):** Automated suspension of new credit quotations and order processing for the delinquent customer account.

---

## 5. Tally Prime Integration Architecture

To ensure seamless monthly compliance without manual double entry:

### 5.1 Interchange Format (Tally XML Standard)
The system exposes an accounting export interface delivering structured XML vouchers:

```xml
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>20260910</DATE>
            <VOUCHERNUMBER>INV-26-0001</VOUCHERNUMBER>
            <PARTYLEDGERNAME>ABC Tech Park Pvt Ltd</PARTYLEDGERNAME>
            <BASICBUYERNAME>ABC Tech Park Pvt Ltd</BASICBUYERNAME>
            <PLACEOFSUPPLY>Telangana</PLACEOFSUPPLY>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>ABC Tech Park Pvt Ltd</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-118000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales - Audio Visual</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>100000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output CGST @ 9%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>9000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output SGST @ 9%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>9000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

### 5.2 Synchronization Pipeline
1. **Automated Period Export:** Accounts selects date range (e.g. Month-to-Date).
2. **Voucher Generation:** System generates validated XML package covering:
   * Sales Vouchers
   * Purchase Vouchers
   * Bank Receipt Vouchers
   * Payment Vouchers
3. **One-Click Import:** Tally operator imports XML package via Tally Gateway with zero transposition errors.
