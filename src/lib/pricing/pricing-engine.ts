/**
 * ICON TECH PRO ERP V8 — Commercial Pricing & Financial Engine
 * 
 * Transparent, rigorous pricing mathematics for Indian GST regime and enterprise commercial quotations.
 * Guarantees:
 * - 100% transparent pricing math (GST-inclusive vs GST-exclusive)
 * - Exact 2-decimal financial rounding (round half away from zero)
 * - Zero silent errors (boundary cases and invalid numbers produce explicit fallback/error structures)
 * - Robust margin (Profit/Selling) vs markup (Profit/Cost) differentiation
 * - Multi-tier discount governance with role-based approval thresholds
 */

export const DISCOUNT_APPROVAL_RULES = [
  { role: 'Sales Executive', maxDiscountPct: 5, requiresApprovalFrom: 'BDM' },
  { role: 'BDM', maxDiscountPct: 15, requiresApprovalFrom: 'Admin / BDM' },
  { role: 'Admin / BDM', maxDiscountPct: 25, requiresApprovalFrom: 'Managing Director' },
  { role: 'Managing Director', maxDiscountPct: 100, requiresApprovalFrom: null },
];

export type UserRole =
  | 'Managing Director'
  | 'Admin / BDM'
  | 'BDM'
  | 'Sales Executive'
  | 'Accounts'
  | 'Office Assistant';

export interface LinePricingInput {
  selling_price: number; // Unit selling price
  purchase_price?: number; // Unit cost price (optional, defaults to 0)
  quantity: number; // Item count
  discount_pct?: number; // Line discount percentage (0-100)
  discount_amount?: number; // Flat line discount amount (optional override)
  gst_rate?: number; // GST rate percentage (0, 5, 12, 18, 28)
  is_gst_inclusive?: boolean; // Whether selling_price is GST-inclusive
  hsn_sac?: string;
}

export interface LinePricingResult {
  quantity: number;
  unit_selling_price: number;
  unit_purchase_price: number;
  is_gst_inclusive: boolean;
  gst_rate: number;

  // Base and Taxable
  gross_amount: number; // Qty * Selling Price (Pre-discount)
  discount_pct: number;
  discount_amount: number;
  taxable_amount: number; // Base on which GST is levied
  gst_amount: number;
  total_amount: number; // Taxable + GST

  // Cost and Profitability
  total_cost: number; // Qty * Purchase Price
  gross_profit: number; // Taxable Amount - Total Cost
  margin_pct: number; // (Gross Profit / Taxable Amount) * 100
  markup_pct: number; // (Gross Profit / Total Cost) * 100

  // Per-unit breakdown for transparency
  effective_unit_taxable: number;
  effective_unit_gross: number;

  // Validity and Diagnostics
  is_valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface QuotationPricingInput {
  items: LinePricingInput[];
  place_of_supply?: string; // e.g. '36-TELANGANA'
  overall_discount_pct?: number;
  overall_discount_amount?: number;
  user_role?: UserRole;
}

export interface QuotationPricingResult {
  items: LinePricingResult[];
  subtotal: number; // Sum of line gross amounts
  line_discounts_total: number;
  overall_discount: number;
  total_discount: number;
  taxable_amount: number;

  // Tax breakdown
  is_intra_state: boolean;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;

  // Final totals
  grand_total: number;
  total_cost: number;
  gross_profit: number;
  margin_pct: number;
  markup_pct: number;
  effective_tax_rate_pct: number;

  // Governance & Discount Approvals
  max_item_discount_pct: number;
  effective_overall_discount_pct: number;
  requires_discount_approval: boolean;
  required_approver_role: string | null;
  discount_approval_tier: string;

  // Diagnostics
  is_valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface MarginHealthAnalysis {
  health_score: number; // 0 - 100
  overall_margin_pct: number;
  benchmark_target_margin_pct: number;
  status: 'EXCELLENT' | 'HEALTHY' | 'MARGINAL' | 'CRITICAL' | 'LOSS_MAKING';
  flags: Array<{
    item_index?: number;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
  }>;
  recommendations: string[];
}

/**
 * High-precision rounding to 2 decimal places.
 * Uses standard financial round half away from zero.
 */
export function roundTo2Decimals(num: number): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export interface CostToPriceInput {
  purchase_cost: number;
  margin_pct?: number; // Target margin: (Selling - Cost) / Selling * 100
  markup_pct?: number; // Target markup: (Selling - Cost) / Cost * 100
  fixed_margin?: number; // Flat profit addition
  selling_price?: number; // Direct selling price override
  gst_rate?: number;
}

export interface CostToPriceResult {
  purchase_cost: number;
  selling_price: number;
  gross_profit: number;
  margin_pct: number;
  markup_pct: number;
  gst_rate: number;
  gst_amount: number;
  total_with_gst: number;
}

/**
 * Calculates selling price and margins from confirmed distributor purchase cost.
 * Conforms to ICON TECH PRO V9 Reseller Pricing Workflow:
 * Purchase Cost -> Target Margin / Markup / Fixed -> Selling Price -> GST.
 */
export function calculateSellingPriceFromCost(input: CostToPriceInput): CostToPriceResult {
  const purchaseCost = Math.max(0, Number(input.purchase_cost) || 0);
  const gstRate = Number(input.gst_rate ?? 18);
  let sellingPrice = 0;

  if (input.selling_price !== undefined && input.selling_price !== null && !isNaN(Number(input.selling_price))) {
    sellingPrice = Math.max(0, Number(input.selling_price));
  } else if (input.margin_pct !== undefined && input.margin_pct !== null && Number(input.margin_pct) < 100) {
    const marginPct = Number(input.margin_pct);
    sellingPrice = marginPct >= 100 ? purchaseCost : purchaseCost / (1 - marginPct / 100);
  } else if (input.markup_pct !== undefined && input.markup_pct !== null) {
    const markupPct = Number(input.markup_pct);
    sellingPrice = purchaseCost * (1 + markupPct / 100);
  } else if (input.fixed_margin !== undefined && input.fixed_margin !== null) {
    sellingPrice = purchaseCost + Number(input.fixed_margin);
  } else {
    sellingPrice = purchaseCost;
  }

  sellingPrice = roundTo2Decimals(sellingPrice);
  const grossProfit = roundTo2Decimals(sellingPrice - purchaseCost);
  const marginPct = sellingPrice > 0 ? roundTo2Decimals((grossProfit / sellingPrice) * 100) : 0;
  const markupPct = purchaseCost > 0 ? roundTo2Decimals((grossProfit / purchaseCost) * 100) : (sellingPrice > 0 ? 100 : 0);
  const gstAmount = roundTo2Decimals((sellingPrice * gstRate) / 100);
  const totalWithGst = roundTo2Decimals(sellingPrice + gstAmount);

  return {
    purchase_cost: purchaseCost,
    selling_price: sellingPrice,
    gross_profit: grossProfit,
    margin_pct: marginPct,
    markup_pct: markupPct,
    gst_rate: gstRate,
    gst_amount: gstAmount,
    total_with_gst: totalWithGst,
  };
}

/**
 * Calculates line-level pricing with transparent GST-inclusive and GST-exclusive support.
 */
export function calculateLinePricing(input: LinePricingInput): LinePricingResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Input sanitization & validation
  const rawQty = Number(input.quantity);
  const rawSellingPrice = Number(input.selling_price);
  const rawPurchasePrice = Number(input.purchase_price ?? 0);
  const rawGstRate = Number(input.gst_rate ?? 18);
  const isInclusive = Boolean(input.is_gst_inclusive);

  if (isNaN(rawQty) || rawQty < 0) {
    errors.push(`Invalid quantity: ${input.quantity}. Must be a non-negative number.`);
  }
  if (isNaN(rawSellingPrice) || rawSellingPrice < 0) {
    errors.push(`Invalid selling price: ${input.selling_price}. Must be a non-negative number.`);
  }
  if (isNaN(rawPurchasePrice) || rawPurchasePrice < 0) {
    errors.push(`Invalid purchase price: ${input.purchase_price}. Must be a non-negative number.`);
  }
  if (isNaN(rawGstRate) || rawGstRate < 0 || rawGstRate > 100) {
    errors.push(`Invalid GST rate: ${input.gst_rate}. Must be between 0% and 100%.`);
  }

  const quantity = Math.max(0, isNaN(rawQty) ? 0 : rawQty);
  const sellingPrice = Math.max(0, isNaN(rawSellingPrice) ? 0 : rawSellingPrice);
  const purchasePrice = Math.max(0, isNaN(rawPurchasePrice) ? 0 : rawPurchasePrice);
  const gstRate = Math.max(0, Math.min(100, isNaN(rawGstRate) ? 18 : rawGstRate));

  let discountPct = Number(input.discount_pct ?? 0);
  let discountAmount = Number(input.discount_amount ?? 0);

  if (isNaN(discountPct) || discountPct < 0) discountPct = 0;
  if (discountPct > 100) {
    discountPct = 100;
    warnings.push('Discount percentage capped at 100%.');
  }

  // Handle zero quantity boundary case
  if (quantity === 0) {
    warnings.push('Quantity is zero; resulting financial amounts are zero.');
    return {
      quantity: 0,
      unit_selling_price: roundTo2Decimals(sellingPrice),
      unit_purchase_price: roundTo2Decimals(purchasePrice),
      is_gst_inclusive: isInclusive,
      gst_rate: gstRate,
      gross_amount: 0,
      discount_pct: discountPct,
      discount_amount: 0,
      taxable_amount: 0,
      gst_amount: 0,
      total_amount: 0,
      total_cost: 0,
      gross_profit: 0,
      margin_pct: 0,
      markup_pct: 0,
      effective_unit_taxable: 0,
      effective_unit_gross: 0,
      is_valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  let grossAmount = 0;
  let taxableAmount = 0;
  let gstAmount = 0;
  let totalAmount = 0;

  if (isInclusive) {
    // GST-INCLUSIVE PRICING
    // sellingPrice represents total per-unit price inclusive of GST
    // Formula: Taxable = Inclusive / (1 + GST/100)
    const lineInclusiveGross = roundTo2Decimals(sellingPrice * quantity);
    grossAmount = lineInclusiveGross;

    if (discountPct > 0) {
      discountAmount = roundTo2Decimals((lineInclusiveGross * discountPct) / 100);
    } else if (discountAmount > 0) {
      discountAmount = Math.min(lineInclusiveGross, roundTo2Decimals(discountAmount));
      discountPct = lineInclusiveGross > 0 ? roundTo2Decimals((discountAmount / lineInclusiveGross) * 100) : 0;
    } else {
      discountAmount = 0;
    }

    const discountedInclusive = Math.max(0, lineInclusiveGross - discountAmount);
    totalAmount = roundTo2Decimals(discountedInclusive);

    if (gstRate > 0) {
      taxableAmount = roundTo2Decimals(discountedInclusive / (1 + gstRate / 100));
      gstAmount = roundTo2Decimals(totalAmount - taxableAmount);
    } else {
      taxableAmount = totalAmount;
      gstAmount = 0;
    }
  } else {
    // GST-EXCLUSIVE PRICING (Standard B2B Quotation)
    // sellingPrice represents base taxable value before tax
    const lineExclusiveGross = roundTo2Decimals(sellingPrice * quantity);
    grossAmount = lineExclusiveGross;

    if (discountPct > 0) {
      discountAmount = roundTo2Decimals((lineExclusiveGross * discountPct) / 100);
    } else if (discountAmount > 0) {
      discountAmount = Math.min(lineExclusiveGross, roundTo2Decimals(discountAmount));
      discountPct = lineExclusiveGross > 0 ? roundTo2Decimals((discountAmount / lineExclusiveGross) * 100) : 0;
    } else {
      discountAmount = 0;
    }

    taxableAmount = Math.max(0, roundTo2Decimals(lineExclusiveGross - discountAmount));
    gstAmount = roundTo2Decimals((taxableAmount * gstRate) / 100);
    totalAmount = roundTo2Decimals(taxableAmount + gstAmount);
  }

  // Cost, Profit, Margin and Markup calculations
  const totalCost = roundTo2Decimals(purchasePrice * quantity);
  const grossProfit = roundTo2Decimals(taxableAmount - totalCost);

  // Margin % = (Gross Profit / Taxable Amount) * 100
  let marginPct = 0;
  if (taxableAmount > 0) {
    marginPct = roundTo2Decimals((grossProfit / taxableAmount) * 100);
  } else if (totalCost > 0) {
    marginPct = -100;
  }

  // Markup % = (Gross Profit / Total Cost) * 100
  let markupPct = 0;
  if (totalCost > 0) {
    markupPct = roundTo2Decimals((grossProfit / totalCost) * 100);
  } else if (taxableAmount > 0) {
    markupPct = 100; // Zero cost means 100% markup
  }

  // Per-unit breakdown
  const effectiveUnitTaxable = quantity > 0 ? roundTo2Decimals(taxableAmount / quantity) : 0;
  const effectiveUnitGross = quantity > 0 ? roundTo2Decimals(totalAmount / quantity) : 0;

  // Warnings
  if (purchasePrice > sellingPrice && !isInclusive) {
    warnings.push(`Negative margin alert: Purchase price (₹${purchasePrice}) exceeds selling price (₹${sellingPrice}).`);
  } else if (grossProfit < 0) {
    warnings.push(`Negative gross profit: ₹${grossProfit} on this line item.`);
  }

  return {
    quantity,
    unit_selling_price: roundTo2Decimals(sellingPrice),
    unit_purchase_price: roundTo2Decimals(purchasePrice),
    is_gst_inclusive: isInclusive,
    gst_rate: gstRate,
    gross_amount: grossAmount,
    discount_pct: discountPct,
    discount_amount: discountAmount,
    taxable_amount: taxableAmount,
    gst_amount: gstAmount,
    total_amount: totalAmount,
    total_cost: totalCost,
    gross_profit: grossProfit,
    margin_pct: marginPct,
    markup_pct: markupPct,
    effective_unit_taxable: effectiveUnitTaxable,
    effective_unit_gross: effectiveUnitGross,
    is_valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Calculates entire quotation pricing, taxes (CGST/SGST vs IGST), and multi-tier discount approvals.
 */
export function calculateQuotationPricing(input: QuotationPricingInput): QuotationPricingResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const items = (input.items || []).map((item) => calculateLinePricing(item));

  let subtotal = 0;
  let lineDiscountsTotal = 0;
  let taxableSum = 0;
  let totalCost = 0;
  let totalTax = 0;
  let maxItemDiscountPct = 0;

  for (const item of items) {
    subtotal += item.gross_amount;
    lineDiscountsTotal += item.discount_amount;
    taxableSum += item.taxable_amount;
    totalCost += item.total_cost;
    totalTax += item.gst_amount;
    if (item.discount_pct > maxItemDiscountPct) {
      maxItemDiscountPct = item.discount_pct;
    }
    if (item.warnings.length > 0) {
      warnings.push(...item.warnings);
    }
    if (item.errors.length > 0) {
      errors.push(...item.errors);
    }
  }

  subtotal = roundTo2Decimals(subtotal);
  lineDiscountsTotal = roundTo2Decimals(lineDiscountsTotal);
  taxableSum = roundTo2Decimals(taxableSum);
  totalCost = roundTo2Decimals(totalCost);
  totalTax = roundTo2Decimals(totalTax);

  // Overall quotation-level discount
  let overallDiscount = 0;
  if (input.overall_discount_pct && input.overall_discount_pct > 0) {
    const pct = Math.min(100, Math.max(0, Number(input.overall_discount_pct)));
    overallDiscount = roundTo2Decimals((taxableSum * pct) / 100);
  } else if (input.overall_discount_amount && input.overall_discount_amount > 0) {
    overallDiscount = Math.min(taxableSum, roundTo2Decimals(Number(input.overall_discount_amount)));
  }

  const finalTaxable = Math.max(0, roundTo2Decimals(taxableSum - overallDiscount));
  const totalDiscount = roundTo2Decimals(lineDiscountsTotal + overallDiscount);

  // Place of Supply & Tax Split (Telangana state code 36)
  const pos = (input.place_of_supply || '36-TELANGANA').toUpperCase();
  const isIntraState = pos.startsWith('36') || pos.includes('TELANGANA');

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isIntraState) {
    cgstAmount = roundTo2Decimals(totalTax / 2);
    sgstAmount = roundTo2Decimals(totalTax / 2);
    igstAmount = 0;
  } else {
    cgstAmount = 0;
    sgstAmount = 0;
    igstAmount = totalTax;
  }

  const grandTotal = roundTo2Decimals(finalTaxable + totalTax);
  const grossProfit = roundTo2Decimals(finalTaxable - totalCost);

  let marginPct = 0;
  if (finalTaxable > 0) {
    marginPct = roundTo2Decimals((grossProfit / finalTaxable) * 100);
  } else if (totalCost > 0) {
    marginPct = -100;
  }

  let markupPct = 0;
  if (totalCost > 0) {
    markupPct = roundTo2Decimals((grossProfit / totalCost) * 100);
  } else if (finalTaxable > 0) {
    markupPct = 100;
  }

  const effectiveTaxRatePct = finalTaxable > 0 ? roundTo2Decimals((totalTax / finalTaxable) * 100) : 0;
  const effectiveOverallDiscountPct = subtotal > 0 ? roundTo2Decimals((totalDiscount / subtotal) * 100) : 0;

  // Multi-tier Discount Governance
  const userRole = input.user_role || 'Sales Executive';
  const effectiveDiscountForApproval = Math.max(maxItemDiscountPct, effectiveOverallDiscountPct);

  let requiresApproval = false;
  let requiredApproverRole: string | null = null;
  let discountTier = 'Standard Sales Discretion (<= 5%)';

  if (effectiveDiscountForApproval > 25) {
    discountTier = 'Tier 4: Extreme Discount (> 25%)';
    if (userRole !== 'Managing Director') {
      requiresApproval = true;
      requiredApproverRole = 'Managing Director';
    }
  } else if (effectiveDiscountForApproval > 15) {
    discountTier = 'Tier 3: High Commercial Discount (15% - 25%)';
    if (userRole !== 'Managing Director' && userRole !== 'Admin / BDM') {
      requiresApproval = true;
      requiredApproverRole = 'Admin / BDM';
    }
  } else if (effectiveDiscountForApproval > 5) {
    discountTier = 'Tier 2: Moderate Discount (5% - 15%)';
    if (userRole === 'Sales Executive' || userRole === 'Office Assistant') {
      requiresApproval = true;
      requiredApproverRole = 'BDM';
    }
  }

  return {
    items,
    subtotal,
    line_discounts_total: lineDiscountsTotal,
    overall_discount: overallDiscount,
    total_discount: totalDiscount,
    taxable_amount: finalTaxable,
    is_intra_state: isIntraState,
    cgst_amount: cgstAmount,
    sgst_amount: sgstAmount,
    igst_amount: igstAmount,
    total_tax: totalTax,
    grand_total: grandTotal,
    total_cost: totalCost,
    gross_profit: grossProfit,
    margin_pct: marginPct,
    markup_pct: markupPct,
    effective_tax_rate_pct: effectiveTaxRatePct,
    max_item_discount_pct: maxItemDiscountPct,
    effective_overall_discount_pct: effectiveOverallDiscountPct,
    requires_discount_approval: requiresApproval,
    required_approver_role: requiredApproverRole,
    discount_approval_tier: discountTier,
    is_valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * AI Quotation Pricing Assistant: Evaluates margin health, profitability benchmarks, and deal viability.
 */
export function analyzeQuotationPricing(pricing: QuotationPricingResult): MarginHealthAnalysis {
  const flags: MarginHealthAnalysis['flags'] = [];
  const recommendations: string[] = [];
  const targetMargin = 22.0; // ICON TECH PRO standard blended margin target

  const margin = pricing.margin_pct;

  pricing.items.forEach((item, idx) => {
    if (item.gross_profit < 0) {
      flags.push({
        item_index: idx,
        severity: 'CRITICAL',
        message: `Line ${idx + 1}: Negative margin (${item.margin_pct}%). Selling at a loss of ₹${Math.abs(item.gross_profit)}.`,
      });
    } else if (item.margin_pct < 10) {
      flags.push({
        item_index: idx,
        severity: 'WARNING',
        message: `Line ${idx + 1}: Low margin (${item.margin_pct}%). Well below target 22%.`,
      });
    }

    if (item.discount_pct > 15) {
      flags.push({
        item_index: idx,
        severity: 'WARNING',
        message: `Line ${idx + 1}: Heavy discount (${item.discount_pct}%). Requires commercial rationale.`,
      });
    }
  });

  let status: MarginHealthAnalysis['status'] = 'HEALTHY';
  let healthScore = 75;

  if (margin >= 25) {
    status = 'EXCELLENT';
    healthScore = Math.min(100, Math.round(85 + (margin - 25) * 1.5));
    recommendations.push('Strong margin profile. Deal is commercially sound and highly accretive.');
  } else if (margin >= 18) {
    status = 'HEALTHY';
    healthScore = Math.round(70 + (margin - 18) * 2);
    recommendations.push('Acceptable commercial margin. Within target range for turnkey AV & display packages.');
  } else if (margin >= 10) {
    status = 'MARGINAL';
    healthScore = Math.round(45 + (margin - 10) * 3);
    recommendations.push('Marginal profitability. Consider bundling higher-margin cabling, mounts, or AMC service.');
  } else if (margin >= 0) {
    status = 'CRITICAL';
    healthScore = Math.round(20 + margin * 2.5);
    recommendations.push('Critically low margin. Review purchase prices with distributor or reduce discounts.');
  } else {
    status = 'LOSS_MAKING';
    healthScore = 0;
    recommendations.push('PROHIBITED: Quotation operates at a net loss. Requires immediate executive price adjustment.');
  }

  if (pricing.requires_discount_approval) {
    recommendations.push(
      `Discount approval required from ${pricing.required_approver_role} due to discount exceeding policy limits.`
    );
  }

  return {
    health_score: healthScore,
    overall_margin_pct: margin,
    benchmark_target_margin_pct: targetMargin,
    status,
    flags,
    recommendations,
  };
}
