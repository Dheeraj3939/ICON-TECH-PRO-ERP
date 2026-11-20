import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.uat.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
  env[key] = val;
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function purgeRemainingSyntheticData() {
  console.log('=== PURGING REMAINING SYNTHETIC TEST INVOICES & DATA ===');

  // 1. Identify test invoices (100 Swan Biotech + 4 UAT Verification)
  const { data: testInvs, error: findErr } = await supabase
    .from('invoices')
    .select('id, invoice_number, customer_name')
    .or('customer_name.ilike.%Swan Biotech%,customer_name.ilike.%UAT Verification%');

  if (findErr) {
    console.error('Error finding test invoices:', findErr);
    return;
  }

  console.log(`Found ${testInvs?.length || 0} synthetic test invoices to remove.`);
  const testIds = (testInvs || []).map(i => i.id);

  if (testIds.length > 0) {
    // A. Delete any linked payments
    const { data: delPay, error: payErr } = await supabase
      .from('payments')
      .delete()
      .in('invoice_id', testIds)
      .select('id');
    console.log(`Deleted ${delPay?.length || 0} linked test payments.`);

    // B. Delete any linked invoice_items
    const { data: delItems, error: itemsErr } = await supabase
      .from('invoice_items')
      .delete()
      .in('invoice_id', testIds)
      .select('id');
    console.log(`Deleted ${delItems?.length || 0} linked test invoice items.`);

    // C. Clean linked tally_reconciliations
    const { data: delRecons, error: reconErr } = await supabase
      .from('tally_reconciliations')
      .delete()
      .in('erp_id', testIds)
      .select('id');
    console.log(`Deleted ${delRecons?.length || 0} linked test tally reconciliations.`);

    // D. Delete the test invoices
    const { data: delInvs, error: invErr } = await supabase
      .from('invoices')
      .delete()
      .in('id', testIds)
      .select('id, invoice_number');
    if (invErr) {
      console.error('Error deleting test invoices:', invErr);
    } else {
      console.log(`Successfully deleted ${delInvs?.length || 0} synthetic test invoices.`);
    }
  }

  // 2. Delete test customer: UAT Verification Client 058490
  const { data: delCust, error: custErr } = await supabase
    .from('customers')
    .delete()
    .ilike('customer_name', '%UAT Verification%')
    .select('id, customer_name');
  console.log(`Deleted ${delCust?.length || 0} synthetic test customer record(s).`);

  // 3. Verify clean remaining live data
  const { data: liveInvs, error: liveErr } = await supabase
    .from('invoices')
    .select('id, invoice_number, customer_name, company_name, grand_total, paid_amount, balance_amount, invoice_date')
    .order('invoice_date', { ascending: false });

  console.log(`\nRemaining Clean Live Invoices: ${liveInvs?.length || 0}`);
  const customerMap = {};
  for (const inv of liveInvs || []) {
    const name = inv.customer_name || inv.company_name;
    customerMap[name] = (customerMap[name] || 0) + 1;
  }

  console.log(`Distributed across ${Object.keys(customerMap).length} live Tally customer accounts:`);
  console.table(Object.entries(customerMap).slice(0, 20).map(([client, count]) => ({ client, count })));
}

purgeRemainingSyntheticData().catch(console.error);
