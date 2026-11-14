# ICON TECH PRO ERP — TALLYPRIME INTEGRATION: DETAILED TECHNICAL ARCHITECTURE DOCUMENT

**Document Identifier:** `ITP-TALLY-ARCH-V1.0`  
**Target Runtime:** TallyPrime 7.2 (Silver Edition Single-User) on Windows 10/11 Pro &bull; Cloud ERP on Next.js 15 + Supabase PostgreSQL  
**Document Classification:** Technical Architecture & Implementation Blueprint  
**Status:** **PLANNING ONLY — STRICTLY ON HOLD PENDING ACCOUNTS APPROVAL & TECHNICAL POC**  

---

## 1. Architectural Philosophy & Zero-Fake Principles

The technical design of the ICON TECH PRO ERP &ndash; TallyPrime Integration is built upon five non-negotiable principles:

1. **Air-Gapped Security (Zero Public Port Exposure):**
   - The office computer running TallyPrime 7.2 resides behind a local network firewall.
   - **Tally ports (9000, 9999, 10089) must NEVER be exposed to the public internet.** No port forwarding, no public dynamic DNS, and no insecure inbound listening ports.
2. **Outbound-Only Communication Topology:**
   - A lightweight, secure **Office Integration Agent** runs on the local Windows PC.
   - All network traffic is initiated outbound from the office agent to the ERP Cloud Ingestion Gateway over TLS 1.3 with mutual authentication.
3. **Non-Intrusive Single-User Concurrency:**
   - Because Tally operates under a **Silver Edition single-user licence**, the integration must never cause lock contention, freeze the UI, or interfere with Hemalath's active voucher entry.
4. **Deterministic Idempotency (Zero Duplicates):**
   - Every transaction payload carries a deterministic SHA-256 hash. Re-running a sync operation 100 times produces the exact same accounting state without generating duplicate vouchers.
5. **Traceable Raw Source Preservation:**
   - Inbound vouchers and ledgers are preserved in their raw XML/JSON envelope format before normalization into relational tables, providing an indisputable audit trail.

---

## 2. Proposed Integration Topology & End-to-End Data Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ICON TECH PRO OFFICE (HYDERABAD)                                │
│                                                                                        │
│  ┌─────────────────────────┐          ┌─────────────────────────────────────────────┐  │
│  │   TallyPrime 7.2        │          │   ICON Secure Office Agent (Windows Svc)    │  │
│  │  (Silver Single-User)   │          │                                             │  │
│  │                         │  HTTP    │  • Scheduled / Event-Driven Polling         │  │
│  │  • HTTP XML/JSON Server │◄─────────┤  • Reads Tally Export Envelopes             │  │
│  │  • ODBC Server (9000)   │ Localhost│  • Computes AlterID & GUID Checksums        │  │
│  │  • Company: 2026-27     │          │  • AES-256 Envelope Packaging               │  │
│  └─────────────────────────┘          └──────────────────────┬──────────────────────┘  │
└──────────────────────────────────────────────────────────────┼─────────────────────────┘
                                                               │ Outbound HTTPS / TLS 1.3
                                                               │ Bearer Token + HMAC Sig
                                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ICON TECH PRO ERP CLOUD (AWS ap-south-1)                        │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │   ERP Ingestion Gateway (`/api/integrations/tally/sync`)                         │  │
│  │   • Validates Agent Signature & IP Whitelist                                     │  │
│  │   • Deduplicates Payload via Deterministic Hash Check                            │  │
│  └──────────────────────────────────────────┬───────────────────────────────────────┘  │
│                                             │                                          │
│                                             ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │   Staging Layer (`tally_sync_queue` & `tally_vouchers_raw`)                      │  │
│  │   • Stores Raw XML / JSON Payload                                                │  │
│  │   • Manages Synchronization State Machine (PENDING → PROCESSING → SUCCESS)       │  │
│  └──────────────────────────────────────────┬───────────────────────────────────────┘  │
│                                             │                                          │
│                                             ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │   Relational Business Core (Supabase PostgreSQL)                                 │  │
│  │   • `invoices` & `payments` with Bill-Wise Allocations                           │  │
│  │   • `customers` & `suppliers` Ledger References                                  │  │
│  │   • `customer_purchase_orders` & `delivery_challans`                             │  │
│  └──────────────────────────────────────────┬───────────────────────────────────────┘  │
│                                             │                                          │
│                                             ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │   Enterprise Central Audit Ledger & SHA-256 Hash Chain                           │  │
│  │   • Permanent Non-Repudiation Log of All Accounting Changes                      │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Protocol, Port & Endpoint Feasibility Analysis

Inspection of the office computer settings reveals three distinct port configurations that must be correctly understood:

| Port Identified | Configuration Label | Technical Protocol | Feasibility for Cloud ERP Integration |
| :---: | :--- | :--- | :--- |
| **9999** | **Gateway Server** | Proprietary Tally Net Protocol | Internal Tally licensing and multi-instance communications. **Not usable for custom JSON/REST API calls.** |
| **9000** | **ODBC Server** | ODBC / SQL (Read-Only) | Provides read-only relational querying via DSN. **Read-only; cannot push transactions.** High latency over remote networks. Useful for local data extraction scripts only. |
| **10089** | **Scheduler Port** | Internal Scheduler | Used by Tally for automated backups and recurring statutory tasks. **Not an external integration API.** |
| **TBD (Target)**| **Tally HTTP Server** | **HTTP / XML or JSONEx** | **The true integration endpoint.** By default, TallyPrime HTTP server operates on port `9000` (shared or configured separately under `F12 > Advanced Configuration > Client/Server configuration`). Must be verified. |

### Protocol Evaluation: XML vs JSON
1. **Tally XML Interface (Standard & Universal):**
   - TallyPrime has native, mature support for `<ENVELOPE>` XML format via HTTP POST to `http://localhost:PORT`.
   - Supports `<HEADER>`, `<BODY>`, `<DATA>`, and `<TALLYMESSAGE>`.
   - Exporting ledgers and vouchers using XML collections is 100% supported across all Tally versions.
2. **Tally JSON / JSONEx Interface:**
   - Supported in modern TallyPrime releases for specific reporting collections.
   - Syntax is less standardized across custom TDL add-ons than XML.
   - **Recommendation:** Build the integration adapter with dual-parser capability:
     - **Primary Transport:** Native Tally XML export/import envelopes for 100% reliable schema parsing.
     - **ERP Internal Serialization:** Normalized JSON within the ERP database and UI inspector.

---

## 4. Silver Single-User Licence Constraints & Concurrency Handling

### 4.1 The Single-User Challenge
TallyPrime Silver Edition permits exactly **one concurrent interactive user session**. If an automated background script opens a heavy, blocking connection or executes long-running SQL/ODBC queries while Hemalath is actively entering vouchers, Tally can:
- Throw error `Another process is currently accessing company data`.
- Experience noticeable keystroke lag or UI freezing on the office PC.
- Abort active voucher saves.

### 4.2 Non-Intrusive Mitigation Architecture
To guarantee zero disruption to Hemalath's daily work:
1. **Micro-Batch Delta Polling:**
   - The office agent queries Tally only for incremental changes using `ALTERID > LastSyncAlterId`.
   - Query execution duration: **< 150 milliseconds**.
2. **Activity-Aware Throttling:**
   - The agent detects keyboard/mouse idle time on the office workstation.
   - Heavy synchronization passes (e.g. historical data extract, full ledger audits) are scheduled during off-hours: **Lunch break (13:30 - 14:15 IST)** and **Post-close (19:00 - 08:00 IST)**.
3. **Dedicated Manual "Sync Now" Control:**
   - Hemalath can trigger on-demand sync directly from her Accounts workspace when she is ready, giving her absolute operational control.
4. **Short-Lived HTTP Requests:**
   - The agent uses non-persistent HTTP connections (`Connection: close`) ensuring Tally never holds open worker threads.

---

## 5. Proposed Database Schema & Entity Relational Design

To support Tally integration without modifying existing ERP core tables, the following additive relational entities are proposed for future database migration:

```sql
-- 1. Tally Companies Registry
CREATE TABLE IF NOT EXISTS public.tally_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    company_guid TEXT UNIQUE,
    financial_year_start DATE NOT NULL,
    financial_year_end DATE NOT NULL,
    is_active_book BOOLEAN DEFAULT FALSE,
    is_historical_archive BOOLEAN DEFAULT FALSE,
    requires_migration BOOLEAN DEFAULT FALSE,
    last_synced_alter_id BIGINT DEFAULT 0,
    last_sync_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tally Master Ledger Mappings
CREATE TABLE IF NOT EXISTS public.tally_ledger_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tally_company_id UUID REFERENCES public.tally_companies(id),
    tally_ledger_guid TEXT NOT NULL,
    tally_ledger_name TEXT NOT NULL,
    tally_parent_group TEXT NOT NULL, -- Sundry Debtors, Sundry Creditors, Duties & Taxes, etc.
    gstin TEXT,
    pan TEXT,
    state_name TEXT,
    erp_entity_type TEXT NOT NULL, -- 'CUSTOMER', 'SUPPLIER', 'TAX_LEDGER', 'BANK_ACCOUNT'
    erp_entity_id UUID, -- References customers(id) or suppliers(id)
    mapping_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW', -- 'VERIFIED', 'AUTO_MATCHED', 'PENDING_REVIEW', 'CONFLICT'
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by_user_id UUID,
    verified_at TIMESTAMPTZ,
    raw_ledger_xml TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tally_company_id, tally_ledger_guid)
);

-- 3. Raw Vouchers Archive (Audit Source of Truth)
CREATE TABLE IF NOT EXISTS public.tally_vouchers_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tally_company_id UUID REFERENCES public.tally_companies(id),
    voucher_guid TEXT NOT NULL,
    voucher_alter_id BIGINT NOT NULL,
    voucher_type TEXT NOT NULL, -- Sales, Receipt, Payment, Purchase, Credit Note, Debit Note
    voucher_number TEXT NOT NULL,
    voucher_date DATE NOT NULL,
    effective_date DATE,
    payload_hash TEXT NOT NULL, -- Deterministic SHA-256
    raw_payload_xml TEXT,
    raw_payload_json JSONB,
    is_cancelled BOOLEAN DEFAULT FALSE,
    is_deleted_in_tally BOOLEAN DEFAULT FALSE,
    ingested_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tally_company_id, voucher_guid)
);

-- 4. Bill-Wise Allocations Ledger
CREATE TABLE IF NOT EXISTS public.tally_bill_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_voucher_id UUID REFERENCES public.tally_vouchers_raw(id),
    invoice_voucher_id UUID REFERENCES public.tally_vouchers_raw(id),
    customer_id UUID,
    bill_reference_number TEXT NOT NULL, -- e.g. ICON/26-27/INV-0042
    allocation_type TEXT NOT NULL, -- 'Agst Ref', 'New Ref', 'Advance', 'On Account'
    allocated_amount NUMERIC(14, 2) NOT NULL,
    allocation_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Customer Purchase Orders (Operational PO Tracker)
CREATE TABLE IF NOT EXISTS public.customer_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    po_number TEXT NOT NULL,
    po_date DATE NOT NULL,
    total_po_value NUMERIC(14, 2) NOT NULL,
    payment_terms_days INTEGER DEFAULT 30,
    due_date_trigger_event TEXT NOT NULL DEFAULT 'INVOICE_DATE', -- 'INVOICE_DATE', 'DELIVERY_DATE', 'GRN_ACCEPTANCE', 'INSTALLATION'
    delivery_deadline DATE,
    document_scan_url TEXT,
    file_name TEXT,
    file_size_bytes INTEGER,
    uploaded_by_user_id UUID,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'FULFILLED', 'AMENDED', 'CANCELLED'
    special_terms TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, po_number)
);

-- 6. Tally Ingestion Queue & Reconciliation Snapshots
CREATE TABLE IF NOT EXISTS public.tally_reconciliation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tally_company_id UUID REFERENCES public.tally_companies(id),
    snapshot_date DATE NOT NULL,
    entity_type TEXT NOT NULL, -- 'DEBTORS_LEDGER', 'CREDITORS_LEDGER', 'BANK_BOOK', 'TAX_LIABILITY'
    tally_total_balance NUMERIC(14, 2) NOT NULL,
    erp_total_balance NUMERIC(14, 2) NOT NULL,
    variance_amount NUMERIC(14, 2) NOT NULL,
    reconciliation_status TEXT NOT NULL, -- 'MATCHED', 'DISCREPANCY_FLAGGED', 'RESOLVED'
    discrepancy_details JSONB,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Entity Identity, Correlation & Deterministic Hashing

### 6.1 Avoiding Fragile Natural Keys
In Tally, voucher numbers (e.g. `INV-001`) can theoretically be edited, re-numbered during financial year splits, or altered during voucher cancellation. 
- **The Invariant:** The integration must **never** rely solely on the visible `Voucher Number` as a database primary key.
- **Authoritative Identity:** Every Tally entity is tracked by its immutable system attributes:
  1. `VOUCHER_GUID`: Permanent global identifier generated by Tally upon record creation.
  2. `ALTERID`: Monotonically increasing 64-bit integer tracking every modification event.
  3. `PAYLOAD_HASH`: SHA-256 hash of all canonical line items, ledger amounts, and tax heads.

```typescript
// Deterministic Hash Computation for Idempotency
import crypto from 'node:crypto';

export function computeTallyPayloadHash(voucher: {
  guid: string;
  alterId: number;
  voucherNumber: string;
  voucherDate: string;
  partyLedger: string;
  amount: number;
  lineItems: Array<{ hsn: string; qty: number; rate: number; taxable: number }>;
}): string {
  const normalized = JSON.stringify({
    guid: voucher.guid,
    alterId: voucher.alterId,
    num: voucher.voucherNumber.trim().toUpperCase(),
    dt: voucher.voucherDate,
    party: voucher.partyLedger.trim().toLowerCase(),
    amt: voucher.amount.toFixed(2),
    items: voucher.lineItems.map(i => `${i.hsn}:${i.qty}:${i.rate}:${i.taxable}`).sort(),
  });
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
```

---

## 7. Synchronization Lifecycle & State Machine

Every synchronization item transitions through a strict, deterministic state machine:

```
[STAGED] ──► [QUEUED] ──► [VALIDATING] ──► [INGESTED] ──► [RECONCILED]
                              │
                              ▼ (ValidationError / Conflict)
                         [REVIEW_QUEUE]
                              │
                              ▼ (After Max Retries)
                         [DEAD_LETTER_QUEUE (DLQ)]
```

| State | Definition & Conditions | Automated Action |
| :--- | :--- | :--- |
| `STAGED` | Agent on office computer identified changed record via `ALTERID`. | Generates envelope, computes SHA-256 hash. |
| `QUEUED` | Payload delivered to Cloud ERP Gateway; hash verified. | Staged in `tally_vouchers_raw`. |
| `VALIDATING` | ERP verifies customer mapping, GSTIN, and line-item sums. | Verifies against ledger mappings. |
| `INGESTED` | Record written to ERP relational tables (`invoices`, `payments`). | Financial balances recalculated. |
| `RECONCILED` | Midnight audit confirmed Tally closing balance matches ERP. | Snapshot marked `MATCHED`. |
| `REVIEW_QUEUE`| Customer ledger unmapped or PO value conflict detected. | Routed to Hemalath's Accounts Workspace. |
| `DLQ` | Unrecoverable schema error after 3 automated retries. | Generates critical system alert. |

---

## 8. Error Handling, Retry Policies & Dead-Letter Queue (DLQ)

1. **Transient Network Errors:**
   - Office internet disconnects, timeouts, or Cloudflare Tunnel drops are handled with **Exponential Backoff with Jitter**:
     - Retry 1: 30 seconds
     - Retry 2: 120 seconds
     - Retry 3: 300 seconds
2. **Circuit Breaker Protocol:**
   - If Tally HTTP server fails to respond to 5 consecutive pings, the agent trips its circuit breaker for 15 minutes to avoid CPU spinning.
3. **Dead-Letter Queue (DLQ):**
   - Corrupted XML payloads or unresolvable schema conflicts are quarantined in the DLQ with the complete stack trace and raw XML payload preserved for engineering inspection.

---

## 9. Security, Encryption & Network Hardening

1. **Zero Public Inbound Ports:** The office computer makes outbound TLS 1.3 requests only.
2. **Mutual Agent Authentication:**
   - The office agent is authenticated via an enterprise JWT token signed with an isolated integration secret (`TALLY_INTEGRATION_AGENT_SECRET`).
   - Every request includes an `X-Icon-Tally-Signature` header computed as `HMAC-SHA256(payload, secret)`.
3. **IP Range Restriction:** The ERP Gateway accepts agent sync requests only from authorized office static IP ranges or an encrypted zero-trust tunnel.
4. **Data Redaction in Transit:** Sensitive employee credentials and raw server path directories are scrubbed from all diagnostic logs.

---

## 10. Two-Way Automated Reconciliation Engine

Every night at **00:00 Asia/Kolkata**, the automated reconciliation engine executes a non-intrusive ledger audit:
1. **Ledger Balance Comparison:** Compares closing debtor balances in Tally against cumulative outstanding invoices in ERP.
2. **Variance Highlighting:** Any variance $> ₹1.00$ triggers a `RECONCILIATION_DISCREPANCY` record with:
   - Client Ledger Name.
   - Tally Closing Balance.
   - ERP Calculated Balance.
   - Unallocated receipts or missing credit notes identified as the likely root cause.
3. **Audit Snapshot:** Saved to `tally_reconciliation_snapshots` for monthly chartered accountant review.

---

## 11. Technical Uncertainties & Pre-Implementation Proof of Concept (POC) Plan

Before writing production integration code, the following items must be verified directly on the office workstation:

| # | Technical Uncertainty | Verification Procedure | Required Outcome |
| :---: | :--- | :--- | :--- |
| **U1** | **HTTP Server Port** | Inspect `F12 > Advanced Configuration > Client/Server configuration` in TallyPrime. | Confirm whether HTTP XML server is enabled and its exact port (9000 vs 9999 vs custom). |
| **U2** | **Single-User Lock Concurrency** | Send an automated XML collection export while Hemalath enters a dummy invoice. | Confirm zero UI lag or concurrency errors on the Silver licence. |
| **U3** | **TDL Add-on Compatibility** | Inspect the installed TDL add-on and plug-in visible in Tally. | Confirm whether custom TDL alters standard voucher XML tags (`ALLLEDGERENTRIES.LIST`). |
| **U4** | **Historical Company Schema** | Run a test schema extraction on `ICON TECH PRO - 2024-25 Old Data`. | Identify which historical companies require schema migration before import. |
| **U5** | **Bill Allocation Extraction** | Export a multi-bill payment voucher via XML. | Verify presence of `BILLALLOCATIONS.LIST` with `BILLTYPE` (`Agst Ref`). |

---

*Detailed Technical Architecture Document prepared for technical review and security audit.*
