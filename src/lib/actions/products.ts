'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { INITIAL_PRODUCTS, PRODUCT_CATEGORIES } from '@/lib/constants/erp-data';
import { getNextInventoryTxId } from '@/lib/utils/sequence';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import type { Product } from '@/types/erp';
import type { ProductFormValues } from '@/lib/validations/erp';

export interface InventoryTransaction {
  id: string;
  product_id: string;
  sku: string;
  product_name: string;
  transaction_type: 'PURCHASE_RECEIPT' | 'SALES_DISPATCH' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_type?: string;
  reference_id?: string;
  user_name: string;
  notes?: string;
  created_at: string;
}

// Shared in-memory store across requests in this Node process
declare global {
  // eslint-disable-next-line no-var
  var __ICON_PRODUCTS__: Product[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_INVENTORY_LEDGER__: InventoryTransaction[] | undefined;
}

function getProductsStore(): Product[] {
  if (!globalThis.__ICON_PRODUCTS__) {
    globalThis.__ICON_PRODUCTS__ = [...INITIAL_PRODUCTS];
  }
  return globalThis.__ICON_PRODUCTS__;
}

function getLedgerStore(): InventoryTransaction[] {
  if (!globalThis.__ICON_INVENTORY_LEDGER__) {
    globalThis.__ICON_INVENTORY_LEDGER__ = [];
  }
  return globalThis.__ICON_INVENTORY_LEDGER__;
}

export async function canViewProductCosts(): Promise<boolean> {
  const { getAuthenticatedUser } = await import('@/lib/auth/session');
  const user = await getAuthenticatedUser();
  return Boolean(
    user && ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'].includes(user.role)
  );
}

export async function getProducts(filters?: {
  category?: string;
  search?: string;
  lowStockOnly?: boolean;
}): Promise<{ products: Product[]; total: number }> {
  const store = getProductsStore();

  // Server-side commercial privacy authorization check
  const { getAuthenticatedUser } = await import('@/lib/auth/session');
  const user = await getAuthenticatedUser();
  const canSeePurchaseCost = Boolean(
    user && ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'].includes(user.role)
  );

  const sanitizeProduct = (p: Product): Product => {
    if (canSeePurchaseCost) return p;
    return {
      ...p,
      purchase_price: 0,
      target_margin_pct: 0,
      supplier_name: undefined,
      purchase_depot: undefined,
    };
  };

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      let query = supabase.from('products').select('*', { count: 'exact' });

      if (filters?.category && filters.category !== 'ALL') {
        query = query.eq('category_name', filters.category);
      }
      if (filters?.search) {
        const s = filters.search.trim();
        query = query.or(`sku.ilike.%${s}%,name.ilike.%${s}%,brand_name.ilike.%${s}%,model_name.ilike.%${s}%`);
      }

      query = query.order('name', { ascending: true });
      const { data, error, count } = await query;

      if (!error && data) {
        let list = (data as Product[]).map(sanitizeProduct);
        if (filters?.lowStockOnly) {
          list = list.filter((p) => p.current_stock <= p.reorder_level);
        }
        return { products: list, total: count ?? list.length };
      }
    } catch (err) {
      console.warn('Supabase products query failed, using store:', err);
    }
  }

  let filtered = store.map(sanitizeProduct);
  if (filters?.category && filters.category !== 'ALL') {
    filtered = filtered.filter((p) => p.category_name === filters.category);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        (p.brand_name && p.brand_name.toLowerCase().includes(s)) ||
        (p.model_name && p.model_name.toLowerCase().includes(s))
    );
  }
  if (filters?.lowStockOnly) {
    filtered = filtered.filter((p) => p.current_stock <= p.reorder_level);
  }

  return { products: filtered, total: filtered.length };
}

export async function createProduct(
  payload: ProductFormValues
): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

    const store = getProductsStore();

    const newProduct: Product = {
      id: `PRD-${Date.now()}`,
      sku: payload.sku,
      name: payload.name,
      category_name: payload.category_name,
      brand_name: payload.brand_name || 'Generic',
      model_name: payload.model_name || '',
      unit: payload.unit,
      hsn_sac: payload.hsn_sac,
      gst_rate: payload.gst_rate,
      purchase_price: payload.purchase_price,
      selling_price: payload.selling_price,
      mrp: payload.mrp,
      target_margin_pct: payload.target_margin_pct,
      current_stock: Math.max(0, payload.current_stock || 0),
      reorder_level: payload.reorder_level,
      is_serialized: payload.is_serialized,
      is_service: payload.is_service,
      supplier_name: payload.supplier_name,
      purchase_depot: payload.purchase_depot,
      is_active: true,
    };

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        const { data, error } = await admin.from('products').insert([payload]).select().single();
        if (!error && data) {
          store.unshift(data as Product);
          await logAuditEvent({
            userName: authUser.name,
            action: 'CREATE_PRODUCT',
            module: 'INVENTORY',
            details: `Created product ${payload.sku} - ${payload.name}`,
          });
          revalidatePath('/dashboard/products');
          revalidatePath('/dashboard/inventory');
          return { success: true, data: data as Product };
        }
      } catch (err: any) {
        console.warn('Error inserting product into Supabase:', err);
      }
    }

    store.unshift(newProduct);

    // Record initial stock movement if > 0
    if (newProduct.current_stock > 0) {
      const txId = await getNextInventoryTxId();
      getLedgerStore().unshift({
        id: txId,
        product_id: newProduct.id,
        sku: newProduct.sku,
        product_name: newProduct.name,
        transaction_type: 'ADJUSTMENT',
        quantity: newProduct.current_stock,
        previous_stock: 0,
        new_stock: newProduct.current_stock,
        user_name: authUser.name,
        notes: 'Initial opening stock',
        created_at: new Date().toISOString(),
      });
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_PRODUCT',
      module: 'INVENTORY',
      details: `Created product ${newProduct.sku} - ${newProduct.name}`,
    });

    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/inventory');
    return { success: true, data: newProduct };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create product' };
  }
}

/**
 * Atomically update stock level with negative stock prevention and immutable audit ledger.
 */
export async function updateProductStock(
  idOrSku: string,
  newStock: number,
  reason: string = 'Manual Adjustment'
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

    if (newStock < 0) {
      return { success: false, error: 'Negative stock not permitted. New stock must be >= 0.' };
    }

    const store = getProductsStore();
    const found = store.find((p) => p.id === idOrSku || p.sku === idOrSku || p.name === idOrSku);
    if (!found) {
      return { success: false, error: 'Product not found' };
    }

    const prevStock = found.current_stock || 0;
    const delta = newStock - prevStock;
    found.current_stock = newStock;

    // Record in Immutable Inventory Transaction Ledger
    const txId = await getNextInventoryTxId();
    const ledgerEntry: InventoryTransaction = {
      id: txId,
      product_id: found.id,
      sku: found.sku,
      product_name: found.name,
      transaction_type: 'ADJUSTMENT',
      quantity: delta,
      previous_stock: prevStock,
      new_stock: newStock,
      user_name: authUser.name,
      notes: reason,
      created_at: new Date().toISOString(),
    };
    getLedgerStore().unshift(ledgerEntry);

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        await admin.from('products').update({ current_stock: newStock }).or(`id.eq.${found.id},sku.eq.${found.sku}`);
      } catch (err) {
        console.warn('Supabase stock update failed:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_STOCK',
      module: 'INVENTORY',
      details: `Adjusted stock for ${found.name} (${found.sku}) from ${prevStock} to ${newStock} (${reason})`,
    });

    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update stock' };
  }
}

/**
 * Increment or decrement product stock atomically.
 * Strictly prevents negative stock (Rule 20) and appends to inventory ledger (Rule 18, 21).
 */
export async function incrementProductStock(
  idOrSkuOrName: string,
  incrementBy: number,
  transactionType: 'PURCHASE_RECEIPT' | 'SALES_DISPATCH' | 'ADJUSTMENT' | 'RETURN' = 'ADJUSTMENT',
  referenceType?: string,
  referenceId?: string,
  notes?: string
): Promise<{ success: boolean; newStock?: number; error?: string }> {
  try {
    const store = getProductsStore();
    const found = store.find(
      (p) =>
        p.id === idOrSkuOrName ||
        p.sku === idOrSkuOrName ||
        p.name.toLowerCase() === idOrSkuOrName.toLowerCase()
    );

    if (!found) {
      return { success: false, error: `Product '${idOrSkuOrName}' not found in inventory catalog.` };
    }

    const prevStock = found.current_stock || 0;
    const targetStock = prevStock + incrementBy;

    // Rule 20 Enforcement: Default: Negative stock NOT allowed.
    if (targetStock < 0) {
      return {
        success: false,
        error: `Insufficient stock for ${found.name}. Available: ${prevStock}, Requested Reduction: ${Math.abs(incrementBy)}. Transaction rejected to prevent negative inventory.`,
      };
    }

    found.current_stock = targetStock;

    // Append to immutable inventory ledger
    const txId = await getNextInventoryTxId();
    getLedgerStore().unshift({
      id: txId,
      product_id: found.id,
      sku: found.sku,
      product_name: found.name,
      transaction_type: transactionType,
      quantity: incrementBy,
      previous_stock: prevStock,
      new_stock: targetStock,
      reference_type: referenceType,
      reference_id: referenceId,
      user_name: 'System / Operator',
      notes: notes || `${transactionType} of ${Math.abs(incrementBy)} units`,
      created_at: new Date().toISOString(),
    });

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        await admin.from('products').update({ current_stock: targetStock }).or(`id.eq.${found.id},sku.eq.${found.sku}`);
      } catch (err) {
        console.warn('Supabase stock increment failed:', err);
      }
    }

    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard');
    return { success: true, newStock: targetStock };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Stock increment failed' };
  }
}

/**
 * Retrieve immutable inventory ledger entries
 */
export async function getInventoryTransactions(productId?: string): Promise<InventoryTransaction[]> {
  const store = getLedgerStore();
  if (productId) {
    return store.filter((t) => t.product_id === productId || t.sku === productId);
  }
  return store;
}

export async function getProductCategories(): Promise<string[]> {
  return PRODUCT_CATEGORIES;
}

/**
 * Update Product Master Information.
 * Current physical stock is strictly protected and cannot be directly overwritten here;
 * stock adjustments must proceed via authenticated inventory ledger transactions.
 */
export async function updateProduct(
  idOrSku: string,
  values: Partial<{
    name: string;
    brand_name: string;
    model_name: string;
    category_name: string;
    unit: string;
    hsn_sac: string;
    gst_rate: number;
    purchase_price: number;
    selling_price: number;
    mrp: number;
    target_margin_pct: number;
    reorder_level: number;
    is_serialized: boolean;
    is_service: boolean;
    supplier_name: string;
    purchase_depot: string;
    is_active: boolean;
  }>
): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

    const store = getProductsStore();
    const found = store.find((p) => p.id === idOrSku || p.sku === idOrSku);
    if (!found) {
      return { success: false, error: 'Product not found in catalog' };
    }

    if (values.name !== undefined) found.name = values.name;
    if (values.brand_name !== undefined) found.brand_name = values.brand_name;
    if (values.model_name !== undefined) found.model_name = values.model_name;
    if (values.category_name !== undefined) found.category_name = values.category_name;
    if (values.unit !== undefined) found.unit = values.unit;
    if (values.hsn_sac !== undefined) found.hsn_sac = values.hsn_sac;
    if (values.gst_rate !== undefined) found.gst_rate = Number(values.gst_rate) || 0;
    if (values.purchase_price !== undefined) found.purchase_price = Number(values.purchase_price) || 0;
    if (values.selling_price !== undefined) found.selling_price = Number(values.selling_price) || 0;
    if (values.mrp !== undefined) found.mrp = Number(values.mrp) || 0;
    if (values.target_margin_pct !== undefined) found.target_margin_pct = Number(values.target_margin_pct) || 0;
    if (values.reorder_level !== undefined) found.reorder_level = Number(values.reorder_level) || 0;
    if (values.is_serialized !== undefined) found.is_serialized = values.is_serialized;
    if (values.is_service !== undefined) found.is_service = values.is_service;
    if (values.supplier_name !== undefined) found.supplier_name = values.supplier_name;
    if (values.purchase_depot !== undefined) found.purchase_depot = values.purchase_depot;
    if (values.is_active !== undefined) found.is_active = values.is_active;

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        await admin
          .from('products')
          .update({
            name: found.name,
            brand_name: found.brand_name,
            model_name: found.model_name,
            category_name: found.category_name,
            unit: found.unit,
            hsn_sac: found.hsn_sac,
            gst_rate: found.gst_rate,
            purchase_price: found.purchase_price,
            selling_price: found.selling_price,
            mrp: found.mrp,
            target_margin_pct: found.target_margin_pct,
            reorder_level: found.reorder_level,
            is_serialized: found.is_serialized,
            is_service: found.is_service,
            supplier_name: found.supplier_name || null,
            purchase_depot: found.purchase_depot || null,
            is_active: found.is_active,
            updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${found.id},sku.eq.${found.sku}`);
      } catch (err) {
        console.warn('Supabase updateProduct fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_PRODUCT',
      module: 'INVENTORY',
      details: `Updated product master details for ${found.name} (${found.sku})`,
    });

    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard');

    return { success: true, data: found };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update product' };
  }
}

