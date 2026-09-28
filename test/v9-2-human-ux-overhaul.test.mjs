import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — HUMAN-FRIENDLY UX OVERHAUL & ROLE COCKPIT UAT
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Human-Friendly UX Overhaul & Role Verification', async (t) => {

  await t.test('1. Six Official Employees & Automatic Role Cockpits', () => {
    const dashboardFile = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/page.tsx'), 'utf8');
    
    // Check all 6 employees are supported
    const employees = [
      'Borra Narsimulu',
      'B Vineet Babu',
      'B V Dheeraj Reddy',
      'Reshma',
      'Hemalath',
      'Manisha'
    ];
    for (const emp of employees) {
      assert.ok(dashboardFile.includes(emp), `Dashboard must support employee ${emp}`);
    }

    // MD Cockpit components
    assert.ok(dashboardFile.includes("Today's Business"), "MD cockpit must show Today's Business");
    assert.ok(dashboardFile.includes('Management Alerts'), 'MD cockpit must have Management Alerts');
    assert.ok(dashboardFile.includes('Team Overview'), 'MD cockpit must have Team Overview');
    assert.ok(dashboardFile.includes('+ New Customer'), 'MD cockpit must have + New Customer quick action');
    assert.ok(dashboardFile.includes('+ New Quotation'), 'MD cockpit must have + New Quotation quick action');

    // Sales Cockpit components
    assert.ok(dashboardFile.includes('My Sales Pipeline'), 'Sales cockpit must have My Sales Pipeline');
    assert.ok(dashboardFile.includes('+ Follow-up'), 'Sales cockpit must have + Follow-up quick action');
    assert.ok(dashboardFile.includes('+ Site Visit'), 'Sales cockpit must have + Site Visit quick action');

    // Accounts Cockpit components
    assert.ok(dashboardFile.includes('ACTIVE INVOICES & RECEIVABLES LEDGER'), 'Accounts cockpit must have Active Invoices & Receivables');
    assert.ok(dashboardFile.includes('Record Payment'), 'Accounts cockpit must have Record Payment quick action');
    assert.ok(dashboardFile.includes('Customer Ledger'), 'Accounts cockpit must have Customer Ledger quick action');

    // Office Assistant Cockpit components
    assert.ok(dashboardFile.includes('OFFICE DUTIES & DISPATCH TRACKER'), 'Office cockpit must have Office Duties & Dispatch Tracker');
    assert.ok(dashboardFile.includes('+ Add Document'), 'Office cockpit must have + Add Document quick action');
    assert.ok(dashboardFile.includes('+ Create Task'), 'Office cockpit must have + Create Task quick action');
  });

  await t.test('2. Production Cleanliness & Demo Mode Gating', () => {
    const demoConstantFile = fs.readFileSync(path.join(rootDir, 'src/lib/constants/demo-mode.ts'), 'utf8');
    assert.ok(demoConstantFile.includes('DEMO_MODE_COOKIE_NAME'), 'Must define DEMO_MODE_COOKIE_NAME');
    assert.ok(demoConstantFile.includes('isDemoModeEnabled'), 'Must define isDemoModeEnabled');

    const layoutFile = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/layout.tsx'), 'utf8');
    assert.ok(layoutFile.includes('DEMO_MODE_COOKIE_NAME'), 'Dashboard layout must import DEMO_MODE_COOKIE_NAME');
    assert.ok(layoutFile.includes('isDemoMode && <DemoPresentationBar />'), 'Demo banner must only render when isDemoMode is true');

    const settingsDemoPage = path.join(rootDir, 'src/app/(dashboard)/dashboard/settings/demo/page.tsx');
    assert.ok(fs.existsSync(settingsDemoPage), 'Dedicated demo mode settings page must exist');
    const demoPageContent = fs.readFileSync(settingsDemoPage, 'utf8');
    assert.ok(demoPageContent.includes('Demo & Training Mode'), 'Demo settings page must have human title');
    assert.ok(demoPageContent.includes('toggleDemoMode'), 'Must trigger toggleDemoMode server action');

    // Dashboard must not display raw hardcoded LIVE DEMO MODE ACTIVE banner or demo card
    const dashboardFile = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/page.tsx'), 'utf8');
    assert.ok(!dashboardFile.includes('LIVE DEMO MODE ACTIVE'), 'Production dashboard must NOT contain LIVE DEMO MODE ACTIVE');
    assert.ok(!dashboardFile.includes('DEMO-ICON260099'), 'Production dashboard must NOT contain hardcoded DEMO-ICON260099 card');
  });

  await t.test('3. Simple Business Sidebar Navigation', () => {
    const sidebarFile = fs.readFileSync(path.join(rootDir, 'src/components/layout/sidebar.tsx'), 'utf8');
    
    // Check main business categories exist
    const categories = ['CORE', 'SALES', 'PROJECTS', 'PURCHASE', 'SERVICE', 'DOCUMENTS', 'PEOPLE & HR', 'REPORTS', 'SETTINGS'];
    for (const cat of categories) {
      assert.ok(sidebarFile.includes(cat), `Sidebar must contain business group ${cat}`);
    }

    // Human-friendly items in sidebar
    assert.ok(sidebarFile.includes('Customers'), 'Sidebar must contain Customers');
    assert.ok(sidebarFile.includes('Enquiries'), 'Sidebar must contain Enquiries');
    assert.ok(sidebarFile.includes('Follow-ups'), 'Sidebar must contain Follow-ups');
    assert.ok(sidebarFile.includes('Site Visits'), 'Sidebar must contain Site Visits');
    assert.ok(sidebarFile.includes('Quotations'), 'Sidebar must contain Quotations');
    assert.ok(sidebarFile.includes('Invoices'), 'Sidebar must contain Invoices');
    assert.ok(sidebarFile.includes('Suppliers'), 'Sidebar must contain Suppliers');
    assert.ok(sidebarFile.includes('AMC'), 'Sidebar must contain AMC');

    // Developer jargon removed from normal sidebar
    assert.ok(!sidebarFile.includes('Canonical Chain'), 'Sidebar must not contain Canonical Chain');
    assert.ok(!sidebarFile.includes('Turnkey Execution Engine'), 'Sidebar must not contain Turnkey Execution Engine');
  });

  await t.test('4. Global Search & Notification Center Invariants', () => {
    const headerFile = fs.readFileSync(path.join(rootDir, 'src/components/layout/header.tsx'), 'utf8');
    const commandPaletteFile = fs.readFileSync(path.join(rootDir, 'src/components/search/CommandPalette.tsx'), 'utf8');

    const expectedPlaceholder = 'Search customer, enquiry, quotation, order or invoice...';
    assert.ok(headerFile.includes(expectedPlaceholder), 'Header must contain exact search placeholder');
    assert.ok(commandPaletteFile.includes(expectedPlaceholder), 'CommandPalette must contain exact search placeholder');

    // Real customer tips instead of demo customer tips
    assert.ok(commandPaletteFile.includes('T-Hub') || commandPaletteFile.includes('Cyient'), 'Command palette must suggest real customers');
    assert.ok(!commandPaletteFile.includes('Swan orders'), 'Command palette must not suggest demo Swan orders');

    // Header notification center
    assert.ok(headerFile.includes('Urgent'), 'Notification center must have Urgent category');
    assert.ok(headerFile.includes('Due Today'), 'Notification center must have Due Today category');
    assert.ok(headerFile.includes('Completed'), 'Notification center must have Completed category');
  });

  await t.test('5. Customer 360 View Business Organization', () => {
    const customerViewFile = fs.readFileSync(path.join(rootDir, 'src/components/customers/Customer360View.tsx'), 'utf8');
    
    // 6 human business tabs
    assert.ok(customerViewFile.includes('Customer Details'), 'Customer view must have Customer Details tab');
    assert.ok(customerViewFile.includes('Business (Quotes & Orders)'), 'Customer view must have Business (Quotes & Orders) tab');
    assert.ok(customerViewFile.includes('Invoices & Payments'), 'Customer view must have Invoices & Payments tab');
    assert.ok(customerViewFile.includes('Projects & Site Visits'), 'Customer view must have Projects & Site Visits tab');
    assert.ok(customerViewFile.includes('Service & AMC'), 'Customer view must have Service & AMC tab');
    assert.ok(customerViewFile.includes('Activity & Outbox'), 'Customer view must have Activity & Outbox tab');
  });

  await t.test('6. Enquiry Visual Workflow Stepper', () => {
    const enquiryFile = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/enquiries/page.tsx'), 'utf8');
    
    // Visual business stepper banner
    assert.ok(enquiryFile.includes('NEW ENQUIRY'), 'Enquiry page must show NEW ENQUIRY');
    assert.ok(enquiryFile.includes('SITE VISIT'), 'Enquiry page must show SITE VISIT');
    assert.ok(enquiryFile.includes('QUOTATION'), 'Enquiry page must show QUOTATION');
    assert.ok(enquiryFile.includes('FOLLOW-UP'), 'Enquiry page must show FOLLOW-UP');
    assert.ok(enquiryFile.includes('ORDER'), 'Enquiry page must show ORDER');
    assert.ok(enquiryFile.includes('INVOICE'), 'Enquiry page must show INVOICE');
  });

  await t.test('7. Follow-Up System & Personnel Assignment', () => {
    const followUpsFile = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/follow-ups/page.tsx'), 'utf8');
    
    // Assigned to 6 official employees
    const employees = [
      'Borra Narsimulu',
      'B Vineet Babu',
      'B V Dheeraj Reddy',
      'Reshma',
      'Hemalath',
      'Manisha'
    ];
    for (const emp of employees) {
      assert.ok(followUpsFile.includes(emp), `Follow-up assignment select must contain ${emp}`);
    }

    // Action buttons
    assert.ok(followUpsFile.includes('Call'), 'Follow-up card must have Call button');
    assert.ok(followUpsFile.includes('WhatsApp'), 'Follow-up card must have WhatsApp button');
    assert.ok(followUpsFile.includes('Complete'), 'Follow-up card must have Complete button');
    assert.ok(followUpsFile.includes('Reschedule'), 'Follow-up card must have Reschedule button');
  });

  await t.test('8. Quotation 7-Step Visual Workflow Progress', () => {
    const quotationModalFile = fs.readFileSync(path.join(rootDir, 'src/components/modals/NewQuotationModal.tsx'), 'utf8');
    
    assert.ok(quotationModalFile.includes('STEP 1') && quotationModalFile.includes('Customer'), 'Quotation modal must show Step 1 Customer');
    assert.ok(quotationModalFile.includes('STEP 2') && quotationModalFile.includes('Products & Scope'), 'Quotation modal must show Step 2 Products & Scope');
    assert.ok(quotationModalFile.includes('STEP 3') && quotationModalFile.includes('Pricing & Margins'), 'Quotation modal must show Step 3 Pricing & Margins');
    assert.ok(quotationModalFile.includes('STEP 4') && quotationModalFile.includes('GST Breakdown'), 'Quotation modal must show Step 4 GST Breakdown');
    assert.ok(quotationModalFile.includes('STEP 5') && quotationModalFile.includes('Terms & Presets'), 'Quotation modal must show Step 5 Terms & Presets');
    assert.ok(quotationModalFile.includes('STEP 6') && quotationModalFile.includes('Live Preview'), 'Quotation modal must show Step 6 Live Preview');
    assert.ok(quotationModalFile.includes('STEP 7') && quotationModalFile.includes('Save & Send'), 'Quotation modal must show Step 7 Save & Send');
  });

  await t.test('9. Release Invariants: V9.2 Version & Single Entity Purity', () => {
    const versionFile = fs.readFileSync(path.join(rootDir, 'src/lib/constants/version.ts'), 'utf8');
    assert.ok(versionFile.includes("version: '9.2'") && versionFile.includes("releaseName: 'V9.2 Enterprise Release'"), 'System version must be strictly V9.2');
    assert.ok(versionFile.includes("entityId: 'ORG-ICON-01'"), 'Must contain ORG-ICON-01');
    assert.ok(versionFile.includes("company: 'ICON TECH PRO'"), 'Must be ICON TECH PRO');

    // Single organization strictly ICON TECH PRO (zero Sreeja Enterprises)
    const seedFile = fs.readFileSync(path.join(rootDir, 'supabase/seed.sql'), 'utf8');
    assert.ok(!seedFile.includes('Sreeja Enterprises'), 'Zero occurrences of Sreeja Enterprises in seed');
  });

});
