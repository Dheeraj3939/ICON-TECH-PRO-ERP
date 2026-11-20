import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envText = fs.readFileSync('.env.uat.local', 'utf8');
const env = {};
envText.split(/\r?\n/).forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function purgeTestData() {
  console.log('=== TARGETED TEST DATA PURGE ===');

  // 1. Purge 30 Swan Environmental mock test invoices
  console.log('\n1. Purging INV-TALLY-ENV-* mock test invoices...');
  const { data: delEnv, error: errEnv } = await supabase
    .from('invoices')
    .delete()
    .ilike('invoice_number', '%ENV%')
    .select('id, invoice_number');

  if (errEnv) console.error('Error deleting ENV invoices:', errEnv);
  else console.log(`Deleted ${delEnv?.length || 0} INV-TALLY-ENV invoices.`);

  // 2. Purge 100 Swan Biotech mock test invoices
  console.log('\n2. Purging Swan Biotech Pvt Ltd mock test invoices...');
  const { data: delBioInvs, error: errBioInvs } = await supabase
    .from('invoices')
    .delete()
    .ilike('company_name', '%Swan Biotech%')
    .select('id, invoice_number');

  if (errBioInvs) console.error('Error deleting Swan Biotech invoices:', errBioInvs);
  else console.log(`Deleted ${delBioInvs?.length || 0} Swan Biotech invoices.`);

  // 3. Purge 25 RCPT-BIO test payments
  console.log('\n3. Purging RCPT-BIO-* test payments...');
  const { data: delBioPay, error: errBioPay } = await supabase
    .from('payments')
    .delete()
    .ilike('payment_number', '%BIO%')
    .select('id, payment_number');

  if (errBioPay) console.error('Error deleting RCPT-BIO payments:', errBioPay);
  else console.log(`Deleted ${delBioPay?.length || 0} RCPT-BIO payments.`);

  // 4. Verify Remaining Live Invoices in DB
  console.log('\n4. Verifying Remaining Live Invoices in DB...');
  const { data: remainingInvs, error: errRem } = await supabase
    .from('invoices')
    .select('id, invoice_number, customer_name, company_name, grand_total, invoice_date')
    .order('invoice_date', { ascending: false });

  if (errRem) {
    console.error('Error querying remaining invoices:', errRem);
  } else {
    console.log(`Remaining Invoices Count: ${remainingInvs.length}`);
    console.log('\nSample of Remaining Live Original Tally Invoices:');
    for (const inv of remainingInvs.slice(0, 15)) {
      console.log(`- ${inv.invoice_number} | ${inv.company_name} | ₹${inv.grand_total} | Date: ${inv.invoice_date}`);
    }

    // Customer count distribution
    const custMap = {};
    for (const inv of remainingInvs) {
      const c = inv.company_name || inv.customer_name;
      custMap[c] = (custMap[c] || 0) + 1;
    }
    console.log(`\nActive Clients with Invoices: ${Object.keys(custMap).length} clients`);
    console.log('Top clients:', Object.entries(custMap).slice(0, 10));
  }
}

purgeTestData().catch(console.error);
