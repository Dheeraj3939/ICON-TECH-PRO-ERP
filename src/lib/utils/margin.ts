/**
 * Centralized Reseller Pricing & Margin Calculation Engine
 * Tracks Quoted Margin, Approved Margin, Order Margin, and Actual Margin.
 * Enforces strict role-based purchase cost protection across UI and API boundaries.
 */

import type { UserRole, Product, Quotation, SalesOrder } from '@/types/erp';

export interface MarginParams {
  sellingPrice: number;
  purchaseCost: number;
  quantity?: number;
  discountPct?: number;
  freight?: number;
  installation?: number;
  otherDirectCosts?: number;
}

export interface MarginResult {
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
  totalDirectCosts: number;
  grossProfit: number;
  marginPct: number;
}

/**
 * Compute commercial margins taking into account direct reseller job costs.
 */
export function calculateCommercialMargin(params: MarginParams): MarginResult {
  const qty = Math.max(1, params.quantity || 1);
  const grossRevenue = Number((params.sellingPrice * qty).toFixed(2));
  const discountAmount = Number(((grossRevenue * (params.discountPct || 0)) / 100).toFixed(2));
  const netRevenue = Number((grossRevenue - discountAmount).toFixed(2));

  const materialCost = Number((params.purchaseCost * qty).toFixed(2));
  const totalDirectCosts = Number(
    (materialCost + (params.freight || 0) + (params.installation || 0) + (params.otherDirectCosts || 0)).toFixed(2)
  );

  const grossProfit = Number((netRevenue - totalDirectCosts).toFixed(2));
  const marginPct = netRevenue > 0 ? Number(((grossProfit / netRevenue) * 100).toFixed(2)) : 0;

  return {
    grossRevenue,
    discountAmount,
    netRevenue,
    totalDirectCosts,
    grossProfit,
    marginPct,
  };
}

/**
 * Commercial Privacy Guard: Checks if user has permission to inspect purchase costs & margins.
 */
export function canViewPurchaseCosts(role?: string | null): boolean {
  if (!role) return false;
  return ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'].includes(role);
}

/**
 * Sanitizes Product records for unauthorized roles.
 */
export function sanitizeProductForRole(product: Product, role?: string | null): Product {
  if (canViewPurchaseCosts(role)) return product;
  return {
    ...product,
    purchase_price: 0,
    target_margin_pct: 0,
    supplier_name: undefined,
    purchase_depot: undefined,
  };
}

/**
 * Sanitizes Quotation commercial records for unauthorized roles.
 */
export function sanitizeQuotationForRole(quote: Quotation, role?: string | null): Quotation {
  if (canViewPurchaseCosts(role)) return quote;
  return {
    ...quote,
    total_cost: 0,
    margin_pct: 0,
    quoted_margin_pct: 0,
    approved_margin_pct: 0,
    order_margin_pct: 0,
    actual_margin_pct: 0,
    items: quote.items.map((it) => ({
      ...it,
      purchase_price: 0,
    })),
  };
}
