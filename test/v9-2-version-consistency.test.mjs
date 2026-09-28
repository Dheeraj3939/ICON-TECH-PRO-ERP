import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('ICON TECH PRO ERP V9.2 — Version Consistency & Enterprise Identity Suite', async (t) => {
  await t.test('1. Authoritative Version Constant (ERP_SYSTEM_VERSION)', () => {
    const versionFilePath = path.join(rootDir, 'src', 'lib', 'constants', 'version.ts');
    assert.ok(fs.existsSync(versionFilePath), 'src/lib/constants/version.ts must exist');

    const content = fs.readFileSync(versionFilePath, 'utf8');
    assert.match(content, /version:\s*'9\.2'/);
    assert.match(content, /versionLabel:\s*'v9\.2'/);
    assert.match(content, /releaseName:\s*'V9\.2 Enterprise Release'/);
    assert.match(content, /company:\s*'ICON TECH PRO'/);
    assert.match(content, /entityId:\s*'ORG-ICON-01'/);
    assert.match(content, /environment:\s*'ENTERPRISE PRODUCTION'/);
    assert.doesNotMatch(content, /Sreeja/i, 'Zero Sreeja Enterprises allowed');
  });

  await t.test('2. Root Layout Branding & Title', () => {
    const layoutPath = path.join(rootDir, 'src', 'app', 'layout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf8');
    assert.match(content, /ICON TECH PRO ERP V9\.2 Enterprise Release/, 'Root title must reflect V9.2 Enterprise Release');
    assert.doesNotMatch(content, /v7\.0/, 'Root layout must not contain v7.0');
    assert.doesNotMatch(content, /v9\.1/, 'Root layout must not contain v9.1');
  });

  await t.test('3. Sidebar Navigation Brand Badge', () => {
    const sidebarPath = path.join(rootDir, 'src', 'components', 'layout', 'sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf8');
    assert.match(content, /ERP_SYSTEM_VERSION\.versionLabel/, 'Sidebar must dynamically use ERP_SYSTEM_VERSION.versionLabel');
    assert.doesNotMatch(content, /<span[^>]*>v9\.1<\/span>/, 'Sidebar must not hardcode v9.1');
  });

  await t.test('4. Turnkey Projects Page Badge (V8 Engine Migration)', () => {
    const projectsPath = path.join(rootDir, 'src', 'app', '(dashboard)', 'dashboard', 'projects', 'page.tsx');
    const content = fs.readFileSync(projectsPath, 'utf8');
    assert.doesNotMatch(content, />\s*V8 Engine\s*</, 'Projects page must not display legacy "V8 Engine"');
    assert.match(content, /Turnkey Execution Engine/, 'Projects page must preserve technical identity');
    assert.match(content, /v9\.2/, 'Projects page must display v9.2 version identifier');
  });

  await t.test('5. Executive Dashboard Header & Cockpit Badges', () => {
    const dashboardPath = path.join(rootDir, 'src', 'app', '(dashboard)', 'dashboard', 'page.tsx');
    const content = fs.readFileSync(dashboardPath, 'utf8');
    assert.doesNotMatch(content, />\s*v8\.0 ENTERPRISE RELEASE\s*</, 'Dashboard must not display legacy v8.0 banner');
    assert.match(content, /V9\.2 Role Cockpit/, 'Dashboard must display V9.2 Role Cockpit');
    assert.match(content, /ERP_SYSTEM_VERSION/, 'Dashboard must reference authoritative version constant');
  });

  await t.test('6. Authentication & Login Page', () => {
    const loginPath = path.join(rootDir, 'src', 'app', '(auth)', 'login', 'page.tsx');
    const content = fs.readFileSync(loginPath, 'utf8');
    assert.doesNotMatch(content, /v7\.1 ENTERPRISE PRODUCTION/, 'Login page must not contain legacy v7.1 badge');
    assert.doesNotMatch(content, /ICON TECH PRO ERP v7\.1/, 'Login page must not contain legacy v7.1 header');
    assert.match(content, /ERP_SYSTEM_VERSION/, 'Login page must reference ERP_SYSTEM_VERSION');
  });

  await t.test('7. System Health Action Telemetry', () => {
    const healthPath = path.join(rootDir, 'src', 'lib', 'actions', 'health.ts');
    const content = fs.readFileSync(healthPath, 'utf8');
    assert.doesNotMatch(content, /7\.0\.0-PROD-HR-DEMO-LOCKED/, 'Health action must not report v7.0.0');
    assert.ok(content.includes('ERP_SYSTEM_VERSION.version') || content.includes('9.2.0-ENTERPRISE-PROD'), 'Health action must report 9.2 version');
  });

  await t.test('8. Demo Center & Demo Updates Portals', () => {
    const demoCenterPath = path.join(rootDir, 'src', 'app', '(dashboard)', 'dashboard', 'demo-center', 'page.tsx');
    const demoCenterContent = fs.readFileSync(demoCenterPath, 'utf8');
    assert.doesNotMatch(demoCenterContent, /ICON TECH PRO ERP v7\.0/, 'Demo center must not display v7.0');

    const demoUpdatesPath = path.join(rootDir, 'src', 'app', '(dashboard)', 'dashboard', 'demo-updates', 'page.tsx');
    const demoUpdatesContent = fs.readFileSync(demoUpdatesPath, 'utf8');
    assert.doesNotMatch(demoUpdatesContent, /Release Baseline v7\.0/, 'Demo updates must not display v7.0 baseline');
    assert.ok(demoUpdatesContent.includes('ERP_SYSTEM_VERSION.versionLabel') || demoUpdatesContent.includes('v9.2'), 'Demo updates must display v9.2 baseline');
  });

  await t.test('9. Backup & Disaster Recovery Telemetry', () => {
    const backupPath = path.join(rootDir, 'src', 'app', '(dashboard)', 'dashboard', 'settings', 'backup', 'page.tsx');
    const content = fs.readFileSync(backupPath, 'utf8');
    assert.match(content, /V9\.2_ENTERPRISE_RELEASE_2026-09-28/, 'Backup page must report active V9.2 release');
    assert.match(content, /33/, 'Backup page must report 33 applied migrations');
    assert.match(content, /V9\.1_FINAL_BACKUP_2026-09-22/, 'Backup page must preserve frozen historical V9.1 milestone reference');
  });

  await t.test('10. Encryption Salt Backward Compatibility (Intentional Preservation)', () => {
    const gmailCryptoPath = path.join(rootDir, 'src', 'lib', 'integrations', 'gmail-crypto.ts');
    const gmailCrypto = fs.readFileSync(gmailCryptoPath, 'utf8');
    assert.match(gmailCrypto, /ICON-TECH-PRO-ERP-GMAIL-ENC-FALLBACK-V9\.1/, 'Gmail encryption salt must remain preserved for token backward compatibility');

    const zohoCryptoPath = path.join(rootDir, 'src', 'lib', 'integrations', 'zoho-crypto.ts');
    const zohoCrypto = fs.readFileSync(zohoCryptoPath, 'utf8');
    assert.match(zohoCrypto, /ICON-TECH-PRO-ERP-ZOHO-ENC-FALLBACK-V9\.1/, 'Zoho encryption salt must remain preserved for token backward compatibility');
  });

  await t.test('11. Company & Entity Absolute Purity Invariant', () => {
    const companySettingsPath = path.join(rootDir, 'src', 'types', 'erp.ts');
    const content = fs.readFileSync(companySettingsPath, 'utf8');
    assert.doesNotMatch(content, /Sreeja Enterprises/i, 'Company types must strictly prohibit Sreeja Enterprises');
  });
});
