# ICON TECH PRO ERP V9.2 — UAT EMPLOYEE ACCESS REGISTER

**Document ID:** UAT-ACCESS-V9.2-003  
**Release Target:** ICON TECH PRO ERP V9.2  
**Date:** 2026-11-09  
**Classification:** Employee Directory, Role Permissions & Access Control  
**Security Policy:** Zero Shared Logins, PBKDF2-SHA512 Password Encryption, Strict RBAC  

---

## 1. EMPLOYEE DIRECTORY & UAT ACCESS STATUS

All six authorized ICON TECH PRO staff members have provisioned individual user credentials in the ERP authentication system. No shared or generic "team" accounts exist.

| Employee Name | Official Email | Authorized Role | Department | Work Location | UAT Access Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Borra Narsimulu** | `icontechpro@gmail.com` | **Managing Director** | Executive Leadership | Office / Mobile | **PROVISIONED & ACTIVE** |
| **B V Dheeraj Reddy** | `dheeraj@icontechpro.in` | **Admin / BDM** | Administration & IT | Office / Field | **PROVISIONED & ACTIVE** |
| **B Vineet Babu** | `vineet@icontechpro.in` | **Sales Executive** | Corporate Sales | Office / Field | **PROVISIONED & ACTIVE** |
| **Reshma** | `sales@icontechpro.in` | **Sales Executive** | Client Coordination | Office / Field | **PROVISIONED & ACTIVE** |
| **Hemalath** | `accounts@icontechpro.in`| **Accounts** | Finance & Billing | Office | **PROVISIONED & ACTIVE** |
| **Manisha** | `service01@icontechpro.in`| **Office Assistant**| Service Coordination | **Remote (Home)** | **PROVISIONED & ACTIVE** |

---

## 2. REMOTE EMPLOYEE PROFILE & SECURITY SPECIFICATION

### 2.1 Remote Employee Profile
- **Employee Name:** Manisha
- **Authorized Role:** Office Assistant / Service Coordinator
- **Email Address:** `service01@icontechpro.in`
- **Work Modality:** Remote from home (laptop internet connection)
- **Primary Operational Scope:** Customer directory inquiries, service ticket intake, Rule 55 delivery challan generation, dispatch documentation, and coordination between field technicians and clients.

### 2.2 Remote Access Security Rules
1. **Identical Role Authorization:** Manisha receives the exact same permissions as an on-premise Office Assistant. Working remotely does **NOT** grant administrative, financial, or management permissions.
2. **Confidentiality Guard:** Supplier purchase prices, distributor references, and profit margins are completely hidden from her dashboard and records via `canViewPurchaseCosts`.
3. **No VPN or Office Wi-Fi Required:** Access is mediated over public HTTPS via modern web browsers (Chrome, Edge) without requiring complex networking or office hardware to remain powered on.
4. **Session Protection:** Remote sessions are secured with HTTP-only, SameSite cookies. Failed logins are subject to the standard 3-attempt account lockout service (30-minute block).

---

## 3. ROLE-BASED ACCESS CONTROL (RBAC) MATRIX

The table below summarizes the authoritative permissions granted to each employee role in UAT:

| Functional Capability | MD | Admin / BDM | Sales Executive | Accounts | Office Assistant (Remote) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Executive Dashboard & KPIs** | FULL | FULL | ASSIGNED ONLY | ACCOUNTS ONLY | RESTRICTED |
| **Open Files Cockpit** | FULL | FULL | ASSIGNED ONLY | FINANCIAL REVIEW | VIEW STATUS |
| **Create Project File** | YES | YES | YES | NO | NO |
| **Upload Customer PO** | YES | YES | YES | YES | NO |
| **Close as Lost Enquiry** | YES | YES | YES (No Order) | NO | NO |
| **Approve Order Cancellation** | YES | YES | NO | YES | NO |
| **Request File Reopening** | YES | YES | YES | NO | NO |
| **Approve File Reopening** | YES | YES | NO | NO | NO |
| **Transfer File Ownership** | YES | YES | NO | NO | NO |
| **Customer 360 Dossier** | FULL | FULL | ASSIGNED | BILLING INFO | BASIC INFO |
| **View Purchase Costs & Margins**| **YES** | **YES** | **STRICTLY DENIED** | **YES** | **STRICTLY DENIED** |
| **Quotation CPQ Engine** | FULL | FULL | CREATE / EDIT | VIEW / RECONCILE | NO |
| **Accounts Workspace & Tally** | FULL | VIEW / AUDIT | NO | **FULL (Hemalath)**| NO |
| **Verify Tally Ledger Matches** | YES | YES | NO | **YES** | NO |
| **Allocate Unallocated Receipts**| YES | YES | NO | **YES** | NO |
| **Delivery Challan (Rule 55)** | FULL | FULL | VIEW ASSIGNED | VIEW INVOICED | **CREATE / PRINT** |
| **CSV Data Export** | **YES** | **YES** | **STRICTLY DENIED** | **YES** | **STRICTLY DENIED** |
| **CSV Bulk Import** | **YES** | **YES** | **STRICTLY DENIED** | **NO** | **STRICTLY DENIED** |
| **User Administration & Lockout**| FULL | FULL | NO | NO | NO |

---

## 4. AUTHENTICATION & LOGIN INTEGRITY

As explicitly instructed by the business owner:
1. **Zero Login Module Modifications:** The login page (`src/app/(auth)/login/page.tsx`) and authentication actions (`src/app/(auth)/login/actions.ts`) remain unchanged.
2. **Individual Authentication:** Employees authenticate using their individual email addresses and secure passwords verified via PBKDF2-SHA512 with 100,000 iterations.
3. **Password Protection:** Plaintext passwords are never stored in the database, logged in audit records, or exposed across API boundaries.
4. **Session Invalidation:** Terminated or suspended sessions are immediately revoked across all active browser tabs using the global invalidations registry (`__ICON_SESSION_INVALIDATIONS__`).

---

## 5. SHARED WORKSPACE & CROSS-LOCATION HANDOFF VERIFICATION

All employees interact with the same centralized UAT database, allowing seamless cross-role and cross-location handoffs:

```
[Sales Exec: Vineet] ────────► Creates Open File (FILE-2026-9001) & Uploads PO
                                       │ (Automated Department Handoff)
                                       ▼
[Accounts: Hemalath] ────────► Receives file in Accounts Workspace, links to Tally,
                               records invoice & matches advance bank receipt
                                       │ (Status updated to Partially Invoiced)
                                       ▼
[Remote Staff: Manisha] ─────► Views confirmed dispatch requirement, prepares Rule 55
                               Delivery Challan for site delivery from her home laptop
                                       │ (Fulfilment status updated)
                                       ▼
[Managing Director: Borra] ──► Views complete end-to-end commercial profitability,
                               margin (28.8%), and status in Executive Dashboard
```

This cross-departmental workflow operates simultaneously and in real time, regardless of whether staff are located in the Hyderabad office, on customer sites, or working remotely from home.

---
*Certified by Independent Verification Agent on 2026-11-09.*
