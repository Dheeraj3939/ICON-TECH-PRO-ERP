// scratch/check-routes.mjs
const routes = [
  '/',
  '/login',
  '/dashboard',
  '/dashboard/enquiries',
  '/dashboard/quotations',
  '/dashboard/sales-orders',
  '/dashboard/invoices',
  '/dashboard/inventory',
  '/dashboard/service',
  '/dashboard/communication',
  '/dashboard/ai',
  '/dashboard/ai/agents',
  '/dashboard/ai/voice',
  '/dashboard/reports',
  '/dashboard/automated-briefings',
  '/dashboard/site-visits',
  '/dashboard/tally',
];

async function checkRoutes() {
  console.log('Testing route responses from http://localhost:3000 ...');
  let passed = 0;
  let failed = 0;

  for (const route of routes) {
    try {
      const res = await fetch(`http://localhost:3000${route}`, {
        headers: { 'Accept': 'text/html' },
      });
      // 200, 307/308 redirect to login or dashboard are both healthy responses
      if (res.status === 200 || res.status === 307 || res.status === 308) {
        console.log(`✔ ${route} -> HTTP ${res.status}`);
        passed++;
      } else {
        console.error(`✖ ${route} -> HTTP ${res.status}`);
        failed++;
      }
    } catch (err) {
      console.error(`✖ ${route} -> Connection error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nRoute Check Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

checkRoutes();
