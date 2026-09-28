# ICON TECH PRO ERP - Procurement & Purchase Workflow Specification

## 1. Procurement Lifecycle Overview

```
[ Sales Order Backorder ]  OR  [ Stock Below Reorder Level ]  OR  [ Manual Requisition ]
                             |
                             v
             +-------------------------------+
             | 1. Purchase Requisition (PR)  |
             +-------------------------------+
                             |
                             v
             +-------------------------------+
             | 2. Managerial Approval        |-----> [ Admin / MD Sign-off ]
             +-------------------------------+
                             |
                             v
             +-------------------------------+
             | 3. Purchase Order (PO) to OEM |-----> [ Supplier Master / Terms ]
             +-------------------------------+
                             |
                             v
             +-------------------------------+
             | 4. Goods Receipt Note (GRN)   |-----> [ Quality Check & Serials ]
             +-------------------------------+
                             |
                             v
             +-------------------------------+
             | 5. Purchase Invoice / Bill    |-----> [ Accounts 3-Way Match ]
             +-------------------------------+
                             |
                             v
             +-------------------------------+
             | 6. Vendor Payment Settlement  |-----> [ Accounts (Hemalatha) ]
             +-------------------------------+
```

---

## 2. Step-by-Step Purchase Execution

### 2.1 Triggering Purchase Requisitions (PR)
Procurement needs originate through three operational mechanisms:
1. **Sales-Driven Backorder (Automated):**
   * Triggered when a confirmed Sales Order encounters a deficit in `inventory_stock.available_stock`.
   * PR is automatically linked to the parent `sales_order_id`, ensuring prioritized allocation once materials arrive.
2. **Inventory Reorder Alert (Automated):**
   * Triggered when critical stock falls below predefined `reorder_level`.
3. **Manual Direct Requisition:**
   * Initiated by BDM (`Vineet`) or Admin (`Dheeraj`) for showroom display units, demonstration gear, or projected high-demand equipment.

### 2.2 Requisition Review & PO Approval Governance
* **Requisitions < ₹50,000:** Can be approved directly by Admin / BDM (`Dheeraj`).
* **Requisitions >= ₹50,000:** Automatically routed to Managing Director (`Narsimha Naidu`) for commercial authorization.
* Upon approval, the PR transitions to `PO_CREATED` status.

### 2.3 Purchase Order Generation & Vendor Contracting
* The system pulls preferred vendor details from `suppliers` master.
* Key PO attributes:
  * PO Number format: `PO-YY-XXXX` (e.g., `PO-26-0001`).
  * Vendor details: Name, GSTIN, Address, Payment terms (e.g., 30 Days Net, 100% Advance, 50-50).
  * Line items: SKU, Description, HSN Code, Agreed Purchase Rate, GST slab (IGST for out-of-state OEMs, CGST+SGST for local distributors), and required delivery date.
* Export to PDF and email transmission directly to vendor sales representative.

### 2.4 Goods Receipt Note (GRN) & Inward Quality Verification
1. **Physical Material Arrival:**
   * Material arrives at the warehouse accompanied by the vendor's delivery challan / tax invoice.
   * Warehouse receiver logs a GRN (`GRN-26-XXXX`).
2. **Quality Check & Serial Capture:**
   * **Accepted Quantity:** Goods meeting physical condition and operational specs.
   * **Rejected Quantity:** Units damaged in transit or defective. A rejection notice is dispatched to the supplier.
   * Serial numbers for accepted units are entered or scanned into the system.
3. **Stock Synchronization:**
   * Accepted units automatically update `inventory_stock.current_stock`.
   * If the PO was tied to a customer Sales Order backorder, the system immediately locks the quantity into `reserved_stock` for that customer order and notifies the assigned sales executive.

### 2.5 3-Way Financial Matching & Purchase Invoices
Before Accounts (`Hemalatha`) releases vendor payments, the system enforces a **3-Way Match**:
1. **Purchase Order:** Validates approved pricing and quantities.
2. **Goods Receipt Note (GRN):** Validates actual accepted quantities delivered.
3. **Vendor Tax Invoice:** Validates statutory tax breakdown, GSTIN match, and invoiced amounts.

### 2.6 Purchase Returns & Supplier RMA
* In case of latent product defects or warranty claims, goods are placed in `DEFECTIVE` status.
* A Purchase Return is generated, decreasing current stock and issuing a Debit Note against the vendor account for credit adjustment or replacement.
