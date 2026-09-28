import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

// ---------------------------------------------------------------------------
// 1. Lean Reseller Stock Split Logic Invariants
// ---------------------------------------------------------------------------
function allocateResellerStock(productStock, requestedQty) {
  const stock = Math.max(0, productStock);
  const qty = Math.max(0, requestedQty);

  if (stock >= qty) {
    return {
      reserved_quantity: qty,
      procurement_required_qty: 0,
      procurement_status: 'IN_OFFICE_STOCK',
      remaining_stock: stock - qty,
    };
  } else if (stock > 0) {
    return {
      reserved_quantity: stock,
      procurement_required_qty: qty - stock,
      procurement_status: 'PARTIALLY_RESERVED',
      remaining_stock: 0,
    };
  } else {
    return {
      reserved_quantity: 0,
      procurement_required_qty: qty,
      procurement_status: 'PO_REQUIRED',
      remaining_stock: 0,
    };
  }
}

describe('Lean Reseller Stock Allocation Engine', () => {
  test('Case A: Full office stock covers order completely', () => {
    const res = allocateResellerStock(10, 4);
    assert.equal(res.reserved_quantity, 4);
    assert.equal(res.procurement_required_qty, 0);
    assert.equal(res.procurement_status, 'IN_OFFICE_STOCK');
    assert.equal(res.remaining_stock, 6);
  });

  test('Case B: Partial office stock reserves available and flags remainder as backorder', () => {
    const res = allocateResellerStock(3, 8);
    assert.equal(res.reserved_quantity, 3);
    assert.equal(res.procurement_required_qty, 5);
    assert.equal(res.procurement_status, 'PARTIALLY_RESERVED');
    assert.equal(res.remaining_stock, 0);
  });

  test('Case C: Zero office stock flags entire quantity for distributor procurement', () => {
    const res = allocateResellerStock(0, 5);
    assert.equal(res.reserved_quantity, 0);
    assert.equal(res.procurement_required_qty, 5);
    assert.equal(res.procurement_status, 'PO_REQUIRED');
    assert.equal(res.remaining_stock, 0);
  });
});

// ---------------------------------------------------------------------------
// 2. Reseller Purchase Order & Drop-Ship Invariant
// ---------------------------------------------------------------------------
describe('Drop-Ship vs Office Inventory Receipt Invariants', () => {
  test('Office Receipt Mode increments physical office inventory ledger', () => {
    let officeStock = 2;
    const po = {
      po_number: 'PO260001',
      delivery_type: 'OFFICE_RECEIPT',
      quantity: 5,
    };

    // Simulate office receipt
    if (po.delivery_type === 'OFFICE_RECEIPT') {
      officeStock += po.quantity;
    }

    assert.equal(officeStock, 7, 'Office physical stock must increment upon office delivery');
  });

  test('Drop-Ship Mode delivers directly to customer site with ZERO office stock inflation', () => {
    let officeStock = 2;
    const soLine = {
      product_name: 'Epson EB-L260F',
      quantity: 3,
      fulfilled_quantity: 0,
      procurement_status: 'PO_ISSUED',
    };

    const po = {
      po_number: 'PO260002',
      delivery_type: 'DIRECT_CUSTOMER_DROPSHIP',
      consignee_name: 'GVK One Mall Site',
      distributor_invoice_number: 'RED/INV/9921',
      courier_transporter: 'VRL Logistics',
      tracking_number: 'VRL-HYD-88219',
      proof_of_delivery_ref: 'Signed POD Slip #104',
      quantity: 3,
    };

    // Simulate Drop-Ship receipt
    if (po.delivery_type === 'DIRECT_CUSTOMER_DROPSHIP') {
      // Must NOT touch officeStock
      soLine.fulfilled_quantity += po.quantity;
      soLine.procurement_status = 'DROPSHIPPED';
    }

    assert.equal(officeStock, 2, 'Office stock MUST NOT inflate on drop-ship delivery');
    assert.equal(soLine.fulfilled_quantity, 3, 'Customer SO line must be fulfilled');
    assert.equal(soLine.procurement_status, 'DROPSHIPPED', 'SO line status must be DROPSHIPPED');
  });
});

// ---------------------------------------------------------------------------
// 3. Consolidated Multi-Order Purchasing
// ---------------------------------------------------------------------------
describe('Consolidated Multi-Order PO Grouping', () => {
  test('Consolidates backorders from multiple Sales Orders into a single distributor PO', () => {
    const backorders = [
      { order_number: 'ORD260001', product_name: 'HDMI 10m Cable', qty: 4 },
      { order_number: 'ORD260002', product_name: 'HDMI 10m Cable', qty: 6 },
      { order_number: 'ORD260003', product_name: '4K Display 65"', qty: 1 },
    ];

    const consolidatedPoItems = backorders.map((bo) => ({
      product_name: bo.product_name,
      quantity: bo.qty,
      source_order: bo.order_number,
    }));

    const po = {
      po_number: 'PO260010',
      supplier_name: 'Savex Technologies',
      items: consolidatedPoItems,
      total_items: consolidatedPoItems.reduce((sum, it) => sum + it.quantity, 0),
    };

    assert.equal(po.items.length, 3, 'All source items must be preserved with traceability');
    assert.equal(po.total_items, 11, 'Total quantity across orders must be 11');
    assert.equal(po.items[0].source_order, 'ORD260001');
    assert.equal(po.items[1].source_order, 'ORD260002');
  });
});

// ---------------------------------------------------------------------------
// 4. GST Place of Supply (Intrastate vs Interstate)
// ---------------------------------------------------------------------------
function computeInvoiceGst(subtotal, gstRatePct, customerStateCode, customerStateName) {
  const gstTotal = Number(((subtotal * gstRatePct) / 100).toFixed(2));
  const stateCode = (customerStateCode || '').trim();
  const stateName = (customerStateName || '').trim().toLowerCase();

  // Telangana code 36
  const isInterstate = stateCode ? stateCode !== '36' : (stateName !== '' && !stateName.includes('telangana'));

  if (isInterstate) {
    return {
      isInterstate: true,
      cgst: 0,
      sgst: 0,
      igst: gstTotal,
      gst_total: gstTotal,
      grand_total: Number((subtotal + gstTotal).toFixed(2)),
    };
  } else {
    const half = Number((gstTotal / 2).toFixed(2));
    return {
      isInterstate: false,
      cgst: half,
      sgst: half,
      igst: 0,
      gst_total: gstTotal,
      grand_total: Number((subtotal + gstTotal).toFixed(2)),
    };
  }
}

describe('Dynamic GST Calculation & Place of Supply (Telangana vs Interstate)', () => {
  test('Telangana customer (State Code 36) splits equally into CGST + SGST (Intrastate)', () => {
    const res = computeInvoiceGst(100000, 18, '36', 'Telangana');
    assert.equal(res.isInterstate, false);
    assert.equal(res.cgst, 9000);
    assert.equal(res.sgst, 9000);
    assert.equal(res.igst, 0);
    assert.equal(res.grand_total, 118000);
  });

  test('Karnataka customer (State Code 29) routes 100% to IGST (Interstate)', () => {
    const res = computeInvoiceGst(100000, 18, '29', 'Karnataka');
    assert.equal(res.isInterstate, true);
    assert.equal(res.cgst, 0);
    assert.equal(res.sgst, 0);
    assert.equal(res.igst, 18000);
    assert.equal(res.grand_total, 118000);
  });

  test('Andhra Pradesh customer (State Code 37) routes 100% to IGST (Interstate)', () => {
    const res = computeInvoiceGst(50000, 18, '37', 'Andhra Pradesh');
    assert.equal(res.isInterstate, true);
    assert.equal(res.cgst, 0);
    assert.equal(res.sgst, 0);
    assert.equal(res.igst, 9000);
    assert.equal(res.grand_total, 59000);
  });
});

// ---------------------------------------------------------------------------
// 5. Commercial Price Privacy (Role-Based Sanitization)
// ---------------------------------------------------------------------------
function sanitizeProductForUserRole(product, userRole) {
  const privilegedRoles = ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'];
  const canSeeCost = privilegedRoles.includes(userRole);

  if (canSeeCost) {
    return { ...product };
  }

  return {
    ...product,
    purchase_price: 0,
    target_margin_pct: 0,
    supplier_name: undefined,
  };
}

describe('Commercial Purchase Cost Role Privacy', () => {
  const rawProduct = {
    id: 'prod_epson_1',
    sku: 'EP-4K-980',
    name: 'Epson 4K Projector',
    purchase_price: 72000,
    selling_price: 95000,
    target_margin_pct: 24.2,
    supplier_name: 'Redington India Ltd',
  };

  test('Sales Executive receives sanitized product with 0 purchase_price and 0 margin', () => {
    const sanitized = sanitizeProductForUserRole(rawProduct, 'Sales Executive');
    assert.equal(sanitized.purchase_price, 0, 'Sales Executive must not see purchase cost');
    assert.equal(sanitized.target_margin_pct, 0, 'Sales Executive must not see margin %');
    assert.equal(sanitized.supplier_name, undefined, 'Supplier name must be sanitized');
    assert.equal(sanitized.selling_price, 95000, 'Selling price must remain intact');
  });

  test('Office Assistant receives sanitized product with 0 purchase_price and 0 margin', () => {
    const sanitized = sanitizeProductForUserRole(rawProduct, 'Office Assistant');
    assert.equal(sanitized.purchase_price, 0);
    assert.equal(sanitized.target_margin_pct, 0);
    assert.equal(sanitized.supplier_name, undefined);
  });

  test('Managing Director receives full commercial figures', () => {
    const view = sanitizeProductForUserRole(rawProduct, 'Managing Director');
    assert.equal(view.purchase_price, 72000);
    assert.equal(view.target_margin_pct, 24.2);
    assert.equal(view.supplier_name, 'Redington India Ltd');
  });

  test('Accounts officer receives full commercial figures', () => {
    const view = sanitizeProductForUserRole(rawProduct, 'Accounts');
    assert.equal(view.purchase_price, 72000);
    assert.equal(view.target_margin_pct, 24.2);
  });
});

// ---------------------------------------------------------------------------
// 6. Installation Job Card & Customer Sign-off
// ---------------------------------------------------------------------------
describe('Installation Job Card & Customer Acceptance Handover', () => {
  test('Checklist toggle advances status and handover sign-off completes lifecycle', () => {
    const jobCard = {
      id: 'INS260001',
      customer_name: 'T-Hub Foundation',
      order_number: 'ORD260001',
      status: 'SCHEDULED',
      handover_status: 'PENDING',
      checklist: [
        { id: 'c1', label: 'Mounting', completed: false },
        { id: 'c2', label: 'Cabling', completed: false },
        { id: 'c3', label: 'Calibration', completed: false },
      ],
    };

    // Complete checklist tasks
    jobCard.checklist[0].completed = true;
    jobCard.checklist[1].completed = true;
    jobCard.checklist[2].completed = true;

    const allDone = jobCard.checklist.every((c) => c.completed);
    if (allDone) jobCard.status = 'COMPLETED';

    assert.equal(jobCard.status, 'COMPLETED');

    // Customer sign-off handover
    jobCard.customer_signoff_by = 'K. Ramesh (IT Director)';
    jobCard.customer_signoff_date = '2026-09-12';
    jobCard.handover_status = 'HANDED_OVER';

    assert.equal(jobCard.handover_status, 'HANDED_OVER');
    assert.equal(jobCard.customer_signoff_by, 'K. Ramesh (IT Director)');
  });
});
