const http = require('http');

const routes = [
  '/',
  '/dashboard',
  '/customers',
  '/dashboard/enquiries',
  '/dashboard/quotations',
  '/dashboard/sales-orders',
  '/dashboard/products',
  '/dashboard/inventory',
  '/dashboard/purchases',
  '/dashboard/invoices',
  '/dashboard/dispatch',
  '/dashboard/installations',
  '/dashboard/service',
  '/dashboard/rental',
  '/dashboard/reports',
  '/dashboard/settings/discount-rules',
  '/dashboard/audit',
];

async function checkRoute(route) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:3000${route}`, (res) => {
      resolve({ route, statusCode: res.statusCode });
    });
    req.on('error', (err) => {
      resolve({ route, error: err.message });
    });
    req.setTimeout(5000, () => {
      req.abort();
      resolve({ route, error: 'TIMEOUT' });
    });
  });
}

async function run() {
  console.log('=== VERIFYING ALL ERP SUITE ROUTES ON PORT 3000 ===');
  let allPass = true;
  for (const route of routes) {
    const result = await checkRoute(route);
    const passed = result.statusCode === 200 || result.statusCode === 307 || result.statusCode === 308;
    console.log(`Route ${route.padEnd(35)} : [Status ${result.statusCode || result.error}] - ${passed ? 'OK' : 'FAIL'}`);
    if (!passed) allPass = false;
  }
  console.log('==================================================');
  if (allPass) {
    console.log('ALL 17 ERP ROUTES RETURNED SUCCESS STATUS!');
  } else {
    console.error('SOME ROUTES FAILED!');
    process.exit(1);
  }
}

run();
