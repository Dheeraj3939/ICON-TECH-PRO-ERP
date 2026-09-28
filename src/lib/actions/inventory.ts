'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getProducts } from '@/lib/actions/products';
import { getSerialRecords } from '@/lib/actions/serials';
import type {
  StockMovementRecord,
  SerialLedgerEntry,
  SerialLifecycleTrace,
  Product,
} from '@/types/erp';

// Shared in-memory store for stock movements
declare global {
  // eslint-disable-next-line no-var
  var __ICON_STOCK_MOVEMENTS__: StockMovementRecord[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_SERIAL_LEDGER__: SerialLedgerEntry[] | undefined;
}

const INITIAL_STOCK_MOVEMENTS: StockMovementRecord[] = [
  {
    id: 'SM-001',
    movement_type: 'PURCHASE_RECEIPT',
    product_id: 'prod_epson_1',
    product_name: 'Epson Home Cinema 4K Laser Projector',
    quantity: 5,
    previous_stock: 0,
    new_stock: 5,
    reference_module: 'PO',
    reference_number: 'ICON/26-27/PO-0001',
    warehouse_code: 'WH-HYD-MAIN',
    unit_cost: 72000,
    notes: 'Initial stock inward via GRN-0001',
    created_by_name: 'Dheeraj',
    created_at: '2026-09-02T10:00:00Z',
  },
  {
    id: 'SM-002',
    movement_type: 'SALES_DISPATCH',
    product_id: 'prod_epson_1',
    product_name: 'Epson Home Cinema 4K Laser Projector',
    quantity: 2,
    previous_stock: 5,
    new_stock: 3,
    reference_module: 'SO',
    reference_number: 'ICON/26-27/ORD-0001',
    warehouse_code: 'WH-HYD-MAIN',
    unit_cost: 72000,
    notes: 'Dispatched to T-Hub Foundation',
    created_by_name: 'Dheeraj',
    created_at: '2026-09-04T14:30:00Z',
  },
];

const INITIAL_SERIAL_LEDGER: SerialLedgerEntry[] = [
  {
    id: 'SL-001',
    serial_number: 'EP-4K-980-SN4401',
    product_id: 'prod_epson_1',
    product_name: 'Epson Home Cinema 4K Laser Projector',
    action: 'INWARD_GRN',
    previous_status: undefined,
    new_status: 'AVAILABLE',
    reference_module: 'PO',
    reference_number: 'PO260001',
    warehouse_code: 'WH-HYD-MAIN',
    notes: 'Inward receipt from Hyderabad AV Tech Distributors',
    actor_name: 'Dheeraj',
    created_at: '2026-04-01T10:00:00Z',
  },
  {
    id: 'SL-002',
    serial_number: 'EP-4K-980-SN4401',
    product_id: 'prod_epson_1',
    product_name: 'Epson Home Cinema 4K Laser Projector',
    action: 'RESERVE',
    previous_status: 'AVAILABLE',
    new_status: 'RESERVED',
    reference_module: 'SO',
    reference_number: 'ORD260001',
    customer_name: 'T-Hub Foundation',
    warehouse_code: 'WH-HYD-MAIN',
    notes: 'Allocated to Sales Order ORD260001',
    actor_name: 'Dheeraj',
    created_at: '2026-04-05T11:00:00Z',
  },
  {
    id: 'SL-003',
    serial_number: 'EP-4K-980-SN4401',
    product_id: 'prod_epson_1',
    product_name: 'Epson Home Cinema 4K Laser Projector',
    action: 'DISPATCH',
    previous_status: 'RESERVED',
    new_status: 'DISPATCHED',
    reference_module: 'INVOICE',
    reference_number: 'INV260001',
    customer_name: 'T-Hub Foundation',
    warehouse_code: 'WH-HYD-MAIN',
    notes: 'Dispatched via Express Logistics',
    actor_name: 'Dheeraj',
    created_at: '2026-04-08T15:00:00Z',
  },
  {
    id: 'SL-004',
    serial_number: 'EP-4K-980-SN4401',
    product_id: 'prod_epson_1',
    product_name: 'Epson Home Cinema 4K Laser Projector',
    action: 'INSTALL',
    previous_status: 'DISPATCHED',
    new_status: 'INSTALLED',
    reference_module: 'INSTALLATION',
    reference_number: 'INS260001',
    customer_name: 'T-Hub Foundation',
    warehouse_code: 'WH-HYD-MAIN',
    notes: 'Mounted in Auditorium 1. Optical engine calibrated.',
    actor_name: 'Dheeraj',
    created_at: '2026-04-10T10:00:00Z',
  },
];

function getStockMovementsStore(): StockMovementRecord[] {
  if (!globalThis.__ICON_STOCK_MOVEMENTS__) {
    globalThis.__ICON_STOCK_MOVEMENTS__ = [...INITIAL_STOCK_MOVEMENTS];
  }
  return globalThis.__ICON_STOCK_MOVEMENTS__;
}

function getSerialLedgerStore(): SerialLedgerEntry[] {
  if (!globalThis.__ICON_SERIAL_LEDGER__) {
    globalThis.__ICON_SERIAL_LEDGER__ = [...INITIAL_SERIAL_LEDGER];
  }
  return globalThis.__ICON_SERIAL_LEDGER__;
}

/**
 * Record an append-only stock movement.
 * Strictly guarantees ZERO NEGATIVE STOCK invariant.
 */
export async function recordStockMovement(payload: {
  product_id?: string;
  product_name: string;
  movement_type: 'PURCHASE_RECEIPT' | 'SALES_DISPATCH' | 'STOCK_ADJUSTMENT' | 'RENTAL_OUT' | 'RENTAL_RETURN';
  quantity: number;
  reference_module: string;
  reference_number: string;
  warehouse_code?: string;
  unit_cost?: number;
  batch_number?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: StockMovementRecord; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts', 'Office Assistant']);
    const movementsStore = getStockMovementsStore();

    const { products } = await getProducts();
    const product = products.find(
      (p) =>
        (payload.product_id && p.id === payload.product_id) ||
        p.name.toLowerCase() === payload.product_name.toLowerCase() ||
        p.sku.toLowerCase() === payload.product_name.toLowerCase()
    );

    const currentStock = product ? product.current_stock : 0;
    const qty = Math.max(1, Number(payload.quantity) || 1);

    const isOutward =
      payload.movement_type === 'SALES_DISPATCH' ||
      payload.movement_type === 'RENTAL_OUT';

    // ZERO NEGATIVE STOCK INVARIANT ENFORCEMENT
    if (isOutward && currentStock < qty) {
      return {
        success: false,
        error: `Insufficient stock for ${payload.product_name}: current stock is ${currentStock}, required outward is ${qty}. Zero negative stock invariant enforced.`,
      };
    }

    const previousStock = currentStock;
    const newStock = isOutward ? currentStock - qty : currentStock + qty;

    const record: StockMovementRecord = {
      id: `SM-${Date.now()}`,
      movement_type: payload.movement_type,
      product_id: product?.id || payload.product_id || `PRD-${Date.now()}`,
      product_name: product?.name || payload.product_name,
      quantity: qty,
      previous_stock: previousStock,
      new_stock: newStock,
      reference_module: payload.reference_module,
      reference_number: payload.reference_number,
      warehouse_code: payload.warehouse_code || 'WH-HYD-MAIN',
      unit_cost: payload.unit_cost,
      batch_number: payload.batch_number,
      notes: payload.notes,
      created_by_name: authUser.name,
      created_at: new Date().toISOString(),
    };

    // Append to immutable ledger
    movementsStore.unshift(record);

    // Update product current stock if found
    if (product) {
      product.current_stock = newStock;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('stock_movements').insert({
          movement_type: record.movement_type,
          product_id: record.product_id,
          product_name: record.product_name,
          quantity: record.quantity,
          previous_stock: record.previous_stock,
          new_stock: record.new_stock,
          reference_module: record.reference_module,
          reference_number: record.reference_number,
          warehouse_code: record.warehouse_code,
          unit_cost: record.unit_cost || null,
          batch_number: record.batch_number || null,
          notes: record.notes || null,
          created_by_name: record.created_by_name,
        });

        if (product && product.id) {
          await admin
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', product.id);
        }
      } catch (dbErr) {
        console.warn('Supabase stock_movements insert fallback:', dbErr);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'RECORD_STOCK_MOVEMENT',
      module: 'INVENTORY',
      details: `${record.movement_type} on ${record.product_name}: ${qty} units (${previousStock} → ${newStock}) [Ref: ${record.reference_module} ${record.reference_number}]`,
    });

    revalidatePath('/dashboard/inventory');
    return { success: true, data: record };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to record stock movement' };
  }
}

/**
 * Retrieve immutable stock movement records.
 */
export async function getStockMovements(filters?: {
  productId?: string;
  movementType?: string;
  referenceNumber?: string;
}): Promise<StockMovementRecord[]> {
  const store = getStockMovementsStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      let query = supabase.from('stock_movements').select('*').order('created_at', { ascending: false });

      if (filters?.productId) query = query.eq('product_id', filters.productId);
      if (filters?.movementType) query = query.eq('movement_type', filters.movementType);
      if (filters?.referenceNumber) query = query.eq('reference_number', filters.referenceNumber);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data as StockMovementRecord[];
      }
    } catch (err) {
      console.warn('Supabase stock_movements query fallback:', err);
    }
  }

  let list = [...store];
  if (filters?.productId) list = list.filter((m) => m.product_id === filters.productId);
  if (filters?.movementType) list = list.filter((m) => m.movement_type === filters.movementType);
  if (filters?.referenceNumber) list = list.filter((m) => m.reference_number === filters.referenceNumber);

  return list;
}

/**
 * Scan and transition an individual serial number unit.
 * Appends an immutable audit entry to `serial_ledger`.
 */
export async function scanAndMoveSerial(payload: {
  serial_number: string;
  product_id?: string;
  product_name: string;
  action: 'INWARD_GRN' | 'RESERVE' | 'DISPATCH' | 'INSTALL' | 'RETURN' | 'DEFECTIVE';
  new_status: SerialLedgerEntry['new_status'];
  reference_module?: string;
  reference_number?: string;
  customer_name?: string;
  warehouse_code?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: SerialLedgerEntry; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Office Assistant', 'Accounts', 'BDM']);
    const ledgerStore = getSerialLedgerStore();

    const serialNum = payload.serial_number.trim().toUpperCase();
    if (!serialNum) {
      return { success: false, error: 'Serial number cannot be empty' };
    }

    // Find previous state
    const previousEntries = ledgerStore.filter((s) => s.serial_number === serialNum);
    const lastEntry = previousEntries[0];
    const previousStatus = lastEntry ? lastEntry.new_status : undefined;

    // Validate state transition
    if (previousStatus && previousStatus === payload.new_status) {
      return {
        success: false,
        error: `Serial ${serialNum} is already in status "${payload.new_status}".`,
      };
    }

    const entry: SerialLedgerEntry = {
      id: `SL-${Date.now()}`,
      serial_number: serialNum,
      product_id: payload.product_id,
      product_name: payload.product_name,
      action: payload.action,
      previous_status: previousStatus,
      new_status: payload.new_status,
      reference_module: payload.reference_module,
      reference_number: payload.reference_number,
      customer_name: payload.customer_name,
      warehouse_code: payload.warehouse_code || 'WH-HYD-MAIN',
      notes: payload.notes,
      actor_name: authUser.name,
      created_at: new Date().toISOString(),
    };

    ledgerStore.unshift(entry);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('serial_ledger').insert({
          serial_number: entry.serial_number,
          product_id: entry.product_id || null,
          product_name: entry.product_name,
          action: entry.action,
          previous_status: entry.previous_status || null,
          new_status: entry.new_status,
          reference_module: entry.reference_module || null,
          reference_number: entry.reference_number || null,
          customer_name: entry.customer_name || null,
          warehouse_code: entry.warehouse_code,
          notes: entry.notes || null,
          actor_name: entry.actor_name,
        });
      } catch (dbErr) {
        console.warn('Supabase serial_ledger insert fallback:', dbErr);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'SCAN_AND_MOVE_SERIAL',
      module: 'INVENTORY',
      details: `Serial ${serialNum} (${payload.product_name}) transitioned [${previousStatus || 'NEW'} → ${payload.new_status}] via ${payload.action}`,
    });

    revalidatePath('/dashboard/inventory');
    return { success: true, data: entry };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to scan and move serial' };
  }
}

/**
 * Retrieve immutable audit trail for a serial number or all serials.
 */
export async function getSerialLedger(serialNumber?: string): Promise<SerialLedgerEntry[]> {
  const store = getSerialLedgerStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      let query = supabase.from('serial_ledger').select('*').order('created_at', { ascending: false });
      if (serialNumber) {
        query = query.eq('serial_number', serialNumber.trim().toUpperCase());
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data as SerialLedgerEntry[];
      }
    } catch (err) {
      console.warn('Supabase serial_ledger query fallback:', err);
    }
  }

  if (serialNumber) {
    const s = serialNumber.trim().toUpperCase();
    return store.filter((e) => e.serial_number === s);
  }

  return store;
}

/**
 * Trace the full lifecycle of an individual hardware serial unit.
 */
export async function traceSerialLifecycle(
  serialNumber: string
): Promise<{ success: boolean; data?: SerialLifecycleTrace; error?: string }> {
  try {
    const s = serialNumber.trim().toUpperCase();
    if (!s) return { success: false, error: 'Serial number is required' };

    const ledger = await getSerialLedger(s);
    const { records: serialRecords } = await getSerialRecords({ search: s });
    const matchedRecord = serialRecords.find((r) => r.serial_number.toUpperCase() === s);

    if (ledger.length === 0 && !matchedRecord) {
      return { success: false, error: `No lifecycle history found for serial "${s}".` };
    }

    const currentStatus = matchedRecord?.status || ledger[0]?.new_status || 'UNKNOWN';
    const productName = matchedRecord?.product_name || ledger[0]?.product_name || 'Hardware Unit';
    const customer = matchedRecord?.customer_name || ledger.find((l) => l.customer_name)?.customer_name;
    const warrantyEnd = matchedRecord?.warranty_end_date;

    const trace: SerialLifecycleTrace = {
      serial_number: s,
      product_name: productName,
      current_status: currentStatus,
      history: ledger,
      installed_customer: customer,
      warranty_valid_until: warrantyEnd,
    };

    return { success: true, data: trace };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to trace serial lifecycle' };
  }
}
