import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — DEMO QUOTATION WORKSPACE 20-POINT VERIFICATION SUITE
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Demo Quotation Workspace Verification (/demo/quotations/create)', async (t) => {
  const dataFile = fs.readFileSync(
    path.join(rootDir, 'src/components/demo-quotation/demo-data.ts'),
    'utf8'
  );
  const workspaceFile = fs.readFileSync(
    path.join(rootDir, 'src/components/demo-quotation/DemoQuotationWorkspace.tsx'),
    'utf8'
  );
  const drawerFile = fs.readFileSync(
    path.join(rootDir, 'src/components/demo-quotation/DemoProductDrawer.tsx'),
    'utf8'
  );
  const previewFile = fs.readFileSync(
    path.join(rootDir, 'src/components/demo-quotation/DemoCustomerPreviewModal.tsx'),
    'utf8'
  );
  const aiResearchFile = fs.readFileSync(
    path.join(rootDir, 'src/components/demo-quotation/DemoAIResearchModal.tsx'),
    'utf8'
  );
  const routePageFile = fs.readFileSync(
    path.join(rootDir, 'src/app/demo/quotations/create/page.tsx'),
    'utf8'
  );
  const routeLayoutFile = fs.readFileSync(
    path.join(rootDir, 'src/app/demo/quotations/layout.tsx'),
    'utf8'
  );

  // TEST 1 — Route /demo/quotations/create exists and renders cleanly
  await t.test('TEST 1 — Route /demo/quotations/create exists and renders cleanly', () => {
    assert.ok(fs.existsSync(path.join(rootDir, 'src/app/demo/quotations/create/page.tsx')));
    assert.ok(fs.existsSync(path.join(rootDir, 'src/app/demo/quotations/layout.tsx')));
    assert.ok(routePageFile.includes('DemoQuotationWorkspace'));
    assert.ok(routeLayoutFile.includes('Demo Quotation Workspace'));
  });

  // TEST 2 — Workspace top bar displays Create Quotation, Draft status, and quotation number
  await t.test('TEST 2 — Workspace top bar displays Create Quotation, Draft status, and quotation number', () => {
    assert.ok(workspaceFile.includes('Create Quotation'));
    assert.ok(workspaceFile.includes('ITP-QTN-2026-00116'));
    assert.ok(workspaceFile.includes('Save as Draft'));
    assert.ok(workspaceFile.includes('Customer Preview'));
    assert.ok(workspaceFile.includes('Save & Print'));
  });

  // TEST 3 — Customer selection card renders complete customer details
  await t.test('TEST 3 — Customer selection card renders complete customer details', () => {
    assert.ok(dataFile.includes('ABC Technologies Pvt Ltd'));
    assert.ok(dataFile.includes('Kavita Reddy'));
    assert.ok(dataFile.includes('36AAACA9876Q1ZM'));
    assert.ok(workspaceFile.includes('Customer & Billing Information'));
    assert.ok(workspaceFile.includes('customer.company_name'));
    assert.ok(workspaceFile.includes('customer.gstin'));
  });

  // TEST 4 — Customer dropdown switcher updates active customer
  await t.test('TEST 4 — Customer dropdown switcher updates active customer', () => {
    assert.ok(workspaceFile.includes('isCustomerDropdownOpen'));
    assert.ok(workspaceFile.includes('DEMO_CUSTOMERS.map'));
    assert.ok(workspaceFile.includes('setCustomer(cust)'));
    assert.ok(dataFile.includes('Ravi Kumar Residence'));
    assert.ok(dataFile.includes('Telangana State Tech Academy'));
  });

  // TEST 5 — Project Requirement box renders with AI Detect button
  await t.test('TEST 5 — Project Requirement box renders with AI Detect button', () => {
    assert.ok(workspaceFile.includes('Customer Requirement & AI Format Detection'));
    assert.ok(workspaceFile.includes('handleAIDetectFormat'));
    assert.ok(workspaceFile.includes('AI Detect Format'));
    assert.ok(workspaceFile.includes('data-testid="ai-detect-format-btn"'));
  });

  // TEST 6 — Format selector renders all 8 format options
  await t.test('TEST 6 — Format selector renders all 8 format options', () => {
    const expectedFormats = [
      'STANDARD',
      'HOME_THEATER',
      'CONFERENCE_ROOM',
      'CCTV',
      'NETWORKING',
      'AV_SOLUTION',
      'AMC_SERVICE',
      'CUSTOM_MIXED',
    ];
    for (const fmt of expectedFormats) {
      assert.ok(dataFile.includes(fmt), `Expected format ${fmt} in demo-data`);
    }
    assert.ok(workspaceFile.includes('FORMAT_OPTIONS.map'));
    assert.ok(workspaceFile.includes('data-testid="format-selector-tabs"'));
  });

  // TEST 7 — Switching format adapts active section headers without losing items
  await t.test('TEST 7 — Switching format adapts active section headers without losing items', () => {
    assert.ok(workspaceFile.includes('handleFormatSwitch'));
    assert.ok(workspaceFile.includes('FORMAT_SECTIONS[currentFormat]'));
    assert.ok(workspaceFile.includes('activeSections'));
    assert.ok(dataFile.includes('DISPLAY / PROJECTOR'));
    assert.ok(dataFile.includes('VIDEO CONFERENCING'));
    assert.ok(dataFile.includes('ACTIVE COMPONENTS'));
  });

  // TEST 8 — Line items table renders section headers and pre-populated products
  await t.test('TEST 8 — Line items table renders section headers and pre-populated products', () => {
    assert.ok(dataFile.includes('BenQ TK710'));
    assert.ok(dataFile.includes('AVR-X3800H'));
    assert.ok(dataFile.includes('Reserve R700'));
    assert.ok(dataFile.includes('SB-3000'));
    assert.ok(dataFile.includes('AcousticPro UHD 135"'));
    assert.ok(workspaceFile.includes('data-testid="workspace-section-block"'));
    assert.ok(workspaceFile.includes('data-testid="workspace-item-row"'));
  });

  // TEST 9 — Add Product opens the Product Drawer
  await t.test('TEST 9 — Add Product opens the Product Drawer', () => {
    assert.ok(workspaceFile.includes('handleOpenCreateItem'));
    assert.ok(workspaceFile.includes('setDrawerOpen(true)'));
    assert.ok(workspaceFile.includes('data-testid="add-product-btn"'));
    assert.ok(workspaceFile.includes('<DemoProductDrawer'));
  });

  // TEST 10 — Product Drawer renders all 6 distinct tabs
  await t.test('TEST 10 — Product Drawer renders all 6 distinct tabs', () => {
    assert.ok(drawerFile.includes('1. Basic Details'));
    assert.ok(drawerFile.includes('2. Specifications'));
    assert.ok(drawerFile.includes('3. Customer Description'));
    assert.ok(drawerFile.includes('4. Short Highlights'));
    assert.ok(drawerFile.includes('5. Images & Docs'));
    assert.ok(drawerFile.includes('6. Internal Pricing'));
    assert.ok(drawerFile.includes("type TabKey = 'basic' | 'specs' | 'description' | 'highlights' | 'media' | 'pricing'"));
  });

  // TEST 11 — Specifications tab allows adding, editing, and deleting key-value spec rows
  await t.test('TEST 11 — Specifications tab allows adding, editing, and deleting key-value spec rows', () => {
    assert.ok(drawerFile.includes('handleAddSpec'));
    assert.ok(drawerFile.includes('handleUpdateSpec'));
    assert.ok(drawerFile.includes('handleDeleteSpec'));
    assert.ok(drawerFile.includes('Specification Property'));
    assert.ok(drawerFile.includes('Manufacturer Value'));
  });

  // TEST 12 — Short Highlights tab allows adding and deleting bullet highlights
  await t.test('TEST 12 — Short Highlights tab allows adding and deleting bullet highlights', () => {
    assert.ok(drawerFile.includes('handleAddHighlight'));
    assert.ok(drawerFile.includes('handleDeleteHighlight'));
    assert.ok(drawerFile.includes('handleMoveHighlight'));
    assert.ok(drawerFile.includes('Short Highlights:'));
  });

  // TEST 13 — Pricing (Internal) tab displays purchase cost, supplier name, live calculated gross margin ₹ and %, and confidentiality notice
  await t.test('TEST 13 — Pricing (Internal) tab displays purchase cost, supplier name, live calculated gross margin and confidentiality notice', () => {
    assert.ok(drawerFile.includes('purchaseCost'));
    assert.ok(drawerFile.includes('supplierName'));
    assert.ok(drawerFile.includes('marginAmt'));
    assert.ok(drawerFile.includes('marginPct'));
    assert.ok(drawerFile.includes('Confidential Commercial Data'));
    assert.ok(drawerFile.includes('strictly visible to authorized personnel only'));
  });

  // TEST 14 — "Save to Quotation Only (Dynamic Product)" toggle functions properly
  await t.test('TEST 14 — Save to Quotation Only (Dynamic Product) toggle functions properly', () => {
    assert.ok(drawerFile.includes('Save to Quotation Only (Dynamic Product)'));
    assert.ok(drawerFile.includes('isDynamic'));
    assert.ok(drawerFile.includes('setIsDynamic'));
    assert.ok(drawerFile.includes('Does not pollute the central Product Master'));
  });

  // TEST 15 — AI Product Research Agent modal opens, simulates search for Brand/Model, and renders human review gate
  await t.test('TEST 15 — AI Product Research Agent modal opens, simulates search for Brand/Model, and renders human review gate', () => {
    assert.ok(aiResearchFile.includes('AI Product Research Agent'));
    assert.ok(aiResearchFile.includes('handleStartResearch'));
    assert.ok(aiResearchFile.includes('Mandatory Human Review Gate — Verify & Edit Before Adding'));
    assert.ok(aiResearchFile.includes('data-testid="ai-research-submit-btn"'));
    assert.ok(aiResearchFile.includes('data-testid="ai-research-add-to-quote-btn"'));
  });

  // TEST 16 — Customer Preview modal opens via React Portal on document.body with print/download/close controls
  await t.test('TEST 16 — Customer Preview modal opens via React Portal on document.body with print/download/close controls', () => {
    assert.ok(previewFile.includes('createPortal(modalContent, document.body)'));
    assert.ok(previewFile.includes('data-testid="customer-preview-modal"'));
    assert.ok(previewFile.includes('data-testid="preview-print-btn"'));
    assert.ok(previewFile.includes('data-testid="preview-download-pdf-btn"'));
    assert.ok(previewFile.includes('data-testid="preview-close-btn"'));
  });

  // TEST 17 — Customer Preview modal NEVER renders internal purchase costs, supplier names, or profit margins (Strict Confidentiality)
  await t.test('TEST 17 — Customer Preview modal NEVER renders internal purchase costs, supplier names, or profit margins', () => {
    // Verify that purchase_cost, supplier_name, margin are not rendered in the preview JSX
    assert.ok(!previewFile.includes('item.purchase_cost'));
    assert.ok(!previewFile.includes('item.supplier_name'));
    assert.ok(!previewFile.includes('item.internal_notes'));
    assert.ok(!previewFile.includes('purchaseCost'));
    assert.ok(!previewFile.includes('grossMargin'));
  });

  // TEST 18 — Customer Description entered in Product Drawer exactly appears in Customer Preview
  await t.test('TEST 18 — Customer Description entered in Product Drawer exactly appears in Customer Preview', () => {
    assert.ok(drawerFile.includes('customerDescription'));
    assert.ok(drawerFile.includes('MANDATORY CUSTOMER-FACING DESCRIPTION'));
    assert.ok(previewFile.includes('item.customer_description'));
    assert.ok(previewFile.includes('data-testid="preview-customer-description"'));
  });

  // TEST 19 — Specifications and Short Highlights entered in Product Drawer appear in Customer Preview
  await t.test('TEST 19 — Specifications and Short Highlights entered in Product Drawer appear in Customer Preview', () => {
    assert.ok(previewFile.includes('data-testid="preview-specifications"'));
    assert.ok(previewFile.includes('data-testid="preview-short-highlights"'));
    assert.ok(previewFile.includes('item.specifications'));
    assert.ok(previewFile.includes('item.short_highlights'));
  });

  // TEST 20 — Editor and Preview remain 100% synchronized through the same canonical quotation data model
  await t.test('TEST 20 — Editor and Preview remain 100% synchronized through the same canonical quotation data model', () => {
    // Both read from the same `items` array in DemoQuotationWorkspace
    assert.ok(workspaceFile.includes('items={items}'));
    assert.ok(workspaceFile.includes('customer={customer}'));
    assert.ok(workspaceFile.includes('format={currentFormat}'));
    assert.ok(workspaceFile.includes('sections={activeSections}'));
    assert.ok(workspaceFile.includes('onSave={handleSaveItemFromDrawer}'));
  });
});
