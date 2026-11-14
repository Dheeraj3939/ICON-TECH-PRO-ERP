# ICON TECH PRO ERP V9.2 — CONSOLIDATED REQUIRED BUSINESS DECISIONS & CLARIFICATIONS

**Document Version:** 1.0.0  
**Date:** 2026-11-05  
**Project:** ICON TECH PRO ERP  
**Repository:** `C:\ICON-TECH-PRO-ERP`  
**Official ERP URL:** `https://erp.icontechpro.in`  
**Execution Phase:** Audit & Discovery Gate  
**Note:** TallyPrime integration is strictly **ON HOLD** and is deliberately excluded from this document.

---

## 1. OVERVIEW & CLARIFICATION POLICY

In strict compliance with the project directive, this document collects **ONLY genuinely missing business decisions** that materially affect production operation. 

Every question below includes:
1. Exact operational question.
2. Why the decision is required.
3. Available options.
4. Recommended safe default.
5. Blocker status (whether it blocks cutover or can safely use the recommended default).

---

## 2. CONSOLIDATED BUSINESS DECISIONS

### Decision 1: Live Production Email Dispatch Provider
- **Context:** The ERP contains production-grade integrations for both **Zoho Mail Enterprise** (`src/lib/integrations/zoho/mail-client.ts`) and **Google Workspace / Gmail API** (`src/lib/integrations/gmail-token.ts`), in addition to standard transactional SMTP.
- **Exact Question:** When `ENABLE_LIVE_EMAIL_DISPATCH=true` is activated for production, which provider should serve as the primary authoritative outbound transactional channel for client quotations, tax invoices, password resets, and automated executive briefings?
- **Why Required:** The dispatch engine needs to know the authoritative routing priority to ensure high deliverability and avoid SPF/DKIM alignment mismatches on outbound client emails.
- **Available Options:**
  - **Option 1A:** **Zoho Mail Enterprise API** (Uses corporate Zoho Workspace domain credentials).
  - **Option 1B:** **Google Workspace / Gmail API** (Uses corporate Google Workspace OAuth credentials).
  - **Option 1C:** **Cascading Primary/Fallback** (Attempt Zoho Mail first; on temporary rate limit or error, automatically cascade to Google Workspace).
- **Recommended Default:** **Option 1C (Cascading Primary/Fallback: Zoho Mail primary with Gmail fallback)**.
- **Blocker Status:** **Non-blocking for build/deployment; blocks live email transmission.** (If unselected, system runs in durable queue-logging mode without dispatching to real external inboxes).

---

### Decision 2: Scheduled Executive Report Recipient Distribution Lists
- **Context:** The system includes 6 automated executive reporting cadences (`src/lib/actions/scheduled-reports.ts`) triggered at 00:00 Asia/Kolkata:
  1. *Daily Sales & Collections Briefing*
  2. *Weekly Operations & Site Visit Review*
  3. *Monthly Accounts Receivables & P&L Summary*
  4. *Quarterly Executive Performance Review*
  5. *Half-Yearly Business Strategy Review*
  6. *Annual Financial & Statutory Summary*
- **Exact Question:** What email addresses or group aliases should be designated as official recipients for each of the 6 report schedules?
- **Why Required:** To ensure automated financial summaries and operational metrics reach the appropriate executives without broadcasting sensitive company data to unauthorized staff.
- **Available Options:**
  - **Option 2A (Dynamic Company Settings):** Automatically route Daily/Weekly reports to the Managing Director and designated Sales Admin email; route Monthly/Quarterly/Annual financial summaries strictly to the Managing Director and Accounts Head based on Company Settings.
  - **Option 2B (Static Distribution Aliases):** Bind reports to static Google/Zoho group distribution aliases (e.g. `management@icontechpro.in` and `finance@icontechpro.in`).
- **Recommended Default:** **Option 2A (Dynamic Company Settings based on employee designations and MD email)**.
- **Blocker Status:** **Non-blocking.** (Option 2A is fully functional and uses existing Company Settings).

---

### Decision 3: Multi-Factor Authentication (MFA) Company-Wide Rollout Policy
- **Context:** Multi-Factor Authentication (RFC 6238 TOTP) is fully implemented in `src/lib/security/mfa-service.ts` with standard 6-digit codes, inline SVG QR code display, and 8 single-use PBKDF2 hashed backup codes.
- **Exact Question:** What should be the company-wide enforcement policy and rollout timeline for MFA across employee accounts?
- **Why Required:** Balancing rigorous enterprise cybersecurity with operational field efficiency for sales staff and site technicians.
- **Available Options:**
  - **Option 3A (Phased Enterprise Enforcement):** MFA is mandatory immediately upon cutover for privileged roles (**Managing Director**, **Administrator**, **Accounts**). Salespersons and Field Engineers receive a **14-day grace period** to enroll their authenticator app before enforcement locks the account.
  - **Option 3B (Immediate Organization-Wide Mandatory):** All employees must enroll TOTP MFA on their very first login following cutover; no login allowed without enrollment.
  - **Option 3C (Optional Self-Service):** MFA remains an optional security upgrade configurable under User Profile Security Settings.
- **Recommended Default:** **Option 3A (Phased Enterprise Enforcement: Mandatory immediately for MD, Admin, and Accounts; 14-day grace period for field staff)**.
- **Blocker Status:** **Non-blocking.** (The system is configured to support Option 3A by default).

---

### Decision 4: WhatsApp Customer Communication Channel
- **Context:** Field sales engineers frequently send quotation links, site visit summaries, and delivery notices to customers via WhatsApp. The UI currently implements `SendQuotationWhatsAppModal.tsx`, which generates pre-formatted `https://wa.me/?text=...` deep-links for field staff devices.
- **Exact Question:** Should ICON TECH PRO maintain the field-friendly WhatsApp Click-to-Chat deep-link model, or register an official Meta WhatsApp Business Cloud API number for automated headless background dispatch?
- **Why Required:** Meta WhatsApp Cloud API requires Facebook Business Manager verification, dedicated phone number onboarding, pre-approved message templates, and per-conversation messaging fees.
- **Available Options:**
  - **Option 4A (Field Click-to-Chat Deep-Links):** Maintain the existing `wa.me` links. Field engineers click the button to open their native WhatsApp app with pre-filled professional text and quotation links. Zero setup delay, zero API fees.
  - **Option 4B (Direct Meta Cloud API):** Onboard a dedicated Meta Business API number to dispatch automated background messages without opening the user's WhatsApp app.
- **Recommended Default:** **Option 4A (Field Click-to-Chat Deep-Links for immediate V9.2 release; evaluate Meta Cloud API for a future minor upgrade)**.
- **Blocker Status:** **Non-blocking.** (Option 4A is already fully implemented and verified).

---

### Decision 5: Order-Driven Reseller Inventory Operating Model Confirmation
- **Context:** ICON TECH PRO operates primarily as a project integrator and value-added reseller. Products are procured from distributors back-to-back upon customer order confirmation.
- **Exact Question:** Please confirm that physical inventory tracking remains **strictly advisory** (tracking serials, demo kits, and transit goods) and does **not** block quotation creation, sales order booking, or invoice issuance when physical on-hand stock is zero.
- **Why Required:** Standard ERP software often enforces rigid warehouse stock allocations that prevent invoice generation if stock is unallocated, which would paralyze an order-driven IT reseller.
- **Available Options:**
  - **Option 5A (Advisory Reseller Inventory):** Inventory ledger records stock receipts and serial numbers for warranty/dispatch, but zero stock never blocks order booking, quotation approval, or invoicing.
  - **Option 5B (Strict Warehouse Stock Allocation):** Orders and invoices are blocked unless inventory is physically received in the warehouse beforehand.
- **Recommended Default:** **Option 5A (Advisory Reseller Inventory — preserves existing reseller business model)**.
- **Blocker Status:** **Non-blocking.** (Option 5A is already the established baseline).

---

## 3. SUMMARY OF RECOMMENDED DEFAULTS

| # | Business Decision | Recommended Default | Blocker Status |
|---|---|---|---|
| **1** | Live Outbound Email Provider | **Option 1C:** Cascading Zoho Mail primary with Gmail fallback | Non-blocking (Queue logs if unselected) |
| **2** | Scheduled Report Distribution | **Option 2A:** Dynamic distribution based on Company Settings & Role | Non-blocking |
| **3** | MFA Company Rollout Policy | **Option 3A:** Mandatory for MD/Admin/Accounts; 14-day grace for Field | Non-blocking |
| **4** | WhatsApp Customer Channel | **Option 4A:** Maintain Click-to-Chat deep-links (`wa.me`) | Non-blocking |
| **5** | Reseller Inventory Model | **Option 5A:** Advisory non-blocking inventory tracking | Non-blocking |

**Conclusion:** All 5 decisions have safe, robust, enterprise-compliant defaults. If management agrees with these defaults, **no implementation delays exist**, and the release can proceed directly to UAT verification upon your approval.

---

*Clarification report prepared strictly in accordance with ICON TECH PRO ERP Enterprise Engineering Standards.*
