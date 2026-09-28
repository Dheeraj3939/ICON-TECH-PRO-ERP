# ICON TECH PRO ERP - Service & Rental Management

## 1. Unified Single-Entity Architecture

All service, repair, warranty, AMC, and equipment rental operations are owned and executed directly under **ICON TECH PRO** (`ORG-ICON-01`).

```
+----------------------------------------------------------------------------------------------------+
|                                      ICON TECH PRO ERP                                             |
|  - Customer Master (Unified B2B & B2C Profiles)                                                    |
|  - Product Catalog & Technical Specifications                                                      |
+----------------------------------------------------------------------------------------------------+
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
+------------------------------------+    +----------------------------------------------------------+
|       COMMERCIAL HARDWARE          |    |               SERVICE & RENTAL OPERATIONS                |
|  - Commercial Hardware Sales       |    |  SERVICE & AMC SUBSYSTEM        RENTAL SUBSYSTEM         |
|  - Turnkey AV/IT Integration       |    |  - Warranty / Repair Tickets    - Event Equipment Rental |
|  - Project Invoicing & Tax Bills   |    |  - Field Technician Dispatch    - Fixed Asset Fleet      |
|  - Commercial Resale Inventory     |    |  - Preventive Maintenance       - Security Deposit Mgmt  |
|  - Backorder Purchase Orders       |    |  - Annual Contracts (AMC)       - Damage Assessment      |
+------------------------------------+    +----------------------------------------------------------+
```

---

## 2. Service Management Subsystem (ICON TECH PRO)

```
[ Customer Complaint / Service Call ]
                 |
                 v
     +-----------------------+
     | 1. Log Service Ticket |-----> [ Validate Warranty & Serial Number ]
     +-----------------------+
                 |
                 v
     +-----------------------+
     | 2. Assign Technician  |-----> [ Schedule Field Visit or In-House Bench ]
     +-----------------------+
                 |
                 v
     +-----------------------+
     | 3. Diagnostics/Repair |-----> [ Identify Component / Spare Parts ]
     +-----------------------+
                 |
                 +-----------------------------------+
                 | In Warranty?                      |
                 | YES                               | NO (Out of Warranty / AMC)
                 v                                   v
     +-----------------------+           +-----------------------+
     | Free OEM Replacement  |           | Service Quotation     |
     | Under Warranty        |           | (Spares + Labor)      |
     +-----------------------+           +-----------------------+
                 |                                   |
                 +-----------------+-----------------+
                                   |
                                   v
                       +-----------------------+
                       | 4. Testing & Sign-off |
                       +-----------------------+
                                   |
                                   v
                       +-----------------------+
                       | 5. Ticket Closure     |
                       +-----------------------+
```

### 2.1 Service Ticket Lifecycle & SLA Management
1. **Ticket Ingestion (`SRV-YY-XXXX`):**
   * Customer reports an issue (e.g., "Projector lamp flickering", "Interactive display touch response degraded", "Conference mic buzzing").
   * System verifies whether the product serial number was originally sold by ICON TECH PRO, checking active warranty or AMC status.
2. **Technician Dispatch:**
   * Field technician receives notification with site address, contact person, and complaint details.
3. **Spare Parts & Labor Accounting:**
   * If non-warranty, technician logs consumed spare parts (lamps, power modules, HDMI cables) and billable labor.
   * System generates an ICON TECH PRO Service Invoice.
4. **Ticket Resolution & Sign-Off:**
   * Customer verifies functioning equipment and signs the digital service slip.
   * Status transitions to `RESOLVED` and then `CLOSED`.

### 2.2 Annual Maintenance Contracts (AMC)
* Manages long-term maintenance contracts for corporate boardrooms, auditoriums, and colleges.
* Tracks contract start/end dates, agreed scheduled preventive maintenance visits (e.g., quarterly visits), and priority breakdown call response SLAs.

---

## 3. Equipment Rental Subsystem (ICON TECH PRO)

Designed specifically for event AV rentals, corporate summit setups, temporary projector installations, and high-end sound system leasing.

```
[ Inbound Rental Enquiry ]
            |
            v
+---------------------------------------+
| 1. Rental Quotation (RNT-Q-YY-XXXX)   |-----> [ Daily / Weekly / Monthly Rates ]
+---------------------------------------+
            |
            v
+---------------------------------------+
| 2. Rental Agreement & Security Deposit|-----> [ Terms, Refundable Deposit, Identity ]
+---------------------------------------+
            |
            v
+---------------------------------------+
| 3. Serialized Asset Allocation        |-----> [ Lock Serials from Rental Fleet ]
+---------------------------------------+
            |
            v
+---------------------------------------+
| 4. Outward Dispatch & Delivery Challan|-----> [ Status: "RENTED_OUT" ]
+---------------------------------------+
            |
            v
+---------------------------------------+
| 5. Return Inspection & QA Audit       |-----> [ Optical, Audio, Cosmetic Check ]
+---------------------------------------+
            |
            +-----------------------------------+
            | Any Damage or Missing Items?      |
            | NO                                | YES
            v                                   v
+-----------------------------------+   +-----------------------------------+
| 6A. 100% Security Deposit Refund  |   | 6B. Deduct Damage Surcharge       |
|     Issue Final Rental Invoice    |   |     Issue Repair / Penalty Bill   |
+-----------------------------------+   +-----------------------------------+
            |                                   |
            +-----------------+-----------------+
                              |
                              v
                  +=======================+
                  |  RENTAL SETTLEMENT    |
                  +=======================+
```

### 3.1 Rental Fleet Master (Asset Isolation)
* Rental items are tagged as internal company assets rather than trade inventory for resale.
* Each piece of rental equipment (e.g. 10,000 Lumen Projectors, 86" Mobile IFP Displays, Line-Array Sound Towers) has a unique physical barcode/serial number, asset tag, and historical utilization log.

### 3.2 Security Deposit & Damage Control
* **Agreement Creation:** Defines hire period, daily/weekly rate, transit insurance, and mandatory refundable security deposit.
* **Return QA Inspection:**
  * Upon return, warehouse inspection assesses lamp hours, display pixel health, physical scratches, and bundled cables.
  * In case of damage, system calculates repair fees and automatically offsets them against the customer's held security deposit.
