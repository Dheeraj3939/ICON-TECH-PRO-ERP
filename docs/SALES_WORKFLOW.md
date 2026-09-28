# ICON TECH PRO ERP - End-to-End Sales Workflow Specification

## 1. Complete Business Lifecycle Map

```
[ Inbound Lead / Walk-in ]
            |
            v
+-----------------------------------+
|  1. Salesperson Creates Enquiry   |-----> [ Capture Customer Requirements ]
+-----------------------------------+
            |
            v
+-----------------------------------+
| 2. Classify Customer Master Type  |-----> [ Auto-generate ID: ICONYYXXXX ]
|    - COMPANY vs. INDIVIDUAL       |
+-----------------------------------+
            |
            +---------------------------------------+
            | Technical Site Survey Needed?         |
            | YES                                   | NO
            v                                       |
+-----------------------------------+               |
| 3. Schedule & Conduct Site Visit  |               |
|    - Room dimensions & photos     |               |
|    - Acoustics / Cabling check    |               |
+-----------------------------------+               |
            |                                       |
            +---------------------------------------+
            |
            v
+-----------------------------------+
| 4. Prepare Engineering Quotation  |-----> [ Line-item discounts, GST 18%/28% ]
+-----------------------------------+
            |
            v
+-----------------------------------+
| 5. Send Quotation to Customer     |-----> [ Branded PDF via Email / WhatsApp ]
+-----------------------------------+
            |
            v
+-----------------------------------+
| 6. Follow-up & Discussion         |-----> [ Log client calls, meetings, notes ]
|    - Commercial Negotiations      |
+-----------------------------------+
            |
            +-----------------------------------+-----------------------------------+
            | Outcome                           | Lost / Obsolete                   | Cancelled
            v                                   v                                   v
+-----------------------------------+   +--------------------+              +--------------------+
| 7. Convert to Confirmed Sales Ord |   | Status: "Lost"     |              | Status: "Cancelled"|
+-----------------------------------+   +--------------------+              +--------------------+
            |                                    (or "NA")
            v
+-----------------------------------+
| 8. Automated Inventory Validation |
+-----------------------------------+
            |
            +---------------------------------------+
            | Stock Available?                      |
            | YES                                   | NO (Shortage / Backorder)
            v                                       v
+-----------------------------------+   +-----------------------------------+
| 9A. Atomic Stock Reservation      |   | 9B. Auto-generate Purchase Requis |
|     - Lock SKU quantities         |   |     - Trigger Vendor PO workflow  |
+-----------------------------------+   +-----------------------------------+
            |                                       |
            |                                       v
            |                           +-----------------------------------+
            |                           | 9C. Goods Receipt & Staging (GRN) |
            |                           +-----------------------------------+
            |                                       |
            +---------------------------------------+
            |
            v
+-----------------------------------+
| 10. Commercial Invoicing (Accounts|-----> [ Proforma or Tax Invoice ]
+-----------------------------------+
            |
            v
+-----------------------------------+
| 11. Payment Collection & Receipt  |-----> [ Advance or Full Settlement ]
+-----------------------------------+
            |
            v
+-----------------------------------+
| 12. Warehouse Dispatch & Logistics|-----> [ Scan Serials, Delivery Challan ]
+-----------------------------------+
            |
            +---------------------------------------+
            | On-Site Installation Required?        |
            | YES                                   | NO
            v                                       |
+-----------------------------------+               |
| 13. Installation & Commissioning  |               |
|     - Technician assignment       |               |
|     - Handover sign-off           |               |
+-----------------------------------+               |
            |                                       |
            +---------------------------------------+
            |
            v
+===================================+
|    FINAL STATUS: "ORDER DONE"     |
+===================================+
```

---

## 2. Detailed Step-by-Step Workflow Rules

### Phase 1: Lead Ingestion & Qualification
1. **Enquiry Origination:**
   * Handled by Sales Executive (`Reshma`), BDM (`Vineet`), or Office Assistant (`Manisha`).
   * Initial data points: Inquirer name, contact phone, email, project location, preliminary budget, and application context (e.g., "Conference room AV integration", "Home theater 7.1.4 setup", "School interactive display panels").
2. **Customer Master Creation / Match:**
   * The system runs a duplicate check against phone number and GSTIN.
   * If existing, link to the existing `customer_id`.
   * If new, prompt the user to choose customer classification:
     * **Company Customer (B2B):** Requires Company Name, Contact Person, Designation, Phone, Alternate Phone, Email, GSTIN, PAN, Billing Address, Shipping Address, City, State, PIN, Salesperson, Enquiry Source, and Customer Status.
     * **Individual Customer (B2C):** Requires Customer Name, Phone, Alternate Phone, Email, Address, City, State, PIN, Requirement, Salesperson, Enquiry Source, and Customer Status.
   * **Atomic ID Generation:** The database trigger executes and assigns the non-editable `ICONYYXXXX` (e.g., `ICON260001`).

### Phase 2: Presales Engineering & Site Feasibility
1. **Trigger Condition:** Complex AV, Acoustics, Boardroom, CCTV, or Home Theater installations require technical validation prior to quotation.
2. **Site Survey Execution:**
   * A `site_visit` ticket is created and dispatched to a solution technician or sales engineer.
   * Mobile-responsive survey captures:
     * Room dimensions (L x W x H)
     * Wall and ceiling material (concrete, gypsum, wood) for acoustic calibration
     * Ambient lighting conditions (lumens needed for projector / LED displays)
     * Power points, UPS availability, and cable conduit pipe readiness
     * Upload of site layout sketches and architectural drawings to Supabase Storage.

### Phase 3: Quotation Engineering & Pricing Governance
1. **Line-Item Composition:**
   * Salesperson selects SKUs from the unified catalog.
   * System pulls standard selling prices and default GST tax slabs (18% for AV/electronics, 28% for certain luxury displays, or 18% SAC for installation).
2. **Configurable Discount Authority & Multi-Tier Approval Rules:**
   * Discount thresholds are **not hard-coded**; they are dynamically governed by the `discount_approval_rules` configured in the ERP Settings / Admin module.
   * The system evaluates the proposed discount against the 4 configured approval limits:
     * **Salesperson Approval Limit:** Auto-approved if within the sales executive's authorized discount threshold.
     * **BDM Approval Limit:** Requires BDM (`Vineet`) approval if exceeding salesperson limit but within BDM limit.
     * **Admin Approval Limit:** Requires Admin / BDM (`Dheeraj`) approval if exceeding BDM limit.
     * **Managing Director Approval Limit:** Requires Managing Director (`Narsimha Naidu`) final override if exceeding Admin limit or falling below floor cost.
   * Quotations exceeding the creator's threshold are automatically marked `PENDING_APPROVAL`, notifying the designated supervisor before the quotation can be transmitted to the customer.
3. **Quotation Output:**
   * Instant compilation of branded PDF quote including terms, warranty periods, bank coordinates, and payment schedules.
   * Status transitions to `SENT` once approved (or if self-approved within role limits).

### Phase 4: Follow-up & Discussion Cadence
1. **Follow-up Tracker:**
   * Sales executive records client feedback after every touchpoint.
   * Automated calendar reminder triggers if an active quotation has had no follow-up for 72 hours.
2. **Revision Handling:**
   * If customer requests changes, the quotation is cloned to `revision_number = revision_number + 1` (e.g., `Q-26-0001-R2`), archiving previous versions for full audit fidelity.

### Phase 5: Sales Order Conversion & Material Allocation
1. **Conversion Event:**
   * Client issues a formal Purchase Order or written approval with advance payment.
   * Quotation status transitions to `APPROVED`.
   * User clicks "Convert to Sales Order".
2. **Immediate Inventory Evaluation (ACID Transaction):**
   * For every physical SKU in the order, the system queries `inventory_stock.available_stock`:
     * **Case A (Stock Sufficient):** System increments `reserved_stock` by the required quantity. Available stock reduces immediately, preventing another salesperson from selling the same units.
     * **Case B (Stock Insufficient):** System reserves whatever stock exists and flags the deficit as a **Backorder**, automatically creating a `purchase_requisition` linked to this Sales Order.

### Phase 6: Invoicing & Payment Settlement
1. **Invoicing Options:**
   * **Proforma Invoice:** Generated before final delivery for customers requiring advance clearance.
   * **Tax Invoice:** Generated by Accounts (`Hemalatha`) upon dispatch readiness, with sequential invoice numbering and GST calculation.
2. **Payment Recording:**
   * Accounts inputs payment transactions (NEFT UTR, UPI reference, Cheque number).
   * System updates `invoices.paid_amount` and marks status as `PARTIALLY_PAID` or `PAID`.

### Phase 7: Dispatch, Delivery, & Handover
1. **Dispatch & Serial Scanning:**
   * Warehouse staff packs items against the Sales Order.
   * For serialized items, barcodes or serial numbers must be scanned/selected, transitioning them from `RESERVED` to `DISPATCHED`.
   * A Delivery Challan (`DC-26-XXXX`) is issued with transporter and vehicle details.
2. **Installation & Sign-Off:**
   * If installation labor was included, a technician is assigned.
   * On-site testing of sound levels, display calibration, and cable dressing.
   * Customer signs digital handover acknowledgment on tablet/mobile.
3. **Terminal Closure:**
   * Sales order status updates to `ORDER_DONE`.
   * In the event of deal failure at any prior stage, terminal statuses are strictly classified as:
     * `Lost`: Competitor won, or customer cancelled project (loss reason mandatory).
     * `Cancelled`: Customer withdrew order.
     * `NA`: Invalid enquiry or spam.
