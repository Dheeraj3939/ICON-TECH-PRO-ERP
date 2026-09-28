# ICON TECH PRO ERP — Master 15–20 Minute Team Presentation Script

**Presentation Target**: ICON TECH PRO Leadership & Operational Teams  
**Audience**: Managing Director (Narsimha Naidu), Admin/BDM (Dheeraj), BDM (Vineet Babu), Sales Executives (Reshma), Accounts (Hemalatha), Office Operations (Manisha)  
**System URL**: [`http://localhost:3000`](http://localhost:3000)  
**Canonical Account**: `DEMO — Swan Technologies Pvt Ltd` (`DEMO-ICON260099`)  
**Presenter Tool**: Top Dock &bull; **Live Demo Quick-Jump Bar**

---

## Presentation Ground Rules (Before You Start)

### ⚠️ WHAT NOT TO TOUCH DURING THE DEMO
1. **DO NOT** execute manual SQL queries or modify database tables.
2. **DO NOT** click or attempt to run database migrations.
3. **DO NOT** expose `.env` files or print server secrets.
4. **DO NOT** send mass blast emails (use the single controlled test email).
5. **DO NOT** claim that Tally is syncing live to a remote cloud server when the local Tally bridge is offline; explain the **Secure Sync Queue** and **TallyPrime 7+ JSON** architecture honestly.
6. **DO NOT** edit core company GSTIN or master seed IDs.

---

## Act 1: Introduction & Command Center (Minutes 0 – 3)

### Step 1: Login & The Command Center
- **Where to Navigate**: Go to `http://localhost:3000/login`
- **What to Click**: Click on **Dheeraj — Admin / BDM**
- **Expected Result**: Authenticates instantly into `/dashboard` with authoritative connection badge: `LIVE / CONNECTED • Hyderabad Cloud (ap-south-1)`.
- **What to Show**:
  - Point to the top floating **Live Demo Mode** bar with 18 quick-jump targets.
  - Point to the financial KPI cards:
    - *Pending Receivables*: ₹1,56,940
    - *Confirmed Orders*: ₹1,56,940
    - *Total Collections*: ₹1,56,940
  - Point to the Attention & Risk Radar.
- **What to Say**:
  > *"Good morning team. Today we are presenting the new ICON TECH PRO ERP. This is not a generic accounting tool or a disconnected CRM. It is built specifically for our business model as a technology reseller and systems integrator.*  
  > *From presales site measurement to multi-distributor procurement, serial number dispatch, GST billing, and TallyPrime 7.0 integration — every department works on a single authoritative database."*

---

## Act 2: Presales Lead Capture & Customer 360 (Minutes 3 – 6)

### Step 2: Logging an Enquiry (The Hardened Flow)
- **What to Click**: Click the **Log Lead** button in the Command Center header.
- **Expected Result**: The newly hardened `NewEnquiryModal` opens.
- **What to Show**:
  - Show that the modal has smooth inner vertical scrolling (`max-h-[90vh]`) — no fields or buttons are cut off.
  - Fill in sample details:
    - *Customer*: Rajesh Sharma
    - *Company*: Swan Technologies Pvt Ltd
    - *Phone*: `8099909921`
    - *Category*: Interactive Flat Panel / Laser Projector
    - *Budget*: ₹1,50,000
    - *Site Survey*: Check `[x] On-Site Measurement Required`
- **What to Click**: Click **Create Enquiry & Set Follow-up**.
- **Expected Result**: Form does NOT vanish or redirect. Instead, the **Enquiry Successfully Registered** confirmation card appears showing:
  - Generated Enquiry Number: `ENQ-26-XXXX`
  - Linked Customer: `Swan Technologies Pvt Ltd` (`DEMO-ICON260099`)
  - Auto-Deduplication badge: Reused existing customer dossier.
- **What to Say**:
  > *"Notice how the system detected Swan Technologies by phone number and prevented creating a duplicate customer. It linked the lead directly to Swan's existing account and scheduled our 48-hour presales follow-up."*

### Step 3: Customer 360 View
- **What to Click**: On the top Demo Dock, click **2. Customer 360**.
- **Expected Result**: Opens `/dashboard/customers/DEMO-ICON260099`.
- **What to Show**:
  - The complete cross-department dossier: Contacts, Presales Enquiries, Site Visits, Quotations, Sales Orders, Dispatch Challans, Installed Assets, Serial Numbers, Tax Invoices, and AMC Contracts.
- **What to Say**:
  > *"Any team member — whether in sales, service, or accounts — can open Customer 360 and understand the entire 360-degree history of this client in under five seconds."*

---

## Act 3: Commercial Proposal & Mandatory Review Gate (Minutes 6 – 10)

### Step 4: Quotation Register & PDF Proposal
- **What to Click**: On the top Demo Dock, click **4. Quotations**.
- **Expected Result**: Opens `/dashboard/quotations`. Shows proposal `DEMO-QT260099`.
- **What to Click**: Click **View / Print** on `DEMO-QT260099`.
- **Expected Result**: Opens the official A4 Commercial Proposal modal with ICON TECH PRO branding, HSN breakdown, bank details, and digital stamp.

### Step 5: The Mandatory Quotation Review Gate
- **What to Show**:
  - Point to the amber banner at the top of the modal:
    > **Quotation Review Gate & Human Verification**  
    > Customer: Swan Technologies &bull; Total: ₹1,56,940 &bull; Margin: 19.3%
  - Point to the bottom action bar: notice that **Send Email** and **Send WhatsApp** are **disabled**.
- **What to Say**:
  > *"In our business, sending an unverified draft quotation or incorrect tax breakdown can lead to legal and financial disputes. In our ERP, no quotation can ever be sent directly from a draft. It requires mandatory PDF preview and human verification."*
- **What to Click**: Check the box: `[x] I have verified this quotation`, then click **Approve & Continue**.
- **Expected Result**: Status badge changes to `Verified & Approved` (green check). The **Send Email** and **Send WhatsApp** buttons immediately unlock!

### Step 6: Multi-Channel Dispatch (Zoho Mail & WhatsApp)
- **What to Click**: Click **Send Email**.
- **Expected Result**: Opens `SendQuotationEmailModal`.
  - Shows sender identity: `Dheeraj <dheeraj@icontechpro.in>`.
  - Shows customer recipient: `purchase@swantech.in`.
  - Shows attached official PDF: `DEMO-QT260099_Proposal.pdf`.
- **What to Click**: Click **Send Quotation Email**.
- **Expected Result**: Shows green success check: *"Quotation Email Queued Successfully"*.
- **What to Click**: Click **Send WhatsApp**.
- **Expected Result**: Opens `SendQuotationWhatsAppModal` showing business phone `8099909921` and pre-approved Meta template.
- **What to Say**:
  > *"Every proposal dispatch is tracked in our Communication Outbox with the exact timestamp, sender identity, and attached document for complete auditability."*

---

## Act 4: Reseller Operations, Dispatch & Site Handover (Minutes 10 – 14)

### Step 7: Sales Order & Procurement
- **What to Click**: On the top Demo Dock, click **8. Sales Order**.
- **Expected Result**: Shows confirmed order `DEMO-ORD260099` linked to Customer PO `SWAN/PO/2026/089`.
- **What to Say**:
  > *"When the customer issues their PO, one click converts the quotation into a confirmed sales order. The system checks warehouse stock and automatically generates distributor backorders if inventory is needed."*

### Step 8: Dispatch & Serial Tracking
- **What to Click**: On the top Demo Dock, click **11. Dispatch Challan**.
- **Expected Result**: Shows Delivery Challan `DEMO-DSP260099`.
- **What to Show**: Serial number `OPT-4K-984210` tagged directly to the delivery van.

### Step 9: Site Installation & Warranty Activation
- **What to Click**: On the top Demo Dock, click **12. Installation Job**.
- **Expected Result**: Opens `/dashboard/installations` showing Job Card `DEMO-INS260099`.
- **What to Show**:
  - Pre-installation technical checklist (Wall bracket, 4K HDMI test, keystone calibration).
  - Customer handover sign-off by IT Manager Rajesh Sharma.
- **What to Say**:
  > *"The moment the customer signs the installation handover, the system automatically initiates the 1-year manufacturer warranty and registers the equipment into our Service & AMC database."*

---

## Act 5: Billing, Finance & TallyPrime 7+ Integration (Minutes 14 – 18)

### Step 10: GST Tax Invoice & NEFT Receipt
- **What to Click**: On the top Demo Dock, click **13. Tax Invoice**.
- **Expected Result**: Shows B2B GST Invoice `DEMO-INV260099` with dual tax split (CGST 9% ₹11,970 + SGST 9% ₹11,970 = ₹1,56,940).
- **What to Click**: On the top Demo Dock, click **14. Payment Receipt**.
- **Expected Result**: Shows payment receipt `DEMO-PAY260099` allocated against invoice `DEMO-INV260099` (Remaining Balance: ₹0).

### Step 11: TallyPrime 7+ Integration Center
- **What to Click**: On the top Demo Dock, click **18. Tally Integration**.
- **Expected Result**: Opens the new 13-tab Tally Integration Center at `/dashboard/tally`.
- **What to Show**:
  1. Point to the diagnostic banner:
     > `TALLY BRIDGE NOT CONNECTED • Endpoint: http://localhost:9000`
     Explain the **Zero-Fake Guarantee** — we never fake a live connection when the local bridge is offline.
  2. Click **Generate Test JSON**: Show the live TallyPrime 7.0 JSON structure for Sales Invoice `DEMO-INV260099` with bill allocations (`New Ref`).
  3. Click **Customers (Ledgers)** tab &rarr; click `Preview Customer JSON`: Show how `Swan Technologies Pvt Ltd` is mapped to `Sundry Debtors` with GSTIN `36AAACS1429B1Z8`.
  4. Click **Reconciliation** tab: Show the two-way reconciliation table where closing balances match with **₹0.00 variance**.
- **What to Say**:
  > *"With this integration, our accounts team will never have to manually re-type customer names, GST numbers, or invoice amounts into Tally again. Double-entry is completely eliminated."*

---

## Act 6: Role QA & Security Wrap-Up (Minutes 18 – 20)

### Step 12: Demonstrating Role-Based Privacy
- **What to Show**:
  - Log out and log in as **Reshma — Sales Executive**.
  - Navigate to `/dashboard/products` or `/dashboard/quotations`.
  - Point out that **Purchase Price** and **Internal Margin** are strictly masked to `₹0` and `0%`.
- **What to Say**:
  > *"Our sales executives have all the tools to serve customers and quote fast, but our proprietary vendor purchase costs and distributor margins remain 100% confidential."*

---

## Presenter Closing Statement
> *"Team, this completes the end-to-end walkthrough of ICON TECH PRO ERP. The system is verified across 175 automated tests, 0 TypeScript errors, and 37 cleanly compiled production routes. We are ready to roll this out into daily operations."*
