import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — PRODUCTION HARDENING REGRESSION SUITE
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Production Hardening & Security Invariants', async (t) => {

  await t.test('1. Quotation Conversion Navigation Route', () => {
    const quotationDetailPage = fs.readFileSync(
      path.join(rootDir, 'src/app/(dashboard)/dashboard/quotations/[id]/page.tsx'),
      'utf8'
    );

    // Verify it routes to /dashboard/sales-orders
    assert.ok(
      quotationDetailPage.includes("router.push(`/dashboard/sales-orders`)"),
      'Quotation convert action must route to /dashboard/sales-orders'
    );

    // Verify broken route /dashboard/orders is eliminated
    assert.ok(
      !quotationDetailPage.includes("router.push(`/dashboard/orders`)"),
      'Quotation convert action must not route to non-existent /dashboard/orders'
    );
  });

  await t.test('2. Role-Based Product Catalog Table Selection Under RLS', () => {
    const productsActionFile = fs.readFileSync(
      path.join(rootDir, 'src/lib/actions/products.ts'),
      'utf8'
    );

    // Verify dynamic table selection
    assert.ok(
      productsActionFile.includes("const targetTable = canSeePurchaseCost ? 'products' : 'products_catalog';"),
      'getProducts must dynamically query products_catalog for non-commercial roles'
    );
    assert.ok(
      productsActionFile.includes("let query = supabase.from(targetTable).select('*', { count: 'exact' });"),
      'getProducts must use targetTable in supabase.from()'
    );

    // Verify commercial roles check
    assert.ok(
      productsActionFile.includes("['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'].includes(user.role)"),
      'canSeePurchaseCost must restrict purchase costs to commercial roles'
    );
  });

  await t.test('3. Fail-Closed quickLoginAsRole in Non-Development Environments', () => {
    const loginActionsFile = fs.readFileSync(
      path.join(rootDir, 'src/app/(auth)/login/actions.ts'),
      'utf8'
    );

    // Verify server-side fail-closed guard
    assert.ok(
      loginActionsFile.includes("if (process.env.NODE_ENV !== 'development')"),
      'quickLoginAsRole must strictly throw if NODE_ENV is not development'
    );
    assert.ok(
      loginActionsFile.includes("Quick role sign-in is strictly prohibited in non-development environments"),
      'quickLoginAsRole must return clear security message'
    );
  });

  await t.test('4. GST-Inclusive vs Exclusive Pricing Mathematics Invariants', () => {
    function roundTo2(num) {
      return Math.round((num + Number.EPSILON) * 100) / 100;
    }

    function calculateItem(item, isInclusive) {
      const qty = Math.max(0.001, Number(item.quantity) || 1);
      const rate = Math.max(0, Number(item.selling_price) || 0);
      const discPct = Math.min(100, Math.max(0, Number(item.discount_pct) || 0));
      const lineGross = rate * qty;
      const discountAmount = roundTo2((lineGross * discPct) / 100);
      const netLine = roundTo2(lineGross - discountAmount);
      const gstRate = item.gst_rate ?? 18;

      let taxable;
      let gstAmt;
      let total;

      if (isInclusive) {
        total = netLine;
        taxable = gstRate > 0 ? roundTo2(netLine / (1 + gstRate / 100)) : netLine;
        gstAmt = roundTo2(total - taxable);
      } else {
        taxable = netLine;
        gstAmt = roundTo2((taxable * gstRate) / 100);
        total = roundTo2(taxable + gstAmt);
      }

      return { lineGross, discountAmount, taxable, gstAmt, total };
    }

    // Case A: 1 unit @ 118,000 inclusive (18% GST)
    const incResult = calculateItem({ quantity: 1, selling_price: 118000, gst_rate: 18 }, true);
    assert.equal(incResult.total, 118000, 'Grand total must remain exactly ₹1,18,000');
    assert.equal(incResult.taxable, 100000, 'Taxable base must be reverse-calculated to ₹1,00,000');
    assert.equal(incResult.gstAmt, 18000, 'GST must be ₹18,000');

    // Case B: 1 unit @ 100,000 exclusive (18% GST)
    const excResult = calculateItem({ quantity: 1, selling_price: 100000, gst_rate: 18 }, false);
    assert.equal(excResult.total, 118000, 'Grand total must be ₹1,18,000');
    assert.equal(excResult.taxable, 100000, 'Taxable base must be ₹1,00,000');
    assert.equal(excResult.gstAmt, 18000, 'GST must be ₹18,000');

    // Case C: 1 unit @ 65,000 inclusive (18% GST)
    const turnkeyResult = calculateItem({ quantity: 1, selling_price: 65000, gst_rate: 18 }, true);
    assert.equal(turnkeyResult.total, 65000, 'Grand total must remain ₹65,000');
    assert.equal(turnkeyResult.taxable, 55084.75, 'Taxable base must be 55084.75');
    assert.equal(turnkeyResult.gstAmt, 9915.25, 'GST must be 9915.25');
    assert.equal(roundTo2(turnkeyResult.taxable + turnkeyResult.gstAmt), 65000, 'Decomposed sum must equal ₹65,000');
  });

  await t.test('5. Quotation Engine Form & Action Schema Propagation', () => {
    const quotationsAction = fs.readFileSync(
      path.join(rootDir, 'src/lib/actions/quotations.ts'),
      'utf8'
    );
    const formWorkspace = fs.readFileSync(
      path.join(rootDir, 'src/components/quotations/QuotationFormWorkspace.tsx'),
      'utf8'
    );
    const validationsFile = fs.readFileSync(
      path.join(rootDir, 'src/lib/validations/erp.ts'),
      'utf8'
    );

    // Verify validations schema accepts is_gst_inclusive and pricing_mode
    assert.ok(validationsFile.includes('is_gst_inclusive: z.boolean().optional()'));
    assert.ok(validationsFile.includes("pricing_mode: z.enum(['EXCLUSIVE', 'INCLUSIVE']).optional()"));

    // Verify QuotationFormWorkspace sends both fields in handleSave and handleSendToCustomer
    assert.ok(formWorkspace.includes('is_gst_inclusive: pricingMode === \'INCLUSIVE\''));
    assert.ok(formWorkspace.includes('pricing_mode: pricingMode'));

    // Verify createQuotation and updateQuotation capture isInclusive
    assert.ok(quotationsAction.includes("const isInclusive = Boolean(payload.is_gst_inclusive || payload.pricing_mode === 'INCLUSIVE');"));
    assert.ok(quotationsAction.includes("is_gst_inclusive: isInclusive"));
    assert.ok(quotationsAction.includes("pricing_mode: isInclusive ? 'INCLUSIVE' : 'EXCLUSIVE'"));
  });

  await t.test('6. Production Database Hardening SQL Security Invariants', () => {
    const migrationSQL = fs.readFileSync(
      path.join(rootDir, 'supabase/migrations/20261029000001_production_security_hardening.sql'),
      'utf8'
    );

    // Invariant A: No SECURITY DEFINER function trusts user-editable user_metadata
    assert.ok(
      !migrationSQL.includes("user_metadata'"),
      'Migration must NEVER query client-editable user_metadata for role authorization'
    );
    assert.ok(
      migrationSQL.includes("app_metadata"),
      'Migration may check server-assigned app_metadata'
    );

    // Invariant B: Safe search_path on privileged functions
    assert.ok(
      migrationSQL.includes("SET search_path = pg_catalog, public, auth") ||
      migrationSQL.includes("SET search_path = pg_catalog, public"),
      'Privileged functions must specify explicit safe search_path'
    );

    // Invariant C: products_catalog view has security_barrier = true
    assert.ok(
      migrationSQL.includes("WITH (security_barrier = true)"),
      'products_catalog view must be defined WITH (security_barrier = true)'
    );

    // Invariant D: system_settings masks OAuth tokens and secrets from non-admin roles
    assert.ok(
      migrationSQL.includes("gmail_oauth_integration"),
      'system_settings policy must specifically mask gmail_oauth_integration from ordinary staff'
    );
    assert.ok(
      migrationSQL.includes("%secret%") && migrationSQL.includes("%token%"),
      'system_settings policy must mask secret and token settings from ordinary staff'
    );

    // Invariant E: Global TRUNCATE elimination from PUBLIC, anon, authenticated
    assert.ok(
      migrationSQL.includes("REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC;"),
      'Must revoke TRUNCATE from anon, authenticated, and PUBLIC'
    );

    // Invariant F: Audit log write revocation from authenticated
    assert.ok(
      migrationSQL.includes("REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM authenticated, anon, PUBLIC"),
      'Must revoke all mutations on audit tables from authenticated and PUBLIC'
    );
  });

  await t.test('7. Production Rollback Migration Integrity', () => {
    const rollbackSQL = fs.readFileSync(
      path.join(rootDir, 'supabase/migrations/20261029000001_production_security_hardening_rollback.sql'),
      'utf8'
    );

    // Invariant A: Safe conditional execution
    assert.ok(rollbackSQL.includes("to_regclass('public.system_settings')"));
    assert.ok(rollbackSQL.includes("to_regclass('public.products')"));
    assert.ok(rollbackSQL.includes("to_regclass('public.' || t)"));
    assert.ok(rollbackSQL.includes("audit_logs"));

    // Invariant B: Restores baseline current_erp_role
    assert.ok(rollbackSQL.includes("CREATE OR REPLACE FUNCTION public.current_erp_role()"));
    assert.ok(rollbackSQL.includes("WHERE up.id = auth.uid()"));

    // Invariant C: Transaction wrapped
    assert.ok(rollbackSQL.startsWith("--") && rollbackSQL.includes("BEGIN;"));
    assert.ok(rollbackSQL.includes("COMMIT;"));
  });
});
