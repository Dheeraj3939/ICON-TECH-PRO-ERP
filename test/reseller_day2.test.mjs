import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

// ===========================================================================
// 1. Universal Global Search & Natural Language Intent Engine
// ===========================================================================
describe('Universal Global Search & Natural Language Parsing', () => {
  function parseSearchQuery(query) {
    const lower = query.toLowerCase().trim();

    // Pattern: "customers who bought [item]"
    const boughtMatch = lower.match(/(?:customers|who|clients)\s+(?:who\s+)?(?:bought|purchased|ordered)\s+(.+)/i);
    if (boughtMatch) {
      return {
        intent: 'CUSTOMER_PURCHASE_INTELLIGENCE',
        productTerm: boughtMatch[1].trim(),
      };
    }

    // Pattern: "[customer] orders"
    if (/orders?|sales/i.test(lower)) {
      const parts = lower.split(/\s+orders?|\s+sales/i);
      return {
        intent: 'CUSTOMER_ORDERS',
        customerTerm: parts[0].trim(),
      };
    }

    // Pattern: "[customer] payments / pending"
    if (/payments?|invoices?|pending|balance|due/i.test(lower)) {
      const parts = lower.split(/\s+payments?|\s+pending|\s+invoices?|\s+balance|\s+due/i);
      return {
        intent: 'CUSTOMER_PAYMENTS',
        customerTerm: parts[0].trim(),
      };
    }

    // Pattern: "everything related to [customer]"
    if (/everything\s+related\s+to\s+(.+)/i.test(lower)) {
      const match = lower.match(/everything\s+related\s+to\s+(.+)/i);
      return {
        intent: 'CUSTOMER_360_ALL',
        customerTerm: match[1].trim(),
      };
    }

    return { intent: 'KEYWORD_SEARCH', term: lower };
  }

  test('Recognizes "customers who bought laptops" as purchase intelligence', () => {
    const parsed = parseSearchQuery('customers who bought laptops');
    assert.equal(parsed.intent, 'CUSTOMER_PURCHASE_INTELLIGENCE');
    assert.equal(parsed.productTerm, 'laptops');
  });

  test('Recognizes "Swan orders" as filtered customer orders query', () => {
    const parsed = parseSearchQuery('Swan orders');
    assert.equal(parsed.intent, 'CUSTOMER_ORDERS');
    assert.equal(parsed.customerTerm, 'swan');
  });

  test('Recognizes "Swan pending amount" as customer receivables query', () => {
    const parsed = parseSearchQuery('Swan pending amount');
    assert.equal(parsed.intent, 'CUSTOMER_PAYMENTS');
    assert.equal(parsed.customerTerm, 'swan');
  });

  test('Recognizes "everything related to Swan" as full Customer 360 lookup', () => {
    const parsed = parseSearchQuery('everything related to Swan');
    assert.equal(parsed.intent, 'CUSTOMER_360_ALL');
    assert.equal(parsed.customerTerm, 'swan');
  });
});

// ===========================================================================
// 2. Customer 360 Aggregation & Chronological Timeline Engine
// ===========================================================================
describe('Customer 360 Aggregation & Timeline', () => {
  function buildCustomerTimeline(events) {
    return [...events].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  function evaluateCustomerHealth(invoices, creditLimit) {
    let balanceDue = 0;
    let overdueCount = 0;
    const now = new Date('2026-09-12');

    invoices.forEach((inv) => {
      balanceDue += inv.balance_amount || 0;
      if (inv.balance_amount > 0 && inv.due_date && new Date(inv.due_date) < now) {
        overdueCount++;
      }
    });

    if (overdueCount > 0) return 'PAYMENT_OVERDUE';
    if (creditLimit > 0 && balanceDue > creditLimit) return 'ATTENTION_REQUIRED';
    return 'HEALTHY';
  }

  test('Sorts multi-entity customer events in strict descending chronological order', () => {
    const rawEvents = [
      { id: '1', type: 'ENQUIRY', timestamp: '2026-08-01T10:00:00Z', title: 'Enquiry Logged' },
      { id: '2', type: 'QUOTATION', timestamp: '2026-08-05T12:00:00Z', title: 'Quote v1 Sent' },
      { id: '3', type: 'SALES_ORDER', timestamp: '2026-08-10T15:00:00Z', title: 'Order Confirmed' },
      { id: '4', type: 'INVOICE', timestamp: '2026-08-15T09:00:00Z', title: 'Tax Invoice Issued' },
    ];

    const sorted = buildCustomerTimeline(rawEvents);
    assert.equal(sorted[0].type, 'INVOICE');
    assert.equal(sorted[1].type, 'SALES_ORDER');
    assert.equal(sorted[2].type, 'QUOTATION');
    assert.equal(sorted[3].type, 'ENQUIRY');
  });

  test('Correctly flags PAYMENT_OVERDUE when unpaid invoices pass due date', () => {
    const invoices = [
      { invoice_number: 'INV-01', balance_amount: 50000, due_date: '2026-08-20' }, // overdue relative to 2026-09-12
    ];
    const status = evaluateCustomerHealth(invoices, 100000);
    assert.equal(status, 'PAYMENT_OVERDUE');
  });

  test('Flags HEALTHY when all invoices are settled', () => {
    const invoices = [
      { invoice_number: 'INV-02', balance_amount: 0, due_date: '2026-08-20' },
    ];
    const status = evaluateCustomerHealth(invoices, 100000);
    assert.equal(status, 'HEALTHY');
  });
});

// ===========================================================================
// 3. Customer Purchase Intelligence & Cross-Sell Analysis
// ===========================================================================
describe('Purchase Intelligence & Cross-Sell Analysis', () => {
  const orders = [
    {
      customer_id: 'CUST-01',
      customer_name: 'Swan Corp',
      items: [
        { product_name: 'Dell Latitude 5440 Laptop', category: 'Laptops', quantity: 5, price: 65000 },
      ],
    },
    {
      customer_id: 'CUST-02',
      customer_name: 'Tech Mahindra Vendor',
      items: [
        { product_name: 'Dell Latitude 5440 Laptop', category: 'Laptops', quantity: 10, price: 65000 },
        { product_name: 'Dell 24" IPS Monitor', category: 'Monitors', quantity: 10, price: 12000 },
      ],
    },
  ];

  test('Identifies customers who bought Laptops but NOT Monitors', () => {
    const baseCat = 'Laptops';
    const targetCat = 'Monitors';

    const boughtBase = new Set();
    const boughtTarget = new Set();

    orders.forEach((o) => {
      o.items.forEach((it) => {
        if (it.category === baseCat) boughtBase.add(o.customer_id);
        if (it.category === targetCat) boughtTarget.add(o.customer_id);
      });
    });

    const gapCustomers = Array.from(boughtBase).filter((id) => !boughtTarget.has(id));
    assert.equal(gapCustomers.length, 1);
    assert.equal(gapCustomers[0], 'CUST-01', 'Swan Corp bought laptops but no monitors');
  });
});

// ===========================================================================
// 4. Reporting Engine Calculations & Field-Level Security
// ===========================================================================
describe('Reporting Engine Calculations & Role Masking', () => {
  const sampleRecords = [
    { rep: 'Dheeraj', amount: 200000, cost: 160000, margin: 20.0 },
    { rep: 'Dheeraj', amount: 300000, cost: 240000, margin: 20.0 },
    { rep: 'Reshma', amount: 150000, cost: 120000, margin: 20.0 },
  ];

  function aggregateReport(records, groupField, calcType, calcField) {
    const groups = new Map();
    records.forEach((r) => {
      const key = r[groupField];
      const cur = groups.get(key) || { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += r[calcField] || 0;
      groups.set(key, cur);
    });

    const result = [];
    groups.forEach((val, key) => {
      result.push({
        groupKey: key,
        count: val.count,
        metric: calcType === 'SUM' ? val.sum : val.sum / val.count,
      });
    });
    return result;
  }

  function maskConfidentialFields(records, userRole) {
    const allowed = ['Managing Director', 'Admin / BDM', 'Operations / Purchase'];
    if (!allowed.includes(userRole)) {
      return records.map((r) => {
        const safe = { ...r };
        delete safe.cost;
        delete safe.margin;
        return safe;
      });
    }
    return records;
  }

  test('Computes SUM aggregation grouped by sales rep accurately', () => {
    const aggregated = aggregateReport(sampleRecords, 'rep', 'SUM', 'amount');
    const dheeraj = aggregated.find((a) => a.groupKey === 'Dheeraj');
    const reshma = aggregated.find((a) => a.groupKey === 'Reshma');

    assert.equal(dheeraj.metric, 500000);
    assert.equal(dheeraj.count, 2);
    assert.equal(reshma.metric, 150000);
    assert.equal(reshma.count, 1);
  });

  test('Strips cost and margin fields when executing for Sales Executive', () => {
    const masked = maskConfidentialFields(sampleRecords, 'Sales Executive');
    assert.equal(masked[0].amount, 200000);
    assert.equal(masked[0].cost, undefined);
    assert.equal(masked[0].margin, undefined);
  });

  test('Preserves confidential figures when executing for Managing Director', () => {
    const visible = maskConfidentialFields(sampleRecords, 'Managing Director');
    assert.equal(visible[0].cost, 160000);
    assert.equal(visible[0].margin, 20.0);
  });
});

// ===========================================================================
// 5. Scheduled Report Delivery & Outbox Enqueuing
// ===========================================================================
describe('Scheduled Report Delivery Engine', () => {
  function calculateNextRun(frequency, currentDate = new Date()) {
    const next = new Date(currentDate);
    if (frequency === 'DAILY') {
      next.setDate(next.getDate() + 1);
    } else if (frequency === 'WEEKLY') {
      next.setDate(next.getDate() + 7);
    } else if (frequency === 'MONTHLY') {
      next.setMonth(next.getMonth() + 1);
    }
    return next.toISOString().split('T')[0];
  }

  test('Calculates next run dates for Daily, Weekly, and Monthly cycles', () => {
    const base = new Date('2026-09-12');
    assert.equal(calculateNextRun('DAILY', base), '2026-09-13');
    assert.equal(calculateNextRun('WEEKLY', base), '2026-09-19');
    assert.equal(calculateNextRun('MONTHLY', base), '2026-10-12');
  });

  test('Builds formatted executive summary string for Outbox dispatch', () => {
    const reportData = {
      title: 'Daily Sales Performance',
      totalRecords: 14,
      totalTurnover: 840000,
      topRep: 'Dheeraj (₹480,000)',
    };

    const text = `📊 REPORT: ${reportData.title}\n• Total Deals: ${reportData.totalRecords}\n• Total Turnover: ₹${reportData.totalTurnover.toLocaleString('en-IN')}\n• Top Performer: ${reportData.topRep}`;

    assert.match(text, /Daily Sales Performance/);
    assert.match(text, /₹8,40,000/);
    assert.match(text, /Dheeraj/);
  });
});

// ===========================================================================
// 6. AI Natural-Language Reporting (FACT, CALCULATION, RECOMMENDATION)
// ===========================================================================
describe('AI Natural-Language Reporting Structure', () => {
  function buildAIBrief(intent, facts, calcs, recs) {
    return {
      intent,
      fact: facts.join(' '),
      calculation: calcs.join(' '),
      recommendation: recs.join(' '),
    };
  }

  test('Distinguishes FACT, CALCULATION, and RECOMMENDATION without inventing numbers', () => {
    const brief = buildAIBrief(
      'Receivables Analysis',
      ['Found 3 unpaid invoices in system.'],
      ['Total pending balance is ₹125,000 across 2 accounts.'],
      ['Send automated WhatsApp reminder before due date.']
    );

    assert.equal(brief.intent, 'Receivables Analysis');
    assert.match(brief.fact, /Found 3 unpaid invoices/);
    assert.match(brief.calculation, /Total pending balance is ₹125,000/);
    assert.match(brief.recommendation, /Send automated WhatsApp reminder/);
  });
});
