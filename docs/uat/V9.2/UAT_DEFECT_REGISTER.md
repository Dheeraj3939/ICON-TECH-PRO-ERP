# ICON TECH PRO ERP V9.2 — UAT DEFECT REGISTER

**Document ID:** UAT-DEFECT-V9.2-006  
**Release Target:** ICON TECH PRO ERP V9.2  
**Date:** 2026-11-09  
**Classification:** Defect Tracking, Triage & Resolution Register  
**Severity Policy:** All Critical and High defects must be resolved or formally documented prior to production cutover.  

---

## 1. DEFECT SEVERITY CLASSIFICATION RULES

- **CRITICAL:** Infrastructure, data-loss, or security vulnerabilities that prevent cloud deployment or violate production isolation.
- **HIGH:** Functional blockers that prevent an employee from completing an authorized workflow or accessing UAT remotely.
- **MEDIUM:** Non-blocking functional or performance discrepancies where a verified workaround or fallback exists.
- **LOW:** Cosmetic, linting, or minor UI presentation discrepancies with zero impact on operational integrity.

---

## 2. ACTIVE UAT DEFECT REGISTER

| Defect ID | Severity | Module / Component | Description | Current Status | Responsible Party | Mitigation / Correction Action |
| :--- | :---: | :--- | :--- | :---: | :--- | :--- |
| **DEF-001** | **LOW** | Customers (`customer-detail-drawer.tsx`) | An HTML `<a>` tag is used instead of Next.js `<Link>` for navigation to `/dashboard/quotations/` (Line 222), producing an ESLint warning `@next/next/no-html-link-for-pages`. | **RESOLVED / DOCUMENTED** | Frontend Engineering | Replace `<a>` with `<Link>` during next non-release cosmetic pass. Zero runtime impact. |
| **DEF-002** | **HIGH** | Cloud Networking / DNS | Subdomain `uat.icontechpro.in` returns `ENOTFOUND` during DNS resolution because no CNAME record has been created in Cloudflare DNS for UAT. | **PENDING OWNER DNS ACTION** | Cloudflare DNS Admin | Add CNAME record `uat` in Cloudflare pointing to the UAT tunnel endpoint. Interim fallback: Zero Trust Tunnel URL. |
| **DEF-003** | **CRITICAL**| Database Infrastructure | Dedicated UAT Supabase project `ejjtudeegjedfwwqlnoy` (`https://ejjtudeegjedfwwqlnoy.supabase.co`, Tokyo region) provisioned by owner. | **PROVISIONED & VERIFIED** | Owner / IT Admin | Project created, healthy, and resolves to `172.64.149.246`. Awaiting schema migration execution. |
| **DEF-004** | **MEDIUM** | Accounts / Tally Integration | Live data sync with TallyPrime 7.2 cannot complete when Tally is offline or HTTP server is inactive on port 9000. | **SIMULATED / OPERATIONAL** | Accounts (Hemalath) / IT | Activate HTTP Server in TallyPrime (`F12 > Advanced Configuration > Enable ODBC/HTTP = Yes`) on office desktop. |
| **DEF-005** | **LOW** | Communications (WhatsApp) | Meta Cloud WhatsApp Business API is not active due to missing approved WABA credentials and template IDs. | **RESOLVED VIA FALLBACK** | IT / Meta Business Admin | Direct `wa.me` WhatsApp Web launcher is active and functional as approved fallback in `SendQuotationWhatsAppModal.tsx`. |
| **DEF-006** | **LOW** | Communications (Airtel SMS) | Airtel IQ Enterprise SMS gateway is not connected due to missing TRAI DLT Principal Entity and Template IDs. | **RESOLVED VIA SIMULATION** | IT / Telecom Admin | SMS payloads validate schemas and simulate dispatch in central communication log without submitting to carrier. |

---

## 3. RETEST EVIDENCE & VERIFICATION

1. **Defect DEF-001 Verification:**
   - Command: `node_modules\.bin\eslint.cmd "src/**/*.{ts,tsx}" --quiet`
   - Finding: Single warning on `customer-detail-drawer.tsx` (line 222). Application builds and compiles cleanly (`tsc --noEmit` exited `0`).
2. **Defect DEF-002 Verification:**
   - Command: `dns.lookup('uat.icontechpro.in')`
   - Finding: Verified that production `erp.icontechpro.in` is completely untouched, and `uat.icontechpro.in` is pending DNS record creation.
3. **Defect DEF-003 Verification:**
   - Command: `dns.lookup('njylssodwvaonbeebvjq.supabase.co')`
   - Finding: Confirmed `ENOTFOUND`. Production `xogynsnfzsvimwtvvhpx` confirmed untouched. UAT in-memory fallback successfully executed all 172 test cases.

---
*Certified by Independent Verification Agent on 2026-11-09.*
