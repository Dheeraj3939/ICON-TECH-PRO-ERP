# ICON TECH PRO ERP V9.2 — BACKUP & DISASTER RECOVERY REPORT

**Document Version:** 1.0.0  
**Date:** 2026-11-05  
**Project:** ICON TECH PRO ERP  
**Repository:** `C:\ICON-TECH-PRO-ERP`  
**Official Production URL:** `https://erp.icontechpro.in`  
**Baseline Commit:** `6bc3635a2f19bf146d16c85fbedcd0fd82438dd1`  
**Security Standard:** Zero Data Loss, Strict Credential Hygiene (No Raw Secrets Exposed)

---

## 1. DISASTER RECOVERY TARGETS: RPO & RTO

- **Recovery Point Objective (RPO):** **15 Minutes.** Maximum permissible data loss in a catastrophic failure scenario. Achieved via continuous PostgreSQL WAL archiving in Supabase combined with automated daily logical dumps.
- **Recovery Time Objective (RTO):** **30 Minutes.** Maximum permissible downtime to restore the ERP service to full operational health following an infrastructure failure.

---

## 2. BACKUP SCOPE & ARCHITECTURAL INVENTORY

The ICON TECH PRO ERP disaster recovery framework encompasses 6 core components:

| Backup Component | Backup Mechanism | Frequency | Storage Location & Encryption |
|---|---|---|---|
| **1. Application Source Code** | Git Tagged Release Baseline (`git tag -a V9.2-FINAL`) | On every release / change | Git Remote + Local Mirror |
| **2. Database Logical Dump** | PostgreSQL custom-format dump (`pg_dump -F c`) | Daily at 02:00 Asia/Kolkata + Pre-cutover | Encrypted GCS/S3 Bucket (AES-256) |
| **3. Storage & Signed Docs** | Supabase Storage bucket mirror (`signed_documents`, `site_photos`) | Daily incremental sync | Encrypted Cloud Storage Mirror |
| **4. Database Migrations** | Version-controlled idempotent SQL files in `supabase/migrations/` | Continuous in Git | Codebase Repository |
| **5. Configuration Templates** | `.env.example` template with variable schemas (zero raw secrets) | Continuous in Git | Codebase Repository |
| **6. Audit History & Checkpoints** | Cryptographic signed checkpoints in `audit_checkpoints` | Hourly automated checkpoint | Central Audit Ledger |

---

## 3. SECURE BACKUP DRILL PROTOCOL

### 3.1 Pre-Cutover Production Database Backup
Before executing additive migrations against the production database (`xogynsnfzsvimwtvvhpx`), execute:

```bash
# Set secure timestamped filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/prod_backup_pre_v9_2_${TIMESTAMP}.dump"

# Execute logical PostgreSQL dump
pg_dump \
  -h db.xogynsnfzsvimwtvvhpx.supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -b \
  -v \
  -f "${BACKUP_FILE}"

# Record cryptographic SHA-256 checksum
sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
```

### 3.2 Environment Variable Restoration Checklist (No Secrets Disclosed)
When restoring the application runtime on a fresh host, bind the following environment variable keys from the corporate password manager:
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` (Database service role)
- `NEXT_PUBLIC_APP_URL` (`https://erp.icontechpro.in`)
- `NEXT_PUBLIC_ERP_ENV` (`production` / `uat`)
- `SESSION_SECRET` & `ERP_SESSION_SECRET` (WebCrypto HMAC session keys)
- `COOKIE_SECURE` (`true`)
- `ENABLE_LIVE_EMAIL_DISPATCH` (`true` for production, `false` for staging)
- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REDIRECT_URI`, `ZOHO_TOKEN_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GMAIL_TOKEN_ENCRYPTION_KEY`
- `E_INVOICE_CLIENT_ID`, `E_INVOICE_CLIENT_SECRET`, `E_INVOICE_USERNAME`, `E_INVOICE_PASSWORD`
- `E_WAYBILL_CLIENT_ID`, `E_WAYBILL_USERNAME`, `E_WAYBILL_PASSWORD`

---

## 4. RESTORATION DRILL & VERIFICATION PROCEDURE

A backup is not considered verified until restoration is demonstrated in an isolated environment:

### Step 1: Verification of Backup Archive Integrity
```bash
# Verify checksum matches
sha256sum -c backups/prod_backup_pre_v9_2_*.dump.sha256
```

### Step 2: Restoration to Isolated Staging / UAT Database
```bash
# Execute pg_restore against isolated non-production instance
pg_restore \
  -h db.njylssodwvaonbeebvjq.supabase.co \
  -U postgres \
  -d postgres \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  -v "backups/prod_backup_pre_v9_2_*.dump"
```

### Step 3: Schema & Data Consistency Verification Query
```sql
SELECT 
  (SELECT COUNT(*) FROM customers) AS customer_count,
  (SELECT COUNT(*) FROM quotations) AS quotation_count,
  (SELECT COUNT(*) FROM invoices) AS invoice_count,
  (SELECT COUNT(*) FROM delivery_challans) AS challan_count;
```

---

## 5. DISASTER RECOVERY & ROLLBACK TRIGGERS

Initiate full disaster recovery or application rollback if:
1. Migration failure corrupts preexisting customer or financial records.
2. Production service fails to initialize on Port 3000 after cutover.
3. Authenticated sessions fail catastrophically across multiple users.

---

*Report prepared strictly in accordance with ICON TECH PRO ERP Enterprise Engineering Standards.*
