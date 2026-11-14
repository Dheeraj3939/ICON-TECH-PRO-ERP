import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';

const SECRET = 'a263b233f0ebb66a74908108d10a03199aec7b37110f34a980aff9a63a808502';
const API_URL = 'https://icon-erp-uat-web-production.up.railway.app';

console.log('--- RUNNING TALLY INBOUND INTEGRATION TEST ---');

async function runTest() {
  // Test Inbound Payload
  const payload = {
    hostname: 'ICON-OFFICE-TALLY-PC',
    endpoint: 'http://localhost:9000',
    activeCompany: 'ICON TECH PRO - 2026-27',
    tallyVersion: 'TallyPrime 7.2',
    lastAlterId: 2095,
    companies: [
      {
        name: 'ICON TECH PRO - 2026-27',
        tally_guid: 'comp-icon-2627-live-primary',
        books_from: '2026-04-01',
        is_active: true,
      },
    ],
    ledgers: [
      {
        name: 'T-Hub Foundation',
        parent: 'Sundry Debtors',
        closingBalance: -94400,
        openingBalance: 0,
        gstin: '36AABCT1234D1Z5',
        state: 'Telangana',
        alterId: 2041,
        guid: 'tally-guid-thub-001',
      },
      {
        name: 'HDFC Bank Current Account',
        parent: 'Bank Accounts',
        closingBalance: 1250000,
        openingBalance: 500000,
        alterId: 1050,
        guid: 'tally-guid-hdfc-001',
      },
    ],
    vouchers: [
      {
        voucherNumber: 'ICON/26-27/0099',
        voucherType: 'Sales',
        date: '2026-11-14',
        reference: 'PO-THUB-2026-12',
        partyName: 'T-Hub Foundation',
        partyGstin: '36AABCT1234D1Z5',
        narration: 'Interactive Display Supply - Test Sync',
        amount: 94400,
        guid: 'vch-guid-sales-99',
        alterId: 2090,
        ledgerEntries: [
          {
            ledgerName: 'T-Hub Foundation',
            isDeemedPositive: true,
            amount: 94400,
            billAllocations: [
              {
                name: 'ICON/26-27/0099',
                billType: 'New Ref',
                amount: 94400,
              },
            ],
          },
        ],
      },
      {
        voucherNumber: 'RCPT-26-0045',
        voucherType: 'Receipt',
        date: '2026-11-14',
        partyName: 'T-Hub Foundation',
        narration: 'Payment via NEFT UTR HDFC00998877',
        amount: 94400,
        guid: 'vch-guid-rcpt-45',
        alterId: 2095,
        ledgerEntries: [
          {
            ledgerName: 'HDFC Bank Current Account',
            isDeemedPositive: true,
            amount: 94400,
            billAllocations: [],
          },
          {
            ledgerName: 'T-Hub Foundation',
            isDeemedPositive: false,
            amount: 94400,
            billAllocations: [
              {
                name: 'ICON/26-27/0099',
                billType: 'Agst Ref',
                amount: 94400,
              },
            ],
          },
        ],
      },
    ],
  };

  // 1. Test POST against Railway UAT
  console.log('1. Posting Inbound Tally Data to Cloud ERP API...');
  const res = await fetch(`${API_URL}/api/integrations/tally/bridge`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  console.log('HTTP Status:', res.status);
  const data = await res.json();
  console.log('API Response:', data);

  assert.equal(res.status, 200, 'Expected HTTP 200');
  assert.equal(data.ok, true, 'Expected ok: true');
  assert.equal(data.activeCompany, 'ICON TECH PRO - 2026-27');
  console.log('✓ POST Inbound Integration verified!');

  // 2. Test GET probe
  console.log('\n2. Probing GET Heartbeat Telemetry...');
  const getRes = await fetch(`${API_URL}/api/integrations/tally/bridge`, {
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  const getData = await getRes.json();
  console.log('GET Probe Response:', getData);
  assert.equal(getRes.status, 200);
  assert.equal(getData.ok, true);
  console.log('✓ GET Probe verified!');

  console.log('\n==================================================');
  console.log(' ALL INBOUND TALLY TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================');
}

runTest().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
