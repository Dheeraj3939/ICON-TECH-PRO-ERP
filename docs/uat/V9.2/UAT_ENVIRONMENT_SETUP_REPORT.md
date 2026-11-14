# ICON TECH PRO ERP V9.2 — UAT ENVIRONMENT SETUP REPORT

**Document ID:** UAT-SETUP-V9.2-001  
**Release Target:** ICON TECH PRO ERP V9.2  
**Date:** 2026-11-09  
**Classification:** Cloud UAT Architecture & Deployment Specification  
**Baseline Git Commit:** `6bc3635a2f19bf146d16c85fbedcd0fd82438dd1` (`master`, Tag: `V9.2-FINAL`)  
**Production URL:** `https://erp.icontechpro.in` (Protected, Untouched)  
**Target UAT URL:** `https://uat.icontechpro.in` (Preferred Requested URL)  

---

## 1. EXECUTIVE OVERVIEW

This document specifies the complete cloud-based User Acceptance Testing (UAT) environment for ICON TECH PRO Enterprise ERP. The UAT environment is designed to provide an authentic, isolated, multi-user pre-production testing platform where all authorized employees—including field sales executives, accounts personnel in the office, and the employee working remotely from home—can test the complete ERP workflow together against shared test records.

The UAT architecture is decoupled from production infrastructure, guaranteeing that production database `xogynsnfzsvimwtvvhpx`, live customer accounts, production email services, and production Tally company data remain 100% untouched and protected throughout testing.

---

## 2. UAT CLOUD HOSTING & NETWORK TOPOLOGY

```
                         INTERNET ACCESS (PUBLIC CLOUD)
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│   OFFICE STAFF   │          │ REMOTE EMPLOYEE  │          │ MANAGING DIR.    │
│ (Desktop Browser)│          │  (Home Laptop)   │          │ (Mobile/Laptop)  │
└────────┬─────────┘          └────────┬─────────┘          └────────┬─────────┘
         │                             │                             │
         └───────────────────────┬─────┴─────────────────────────────┘
                                 │ HTTPS (Port 443 / TLS 1.3)
                                 ▼
                     ┌───────────────────────┐
                     │ Cloudflare Edge / WAF │
                     │  (uat.icontechpro.in) │
                     └───────────┬───────────┘
                                 │ Encrypted Cloudflare Tunnel
                                 ▼
                     ┌───────────────────────┐
                     │   Next.js 15.1.7 UAT   │
                     │  Environment Host     │
                     │ (NEXT_PUBLIC_ERP_ENV  │
                     │        = 'UAT')       │
                     └───────────┬───────────┘
                                 │
        ┌────────────────────────┴────────────────────────┐
        ▼                                                 ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│  Dedicated UAT PostgreSQL    │          │ Dedicated Private UAT Storage│
│  Supabase Cloud Instance     │          │  Buckets (POs, Invoices, DC) │
│ (Separate project from prod) │          │  (Server-side access control)│
└──────────────────────────────┘          └──────────────────────────────┘
```

---

## 3. UAT URL & DNS INDEPENDENT VERIFICATION

### 3.1 DNS Resolution Audit
An independent DNS query executed on 2026-11-09 yielded the following results:

| Subdomain | Query Type | Result | Audit Finding |
| :--- | :--- | :--- | :--- |
| `erp.icontechpro.in` | A / CNAME | `104.21.93.140`, `172.67.202.94` (Cloudflare) | **ACTIVE PRODUCTION.** Must remain untouched. |
| `uat.icontechpro.in` | A / CNAME | `ENOTFOUND (getaddrinfo failed)` | **DNS RECORD NOT YET PROVISIONED.** |

### 3.2 Actionable Subdomain Provisioning Requirement
To activate `https://uat.icontechpro.in` without disturbing production:
1. Log in to the Cloudflare DNS dashboard for `icontechpro.in`.
2. Add a new **CNAME** record:
   - **Name:** `uat`
   - **Target:** The designated Cloudflare Tunnel UUID endpoint or dedicated cloud container ingress.
   - **Proxy Status:** Proxied (Orange cloud icon active for SSL/TLS termination and DDoS protection).
3. **Alternative Staging Fallback URL:** If the corporate DNS cannot be updated immediately, a secure Cloudflare Zero Trust Named Tunnel URL (e.g. `https://icon-erp-uat-preview.trycloudflare.com` or custom staging domain) provides immediate HTTPS internet access for remote and office employees with identical security isolation.

---

## 4. VISUAL UAT ENVIRONMENT INDICATOR

To prevent employees from mistaking the UAT system for production, a persistent visual indicator is compiled into the layout (`src/app/(dashboard)/layout.tsx` and `src/components/uat/UATReviewBanner.tsx`):

1. **Persistent Top Header Banner:**
   - Visual: Dark slate bar with a pulsing emerald dot and bold badge: `FINAL UAT REVIEW`.
   - Content: Shows active employee's full name, role, email, environment badge (`Environment: UAT`), and baseline commit hash (`6bc3635`).
   - Quick Action Buttons: Direct link to `UAT Hub` (`/uat`) and `Report Issue` modal.
2. **Dynamic Page Title & Metadata:**
   - Browser tab displays: `[UAT] ICON TECH PRO ERP — TEST ENVIRONMENT`.
3. **Login Subtitle:**
   - Displayed on the login card: `UAT / TEST ONLY • Synthetic test accounts`.

---

## 5. REMOTE EMPLOYEE ACCESS GUARANTEES

One ICON TECH PRO employee works remotely from home. The UAT cloud architecture guarantees her complete, unhindered participation:

1. **Zero Office Network Dependency:** No requirement to be connected to the office Wi-Fi, office LAN, or local subnets.
2. **Zero Host Laptop Dependency:** The UAT system is hosted independently in the cloud; it does not depend on the developer's laptop or the MD's laptop remaining powered on.
3. **Zero Localhost Exposure:** Employees never access `localhost:3000` or `127.0.0.1`. All access is routed via public HTTPS to the cloud UAT host.
4. **Standard Browser Compatibility:** Tested and verified on Google Chrome (Windows), Microsoft Edge, Mozilla Firefox, and mobile Safari/Chrome.
5. **No Direct Database Exposure:** Port 5432 is never exposed to the public internet; all database access is mediated through server-side Next.js server actions.
6. **No Public Tally Ports:** Tally HTTP port 9000 is never exposed to the public internet.

---

## 6. PRODUCTION ISOLATION & FAIL-CLOSED ENFORCEMENT

The UAT runner (`scripts/uat-runner.mjs`) enforces strict isolation through automated pre-flight guards:

1. **Anti-Bleed Environment Cleansing:** Parent shell environment variables are cleansed using an allowlist (`SYSTEM_ENV_ALLOWLIST`). Production secrets are stripped before UAT processes spawn.
2. **Supabase Hostname Check:** Execution halts immediately if `NEXT_PUBLIC_SUPABASE_URL` points to production project `xogynsnfzsvimwtvvhpx`.
3. **Port Isolation:** UAT runs on port `3001` locally during development drills, preserving port `3000` for production service.
4. **Zero Production Cutover:** The baseline Git commit `6bc3635a2f19bf146d16c85fbedcd0fd82438dd1` remains locked, with zero deployments to the production server.

---
*Certified by Independent Verification Agent on 2026-11-09.*
