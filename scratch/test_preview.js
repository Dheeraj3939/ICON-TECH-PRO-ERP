import crypto from 'node:crypto';

const SESSION_SECRET = 'fa5042afbadd0f06be40d90b64d5b8da70b4fa68ae2a723ffe4644f13f9c84d5';
const SESSION_COOKIE_NAME = 'erp_session_token';

function createToken(user) {
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  const payload = { ...user, exp };
  const jsonStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(jsonStr).toString('base64url');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(payloadBase64);
  const signature = hmac.digest('hex');
  return `${payloadBase64}.${signature}`;
}

async function main() {
  const token = createToken({
    id: 'usr_md_01',
    email: 'md@icontechpro.com',
    name: 'Narsimha Naidu',
    role: 'Managing Director'
  });

  const cookieHeader = `${SESSION_COOKIE_NAME}=${token}`;

  const routes = [
    '/login',
    '/dashboard',
    '/dashboard/customers',
    '/dashboard/enquiries',
    '/dashboard/follow-ups',
    '/dashboard/site-visits',
    '/dashboard/projects',
    '/dashboard/quotations'
  ];

  console.log('==================================================');
  console.log('TESTING BROWSER PREVIEW RENDERING & CSS ASSETS');
  console.log('==================================================\n');

  let allOk = true;

  for (const route of routes) {
    const isLogin = route === '/login';
    const headers = isLogin ? {} : { Cookie: cookieHeader };

    try {
      const res = await fetch(`http://localhost:3000${route}`, {
        headers,
        redirect: 'manual'
      });

      console.log(`[ROUTE] ${route} -> HTTP ${res.status}`);

      if (res.status === 200) {
        const html = await res.text();
        const cssMatches = [...html.matchAll(/href="(\/_next\/static\/css\/[^"]+\.css)"/g)].map(m => m[1]);
        console.log(`  CSS files linked (${cssMatches.length}): ${cssMatches.join(', ')}`);

        if (cssMatches.length === 0) {
          console.error(`  [ERROR] No CSS file linked on ${route}!`);
          allOk = false;
        }

        for (const cssPath of cssMatches) {
          const cssRes = await fetch(`http://localhost:3000${cssPath}`);
          const cssText = await cssRes.text();
          const contentType = cssRes.headers.get('content-type');
          console.log(`  Stylesheet: ${cssPath}`);
          console.log(`    Status: ${cssRes.status}`);
          console.log(`    Content-Type: ${contentType}`);
          console.log(`    Byte Size: ${cssText.length} bytes`);
          console.log(`    Tailwind Base present: ${cssText.includes('@media') || cssText.includes('bg-slate-50')}`);

          if (cssRes.status !== 200 || !contentType?.includes('text/css')) {
            console.error(`    [ERROR] Failed to load CSS properly: status=${cssRes.status}, type=${contentType}`);
            allOk = false;
          }
        }

        // Check key elements in HTML
        const hasBranding = html.includes('ICON TECH PRO') || html.includes('logo');
        const hasSidebar = html.includes('Sidebar') || html.includes('ml-64') || html.includes('Dashboard');
        console.log(`  HTML Visual Checks:`);
        console.log(`    - Has Branding: ${hasBranding}`);
        console.log(`    - Has Layout/Sidebar: ${hasSidebar}`);
      } else {
        console.error(`  [ERROR] Unexpected status ${res.status} for ${route}`);
        allOk = false;
      }
      console.log('');
    } catch (err) {
      console.error(`  [ERROR] Failed to fetch ${route}:`, err.message);
      allOk = false;
    }
  }

  console.log('==================================================');
  console.log('OVERALL STATUS:', allOk ? 'ALL CHECKS PASSED PERFECTLY' : 'SOME CHECKS FAILED');
  console.log('==================================================');
}

main();
