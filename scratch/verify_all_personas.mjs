import http from 'http';

const personas = [
  { name: 'Narsimha Naidu', role: 'Managing Director' },
  { name: 'Dheeraj', role: 'Admin / BDM' },
  { name: 'Vineet Babu', role: 'BDM' },
  { name: 'Reshma', role: 'Sales Executive' },
  { name: 'Hemalatha', role: 'Accounts' },
  { name: 'Manisha', role: 'Office Assistant' },
];

import crypto from 'crypto';

const SESSION_SECRET = 'fa5042afbadd0f06be40d90b64d5b8da70b4fa68ae2a723ffe4644f13f9c84d5';
const SESSION_COOKIE_NAME = 'erp_session_token';

function createAuthCookie(persona) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const payload = {
    id: 'USR-' + persona.name.replace(/\s+/g, '-'),
    email: `${persona.name.toLowerCase().split(' ')[0]}@icontechpro.in`,
    name: persona.name,
    role: persona.role,
    exp,
  };
  const jsonStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(jsonStr).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadBase64).digest('hex');
  const token = `${payloadBase64}.${signature}`;
  return `${SESSION_COOKIE_NAME}=${token}`;
}

async function fetchRoute(path, cookie) {
  return new Promise((resolve) => {
    const req = http.get(
      `http://localhost:3000${path}`,
      {
        headers: {
          Cookie: cookie,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        });
      }
    );
    req.on('error', (err) => resolve({ error: err.message }));
  });
}

async function run() {
  console.log('=== ICON TECH PRO ERP v7.1 MULTI-PERSONA UAT VERIFICATION ===\n');

  let allPassed = true;

  for (const persona of personas) {
    console.log(`Testing Persona: ${persona.name} (${persona.role})`);
    const cookie = await createAuthCookie(persona);

    // 1. Dashboard Cockpit
    const dash = await fetchRoute('/dashboard', cookie);
    const dashOk = dash.status === 200 && dash.body.includes('v7.1 ENTERPRISE PRODUCTION');
    console.log(`  - /dashboard: Status ${dash.status} [v7.1 Badge: ${dash.body.includes('v7.1 ENTERPRISE PRODUCTION') ? 'YES' : 'NO'}] -> ${dashOk ? 'PASS' : 'FAIL'}`);
    if (!dashOk) allPassed = false;

    // 2. Attendance Page (Check for 500 error fix - must be 200 for all 6 personas)
    const att = await fetchRoute('/dashboard/employees/attendance', cookie);
    const attOk = att.status === 200;
    console.log(`  - /dashboard/employees/attendance: Status ${att.status} -> ${attOk ? 'PASS (No 500!)' : 'FAIL'}`);
    if (!attOk) allPassed = false;

    // 3. Invoices Page (Protected: Manisha/Office Assistant should get 307 redirect; Accounts/MD/BDM get 200)
    const inv = await fetchRoute('/dashboard/invoices', cookie);
    const expectedInvStatus = persona.role === 'Office Assistant' ? 307 : 200;
    const invOk = inv.status === expectedInvStatus;
    console.log(`  - /dashboard/invoices: Status ${inv.status} (Expected ${expectedInvStatus}) -> ${invOk ? 'PASS (RBAC Enforced)' : 'FAIL'}`);
    if (!invOk) allPassed = false;

    // 4. Enquiries Page (Protected: Accounts should get 307 redirect; others get 200)
    const enq = await fetchRoute('/dashboard/enquiries', cookie);
    const expectedEnqStatus = persona.role === 'Accounts' ? 307 : 200;
    const enqOk = enq.status === expectedEnqStatus;
    console.log(`  - /dashboard/enquiries: Status ${enq.status} (Expected ${expectedEnqStatus}) -> ${enqOk ? 'PASS (RBAC Enforced)' : 'FAIL'}`);
    if (!enqOk) allPassed = false;

    // 5. Site Visits (Protected: Accounts gets 307 redirect; others get 200)
    const sv = await fetchRoute('/dashboard/site-visits', cookie);
    const expectedSvStatus = persona.role === 'Accounts' ? 307 : 200;
    const svOk = sv.status === expectedSvStatus;
    console.log(`  - /dashboard/site-visits: Status ${sv.status} (Expected ${expectedSvStatus}) -> ${svOk ? 'PASS (RBAC Enforced)' : 'FAIL'}`);
    if (!svOk) allPassed = false;

    // 6. Dispatch
    const dsp = await fetchRoute('/dashboard/dispatch', cookie);
    const dspOk = dsp.status === 200;
    console.log(`  - /dashboard/dispatch: Status ${dsp.status} -> ${dspOk ? 'PASS' : 'FAIL'}`);
    if (!dspOk) allPassed = false;

    // 7. Installations (Protected: Accounts gets 307 redirect; others get 200)
    const inst = await fetchRoute('/dashboard/installations', cookie);
    const expectedInstStatus = persona.role === 'Accounts' ? 307 : 200;
    const instOk = inst.status === expectedInstStatus;
    console.log(`  - /dashboard/installations: Status ${inst.status} (Expected ${expectedInstStatus}) -> ${instOk ? 'PASS (RBAC Enforced)' : 'FAIL'}`);
    if (!instOk) allPassed = false;

    // 8. Communication Center
    const comm = await fetchRoute('/dashboard/communication', cookie);
    const commOk = comm.status === 200;
    console.log(`  - /dashboard/communication: Status ${comm.status} -> ${commOk ? 'PASS' : 'FAIL'}`);
    if (!commOk) allPassed = false;

    // 9. AI Copilot
    const ai = await fetchRoute('/dashboard/ai', cookie);
    const aiOk = ai.status === 200;
    console.log(`  - /dashboard/ai: Status ${ai.status} -> ${aiOk ? 'PASS' : 'FAIL'}`);
    if (!aiOk) allPassed = false;

    console.log('');
  }

  console.log('=============================================================');
  if (allPassed) {
    console.log('ALL 6 PERSONAS PASSED ALL END-TO-END VERIFICATION CHECKS WITH ZERO ERRORS!');
  } else {
    console.error('VERIFICATION HAD FAILURES!');
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('Fatal execution error:', e);
  process.exit(1);
});
