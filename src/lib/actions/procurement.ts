'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { INITIAL_SUPPLIERS } from '@/lib/constants/erp-data';
import { incrementProductStock } from '@/lib/actions/products';
import { getNextPurchaseOrderNumber, getNextGRNNumber } from '@/lib/utils/sequence';
import { registerSerials } from '@/lib/actions/serials';
import { getOrders, getOrdersStore } from '@/lib/actions/orders';
import { requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { canViewPurchaseCosts } from '@/lib/utils/margin';
import { logAuditEvent } from '@/lib/audit/logger';
import type {
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  DeliveryType,
  ProductSupplier,
  DistributorRecommendation,
  SupplierEvaluation,
  SupplierQuoteComparisonItem,
  SupplierPerformanceSummary,
} from '@/types/erp';

const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'PO260001',
    po_number: 'ICON/26-27/PO-0001',
    entity_code: 'ICON_TECH_PRO',
    supplier_name: 'Shree Prime Distributors',
    supplier_contact: 'Mitesh Patel (+91 98200 44556)',
    order_date: '2026-09-02',
    expected_delivery: '2026-09-05',
    delivery_type: 'OFFICE_RECEIPT',
    items: [
      {
        product_name: '32GB Server RAM DDR4-3200MHz ECC Registered',
        quantity: 4,
        unit_cost: 11200,
        gst_rate: 18,
        total_cost: 52864,
        received_quantity: 4,
        order_number: 'ICON/26-27/ORD-0001',
      },
    ],
    subtotal: 44800,
    gst_amount: 8064,
    total_amount: 52864,
    status: 'Received',
    created_by_name: 'Dheeraj',
    created_at: '2026-09-02T11:00:00Z',
  },
  {
    id: 'PO260002',
    po_number: 'ICON/26-27/PO-0002',
    entity_code: 'ICON_TECH_PRO',
    supplier_name: 'EduTech Displays India',
    supplier_contact: 'Anil Kumar (+91 99800 77889)',
    order_date: '2026-09-04',
    expected_delivery: '2026-09-08',
    delivery_type: 'DIRECT_CUSTOMER_DROPSHIP',
    consignee_name: 'Sri Sai Hospitals & Diagnostic Center',
    consignee_address: 'Kukatpally Main Road, Hyderabad, 500072',
    items: [
      {
        product_name: '75" Interactive Flat Panel 4K with Android 13 & Stylus',
        quantity: 3,
        unit_cost: 142000,
        gst_rate: 18,
        total_cost: 502680,
        received_quantity: 0,
        order_number: 'ICON/26-27/ORD-0002',
      },
    ],
    subtotal: 426000,
    gst_amount: 76680,
    total_amount: 502680,
    status: 'Issued',
    created_by_name: 'Dheeraj',
    created_at: '2026-09-04T14:00:00Z',
  },
];

// Shared in-memory stores across requests in this Node process
declare global {
  // eslint-disable-next-line no-var
  var __ICON_PURCHASE_ORDERS__: PurchaseOrder[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_SUPPLIERS__: Supplier[] | undefined;
}


const INITIAL_PRODUCT_SUPPLIERS: ProductSupplier[] = [
  {
    id: 'PS-001',
    product_id: 'prod_epson_1',
    product_sku: 'EP-4K-980',
    product_name: 'Epson Home Cinema 4K Laser Projector',
    supplier_id: 'SUP001',
    supplier_name: 'Hyderabad AV Tech Distributors',
    purchase_cost: 72000,
    lead_time_days: 2,
    payment_terms_days: 30,
    is_preferred: true,
    is_backup: false,
    minimum_order_qty: 1,
    availability_status: 'IN_STOCK',
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'PS-002',
    product_id: 'prod_epson_1',
    product_sku: 'EP-4K-980',
    product_name: 'Epson Home Cinema 4K Laser Projector',
    supplier_id: 'SUP002',
    supplier_name: 'Shree Prime Distributors',
    purchase_cost: 73500,
    lead_time_days: 4,
    payment_terms_days: 21,
    is_preferred: false,
    is_backup: true,
    minimum_order_qty: 1,
    availability_status: '2_3_DAYS',
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'PS-003',
    product_id: 'prod_ifp_1',
    product_sku: 'IFP-75-4K',
    product_name: '75" Interactive Flat Panel 4K with Android 13 & Stylus',
    supplier_id: 'SUP003',
    supplier_name: 'EduTech Displays India',
    purchase_cost: 142000,
    lead_time_days: 3,
    payment_terms_days: 45,
    is_preferred: true,
    is_backup: false,
    minimum_order_qty: 1,
    availability_status: 'IN_STOCK',
    created_at: '2026-04-01T00:00:00.000Z',
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __ICON_PRODUCT_SUPPLIERS__: ProductSupplier[] | undefined;
}

function getProductSuppliersStore(): ProductSupplier[] {
  if (!globalThis.__ICON_PRODUCT_SUPPLIERS__) {
    globalThis.__ICON_PRODUCT_SUPPLIERS__ = [...INITIAL_PRODUCT_SUPPLIERS];
  }
  return globalThis.__ICON_PRODUCT_SUPPLIERS__;
}

/**
 * Retrieve distributor master pricing and lead times for products.
 */
export async function getProductSuppliers(productId?: string): Promise<ProductSupplier[]> {
  const store = getProductSuppliersStore();
  if (productId) {
    return store.filter((ps) => ps.product_id === productId || ps.product_sku === productId);
  }
  return store;
}

/**
 * Map product to distributor with pricing, lead time, and preferred/backup status.
 */
export async function setProductSupplier(
  payload: Omit<ProductSupplier, 'id' | 'created_at'>
): Promise<{ success: boolean; data?: ProductSupplier; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const store = getProductSuppliersStore();

    const existingIdx = store.findIndex(
      (ps) => ps.product_id === payload.product_id && ps.supplier_id === payload.supplier_id
    );

    const record: ProductSupplier = {
      ...payload,
      id: existingIdx >= 0 ? store[existingIdx].id : `PS-${Date.now()}`,
      created_at: existingIdx >= 0 ? store[existingIdx].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      store[existingIdx] = record;
    } else {
      store.unshift(record);
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('product_suppliers').upsert({
          product_id: record.product_id,
          product_sku: record.product_sku,
          supplier_id: record.supplier_id,
          supplier_name: record.supplier_name,
          purchase_cost: record.purchase_cost,
          lead_time_days: record.lead_time_days,
          payment_terms_days: record.payment_terms_days,
          is_preferred: record.is_preferred,
          is_backup: record.is_backup,
          availability_status: record.availability_status,
          updated_at: record.updated_at,
        });
      } catch (err) {
        console.warn('Supabase product_suppliers upsert fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'SET_PRODUCT_SUPPLIER',
      module: 'PROCUREMENT',
      details: `Mapped ${record.product_name} to ${record.supplier_name} (Cost: ₹${record.purchase_cost}, Preferred: ${record.is_preferred})`,
    });

    return { success: true, data: record };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to set product supplier' };
  }
}

function getInternalPurchaseOrdersStore(): PurchaseOrder[] {
  if (!globalThis.__ICON_PURCHASE_ORDERS__) {
    globalThis.__ICON_PURCHASE_ORDERS__ = [...INITIAL_PURCHASE_ORDERS];
  }
  return globalThis.__ICON_PURCHASE_ORDERS__;
}

export async function getPurchaseOrdersStore(): Promise<PurchaseOrder[]> {
  return getInternalPurchaseOrdersStore();
}

function getSuppliersStore(): Supplier[] {
  if (!globalThis.__ICON_SUPPLIERS__) {
    globalThis.__ICON_SUPPLIERS__ = [...INITIAL_SUPPLIERS];
  }
  return globalThis.__ICON_SUPPLIERS__;
}

export async function getSuppliers(): Promise<Supplier[]> {
  const store = getSuppliersStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.from('suppliers').select('*').order('supplier_name', { ascending: true });
      if (!error && data && data.length > 0) {
        return data as Supplier[];
      }
    } catch (err) {
      console.warn('Supabase suppliers query failed, using store:', err);
    }
  }

  return store;
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const store = getInternalPurchaseOrdersStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, items:purchase_order_items(*)')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data as PurchaseOrder[];
      }
    } catch (err) {
      console.warn('Supabase purchase orders query failed, using store:', err);
    }
  }

  return store;
}

/**
 * Reseller Backorder Requisition Inspector:
 * Finds all confirmed Sales Order items that require distributor procurement.
 */
export async function getUnfulfilledOrderItems(): Promise<Array<{
  order_id: string;
  order_number: string;
  customer_name: string;
  item_id?: string;
  product_id?: string | null;
  sku?: string | null;
  product_name: string;
  quantity: number;
  reserved_quantity: number;
  procurement_required_qty: number;
  procurement_status: string;
}>> {
  const { orders } = await getOrders();
  const unfulfilled: Array<any> = [];

  for (const order of orders) {
    if (order.status === 'Cancelled' || order.status === 'Completed') continue;

    for (const item of order.items || []) {
      const needed = item.procurement_required_qty || Math.max(0, item.quantity - (item.reserved_quantity || 0));
      if (needed > 0 && item.procurement_status !== 'FULFILLED' && item.procurement_status !== 'DROPSHIPPED') {
        unfulfilled.push({
          order_id: order.id,
          order_number: order.order_number,
          customer_name: order.company_name || order.customer_name,
          item_id: item.id,
          product_id: item.product_id,
          sku: item.sku,
          product_name: item.product_name,
          quantity: item.quantity,
          reserved_quantity: item.reserved_quantity || 0,
          procurement_required_qty: needed,
          procurement_status: item.procurement_status || 'PO_REQUIRED',
        });
      }
    }
  }

  return unfulfilled;
}

/**
 * Consolidated Reseller Purchase Order Creator.
 * Supports:
 * - Single order procurement OR grouping backorders across MULTIPLE Sales Orders.
 * - Delivery mode: OFFICE_RECEIPT vs DIRECT_CUSTOMER_DROPSHIP.
 * - Line item traceability linking each PO item to its source Sales Order item.
 */
export async function createPurchaseOrder(payload: {
  supplier_id?: string;
  supplier_name: string;
  supplier_contact?: string;
  sales_order_id?: string;
  sales_order_number?: string;
  delivery_type?: DeliveryType;
  consignee_customer_id?: string;
  consignee_name?: string;
  consignee_address?: string;
  consignee_contact?: string;
  consignee_phone?: string;
  expected_delivery?: string;
  items: Array<{
    product_id?: string;
    product_name: string;
    quantity: number;
    unit_cost: number;
    gst_rate?: number;
    sales_order_id?: string;
    sales_order_item_id?: string;
    customer_name?: string;
    order_number?: string;
  }>;
  created_by_name?: string;
}): Promise<{ success: boolean; data?: PurchaseOrder; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts', 'BDM']);

    const store = getInternalPurchaseOrdersStore();
    const poNumber = await getNextPurchaseOrderNumber();

    let subtotal = 0;
    let gstAmount = 0;

    const items: PurchaseOrderItem[] = payload.items.map((it) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const cost = Number(it.unit_cost) || 0;
      const lineCost = cost * qty;
      const gstRate = Number(it.gst_rate) || 18;
      const gst = (lineCost * gstRate) / 100;
      subtotal += lineCost;
      gstAmount += gst;

      return {
        id: `POI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: qty,
        unit_cost: cost,
        gst_rate: gstRate,
        total_cost: Number((lineCost + gst).toFixed(2)),
        received_quantity: 0,
        sales_order_id: it.sales_order_id || payload.sales_order_id,
        sales_order_item_id: it.sales_order_item_id,
        customer_name: it.customer_name || payload.consignee_name,
        order_number: it.order_number || payload.sales_order_number,
      };
    });

    const totalAmount = subtotal + gstAmount;

    const newPO: PurchaseOrder = {
      id: `PO-${Date.now()}`,
      po_number: poNumber,
      entity_code: 'ICON_TECH_PRO',
      supplier_id: payload.supplier_id,
      supplier_name: payload.supplier_name,
      supplier_contact: payload.supplier_contact,
      sales_order_id: payload.sales_order_id,
      sales_order_number: payload.sales_order_number,
      delivery_type: payload.delivery_type || 'OFFICE_RECEIPT',
      consignee_customer_id: payload.consignee_customer_id,
      consignee_name: payload.consignee_name,
      consignee_address: payload.consignee_address,
      consignee_contact: payload.consignee_contact,
      consignee_phone: payload.consignee_phone,
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery: payload.expected_delivery,
      items,
      subtotal: Number(subtotal.toFixed(2)),
      gst_amount: Number(gstAmount.toFixed(2)),
      total_amount: Number(totalAmount.toFixed(2)),
      status: 'Issued',
      created_by_name: authUser.name,
      created_at: new Date().toISOString(),
    };

    // Update linked sales order items in store and database
    const ordersStore = await getOrdersStore();
    for (const poLine of items) {
      if (poLine.order_number || poLine.sales_order_id) {
        const order = ordersStore.find(
          (o) => o.order_number === poLine.order_number || o.id === poLine.sales_order_id
        );
        if (order) {
          const soLine = order.items.find(
            (it) => it.id === poLine.sales_order_item_id || it.product_name.toLowerCase() === poLine.product_name.toLowerCase()
          );
          if (soLine) {
            soLine.procurement_status = 'PO_ISSUED';
            soLine.incoming_quantity = (soLine.incoming_quantity || 0) + poLine.quantity;
            soLine.purchase_order_id = newPO.id;
            soLine.po_number = newPO.po_number;
            soLine.supplier_name = newPO.supplier_name;
          }
          if (order.material_status === 'PO Required') {
            order.material_status = 'Partially Received';
          }
        }
      }
    }

    // Persist to database if online
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data: dbPO, error: poErr } = await admin
          .from('purchase_orders')
          .insert({
            po_number: newPO.po_number,
            entity_code: newPO.entity_code,
            supplier_id: newPO.supplier_id || null,
            supplier_name: newPO.supplier_name,
            supplier_contact: newPO.supplier_contact || null,
            order_date: newPO.order_date,
            expected_delivery: newPO.expected_delivery || null,
            subtotal: newPO.subtotal,
            gst_amount: newPO.gst_amount,
            total_amount: newPO.total_amount,
            status: newPO.status,
            created_by_name: newPO.created_by_name,
            sales_order_id: newPO.sales_order_id || null,
            sales_order_number: newPO.sales_order_number || null,
            delivery_type: newPO.delivery_type,
            consignee_customer_id: newPO.consignee_customer_id || null,
            consignee_name: newPO.consignee_name || null,
            consignee_address: newPO.consignee_address || null,
            consignee_contact: newPO.consignee_contact || null,
            consignee_phone: newPO.consignee_phone || null,
          })
          .select()
          .single();

        if (!poErr && dbPO) {
          newPO.id = dbPO.id;

          const itemRows = items.map((it) => ({
            po_id: dbPO.id,
            product_id: it.product_id || null,
            product_name: it.product_name,
            quantity: it.quantity,
            unit_cost: it.unit_cost,
            gst_rate: it.gst_rate,
            total_cost: it.total_cost,
            received_quantity: 0,
            sales_order_id: it.sales_order_id || null,
            sales_order_item_id: it.sales_order_item_id || null,
            customer_name: it.customer_name || null,
            order_number: it.order_number || null,
          }));

          await admin.from('purchase_order_items').insert(itemRows);
        }
      } catch (dbErr) {
        console.warn('Supabase createPurchaseOrder insert failed, fallback:', dbErr);
      }
    }

    store.unshift(newPO);

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_PURCHASE_ORDER',
      module: 'PROCUREMENT',
      details: `Issued ${newPO.delivery_type === 'DIRECT_CUSTOMER_DROPSHIP' ? 'Drop-Ship ' : ''}PO ${poNumber} to ${payload.supplier_name} for ₹${totalAmount} (${items.length} items)`,
    });

    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard');
    return { success: true, data: newPO };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create PO' };
  }
}

/**
 * Receive items against a Purchase Order.
 * Handles both:
 * 1. OFFICE_RECEIPT: Increments physical stock in office and marks linked SO items as RECEIVED.
 * 2. DIRECT_CUSTOMER_DROPSHIP: Confirms POD/distributor delivery direct to customer site WITHOUT inflating office stock.
 */
export async function receivePurchaseOrder(
  poId: string,
  payload: {
    receivedItems: Array<{ product_name: string; received_quantity: number }>;
    isDropShip?: boolean;
    distributor_invoice_number?: string;
    distributor_invoice_date?: string;
    courier_transporter?: string;
    tracking_number?: string;
    proof_of_delivery_ref?: string;
    delivery_date?: string;
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

    const store = getInternalPurchaseOrdersStore();
    const foundPO = store.find((po) => po.id === poId || po.po_number === poId);

    if (!foundPO) {
      return { success: false, error: 'Purchase order not found' };
    }

    const isDropShip = Boolean(foundPO.delivery_type === 'DIRECT_CUSTOMER_DROPSHIP' || payload.isDropShip);
    const ordersStore = await getOrdersStore();

    for (const item of payload.receivedItems) {
      const poLine = foundPO.items.find(
        (i) => i.product_name.toLowerCase() === item.product_name.toLowerCase()
      );
      if (poLine) {
        const remainingToReceive = poLine.quantity - (poLine.received_quantity || 0);
        if (item.received_quantity > remainingToReceive) {
          return {
            success: false,
            error: `Cannot receive ${item.received_quantity} units of ${item.product_name}. Only ${remainingToReceive} remaining on this PO.`,
          };
        }

        poLine.received_quantity = (poLine.received_quantity || 0) + item.received_quantity;

        if (isDropShip) {
          // Direct Drop-Ship: Fulfill linked Sales Order item directly, ZERO office stock inflation
          if (poLine.order_number || poLine.sales_order_id) {
            const order = ordersStore.find(
              (o) => o.order_number === poLine.order_number || o.id === poLine.sales_order_id
            );
            if (order) {
              const soLine = order.items.find(
                (it) => it.id === poLine.sales_order_item_id || it.product_name.toLowerCase() === poLine.product_name.toLowerCase()
              );
              if (soLine) {
                soLine.procurement_status = 'DROPSHIPPED';
                soLine.fulfilled_quantity = (soLine.fulfilled_quantity || 0) + item.received_quantity;
                soLine.incoming_quantity = Math.max(0, (soLine.incoming_quantity || 0) - item.received_quantity);
              }
              order.dispatch_status = 'Dispatched';
              if (payload.tracking_number) {
                order.courier_tracking = `Drop-Ship Tracking: ${payload.tracking_number}`;
              }
            }
          }
        } else {
          // Office Receipt: Increment physical office stock ledger
          const stockResult = await incrementProductStock(
            item.product_name,
            item.received_quantity,
            'PURCHASE_RECEIPT',
            'PO',
            foundPO.po_number,
            `Inward GRN against PO ${foundPO.po_number}`
          );

          if (!stockResult.success) {
            return { success: false, error: stockResult.error || 'Failed to update office stock' };
          }

          // Allocate to linked Sales Order item if applicable
          if (poLine.order_number || poLine.sales_order_id) {
            const order = ordersStore.find(
              (o) => o.order_number === poLine.order_number || o.id === poLine.sales_order_id
            );
            if (order) {
              const soLine = order.items.find(
                (it) => it.id === poLine.sales_order_item_id || it.product_name.toLowerCase() === poLine.product_name.toLowerCase()
              );
              if (soLine) {
                soLine.procurement_status = 'RECEIVED';
                soLine.reserved_quantity = (soLine.reserved_quantity || 0) + item.received_quantity;
                soLine.fulfilled_quantity = (soLine.fulfilled_quantity || 0) + item.received_quantity;
                soLine.incoming_quantity = Math.max(0, (soLine.incoming_quantity || 0) - item.received_quantity);
              }
            }
          }
        }
      }
    }

    // Save drop-ship delivery / invoice metadata
    if (payload.distributor_invoice_number) foundPO.distributor_invoice_number = payload.distributor_invoice_number;
    if (payload.distributor_invoice_date) foundPO.distributor_invoice_date = payload.distributor_invoice_date;
    if (payload.courier_transporter) foundPO.courier_transporter = payload.courier_transporter;
    if (payload.tracking_number) foundPO.tracking_number = payload.tracking_number;
    if (payload.proof_of_delivery_ref) foundPO.proof_of_delivery_ref = payload.proof_of_delivery_ref;
    if (payload.delivery_date) foundPO.delivery_date = payload.delivery_date;

    // Update PO status
    const totalOrdered = foundPO.items.reduce((s, i) => s + i.quantity, 0);
    const totalReceived = foundPO.items.reduce((s, i) => s + (i.received_quantity || 0), 0);

    if (totalReceived >= totalOrdered) {
      foundPO.status = 'Received';
    } else if (totalReceived > 0) {
      foundPO.status = 'Partially Received';
    }

    await logAuditEvent({
      userName: authUser.name,
      action: isDropShip ? 'CONFIRM_DROPSHIP_DELIVERY' : 'RECEIVE_PURCHASE_ORDER',
      module: 'PROCUREMENT',
      details: `${isDropShip ? 'Confirmed Drop-Ship POD' : 'Received Inward GRN'} on PO ${foundPO.po_number}: ${totalReceived}/${totalOrdered} units (${foundPO.status})`,
    });

    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `Successfully ${isDropShip ? 'recorded drop-ship delivery of' : 'received'} ${totalReceived}/${totalOrdered} units.`,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to process PO receipt' };
  }
}

/**
 * Intelligent Distributor Recommendation Engine.
 * Evaluates multiple authorized distributors for a product based on:
 * 1. Purchase cost (lower is better)
 * 2. Lead time vs required date (shorter is better)
 * 3. Stock availability status ('IN_STOCK' > '2_3_DAYS' > 'BACKORDER')
 * 4. Preferred distributor bonus flag (+15 points)
 * 5. Minimum Order Quantity (MOQ) compatibility
 *
 * Strictly masks purchase costs if called by unauthorized roles.
 * Does NOT place PO automatically; returns recommendation for human approval.
 */
export async function recommendDistributor(params: {
  product_id_or_name: string;
  required_qty: number;
  required_date?: string;
}): Promise<{
  success: boolean;
  recommendation?: DistributorRecommendation;
  error?: string;
}> {
  try {
    const authUser = await getAuthenticatedUser();
    const userRole = authUser?.role || 'Sales Executive';
    const showCost = canViewPurchaseCosts(userRole);

    const suppliersStore = getProductSuppliersStore();
    const query = params.product_id_or_name.toLowerCase().trim();

    const matches = suppliersStore.filter(
      (ps) =>
        ps.product_id.toLowerCase() === query ||
        (ps.product_sku && ps.product_sku.toLowerCase() === query) ||
        ps.product_name.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      return { success: false, error: `No supplier mappings found for product "${params.product_id_or_name}"` };
    }

    const lowestCost = Math.min(...matches.map((m) => m.purchase_cost));

    const scored = matches.map((m) => {
      let costScore = 0;
      if (m.purchase_cost > 0) {
        costScore = Math.max(0, 40 * (lowestCost / m.purchase_cost));
      }

      let leadTimeScore = 0;
      if (m.lead_time_days <= 2) leadTimeScore = 25;
      else if (m.lead_time_days <= 4) leadTimeScore = 18;
      else if (m.lead_time_days <= 7) leadTimeScore = 10;
      else leadTimeScore = 5;

      let availScore = 0;
      if (m.availability_status === 'IN_STOCK') availScore = 20;
      else if (m.availability_status === '2_3_DAYS') availScore = 10;

      const preferredBonus = m.is_preferred ? 15 : 0;
      const moqPenalty = (m.minimum_order_qty && m.minimum_order_qty > params.required_qty) ? -15 : 0;
      const totalScore = Math.round(costScore + leadTimeScore + availScore + preferredBonus + moqPenalty);

      return {
        supplier_id: m.supplier_id,
        supplier_name: m.supplier_name,
        purchase_cost: showCost ? m.purchase_cost : 0,
        lead_time_days: m.lead_time_days,
        availability_status: m.availability_status,
        is_preferred: m.is_preferred,
        score: totalScore,
      };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    const winner = scored[0];
    const alternates = scored.slice(1);

    const recommendation: DistributorRecommendation = {
      product_id: matches[0].product_id,
      product_name: matches[0].product_name,
      required_qty: params.required_qty,
      required_date: params.required_date,
      recommended_supplier_id: winner.supplier_id,
      recommended_supplier_name: winner.supplier_name,
      purchase_cost: winner.purchase_cost,
      lead_time_days: winner.lead_time_days,
      is_preferred: winner.is_preferred,
      score: winner.score,
      reason: `Recommended based on ${winner.is_preferred ? 'Preferred Distributor agreement, ' : ''}${winner.lead_time_days} days lead time, and ${winner.availability_status} availability.`,
      alternate_options: alternates,
    };

    return { success: true, recommendation };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to recommend distributor' };
  }
}

// Global store for supplier evaluations
declare global {
  // eslint-disable-next-line no-var
  var __ICON_SUPPLIER_EVALUATIONS__: SupplierEvaluation[] | undefined;
}

const INITIAL_SUPPLIER_EVALUATIONS: SupplierEvaluation[] = [
  {
    id: 'SE-001',
    supplier_id: 'SUP001',
    supplier_name: 'Hyderabad AV Tech Distributors',
    evaluation_period: '2026-Q1',
    on_time_delivery_score: 96.5,
    quality_score: 99.0,
    pricing_score: 92.0,
    support_score: 95.0,
    overall_score: 95.6,
    status: 'PREFERRED',
    total_orders_evaluated: 12,
    total_spend_evaluated: 1450000,
    notes: 'Outstanding technical support, reliable stock availability, fast local Hyderabad delivery.',
    evaluated_by_name: 'Dheeraj',
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'SE-002',
    supplier_id: 'SUP002',
    supplier_name: 'Shree Prime Distributors',
    evaluation_period: '2026-Q1',
    on_time_delivery_score: 94.0,
    quality_score: 98.5,
    pricing_score: 90.0,
    support_score: 91.0,
    overall_score: 93.4,
    status: 'PREFERRED',
    total_orders_evaluated: 8,
    total_spend_evaluated: 890000,
    notes: 'Good payment terms (21 days), consistently provides authentic server components.',
    evaluated_by_name: 'Dheeraj',
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'SE-003',
    supplier_id: 'SUP003',
    supplier_name: 'EduTech Displays India',
    evaluation_period: '2026-Q1',
    on_time_delivery_score: 91.0,
    quality_score: 97.0,
    pricing_score: 88.0,
    support_score: 89.0,
    overall_score: 91.2,
    status: 'ACTIVE',
    total_orders_evaluated: 5,
    total_spend_evaluated: 1850000,
    notes: 'Primary distributor for interactive displays; transit times from Bangalore occasionally 3-4 days.',
    evaluated_by_name: 'Dheeraj',
    created_at: '2026-04-01T00:00:00.000Z',
  },
];

function getSupplierEvaluationsStore(): SupplierEvaluation[] {
  if (!globalThis.__ICON_SUPPLIER_EVALUATIONS__) {
    globalThis.__ICON_SUPPLIER_EVALUATIONS__ = [...INITIAL_SUPPLIER_EVALUATIONS];
  }
  return globalThis.__ICON_SUPPLIER_EVALUATIONS__;
}

/**
 * Compare supplier price offers and terms for a required product or requisition.
 * Evaluates pricing (taxable + GST), lead times, availability, and computes ranking.
 */
export async function compareSupplierQuotes(params: {
  product_id_or_name: string;
  quantity: number;
  target_date?: string;
}): Promise<{
  success: boolean;
  data?: {
    product_name: string;
    quantity: number;
    quotes: SupplierQuoteComparisonItem[];
    recommended_quote?: SupplierQuoteComparisonItem;
  };
  error?: string;
}> {
  try {
    const authUser = await getAuthenticatedUser();
    const userRole = authUser?.role || 'Sales Executive';
    const showCost = canViewPurchaseCosts(userRole);

    const suppliersStore = getProductSuppliersStore();
    const allSuppliers = await getSuppliers();
    const query = params.product_id_or_name.toLowerCase().trim();
    const qty = Math.max(1, Number(params.quantity) || 1);

    let matches = suppliersStore.filter(
      (ps) =>
        ps.product_id.toLowerCase() === query ||
        (ps.product_sku && ps.product_sku.toLowerCase() === query) ||
        ps.product_name.toLowerCase().includes(query)
    );

    // Fallback: If no direct mapping exists, create baseline quote options from active suppliers
    if (matches.length === 0) {
      matches = allSuppliers.slice(0, 3).map((sup, idx) => ({
        id: `PS-AUTO-${idx}`,
        product_id: params.product_id_or_name,
        product_sku: params.product_id_or_name,
        product_name: params.product_id_or_name,
        supplier_id: sup.id,
        supplier_name: sup.supplier_name,
        purchase_cost: 25000 + idx * 1200,
        lead_time_days: 2 + idx * 2,
        payment_terms_days: sup.payment_terms_days || 30,
        is_preferred: idx === 0,
        is_backup: idx > 0,
        minimum_order_qty: 1,
        availability_status: idx === 0 ? 'IN_STOCK' : '2_3_DAYS',
        created_at: new Date().toISOString(),
      }));
    }

    const lowestCost = Math.min(...matches.map((m) => m.purchase_cost));
    const fastestDays = Math.min(...matches.map((m) => m.lead_time_days));

    const quotes: SupplierQuoteComparisonItem[] = matches.map((m) => {
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
        product_id: m.product_id,
        product_sku: m.product_sku,
        product_name: m.product_name,
        quantity: qty,
        unit_cost: unitCost,
        gst_rate: gstRate,
        taxable_amount: taxable,
        gst_amount: gstAmt,
        total_cost: totalCost,
        lead_time_days: m.lead_time_days,
        payment_terms_days: m.payment_terms_days || 30,
        availability_status: m.availability_status,
        is_preferred: m.is_preferred,
        score: totalScore,
        is_best_price: m.purchase_cost === lowestCost,
        is_fastest: m.lead_time_days === fastestDays,
        is_recommended: false, // will set below
      };
    });

    quotes.sort((a, b) => b.score - a.score);
    if (quotes.length > 0) {
      quotes[0].is_recommended = true;
    }

    return {
      success: true,
      data: {
        product_name: matches[0]?.product_name || params.product_id_or_name,
        quantity: qty,
        quotes,
        recommended_quote: quotes[0],
      },
    };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to compare supplier quotes' };
  }
}

/**
 * Retrieve comprehensive supplier performance metrics, scorecards, and tiering.
 */
export async function getSupplierPerformance(supplierId?: string): Promise<{
  success: boolean;
  data?: SupplierPerformanceSummary[];
  error?: string;
}> {
  try {
    const allSuppliers = await getSuppliers();
    const pos = await getPurchaseOrders();
    const evaluations = getSupplierEvaluationsStore();

    const targetSuppliers = supplierId
      ? allSuppliers.filter((s) => s.id === supplierId || s.supplier_name.toLowerCase() === supplierId.toLowerCase())
      : allSuppliers;

    const summaries: SupplierPerformanceSummary[] = targetSuppliers.map((sup) => {
      const supplierPos = pos.filter(
        (po) =>
          po.supplier_id === sup.id ||
          po.supplier_name.toLowerCase() === sup.supplier_name.toLowerCase()
      );

      const totalPos = supplierPos.length;
      const nonCancelled = supplierPos.filter((po) => po.status !== 'Cancelled');
      const totalSpend = nonCancelled.reduce((sum, po) => sum + (po.total_amount || 0), 0);
      const fulfilledPos = supplierPos.filter((po) => po.status === 'Received' || po.status === 'Closed').length;
      const pendingPos = supplierPos.filter((po) => po.status === 'Issued' || po.status === 'Partially Received').length;
      const cancelledPos = supplierPos.filter((po) => po.status === 'Cancelled').length;

      // Calculate on-time delivery rate
      let onTimeCount = 0;
      let evaluatedDeliveries = 0;
      for (const po of supplierPos) {
        if (po.status === 'Received' || po.status === 'Closed') {
          evaluatedDeliveries++;
          if (po.on_time_status === 'ON_TIME' || !po.on_time_status) {
            onTimeCount++;
          }
        }
      }
      const onTimeRate = evaluatedDeliveries > 0 ? Number(((onTimeCount / evaluatedDeliveries) * 100).toFixed(1)) : 95.0;

      // Find recorded evaluations if any
      const evalRecord = evaluations.find(
        (e) => e.supplier_id === sup.id || e.supplier_name.toLowerCase() === sup.supplier_name.toLowerCase()
      );

      const qualityRate = evalRecord ? evalRecord.quality_score : 98.5;
      const avgLeadTime = 3.0; // Benchmark average days

      // Overall composite rating
      const spendBonus = totalSpend > 1000000 ? 15 : totalSpend > 0 ? 10 : 5;
      const compositeRating = Math.min(
        100,
        Math.round(onTimeRate * 0.45 + qualityRate * 0.40 + spendBonus)
      );

      let tier: SupplierPerformanceSummary['tier'] = 'TIER_2_STANDARD';
      let recommendation = 'Standard approved supplier with stable delivery profile.';

      if (compositeRating >= 90) {
        tier = 'TIER_1_PREFERRED';
        recommendation = 'Preferred tier vendor with outstanding delivery punctuality and SLA compliance.';
      } else if (compositeRating >= 75) {
        tier = 'TIER_2_STANDARD';
        recommendation = 'Reliable distributor suitable for regular backorder and drop-ship fulfillment.';
      } else if (compositeRating >= 60) {
        tier = 'TIER_3_WATCHLIST';
        recommendation = 'Performance under monitoring. Request price verification and track lead times closely.';
      } else {
        tier = 'TIER_4_RESTRICTED';
        recommendation = 'Restricted supplier. Requires management approval before issuing purchase orders.';
      }

      return {
        supplier_id: sup.id,
        supplier_name: sup.supplier_name,
        total_pos: totalPos,
        total_spend: Number(totalSpend.toFixed(2)),
        fulfilled_pos: fulfilledPos,
        pending_pos: pendingPos,
        cancelled_pos: cancelledPos,
        on_time_delivery_rate: onTimeRate,
        quality_acceptance_rate: qualityRate,
        average_lead_time_days: avgLeadTime,
        overall_rating: compositeRating,
        tier,
        recommendation,
      };
    });

    summaries.sort((a, b) => b.overall_rating - a.overall_rating);

    return { success: true, data: summaries };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to get supplier performance' };
  }
}

/**
 * Record a formal supplier evaluation scorecard.
 */
export async function recordSupplierEvaluation(
  payload: Omit<SupplierEvaluation, 'id' | 'created_at'>
): Promise<{ success: boolean; data?: SupplierEvaluation; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const store = getSupplierEvaluationsStore();

    const overall = Number(
      (
        payload.on_time_delivery_score * 0.35 +
        payload.quality_score * 0.30 +
        payload.pricing_score * 0.20 +
        payload.support_score * 0.15
      ).toFixed(2)
    );

    const record: SupplierEvaluation = {
      ...payload,
      id: `SE-${Date.now()}`,
      overall_score: overall,
      evaluated_by_name: authUser.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    store.unshift(record);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('supplier_evaluations').insert({
          supplier_id: record.supplier_id,
          supplier_name: record.supplier_name,
          evaluation_period: record.evaluation_period,
          on_time_delivery_score: record.on_time_delivery_score,
          quality_score: record.quality_score,
          pricing_score: record.pricing_score,
          support_score: record.support_score,
          overall_score: record.overall_score,
          status: record.status,
          total_orders_evaluated: record.total_orders_evaluated,
          total_spend_evaluated: record.total_spend_evaluated,
          notes: record.notes || null,
          evaluated_by_name: record.evaluated_by_name,
        });
      } catch (dbErr) {
        console.warn('Supabase supplier_evaluations insert fallback:', dbErr);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'RECORD_SUPPLIER_EVALUATION',
      module: 'PROCUREMENT',
      details: `Recorded scorecard for ${record.supplier_name} (${record.evaluation_period}): Score ${record.overall_score}/100 [${record.status}]`,
    });

    revalidatePath('/dashboard/purchases');
    return { success: true, data: record };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to record supplier evaluation' };
  }
}

/**
 * Update Purchase Order status with strict lifecycle progression and audit logging.
 */
export async function updatePurchaseOrderStatus(
  poId: string,
  newStatus: 'Draft' | 'Issued' | 'Partially Received' | 'Received' | 'Closed' | 'Cancelled',
  notes?: string
): Promise<{ success: boolean; data?: PurchaseOrder; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts', 'BDM']);
    const store = getInternalPurchaseOrdersStore();

    const po = store.find((p) => p.id === poId || p.po_number === poId);
    if (!po) {
      return { success: false, error: `Purchase order ${poId} not found` };
    }

    if (po.status === newStatus) {
      return { success: true, data: po };
    }

    // Validation: Cannot cancel if items already received
    if (newStatus === 'Cancelled') {
      const receivedTotal = po.items.reduce((sum, it) => sum + (it.received_quantity || 0), 0);
      if (receivedTotal > 0) {
        return {
          success: false,
          error: `Cannot cancel PO ${po.po_number}. It has ${receivedTotal} items already received.`,
        };
      }
    }

    const previousStatus = po.status;
    po.status = newStatus;
    if (notes) {
      po.notes = po.notes ? `${po.notes}\n${notes}` : notes;
    }

    if (newStatus === 'Closed') {
      po.closed_at = new Date().toISOString();
      po.closed_by_name = authUser.name;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('purchase_orders')
          .update({
            status: po.status,
            notes: po.notes || null,
            closed_at: po.closed_at || null,
            closed_by_name: po.closed_by_name || null,
          })
          .eq('id', po.id);
      } catch (dbErr) {
        console.warn('Supabase purchase_orders status update fallback:', dbErr);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_PURCHASE_ORDER_STATUS',
      module: 'PROCUREMENT',
      details: `PO ${po.po_number} status changed from ${previousStatus} to ${newStatus}${notes ? ` (Notes: ${notes})` : ''}`,
    });

    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard');

    return { success: true, data: po };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update PO status' };
  }
}

/**
 * Safely update unfulfilled Purchase Order operational details (expected delivery, contact, consignee info).
 * Finalized/received POs remain strictly protected against uncontrolled edits.
 */
export async function updatePurchaseOrder(
  poId: string,
  values: Partial<{
    expected_delivery: string;
    supplier_contact: string;
    delivery_type: DeliveryType;
    consignee_name: string;
    consignee_address: string;
    consignee_contact: string;
    consignee_phone: string;
    notes: string;
  }>
): Promise<{ success: boolean; data?: PurchaseOrder; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const store = getInternalPurchaseOrdersStore();
    const po = store.find((p) => p.id === poId || p.po_number === poId);

    if (!po) {
      return { success: false, error: 'Purchase Order not found' };
    }

    if (po.status === 'Received' || po.status === 'Closed') {
      return {
        success: false,
        error: `Cannot modify PO in "${po.status}" state. Finalized procurement transactions are protected.`,
      };
    }

    if (values.expected_delivery !== undefined) po.expected_delivery = values.expected_delivery;
    if (values.supplier_contact !== undefined) po.supplier_contact = values.supplier_contact;
    if (values.delivery_type !== undefined) po.delivery_type = values.delivery_type;
    if (values.consignee_name !== undefined) po.consignee_name = values.consignee_name;
    if (values.consignee_address !== undefined) po.consignee_address = values.consignee_address;
    if (values.consignee_contact !== undefined) po.consignee_contact = values.consignee_contact;
    if (values.consignee_phone !== undefined) po.consignee_phone = values.consignee_phone;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('purchase_orders')
          .update({
            expected_delivery: po.expected_delivery || null,
            supplier_contact: po.supplier_contact || null,
            delivery_type: po.delivery_type,
            consignee_name: po.consignee_name || null,
            consignee_address: po.consignee_address || null,
            consignee_contact: po.consignee_contact || null,
            consignee_phone: po.consignee_phone || null,
          })
          .or(`id.eq.${po.id},po_number.eq.${po.po_number}`);
      } catch (err) {
        console.warn('Supabase updatePurchaseOrder fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_PURCHASE_ORDER',
      module: 'PROCUREMENT',
      details: `Updated operational details for PO ${po.po_number} (Expected: ${po.expected_delivery || 'N/A'}, Consignee: ${po.consignee_name || 'Office'})`,
    });

    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard');

    return { success: true, data: po };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update Purchase Order' };
  }
}



