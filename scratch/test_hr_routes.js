const http = require('http');

const routes = [
  '/dashboard/employees',
  '/dashboard/employees/EMP-UUID-0007',
  '/dashboard/employees/attendance',
  '/dashboard/employees/payroll',
  '/dashboard/employees/payslips',
  '/dashboard/employees/documents',
  '/dashboard/employees/reports',
  '/dashboard/employees/settings',
  '/dashboard/demo-updates',
];

async function checkRoute(path) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'GET',
        headers: {
          // Pass valid auth cookie if server requires auth
        },
      },
      (res) => {
        resolve({ path, status: res.statusCode, location: res.headers.location });
      }
    );
    req.on('error', (err) => {
      resolve({ path, error: err.message });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ path, timeout: true });
    });
    req.end();
  });
}

async function run() {
  console.log('Testing HR routes against localhost:3000...');
  for (const r of routes) {
    const res = await checkRoute(r);
    console.log(`${r} -> Status: ${res.status || 'ERROR'} ${res.location ? '(Redirect: ' + res.location + ')' : ''} ${res.error ? '(' + res.error + ')' : ''}`);
  }
}

run();
