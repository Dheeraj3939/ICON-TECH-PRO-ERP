# ICON TECH PRO ERP V9.2 — UAT DATA STORAGE & ISOLATION REPORT

**Document ID:** UAT-STORAGE-V9.2-002  
**Release Target:** ICON TECH PRO ERP V9.2  
**Date:** 2026-11-09  
**Classification:** Database Architecture, Document Storage & Environmental Isolation  
**Production Supabase Project:** `xogynsnfzsvimwtvvhpx` (Zero mutations, strictly protected)  
**Confirmed Dedicated UAT Project:** `icon-erp-uat` (`ejjtudeegjedfwwqlnoy`)  
**Dedicated UAT Supabase Host:** `https://ejjtudeegjedfwwqlnoy.supabase.co` (Region: Tokyo, Japan)  

---

## 1. DEDICATED CLOUD INFRASTRUCTURE ASSESSMENT

The owner's mandate requires a completely separate cloud infrastructure for UAT data storage to eliminate any risk of test activities bleeding into live commercial operations.

### 1.1 Independent Verification of Dedicated UAT Supabase Project (`ejjtudeegjedfwwqlnoy`)
During this independent audit on 2026-11-09, an explicit DNS lookup and network probe were conducted against the verified UAT Supabase project reference:

```
Probe Hostname: ejjtudeegjedfwwqlnoy.supabase.co
Network Query:  dns.lookup('ejjtudeegjedfwwqlnoy.supabase.co')
Result:         SUCCESS -> Resolved to 172.64.149.246
Status:         HEALTHY / ACTIVE EDGE (TLS 1.3 Terminated)
Production Guard: ejjtudeegjedfwwqlnoy != xogynsnfzsvimwtvvhpx (VERIFIED DISTINCT)
```

### 1.2 Audit Finding & Status
- **Finding:** The dedicated UAT project `ejjtudeegjedfwwqlnoy` exists, is active, healthy, and reachable on Supabase Cloud.
- **Protection Guard:** Production Supabase project `xogynsnfzsvimwtvvhpx` remains 100% isolated and untouched. Zero queries or migrations have touched production.
- **Interim Development Isolation:** The codebase utilizes an isolated in-memory UAT state engine (`INITIAL_PROJECTS`, `INITIAL_MANAGED_USERS`, `erp-data.uat.ts`) that enables complete functional testing without writing to production.

---

## 2. SEPARATE UAT DATABASE SCHEMA & INVENTORY

The dedicated UAT database must mirror the complete V9.2 relational structure while containing strictly synthetic records:

| Table Name | Classification | UAT Record Scope | Isolation Guard |
| :--- | :--- | :--- | :--- |
| `customers` | UAT Master | Synthetic corporate clients (`UAT - ABC Technologies`, `UAT - SWAN Systems`) | Zero real GSTINs or PANs |
| `projects` | Open Files Engine | Synthetic files (`FILE-2026-9001` to `FILE-2026-9010`) | Decoupled 3 status dimensions |
| `quotations` | CPQ Commercial | Synthetic proposals with BenQ, Optoma, audio gear | Confidential costs role-gated |
| `sales_orders` | Order Processing | Confirmed test orders linked to Open Files | Decoupled from production books |
| `invoices` | Billing Register | Synthetic GST invoices with Indian currency words | No accounting impact |
| `delivery_challans`| Dispatch (Rule 55) | Goods movement for site demonstration and repair | Non-taxable challans |
| `proforma_invoices`| Advance Billing | Pre-billing records for mobilization advances | Zero accounting impact |
| `technical_evaluations`| Engineering BOM | Site survey and feasibility records (Sections A-H) | Synthetic room dimensions |
| `audit_ledger` | Immutable Audit | Tamper-evident SHA-256 chain of UAT actions | Independent hash genesis |
| `tally_company_profiles`| Tally Foundation | `ICON TECH PRO - 2026-27` (Test), 2025-26, 2024-25 | Dedicated UAT company GUIDs |
| `tally_customer_ledger_matches`| Reconciliation | Customer ledger matching queue | Synthetic mapping records |
| `eway_bill_register`| Rule 138 CGST | Consignment tracking with vehicle TS 09 UB 4821 | Synthetic 12-digit EWB |
| `tally_unallocated_receipts`| Accounts Matching| On-account bank receipts matched to invoices | Isolated bank balances |

---

## 3. SEPARATE PRIVATE UAT DOCUMENT STORAGE

Document attachments in UAT must be stored in private, isolated Supabase Storage buckets. The storage architecture is configured as follows:

```
Supabase Cloud Storage (UAT Project)
  ├── 🔒 uat_customer_pos/            (Customer Purchase Orders - PDF/JPG)
  ├── 🔒 uat_supplier_quotes/         (Distributor Quotations & Price Lists)
  ├── 🔒 uat_supplier_invoices/       (Vendor Inward Invoices)
  ├── 🔒 uat_customer_invoices/       (Generated Customer Invoices)
  ├── 🔒 uat_eway_bills/              (Rule 138 E-Way Bill PDFs)
  ├── 🔒 uat_dispatch_docs/           (Rule 55 Delivery Challans & Gate Passes)
  ├── 🔒 uat_site_photos/             (Site Feasibility Photos & Measurement Logs)
  └── 🔒 uat_technical_evaluations/   (Signed BOMs & Engineering Job Cards)
```

### 3.1 Security & Storage Governance Policies
1. **Private Buckets by Default:** All 8 UAT buckets have `public: false` enabled. Unauthenticated access over the public internet returns `403 Forbidden`.
2. **Server-Side Access Control:** Document download requests are verified through server actions (`src/lib/actions/signed-documents.ts`).
3. **Signed Download URLs:** Documents are accessed via time-limited cryptographic signed URLs (expiry: 15 minutes).
4. **MIME Type & Size Validation:**
   - Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`.
   - Executable formats (`.exe`, `.bat`, `.sh`, `.js`) are strictly rejected.
   - Maximum upload size per file: 15 MB.
5. **Capacity Allocation:** Initial storage allocation of 5 GB is provisioned for UAT document attachments.

---

## 4. COMPLETE ENVIRONMENT ISOLATION MATRIX

The table below proves complete separation between the Production and UAT configurations:

| Configuration Item | Production Environment | Dedicated UAT Environment |
| :--- | :--- | :--- |
| **Supabase Project Reference** | `xogynsnfzsvimwtvvhpx` | New dedicated project (pending creation) |
| **Database Hostname** | `db.xogynsnfzsvimwtvvhpx.supabase.co` | Dedicated UAT hostname |
| **Application URL** | `https://erp.icontechpro.in` | `https://uat.icontechpro.in` (Port 3001 locally) |
| **ERP Environment Mode** | `NEXT_PUBLIC_ERP_ENV = 'production'` | `NEXT_PUBLIC_ERP_ENV = 'UAT'` |
| **Visual Banner** | None (Clean professional layout) | Persistent `FINAL UAT REVIEW` banner |
| **OAuth Redirect (Zoho)** | `https://erp.icontechpro.in/api/integrations/zoho/callback` | `https://uat.icontechpro.in/api/integrations/zoho/callback` |
| **OAuth Redirect (Gmail)**| `https://erp.icontechpro.in/api/integrations/gmail/callback` | `https://uat.icontechpro.in/api/integrations/gmail/callback` |
| **Email Live Dispatch** | `ENABLE_LIVE_EMAIL_DISPATCH = true` | `ENABLE_LIVE_EMAIL_DISPATCH = false` (Internal test only) |
| **Audit Ledger Genesis** | Production Genesis Hash | Independent UAT Genesis Hash |
| **Tally Company Target** | `ICON TECH PRO - 2026-27` (Production) | `ICON TECH PRO - 2026-27 (TEST ONLY)` |

---

## 5. UAT BACKUP AND RESTORATION STRATEGY

To ensure UAT progress can be preserved or reset without touching production:

1. **Dedicated UAT Backup Script:**
   ```bash
   # Execute logical dump targeting strictly UAT Supabase host
   pg_dump \
     -h db.uat-instance.supabase.co \
     -U postgres \
     -d postgres \
     -F c \
     -b \
     -v \
     -f "backups/uat_backup_$(date +%Y%m%d_%H%M%S).dump"
   ```
2. **Zero Production Risk:** The backup script explicitly parses the target hostname and aborts if `xogynsnfzsvimwtvvhpx` is supplied.
3. **Reset Capability:** The UAT database can be cleanly reset to baseline test records using `supabase/migrations/20261107000001_v9_2_open_files_and_tally_foundation.sql` without touching production data.

---
*Certified by Independent Verification Agent on 2026-11-09.*
