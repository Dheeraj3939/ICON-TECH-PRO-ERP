const http = require('http');
const crypto = require('crypto');

const routesToTest = [
  { path: '/login', expected: ['LOCAL DEMO / TESTING MODE', 'v7.0 LATEST BUILD', 'ICON TECH PRO ERP v7.0'], forbidden: ['Command Center', 'Enterprise ERP & CRM v1.0'] },
  { path: '/dashboard', expected: ['v7.0 PRODUCTION-HARDENED', 'ICON TECH PRO ERP', 'Workforce, Site Attendance', 'COMMERCIAL', 'HUMAN RESOURCES (DAY 7)'], forbidden: ['Command Center', 'Enterprise ERP & CRM v1.0'] },
  { path: '/dashboard/employees', expected: ['Employee Directory'], forbidden: ['Command Center'] },
  { path: '/dashboard/employees/attendance', expected: ['Attendance'], forbidden: ['Command Center'] },
  { path: '/dashboard/employees/payroll', expected: ['Payroll'], forbidden: ['Command Center'] },
  { path: '/dashboard/employees/payslips', expected: ['Payslips'], forbidden: ['Command Center'] },
  { path: '/dashboard/employees/documents', expected: ['Employee Documents'], forbidden: ['Command Center'] },
  { path: '/dashboard/employees/reports', expected: ['Reports'], forbidden: ['Command Center'] },
  { path: '/dashboard/demo-updates', expected: ['Current Build Updates &amp; Feature Registry', 'Release Baseline v7.0 Production Hardened'], forbidden: ['Command Center'] },
];

function fetchRoute(path, cookie) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Cookie': cookie || '',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
}

async function createValidSessionToken() {
  const secret = 'fa5042afbadd0f06be40d90b64d5b8da70b4fa68ae2a723ffe4644f13f9c84d5';
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const payload = {
    id: 'USR002',
    name: 'Narsimha Naidu',
    email: 'md@icontechpro.in',
    role: 'Managing Director',
    exp,
  };
  const jsonStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(jsonStr).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadBase64).digest('hex');
  return `erp_session_token=${payloadBase64}.${signature}`;
}

async function run() {
  console.log('--- STARTING LIVE HTTP VERIFICATION ON http://localhost:3000 ---');

  // 1. First test /login without cookie
  const loginRes = await fetchRoute('/login');
  console.log(`\nROUTE: /login -> Status ${loginRes.statusCode}`);
  for (const exp of routesToTest[0].expected) {
    const hasExp = loginRes.body.includes(exp);
    console.log(`  [${hasExp ? 'PASS' : 'FAIL'}] Expected string: "${exp}"`);
  }
  for (const forb of routesToTest[0].forbidden) {
    const hasForb = loginRes.body.includes(forb);
    console.log(`  [${!hasForb ? 'PASS' : 'FAIL'}] Forbidden string "${forb}": ${!hasForb ? 'NOT PRESENT' : 'DETECTED!'}`);
  }

  // 2. Obtain valid authenticated session cookie
  const authCookie = await createValidSessionToken();
  console.log(`\nUsing authenticated session cookie: ${authCookie.slice(0, 45)}...`);

  let allPassed = true;

  for (let i = 1; i < routesToTest.length; i++) {
    const testItem = routesToTest[i];
    const res = await fetchRoute(testItem.path, authCookie);
    console.log(`\nROUTE: ${testItem.path} -> Status ${res.statusCode}`);
    if (res.statusCode !== 200) {
      console.log(`  [FAIL] Expected status 200, got ${res.statusCode}`);
      allPassed = false;
    }

    for (const exp of testItem.expected) {
      const hasExp = res.body.includes(exp);
      if (!hasExp) allPassed = false;
      console.log(`  [${hasExp ? 'PASS' : 'FAIL'}] Expected: "${exp}"`);
    }

    for (const forb of testItem.forbidden) {
      const hasForb = res.body.includes(forb);
      if (hasForb) allPassed = false;
      console.log(`  [${!hasForb ? 'PASS' : 'FAIL'}] Forbidden: "${forb}" -> ${!hasForb ? 'ABSENT (Clean)' : 'DETECTED!'}`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`OVERALL SMOKE VERIFICATION: ${allPassed ? 'ALL TESTS PASSED (100%)' : 'SOME TESTS FAILED'}`);
  console.log(`======================================================`);
}

run().catch(console.error);
