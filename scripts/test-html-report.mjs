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

async function testHtmlReport() {
  const [invRes, payRes] = await Promise.all([
    supabase.from('invoices').select('*'),
    supabase.from('payments').select('*'),
  ]);

  const invoices = invRes.data || [];
  const payments = payRes.data || [];
  const totalInvoiced = invoices.reduce((s, i) => s + (i.grand_total || 0), 0);
  const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalBalance = invoices.reduce((s, i) => s + (i.balance_amount || 0), 0);

  const dataset = {
    period: {
      frequency: 'DAILY',
      period_label: 'Daily Executive Register — 20 Nov 2026',
      start_date: '2026-11-19',
      end_date: '2026-11-20',
      fiscal_year: '2026-27'
    },
    roleScope: 'Managing Director',
    recipientEmail: 'icontechpro@gmail.com',
    salespersonName: 'Borra Narsimulu',
    summary: {
      totalEnquiries: 0,
      totalQuotations: 0,
      quotationTotalValue: 0,
      totalSalesOrders: 0,
      salesOrderTotalValue: 0,
      totalInvoiced,
      totalCollected,
      outstandingReceivables: totalBalance,
      grossMarginPct: 21.8,
    },
    quotations: [],
    salesOrders: [],
    invoices: invoices.slice(0, 10).map(i => ({
      number: i.invoice_number,
      date: i.invoice_date,
      customer: i.customer_name,
      amount: i.grand_total,
      balance: i.balance_amount,
      status: i.status
    })),
    collections: payments.slice(0, 10).map(p => ({
      number: p.payment_number || 'RCPT',
      date: p.payment_date,
      customer: p.customer_name,
      amount: p.amount,
      mode: p.payment_mode || 'Bank Transfer'
    }))
  };

  console.log('Dataset built successfully. Invoices sample count:', dataset.invoices.length);
  console.log('Total invoiced:', dataset.summary.totalInvoiced);
  console.log('Total collected:', dataset.summary.totalCollected);
  console.log('Outstanding receivables:', dataset.summary.outstandingReceivables);
}

testHtmlReport().catch(console.error);
