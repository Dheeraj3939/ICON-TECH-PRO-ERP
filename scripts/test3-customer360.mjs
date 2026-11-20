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

async function test3_Customer360() {
  console.log('=== TEST 3: CUSTOMER 360 & TALLY DATA AUDIT ===\n');

  // 1. Fetch Swan Environmental profile
  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .ilike('company_name', '%Swan Environmental%')
    .single();

  console.log('1. Customer Profile:');
  console.log(`   - ID: ${customer.id}`);
  console.log(`   - Company: ${customer.company_name}`);
  console.log(`   - Contact Person: ${customer.contact_person}`);
  console.log(`   - Phone: ${customer.phone}`);
  console.log(`   - GSTIN: ${customer.gstin}`);
  console.log(`   - PAN: ${customer.pan}`);
  console.log(`   - Address: ${customer.billing_address}`);

  // 2. Fetch Invoices for Swan
  const { data: invoices, error: iErr } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, grand_total, paid_amount, balance_amount, status')
    .eq('customer_id', customer.id)
    .order('invoice_date', { ascending: false });

  console.log(`\n2. Invoices linked to Swan (${invoices.length} invoices):`);
  console.table(invoices);

  // 3. Line items for what customer bought
  const invIds = invoices.map(i => i.id);
  const { data: items } = await supabase
    .from('invoice_items')
    .select('invoice_id, description, hsn_code, quantity, unit, rate, gst_rate, total_amount')
    .in('invoice_id', invIds);

  console.log(`\n3. Purchased Equipment & Solutions (Line Items count: ${items?.length || 0}):`);
  console.table(items?.map(it => ({
    product: it.description,
    qty: `${it.quantity} ${it.unit}`,
    rate: `₹${Number(it.rate).toLocaleString('en-IN')}`,
    total: `₹${Number(it.total_amount).toLocaleString('en-IN')}`
  })));

  // 4. Payments for Swan
  const { data: payments } = await supabase
    .from('payments')
    .select('payment_number, payment_date, amount, mode, reference_number')
    .eq('customer_id', customer.id)
    .order('payment_date', { ascending: false });

  console.log(`\n4. Payments linked to Swan (${payments?.length || 0} payments):`);
  console.table(payments);

  // 5. Total Balance Due verification
  const totalBilled = invoices.reduce((s, i) => s + (i.grand_total || 0), 0);
  const totalPaid = (payments || []).reduce((s, p) => s + (p.amount || 0), 0);
  const balanceDue = invoices.reduce((s, i) => s + (i.balance_amount || 0), 0);

  console.log('\n5. Financial Consistency:');
  console.log(`   - Total Invoiced: ₹${totalBilled.toLocaleString('en-IN')}`);
  console.log(`   - Total Paid / Receipts: ₹${totalPaid.toLocaleString('en-IN')}`);
  console.log(`   - Active Balance Due: ₹${balanceDue.toLocaleString('en-IN')}`);
  console.log(`   - Status: ${balanceDue === 280000 ? 'PASS (Exact match with ₹2.80L due on INV-26-0401)' : 'FAIL'}`);
}

test3_Customer360().catch(console.error);
