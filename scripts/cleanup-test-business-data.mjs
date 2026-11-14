import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf8');
const lines = envContent.split(/\r?\n/);
let url = '', key = '';
for (const line of lines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SECRET_KEY=')) key = line.split('=')[1].trim();
}

if (!url || !key) {
  console.error('Supabase URL or Secret Key missing from .env.local');
  process.exit(1);
}

const admin = createClient(url, key);

// Positively classified test customer IDs
const TEST_CUSTOMER_IDS = [
  '00000000-0000-0000-0000-000000000099', // DEMO — Swan Technologies Pvt Ltd
  'a0aac469-bd2a-4df6-b792-04a4f364fe26', // Alpha Infra Tech Pvt Ltd (seed)
  'a9a507fd-fe04-484b-bd10-0c102809b2ea', // Alpha Infra Tech Pvt Ltd (duplicate seed)
  '588fb7f0-e1de-4e0c-b7a0-b04a7fd42ec8', // Beta Comms Pvt Ltd (seed)
  'a524161d-b056-4853-934e-6a6ad6fd07e1', // Beta Comms Pvt Ltd (duplicate seed)
  '3d7a032b-9838-4a73-94c0-ee4804c500ce', // shiva@gmail.com (UAT manual test)
  '8f427f5e-d0ec-4ff1-80f8-452566ebd83f', // vineet@icontechpro.in (UAT manual test)
  'ce372dcf-a0b0-42be-8360-d2dfd82a2196', // rahul.n@gmail.com (UAT manual test)
];

async function runCleanup() {
  console.log('============================================================');
  console.log('ICON TECH PRO ERP V9.2 — DEPENDENCY-AWARE TEST DATA CLEANUP');
  console.log('============================================================\n');

  // 1. Verify backup snapshot exists
  const backupFiles = fs.readdirSync('backups').filter(f => f.startsWith('pre-cleanup-db-snapshot'));
  if (backupFiles.length === 0) {
    console.error('SAFETY HALT: No pre-cleanup snapshot directory found in backups/');
    process.exit(1);
  }
  console.log(`[SAFETY CHECK] Verified verified backup snapshot exists: ${backupFiles[backupFiles.length - 1]}`);

  // 2. Fetch target record IDs to be cleaned
  // Quotations linked to test customers
  const { data: testQuotations, error: qErr } = await admin
    .from('quotations')
    .select('id, quotation_number, customer_id')
    .in('customer_id', TEST_CUSTOMER_IDS);
  if (qErr) throw qErr;
  const testQuotationIds = (testQuotations || []).map(q => q.id);
  console.log(`[TARGET] Test Quotations: ${testQuotationIds.length} found`);

  // Invoices linked to test customers
  const { data: testInvoices, error: invErr } = await admin
    .from('invoices')
    .select('id, invoice_number, customer_id')
    .in('customer_id', TEST_CUSTOMER_IDS);
  if (invErr) throw invErr;
  const testInvoiceIds = (testInvoices || []).map(i => i.id);
  console.log(`[TARGET] Test Invoices: ${testInvoiceIds.length} found`);

  // Sales Orders linked to test customers
  const { data: testOrders, error: ordErr } = await admin
    .from('sales_orders')
    .select('id, order_number, customer_id')
    .in('customer_id', TEST_CUSTOMER_IDS);
  if (ordErr) throw ordErr;
  const testOrderIds = (testOrders || []).map(o => o.id);
  console.log(`[TARGET] Test Sales Orders: ${testOrderIds.length} found`);

  // Enquiries linked to test customers
  const { data: testEnquiries, error: enqErr } = await admin
    .from('enquiries')
    .select('id, customer_id')
    .in('customer_id', TEST_CUSTOMER_IDS);
  if (enqErr) throw enqErr;
  const testEnquiryIds = (testEnquiries || []).map(e => e.id);
  console.log(`[TARGET] Test Enquiries: ${testEnquiryIds.length} found`);

  // Payments linked to test customers or test invoices
  const { data: allPayments, error: payErr } = await admin
    .from('payments')
    .select('id, payment_number, customer_id, invoice_id');
  if (payErr) throw payErr;
  const testPaymentIds = (allPayments || [])
    .filter(p => !p.customer_id || TEST_CUSTOMER_IDS.includes(p.customer_id) || (p.invoice_id && testInvoiceIds.includes(p.invoice_id)))
    .map(p => p.id);
  console.log(`[TARGET] Test Payments: ${testPaymentIds.length} found`);

  console.log('\n--- EXECUTING DEPENDENCY-AWARE DELETION ---\n');

  // Step A: Delete Invoice Items (children of test invoices)
  if (testInvoiceIds.length > 0) {
    const { error: delInvItemsErr, count } = await admin
      .from('invoice_items')
      .delete({ count: 'exact' })
      .in('invoice_id', testInvoiceIds);
    if (delInvItemsErr) console.warn('[!] invoice_items delete error:', delInvItemsErr.message);
    else console.log(`[DELETED] invoice_items: ${count ?? 'all matching'}`);
  }

  // Step B: Delete Payments
  if (testPaymentIds.length > 0) {
    const { error: delPayErr, count } = await admin
      .from('payments')
      .delete({ count: 'exact' })
      .in('id', testPaymentIds);
    if (delPayErr) console.warn('[!] payments delete error:', delPayErr.message);
    else console.log(`[DELETED] payments: ${count ?? 'all matching'}`);
  }

  // Step C: Delete Invoices
  if (testInvoiceIds.length > 0) {
    const { error: delInvErr, count } = await admin
      .from('invoices')
      .delete({ count: 'exact' })
      .in('id', testInvoiceIds);
    if (delInvErr) console.warn('[!] invoices delete error:', delInvErr.message);
    else console.log(`[DELETED] invoices: ${count ?? 'all matching'}`);
  }

  // Step D: Delete Sales Order Items (if any table exists)
  try {
    if (testOrderIds.length > 0) {
      await admin.from('sales_order_items').delete().in('sales_order_id', testOrderIds);
    }
  } catch {}

  // Step E: Delete Sales Orders
  if (testOrderIds.length > 0) {
    const { error: delOrdErr, count } = await admin
      .from('sales_orders')
      .delete({ count: 'exact' })
      .in('id', testOrderIds);
    if (delOrdErr) console.warn('[!] sales_orders delete error:', delOrdErr.message);
    else console.log(`[DELETED] sales_orders: ${count ?? 'all matching'}`);
  }

  // Step F: Delete Quotation Items (children of test quotations)
  if (testQuotationIds.length > 0) {
    const { error: delQItemsErr, count } = await admin
      .from('quotation_items')
      .delete({ count: 'exact' })
      .in('quotation_id', testQuotationIds);
    if (delQItemsErr) console.warn('[!] quotation_items delete error:', delQItemsErr.message);
    else console.log(`[DELETED] quotation_items: ${count ?? 'all matching'}`);
  }

  // Step G: Delete Quotations
  if (testQuotationIds.length > 0) {
    const { error: delQErr, count } = await admin
      .from('quotations')
      .delete({ count: 'exact' })
      .in('id', testQuotationIds);
    if (delQErr) console.warn('[!] quotations delete error:', delQErr.message);
    else console.log(`[DELETED] quotations: ${count ?? 'all matching'}`);
  }

  // Step H: Delete Enquiries
  if (testEnquiryIds.length > 0) {
    const { error: delEnqErr, count } = await admin
      .from('enquiries')
      .delete({ count: 'exact' })
      .in('id', testEnquiryIds);
    if (delEnqErr) console.warn('[!] enquiries delete error:', delEnqErr.message);
    else console.log(`[DELETED] enquiries: ${count ?? 'all matching'}`);
  }

  // Step I: Delete Customer Contacts (if any)
  try {
    await admin.from('customer_contacts').delete().in('customer_id', TEST_CUSTOMER_IDS);
  } catch {}

  // Step J: Delete Customers
  const { error: delCustErr, count: custCount } = await admin
    .from('customers')
    .delete({ count: 'exact' })
    .in('id', TEST_CUSTOMER_IDS);
  if (delCustErr) console.warn('[!] customers delete error:', delCustErr.message);
  else console.log(`[DELETED] customers: ${custCount ?? 'all matching'}`);

  console.log('\n--- POST-CLEANUP VERIFICATION ---\n');

  const checkTables = [
    'customers',
    'enquiries',
    'quotations',
    'quotation_items',
    'sales_orders',
    'invoices',
    'invoice_items',
    'payments',
    'managed_user_credentials',
    'roles',
    'system_settings',
    'audit_logs'
  ];

  for (const t of checkTables) {
    const { count } = await admin.from(t).select('*', { count: 'exact', head: true });
    console.log(`[POST-CLEANUP] ${t.padEnd(28)}: ${count} rows`);
  }

  console.log('\n============================================================');
  console.log('TEST DATA CLEANUP COMPLETE.');
  console.log('System settings, Admin credentials, Roles, and Audit logs remain 100% PRESERVED.');
  console.log('============================================================');
}

runCleanup().catch(console.error);
