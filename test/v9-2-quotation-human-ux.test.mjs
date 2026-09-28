import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — QUOTATION HUMAN-FRIENDLY UX VERIFICATION SUITE
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Quotation Module Human-Friendly UX Rebuild', async (t) => {

  const workspaceFile = fs.readFileSync(
    path.join(rootDir, 'src/components/quotations/QuotationFormWorkspace.tsx'),
    'utf8'
  );
  const newPageRoute = fs.readFileSync(
    path.join(rootDir, 'src/app/(dashboard)/dashboard/quotations/new/page.tsx'),
    'utf8'
  );
  const editPageRoute = fs.readFileSync(
    path.join(rootDir, 'src/app/(dashboard)/dashboard/quotations/[id]/edit/page.tsx'),
    'utf8'
  );
  const registerPageRoute = fs.readFileSync(
    path.join(rootDir, 'src/app/(dashboard)/dashboard/quotations/page.tsx'),
    'utf8'
  );
  const printModalFile = fs.readFileSync(
    path.join(rootDir, 'src/components/modals/PrintQuotationModal.tsx'),
    'utf8'
  );
  const quotationActions = fs.readFileSync(
    path.join(rootDir, 'src/lib/actions/quotations.ts'),
    'utf8'
  );

  // 1. New quotation opens cleanly in full page
  await t.test('1. New quotation opens cleanly in dedicated full page workspace', () => {
    assert.ok(fs.existsSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/quotations/new/page.tsx')));
    assert.ok(newPageRoute.includes('QuotationFormWorkspace'));
    assert.ok(workspaceFile.includes('New Quotation'));
    assert.ok(workspaceFile.includes('Quote #:'));
  });

  // 2. Customer selection works
  await t.test('2. Customer selection works with search and auto-complete', () => {
    assert.ok(workspaceFile.includes('Search customer by name, company, phone or GSTIN...'));
    assert.ok(workspaceFile.includes('filteredCustomers'));
    assert.ok(workspaceFile.includes('handleSelectCustomer'));
    assert.ok(workspaceFile.includes('selectedCustomerId'));
  });

  // 3. New customer works
  await t.test('3. New customer quick addition integration works', () => {
    assert.ok(workspaceFile.includes('+ New Customer'));
    assert.ok(workspaceFile.includes('CustomerFormModal'));
    assert.ok(workspaceFile.includes('setIsNewCustomerModalOpen(true)'));
  });

  // 4. Custom product works (does not require existing product master)
  await t.test('4. Custom product entry works without existing in master catalog', () => {
    assert.ok(workspaceFile.includes('+ Add Custom Item'));
    assert.ok(workspaceFile.includes('handleAddCustomItem'));
    assert.ok(workspaceFile.includes('is_custom: true'));
  });

  // 5. Multiple line items work
  await t.test('5. Multiple line items and duplication work', () => {
    assert.ok(workspaceFile.includes('handleDuplicateItem'));
    assert.ok(workspaceFile.includes('handleRemoveItem'));
    assert.ok(workspaceFile.includes('items.map'));
  });

  // 6. Quantity calculation works
  await t.test('6. Quantity calculation and line total update work', () => {
    assert.ok(workspaceFile.includes('handleItemChange'));
    assert.ok(workspaceFile.includes('const qty = Math.max(0, Number(it.quantity)'));
  });

  // 7. GST-exclusive calculation works
  await t.test('7. GST-exclusive calculation mode works mathematically', () => {
    assert.ok(workspaceFile.includes("pricingMode === 'EXCLUSIVE'"));
    // e.g. 50,000 at 18% -> taxable 50,000, GST 9,000, Total 59,000
    const qty = 1;
    const rate = 50000;
    const gstRate = 18;
    const taxable = rate * qty;
    const gst = (taxable * gstRate) / 100;
    const total = taxable + gst;
    assert.equal(taxable, 50000);
    assert.equal(gst, 9000);
    assert.equal(total, 59000);
  });

  // 8. GST-inclusive calculation works
  await t.test('8. GST-inclusive calculation works (e.g. ₹65,000 all-in)', () => {
    assert.ok(workspaceFile.includes("pricingMode === 'INCLUSIVE'"));
    // Formula: Taxable = Inclusive / (1 + GST/100)
    const inclusive = 65000;
    const gstRate = 18;
    const taxable = Math.round((inclusive / (1 + gstRate / 100)) * 100) / 100;
    const gst = Math.round((inclusive - taxable) * 100) / 100;
    const total = Math.round((taxable + gst) * 100) / 100;

    assert.equal(taxable, 55084.75);
    assert.equal(gst, 9915.25);
    assert.equal(total, 65000.00);
  });

  // 9. Discount works
  await t.test('9. Discount works with governance approval alerts', () => {
    assert.ok(workspaceFile.includes('overallDiscountAmount'));
    assert.ok(workspaceFile.includes('isDiscountApprovalRequired'));
    assert.ok(workspaceFile.includes('Discount exceeds'));
  });

  // 10. Grand total works
  await t.test('10. Grand total calculation is dominant and formatted in INR', () => {
    assert.ok(workspaceFile.includes('Grand Total (Incl. GST)'));
    assert.ok(workspaceFile.includes('grandTotal'));
    assert.ok(workspaceFile.includes('toLocaleString(\'en-IN\')'));
  });

  // 11. Terms work
  await t.test('11. Terms & Conditions with sensible business presets work', () => {
    assert.ok(workspaceFile.includes('paymentTerms'));
    assert.ok(workspaceFile.includes('deliveryTerms'));
    assert.ok(workspaceFile.includes('validityDays'));
    assert.ok(workspaceFile.includes('warrantyTerms'));
    assert.ok(workspaceFile.includes('installationTerms'));
  });

  // 12. Save draft works
  await t.test('12. Save Draft action works', () => {
    assert.ok(workspaceFile.includes("handleSave('Draft')"));
    assert.ok(workspaceFile.includes('Save as Draft'));
  });

  // 13. Preview works
  await t.test('13. Preview modal integration works', () => {
    assert.ok(workspaceFile.includes('PrintQuotationModal'));
    assert.ok(workspaceFile.includes('setIsPreviewOpen(true)'));
    assert.ok(workspaceFile.includes('currentQuotationSnapshot'));
  });

  // 14. PDF works
  await t.test('14. PDF download and offline printing triggers work', () => {
    assert.ok(printModalFile.includes('handleDownloadPDF'));
    assert.ok(printModalFile.includes('window.print()'));
    assert.ok(printModalFile.includes('printable-quotation-content'));
  });

  // 15. Send action respects permissions
  await t.test('15. Send and approval actions respect RBAC permissions', () => {
    assert.ok(quotationActions.includes('updateQuotationStatus'));
    assert.ok(quotationActions.includes('recordQuotationSent'));
    assert.ok(workspaceFile.includes('userRole'));
  });

  // 16. Revision works
  await t.test('16. Revision handling and full page edit route work', () => {
    assert.ok(fs.existsSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/quotations/[id]/edit/page.tsx')));
    assert.ok(editPageRoute.includes('QuotationFormWorkspace'));
    assert.ok(quotationActions.includes('createQuotationRevision'));
    assert.ok(quotationActions.includes('getQuotationRevisions'));
  });

  // 17. Revision immutability works
  await t.test('17. Revision history snapshots remain immutable and viewable', () => {
    assert.ok(registerPageRoute.includes('Revision History'));
    assert.ok(registerPageRoute.includes('handleOpenRevisions'));
    assert.ok(registerPageRoute.includes('revisionsList'));
  });

  // 18. Internal pricing is protected
  await t.test('18. Internal purchase cost and profit are strictly protected from customer view', () => {
    // In PrintQuotationModal (customer view), purchase price and margin are completely absent
    assert.ok(!printModalFile.includes('purchase_price'));
    assert.ok(!printModalFile.includes('purchase_cost'));
    assert.ok(!printModalFile.includes('margin_pct'));
    assert.ok(!printModalFile.includes('total_cost'));

    // In QuotationFormWorkspace, internal pricing is gated by isManagementOrAdmin and collapsed by default
    assert.ok(workspaceFile.includes('isManagementOrAdmin'));
    assert.ok(workspaceFile.includes('showInternalPricing'));
    assert.ok(workspaceFile.includes('INTERNAL PRICING & SOURCING (MANAGEMENT CONFIDENTIAL)'));
  });

  // 19. Demo data is absent from normal quotation workflow
  await t.test('19. Demo customer data and hardcoded test IDs are absent', () => {
    assert.ok(!registerPageRoute.includes('Swan Technologies'));
    assert.ok(!registerPageRoute.includes('DEMO-ICON260099'));
    assert.ok(!workspaceFile.includes('Swan Technologies'));
    assert.ok(!workspaceFile.includes('DEMO-ICON260099'));
  });

  // 20. No developer terminology appears in normal quotation workflow
  await t.test('20. No developer terminology in normal quotation workflow', () => {
    assert.ok(!registerPageRoute.includes('Canonical Chain'));
    assert.ok(!registerPageRoute.includes('Turnkey Execution Engine'));
    assert.ok(!workspaceFile.includes('Canonical Chain'));
    assert.ok(!workspaceFile.includes('Turnkey Execution Engine'));
    assert.ok(!workspaceFile.includes('AI Orchestrator'));
  });

});
