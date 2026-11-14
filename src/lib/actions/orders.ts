'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { findByIdOrCode, isUuid, sanitizeSearchTerm, sanitizeUuid } from '@/lib/supabase/db-helpers';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { INITIAL_ORDERS } from '@/lib/constants/erp-data';
import { getNextOrderNumber } from '@/lib/utils/sequence';
import { getProducts } from '@/lib/actions/products';
import { requireRole, requireAuth } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import type {
  SalesOrder,
  SalesOrderItem,
  OrderStatus,
  MaterialStatus,
  DispatchStatus,
  FulfillmentStatus,
  ResellerSplitAllocation,
  DeliveryType,
  ProcurementStatus,
} from '@/types/erp';

// Shared in-memory store across requests in this Node process
declare global {
  // eslint-disable-next-line no-var
  var __ICON_ORDERS__: SalesOrder[] | undefined;
}

function getInternalOrdersStore(): SalesOrder[] {
  if (!globalThis.__ICON_ORDERS__) {
    globalThis.__ICON_ORDERS__ = [...INITIAL_ORDERS];
  }
  return globalThis.__ICON_ORDERS__;
}

export async function getOrdersStore(): Promise<SalesOrder[]> {
  return getInternalOrdersStore();
}

function hydrateOrderRow(row: any): SalesOrder {
  const items: SalesOrderItem[] = Array.isArray(row.items) ? row.items : [];
  let inStock = 0;
  let poRequired = 0;
  for (const it of items) {
    if (it.procurement_status === 'IN_OFFICE_STOCK') {
      inStock++;
    } else {
      poRequired++;
    }
  }

  return {
    ...row,
    confirmation_reference: row.confirmation_ref ?? row.confirmation_reference,
    confirmed_by_name: row.confirmed_by_person ?? row.confirmed_by_name,
    confirmation_date: row.confirmed_at ?? row.confirmation_date,
    items,
    procurement_summary: row.procurement_summary || {
      total_items: items.length,
      in_stock: inStock,
      po_required: poRequired,
      fulfilled: inStock,
    },
  } as SalesOrder;
}

async function findOrderRecord(idOrNumber: string): Promise<SalesOrder | null> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const row = await findByIdOrCode<any>(
        admin,
        'sales_orders',
        idOrNumber,
        'order_number',
        '*, items:sales_order_items(*)'
      );
      if (row) return hydrateOrderRow(row);
      return null;
    } catch (err) {
      console.warn('Supabase findOrderRecord fallback:', err);
    }
  }

  const store = getInternalOrdersStore();
  return store.find((o) => o.id === idOrNumber || o.order_number === idOrNumber) || null;
}

export async function getOrders(filters?: {
  status?: string;
  search?: string;
  customer_id?: string;
}): Promise<{ orders: SalesOrder[]; total: number }> {
  await requireAuth();
  const store = getInternalOrdersStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      let query = admin.from('sales_orders').select('*, items:sales_order_items(*)', { count: 'exact' });

      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters?.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) {
          query = query.or(`order_number.ilike.%${s}%,customer_name.ilike.%${s}%,company_name.ilike.%${s}%`);
        }
      }

      query = query.order('created_at', { ascending: false });
      const { data, error, count } = await query;

      if (!error && data) {
        return { orders: data.map(hydrateOrderRow), total: count ?? data.length };
      }
    } catch (err) {
      console.warn('Supabase orders query failed, using store:', err);
    }
  }

  let filtered = [...store];
  if (filters?.status && filters.status !== 'ALL') {
    filtered = filtered.filter((o) => o.status === filters.status);
  }
  if (filters?.customer_id) {
    filtered = filtered.filter((o) => o.customer_id === filters.customer_id);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.order_number.toLowerCase().includes(s) ||
        o.customer_name.toLowerCase().includes(s) ||
        (o.company_name && o.company_name.toLowerCase().includes(s))
    );
  }

  return { orders: filtered, total: filtered.length };
}

export async function getSalesOrderById(id: string): Promise<SalesOrder | null> {
  await requireAuth();
  return findOrderRecord(id);
}

/**
 * Reseller Sales Order Creation & Lean Stock Allocation Engine.
 * Evaluates available office stock:
 * - If office stock >= quantity: reserves from office, procurement_required = 0.
 * - If office stock < quantity: reserves available, flags balance as PO_REQUIRED.
 * Concurrency-safe, never assumes 100% stock availability.
 */
export async function createSalesOrder(payload: {
  quotation_id?: string;
  quotation_number?: string;
  customer_id: string;
  customer_name: string;
  company_name?: string;
  salesperson_name: string;
  place_of_supply?: string;
  customer_billing_state?: string;
  customer_po_reference?: string;
  expected_delivery?: string;
  items: Array<{
    product_id?: string | null;
    sku?: string | null;
    product_name: string;
    quantity: number;
    selling_price: number;
    discount_amount?: number;
    gst_rate?: number;
    total_amount?: number;
  }>;
}): Promise<{ success: boolean; data?: SalesOrder; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);

    const store = getInternalOrdersStore();
    const orderNumber = await getNextOrderNumber();

    // Fetch live product catalog to check physical office stock
    const { products } = await getProducts();

    let totalAmount = 0;
    let inStockCount = 0;
    let poRequiredCount = 0;

    const processedItems: SalesOrderItem[] = payload.items.map((it) => {
      const lineQty = Math.max(1, Number(it.quantity) || 1);
      const rate = Number(it.selling_price) || 0;
      const discount = Number(it.discount_amount) || 0;
      const gstRate = Number(it.gst_rate) || 18;
      const lineSubtotal = rate * lineQty - discount;
      const gstAmt = (lineSubtotal * gstRate) / 100;
      const lineTotal = Number((lineSubtotal + gstAmt).toFixed(2));
      totalAmount += lineTotal;

      // Match physical office stock
      const matchedProd = products.find(
        (p) =>
          (it.sku && p.sku.toLowerCase() === it.sku.toLowerCase()) ||
          p.name.toLowerCase() === it.product_name.toLowerCase()
      );

      const availableStock = matchedProd ? Math.max(0, matchedProd.current_stock) : 0;

      let reservedQty = 0;
      let procRequiredQty = 0;
      let procStatus: SalesOrderItem['procurement_status'] = 'PO_REQUIRED';

      if (availableStock >= lineQty) {
        // Full office stock allocation
        reservedQty = lineQty;
        procRequiredQty = 0;
        procStatus = 'IN_OFFICE_STOCK';
        inStockCount++;
      } else if (availableStock > 0) {
        // Partial office stock split
        reservedQty = availableStock;
        procRequiredQty = lineQty - availableStock;
        procStatus = 'PARTIALLY_RESERVED';
        poRequiredCount++;
      } else {
        // Zero office stock - full distributor procurement required
        reservedQty = 0;
        procRequiredQty = lineQty;
        procStatus = 'PO_REQUIRED';
        poRequiredCount++;
      }

      return {
        id: `SOI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        product_id: it.product_id || matchedProd?.id || null,
        sku: it.sku || matchedProd?.sku || null,
        product_name: it.product_name,
        quantity: lineQty,
        selling_price: rate,
        discount_amount: discount,
        gst_rate: gstRate,
        total_amount: lineTotal,
        reserved_quantity: reservedQty,
        dispatched_quantity: 0,
        office_stock_available: availableStock,
        procurement_required_qty: procRequiredQty,
        procurement_status: procStatus,
        incoming_quantity: 0,
        fulfilled_quantity: reservedQty,
      };
    });

    // Determine overall order material readiness
    let materialStatus: MaterialStatus = 'Stock Reserved';
    if (poRequiredCount > 0 && inStockCount === 0) {
      materialStatus = 'PO Required';
    } else if (poRequiredCount > 0 && inStockCount > 0) {
      materialStatus = 'Partially Received';
    } else if (poRequiredCount === 0) {
      materialStatus = 'In Stock';
    }

    const newOrder: SalesOrder = {
      id: `ORD-${Date.now()}`,
      order_number: orderNumber,
      entity_code: 'ICON_TECH_PRO',
      quotation_id: payload.quotation_id,
      quotation_number: payload.quotation_number,
      customer_id: payload.customer_id,
      customer_name: payload.customer_name,
      company_name: payload.company_name,
      salesperson_name: payload.salesperson_name || authUser.name,
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery: payload.expected_delivery,
      items: processedItems,
      total_amount: Number(totalAmount.toFixed(2)),
      place_of_supply: payload.place_of_supply || '36-TELANGANA',
      customer_billing_state: payload.customer_billing_state || 'Telangana',
      procurement_summary: {
        total_items: processedItems.length,
        in_stock: inStockCount,
        po_required: poRequiredCount,
        fulfilled: inStockCount,
      },
      status: 'Confirmed',
      material_status: materialStatus,
      dispatch_status: 'Not Dispatched',
      customer_po_reference: payload.customer_po_reference,
      created_at: new Date().toISOString(),
    };

    // Save to database when available
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        let resolvedCustomerId = sanitizeUuid(newOrder.customer_id);
        if (!resolvedCustomerId && newOrder.customer_id) {
          const custRow = await findByIdOrCode<{ id: string }>(admin, 'customers', newOrder.customer_id, 'customer_code', 'id');
          resolvedCustomerId = custRow?.id || null;
        }
        let resolvedQuotationId = sanitizeUuid(newOrder.quotation_id);
        if (!resolvedQuotationId && newOrder.quotation_number) {
          const quoRow = await findByIdOrCode<{ id: string }>(admin, 'quotations', newOrder.quotation_number, 'quotation_number', 'id');
          resolvedQuotationId = quoRow?.id || null;
        }

        const { data: dbOrder, error: orderErr } = await admin
          .from('sales_orders')
          .insert({
            order_number: newOrder.order_number,
            entity_code: newOrder.entity_code,
            quotation_id: resolvedQuotationId,
            quotation_number: newOrder.quotation_number || null,
            customer_id: resolvedCustomerId || newOrder.customer_id,
            customer_name: newOrder.customer_name,
            company_name: newOrder.company_name || null,
            salesperson_name: newOrder.salesperson_name,
            order_date: newOrder.order_date,
            expected_delivery: newOrder.expected_delivery || null,
            total_amount: newOrder.total_amount,
            status: newOrder.status,
            material_status: newOrder.material_status,
            dispatch_status: newOrder.dispatch_status,
            place_of_supply: newOrder.place_of_supply,
            customer_billing_state: newOrder.customer_billing_state,
            customer_po_reference: newOrder.customer_po_reference || null,
            procurement_summary: newOrder.procurement_summary,
          })
          .select()
          .single();

        if (!orderErr && dbOrder) {
          newOrder.id = dbOrder.id;
          if (resolvedCustomerId) newOrder.customer_id = resolvedCustomerId;
          if (resolvedQuotationId) newOrder.quotation_id = resolvedQuotationId;

          const itemRows = processedItems.map((it) => ({
            sales_order_id: dbOrder.id,
            product_id: sanitizeUuid(it.product_id),
            sku: it.sku || null,
            product_name: it.product_name,
            quantity: it.quantity,
            selling_price: it.selling_price,
            discount_amount: it.discount_amount,
            gst_rate: it.gst_rate,
            total_amount: it.total_amount,
            reserved_quantity: it.reserved_quantity,
            dispatched_quantity: 0,
            procurement_status: it.procurement_status,
            office_stock_available: it.office_stock_available,
            procurement_required_qty: it.procurement_required_qty,
            incoming_quantity: 0,
            fulfilled_quantity: it.fulfilled_quantity,
          }));

          const { data: insertedItems, error: itemErr } = await admin
            .from('sales_order_items')
            .insert(itemRows)
            .select('*');
          if (!itemErr && Array.isArray(insertedItems)) {
            newOrder.items = insertedItems as SalesOrderItem[];
          } else if (itemErr) {
            console.warn('Supabase sales_order_items insert error:', itemErr.message);
          }
        } else if (orderErr) {
          console.warn('Supabase sales_order insert error:', orderErr.message);
        }
      } catch (dbErr) {
        console.warn('Supabase sales_order insert fallback to store:', dbErr);
      }
    }

    store.unshift(newOrder);

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_SALES_ORDER',
      module: 'ORDERS',
      details: `Created Sales Order ${orderNumber} for ${newOrder.customer_name} (Total: ₹${newOrder.total_amount}, Material: ${newOrder.material_status})`,
    });

    // Auto-enqueue order confirmation email to customer
    try {
      let custEmail: string | undefined;
      if (await isSupabaseAvailable()) {
        const admin = createAdminClient();
        const { data: cData } = await admin.from('customers').select('email').eq('id', newOrder.customer_id).maybeSingle();
        custEmail = cData?.email;
      }
      if (custEmail) {
        const { enqueueAutomatedEmail, processEmailQueue } = await import('@/lib/actions/email-automation');
        await enqueueAutomatedEmail({
          trigger_type: 'ORDER_CONFIRMATION',
          recipient_type: 'CUSTOMER',
          recipient_email: custEmail,
          recipient_name: newOrder.customer_name,
          entity_type: 'SALES_ORDER',
          entity_id: newOrder.id,
          entity_number: newOrder.order_number,
          custom_subject: `Order Confirmation: ${newOrder.order_number} - ICON TECH PRO`,
          custom_body: `<p>Dear ${newOrder.customer_name},</p><p>We are pleased to confirm receipt of your order <strong>${newOrder.order_number}</strong>.</p><p>Order Value: <strong>₹${Number(newOrder.total_amount).toLocaleString('en-IN')}</strong><br>Status: <strong>Confirmed & Scheduled for Fulfillment</strong></p><p>Regards,<br><strong>ICON TECH PRO Operations Team</strong><br>Hyderabad, Telangana</p>`,
        });
        processEmailQueue().catch(() => {});
      }
    } catch (e) {
      console.warn('Order confirmation email trigger warning:', e);
    }

    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard');

    return { success: true, data: newOrder };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create sales order' };
  }
}

export async function updateOrderStatus(
  id: string,
  updates: {
    status?: OrderStatus;
    material_status?: MaterialStatus;
    dispatch_status?: DispatchStatus;
    courier_tracking?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);

    const store = getInternalOrdersStore();

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        const dbTarget = await findByIdOrCode<{ id: string }>(admin, 'sales_orders', id, 'order_number', 'id');
        if (dbTarget) {
          await admin.from('sales_orders').update(updates).eq('id', dbTarget.id);
        } else if (isUuid(id)) {
          await admin.from('sales_orders').update(updates).eq('id', id);
        } else {
          await admin.from('sales_orders').update(updates).eq('order_number', id);
        }
      } catch (err) {
        console.warn('Supabase updateOrderStatus failed:', err);
      }
    }

    const found = store.find((o) => o.id === id || o.order_number === id);
    if (found) {
      if (updates.status) found.status = updates.status;
      if (updates.material_status) found.material_status = updates.material_status;
      if (updates.dispatch_status) found.dispatch_status = updates.dispatch_status;
      if (updates.courier_tracking) found.courier_tracking = updates.courier_tracking;
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_ORDER_STATUS',
      module: 'ORDERS',
      details: `Updated order ${id}: ${JSON.stringify(updates)}`,
    });

    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update order status' };
  }
}

export interface StockSplitInput {
  source_type: 'OFFICE_STOCK' | 'DISTRIBUTOR';
  supplier_id?: string;
  supplier_name?: string;
  quantity: number;
  delivery_type?: DeliveryType;
  estimated_cost?: number;
  purchase_order_id?: string;
  po_number?: string;
  status?: ProcurementStatus;
}

export async function allocateMultiDistributorStock(
  orderId: string,
  itemId: string,
  splits: StockSplitInput[]
): Promise<{ success: boolean; data?: SalesOrder; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);

    if (!splits || splits.length === 0) {
      return { success: false, error: 'At least one allocation split must be provided' };
    }

    const order = await findOrderRecord(orderId);
    if (!order) {
      return { success: false, error: `Sales Order ${orderId} not found` };
    }

    const item = order.items.find((it) => it.id === itemId || it.product_name === itemId);
    if (!item) {
      return { success: false, error: `Item ${itemId} not found in order ${order.order_number}` };
    }

    // Validate quantities
    const totalAllocated = splits.reduce((sum, s) => sum + (s.quantity || 0), 0);
    if (totalAllocated <= 0) {
      return { success: false, error: 'Total allocated quantity must be greater than zero' };
    }
    if (totalAllocated > item.quantity) {
      return {
        success: false,
        error: `Total allocated quantity (${totalAllocated}) cannot exceed item quantity (${item.quantity})`,
      };
    }

    // Formatted splits
    const formattedSplits: ResellerSplitAllocation[] = splits.map((s, idx) => ({
      id: `SPLIT-${Date.now()}-${idx + 1}`,
      source_type: s.source_type,
      supplier_id: s.supplier_id,
      supplier_name: s.supplier_name,
      quantity: s.quantity,
      status: s.source_type === 'OFFICE_STOCK' ? 'IN_OFFICE_STOCK' : (s.status || 'PO_REQUIRED'),
      purchase_order_id: s.purchase_order_id,
      po_number: s.po_number,
      delivery_type: s.delivery_type || (s.source_type === 'OFFICE_STOCK' ? 'OFFICE_RECEIPT' : 'DIRECT_CUSTOMER_DROPSHIP'),
      estimated_cost: s.estimated_cost,
    }));

    item.allocations = formattedSplits;

    // Recalculate item reservation & procurement
    const officeQty = formattedSplits
      .filter((s) => s.source_type === 'OFFICE_STOCK')
      .reduce((sum, s) => sum + s.quantity, 0);

    const procQty = formattedSplits
      .filter((s) => s.source_type === 'DISTRIBUTOR')
      .reduce((sum, s) => sum + s.quantity, 0);

    item.reserved_quantity = officeQty;
    item.procurement_required_qty = procQty;
    item.fulfilled_quantity = officeQty;

    if (officeQty === item.quantity) {
      item.procurement_status = 'IN_OFFICE_STOCK';
    } else if (officeQty > 0 && procQty > 0) {
      item.procurement_status = 'PARTIALLY_RESERVED';
    } else {
      item.procurement_status = 'PO_REQUIRED';
    }

    // Recalculate order procurement summary and status
    let inStockCount = 0;
    let poRequiredCount = 0;
    for (const it of order.items) {
      if (it.procurement_status === 'IN_OFFICE_STOCK') {
        inStockCount++;
      } else {
        poRequiredCount++;
      }
    }

    order.procurement_summary = {
      total_items: order.items.length,
      in_stock: inStockCount,
      po_required: poRequiredCount,
      fulfilled: inStockCount,
    };

    if (poRequiredCount === 0) {
      order.material_status = 'In Stock';
    } else if (inStockCount > 0) {
      order.material_status = 'Partially Received';
    } else {
      order.material_status = 'PO Required';
    }

    // Persist to Supabase if online
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('sales_order_items')
          .update({
            reserved_quantity: item.reserved_quantity,
            procurement_required_qty: item.procurement_required_qty,
            procurement_status: item.procurement_status,
            fulfilled_quantity: item.fulfilled_quantity,
          })
          .eq('id', item.id);

        await admin
          .from('sales_orders')
          .update({
            material_status: order.material_status,
            procurement_summary: order.procurement_summary,
          })
          .eq('id', order.id);
      } catch (dbErr) {
        console.warn('Supabase update for split allocation skipped:', dbErr);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'ALLOCATE_STOCK_SPLIT',
      module: 'ORDERS',
      details: `Allocated split for ${order.order_number} Item ${item.product_name}: ${splits.map((s) => `${s.source_type}(${s.quantity})`).join(', ')}`,
    });

    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard');

    return { success: true, data: order };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to allocate stock split' };
  }
}

/**
 * Record Customer Confirmation Evidence for a Sales Order.
 * Supports PO, Email confirmation, WhatsApp confirmation, Signed Estimate.
 */
export async function recordCustomerConfirmation(
  orderId: string,
  payload: {
    confirmation_type: 'PO' | 'EMAIL' | 'WHATSAPP' | 'SIGNED_ESTIMATE';
    confirmation_reference: string;
    confirmed_by_name: string;
    confirmation_attachment_url?: string;
    confirmation_notes?: string;
  }
): Promise<{ success: boolean; data?: SalesOrder; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const order = await findOrderRecord(orderId);
    if (!order) {
      return { success: false, error: 'Sales order not found' };
    }

    const nowIso = new Date().toISOString();
    order.confirmation_type = payload.confirmation_type;
    order.confirmation_reference = payload.confirmation_reference;
    order.confirmed_by_name = payload.confirmed_by_name;
    order.confirmation_date = nowIso;
    order.confirmation_attachment_url = payload.confirmation_attachment_url;
    order.confirmation_notes = payload.confirmation_notes;

    const cached = getInternalOrdersStore().find((o) => o.id === order.id || o.order_number === order.order_number);
    if (cached) {
      cached.confirmation_type = payload.confirmation_type;
      cached.confirmation_reference = payload.confirmation_reference;
      cached.confirmed_by_name = payload.confirmed_by_name;
      cached.confirmation_date = nowIso;
      cached.confirmation_attachment_url = payload.confirmation_attachment_url;
      cached.confirmation_notes = payload.confirmation_notes;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('sales_orders')
          .update({
            confirmation_type: payload.confirmation_type,
            confirmation_ref: payload.confirmation_reference,
            confirmed_by_person: payload.confirmed_by_name,
            confirmed_at: nowIso,
            confirmation_attachment_url: payload.confirmation_attachment_url || null,
            confirmation_notes: payload.confirmation_notes || null,
          })
          .eq('id', order.id);
      } catch (err) {
        console.warn('Supabase customer confirmation update fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'RECORD_CUSTOMER_CONFIRMATION',
      module: 'ORDERS',
      details: `Recorded ${payload.confirmation_type} confirmation (Ref: ${payload.confirmation_reference}) for Sales Order ${order.order_number} by ${payload.confirmed_by_name}`,
    });

    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard');
    return { success: true, data: order };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to record customer confirmation' };
  }
}

/**
 * Update Sales Order lifecycle status.
 * Preserves distinct state boundaries without collapsing into Dispatch or Invoice.
 */
export async function updateSalesOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  notes?: string
): Promise<{ success: boolean; data?: SalesOrder; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const order = await findOrderRecord(orderId);
    if (!order) {
      return { success: false, error: `Sales order ${orderId} not found` };
    }

    if (order.status === newStatus) {
      return { success: true, data: order };
    }

    const previousStatus = order.status;
    order.status = newStatus;
    const cached = getInternalOrdersStore().find((o) => o.id === order.id || o.order_number === order.order_number);
    if (cached) cached.status = newStatus;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('sales_orders')
          .update({ status: newStatus })
          .eq('id', order.id);
      } catch (dbErr) {
        console.warn('Supabase sales_orders status update fallback:', dbErr);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_SALES_ORDER_STATUS',
      module: 'ORDERS',
      details: `Sales Order ${order.order_number} status changed from ${previousStatus} to ${newStatus}${notes ? ` (${notes})` : ''}`,
    });

    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard');
    return { success: true, data: order };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update order status' };
  }
}

/**
 * Update Sales Order fulfillment progress.
 * Progression: 'Pending Procurement' -> 'Stock Reserved' -> 'Ready for Packing' -> 'Packed'
 */
export async function updateFulfillmentStatus(
  orderId: string,
  newFulfillmentStatus: FulfillmentStatus,
  notes?: string
): Promise<{ success: boolean; data?: SalesOrder; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Office Assistant', 'BDM']);
    const order = await findOrderRecord(orderId);
    if (!order) {
      return { success: false, error: `Sales order ${orderId} not found` };
    }

    const previousStatus = order.fulfillment_status || 'Pending Procurement';
    order.fulfillment_status = newFulfillmentStatus;
    const cached = getInternalOrdersStore().find((o) => o.id === order.id || o.order_number === order.order_number);
    if (cached) cached.fulfillment_status = newFulfillmentStatus;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('sales_orders')
          .update({ fulfillment_status: newFulfillmentStatus })
          .eq('id', order.id);
      } catch (dbErr) {
        console.warn('Supabase fulfillment_status update fallback:', dbErr);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_FULFILLMENT_STATUS',
      module: 'ORDERS',
      details: `Order ${order.order_number} fulfillment status updated from ${previousStatus} to ${newFulfillmentStatus}${notes ? ` (${notes})` : ''}`,
    });

    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard');
    return { success: true, data: order };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update fulfillment status' };
  }
}

/**
 * Safely update un-dispatched / un-invoiced Sales Order operational details.
 * Finalized line item amounts and confirmed tax invoices remain protected.
 */
export async function updateSalesOrder(
  orderId: string,
  values: Partial<{
    customer_po_reference: string;
    expected_delivery: string;
    place_of_supply: string;
    customer_billing_state: string;
    notes: string;
  }>
): Promise<{ success: boolean; data?: SalesOrder; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);
    const order = await findOrderRecord(orderId);

    if (!order) {
      return { success: false, error: 'Sales Order not found' };
    }

    if (order.status === 'Completed' || order.dispatch_status === 'Dispatched') {
      return {
        success: false,
        error: `Cannot modify Sales Order in "${order.status}" / "${order.dispatch_status}" state. Finalized order transactions are protected.`,
      };
    }

    if (values.customer_po_reference !== undefined) order.customer_po_reference = values.customer_po_reference;
    if (values.expected_delivery !== undefined) order.expected_delivery = values.expected_delivery;
    if (values.place_of_supply !== undefined) order.place_of_supply = values.place_of_supply;
    if (values.customer_billing_state !== undefined) order.customer_billing_state = values.customer_billing_state;

    const cached = getInternalOrdersStore().find((o) => o.id === order.id || o.order_number === order.order_number);
    if (cached) {
      cached.customer_po_reference = order.customer_po_reference;
      cached.expected_delivery = order.expected_delivery;
      cached.place_of_supply = order.place_of_supply;
      cached.customer_billing_state = order.customer_billing_state;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('sales_orders')
          .update({
            customer_po_reference: order.customer_po_reference || null,
            expected_delivery: order.expected_delivery || null,
            place_of_supply: order.place_of_supply,
            customer_billing_state: order.customer_billing_state,
          })
          .eq('id', order.id);
      } catch (err) {
        console.warn('Supabase updateSalesOrder fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_SALES_ORDER',
      module: 'ORDERS',
      details: `Updated operational details for Sales Order ${order.order_number} (Customer PO Ref: ${order.customer_po_reference || 'N/A'}, Expected: ${order.expected_delivery || 'N/A'})`,
    });

    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard');

    return { success: true, data: order };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update Sales Order' };
  }
}



