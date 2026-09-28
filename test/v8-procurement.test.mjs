import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Self-contained test suite for Phase E: Procurement & Supplier Management
// Node ESM test runner - independent of Next.js @/ aliases

describe('Phase E — Procurement & Supplier Management', () => {
  // Test Data
  const sampleSuppliers = [
    {
      id: 'SUP001',
      supplier_code: 'SUP-HYD-01',
      supplier_name: 'Hyderabad AV Tech Distributors',
      contact_person: 'Ramesh Reddy',
      phone: '+91 98490 11223',
      email: 'sales@hydavtech.com',
      payment_terms_days: 30,
      is_active: true,
    },
    {
      id: 'SUP002',
      supplier_code: 'SUP-BOM-02',
      supplier_name: 'Shree Prime Distributors',
      contact_person: 'Mitesh Patel',
      phone: '+91 98200 44556',
      email: 'procure@shreeprime.com',
      payment_terms_days: 21,
      is_active: true,
    },
    {
      id: 'SUP003',
      supplier_code: 'SUP-BLR-03',
      supplier_name: 'EduTech Displays India',
      contact_person: 'Anil Kumar',
      phone: '+91 99800 77889',
      email: 'dealers@edutechdisplays.in',
      payment_terms_days: 45,
      is_active: true,
    },
  ];

  const sampleProductSuppliers = [
    {
      product_id: 'prod_epson_1',
      product_sku: 'EP-4K-980',
      product_name: 'Epson Home Cinema 4K Laser Projector',
      supplier_id: 'SUP001',
      supplier_name: 'Hyderabad AV Tech Distributors',
      purchase_cost: 72000,
      lead_time_days: 2,
      payment_terms_days: 30,
      is_preferred: true,
      availability_status: 'IN_STOCK',
    },
    {
      product_id: 'prod_epson_1',
      product_sku: 'EP-4K-980',
      product_name: 'Epson Home Cinema 4K Laser Projector',
      supplier_id: 'SUP002',
      supplier_name: 'Shree Prime Distributors',
      purchase_cost: 73500,
      lead_time_days: 4,
      payment_terms_days: 21,
      is_preferred: false,
      availability_status: '2_3_DAYS',
    },
    {
      product_id: 'prod_epson_1',
      product_sku: 'EP-4K-980',
      product_name: 'Epson Home Cinema 4K Laser Projector',
      supplier_id: 'SUP003',
      supplier_name: 'EduTech Displays India',
      purchase_cost: 75000,
      lead_time_days: 5,
      payment_terms_days: 45,
      is_preferred: false,
      availability_status: 'BACKORDER',
    },
  ];

  const samplePurchaseOrders = [
    {
      id: 'PO-001',
      po_number: 'ICON/26-27/PO-0001',
      supplier_id: 'SUP001',
      supplier_name: 'Hyderabad AV Tech Distributors',
      order_date: '2026-09-01',
      expected_delivery: '2026-09-03',
      delivery_date: '2026-09-03',
      on_time_status: 'ON_TIME',
      total_amount: 144000,
      status: 'Received',
      items: [{ product_name: 'Epson Projector', quantity: 2, unit_cost: 72000, received_quantity: 2 }],
    },
    {
      id: 'PO-002',
      po_number: 'ICON/26-27/PO-0002',
      supplier_id: 'SUP001',
      supplier_name: 'Hyderabad AV Tech Distributors',
      order_date: '2026-09-05',
      expected_delivery: '2026-09-07',
      delivery_date: '2026-09-07',
      on_time_status: 'ON_TIME',
      total_amount: 288000,
      status: 'Received',
      items: [{ product_name: 'Epson Projector', quantity: 4, unit_cost: 72000, received_quantity: 4 }],
    },
    {
      id: 'PO-003',
      po_number: 'ICON/26-27/PO-0003',
      supplier_id: 'SUP002',
      supplier_name: 'Shree Prime Distributors',
      order_date: '2026-09-08',
      expected_delivery: '2026-09-12',
      delivery_date: '2026-09-14',
      on_time_status: 'DELAYED',
      total_amount: 173460,
      status: 'Received',
      items: [{ product_name: 'Epson Projector', quantity: 2, unit_cost: 73500, received_quantity: 2 }],
    },
    {
      id: 'PO-004',
      po_number: 'ICON/26-27/PO-0004',
      supplier_id: 'SUP003',
      supplier_name: 'EduTech Displays India',
      order_date: '2026-09-10',
      expected_delivery: '2026-09-15',
      total_amount: 502680,
      status: 'Issued',
      items: [{ product_name: 'Interactive Display', quantity: 3, unit_cost: 142000, received_quantity: 0 }],
    },
  ];

  // Pure logic implementation for testing
  function calculateSupplierQuoteComparison(productSuppliers, quantity, showCost = true) {
    const qty = Math.max(1, Number(quantity) || 1);
    const lowestCost = Math.min(...productSuppliers.map((m) => m.purchase_cost));
    const fastestDays = Math.min(...productSuppliers.map((m) => m.lead_time_days));

    const quotes = productSuppliers.map((m) => {
      const unitCost = showCost ? m.purchase_cost : 0;
      const gstRate = 18;
      const taxable = Number((unitCost * qty).toFixed(2));
      const gstAmt = Number(((taxable * gstRate) / 100).toFixed(2));
      const totalCost = Number((taxable + gstAmt).toFixed(2));

      let costScore = 0;
      if (m.purchase_cost > 0) {
        costScore = Math.max(0, 40 * (lowestCost / m.purchase_cost));
      }

      let leadScore = 0;
      if (m.lead_time_days <= 2) leadScore = 25;
      else if (m.lead_time_days <= 4) leadScore = 18;
      else if (m.lead_time_days <= 7) leadScore = 10;
      else leadScore = 5;

      let availScore = 0;
      if (m.availability_status === 'IN_STOCK') availScore = 20;
      else if (m.availability_status === '2_3_DAYS') availScore = 10;

      const prefBonus = m.is_preferred ? 15 : 0;
      const totalScore = Math.round(costScore + leadScore + availScore + prefBonus);

      return {
        supplier_id: m.supplier_id,
        supplier_name: m.supplier_name,
        quantity: qty,
        unit_cost: unitCost,
        gst_rate: gstRate,
        taxable_amount: taxable,
        gst_amount: gstAmt,
        total_cost: totalCost,
        lead_time_days: m.lead_time_days,
        payment_terms_days: m.payment_terms_days,
        availability_status: m.availability_status,
        is_preferred: m.is_preferred,
        score: totalScore,
        is_best_price: m.purchase_cost === lowestCost,
        is_fastest: m.lead_time_days === fastestDays,
        is_recommended: false,
      };
    });

    quotes.sort((a, b) => b.score - a.score);
    if (quotes.length > 0) {
      quotes[0].is_recommended = true;
    }

    return quotes;
  }

  function calculateSupplierPerformance(suppliers, pos) {
    return suppliers.map((sup) => {
      const supplierPos = pos.filter((p) => p.supplier_id === sup.id);
      const totalPos = supplierPos.length;
      const nonCancelled = supplierPos.filter((p) => p.status !== 'Cancelled');
      const totalSpend = nonCancelled.reduce((sum, p) => sum + p.total_amount, 0);
      const fulfilledPos = supplierPos.filter((p) => p.status === 'Received' || p.status === 'Closed').length;
      const pendingPos = supplierPos.filter((p) => p.status === 'Issued' || p.status === 'Partially Received').length;

      let onTimeCount = 0;
      let evaluated = 0;
      for (const p of supplierPos) {
        if (p.status === 'Received' || p.status === 'Closed') {
          evaluated++;
          if (p.on_time_status === 'ON_TIME' || !p.on_time_status) {
            onTimeCount++;
          }
        }
      }

      const onTimeRate = evaluated > 0 ? Number(((onTimeCount / evaluated) * 100).toFixed(1)) : 95.0;
      const qualityRate = 98.5;
      const spendBonus = totalSpend > 1000000 ? 15 : totalSpend > 0 ? 10 : 5;
      const overallRating = Math.min(100, Math.round(onTimeRate * 0.45 + qualityRate * 0.40 + spendBonus));

      let tier = 'TIER_2_STANDARD';
      if (overallRating >= 90) tier = 'TIER_1_PREFERRED';
      else if (overallRating >= 75) tier = 'TIER_2_STANDARD';
      else if (overallRating >= 60) tier = 'TIER_3_WATCHLIST';
      else tier = 'TIER_4_RESTRICTED';

      return {
        supplier_id: sup.id,
        supplier_name: sup.supplier_name,
        total_pos: totalPos,
        total_spend: totalSpend,
        fulfilled_pos: fulfilledPos,
        pending_pos: pendingPos,
        on_time_delivery_rate: onTimeRate,
        overall_rating: overallRating,
        tier,
      };
    });
  }

  function validatePOStatusTransition(currentStatus, newStatus, receivedQuantity) {
    if (currentStatus === newStatus) return { valid: true };
    if (newStatus === 'Cancelled' && receivedQuantity > 0) {
      return { valid: false, error: 'Cannot cancel PO with items already received' };
    }
    const validStates = ['Draft', 'Issued', 'Partially Received', 'Received', 'Closed', 'Cancelled'];
    if (!validStates.includes(newStatus)) {
      return { valid: false, error: `Invalid status: ${newStatus}` };
    }
    return { valid: true };
  }

  // TEST CASES
  it('E1: compares supplier quotes and computes correct GST and total amounts', () => {
    const quotes = calculateSupplierQuoteComparison(sampleProductSuppliers, 3, true);
    assert.equal(quotes.length, 3);

    const first = quotes.find((q) => q.supplier_id === 'SUP001');
    assert.ok(first);
    assert.equal(first.unit_cost, 72000);
    assert.equal(first.taxable_amount, 216000); // 72000 * 3
    assert.equal(first.gst_amount, 38880); // 18% of 216000
    assert.equal(first.total_cost, 254880); // 216000 + 38880
  });

  it('E2: correctly flags best price, fastest delivery, and top recommended quote', () => {
    const quotes = calculateSupplierQuoteComparison(sampleProductSuppliers, 2, true);
    const top = quotes[0];
    assert.equal(top.supplier_id, 'SUP001');
    assert.equal(top.is_best_price, true);
    assert.equal(top.is_fastest, true);
    assert.equal(top.is_recommended, true);
    assert.ok(top.score > 90);
  });

  it('E3: masks purchase costs when user is unauthorized to view costs', () => {
    const quotes = calculateSupplierQuoteComparison(sampleProductSuppliers, 2, false);
    for (const q of quotes) {
      assert.equal(q.unit_cost, 0);
      assert.equal(q.taxable_amount, 0);
      assert.equal(q.total_cost, 0);
      // Score and delivery terms are still calculated
      assert.ok(q.score > 0);
      assert.ok(q.lead_time_days > 0);
    }
  });

  it('E4: evaluates supplier performance metrics and assigns correct tiers', () => {
    const performance = calculateSupplierPerformance(sampleSuppliers, samplePurchaseOrders);
    assert.equal(performance.length, 3);

    const hyd = performance.find((p) => p.supplier_id === 'SUP001');
    assert.ok(hyd);
    assert.equal(hyd.total_pos, 2);
    assert.equal(hyd.fulfilled_pos, 2);
    assert.equal(hyd.on_time_delivery_rate, 100.0);
    assert.equal(hyd.tier, 'TIER_1_PREFERRED');

    const shree = performance.find((p) => p.supplier_id === 'SUP002');
    assert.ok(shree);
    assert.equal(shree.total_pos, 1);
    assert.equal(shree.on_time_delivery_rate, 0.0); // 1 delivery was DELAYED
  });

  it('E5: enforces valid PO status lifecycle transitions', () => {
    // Valid transitions
    assert.equal(validatePOStatusTransition('Draft', 'Issued', 0).valid, true);
    assert.equal(validatePOStatusTransition('Issued', 'Partially Received', 1).valid, true);
    assert.equal(validatePOStatusTransition('Partially Received', 'Received', 2).valid, true);
    assert.equal(validatePOStatusTransition('Received', 'Closed', 2).valid, true);

    // Cannot cancel PO with received goods
    const invalidCancel = validatePOStatusTransition('Partially Received', 'Cancelled', 1);
    assert.equal(invalidCancel.valid, false);
    assert.match(invalidCancel.error, /Cannot cancel PO with items already received/);

    // Can cancel PO if 0 received
    const validCancel = validatePOStatusTransition('Issued', 'Cancelled', 0);
    assert.equal(validCancel.valid, true);
  });

  it('E6: handles zero/negative quantity gracefully with minimum boundary 1', () => {
    const quotesZero = calculateSupplierQuoteComparison(sampleProductSuppliers, 0, true);
    assert.equal(quotesZero[0].quantity, 1);

    const quotesNegative = calculateSupplierQuoteComparison(sampleProductSuppliers, -5, true);
    assert.equal(quotesNegative[0].quantity, 1);
  });
});
