// ==============================================================================
// ICON TECH PRO ERP V8 — Phase H: Accounts / Collections & Receivables Tests
// Validates:
//   1. Derived balance formula: balance_amount = grand_total - SUM(payments)
//   2. Overpayment prevention: Payment > balance is strictly rejected
//   3. Non-positive payment amount rejection (<= 0)
//   4. Status transition lifecycle: Unpaid -> Partially Paid -> Paid
//   5. Accounts Aging Buckets: 0-30, 31-60, 61-90, 90+ days
//   6. Customer-wise outstanding aggregation
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

// --- Pure Mock Calculation Engines Matching Action Layer ---

function calculateInvoiceBalance(grandTotal, payments) {
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balance = Math.max(0, Number((grandTotal - totalPaid).toFixed(2)));
  let status = 'Unpaid';
  if (balance === 0 && totalPaid > 0) {
    status = 'Paid';
  } else if (totalPaid > 0 && balance > 0) {
    status = 'Partially Paid';
  }
  return {
    grandTotal,
    totalPaid: Number(totalPaid.toFixed(2)),
    balance,
    status,
  };
}

function recordPaymentValidation(invoice, paymentAmount) {
  if (paymentAmount <= 0) {
    return { success: false, error: 'Payment amount must be greater than zero.' };
  }
  if (paymentAmount > invoice.balance_amount) {
    return {
      success: false,
      error: `Payment exceeds outstanding invoice balance. Outstanding balance is ₹${invoice.balance_amount}`,
    };
  }
  const newPaid = Number(((invoice.paid_amount || 0) + paymentAmount).toFixed(2));
  const newBalance = Math.max(0, Number((invoice.grand_total - newPaid).toFixed(2)));
  const newStatus = newBalance === 0 ? 'Paid' : 'Partially Paid';

  return {
    success: true,
    paid_amount: newPaid,
    balance_amount: newBalance,
    status: newStatus,
  };
}

function categorizeAgingBuckets(invoices, referenceDateStr) {
  const refDate = new Date(referenceDateStr);
  const buckets = {
    '0-30': { amount: 0, count: 0, invoices: [] },
    '31-60': { amount: 0, count: 0, invoices: [] },
    '61-90': { amount: 0, count: 0, invoices: [] },
    '90+': { amount: 0, count: 0, invoices: [] },
  };

  let totalOutstanding = 0;
  let totalOverdue = 0;

  for (const inv of invoices) {
    if (inv.status === 'Paid' || (inv.balance_amount || 0) <= 0) continue;

    const balance = Number(inv.balance_amount.toFixed(2));
    totalOutstanding = Number((totalOutstanding + balance).toFixed(2));

    if (inv.due_date && inv.due_date < referenceDateStr) {
      totalOverdue = Number((totalOverdue + balance).toFixed(2));
    }

    const invDate = new Date(inv.invoice_date);
    const diffDays = Math.floor(Math.max(0, refDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));

    let key = '0-30';
    if (diffDays > 90) key = '90+';
    else if (diffDays > 60) key = '61-90';
    else if (diffDays > 30) key = '31-60';

    buckets[key].amount = Number((buckets[key].amount + balance).toFixed(2));
    buckets[key].count += 1;
    buckets[key].invoices.push(inv);
  }

  return { buckets, totalOutstanding, totalOverdue };
}

function aggregateCustomerOutstanding(invoices, todayStr) {
  const customerMap = new Map();

  for (const inv of invoices) {
    const key = inv.customer_id || inv.customer_name;
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        company_name: inv.company_name,
        total_invoiced: 0,
        total_paid: 0,
        total_balance: 0,
        overdue_balance: 0,
        invoice_count: 0,
      });
    }

    const rec = customerMap.get(key);
    rec.total_invoiced = Number((rec.total_invoiced + inv.grand_total).toFixed(2));
    rec.total_paid = Number((rec.total_paid + (inv.paid_amount || 0)).toFixed(2));
    const bal = Number((inv.balance_amount || 0).toFixed(2));
    rec.total_balance = Number((rec.total_balance + bal).toFixed(2));

    if (inv.due_date && inv.due_date < todayStr && bal > 0) {
      rec.overdue_balance = Number((rec.overdue_balance + bal).toFixed(2));
    }
    rec.invoice_count += 1;
  }

  return Array.from(customerMap.values());
}

// --- Test Suite ---

test('Phase H.1: Derived balance formula guarantees balance_amount = grand_total - sum(payments)', () => {
  const grandTotal = 118000; // 1 Lakh + 18% GST
  const payments = [
    { amount: 30000 },
    { amount: 45000 },
  ];

  const result = calculateInvoiceBalance(grandTotal, payments);
  assert.equal(result.totalPaid, 75000);
  assert.equal(result.balance, 43000);
  assert.equal(result.status, 'Partially Paid');

  // Add final payment
  const fullPayments = [...payments, { amount: 43000 }];
  const finalResult = calculateInvoiceBalance(grandTotal, fullPayments);
  assert.equal(finalResult.totalPaid, 118000);
  assert.equal(finalResult.balance, 0);
  assert.equal(finalResult.status, 'Paid');
});

test('Phase H.2: Overpayment prevention strictly rejects payment exceeding outstanding balance', () => {
  const invoice = {
    id: 'INV-101',
    grand_total: 50000,
    paid_amount: 35000,
    balance_amount: 15000,
    status: 'Partially Paid',
  };

  const attempt1 = recordPaymentValidation(invoice, 20000);
  assert.equal(attempt1.success, false);
  assert.match(attempt1.error, /exceeds outstanding invoice balance/);

  const attempt2 = recordPaymentValidation(invoice, 15000);
  assert.equal(attempt2.success, true);
  assert.equal(attempt2.balance_amount, 0);
  assert.equal(attempt2.status, 'Paid');
});

test('Phase H.3: Payment validation rejects zero and negative amounts', () => {
  const invoice = {
    id: 'INV-102',
    grand_total: 50000,
    paid_amount: 0,
    balance_amount: 50000,
    status: 'Unpaid',
  };

  const zeroAttempt = recordPaymentValidation(invoice, 0);
  assert.equal(zeroAttempt.success, false);
  assert.match(zeroAttempt.error, /greater than zero/);

  const negAttempt = recordPaymentValidation(invoice, -5000);
  assert.equal(negAttempt.success, false);
  assert.match(negAttempt.error, /greater than zero/);
});

test('Phase H.4: Status transition lifecycle correctly progresses Unpaid -> Partially Paid -> Paid', () => {
  const invoice = {
    id: 'INV-103',
    grand_total: 100000,
    paid_amount: 0,
    balance_amount: 100000,
    status: 'Unpaid',
  };

  // Step 1: Partial payment of 40,000
  const step1 = recordPaymentValidation(invoice, 40000);
  assert.equal(step1.success, true);
  assert.equal(step1.status, 'Partially Paid');
  assert.equal(step1.balance_amount, 60000);

  // Step 2: Remaining payment of 60,000
  const step2Invoice = {
    ...invoice,
    paid_amount: step1.paid_amount,
    balance_amount: step1.balance_amount,
    status: step1.status,
  };
  const step2 = recordPaymentValidation(step2Invoice, 60000);
  assert.equal(step2.success, true);
  assert.equal(step2.status, 'Paid');
  assert.equal(step2.balance_amount, 0);
});

test('Phase H.5: Accounts Aging categorizes invoices accurately across 0-30, 31-60, 61-90, and 90+ buckets', () => {
  const refDate = '2026-09-19';
  const mockInvoices = [
    {
      invoice_number: 'INV-001',
      invoice_date: '2026-09-10', // 9 days ago -> 0-30
      due_date: '2026-09-25',
      grand_total: 20000,
      paid_amount: 0,
      balance_amount: 20000,
      status: 'Unpaid',
    },
    {
      invoice_number: 'INV-002',
      invoice_date: '2026-08-10', // 40 days ago -> 31-60
      due_date: '2026-08-25',
      grand_total: 35000,
      paid_amount: 10000,
      balance_amount: 25000,
      status: 'Partially Paid',
    },
    {
      invoice_number: 'INV-003',
      invoice_date: '2026-07-05', // 76 days ago -> 61-90
      due_date: '2026-07-20',
      grand_total: 50000,
      paid_amount: 0,
      balance_amount: 50000,
      status: 'Unpaid',
    },
    {
      invoice_number: 'INV-004',
      invoice_date: '2026-05-01', // 141 days ago -> 90+
      due_date: '2026-05-16',
      grand_total: 80000,
      paid_amount: 0,
      balance_amount: 80000,
      status: 'Unpaid',
    },
    {
      invoice_number: 'INV-005',
      invoice_date: '2026-05-01', // Fully paid - must NOT appear in aging
      due_date: '2026-05-16',
      grand_total: 60000,
      paid_amount: 60000,
      balance_amount: 0,
      status: 'Paid',
    },
  ];

  const result = categorizeAgingBuckets(mockInvoices, refDate);

  assert.equal(result.buckets['0-30'].amount, 20000);
  assert.equal(result.buckets['0-30'].count, 1);

  assert.equal(result.buckets['31-60'].amount, 25000);
  assert.equal(result.buckets['31-60'].count, 1);

  assert.equal(result.buckets['61-90'].amount, 50000);
  assert.equal(result.buckets['61-90'].count, 1);

  assert.equal(result.buckets['90+'].amount, 80000);
  assert.equal(result.buckets['90+'].count, 1);

  assert.equal(result.totalOutstanding, 175000);
  // Invoices 2, 3, 4 have due_dates < 2026-09-19
  assert.equal(result.totalOverdue, 155000);
});

test('Phase H.6: Customer-wise outstanding aggregation summarizes invoiced, paid, and overdue balances', () => {
  const today = '2026-09-19';
  const mockInvoices = [
    {
      customer_id: 'CUST-001',
      customer_name: 'TechCorp Pvt Ltd',
      company_name: 'TechCorp',
      invoice_date: '2026-08-01',
      due_date: '2026-08-16', // Overdue
      grand_total: 100000,
      paid_amount: 40000,
      balance_amount: 60000,
      status: 'Partially Paid',
    },
    {
      customer_id: 'CUST-001',
      customer_name: 'TechCorp Pvt Ltd',
      company_name: 'TechCorp',
      invoice_date: '2026-09-15',
      due_date: '2026-09-30', // Not overdue
      grand_total: 50000,
      paid_amount: 0,
      balance_amount: 50000,
      status: 'Unpaid',
    },
    {
      customer_id: 'CUST-002',
      customer_name: 'Innovate Labs',
      company_name: 'Innovate',
      invoice_date: '2026-09-01',
      due_date: '2026-09-16', // Overdue
      grand_total: 75000,
      paid_amount: 75000,
      balance_amount: 0,
      status: 'Paid',
    },
  ];

  const summaries = aggregateCustomerOutstanding(mockInvoices, today);
  assert.equal(summaries.length, 2);

  const c1 = summaries.find((s) => s.customer_id === 'CUST-001');
  assert.ok(c1);
  assert.equal(c1.total_invoiced, 150000);
  assert.equal(c1.total_paid, 40000);
  assert.equal(c1.total_balance, 110000);
  assert.equal(c1.overdue_balance, 60000);
  assert.equal(c1.invoice_count, 2);

  const c2 = summaries.find((s) => s.customer_id === 'CUST-002');
  assert.ok(c2);
  assert.equal(c2.total_invoiced, 75000);
  assert.equal(c2.total_paid, 75000);
  assert.equal(c2.total_balance, 0);
  assert.equal(c2.overdue_balance, 0);
  assert.equal(c2.invoice_count, 1);
});
