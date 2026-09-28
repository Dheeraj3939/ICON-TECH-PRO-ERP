import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Self-contained test suite for Phase G: Order → Dispatch → Invoicing (Distinct states)
// Node ESM test runner - independent of Next.js @/ aliases

describe('Phase G — Order → Dispatch → Invoicing (Distinct states)', () => {
  class OrderLifecycleEngine {
    constructor() {
      this.quotations = [];
      this.salesOrders = [];
      this.dispatches = [];
      this.invoices = [];
    }

    createQuotation(data) {
      const q = {
        id: `QT-${Date.now()}`,
        quotation_number: data.quotation_number || 'QT260001',
        customer_name: data.customer_name,
        total_amount: data.total_amount,
        status: data.status || 'Draft', // Draft, Issued, Customer Accepted, Rejected, Expired
      };
      this.quotations.push(q);
      return q;
    }

    createSalesOrderFromQuotation(quotationId, items) {
      const q = this.quotations.find((qt) => qt.id === quotationId);
      if (!q) throw new Error('Quotation not found');
      if (q.status !== 'Customer Accepted') {
        throw new Error('Cannot create Sales Order from unaccepted quotation');
      }

      const totalItems = items.length;
      const reservedCount = items.filter((it) => it.reserved_quantity >= it.quantity).length;
      const materialStatus = reservedCount === totalItems ? 'In Stock' : reservedCount > 0 ? 'Partially Received' : 'PO Required';
      const fulfillmentStatus = materialStatus === 'In Stock' ? 'Ready for Packing' : 'Pending Procurement';

      const order = {
        id: `ORD-${Date.now()}`,
        order_number: 'ORD260001',
        quotation_id: q.id,
        customer_name: q.customer_name,
        total_amount: q.total_amount,
        items,
        status: 'Confirmed', // OrderStatus: Confirmed, Pending Material, Pending Dispatch, Pending Invoice, Completed, Cancelled
        material_status: materialStatus, // MaterialStatus: In Stock, Stock Reserved, PO Required, Partially Received
        fulfillment_status: fulfillmentStatus, // FulfillmentStatus: Pending Procurement, Stock Reserved, Ready for Packing, Packed
        dispatch_status: 'Not Dispatched', // DispatchStatus: Not Dispatched, Partial, Dispatched, Installed & Handed Over
        invoice_id: undefined,
        delivery_challan_number: undefined,
      };

      this.salesOrders.push(order);
      return order;
    }

    createDeliveryChallan(orderNumber, payload) {
      const order = this.salesOrders.find((o) => o.order_number === orderNumber);
      if (!order) throw new Error(`Order ${orderNumber} not found`);

      if (order.status === 'Cancelled') {
        throw new Error('Cannot dispatch a cancelled order');
      }

      // Guard: Items must be fulfilled/reserved before dispatch
      const unfulfilled = order.items.some((it) => (it.reserved_quantity || 0) < it.quantity);
      if (unfulfilled) {
        throw new Error('Cannot dispatch order with pending unreserved items');
      }

      const dcNumber = `DC260001`;
      const dispatch = {
        id: `DSP-${Date.now()}`,
        dispatch_number: `DSP260001`,
        delivery_challan_number: dcNumber,
        order_number: order.order_number,
        customer_name: order.customer_name,
        shipping_address: payload.shipping_address,
        transporter_name: payload.transporter_name,
        vehicle_number: payload.vehicle_number,
        eway_bill_number: payload.eway_bill_number,
        status: 'Dispatched', // DispatchLifecycle: Draft DC, Ready to Ship, Packed, Dispatched, In Transit, Delivered, POD Confirmed, Returned
        dispatched_by_name: payload.dispatched_by_name || 'Admin',
        dispatch_date: new Date().toISOString(),
      };

      this.dispatches.push(dispatch);

      // Mutate order dispatch and fulfillment status WITHOUT collapsing order status
      order.dispatch_status = 'Dispatched';
      order.fulfillment_status = 'Packed';
      order.delivery_challan_number = dcNumber;

      return dispatch;
    }

    createInvoiceFromOrder(orderNumber) {
      const order = this.salesOrders.find((o) => o.order_number === orderNumber);
      if (!order) throw new Error(`Order ${orderNumber} not found`);

      if (order.status === 'Cancelled') {
        throw new Error('Cannot invoice a cancelled order');
      }

      const invNumber = 'INV260001';
      const invoice = {
        id: `INV-${Date.now()}`,
        invoice_number: invNumber,
        invoice_type: 'TAX_INVOICE',
        order_number: order.order_number,
        customer_name: order.customer_name,
        grand_total: order.total_amount,
        paid_amount: 0,
        balance_amount: order.total_amount,
        status: 'Unpaid', // InvoiceStatus: Unpaid, Partially Paid, Paid, Overdue
      };

      this.invoices.push(invoice);

      // Link invoice to order WITHOUT changing order status or dispatch status
      order.invoice_id = invNumber;

      return invoice;
    }

    confirmPOD(dispatchNumber, podReference) {
      const dispatch = this.dispatches.find(
        (d) => d.dispatch_number === dispatchNumber || d.delivery_challan_number === dispatchNumber
      );
      if (!dispatch) throw new Error('Dispatch not found');

      dispatch.status = 'POD Confirmed';
      dispatch.pod_reference = podReference;
      dispatch.pod_confirmed_at = new Date().toISOString();

      // Update linked order
      const order = this.salesOrders.find((o) => o.order_number === dispatch.order_number);
      if (order) {
        order.dispatch_status = 'Installed & Handed Over';
      }

      return dispatch;
    }
  }

  // TEST CASES

  it('G1: preserves distinct state boundaries across Quotation, Order, Dispatch, and Invoice', () => {
    const engine = new OrderLifecycleEngine();

    // 1. Quotation created
    const q = engine.createQuotation({
      customer_name: 'Dr. Reddy Labs',
      total_amount: 450000,
      status: 'Customer Accepted',
    });
    assert.equal(q.status, 'Customer Accepted');

    // 2. Sales Order created
    const items = [{ product_name: 'Interactive Panel', quantity: 2, reserved_quantity: 2 }];
    const order = engine.createSalesOrderFromQuotation(q.id, items);
    assert.equal(order.status, 'Confirmed');
    assert.equal(order.material_status, 'In Stock');
    assert.equal(order.fulfillment_status, 'Ready for Packing');
    assert.equal(order.dispatch_status, 'Not Dispatched');
    assert.equal(order.invoice_id, undefined);

    // 3. Dispatch created
    const dc = engine.createDeliveryChallan(order.order_number, {
      shipping_address: 'Banjara Hills, Hyderabad',
      transporter_name: 'Navata Road Transport',
      vehicle_number: 'TS 09 UB 1234',
    });
    assert.equal(dc.status, 'Dispatched');
    assert.equal(order.dispatch_status, 'Dispatched');
    assert.equal(order.fulfillment_status, 'Packed');
    // Crucial: Order status must NOT collapse into 'Dispatched' — it remains 'Confirmed'
    assert.equal(order.status, 'Confirmed');

    // 4. Tax Invoice generated
    const inv = engine.createInvoiceFromOrder(order.order_number);
    assert.equal(inv.status, 'Unpaid');
    assert.equal(order.invoice_id, 'INV260001');
    // Crucial: Order and Dispatch statuses remain distinct and untouched
    assert.equal(order.status, 'Confirmed');
    assert.equal(order.dispatch_status, 'Dispatched');
    assert.equal(dc.status, 'Dispatched');
  });

  it('G2: prevents creating Sales Order from unaccepted Quotation', () => {
    const engine = new OrderLifecycleEngine();
    const q = engine.createQuotation({
      customer_name: 'Tech Mahindra',
      total_amount: 120000,
      status: 'Issued', // Not yet accepted
    });

    assert.throws(() => {
      engine.createSalesOrderFromQuotation(q.id, [{ product_name: 'Router', quantity: 1, reserved_quantity: 1 }]);
    }, /Cannot create Sales Order from unaccepted quotation/);
  });

  it('G3: prevents premature dispatch when items are not fulfilled/reserved', () => {
    const engine = new OrderLifecycleEngine();
    const q = engine.createQuotation({
      customer_name: 'Apollo Hospitals',
      total_amount: 300000,
      status: 'Customer Accepted',
    });

    // 0 reserved out of 2 requested
    const items = [{ product_name: 'Server Rack', quantity: 2, reserved_quantity: 0 }];
    const order = engine.createSalesOrderFromQuotation(q.id, items);

    assert.equal(order.material_status, 'PO Required');
    assert.equal(order.fulfillment_status, 'Pending Procurement');

    // Attempting dispatch must fail
    assert.throws(() => {
      engine.createDeliveryChallan(order.order_number, { shipping_address: 'Jubilee Hills' });
    }, /Cannot dispatch order with pending unreserved items/);
  });

  it('G4: confirms POD with reference and stamps pod_confirmed_at date', () => {
    const engine = new OrderLifecycleEngine();
    const q = engine.createQuotation({
      customer_name: 'GMR Aero',
      total_amount: 850000,
      status: 'Customer Accepted',
    });
    const items = [{ product_name: 'Laser Projector', quantity: 1, reserved_quantity: 1 }];
    const order = engine.createSalesOrderFromQuotation(q.id, items);
    engine.createDeliveryChallan(order.order_number, { shipping_address: 'Shamshabad Airport' });

    const confirmed = engine.confirmPOD('DC260001', 'POD-GMR-88219');
    assert.equal(confirmed.status, 'POD Confirmed');
    assert.equal(confirmed.pod_reference, 'POD-GMR-88219');
    assert.ok(confirmed.pod_confirmed_at);

    // Linked order is updated to Installed & Handed Over
    assert.equal(order.dispatch_status, 'Installed & Handed Over');
  });

  it('G5: prevents invoicing or dispatching a cancelled Sales Order', () => {
    const engine = new OrderLifecycleEngine();
    const q = engine.createQuotation({ customer_name: 'Client X', total_amount: 50000, status: 'Customer Accepted' });
    const order = engine.createSalesOrderFromQuotation(q.id, [{ product_name: 'UPS', quantity: 1, reserved_quantity: 1 }]);

    order.status = 'Cancelled';

    assert.throws(() => {
      engine.createDeliveryChallan(order.order_number, { shipping_address: 'Secunderabad' });
    }, /Cannot dispatch a cancelled order/);

    assert.throws(() => {
      engine.createInvoiceFromOrder(order.order_number);
    }, /Cannot invoice a cancelled order/);
  });

  it('G6: tracks transporter and vehicle details on delivery challan', () => {
    const engine = new OrderLifecycleEngine();
    const q = engine.createQuotation({ customer_name: 'Client Y', total_amount: 100000, status: 'Customer Accepted' });
    const order = engine.createSalesOrderFromQuotation(q.id, [{ product_name: 'Display', quantity: 1, reserved_quantity: 1 }]);

    const dc = engine.createDeliveryChallan(order.order_number, {
      shipping_address: 'HITEC City, Madhapur',
      transporter_name: 'VRL Logistics',
      vehicle_number: 'KA 25 AB 9988',
      eway_bill_number: 'EWB-26-90812938',
      dispatched_by_name: 'Dheeraj',
    });

    assert.equal(dc.transporter_name, 'VRL Logistics');
    assert.equal(dc.vehicle_number, 'KA 25 AB 9988');
    assert.equal(dc.eway_bill_number, 'EWB-26-90812938');
    assert.equal(dc.dispatched_by_name, 'Dheeraj');
  });
});
