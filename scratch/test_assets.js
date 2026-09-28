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

async function checkDashboardAssets() {
  const token = createToken({
    id: 'usr_md_01',
    email: 'md@icontechpro.com',
    name: 'Narsimha Naidu',
    role: 'Managing Director'
  });

  const res = await fetch('http://localhost:3000/dashboard', {
    headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` }
  });

  const html = await res.text();

  // Extract all src and href from scripts, links, and images
  const assetUrls = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/_next\/[^"]+|\/[^"]+\.(?:png|jpg|svg|ico|css|js))"/g)) {
    assetUrls.add(m[1]);
  }

  console.log(`Found ${assetUrls.size} unique assets on /dashboard:`);
  let failed = 0;
  for (const asset of assetUrls) {
    try {
      const aRes = await fetch(`http://localhost:3000${asset}`);
      if (aRes.status === 200) {
        console.log(`  ✓ [200] ${asset} (${aRes.headers.get('content-type')}, ${aRes.headers.get('content-length') || 'chunked'} bytes)`);
      } else {
        console.error(`  ✗ [${aRes.status}] ${asset}`);
        failed++;
      }
    } catch (e) {
      console.error(`  ✗ [ERR] ${asset}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nAsset check summary: ${assetUrls.size - failed} succeeded, ${failed} failed.`);
}

checkDashboardAssets();
