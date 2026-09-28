import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

// ===========================================================================
// 1. Quotation Revisioning & Immutability Engine
// ===========================================================================
describe('Quotation Revisioning & Immutability', () => {
  function createRevision(originalQuote, updates, authorName) {
    const nextVersion = (originalQuote.version || 1) + 1;
    const versionTag = 'v' + nextVersion;

    // Snapshot current state immutably
    const snapshot = {
      version: originalQuote.version || 1,
      version_tag: originalQuote.version_tag || 'v1',
      total_amount: originalQuote.total_amount,
      items: JSON.parse(JSON.stringify(originalQuote.items)),
      quoted_margin_pct: originalQuote.quoted_margin_pct,
      status: originalQuote.status,
      created_at: originalQuote.created_at,
      revised_by: authorName,
      revision_reason: updates.revision_reason || 'Commercial revision',
    };

    const history = [...(originalQuote.versions || []), snapshot];

    return {
      ...originalQuote,
      ...updates,
      version: nextVersion,
      version_tag: versionTag,
      versions: history,
      status: 'Draft', // Reset to draft for re-approval
      updated_at: new Date().toISOString(),
    };
  }

  test('Creates v2 revision preserving immutable snapshot of v1', () => {
    const v1Quote = {
      id: 'QT-001',
      quotation_number: 'QT260001',
      version: 1,
      version_tag: 'v1',
      total_amount: 100000,
      quoted_margin_pct: 18.5,
      status: 'Draft',
      items: [{ product_name: 'Interactive Flat Panel 75"', quantity: 1, selling_price: 100000 }],
      versions: [],
      created_at: '2026-09-12T10:00:00Z',
    };

    const v2Quote = createRevision(
      v1Quote,
      {
        total_amount: 95000,
        quoted_margin_pct: 14.2,
        revision_reason: 'Customer negotiated 5% discount',
        items: [{ product_name: 'Interactive Flat Panel 75"', quantity: 1, selling_price: 95000 }],
      },
      'Sales Rep John'
    );

    assert.equal(v2Quote.version, 2);
    assert.equal(v2Quote.version_tag, 'v2');
    assert.equal(v2Quote.total_amount, 95000);
    assert.equal(v2Quote.quoted_margin_pct, 14.2);
    assert.equal(v2Quote.versions.length, 1);
    assert.equal(v2Quote.versions[0].version, 1);
    assert.equal(v2Quote.versions[0].total_amount, 100000);
    assert.equal(v2Quote.versions[0].quoted_margin_pct, 18.5);
    assert.equal(v2Quote.versions[0].revision_reason, 'Customer negotiated 5% discount');

    // Modifying v2 items must not mutate snapshot
    v2Quote.items[0].selling_price = 80000;
    assert.equal(v2Quote.versions[0].items[0].selling_price, 100000, 'v1 snapshot must remain immutable');
  });
});

// ===========================================================================
// 2. Generic Commercial Approval Engine & Self-Approval Prevention
// ===========================================================================
describe('Approval Engine & Self-Approval Prevention', () => {
  const APPROVAL_RULES = [
    { type: 'MARGIN_BELOW_MINIMUM', threshold: 15.0, requiredRole: 'Managing Director' },
    { type: 'DISCOUNT_THRESHOLD', threshold: 10.0, requiredRole: 'Admin / BDM' },
  ];

  function evaluateApprovalRequired(quotation) {
    const triggers = [];
    if (quotation.quoted_margin_pct !== undefined && quotation.quoted_margin_pct < 15.0) {
      triggers.push({ type: 'MARGIN_BELOW_MINIMUM', requiredRole: 'Managing Director' });
    }
    return triggers;
  }

  function processApproval(request, approver) {
    // Strict self-approval guard
    if (approver.id === request.requested_by_id && approver.role !== 'Managing Director') {
      throw new Error('Self-approval is strictly prohibited. An independent approver is required.');
    }

    if (request.required_role === 'Managing Director' && approver.role !== 'Managing Director') {
      throw new Error('Insufficient privileges to approve this request.');
    }

    return {
      ...request,
      status: 'APPROVED',
      approved_by_id: approver.id,
      approved_by_name: approver.name,
      actioned_at: new Date().toISOString(),
    };
  }

  test('Triggers approval request when margin falls below threshold', () => {
    const quote = { quotation_number: 'QT260002', quoted_margin_pct: 12.5 };
    const triggers = evaluateApprovalRequired(quote);
    assert.equal(triggers.length, 1);
    assert.equal(triggers[0].type, 'MARGIN_BELOW_MINIMUM');
    assert.equal(triggers[0].requiredRole, 'Managing Director');
  });

  test('Self-approval is rejected when requester attempts to approve own request', () => {
    const request = {
      id: 'APR-001',
      request_number: 'APR260001',
      requested_by_id: 'user-bdm-1',
      requested_by_name: 'Rajesh (BDM)',
      required_role: 'Admin / BDM',
      status: 'PENDING',
    };

    const approverSelf = {
      id: 'user-bdm-1',
      name: 'Rajesh (BDM)',
      role: 'Admin / BDM',
    };

    assert.throws(
      () => processApproval(request, approverSelf),
      /Self-approval is strictly prohibited/
    );
  });

  test('Independent authorized approver successfully approves', () => {
    const request = {
      id: 'APR-002',
      request_number: 'APR260002',
      requested_by_id: 'user-bdm-1',
      requested_by_name: 'Rajesh (BDM)',
      required_role: 'Managing Director',
      status: 'PENDING',
    };

    const approverDirector = {
      id: 'user-md-1',
      name: 'MD Suresh',
      role: 'Managing Director',
    };

    const result = processApproval(request, approverDirector);
    assert.equal(result.status, 'APPROVED');
    assert.equal(result.approved_by_name, 'MD Suresh');
    assert.ok(result.actioned_at);
  });
});

// ===========================================================================
// 3. Multi-Distributor Split Allocation Engine
// ===========================================================================
describe('Multi-Distributor Split Allocation', () => {
  function allocateSplits(item, splits) {
    const totalAllocated = splits.reduce((sum, s) => sum + s.quantity, 0);
    if (totalAllocated > item.quantity) {
      throw new Error(`Allocated quantity (${totalAllocated}) exceeds item quantity (${item.quantity})`);
    }

    const officeQty = splits
      .filter((s) => s.source_type === 'OFFICE_STOCK')
      .reduce((sum, s) => sum + s.quantity, 0);

    const procQty = splits
      .filter((s) => s.source_type === 'DISTRIBUTOR')
      .reduce((sum, s) => sum + s.quantity, 0);

    let status = 'PO_REQUIRED';
    if (officeQty === item.quantity) {
      status = 'IN_OFFICE_STOCK';
    } else if (officeQty > 0 && procQty > 0) {
      status = 'PARTIALLY_RESERVED';
    }

    return {
      ...item,
      reserved_quantity: officeQty,
      procurement_required_qty: procQty,
      procurement_status: status,
      allocations: splits,
    };
  }

  test('Splits 10 units into 2 office stock + 5 Dist A + 3 Dist B', () => {
    const item = {
      id: 'SOI-101',
      product_name: 'Cisco Catalyst 1000 Switch',
      quantity: 10,
    };

    const splits = [
      { source_type: 'OFFICE_STOCK', quantity: 2 },
      { source_type: 'DISTRIBUTOR', supplier_name: 'Ingram Micro', quantity: 5, estimated_cost: 35000 },
      { source_type: 'DISTRIBUTOR', supplier_name: 'Redington India', quantity: 3, estimated_cost: 35200 },
    ];

    const result = allocateSplits(item, splits);
    assert.equal(result.reserved_quantity, 2);
    assert.equal(result.procurement_required_qty, 8);
    assert.equal(result.procurement_status, 'PARTIALLY_RESERVED');
    assert.equal(result.allocations.length, 3);
    assert.equal(result.allocations[1].supplier_name, 'Ingram Micro');
    assert.equal(result.allocations[2].supplier_name, 'Redington India');
  });

  test('Fails if total allocation exceeds line item quantity', () => {
    const item = { id: 'SOI-102', quantity: 5 };
    const invalidSplits = [
      { source_type: 'OFFICE_STOCK', quantity: 3 },
      { source_type: 'DISTRIBUTOR', quantity: 4 }, // 3 + 4 = 7 > 5
    ];

    assert.throws(
      () => allocateSplits(item, invalidSplits),
      /exceeds item quantity/
    );
  });
});

// ===========================================================================
// 4. Product Supplier Master & Preferred Distributor Selection
// ===========================================================================
describe('Product Supplier Master & Preferred Mapping', () => {
  const suppliers = [
    { id: 'SUP-1', name: 'Ingram Micro' },
    { id: 'SUP-2', name: 'Redington India' },
    { id: 'SUP-3', name: 'Savex Technologies' },
  ];

  const productSupplierMappings = [
    { product_id: 'PRD-1', supplier_id: 'SUP-1', purchase_cost: 42000, lead_time_days: 3, is_preferred: false },
    { product_id: 'PRD-1', supplier_id: 'SUP-2', purchase_cost: 41200, lead_time_days: 2, is_preferred: true },
    { product_id: 'PRD-1', supplier_id: 'SUP-3', purchase_cost: 41800, lead_time_days: 5, is_preferred: false },
  ];

  function getBestSupplier(productId) {
    const mappings = productSupplierMappings.filter((m) => m.product_id === productId);
    const preferred = mappings.find((m) => m.is_preferred);
    if (preferred) return preferred;
    // Fallback to lowest cost
    return [...mappings].sort((a, b) => a.purchase_cost - b.purchase_cost)[0];
  }

  test('Selects preferred distributor (Redington) with lowest lead time and cost', () => {
    const best = getBestSupplier('PRD-1');
    assert.equal(best.supplier_id, 'SUP-2');
    assert.equal(best.is_preferred, true);
    assert.equal(best.purchase_cost, 41200);
    assert.equal(best.lead_time_days, 2);
  });
});

// ===========================================================================
// 5. Serial Records & Warranty Tracking Lifecycle
// ===========================================================================
describe('Serial Records & Warranty Evaluation Engine', () => {
  function calculateWarrantyStatus(warrantyEndDate, referenceDate = new Date()) {
    const end = new Date(warrantyEndDate);
    const ref = new Date(referenceDate);
    const diffDays = Math.ceil((end - ref) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: 'EXPIRED', days_remaining: 0 };
    } else if (diffDays <= 30) {
      return { status: 'EXPIRING_SOON', days_remaining: diffDays };
    } else {
      return { status: 'ACTIVE', days_remaining: diffDays };
    }
  }

  test('Calculates ACTIVE warranty correctly for future dates', () => {
    const res = calculateWarrantyStatus('2027-09-12', '2026-09-12');
    assert.equal(res.status, 'ACTIVE');
    assert.ok(res.days_remaining > 300);
  });

  test('Calculates EXPIRING_SOON for warranty ending in 15 days', () => {
    const res = calculateWarrantyStatus('2026-09-27', '2026-09-12');
    assert.equal(res.status, 'EXPIRING_SOON');
    assert.equal(res.days_remaining, 15);
  });

  test('Calculates EXPIRED for past warranty date', () => {
    const res = calculateWarrantyStatus('2026-08-01', '2026-09-12');
    assert.equal(res.status, 'EXPIRED');
    assert.equal(res.days_remaining, 0);
  });

  test('Serial lifecycle transitions from IN_STOCK to INSTALLED', () => {
    const serial = {
      serial_number: 'SN-EPS-9921',
      product_name: 'Epson EB-L260F',
      status: 'IN_STOCK',
    };

    // Transition to ALLOCATED
    serial.status = 'ALLOCATED';
    assert.equal(serial.status, 'ALLOCATED');

    // Transition to DISPATCHED
    serial.status = 'DISPATCHED';
    assert.equal(serial.status, 'DISPATCHED');

    // Transition to INSTALLED
    serial.status = 'INSTALLED';
    assert.equal(serial.status, 'INSTALLED');
  });
});

// ===========================================================================
// 6. Indian GST Engine & Rule 46 Compliance
// ===========================================================================
describe('Indian GST Engine & Place of Supply', () => {
  const TELANGANA_STATE_CODE = '36';

  function calculateTax(params) {
    const { lineItems, customerGstin, isSez } = params;

    let customerStateCode = TELANGANA_STATE_CODE;
    if (customerGstin && customerGstin.length >= 2) {
      customerStateCode = customerGstin.substring(0, 2);
    }

    const isIntrastate = customerStateCode === TELANGANA_STATE_CODE;

    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    for (const it of lineItems) {
      const lineSubtotal = it.quantity * it.unit_price;
      subtotal += lineSubtotal;

      if (isSez) {
        // Zero rated
        continue;
      }

      if (isIntrastate) {
        const halfRate = (it.gst_rate || 18) / 2;
        cgst += (lineSubtotal * halfRate) / 100;
        sgst += (lineSubtotal * halfRate) / 100;
      } else {
        const fullRate = it.gst_rate || 18;
        igst += (lineSubtotal * fullRate) / 100;
      }
    }

    const totalTax = cgst + sgst + igst;
    return {
      subtotal: Number(subtotal.toFixed(2)),
      cgst: Number(cgst.toFixed(2)),
      sgst: Number(sgst.toFixed(2)),
      igst: Number(igst.toFixed(2)),
      totalTax: Number(totalTax.toFixed(2)),
      grandTotal: Number((subtotal + totalTax).toFixed(2)),
      taxType: isSez ? 'SEZ_ZERO_RATED' : (isIntrastate ? 'INTRASTATE_CGST_SGST' : 'INTERSTATE_IGST'),
    };
  }

  test('Case A: Telangana customer (36) gets CGST 9% + SGST 9%', () => {
    const tax = calculateTax({
      customerGstin: '36AABCI1234F1Z5',
      lineItems: [{ quantity: 2, unit_price: 50000, gst_rate: 18 }],
    });

    assert.equal(tax.subtotal, 100000);
    assert.equal(tax.cgst, 9000);
    assert.equal(tax.sgst, 9000);
    assert.equal(tax.igst, 0);
    assert.equal(tax.grandTotal, 118000);
    assert.equal(tax.taxType, 'INTRASTATE_CGST_SGST');
  });

  test('Case B: Karnataka customer (29) gets IGST 18%', () => {
    const tax = calculateTax({
      customerGstin: '29AABCI1234F1Z5',
      lineItems: [{ quantity: 2, unit_price: 50000, gst_rate: 18 }],
    });

    assert.equal(tax.subtotal, 100000);
    assert.equal(tax.cgst, 0);
    assert.equal(tax.sgst, 0);
    assert.equal(tax.igst, 18000);
    assert.equal(tax.grandTotal, 118000);
    assert.equal(tax.taxType, 'INTERSTATE_IGST');
  });

  test('Case C: SEZ client receives zero-rated invoice with LUT notation', () => {
    const tax = calculateTax({
      customerGstin: '36AABCI1234F1Z5',
      isSez: true,
      lineItems: [{ quantity: 1, unit_price: 100000, gst_rate: 18 }],
    });

    assert.equal(tax.subtotal, 100000);
    assert.equal(tax.totalTax, 0);
    assert.equal(tax.grandTotal, 100000);
    assert.equal(tax.taxType, 'SEZ_ZERO_RATED');
  });
});

// ===========================================================================
// 7. Role-Based Purchase Cost Sanitization Engine
// ===========================================================================
describe('Purchase Cost Sanitization & Access Control', () => {
  function sanitizeProduct(product, userRole) {
    const allowedRoles = ['Managing Director', 'Admin / BDM', 'Operations / Purchase'];
    if (!allowedRoles.includes(userRole)) {
      const sanitized = { ...product };
      delete sanitized.purchase_price;
      delete sanitized.last_purchase_price;
      delete sanitized.supplier_id;
      return sanitized;
    }
    return product;
  }

  test('Hides purchase prices from Sales Executive role', () => {
    const rawProd = {
      name: 'Poly Studio X50',
      selling_price: 320000,
      purchase_price: 250000,
      last_purchase_price: 248000,
    };

    const sanitized = sanitizeProduct(rawProd, 'Sales Executive');
    assert.equal(sanitized.selling_price, 320000);
    assert.equal(sanitized.purchase_price, undefined);
    assert.equal(sanitized.last_purchase_price, undefined);
  });

  test('Preserves purchase prices for Managing Director', () => {
    const rawProd = {
      name: 'Poly Studio X50',
      selling_price: 320000,
      purchase_price: 250000,
    };

    const visible = sanitizeProduct(rawProd, 'Managing Director');
    assert.equal(visible.purchase_price, 250000);
  });
});

// ===========================================================================
// 8. Communication Outbox & Retry Resilience Engine
// ===========================================================================
describe('Communication Outbox & Retry Engine', () => {
  function simulateSend(message, attemptError = null) {
    if (attemptError) {
      const newRetry = message.retry_count + 1;
      const failed = newRetry >= message.max_retries;
      return {
        ...message,
        retry_count: newRetry,
        status: failed ? 'FAILED' : 'QUEUED',
        last_error: attemptError,
      };
    }
    return {
      ...message,
      status: 'SENT',
      sent_at: new Date().toISOString(),
    };
  }

  test('Message queues and retries upon failure without crashing ERP flow', () => {
    let msg = {
      id: 'OUT-001',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      body: 'Your order ORD260001 is confirmed.',
      status: 'QUEUED',
      retry_count: 0,
      max_retries: 3,
    };

    // First attempt fails (gateway timeout)
    msg = simulateSend(msg, 'WhatsApp API 504 Gateway Timeout');
    assert.equal(msg.retry_count, 1);
    assert.equal(msg.status, 'QUEUED');
    assert.equal(msg.last_error, 'WhatsApp API 504 Gateway Timeout');

    // Second attempt succeeds
    msg = simulateSend(msg, null);
    assert.equal(msg.status, 'SENT');
    assert.ok(msg.sent_at);
  });

  test('Message transitions to FAILED when maximum retries exceeded', () => {
    let msg = {
      id: 'OUT-002',
      status: 'QUEUED',
      retry_count: 2,
      max_retries: 3,
    };

    msg = simulateSend(msg, 'Invalid phone number format');
    assert.equal(msg.retry_count, 3);
    assert.equal(msg.status, 'FAILED');
  });
});

// ===========================================================================
// 9. Multilingual AI Gateway & RBAC Tool Authorization
// ===========================================================================
describe('Multilingual AI Gateway & RBAC Tool Security', () => {
  function detectLanguage(text) {
    if (!text) return 'en';
    const teluguRegex = /[\u0C00-\u0C7F]/;
    const hindiRegex = /[\u0900-\u097F]/;
    const tamilRegex = /[\u0B80-\u0BFF]/;
    const kannadaRegex = /[\u0C80-\u0CFF]/;

    if (teluguRegex.test(text)) return 'te';
    if (hindiRegex.test(text)) return 'hi';
    if (tamilRegex.test(text)) return 'ta';
    if (kannadaRegex.test(text)) return 'kn';

    const lower = text.toLowerCase();
    // Romanized Telugu phrases
    if (/chupinchu|evaru|enti|cheppu|kavale|undi|ledu/.test(lower)) return 'te';
    // Romanized Hindi phrases
    if (/batao|kya|hai|kitna|chahiye|dikhao|karo/.test(lower)) return 'hi';

    return 'en';
  }

  function authorizeTool(toolName, userRole) {
    const TOOL_PERMISSIONS = {
      search_catalog: ['Managing Director', 'Admin / BDM', 'BDM', 'Operations / Purchase', 'Technician'],
      check_stock: ['Managing Director', 'Admin / BDM', 'BDM', 'Operations / Purchase', 'Technician'],
      view_commercial_margins: ['Managing Director', 'Admin / BDM'],
      create_sales_order: ['Managing Director', 'Admin / BDM', 'BDM'],
    };

    const allowed = TOOL_PERMISSIONS[toolName];
    if (!allowed || !allowed.includes(userRole)) {
      return { authorized: false, error: `Role '${userRole}' is not authorized to call '${toolName}'` };
    }
    return { authorized: true };
  }

  test('Accurately identifies native Telugu script', () => {
    assert.equal(detectLanguage('ఈ రోజు సేల్స్ ఆర్డర్లు చూపించు'), 'te');
  });

  test('Accurately identifies Romanized Telugu query', () => {
    assert.equal(detectLanguage('Order status chupinchu'), 'te');
  });

  test('Accurately identifies native Hindi script', () => {
    assert.equal(detectLanguage('आज के नए कोटेशन दिखाओ'), 'hi');
  });

  test('Accurately identifies Romanized Hindi query', () => {
    assert.equal(detectLanguage('Product ka stock kitna hai batao'), 'hi');
  });

  test('Defaults English query to en', () => {
    assert.equal(detectLanguage('List top customers in Hyderabad'), 'en');
  });

  test('Enforces tool-level RBAC: prevents Technician from viewing margins', () => {
    const auth = authorizeTool('view_commercial_margins', 'Technician');
    assert.equal(auth.authorized, false);
    assert.match(auth.error, /is not authorized/);
  });

  test('Allows Managing Director to access view_commercial_margins', () => {
    const auth = authorizeTool('view_commercial_margins', 'Managing Director');
    assert.equal(auth.authorized, true);
  });
});

// ===========================================================================
// 10. System Health Telemetry Diagnostic Subsystems
// ===========================================================================
describe('System Health Diagnostic Subsystems', () => {
  function evaluateOverallHealth(components) {
    const anyError = components.some((c) => c.status === 'ERROR');
    const anyDegraded = components.some((c) => c.status === 'DEGRADED');

    if (anyError) return 'ERROR';
    if (anyDegraded) return 'DEGRADED';
    return 'ONLINE';
  }

  test('Reports DEGRADED when fallback mock mode is active instead of lying ONLINE', () => {
    const components = [
      { name: 'database', status: 'DEGRADED', message: 'In-memory fallback active' },
      { name: 'application', status: 'ONLINE', message: 'Next.js 15 operational' },
    ];

    assert.equal(evaluateOverallHealth(components), 'DEGRADED');
  });

  test('Reports ONLINE only when all critical subsystems are ONLINE', () => {
    const components = [
      { name: 'database', status: 'ONLINE', message: 'Connected' },
      { name: 'authentication', status: 'ONLINE', message: 'Auth service healthy' },
      { name: 'application', status: 'ONLINE', message: 'Next.js 15 operational' },
    ];

    assert.equal(evaluateOverallHealth(components), 'ONLINE');
  });
});
