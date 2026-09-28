# ICON TECH PRO ERP - Inventory & Warehouse Management Workflow

## 1. Inventory Architectural Model & Stock Calculations

The inventory engine operates on an **Immutable Ledger (Transaction Log)** model. Current, reserved, and available stock levels are maintained through strict transactional consistency.

```
+-----------------------------------------------------------------------------------------+
|                                    STOCK LEDGER MATH                                     |
+-----------------------------------------------------------------------------------------+
|  Current Stock   = Opening Stock + Purchases - Dispatches + Customer Returns             |
|                    - Supplier Returns +/- Stock Adjustments                             |
|                                                                                         |
|  Reserved Stock  = Sum of unfulfilled item quantities in Confirmed Sales Orders          |
|                                                                                         |
|  Available Stock = Current Stock - Reserved Stock                                        |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Product Master Data Structure

Every product in the catalog is configured with the following properties:

| Field Name | Description & Business Rules |
| :--- | :--- |
| **Category** | One of the 22 designated categories (e.g., Projector, Interactive Boards, CCTV). |
| **Brand** | Manufacturer/OEM brand (e.g., BenQ, Sony, Optoma, Hikvision, Cisco, Samsung). |
| **Model** | Specific manufacturer model string. |
| **SKU** | Unique system inventory identifier (e.g., `PRJ-BENQ-TK850I`). |
| **HSN/SAC** | Indian GST classification code for tax validation (e.g., `85286200`). |
| **GST Rate** | Statutory tax percentage (e.g., 18.00% or 28.00%). |
| **Purchase Price** | Standard vendor procurement cost (restricted to MD, Admin, Accounts). |
| **Selling Price** | Standard market quotation unit price. |
| **MRP** | Maximum Retail Price printed on packaging. |
| **Opening Stock** | Initial physical balance upon system cutover. |
| **Current Stock** | Total physical quantity residing in the warehouse. |
| **Reserved Stock** | Quantity locked for approved customer sales orders. |
| **Available Stock** | Unencumbered quantity available for immediate quote commitments. |
| **Reorder Level** | Threshold trigger for automatic procurement notification. |
| **Warehouse** | Physical storage facility (`WH-HYD-MAIN`, `WH-HYD-RENTAL`). |
| **Rack / Bin** | Precise storage coordinates for fast picking (e.g., `Rack-B4 / Bin-12`). |
| **Default Supplier**| Preferred vendor for auto-populating purchase requisitions. |
| **Serial Tracked** | Boolean flag indicating whether individual unit serials must be tracked. |

---

## 3. Stock Movement Workflows & Ledger Types

```
                         +-----------------------------------+
                         |         INVENTORY LEDGER          |
                         +-----------------------------------+
                                           |
    +-------------------+------------------+-------------------+-------------------+
    |                   |                  |                   |                   |
    v                   v                  v                   v                   v
[ PURCHASE ]        [ SALES ]        [ RESERVATION ]      [ RETURNS ]      [ ADJUSTMENTS ]
Inbound GRN from    Outbound         Lock on SO confirm;  Customer return  Physical audit
supplier; adds to   dispatch via DC; release on SO        or Supplier      count write-off/
Current Stock.      deducts Current  cancel; shifts       RMA; updates     write-in with MD
                    & Reserved.      Available.           Current Stock.   approval.
```

### 3.1 Purchase Receipt (Inward)
* **Trigger:** Receipt of shipment from vendor against an authorized Purchase Order.
* **Process:** Warehouse inspector verifies physical boxes, counts units, performs quality check, and records a Goods Receipt Note (GRN).
* **Ledger Impact:**
  * `Current Stock`: Increments by accepted quantity.
  * `Available Stock`: Auto-increments accordingly.
  * For serialized goods, individual serial numbers are registered into `inventory_serials` with status `AVAILABLE`.

### 3.2 Sales Order Reservation
* **Trigger:** Sales Quotation approved and converted to Sales Order.
* **Process:** ACID-safe database procedure checks available quantity.
* **Ledger Impact:**
  * `Reserved Stock`: Increments by ordered quantity.
  * `Available Stock`: Decrements by ordered quantity.
  * `Current Stock`: **Unchanged** (goods are still physically in warehouse).

### 3.3 Dispatch & Logistics Outward
* **Trigger:** Materials packed for delivery against an approved Tax Invoice or Delivery Challan.
* **Process:** Warehouse personnel scans physical serial numbers.
* **Ledger Impact:**
  * `Current Stock`: Decrements by dispatched quantity.
  * `Reserved Stock`: Decrements by dispatched quantity (reservation consumed).
  * `inventory_serials`: Status transitions from `RESERVED` to `DISPATCHED`.

### 3.4 Installation Consumption & Customer Handover
* **Trigger:** Field technician deploys cabling, mounts, connectors, or accessory stock on site.
* **Ledger Impact:** Serial or batch item status transitions from `DISPATCHED` to `INSTALLED`, binding the hardware serial to the customer's permanent asset history.

### 3.5 Return Workflows
* **Customer Return (Sales Return):** Restocks goods upon return, reversing dispatch and adjusting customer ledger via Credit Note.
* **Supplier Return (RMA / Defective Outward):** Goods failing QA on receipt are marked `DEFECTIVE` and dispatched back to vendor with debit note.

### 3.6 Inventory Reconciliation & Stock Adjustment
* Regular physical stocktakes compare physical counts with system counts.
* Any variance requires a formal `STOCK_ADJUSTMENT` movement, requiring reason code (e.g., "Transit damage", "Display sample write-off", "Count discrepancy") and mandatory Admin approval (`Dheeraj` or `Narsimha Naidu`).

---

## 4. Serial Number Lifecycle State Machine

```
      [ Vendor Inward (GRN) ]
                 |
                 v
           +-----------+
    +----->| AVAILABLE |
    |      +-----------+
    |            |
    |            | (SO Confirmation)
    |            v
    |      +-----------+
    |      | RESERVED  |
    |      +-----------+
    |            |
    |            | (Challan Dispatch)
    |            v
    |      +------------+
    |      | DISPATCHED |
    |      +------------+
    |            |
    |            +---------------------------------------+
    |            | (Installation Sign-Off)               | (Rental Deployment)
    |            v                                       v
    |      +-----------+                           +------------+
    |      | INSTALLED |                           | RENTED_OUT |
    |      +-----------+                           +------------+
    |            |                                       |
    |            | (Warranty RMA / Service)              | (Rental Return)
    |            v                                       v
    |      +---------------+                       +------------+
    +------| UNDER_SERVICE |<----------------------| RETURNED   |
           +---------------+                       +------------+
                 |
                 | (Decommission / Scrap)
                 v
           +------------+
           | DEFECTIVE  |
           +------------+
```

---

## 5. Low-Stock Automated Warning Engine

1. **Reorder Threshold Evaluation:**
   * A periodic database cron or trigger evaluates `available_stock <= reorder_level`.
2. **Notification Pipeline:**
   * Alert dispatched to Admin (`Dheeraj`) and Accounts (`Hemalatha`).
   * Automated draft Purchase Requisition prepared with recommended replenishment quantity (`reorder_level * 2 - available_stock`).
   * Displayed prominently on Executive & Operations Dashboards.
