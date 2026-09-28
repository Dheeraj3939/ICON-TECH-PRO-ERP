# ICON TECH PRO ERP - Business & System Requirements Specification

## 1. Executive Summary & Organizational Context

### 1.1 Company Profile
* **Company Name:** ICON TECH PRO
* **Tagline/Positioning:** Unified Solutions Specialist
* **Headquarters:** Hyderabad, Telangana, India
* **Primary Business Focus:** Design, supply, integration, installation, and maintenance of high-end Audio-Visual (AV), IT Hardware & Infrastructure, Networking, Security, Acoustics, and Smart Automation solutions. Single-business entity operation.

### 1.2 Purpose of the ERP/CRM System
The ICON TECH PRO ERP is an enterprise-grade, integrated Enterprise Resource Planning and Customer Relationship Management platform. The platform centralizes operations across the entire enterprise lifecycle:
1. Lead & Enquiry Ingestion (Omnichannel)
2. Lead Qualification & Customer Master Management (Company vs. Individual)
3. Presales Technical Assessment (Site Visits & Feasibility Surveys)
4. Quotation Engineering, Multi-tier Pricing, & Approval Flows
5. Sales Order Execution & Real-time Material Reservation
6. Multi-warehouse Inventory, Batch/Serial Number Tracking & Movements
7. Procurement, Vendor Evaluation, & Purchase Order Lifecycle
8. Indian GST Compliant Invoicing, E-Way Bill Readiness, & Accounts Receivable
9. Logistics, Packaging, Dispatch & Material Gate Pass Management
10. Field Deployment, Installation, Testing & Commissioning Handover
11. After-sales Service Ticketing, AMC Management, & Preventive Maintenance
12. Equipment Rental Lifecycle (Contracting, Asset Allocation, Inspection, Invoicing)
13. Executive Dashboards, Real-time Operational KPIs, & Audit Logs

---

## 2. Business Scope & Functional Modules

```
+--------------------------------------------------------------------------------------------------+
|                                    ICON TECH PRO ERP ECOSYSTEM                                   |
+--------------------------------------------------------------------------------------------------+
|  CRM & PRESALES           OPERATIONS & FULFILLMENT     FINANCE & ACCOUNTS      SERVICES & RENTAL  |
|  - Leads / Enquiries      - Sales Orders               - GST Tax Invoices      - Service Tickets  |
|  - Customer Master        - Inventory Control          - Proforma Invoices     - AMC Contracts    |
|  - Site Surveys           - Serial/Barcode Tracking    - Payments (In/Out)     - Rental Contracts |
|  - Quotation Builder      - Purchase Requisitions      - Accounts Receivable   - Asset Dispatch   |
|  - Follow-up Tracker      - Purchase Orders            - Accounts Payable      - Returns & Damage |
|  - Win/Loss Analytics     - Dispatch & Gate Pass       - Tally Sync Readiness  - Prevent. Maint.  |
|                           - Installation Management                                              |
+--------------------------------------------------------------------------------------------------+
|                                CORE ARCHITECTURE & INFRASTRUCTURE                                |
|  RBAC Security Matrix  |  Audit Trails  |  Document Vault  |  Real-time Alerts  |  Executive KPI |
+--------------------------------------------------------------------------------------------------+
```

### 2.1 Complete Module Index (26 Core Modules)

1. **Enquiries / Leads:** Multi-channel ingestion (direct walk-in, phone, referral, website, tenders) with status transitions, lead scoring, and sales executive allocation.
2. **Customer Master:** Central repository supporting polymorphic data models for Corporate (B2B) and Individual (B2C) entities.
3. **Company Customers (B2B):** Corporate entity profiles containing GSTIN validation, PAN, corporate designations, multiple billing/shipping addresses, and trade credit limits.
4. **Individual Customers (B2C):** Residential/individual profiles containing localized personal details, delivery addresses, and personalized solution preferences.
5. **Salespersons & Staff:** Field executive profiles, quota targets, commission tracking, performance scoring, and role bindings.
6. **Site Visits & Technical Feasibility:** Pre-quotation engineering surveys with geo-tagging, site photos, dimensional schematics, electrical/acoustic checklists, and technician assignment.
7. **Follow-ups & Interaction History:** Chronological log of client touchpoints (calls, emails, meetings, WhatsApp notes), automated next-action scheduling, and escalation triggers.
8. **Quotations & Proposals:** Multi-revision quotation engine supporting line-item level discounting, tax calculations (CGST+SGST / IGST), margin analysis, standard terms, and dynamic PDF generation.
9. **Sales Orders:** Formal binding commitments converted from approved quotations, triggering financial locking, inventory reservations, and delivery milestones.
10. **Product Catalog:** Hierarchical product database (Category, Subcategory, Brand, Model, SKU, HSN/SAC, Unit of Measurement, Warranty, Minimum/Maximum Selling Price).
11. **Inventory & Warehouse:** Real-time stock visibility across multiple physical warehouses, racks, and bins with auto-calculated metrics (Opening, Current, Reserved, Available, In-Transit).
12. **Procurement & Purchases:** Automated procurement triggers from backorders, purchase requisition workflow, vendor POs, goods receipt notes (GRN), and supplier bills.
13. **Supplier / Vendor Master:** Supplier rating, payment terms, credit limits, bank coordinates, GSTIN details, and procurement history.
14. **Invoicing & Billing:** GST-compliant Tax Invoices, Proforma Invoices, Delivery Challans, and Credit/Debit Notes with Telangana state code (36) logic.
15. **Payment Tracking & Cash Flow:** Reconciliation of advances, milestone payments, outstanding balances, aging analysis, and payment mode capture (NEFT/RTGS, UPI, Cheque, Cash).
16. **Logistics & Dispatch:** Material staging, packaging inspection, serial number allocation at dispatch, Delivery Challan generation, and vehicle tracking.
17. **Installation & Commissioning:** Post-delivery engineering workflow, field technician task assignment, milestone testing sign-off, and customer handover certificates.
18. **Service & Complaints Management:** Ticket tracking, warranty validation, RMA (Return Merchandise Authorization), component repairs, and on-site resolution under ICON TECH PRO.
19. **Equipment Rental Management:** Rental quotation, duration agreements, refundable security deposits, serial-allocated asset dispatch, return inspections, and damage assessment billing under ICON TECH PRO.
20. **Executive Dashboards:** Role-specific operational interfaces showing live KPIs, pipeline velocity, revenue forecasting, inventory turnover, and urgent actions.
21. **Reporting & Business Intelligence:** Granular financial reports, sales conversion funnels, stock valuation reports, technician productivity, and GST summary reports (GSTR-1, GSTR-3B preparation).
22. **Employee & Team Directory:** Internal staff directory with departmental alignment, designation, contact information, and access credentials.
23. **User Roles & Granular Permissions:** Role-Based Access Control (RBAC) governing read, write, edit, delete, and approve permissions down to module and field levels.
24. **Document Vault & Attachments:** Encrypted digital storage for site survey photos, signed contracts, purchase orders, customer approvals, warranty cards, and tax documents.
25. **Notifications & Alerts:** Real-time in-app alerts and webhook hooks for quotation expiry, low stock thresholds, overdue follow-ups, payment milestones, and order dispatch.
26. **Audit Logs & Compliance:** Immutable system ledger capturing every CRUD action, timestamp, IP address, user ID, and before-and-after state changes.

---

## 3. Product Categories & Technical Scope

ICON TECH PRO specializes in diverse, complex technologies requiring distinct technical attributes (specifications, warranty periods, installation kits, serial number tracking):

1. **Projector:** High-lumen laser projectors, 4K home theater projectors, ultra-short throw, ceiling mounting kits, and projection screens (motorized/fixed).
2. **Home Theater:** Multi-channel surround sound processors, AV receivers, power amplifiers, subwoofers, and acoustic optimization.
3. **AV Solution:** Audio-visual matrix switchers, video wall processors, HDMI/HDBaseT extenders, wireless presentation devices, and motorized podiums.
4. **Acoustic:** Acoustic wall paneling, bass traps, soundproofing insulation, ceiling baffles, and fabric stretch systems.
5. **Printer:** Enterprise multi-function laser printers, photo printers, plotters, scanners, and toner consumables.
6. **Laptop & Desktop:** Commercial laptops, CAD/Engineering workstations, all-in-one PCs, and thin clients.
7. **Interactive Boards:** Interactive flat panels (IFP 65", 75", 86"), digital whiteboards, OPS Windows modules, and mobile motorized stands.
8. **CCTV:** IP dome/bullet cameras, PTZ surveillance, Network Video Recorders (NVR), AI analytics cameras, and hard drives.
9. **Servers:** Rack/Tower enterprise servers, RAID storage arrays, Network Attached Storage (NAS), and server racks/enclosures.
10. **Board Room Solution:** Integrated conferencing bars (e.g. Poly, Logitech, Neat), tabletop beamforming microphone arrays, PTZ cameras, and room scheduling panels.
11. **LED:** Fine-pitch indoor active LED video walls, outdoor rental LED displays, LED sending/receiving cards, and video processors.
12. **Display Solution:** Commercial signage displays (24/7 rated), touch kiosks, stretch displays, and menu boards.
13. **EPABX:** IP PBX systems, hybrid telephone exchanges, VoIP phones, PRI gateways, and intercom systems.
14. **Access Points:** Enterprise Wi-Fi 6/6E/7 access points, wireless controllers, outdoor long-range APs.
15. **Biometric Solution:** Facial recognition terminals, optical/capacitive fingerprint scanners, RFID card readers, and access control electromagnetic door locks.
16. **Networking:** Managed Layer 2/Layer 3 switches, PoE+ switches, edge routers, fiber optic transceivers, patch panels, and server rack cabling.
17. **Software Solution:** Antivirus software, OS volume licenses, conferencing software licenses (Zoom Rooms, MS Teams Rooms), and custom integrations.
18. **UPS & Batteries:** Online double-conversion UPS systems (1 kVA to 40 kVA), tubular/lithium-ion battery banks, and isolation transformers.
19. **Sound Systems:** Commercial PA systems, zone amplifiers, ceiling speakers, column speakers, and line array systems.
20. **Home Automation:** Smart lighting controllers, motorized curtain tracks, smart relays, touch switches, and smart home hub integration.
21. **Installation:** Professional deployment, physical mounting, structured cabling, conduit routing, testing, and commissioning labor services.
22. **Others:** Custom brackets, auxiliary cables (XLR, Speakon, CAT6, HDMI), connectors, and consumables.

---

## 4. Single Entity Architecture: ICON TECH PRO

A foundational business architectural rule:
* **ICON TECH PRO (`ORG-ICON-01`):** The ERP operates strictly as a single-business enterprise system for ICON TECH PRO.
* All business capabilities — including Commercial Sales, Turnkey AV/IT Integration, Procurement, Dispatch, Installation, Service Ticketing, AMC Management, and Equipment Rentals — are owned and operated directly under ICON TECH PRO.
* Transactional numbering across all modules follows the standardized `ICON/26-27/...` schema.

---

## 5. Compliance & Statutory Specifications (Indian Context)

1. **GST Architecture:**
   * **Intra-State Transactions:** Customer location in Telangana (State Code 36) -> Equal split of CGST and SGST (e.g., 9% CGST + 9% SGST for an 18% slab).
   * **Inter-State Transactions:** Customer outside Telangana -> Full IGST levied (e.g., 18% IGST).
   * **HSN/SAC Validation:** Mandatory 6 or 8-digit HSN codes for goods and 6-digit SAC codes for installation/service labor.
   * **Reverse Charge Mechanism (RCM):** Flag for applicable procurement line items.
2. **E-Way Bill & E-Invoice Readiness:**
   * Data structures must store Vehicle Number, Transporter ID, Transporter Name, Distance in KM, and Dispatch Location for generating IRN and E-Way bill payloads.
3. **PAN & GSTIN Validation:**
   * Standard 15-character alphanumeric GSTIN validation with state code checksum verification.
   * Automated extraction of 10-character PAN from GSTIN (chars 3 to 12).
