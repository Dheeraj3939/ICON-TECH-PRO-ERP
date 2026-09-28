# ICON TECH PRO ERP - Security Architecture & Data Protection

## 1. Multi-Tiered Defense-in-Depth Model

Security in the ICON TECH PRO ERP is implemented across four distinct tiers: Network, Application, Database, and Audit Ledger.

```
+-----------------------------------------------------------------------------------------+
|  1. NETWORK & TRANSPORT LAYER                                                           |
|  - TLS 1.3 encryption across all client-server transit                                   |
|  - Cloudflare / Reverse Proxy DDoS protection & Web Application Firewall (WAF)          |
|  - Rate-limiting: Max 100 requests/minute per IP on authentication & mutation endpoints |
+-----------------------------------------------------------------------------------------+
                                             |
+-----------------------------------------------------------------------------------------+
|  2. APPLICATION & API LAYER (NEXT.JS & EDGE RUNTIME)                                    |
|  - Supabase GoTrue JWT session tokens stored in secure, HttpOnly, SameSite cookies      |
|  - Zod runtime schema validation on every Server Action and API route                   |
|  - Strict CORS policy restricting origins to verified company domains                   |
|  - Input sanitization neutralizing XSS, command injection, and SQL injection            |
+-----------------------------------------------------------------------------------------+
                                             |
+-----------------------------------------------------------------------------------------+
|  3. DATABASE SECURITY (POSTGRESQL & SUPABASE)                                           |
|  - Row-Level Security (RLS) enabled on 100% of public domain tables                     |
|  - Principle of Least Privilege: Anonymous users denied all access                     |
|  - Parameterized queries via Supabase client (Zero raw dynamic SQL concatenation)      |
|  - Column-level privileges restricting sensitive cost/purchase price visibility         |
+-----------------------------------------------------------------------------------------+
                                             |
+-----------------------------------------------------------------------------------------+
|  4. AUDIT & RECOVERY LAYER                                                              |
|  - Immutable append-only audit trail logging all mutation operations                    |
|  - Automated Point-in-Time Recovery (PITR) with daily off-site encrypted backups        |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Authentication & Session Management

1. **Identity Provider:** Supabase Auth (GoTrue) using email and cryptographically hashed passwords (Argon2id/bcrypt).
2. **Token Lifecycle:**
   * Access Token (JWT): Short-lived (1 hour expiry) containing `user_id`, `role`, and assigned business entity claims.
   * Refresh Token: Long-lived (30 days), stored exclusively in secure, HttpOnly, SameSite=Lax browser cookies to prevent client-side JavaScript access and XSS theft.
3. **Multi-Factor Authentication (MFA / 2FA):**
   * Mandatory Time-based One-Time Password (TOTP) enforcement for administrative roles (`Managing Director`, `Admin / BDM`, `Accounts`).

---

## 3. Environment Variable Architecture & Zero Secret Leakage

1. **Strict Key Segregation:**
   * **`NEXT_PUBLIC_SUPABASE_URL`:** Public API gateway URL (safe for browser & server).
   * **`NEXT_PUBLIC_SUPABASE_ANON_KEY`:** Public anonymous client key (safe for browser; all table access is strictly gated by PostgreSQL Row-Level Security).
   * **`SUPABASE_SERVICE_ROLE_KEY`:** Super-admin service role key. **CRITICAL:** This key bypasses Row-Level Security and is restricted exclusively to trusted server-side execution contexts (Next.js Server Actions, background sync, or database migration scripts). It is **NEVER prefixed with `NEXT_PUBLIC_`**, never exposed to the client bundle, and never transmitted to the browser.
2. **Zero Hard-Coded Credentials Policy:**
   * All environment configurations reside in `.env.local` (local development) and platform environment secrets (production).
   * `.env*.local` is strictly ignored by Git. Automated pre-commit hooks scan for accidental secret leakage.

---

## 4. Row-Level Security (RLS) Hardening Rules

1. **Default Deny:**
   * Every new table executes `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;` and `REVOKE ALL ON <table_name> FROM public, anon;`.
2. **Role Verification Functions:**
   * Fast, indexed Postgres security helper functions check user authorization without repetitive subqueries:

```sql
-- Secure helper function caching role verification
CREATE OR REPLACE FUNCTION auth.current_user_role()
RETURNS VARCHAR AS $$
    SELECT r.role_name
    FROM user_profiles u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

## 4. Input Validation & Defense Against Tampering

1. **Zod Runtime Schema Validation:**
   * All form submissions and API payloads must pass strict Zod validation prior to database execution.
   * Example customer creation validator:

```typescript
import { z } from 'zod';

export const CompanyCustomerSchema = z.object({
  company_name: z.string().min(2, "Company name required").max(200),
  contact_person: z.string().min(2, "Contact person required").max(120),
  designation: z.string().max(100).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid 10-digit Indian mobile number"),
  alternate_phone: z.string().regex(/^[6-9]\d{9}$/).optional().or(z.literal('')),
  email: z.string().email("Invalid email address"),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN format").optional().or(z.literal('')),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format").optional().or(z.literal('')),
  billing_address: z.string().min(5, "Billing address required"),
  shipping_address: z.string().min(5, "Shipping address required"),
  city: z.string().default("Hyderabad"),
  state: z.string().default("Telangana"),
  pin: z.string().regex(/^\d{6}$/, "Invalid 6-digit PIN code"),
  salesperson_id: z.string().uuid()
});
```

2. **Financial Records Immutability:**
   * Database triggers prevent `UPDATE` or `DELETE` on finalized Tax Invoices, signed Delivery Challans, and confirmed Stock Ledger entries.
   * Only compensatory reversal transactions (Credit Notes, Adjustments) are allowed.

---

## 5. Comprehensive Audit Trail System

Every modification to core business data is automatically captured by a PostgreSQL trigger and written to the immutable `audit_logs` table:

```sql
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        performed_by,
        ip_address
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        auth.uid(),
        inet_client_addr()::TEXT
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 6. Disaster Recovery & Backup Protocol

1. **Automated Daily Backups:** Managed daily full backups via Supabase with geo-redundant storage.
2. **Continuous WAL Archiving:** Enables Point-in-Time Recovery (PITR) up to the minute within a 7-day rolling window.
3. **Encrypted Storage:** All uploaded documents (site photos, signed contracts, PAN/GST certificates) are encrypted at rest using AES-256 in Supabase Storage buckets.
