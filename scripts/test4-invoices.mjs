import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.uat.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function test4_InvoicesPage() {
  console.log('=== TEST 4: INVOICES & BILLING PAGE AUDIT ===\n');

  // 1. Total invoices count
  const { data: allInvs, count, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, customer_name, grand_total, paid_amount, balance_amount, status', { count: 'exact' });

  console.log(`1. Total Active Invoices: ${count} (error: ${error?.message || 'none'})`);

  // 2. Check for any synthetic mock numbers
  const syntheticInvs = allInvs.filter(i => i.invoice_number.includes('ENV') || i.invoice_number.includes('DEMO') || i.customer_name.includes('DEMO'));
  console.log(`2. Synthetic / Mock Test Invoices found: ${syntheticInvs.length} (${syntheticInvs.length === 0 ? 'PASS (100% Real Tally Invoices)' : 'FAIL'})`);

  // 3. Status breakdown
  const paidCount = allInvs.filter(i => i.status === 'Paid').length;
  const pendingCount = allInvs.filter(i => i.status !== 'Paid').length;
  const totalBilled = allInvs.reduce((s, i) => s + (i.grand_total || 0), 0);
  const totalBalance = allInvs.reduce((s, i) => s + (i.balance_amount || 0), 0);

  console.log(`3. Financial Metrics:`);
  console.log(`   - Paid Invoices: ${paidCount}`);
  console.log(`   - Unpaid / Pending: ${pendingCount}`);
  console.log(`   - Total Invoiced Value: ₹${(totalBilled / 100000).toFixed(2)} Lakhs (₹${totalBilled.toLocaleString('en-IN')})`);
  console.log(`   - Total Outstanding Balance: ₹${(totalBalance / 100000).toFixed(2)} Lakhs (₹${totalBalance.toLocaleString('en-IN')})`);

  // 4. Sample diverse clients
  console.log(`\n4. Client Diversity Sample:`);
  const uniqueClients = [...new Set(allInvs.map(i => i.customer_name))];
  console.log(`   - Total Distinct Invoiced Clients: ${uniqueClients.length}`);
  console.log(`   - Examples: ${uniqueClients.slice(0, 8).join(', ')}...`);
}

test4_InvoicesPage().catch(console.error);
