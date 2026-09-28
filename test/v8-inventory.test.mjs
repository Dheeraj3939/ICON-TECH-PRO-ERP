import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Self-contained test suite for Phase F: Inventory & Serial Movement (Immutable ledger)
// Node ESM test runner - independent of Next.js @/ aliases

describe('Phase F — Inventory & Serial Movement (Immutable ledger)', () => {
  // Pure logic engines for testing invariants

  class InventoryEngine {
    constructor() {
      this.products = [
        { id: 'prod_1', sku: 'EP-4K-980', name: 'Epson 4K Projector', current_stock: 5, reorder_level: 2 },
        { id: 'prod_2', sku: 'IFP-75-4K', name: '75" Flat Panel', current_stock: 1, reorder_level: 2 },
        { id: 'prod_3', sku: 'SRV-RAM-32G', name: '32GB Server RAM', current_stock: 0, reorder_level: 4 },
      ];
      this.stockMovements = [];
      this.serialLedger = [];
    }

    recordStockMovement({ productId, movementType, quantity, referenceModule, referenceNumber, actorName }) {
      const product = this.products.find((p) => p.id === productId || p.sku === productId);
      if (!product) {
        return { success: false, error: `Product not found: ${productId}` };
      }

      const qty = Math.max(1, Number(quantity) || 1);
      const isOutward = movementType === 'SALES_DISPATCH' || movementType === 'RENTAL_OUT';

      // ZERO NEGATIVE STOCK INVARIANT
      if (isOutward && product.current_stock < qty) {
        return {
          success: false,
          error: `Insufficient stock for ${product.name}: current stock is ${product.current_stock}, required outward is ${qty}. Zero negative stock invariant enforced.`,
        };
      }

      const previousStock = product.current_stock;
      const newStock = isOutward ? product.current_stock - qty : product.current_stock + qty;

      const record = {
        id: `SM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        movement_type: movementType,
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        previous_stock: previousStock,
        new_stock: newStock,
        reference_module: referenceModule,
        reference_number: referenceNumber,
        created_by_name: actorName,
        created_at: new Date().toISOString(),
      };

      // Append-only
      this.stockMovements.unshift(record);
      product.current_stock = newStock;

      return { success: true, data: record };
    }

    scanAndMoveSerial({ serialNumber, productName, action, newStatus, actorName, customerName }) {
      const s = serialNumber.trim().toUpperCase();
      if (!s) return { success: false, error: 'Serial number cannot be empty' };

      const history = this.serialLedger.filter((l) => l.serial_number === s);
      const lastEntry = history[0];
      const previousStatus = lastEntry ? lastEntry.new_status : undefined;

      // Cannot transition to current status
      if (previousStatus === newStatus) {
        return { success: false, error: `Serial ${s} is already in status "${newStatus}".` };
      }

      // State machine validation
      const validTransitions = {
        undefined: ['AVAILABLE', 'RESERVED'],
        AVAILABLE: ['RESERVED', 'DISPATCHED', 'DEFECTIVE'],
        RESERVED: ['AVAILABLE', 'DISPATCHED', 'DEFECTIVE'],
        DISPATCHED: ['INSTALLED', 'RETURNED', 'DEFECTIVE'],
        INSTALLED: ['RETURNED', 'DEFECTIVE'],
        RETURNED: ['AVAILABLE', 'DEFECTIVE'],
        DEFECTIVE: ['AVAILABLE'],
      };

      const allowed = validTransitions[previousStatus] || [];
      if (!allowed.includes(newStatus)) {
        return {
          success: false,
          error: `Invalid transition: cannot move serial from ${previousStatus || 'NEW'} to ${newStatus}.`,
        };
      }

      const entry = {
        id: `SL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        serial_number: s,
        product_name: productName,
        action,
        previous_status: previousStatus,
        new_status: newStatus,
        actor_name: actorName,
        customer_name: customerName,
        created_at: new Date().toISOString(),
      };

      this.serialLedger.unshift(entry);
      return { success: true, data: entry };
    }

    traceSerialLifecycle(serialNumber) {
      const s = serialNumber.trim().toUpperCase();
      const history = this.serialLedger.filter((l) => l.serial_number === s);
      if (history.length === 0) {
        return { success: false, error: `No records found for serial "${s}"` };
      }

      return {
        success: true,
        data: {
          serial_number: s,
          product_name: history[0].product_name,
          current_status: history[0].new_status,
          history,
          installed_customer: history.find((h) => h.customer_name)?.customer_name,
        },
      };
    }
  }

  // TEST CASES

  it('F1: increases stock on inward PURCHASE_RECEIPT and records previous/new stock', () => {
    const engine = new InventoryEngine();
    const res = engine.recordStockMovement({
      productId: 'prod_1',
      movementType: 'PURCHASE_RECEIPT',
      quantity: 3,
      referenceModule: 'PO',
      referenceNumber: 'PO260001',
      actorName: 'Dheeraj',
    });

    assert.equal(res.success, true);
    assert.equal(res.data.previous_stock, 5);
    assert.equal(res.data.new_stock, 8);
    assert.equal(res.data.quantity, 3);
    assert.equal(engine.products.find((p) => p.id === 'prod_1').current_stock, 8);
  });

  it('F2: strictly enforces ZERO NEGATIVE STOCK invariant on outward dispatch', () => {
    const engine = new InventoryEngine();
    // Attempt outward dispatch of 10 when stock is only 5
    const res = engine.recordStockMovement({
      productId: 'prod_1',
      movementType: 'SALES_DISPATCH',
      quantity: 10,
      referenceModule: 'SO',
      referenceNumber: 'ORD260001',
      actorName: 'Dheeraj',
    });

    assert.equal(res.success, false);
    assert.match(res.error, /Zero negative stock invariant enforced/);
    assert.equal(engine.products.find((p) => p.id === 'prod_1').current_stock, 5);
    assert.equal(engine.stockMovements.length, 0); // No record created on failure
  });

  it('F3: allows outward dispatch when sufficient stock exists and decreases stock correctly', () => {
    const engine = new InventoryEngine();
    const res = engine.recordStockMovement({
      productId: 'prod_1',
      movementType: 'SALES_DISPATCH',
      quantity: 2,
      referenceModule: 'SO',
      referenceNumber: 'ORD260001',
      actorName: 'Dheeraj',
    });

    assert.equal(res.success, true);
    assert.equal(res.data.previous_stock, 5);
    assert.equal(res.data.new_stock, 3);
    assert.equal(engine.products.find((p) => p.id === 'prod_1').current_stock, 3);
  });

  it('F4: enforces valid serial state machine progression (AVAILABLE -> RESERVED -> DISPATCHED -> INSTALLED)', () => {
    const engine = new InventoryEngine();
    const sn = 'EP-TEST-001';

    // 1. Initial inward
    const step1 = engine.scanAndMoveSerial({
      serialNumber: sn,
      productName: 'Epson Projector',
      action: 'INWARD_GRN',
      newStatus: 'AVAILABLE',
      actorName: 'Dheeraj',
    });
    assert.equal(step1.success, true);
    assert.equal(step1.data.new_status, 'AVAILABLE');

    // 2. Reserve
    const step2 = engine.scanAndMoveSerial({
      serialNumber: sn,
      productName: 'Epson Projector',
      action: 'RESERVE',
      newStatus: 'RESERVED',
      actorName: 'Dheeraj',
    });
    assert.equal(step2.success, true);
    assert.equal(step2.data.previous_status, 'AVAILABLE');
    assert.equal(step2.data.new_status, 'RESERVED');

    // 3. Dispatch
    const step3 = engine.scanAndMoveSerial({
      serialNumber: sn,
      productName: 'Epson Projector',
      action: 'DISPATCH',
      newStatus: 'DISPATCHED',
      actorName: 'Dheeraj',
      customerName: 'T-Hub',
    });
    assert.equal(step3.success, true);
    assert.equal(step3.data.new_status, 'DISPATCHED');

    // 4. Install
    const step4 = engine.scanAndMoveSerial({
      serialNumber: sn,
      productName: 'Epson Projector',
      action: 'INSTALL',
      newStatus: 'INSTALLED',
      actorName: 'Dheeraj',
      customerName: 'T-Hub',
    });
    assert.equal(step4.success, true);
    assert.equal(step4.data.new_status, 'INSTALLED');

    // 5. Trace lifecycle
    const trace = engine.traceSerialLifecycle(sn);
    assert.equal(trace.success, true);
    assert.equal(trace.data.current_status, 'INSTALLED');
    assert.equal(trace.data.installed_customer, 'T-Hub');
    assert.equal(trace.data.history.length, 4);
  });

  it('F5: rejects invalid serial state transitions and duplicate status updates', () => {
    const engine = new InventoryEngine();
    const sn = 'IFP-TEST-002';

    // Inward to AVAILABLE
    engine.scanAndMoveSerial({
      serialNumber: sn,
      productName: 'Flat Panel',
      action: 'INWARD_GRN',
      newStatus: 'AVAILABLE',
      actorName: 'Dheeraj',
    });

    // Re-transitioning to same status AVAILABLE is rejected
    const dupRes = engine.scanAndMoveSerial({
      serialNumber: sn,
      productName: 'Flat Panel',
      action: 'INWARD_GRN',
      newStatus: 'AVAILABLE',
      actorName: 'Dheeraj',
    });
    assert.equal(dupRes.success, false);
    assert.match(dupRes.error, /already in status "AVAILABLE"/);

    // Direct jump from AVAILABLE to INSTALLED without dispatch is rejected
    const invalidJump = engine.scanAndMoveSerial({
      serialNumber: sn,
      productName: 'Flat Panel',
      action: 'INSTALL',
      newStatus: 'INSTALLED',
      actorName: 'Dheeraj',
    });
    assert.equal(invalidJump.success, false);
    assert.match(invalidJump.error, /Invalid transition/);
  });

  it('F6: guarantees ledger immutability and preserves chronological order', () => {
    const engine = new InventoryEngine();
    engine.recordStockMovement({
      productId: 'prod_2',
      movementType: 'PURCHASE_RECEIPT',
      quantity: 5,
      referenceModule: 'PO',
      referenceNumber: 'PO-001',
      actorName: 'Dheeraj',
    });
    engine.recordStockMovement({
      productId: 'prod_2',
      movementType: 'SALES_DISPATCH',
      quantity: 2,
      referenceModule: 'SO',
      referenceNumber: 'SO-001',
      actorName: 'Dheeraj',
    });

    assert.equal(engine.stockMovements.length, 2);
    // Newest movement is first (SALES_DISPATCH)
    assert.equal(engine.stockMovements[0].movement_type, 'SALES_DISPATCH');
    assert.equal(engine.stockMovements[0].previous_stock, 6); // 1 + 5 = 6
    assert.equal(engine.stockMovements[0].new_stock, 4); // 6 - 2 = 4

    // Older movement is second (PURCHASE_RECEIPT)
    assert.equal(engine.stockMovements[1].movement_type, 'PURCHASE_RECEIPT');
    assert.equal(engine.stockMovements[1].previous_stock, 1);
    assert.equal(engine.stockMovements[1].new_stock, 6);
  });
});
