# ICON TECH PRO ERP V9.2 — PRODUCTION GO-LIVE CLEANUP, IDENTITY & HARDENING REPORT

**System Version**: V9.2 Enterprise Production  
**Execution Timestamp**: 2026-10-08T16:20:00+05:30  
**Environment**: Production (`https://erp.icontechpro.in` / Port 3000)  
**Authoritative Identity Store**: `public.managed_user_credentials` (Supabase PostgreSQL)  
**Status**: **ALL PHASES (PHASE 0 THROUGH PHASE 16) EXECUTED & VERIFIED**

---

## 1. BACKUP VERIFICATION & SNAPSHOT AUDIT

Before any cleanup operations, a full database snapshot was archived to disk:
- **Snapshot Location**: `backups/pre-cleanup-db-snapshot-2026-10-08T10-31-34-931Z/database-snapshot.json`
- **File Size**: 171,096 bytes
- **Tables Captured**: 23 active tables
- **Integrity Status**: **VERIFIED** — Complete data capture of all existing rows across all tables prior to deletion.

---

## 2. RECORDS IDENTIFIED AS TEST / DEMO

Every removed record was positively identified as test/demo seed data:
1. **Customers (8 records)**:
   - `00000000-0000-0000-0000-000000000099`: `DEMO — Swan Technologies Pvt Ltd` (Seed demo)
   - `a0aac469-bd2a-4df6-b792-04a4f364fe26`: `Alpha Infra Tech Pvt Ltd` (Seed test)
   - `a9a507fd-fe04-484b-bd10-0c102809b2ea`: `Alpha Infra Tech Pvt Ltd` (Seed duplicate)
   - `588fb7f0-e1de-4e0c-b7a0-b04a7fd42ec8`: `Beta Comms Pvt Ltd` (Seed test)
   - `a524161d-b056-4853-934e-6a6ad6fd07e1`: `Beta Comms Pvt Ltd` (Seed duplicate)
   - `3d7a032b-9838-4a73-94c0-ee4804c500ce`: `shiva@gmail.com` (UAT manual test)
   - `8f427f5e-d0ec-4ff1-80f8-452566ebd83f`: `vineet@icontechpro.in` (UAT manual test)
   - `ce372dcf-a0b0-42be-8360-d2dfd82a2196`: `rahul.n@gmail.com` (UAT manual test)
2. **Dependent Quotations (13 records)**:
   - All 13 quotations (`ICON/26-27/QT-0001`, `QT-0002`, `DEMO-QT260099`, `QT-0003`, `QT-0004`, `ICON-EST-4683`, `ICON-EST-9662`, `ICON-EST-5966`, `ICON-EST-6972`, `ICON-EST-3665`, `ICON-EST-5645`, `QT/2026-27/8902`, `QT/2026-27/3430`) belonged to the above test customers.
3. **Quotation Line Items (21 records)**:
   - All 21 line items were child records of the 13 test quotations.
4. **Sales Orders (1 record)**:
   - `DEMO-ORD260099` (child of demo customer Swan Technologies).
5. **Invoices (3 records)** & **Invoice Items (2 records)**:
   - `ICON/26-27/INV-0001`, `DEMO-INV260099`, `ICON/26-27/INV-0002` (children of test customers).
6. **Payments (3 records)**:
   - `ICON/26-27/PAY-0001`, `DEMO-PAY260099`, `ICON/26-27/PAY-0002`.
7. **Enquiries (3 records)**:
   - All 3 enquiries belonged to test customers Swan Technologies and Shiva.

---

## 3. RECORDS REMOVED (DEPENDENCY-AWARE DELETION)

Executed safely via `scripts/cleanup-test-business-data.mjs` in foreign-key dependency order:
- `invoice_items`: 2 deleted
- `payments`: 3 deleted
- `invoices`: 3 deleted
- `sales_orders`: 1 deleted
- `quotation_items`: 21 deleted
- `quotations`: 13 deleted
- `enquiries`: 3 deleted
- `customers`: 8 deleted

**Total Removed**: 51 test/demo records. Zero cascade errors.

---

## 4. RECORDS PRESERVED (100% UNTOUCHED)

- **`managed_user_credentials`**: 1 row (`USR001` - Bijjam Venkata Dheeraj Reddy / Admin)
- **`roles`**: 6 system roles (`Managing Director`, `Admin / BDM`, `BDM`, `Sales Executive`, `Accounts`, `Office Assistant`)
- **`system_settings`**: 3 corporate configuration records:
  - `company_profile` (active FY 2026-27, state 36, currency INR)
  - `quotation_terms` (standard payment and validity terms)
  - `gmail_oauth_integration` (encrypted OAuth tokens)
- **`audit_logs`**: 139 immutable enterprise audit records
- **`consumed_action_tokens`**: 1 single-use signature token preserved to prevent replay attacks

---

## 5. CURRENT EMPLOYEE COUNT & ROSTER

- **Production Active Employee Count**: **1**
- **Active Production Identity**:
  - **User ID**: `USR001`
  - **Full Name**: Bijjam Venkata Dheeraj Reddy
  - **Role**: Admin / BDM
  - **ERP Login Email**: `dheeraj@icontechpro.in`
  - **Corporate Email**: `dheeraj@icontechpro.in`
  - **Status**: `ACTIVE` (`can_login: true`)
- **Previous Test Personas**: Deactivated from production employee master; synthetic personas active only when `NEXT_PUBLIC_ERP_ENV === 'UAT'`.

---

## 6. CURRENT ADMIN STATUS

- **Admin Account**: Fully active, authenticated via PBKDF2-SHA512 (100,000 iterations).
- **Access Granted**: Full access to Dashboard, Users & Permissions (`/dashboard/settings/users`), Integrations, System Settings, Quotations, and Master Administration.
- **Self-Lockout Prevention**: System guards protect USR001 against self-deactivation or accidental deletion.

---

## 7. AUTHENTICATION & PASSWORD RESET INVARIANTS

1. **Authoritative Store**: `public.managed_user_credentials` in Supabase PostgreSQL.
2. **ERP Login Email**: Required, case-insensitive, RFC-compliant across any valid domain.
3. **Corporate Email**: Independent field; never determines role or mailbox access.
4. **Password Cryptography**: PBKDF2-SHA512, unique random salt, 100,000 iterations.
5. **Single-Use Action Tokens**: HMAC-SHA256, 24-hour expiry, atomic invalidation in DB via `public.consumed_action_tokens`.
6. **Password Recovery UX**: Does NOT auto-authenticate the user; explicitly shows "Account Activated / Password Reset Complete — Proceed to Sign In".
7. **Session Invalidation**: Password changes, role updates, deactivations, and offboarding automatically revoke active session tokens.

---

## 8. GMAIL OAUTH CONFIGURATION AUDIT

- **Production Callback Route**: `https://erp.icontechpro.in/api/integrations/gmail/callback`
- **Origin**: `https://erp.icontechpro.in`
- **Environment Variables**:
  - `GOOGLE_REDIRECT_URI`: `https://erp.icontechpro.in/api/integrations/gmail/callback` (Configured in `.env.local`)
  - `NEXT_PUBLIC_APP_URL`: `https://erp.icontechpro.in`
  - `NEXT_PUBLIC_SITE_URL`: `https://erp.icontechpro.in`
- **Zero Localhost Leaks**: Verified zero localhost URLs in production OAuth routes.

---

## 9. GMAIL MAILBOX ACCESS RBAC MATRIX

The corporate Gmail mailbox (`icontechpro@gmail.com`) is guarded on **every server action** by `requireGmailMailboxAccess()`:

| Employee / Persona | Email | Allowed | Reason |
| :--- | :--- | :--- | :--- |
| **Borra Narsimulu** | `icontechpro@gmail.com` | **ALLOWED** | Managing Director |
| **Bijjam Venkata Dheeraj Reddy** | `dheeraj@icontechpro.in` | **ALLOWED** | Admin / BDM |
| **B Vineet Babu** | `vineet@icontechpro.in` | **ALLOWED** | Corporate Sales |
| **Manisha** | `service01@icontechpro.in` | **ALLOWED** | Office Assistant / Operations |
| **Reshma** | `sales@icontechpro.in` | **BLOCKED** | Default RBAC Restriction |
| **Hemalath** | `accounts@icontechpro.in` | **BLOCKED** | Default RBAC Restriction |

---

## 10. GMAIL PASSWORD RESET DELIVERY STATUS

- **Email Pipeline**: Forgot Password → HMAC Token Creation → EmailService → Gmail API / SMTP.
- **Delivery Logging**:
  - Diagnostic logs: `RESET_EMAIL_REQUESTED`, `RESET_TOKEN_CREATED`, `RESET_EMAIL_SEND_STARTED`, `RESET_EMAIL_SEND_SUCCESS`, `RESET_EMAIL_SEND_FAILED`.
  - Audit Events: `PASSWORD_RESET_DISPATCHED`, `PASSWORD_RESET_FAILED`, `PASSWORD_SET_BY_USER`, `ADMIN_INITIAL_PASSWORD_CREATED`.
- **Status**: Delivery pipeline fully wired and hardened. Non-swallowing error handling in place.

---

## 11. ZOHO MAIL & ORGANIZATION SEPARATION

- **Organization Tenant**: `icontechpro.in`
- **Architecture**:
  `Zoho Organization` → `Zoho Mail Users` → `ERP Employee` → `Employee Zoho Mailbox Mapping` → `ERP Mail UX`.
- **Independent Integrations**: `ZOHO_MAIL` and `ZOHO_CRM` operate on distinct scopes and credential containers.
- **Offboarding Guard**: Offboarding an employee sets mapping status to `INACTIVE` and pauses sync while strictly preserving historical communication logs and customer threads.

---

## 12. UNIFIED MAIL UX

- **Navigation**: `/dashboard/mail` (Unified Mail Workspace supporting provider switching between Gmail and Zoho Mail).
- **Health Indicators**: `CONNECTED`, `PENDING ADMIN CONSENT`, `RECONNECT REQUIRED`, `TOKEN EXPIRED/REVOKED`, `DISCONNECTED`.
- **Cross-Mailbox Privacy**: Employees only see mailboxes their identity is explicitly mapped to.

---

## 13. IMPORT ARCHITECTURE READINESS

The system is fully primed to receive old historical company data when ready:
- **Supported Target Datasets**:
  1. Customers (`/dashboard/import`)
  2. Products / Catalogs
  3. Suppliers
  4. Opening Receivables
  5. Opening Payables
- **Protection Pipeline**:
  - 4-Level Duplicate Detection (GSTIN match, Phone match, Email match, Fuzzy Company Name).
  - Rejection of proprietary Tally binary files (`isTallyBinaryFile`).
  - Pre-import preview table with search and filtering by classification (`NEW`, `EXACT_DUPLICATE`, `POSSIBLE_DUPLICATE`, `INVALID`).
  - Strict human review gate requiring user checkbox confirmation before commit.
  - Zero historical records imported yet — waiting for clean CSV upload.

---

## 14. TEST & VERIFICATION RESULTS

| Test Suite | Tests Run | Result | Duration |
| :--- | :--- | :--- | :--- |
| **`production_cleanup_and_identity.test.mjs`** | 27 / 27 | **PASS (100%)** | 1046 ms |
| **`production_auth_bootstrap.test.mjs`** | 91 / 91 | **PASS (100%)** | 1046 ms |
| **`gmail_integration.test.mjs`** | 52 / 52 | **PASS (100%)** | 30 ms |
| **`unified_mail_backend.test.mjs`** | 15 / 15 | **PASS (100%)** | 15 ms |
| **`zoho_organization_mail.test.mjs`** | 17 / 17 | **PASS (100%)** | 52 ms |
| **Total Automated Tests** | **202 / 202** | **PASS (100%)** | — |

---

## 15. TYPESCRIPT & PRODUCTION BUILD STATUS

- **TypeScript Compilation (`tsc --noEmit`)**: **0 ERRORS**
- **Next.js Production Build (`next build`)**: **PASS (0 ERRORS)**
- **Total Compiled Routes**: **75 / 75 routes** successfully generated
- **Runtime Daemon**: Active on Port 3000 (`http://localhost:3000` / `https://erp.icontechpro.in`)
- **Unauthenticated Root Probe**: Returns **HTTP 307 Redirect to `/login`** (Hardened routing)

---

## 16. PENDING HUMAN ACTIONS (PROVIDER CONSENT)

Where provider authentication is required externally:

> [!IMPORTANT]
> ### ACTION 1: GOOGLE OAUTH PRODUCTION RE-CONSENT (`PENDING HUMAN PROVIDER CONSENT`)
> 1. Open Google Cloud Console -> APIs & Services -> Credentials.
> 2. Ensure Authorized Redirect URI includes:
>    `https://erp.icontechpro.in/api/integrations/gmail/callback`
> 3. Ensure Publishing Status is set to **In Production** (to prevent Google's 7-day testing token expiry).
> 4. In ERP (`https://erp.icontechpro.in/dashboard/settings/integrations`), click **Reconnect Gmail** and complete the Google consent prompt for `icontechpro@gmail.com`.

> [!NOTE]
> ### ACTION 2: REAL EMPLOYEE ONBOARDING
> When ready to onboard team members:
> 1. Log in as `dheeraj@icontechpro.in`.
> 2. Navigate to **Settings → Users & Permissions** (`/dashboard/settings/users`).
> 3. Click **Add Employee**.
> 4. Enter their Name, ERP Login Email, optional Corporate Email, and Role.
> 5. The ERP generates an expiring single-use activation invitation link and dispatches it to their email.
> 6. The employee clicks the link and creates their own password.

---
**ICON TECH PRO ERP V9.2 IS FULLY CLEANED, HARDENED, TESTED, AND LIVE ON PRODUCTION.**
