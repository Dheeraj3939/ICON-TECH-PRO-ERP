#!/usr/bin/env node
/**
 * ICON TECH PRO ERP - Non-Intrusive Inbound Bridge Agent for TallyPrime 7.2
 *
 * STRICT ARCHITECTURAL INVARIANT:
 * - 100% READ-ONLY TOWARDS TALLY PRIME.
 * - This agent NEVER writes, alters, creates, imports, or modifies any data in Tally.
 * - Data flows ONE-WAY: TallyPrime -> ICON TECH PRO ERP.
 * - Queries ONLY the currently active open company in memory.
 * - NEVER scans disk directories or unmigrated historical company folders.
 */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const ERP_URL = (process.env.ERP_URL || 'https://icon-erp-uat-web-production.up.railway.app').replace(/\/+$/, '');
const BRIDGE_SECRET = (process.env.TALLY_BRIDGE_SECRET || 'a263b233f0ebb66a74908108d10a03199aec7b37110f34a980aff9a63a808502').trim();
let TALLY_ENDPOINT = (process.env.TALLY_ENDPOINT || 'http://127.0.0.1:9000').replace(/\/+$/, '');
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 20000);
const HOSTNAME = os.hostname();
const STATE_FILE = path.resolve(process.cwd(), 'tally-bridge-state.json');

if (!BRIDGE_SECRET) {
  console.error('[TallyBridge] FATAL ERROR: TALLY_BRIDGE_SECRET environment variable is required.');
  process.exit(1);
}

// Local persistent sync state
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    // Fresh state
  }
  return {
    lastAlterId: 0,
    lastSyncTimestamp: null,
    activeCompany: '',
    ledgersSynced: false,
    lastLedgerSyncTimestamp: null,
  };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.warn('[TallyBridge] Warning: Could not save state file:', err.message);
  }
}

// STRICT INVARIANT CHECK: Only Export requests are permitted
function assertReadOnlyXml(xmlPayload) {
  const forbiddenPatterns = [
    /<TALLYREQUEST>\s*Import\b/i,
    /<TALLYREQUEST>\s*Execute\b/i,
    /ISMODIFY\s*=\s*["']Yes["']/i,
    /<ACTION>\s*Create\b/i,
    /<ACTION>\s*Alter\b/i,
    /<ACTION>\s*Delete\b/i,
  ];
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(xmlPayload)) {
      throw new Error(
        `CRITICAL SAFETY VIOLATION: Attempted to touch/modify Tally! Forbidden payload detected matching ${pattern}. Operation aborted.`
      );
    }
  }
}

async function postXmlToTally(endpoint, xmlPayload) {
  assertReadOnlyXml(xmlPayload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: xmlPayload,
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

function parseXmlTag(xmlBlock, tag) {
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xmlBlock.match(regex);
  return match ? match[1].trim() : '';
}

// Safe In-Memory Active Company Check (Does NOT scan disk folders)
const ACTIVE_COMPANY_PROBE_XML = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>CompanyDetails</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <REPORT NAME="ActiveCompanyReport">
            <FORMS>ActiveCompanyForm</FORMS>
          </REPORT>
          <FORM NAME="ActiveCompanyForm">
            <PARTS>ActiveCompanyPart</PARTS>
          </FORM>
          <PART NAME="ActiveCompanyPart">
            <LINES>ActiveCompanyLine</LINES>
          </PART>
          <LINE NAME="ActiveCompanyLine">
            <FIELDS>ActiveCompanyNameField</FIELDS>
          </LINE>
          <FIELD NAME="ActiveCompanyNameField">
            <SET>##SVCURRENTCOMPANY</SET>
          </FIELD>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

// Export Ledgers Query (Queries active loaded company only)
const LEDGER_EXPORT_XML = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>ICONLedgerCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="ICONLedgerCollection" ISMODIFY="No">
            <TYPE>Ledger</TYPE>
            <FETCH>NAME, PARENT, CLOSINGBALANCE, OPENINGBALANCE, PARTYGSTIN, STATENAME, LEDGERPHONE, EMAIL, GUID, ALTERID</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

function parseTallyLedgers(xmlText) {
  const ledgers = [];
  const regex = /<LEDGER\b[^>]*>([\s\S]*?)<\/LEDGER>/gi;
  let match;
  while ((match = regex.exec(xmlText)) !== null) {
    const block = match[1];
    const nameAttrMatch = match[0].match(/NAME="([^"]+)"/i);
    const name = nameAttrMatch ? nameAttrMatch[1] : parseXmlTag(block, 'NAME');
    if (!name) continue;

    const parent = parseXmlTag(block, 'PARENT');
    const closingBalance = parseFloat(parseXmlTag(block, 'CLOSINGBALANCE')) || 0;
    const openingBalance = parseFloat(parseXmlTag(block, 'OPENINGBALANCE')) || 0;
    const gstin = parseXmlTag(block, 'PARTYGSTIN');
    const state = parseXmlTag(block, 'STATENAME');
    const phone = parseXmlTag(block, 'LEDGERPHONE');
    const email = parseXmlTag(block, 'EMAIL');
    const alterId = parseInt(parseXmlTag(block, 'ALTERID'), 10) || 0;
    const guid = parseXmlTag(block, 'GUID');

    ledgers.push({
      name,
      parent,
      closingBalance,
      openingBalance,
      gstin,
      state,
      phone,
      email,
      alterId,
      guid,
    });
  }
  return ledgers;
}

// Export Incremental Vouchers Query ($ALTERID > lastAlterId)
function buildVoucherExportXml(lastAlterId) {
  const hasFilter = lastAlterId > 0;
  return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>ICONVoucherCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="ICONVoucherCollection" ISMODIFY="No">
            <TYPE>Voucher</TYPE>
            <FETCH>VOUCHERNUMBER, VOUCHERTYPENAME, DATE, REFERENCE, PARTYLEDGERNAME, PARTYGSTIN, AMOUNT, NARRATION, GUID, ALTERID, ALLLEDGERENTRIES.LIST</FETCH>
            ${hasFilter ? '<FILTER>IncrementalAlterFilter</FILTER>' : ''}
          </COLLECTION>
          ${hasFilter ? `<SYSTEM TYPE="Formulae" NAME="IncrementalAlterFilter">$$Number:$ALTERID > ${lastAlterId}</SYSTEM>` : ''}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function parseTallyVouchers(xmlText) {
  const vouchers = [];
  const regex = /<VOUCHER\b[^>]*>([\s\S]*?)<\/VOUCHER>/gi;
  let match;
  while ((match = regex.exec(xmlText)) !== null) {
    const block = match[1];
    const voucherNumber = parseXmlTag(block, 'VOUCHERNUMBER');
    const voucherType = parseXmlTag(block, 'VOUCHERTYPENAME');
    const rawDate = parseXmlTag(block, 'DATE');
    let date = '';
    if (rawDate && rawDate.length === 8) {
      date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    }
    const reference = parseXmlTag(block, 'REFERENCE');
    let partyName = parseXmlTag(block, 'PARTYLEDGERNAME') || parseXmlTag(block, 'PARTYNAME') || parseXmlTag(block, 'BASICBUYERNAME');
    let partyGstin = parseXmlTag(block, 'PARTYGSTIN') || parseXmlTag(block, 'PARTYGSTINNUMBER');
    const narration = parseXmlTag(block, 'NARRATION');
    const guid = parseXmlTag(block, 'GUID');
    const alterId = parseInt(parseXmlTag(block, 'ALTERID'), 10) || 0;

    const ledgerEntries = [];
    const lRegex = /<ALLLEDGERENTRIES\.LIST\b[^>]*>([\s\S]*?)<\/ALLLEDGERENTRIES\.LIST>/gi;
    let lMatch;
    let voucherAmount = 0;

    while ((lMatch = lRegex.exec(block)) !== null) {
      const lBlock = lMatch[1];
      const ledgerName = parseXmlTag(lBlock, 'LEDGERNAME');
      const isDeemedPositive = parseXmlTag(lBlock, 'ISDEEMEDPOSITIVE').toUpperCase() === 'YES';
      const rawAmt = parseFloat(parseXmlTag(lBlock, 'AMOUNT')) || 0;
      const amount = Math.abs(rawAmt);

      if (ledgerName === partyName && amount > voucherAmount) {
        voucherAmount = amount;
      }

      const billAllocations = [];
      const bRegex = /<BILLALLOCATIONS\.LIST\b[^>]*>([\s\S]*?)<\/BILLALLOCATIONS\.LIST>/gi;
      let bMatch;
      while ((bMatch = bRegex.exec(lBlock)) !== null) {
        const bBlock = bMatch[1];
        billAllocations.push({
          name: parseXmlTag(bBlock, 'NAME'),
          billType: parseXmlTag(bBlock, 'BILLTYPE'),
          amount: Math.abs(parseFloat(parseXmlTag(bBlock, 'AMOUNT')) || 0),
        });
      }

      ledgerEntries.push({
        ledgerName,
        isDeemedPositive,
        amount,
        billAllocations,
      });
    }

    if (!partyName && ledgerEntries.length > 0) {
      const candidate = ledgerEntries.find(
        (e) => !/sales|purchase|tax|gst|cgst|sgst|igst|round|duty|discount|freight/i.test(e.ledgerName)
      );
      if (candidate) {
        partyName = candidate.ledgerName;
      }
    }

    if (voucherAmount === 0 && ledgerEntries.length > 0) {
      voucherAmount = Math.max(...ledgerEntries.map((e) => e.amount));
    }

    vouchers.push({
      voucherNumber,
      voucherType,
      date,
      reference,
      partyName,
      partyGstin,
      narration,
      amount: voucherAmount,
      guid,
      alterId,
      ledgerEntries,
    });
  }
  return vouchers;
}

let syncCycleCount = 0;

async function probeActiveCompany() {
  const endpointsToTry = [
    TALLY_ENDPOINT,
    'http://127.0.0.1:9000',
    'http://127.0.0.1:9999',
  ];

  for (const ep of endpointsToTry) {
    try {
      // 1. Try safe in-memory active company query
      const probe = await postXmlToTally(ep, ACTIVE_COMPANY_PROBE_XML);
      if (probe.ok) {
        const text = probe.text;
        const compMatch = text.match(/<FIELD\b[^>]*>([\s\S]*?)<\/FIELD>/i) ||
                          text.match(/<LINE\b[^>]*>([\s\S]*?)<\/LINE>/i);
        const compName = compMatch ? compMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        TALLY_ENDPOINT = ep;
        return { reachable: true, activeCompany: compName || undefined, endpoint: ep };
      }
    } catch (err) {
      // try next endpoint
    }
  }

  // 2. Fallback: try ledger export directly on 127.0.0.1:9000
  try {
    const lProbe = await postXmlToTally(TALLY_ENDPOINT, LEDGER_EXPORT_XML);
    if (lProbe.ok && lProbe.text.includes('<LEDGER')) {
      return { reachable: true, activeCompany: undefined, endpoint: TALLY_ENDPOINT };
    }
  } catch (err) {
    // not responding
  }

  return { reachable: false, activeCompany: undefined, endpoint: TALLY_ENDPOINT };
}

const LEDGER_BATCH_SIZE = 150;
const VOUCHER_BATCH_SIZE = 75;

async function sendToErp(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${ERP_URL}/api/integrations/tally/bridge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BRIDGE_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data, error: !res.ok ? text.slice(0, 200) : null };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

let isSyncRunning = false;

async function syncCycle() {
  if (isSyncRunning) return;
  isSyncRunning = true;

  try {
    syncCycleCount += 1;
    const state = loadState();
    let activeCompany = state.activeCompany || 'ICON TECH PRO - 2026-27';

    // Step 1: Safe probe (does NOT scan disk folders)
    const probe = await probeActiveCompany();

    if (!probe.reachable) {
      console.log(
        `[TallyBridge] Waiting for active company in TallyPrime (checked 127.0.0.1:9000)...\n` +
        `  -> Please ensure TallyPrime is open with your active company loaded on screen.`
      );
      return;
    }

    if (probe.activeCompany) {
      activeCompany = probe.activeCompany;
      state.activeCompany = activeCompany;
    }

    // Step 2: Extract & Stream Ledgers if not already synced
    if (!state.ledgersSynced) {
      console.log(`[TallyBridge] Step 1/2: Exporting Ledgers from Tally [${activeCompany}]...`);
      let ledgers = [];
      try {
        const ledgerRes = await postXmlToTally(TALLY_ENDPOINT, LEDGER_EXPORT_XML);
        if (ledgerRes.ok) {
          ledgers = parseTallyLedgers(ledgerRes.text);
        }
      } catch (err) {
        console.warn(`[TallyBridge] Could not export ledgers: ${err.message}`);
      }

      if (ledgers.length > 0) {
        const totalBatches = Math.ceil(ledgers.length / LEDGER_BATCH_SIZE);
        console.log(
          `[TallyBridge] Found ${ledgers.length} ledgers. Transmitting to ERP in ${totalBatches} batches (${LEDGER_BATCH_SIZE} per batch)...`
        );

        let allBatchesOk = true;
        for (let i = 0; i < totalBatches; i++) {
          const chunk = ledgers.slice(i * LEDGER_BATCH_SIZE, (i + 1) * LEDGER_BATCH_SIZE);
          const res = await sendToErp({
            hostname: HOSTNAME,
            endpoint: TALLY_ENDPOINT,
            activeCompany,
            tallyVersion: 'TallyPrime 7.2',
            companies: i === 0 && activeCompany ? [{ name: activeCompany, is_active: true }] : [],
            ledgers: chunk,
          });

          if (!res.ok) {
            console.error(
              `  -> [Ledgers] Batch ${i + 1}/${totalBatches} failed (HTTP ${res.status}): ${res.error}. Pausing ledger sync.`
            );
            allBatchesOk = false;
            break;
          }

          console.log(
            `  -> [Ledgers] Batch ${i + 1}/${totalBatches} (${chunk.length} ledgers) mapped in ERP [OK]`
          );
        }

        if (allBatchesOk) {
          state.ledgersSynced = true;
          state.lastLedgerSyncTimestamp = new Date().toISOString();
          saveState(state);
          console.log(`[TallyBridge] All ${ledgers.length} ledgers successfully mapped and verified!`);
        }
      }
    }

    // Step 3: Extract Incremental Vouchers ($ALTERID > lastAlterId)
    let vouchers = [];
    try {
      const voucherXml = buildVoucherExportXml(state.lastAlterId);
      const voucherRes = await postXmlToTally(TALLY_ENDPOINT, voucherXml);
      if (voucherRes.ok) {
        const rawVouchers = parseTallyVouchers(voucherRes.text);
        vouchers = state.lastAlterId > 0
          ? rawVouchers.filter((v) => v.alterId > state.lastAlterId)
          : rawVouchers;
      }
    } catch (err) {
      console.warn(`[TallyBridge] Could not export vouchers: ${err.message}`);
    }

    // If no new vouchers, send lightweight heartbeat
    if (vouchers.length === 0) {
      if (state.ledgersSynced) {
        const hbRes = await sendToErp({
          hostname: HOSTNAME,
          endpoint: TALLY_ENDPOINT,
          activeCompany,
          tallyVersion: 'TallyPrime 7.2',
          lastAlterId: state.lastAlterId,
          heartbeatOnly: true,
        });

        if (hbRes.ok && hbRes.data?.resetAlterId !== undefined) {
          console.log(
            `[TallyBridge] Server requested full re-alignment. Resetting AlterID from ${state.lastAlterId} to ${hbRes.data.resetAlterId}...`
          );
          state.lastAlterId = hbRes.data.resetAlterId;
          saveState(state);
        }

        console.log(
          `[TallyBridge] Cycle #${syncCycleCount} [${activeCompany}] - Up to date (AlterID: ${state.lastAlterId}, 0 new changes in Tally) [OK]`
        );
      }
      return;
    }

    // Sort incremental vouchers chronologically by AlterID
    vouchers.sort((a, b) => a.alterId - b.alterId);
    const totalVoucherBatches = Math.ceil(vouchers.length / VOUCHER_BATCH_SIZE);

    console.log(
      `[TallyBridge] Cycle #${syncCycleCount} [${activeCompany}] - Detected ${vouchers.length} new transactions in Tally. Transmitting in ${totalVoucherBatches} batches...`
    );

    for (let j = 0; j < totalVoucherBatches; j++) {
      const chunk = vouchers.slice(j * VOUCHER_BATCH_SIZE, (j + 1) * VOUCHER_BATCH_SIZE);
      let chunkMaxAlterId = state.lastAlterId;
      for (const v of chunk) {
        if (v.alterId > chunkMaxAlterId) chunkMaxAlterId = v.alterId;
      }

      const res = await sendToErp({
        hostname: HOSTNAME,
        endpoint: TALLY_ENDPOINT,
        activeCompany,
        tallyVersion: 'TallyPrime 7.2',
        lastAlterId: chunkMaxAlterId,
        vouchers: chunk,
      });

      if (!res.ok) {
        console.error(
          `  -> [Vouchers] Batch ${j + 1}/${totalVoucherBatches} failed (HTTP ${res.status}): ${res.error}. Stopping at AlterID: ${state.lastAlterId}.`
        );
        break;
      }

      state.lastAlterId = chunkMaxAlterId;
      state.lastSyncTimestamp = new Date().toISOString();
      saveState(state);

      console.log(
        `  -> [Vouchers] Batch ${j + 1}/${totalVoucherBatches} (${chunk.length} vouchers, up to AlterID: ${chunkMaxAlterId}) ingested into ERP [OK]`
      );
    }
  } finally {
    isSyncRunning = false;
  }
}

// Startup Banner
console.log('================================================================');
console.log(' ICON TECH PRO ERP - TallyPrime 7.2 Inbound Bridge Agent');
console.log(' Strictly Non-Intrusive & Read-Only Inbound Integration');
console.log('================================================================');
console.log(` Hostname        : ${HOSTNAME}`);
console.log(` Cloud ERP       : ${ERP_URL}`);
console.log(` Target Endpoint : http://127.0.0.1:9000`);
console.log(` Polling Cycle   : Every ${POLL_INTERVAL_MS / 1000} seconds`);
console.log(` State File      : ${STATE_FILE}`);
console.log(' Safety Check    : 100% Read-Only Export Envelopes (Zero Tally Write)');
console.log(' Memory Safety   : In-Memory Active Company Query (Zero Disk Scan)');
console.log(' Batching Model  : Chunked Streaming (150 Ledgers / 75 Vouchers per batch)');
console.log('================================================================\n');

await syncCycle();
setInterval(() => {
  syncCycle().catch((err) => console.error('[TallyBridge] Cycle unexpected exception:', err));
}, POLL_INTERVAL_MS);
