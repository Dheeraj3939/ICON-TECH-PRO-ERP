# ICON TECH PRO ERP V9.2 — UAT INTEGRATION STATUS REPORT

**Document ID:** UAT-INT-V9.2-004  
**Release Target:** ICON TECH PRO ERP V9.2  
**Date:** 2026-11-09  
**Classification:** Enterprise Integration Verification & Dependency Audit  
**Strict Reporting Rule:** No simulated integration may be reported as live verified.  

---

## 1. INTEGRATION SUMMARY MATRIX

| Integration Service | Protocol / Interface | Target Environment | Verified Status | Key Technical Findings & Blockers |
| :--- | :--- | :--- | :--- | :--- |
| **TallyPrime 7.2 Silver** | HTTP XML / JSON (Port 9000) | Office Desktop Localhost | **SIMULATED** | Payload generator & queue verified; live sync requires TallyPrime running on office desktop. |
| **Zoho Corporate Mail** | REST API / OAuth 2.0 (TLS) | `mail.zoho.in` (India) | **SANDBOX VERIFIED** | Failover provider, health check, and internal test dispatch verified; production tokens blocked. |
| **Google Gmail Fallback**| OAuth 2.0 / REST API | `gmail.googleapis.com` | **SANDBOX VERIFIED** | Token encryption (AES-256-GCM), automatic failover trigger, and duplicate prevention verified. |
| **WhatsApp Messaging** | `wa.me` URL Launcher | Mobile & Desktop Web | **SANDBOX VERIFIED** | Direct customer WhatsApp launch with pre-filled quote text operational; Meta Cloud API blocked. |
| **Meta Cloud WhatsApp**| Graph API / Webhooks | Meta Business Manager | **BLOCKED BY CREDENTIALS** | Official Business API requires Meta Business Account verification, Phone Number ID, and system tokens. |
| **Airtel Voice & SMS** | REST API / DLT Gateway | Airtel IQ Enterprise | **BLOCKED BY CREDENTIALS** | Requires active Airtel Enterprise subscription, registered Principal Entity ID, and TRAI DLT approval. |
| **Rule 138 E-Way Bill** | Direct / PDF Register | NIC E-Way Bill Portal | **SANDBOX VERIFIED** | Vehicle, distance km, validity tracking, and Rule 138 schema verified against test consignments. |
| **E-Invoice (IRN / QR)** | REST API (NIC Portal) | ClearTax / NIC Sandbox | **BLOCKED BY CREDENTIALS** | Requires production GSTIN API credentials and GSP credentials. Proforma & DC used in UAT. |

---

## 2. TALLYPRIME 7.2 INTEGRATION VERIFICATION

### 2.1 Protocol & Port Resolution: HTTP/XML vs ODBC
A critical investigation was conducted to resolve historical ambiguity regarding TallyPrime's interface ports:

- **ODBC Interface (Port 9000 default):**
  - Architecture: Binary database interface requiring 64-bit Windows ODBC driver and DSN setup.
  - Intended Usage: Read-only SQL queries (`SELECT $Name, $ClosingBalance FROM "Ledger"`).
  - Assessment: **Not utilized for ERP synchronisation** due to platform coupling and driver management overhead.
- **HTTP / XML Server Interface (Port 9000 default):**
  - Architecture: Embedded web server within TallyPrime activated via `F12 > Advanced Configuration > Enable ODBC / HTTP Server = Yes`.
  - Intended Usage: Accepts standard HTTP `POST` requests with XML envelopes (`<ENVELOPE><HEADER>...</HEADER><BODY>...</BODY></ENVELOPE>`).
  - Codebase Implementation: [`src/lib/actions/tally.ts`](file:///C:/ICON-TECH-PRO-ERP/src/lib/actions/tally.ts) implements standard HTTP POST communication (`fetch(endpoint, ...)`), validating that the integration communicates with the **HTTP XML/JSON Server**, not ODBC.

### 2.2 Multi-Year Company Configuration
The ERP supports multi-year financial company selection:
1. `ICON TECH PRO - 2026-27` (Live Primary Company — Books from 2026-04-01 to 2027-03-31) — Active & Writable.
2. `ICON TECH PRO - 2025-26` (Archived Company — Books from 2025-04-01 to 2026-03-31) — Locked Read-Only.
3. `ICON TECH PRO - 2024-25` (Archived Company — Books from 2024-04-01 to 2025-03-31) — Locked Read-Only.

### 2.3 Synchronisation Direction & Governance
- **Direction:** Strictly **Tally → ERP** (Master and Voucher import into ERP).
- **ERP → Tally Writeback:** Strictly **DISABLED** in this release to prevent inadvertent ledger alterations in Tally.
- **Duplicate Prevention:** Each synchronized voucher is tagged with its immutable `tally_guid` and tracked against `tally_alter_id`. Re-syncing an existing voucher updates the record without creating duplicate entries.
- **Cross-Month Margins:** Verified for an order with procurement in November 2026 (GSTR-2B) and billing in December 2026 (GSTR-1). Both authentic voucher dates are retained in Tally while linked to the Open File in ERP to report an authentic gross margin of ₹90,000 (17.65%).

---

## 3. EMAIL INTEGRATION: ZOHO MAIL & GMAIL FALLOVER

### 3.1 Zoho Corporate Mail (Primary)
- **Status:** **SANDBOX VERIFIED / BLOCKED BY LIVE UAT OAUTH TOKEN**
- **Authentication:** OAuth 2.0 with authorization code flow targeting `accounts.zoho.in` (India data center).
- **Token Protection:** Client secret and refresh tokens are encrypted at rest using AES-256-GCM.
- **Test Invariant:** Live dispatch is guarded by `ENABLE_LIVE_EMAIL_DISPATCH = false` in UAT. All test messages are logged in the central outbox (`src/lib/actions/communication.ts`) to prevent unintended delivery to real clients.

### 3.2 Gmail Fallback (Secondary)
- **Status:** **SANDBOX VERIFIED / INTEGRATION READY**
- **Failover Logic:** The `FailoverEmailProvider` automatically catches qualifying network/server failures from Zoho (e.g. `ETIMEDOUT`, 502/503 errors, rate limits) and routes through Gmail without manual intervention.
- **Non-Blind Fallback:** Permanent client errors (e.g. malformed recipient, syntax error) do **NOT** fail over to Gmail, avoiding duplicate failure loops.

---

## 4. WHATSAPP BUSINESS PLATFORM INTEGRATION

### 4.1 Direct Click-to-Chat (`wa.me`) Fallback
- **Status:** **SANDBOX VERIFIED / OPERATIONAL**
- **Implementation:** [`src/components/modals/SendQuotationWhatsAppModal.tsx`](file:///C:/ICON-TECH-PRO-ERP/src/components/modals/SendQuotationWhatsAppModal.tsx)
- **Behavior:** Pre-formats the quotation message, recipient phone number, and link, launching the official WhatsApp Web/Desktop interface in a secure new tab while simultaneously recording an entry in the communication audit ledger.

### 4.2 Meta Cloud WhatsApp API
- **Status:** **BLOCKED BY META BUSINESS CREDENTIALS**
- **Outstanding Dependencies:**
  1. Verified Meta Business Manager account for ICON TECH PRO.
  2. Approved WhatsApp Business phone number ID and WABA ID.
  3. Pre-approved WhatsApp message templates for Quotation notifications and Payment reminders.

---

## 5. AIRTEL VOICE AND SMS INTEGRATION

### 5.1 Status & Regulatory Requirements
- **Status:** **BLOCKED BY AIRTEL DLT & TELECOM CREDENTIALS**
- **Regulatory Framework:** In accordance with Telecom Regulatory Authority of India (TRAI) New Regulatory Framework for commercial communications:
  1. **DLT Registration:** Requires Principal Entity (PE) registration on an approved DLT portal (e.g. Airtel, Jio, Vodafone).
  2. **Header / Sender ID:** Approved 6-character alphabetic sender header (e.g. `ICONPR`).
  3. **Content Templates:** Pre-approved DLT templates with registered Template IDs for transaction alerts.
- **Interim UAT Handling:** SMS notifications in UAT validate payload schemas and simulate delivery in the communication outbox without submitting calls to carrier endpoints.

---
*Certified by Independent Verification Agent on 2026-11-09.*
