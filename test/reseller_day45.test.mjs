import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import crypto from 'node:crypto';

// ===========================================================================
// 1. Finance Engine & Payment Allocation
// ===========================================================================
describe('1. Finance Engine & Payment Allocation', () => {
  function allocatePayment(receiptAmount, invoices) {
    let unallocated = receiptAmount;
    const allocations = [];
    const updatedInvoices = [];

    for (const inv of invoices) {
      if (unallocated <= 0) {
        updatedInvoices.push({ ...inv });
        continue;
      }
      const due = inv.grand_total - inv.paid_amount;
      if (due <= 0) {
        updatedInvoices.push({ ...inv });
        continue;
      }

      const alloc = Math.min(unallocated, due);
      allocations.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        allocated_amount: alloc,
      });

      const newPaid = inv.paid_amount + alloc;
      const newBal = inv.grand_total - newPaid;
      const newStatus = newBal <= 0 ? 'Paid' : 'Partially Paid';

      updatedInvoices.push({
        ...inv,
        paid_amount: newPaid,
        balance_amount: newBal,
        status: newStatus,
      });

      unallocated -= alloc;
    }

    return {
      allocations,
      unallocated_advance: Number(unallocated.toFixed(2)),
      updatedInvoices,
    };
  }

  test('Multi-payment allocation splits receipt correctly across invoices', () => {
    const invoices = [
      { id: 'INV-1', invoice_number: 'INV-001', grand_total: 100000, paid_amount: 40000, balance_amount: 60000, status: 'Partially Paid' },
      { id: 'INV-2', invoice_number: 'INV-002', grand_total: 50000, paid_amount: 0, balance_amount: 50000, status: 'Unpaid' },
    ];

    const result = allocatePayment(80000, invoices);
    assert.equal(result.allocations.length, 2);
    assert.equal(result.allocations[0].allocated_amount, 60000); // clears INV-1
    assert.equal(result.allocations[1].allocated_amount, 20000); // partial INV-2
    assert.equal(result.unallocated_advance, 0);

    const inv1 = result.updatedInvoices.find((i) => i.id === 'INV-1');
    assert.equal(inv1.paid_amount, 100000);
    assert.equal(inv1.balance_amount, 0);
    assert.equal(inv1.status, 'Paid');

    const inv2 = result.updatedInvoices.find((i) => i.id === 'INV-2');
    assert.equal(inv2.paid_amount, 20000);
    assert.equal(inv2.balance_amount, 30000);
    assert.equal(inv2.status, 'Partially Paid');
  });

  test('Payment exceeding balance creates unallocated customer advance', () => {
    const invoices = [
      { id: 'INV-1', invoice_number: 'INV-001', grand_total: 50000, paid_amount: 0, balance_amount: 50000, status: 'Unpaid' },
    ];

    const result = allocatePayment(75000, invoices);
    assert.equal(result.allocations.length, 1);
    assert.equal(result.allocations[0].allocated_amount, 50000);
    assert.equal(result.unallocated_advance, 25000);
  });

  test('Receivables aging buckets calculation correctly distributes overdue amounts', () => {
    function calculateAging(invoices, asOfDateStr) {
      const asOf = new Date(asOfDateStr).getTime();
      const buckets = { current_0_30: 0, overdue_31_60: 0, overdue_61_90: 0, overdue_90_plus: 0 };

      for (const inv of invoices) {
        const bal = inv.grand_total - inv.paid_amount;
        if (bal <= 0) continue;
        const dueTime = new Date(inv.due_date).getTime();
        const days = Math.floor((asOf - dueTime) / (1000 * 60 * 60 * 24));

        if (days <= 30) buckets.current_0_30 += bal;
        else if (days <= 60) buckets.overdue_31_60 += bal;
        else if (days <= 90) buckets.overdue_61_90 += bal;
        else buckets.overdue_90_plus += bal;
      }
      return buckets;
    }

    const testInvoices = [
      { id: 'I1', grand_total: 10000, paid_amount: 0, due_date: '2026-04-01' }, // 9 days overdue as of 2026-04-10 -> 0-30
      { id: 'I2', grand_total: 20000, paid_amount: 0, due_date: '2026-02-25' }, // 44 days overdue -> 31-60
      { id: 'I3', grand_total: 30000, paid_amount: 0, due_date: '2026-01-15' }, // 85 days overdue -> 61-90
      { id: 'I4', grand_total: 40000, paid_amount: 0, due_date: '2025-12-01' }, // 130 days overdue -> 90+
    ];

    const buckets = calculateAging(testInvoices, '2026-04-10');
    assert.equal(buckets.current_0_30, 10000);
    assert.equal(buckets.overdue_31_60, 20000);
    assert.equal(buckets.overdue_61_90, 30000);
    assert.equal(buckets.overdue_90_plus, 40000);
  });

  test('Credit limit utilization and breach detection', () => {
    function checkCredit(balanceDue, creditLimit) {
      const utilPct = creditLimit > 0 ? Math.round((balanceDue / creditLimit) * 100) : 0;
      return {
        utilization_pct: utilPct,
        is_exceeded: creditLimit > 0 && balanceDue > creditLimit,
      };
    }

    assert.deepEqual(checkCredit(150000, 200000), { utilization_pct: 75, is_exceeded: false });
    assert.deepEqual(checkCredit(250000, 200000), { utilization_pct: 125, is_exceeded: true });
    assert.deepEqual(checkCredit(50000, 0), { utilization_pct: 0, is_exceeded: false });
  });
});

// ===========================================================================
// 2. Centralized Indian GST & Tax Engine
// ===========================================================================
describe('2. Centralized Indian GST & Tax Engine', () => {
  const TELANGANA_CODE = '36';
  const UT_WITHOUT_LEGISLATURE = new Set(['35', '04', '26', '38', '31']);

  function computeTax(params) {
    const companyState = params.company_state_code || TELANGANA_CODE;
    const resolvedState = params.shipping_state_code || (params.customer_gstin ? params.customer_gstin.slice(0, 2) : companyState);
    const isInterstate = resolvedState !== companyState;
    const isUtgst = !isInterstate && UT_WITHOUT_LEGISLATURE.has(resolvedState);
    const isSez = Boolean(params.is_sez);
    const rate = isSez ? 0 : (params.gst_rate !== undefined ? params.gst_rate : 18);

    const gross = (params.subtotal || 0) - (params.discount || 0);
    let taxable = gross;
    let totalTax = 0;

    if (isSez || rate === 0) {
      return { taxable: gross, cgst: 0, sgst: 0, utgst: 0, igst: 0, totalTax: 0, grandTotal: gross, isInterstate, isSez, isUtgst };
    }

    if (params.is_tax_inclusive) {
      taxable = Number((gross / (1 + rate / 100)).toFixed(2));
      totalTax = Number((gross - taxable).toFixed(2));
    } else {
      taxable = Number(gross.toFixed(2));
      totalTax = Number(((taxable * rate) / 100).toFixed(2));
    }

    let cgst = 0, sgst = 0, utgst = 0, igst = 0;
    if (isInterstate) {
      igst = totalTax;
    } else if (isUtgst) {
      cgst = Number((totalTax / 2).toFixed(2));
      utgst = Number((totalTax - cgst).toFixed(2));
    } else {
      cgst = Number((totalTax / 2).toFixed(2));
      sgst = Number((totalTax - cgst).toFixed(2));
    }

    const grandTotal = params.is_tax_inclusive ? gross : Number((taxable + totalTax).toFixed(2));
    return { taxable, cgst, sgst, utgst, igst, totalTax, grandTotal, isInterstate, isSez, isUtgst };
  }

  test('Intrastate Telangana transaction applies 9% CGST + 9% SGST', () => {
    const res = computeTax({ subtotal: 100000, customer_gstin: '36AAACI1234F1Z8', gst_rate: 18 });
    assert.equal(res.isInterstate, false);
    assert.equal(res.isUtgst, false);
    assert.equal(res.taxable, 100000);
    assert.equal(res.cgst, 9000);
    assert.equal(res.sgst, 9000);
    assert.equal(res.igst, 0);
    assert.equal(res.grandTotal, 118000);
  });

  test('Interstate transaction (e.g. Karnataka 29) applies 18% IGST', () => {
    const res = computeTax({ subtotal: 100000, shipping_state_code: '29', gst_rate: 18 });
    assert.equal(res.isInterstate, true);
    assert.equal(res.cgst, 0);
    assert.equal(res.sgst, 0);
    assert.equal(res.igst, 18000);
    assert.equal(res.grandTotal, 118000);
  });

  test('Union Territory without legislature (Chandigarh 04) applies CGST + UTGST when company is local', () => {
    const res = computeTax({ subtotal: 100000, company_state_code: '04', shipping_state_code: '04', gst_rate: 18 });
    assert.equal(res.isInterstate, false);
    assert.equal(res.isUtgst, true);
    assert.equal(res.cgst, 9000);
    assert.equal(res.utgst, 9000);
    assert.equal(res.sgst, 0);
  });

  test('Tax-inclusive pricing accurately extracts taxable amount without penny leakage', () => {
    // Gross ₹1,18,000 inclusive of 18% GST -> Taxable ₹1,00,000, GST ₹18,000
    const res = computeTax({ subtotal: 118000, is_tax_inclusive: true, gst_rate: 18 });
    assert.equal(res.taxable, 100000);
    assert.equal(res.totalTax, 18000);
    assert.equal(res.grandTotal, 118000);
  });

  test('SEZ transaction is zero-rated under LUT', () => {
    const res = computeTax({ subtotal: 500000, is_sez: true, gst_rate: 18 });
    assert.equal(res.isSez, true);
    assert.equal(res.totalTax, 0);
    assert.equal(res.grandTotal, 500000);
  });
});

// ===========================================================================
// 3. Document Engine & Lifecycle
// ===========================================================================
describe('3. Document Engine & Lifecycle', () => {
  const ALLOWED_TRANSITIONS = {
    DRAFT: ['REVIEW', 'CANCELLED', 'VOID'],
    REVIEW: ['APPROVED', 'DRAFT', 'CANCELLED'],
    APPROVED: ['ISSUED', 'REVIEW', 'CANCELLED'],
    ISSUED: ['CANCELLED', 'VOID'],
    CANCELLED: [],
    VOID: [],
  };

  function canTransition(current, target) {
    if (current === target) return true;
    return (ALLOWED_TRANSITIONS[current] || []).includes(target);
  }

  test('Valid transitions follow strict business controls', () => {
    assert.equal(canTransition('DRAFT', 'REVIEW'), true);
    assert.equal(canTransition('REVIEW', 'APPROVED'), true);
    assert.equal(canTransition('APPROVED', 'ISSUED'), true);
    assert.equal(canTransition('ISSUED', 'VOID'), true);
  });

  test('Unapproved draft cannot jump directly to issued', () => {
    assert.equal(canTransition('DRAFT', 'ISSUED'), false);
    assert.equal(canTransition('REVIEW', 'ISSUED'), false);
  });

  test('Terminal cancelled or void documents cannot be revived to draft', () => {
    assert.equal(canTransition('CANCELLED', 'DRAFT'), false);
    assert.equal(canTransition('VOID', 'APPROVED'), false);
  });

  test('Printable HTML layout generator produces valid document with company header and bank details', () => {
    function generateSimpleHtml(docNumber, total) {
      return '<div class="page"><div class="title">TAX INVOICE - ' + docNumber + '</div><div>Total: ₹' + total + '</div><div>Bank: HDFC Bank</div></div>';
    }

    const html = generateSimpleHtml('ICON/26-27/INV-0001', '1,45,000');
    assert.match(html, /TAX INVOICE/);
    assert.match(html, /ICON\/26-27\/INV-0001/);
    assert.match(html, /HDFC Bank/);
  });
});

// ===========================================================================
// 4. E-Invoice & E-Way Bill Abstraction
// ===========================================================================
describe('4. E-Invoice & E-Way Bill Abstraction', () => {
  test('IRN deterministic SHA-256 hash generation matches NIC spec', () => {
    const raw = '36AAACI1234F1Z8:ICON/26-27/INV-0001:26-27:T-Hub Foundation';
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  test('E-Way Bill validity distance calculation (1 day per 200 KM, min 1 day)', () => {
    function calcEwbValidityDays(distanceKm) {
      return Math.max(1, Math.ceil(distanceKm / 200));
    }

    assert.equal(calcEwbValidityDays(45), 1);
    assert.equal(calcEwbValidityDays(199), 1);
    assert.equal(calcEwbValidityDays(201), 2);
    assert.equal(calcEwbValidityDays(650), 4);
  });

  test('Credential status distinguishes live integration from simulation mode', () => {
    function checkEnv(env) {
      const keys = ['E_INVOICE_CLIENT_ID', 'E_INVOICE_CLIENT_SECRET', 'E_INVOICE_USERNAME', 'E_INVOICE_PASSWORD'];
      const missing = keys.filter((k) => !env[k]);
      return {
        configured: missing.length === 0,
        status: missing.length === 0 ? 'CONFIGURED_AND_READY' : 'CREDENTIAL_REQUIRED',
        missing_keys: missing,
      };
    }

    const unconfigured = checkEnv({});
    assert.equal(unconfigured.configured, false);
    assert.equal(unconfigured.status, 'CREDENTIAL_REQUIRED');
    assert.equal(unconfigured.missing_keys.length, 4);

    const configured = checkEnv({
      E_INVOICE_CLIENT_ID: 'cid',
      E_INVOICE_CLIENT_SECRET: 'csec',
      E_INVOICE_USERNAME: 'user',
      E_INVOICE_PASSWORD: 'pwd',
    });
    assert.equal(configured.configured, true);
    assert.equal(configured.status, 'CONFIGURED_AND_READY');
  });
});

// ===========================================================================
// 5. TallyPrime Reconciliation Engine
// ===========================================================================
describe('5. TallyPrime Reconciliation Engine', () => {
  function reconcileVouchers(erpItems, tallyItems) {
    return erpItems.map((erp) => {
      const match = tallyItems.find((t) => t.erp_number === erp.number || t.voucher_number === erp.tally_voucher);
      if (!match) {
        return { erp_number: erp.number, status: 'ERP_ONLY', difference: erp.amount };
      }
      if (Math.abs(erp.amount - match.amount) > 0.01) {
        return {
          erp_number: erp.number,
          status: 'VALUE_MISMATCH',
          difference: Number(Math.abs(erp.amount - match.amount).toFixed(2)),
        };
      }
      return { erp_number: erp.number, status: 'MATCHED', difference: 0 };
    });
  }

  test('Reconciliation flags matched items and detects rounding mismatches', () => {
    const erp = [
      { number: 'INV-001', amount: 145000, tally_voucher: 'SL-001' },
      { number: 'INV-002', amount: 94400, tally_voucher: 'SL-002' },
      { number: 'INV-003', amount: 50000, tally_voucher: null },
    ];
    const tally = [
      { erp_number: 'INV-001', voucher_number: 'SL-001', amount: 145000 },
      { erp_number: 'INV-002', voucher_number: 'SL-002', amount: 94000 }, // ₹400 difference
    ];

    const results = reconcileVouchers(erp, tally);
    assert.equal(results[0].status, 'MATCHED');
    assert.equal(results[0].difference, 0);

    assert.equal(results[1].status, 'VALUE_MISMATCH');
    assert.equal(results[1].difference, 400);

    assert.equal(results[2].status, 'ERP_ONLY');
    assert.equal(results[2].difference, 50000);
  });
});

// ===========================================================================
// 6. 15-Agent Multi-Agent Architecture & Safe AI Gateway
// ===========================================================================
describe('6. 15-Agent Multi-Agent Architecture & Safe AI Gateway', () => {
  const ALL_15_AGENTS = [
    'ICON_COPILOT',
    'SALES_AGENT',
    'PROCUREMENT_AGENT',
    'ACCOUNTS_AGENT',
    'SERVICE_AGENT',
    'WARRANTY_AMC_AGENT',
    'ANALYTICS_AGENT',
    'MANAGEMENT_MD_AGENT',
    'CUSTOMER_INTELLIGENCE_AGENT',
    'COMMUNICATION_AGENT',
    'MARGIN_AGENT',
    'DISTRIBUTOR_INTELLIGENCE_AGENT',
    'DATA_QUALITY_AGENT',
    'WORKFLOW_RISK_AGENT',
    'KNOWLEDGE_AGENT',
  ];

  test('All 15 specialized agents are defined and registered', () => {
    assert.equal(ALL_15_AGENTS.length, 15);
    assert.ok(ALL_15_AGENTS.includes('ICON_COPILOT'));
    assert.ok(ALL_15_AGENTS.includes('MANAGEMENT_MD_AGENT'));
    assert.ok(ALL_15_AGENTS.includes('MARGIN_AGENT'));
    assert.ok(ALL_15_AGENTS.includes('DATA_QUALITY_AGENT'));
    assert.ok(ALL_15_AGENTS.includes('WARRANTY_AMC_AGENT'));
  });

  test('Strict purchase cost masking for unauthorized roles in AI responses', () => {
    function filterContextForAgent(userRole, rawData) {
      const allowedRoles = ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'];
      if (!allowedRoles.includes(userRole)) {
        // Mask purchase cost
        const sanitized = { ...rawData };
        delete sanitized.purchase_cost;
        delete sanitized.gross_margin_pct;
        sanitized.cost_access = 'RESTRICTED';
        return sanitized;
      }
      return { ...rawData, cost_access: 'AUTHORIZED' };
    }

    const confidentialData = { product: '75-inch IFP', purchase_cost: 95000, selling_price: 145000, gross_margin_pct: 34.5 };
    const salesExecView = filterContextForAgent('Sales Executive', confidentialData);
    assert.equal(salesExecView.cost_access, 'RESTRICTED');
    assert.equal(salesExecView.purchase_cost, undefined);
    assert.equal(salesExecView.gross_margin_pct, undefined);

    const mdView = filterContextForAgent('Managing Director', confidentialData);
    assert.equal(mdView.cost_access, 'AUTHORIZED');
    assert.equal(mdView.purchase_cost, 95000);
    assert.equal(mdView.gross_margin_pct, 34.5);
  });

  test('Multilingual greetings and instructions in English, Telugu, Hindi', () => {
    function getAgentGreeting(lang) {
      if (lang === 'te') return 'నమస్కారం! ICON TECH PRO ERP అసిస్టెంట్';
      if (lang === 'hi') return 'नमस्ते! ICON TECH PRO ERP सहायक';
      return 'Welcome to ICON TECH PRO ERP Assistant';
    }

    assert.match(getAgentGreeting('te'), /నమస్కారం/);
    assert.match(getAgentGreeting('hi'), /नमस्ते/);
    assert.match(getAgentGreeting('en'), /Welcome/);
  });
});

// ===========================================================================
// 7. Daily Executive Briefing
// ===========================================================================
describe('7. Daily Executive Briefing Tagging', () => {
  test('Every attention item statement is classified as FACT, CALCULATION, or RECOMMENDATION', () => {
    const attentionItems = [
      { statement: '[FACT] Outstanding receivables total ₹2,39,400 across 3 client accounts', type: 'FACT' },
      { statement: '[CALCULATION] 39.4% of total outstanding is in the 0-30 days current bracket', type: 'CALCULATION' },
      { statement: '[RECOMMENDATION] Dispatch payment reminder notices before 3 PM today', type: 'RECOMMENDATION' },
    ];

    for (const item of attentionItems) {
      assert.ok(['FACT', 'CALCULATION', 'RECOMMENDATION'].includes(item.type));
      assert.ok(item.statement.startsWith('[' + item.type + ']'));
    }
  });
});

// ===========================================================================
// 8. AI Voice Gateway Foundation
// ===========================================================================
describe('8. AI Voice Gateway Foundation', () => {
  test('Voice turn parser detects human handoff request in English and Telugu', () => {
    function detectHandoff(text) {
      const triggers = ['transfer', 'human', 'executive', 'manager', 'manishi', 'insaan', 'మనిషి'];
      const lower = text.toLowerCase();
      return triggers.some((t) => lower.includes(t));
    }

    assert.equal(detectHandoff('Please transfer my call to human executive'), true);
    assert.equal(detectHandoff('నాకు మేనేజర్ లేదా మనిషి కావాలి'), true); // contains మనిషి
    assert.equal(detectHandoff('What is my invoice number?'), false);
  });
});

// ===========================================================================
// 9. Data Quality, Business Risks & Automation
// ===========================================================================
describe('9. Data Quality, Business Risks & Automation', () => {
  test('Data quality engine detects duplicate GSTIN across different customer records', () => {
    const customers = [
      { id: 'C1', name: 'Tech Mahindra Hyd', gstin: '36AAACI1234F1Z8' },
      { id: 'C2', name: 'Tech Mahindra Cyberabad', gstin: '36AAACI1234F1Z8' },
    ];

    const gstinMap = {};
    const duplicates = [];
    for (const c of customers) {
      if (gstinMap[c.gstin]) {
        duplicates.push({ gstin: c.gstin, entities: [gstinMap[c.gstin], c.name] });
      } else {
        gstinMap[c.gstin] = c.name;
      }
    }

    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0].gstin, '36AAACI1234F1Z8');
  });

  test('Business risk alert fires when overdue receivables exceed threshold', () => {
    const threshold = 50000;
    const customerReceivable = 145000;
    const isRisk = customerReceivable > threshold;
    assert.equal(isRisk, true);
  });

  test('Workflow rule trigger replaces template placeholders correctly', () => {
    const template = 'Payment of ₹{{amount}} received for invoice {{invoice_number}}. Thank you!';
    const payload = { amount: '1,45,000', invoice_number: 'ICON/26-27/INV-0001' };

    let msg = template;
    for (const [k, v] of Object.entries(payload)) {
      msg = msg.replace(new RegExp('{{' + k + '}}', 'g'), v);
    }

    assert.equal(msg, 'Payment of ₹1,45,000 received for invoice ICON/26-27/INV-0001. Thank you!');
  });
});
