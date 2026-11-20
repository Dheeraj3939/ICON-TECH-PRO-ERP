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

for (const [k, v] of Object.entries(env)) {
  process.env[k] = v;
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function testReportData() {
  const [invRes, payRes, empRes] = await Promise.all([
    supabase.from('invoices').select('*'),
    supabase.from('payments').select('*'),
    supabase.from('employees').select('*').eq('corporate_email', 'icontechpro@gmail.com').single(),
  ]);

  const invoices = invRes.data || [];
  const payments = payRes.data || [];
  const md = empRes.data;

  const totalInvoiced = invoices.reduce((s, i) => s + (i.grand_total || 0), 0);
  const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalBalance = invoices.reduce((s, i) => s + (i.balance_amount || 0), 0);

  console.log('=== REAL DATA VERIFICATION FOR AUTOMATED MD EMAIL ===');
  console.log(`Target MD Recipient: ${md?.full_name} (${md?.designation}) <${md?.corporate_email}>`);
  console.log(`Total Invoices: ${invoices.length} records, Total Invoiced Value: ₹${(totalInvoiced / 100000).toFixed(2)} Lakhs (₹${totalInvoiced.toLocaleString('en-IN')})`);
  console.log(`Total Payments: ${payments.length} records, Total Collected: ₹${(totalCollected / 100000).toFixed(2)} Lakhs (₹${totalCollected.toLocaleString('en-IN')})`);
  console.log(`Outstanding Balance: ₹${(totalBalance / 100000).toFixed(2)} Lakhs (₹${totalBalance.toLocaleString('en-IN')})`);
  console.log('Sample Invoices:');
  console.table(invoices.slice(0, 5).map(i => ({
    number: i.invoice_number,
    date: i.invoice_date,
    customer: i.customer_name,
    amount: i.grand_total,
    balance: i.balance_amount,
    status: i.status
  })));
}

testReportData().catch(console.error);
