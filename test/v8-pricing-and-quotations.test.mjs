import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ICON TECH PRO ERP V8 — Phase D, D.1 & D.2: Pricing, Quotation Engine & Versioning Suite', () => {

  // ============================================================================
  // Transparent Pricing Mathematics Implementation Under Test
  // ============================================================================
  function roundTo2Decimals(num) {
    if (isNaN(num) || !isFinite(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  function calculateLinePricing(input) {
    const warnings = [];
    const errors = [];

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

    const totalCost = roundTo2Decimals(purchasePrice * quantity);
    const grossProfit = roundTo2Decimals(taxableAmount - totalCost);

    let marginPct = 0;
    if (taxableAmount > 0) {
      marginPct = roundTo2Decimals((grossProfit / taxableAmount) * 100);
    } else if (totalCost > 0) {
      marginPct = -100;
    }

    let markupPct = 0;
    if (totalCost > 0) {
      markupPct = roundTo2Decimals((grossProfit / totalCost) * 100);
    } else if (taxableAmount > 0) {
      markupPct = 100;
    }

    const effectiveUnitTaxable = quantity > 0 ? roundTo2Decimals(taxableAmount / quantity) : 0;
    const effectiveUnitGross = quantity > 0 ? roundTo2Decimals(totalAmount / quantity) : 0;

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

  function calculateQuotationPricing(input) {
    const warnings = [];
    const errors = [];

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

    let overallDiscount = 0;
    if (input.overall_discount_pct && input.overall_discount_pct > 0) {
      const pct = Math.min(100, Math.max(0, Number(input.overall_discount_pct)));
      overallDiscount = roundTo2Decimals((taxableSum * pct) / 100);
    } else if (input.overall_discount_amount && input.overall_discount_amount > 0) {
      overallDiscount = Math.min(taxableSum, roundTo2Decimals(Number(input.overall_discount_amount)));
    }

    const finalTaxable = Math.max(0, roundTo2Decimals(taxableSum - overallDiscount));
    const totalDiscount = roundTo2Decimals(lineDiscountsTotal + overallDiscount);

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

    const userRole = input.user_role || 'Sales Executive';
    const effectiveDiscountForApproval = Math.max(maxItemDiscountPct, effectiveOverallDiscountPct);

    let requiresApproval = false;
    let requiredApproverRole = null;
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

  function analyzeQuotationPricing(pricing) {
    const flags = [];
    const recommendations = [];
    const targetMargin = 22.0;

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

    let status = 'HEALTHY';
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

  // ============================================================================
  // 1. GST-EXCLUSIVE PRICING CALCULATIONS (Standard B2B Quotations)
  // ============================================================================
  describe('1. GST-Exclusive Pricing Mathematics', () => {
    it('calculates standard B2B line item with 18% GST correctly', () => {
      const line = calculateLinePricing({
        selling_price: 100000,
        purchase_price: 75000,
        quantity: 2,
        discount_pct: 10,
        gst_rate: 18,
        is_gst_inclusive: false,
      });

      // 2 * 100,000 = 200,000 gross
      assert.equal(line.gross_amount, 200000);
      // 10% discount on 200,000 = 20,000
      assert.equal(line.discount_amount, 20000);
      // Taxable = 200,000 - 20,000 = 180,000
      assert.equal(line.taxable_amount, 180000);
      // GST 18% on 180,000 = 32,400
      assert.equal(line.gst_amount, 32400);
      // Total = 180,000 + 32,400 = 212,400
      assert.equal(line.total_amount, 212400);

      // Cost = 2 * 75,000 = 150,000
      assert.equal(line.total_cost, 150000);
      // Profit = 180,000 - 150,000 = 30,000
      assert.equal(line.gross_profit, 30000);
      // Margin % = (30,000 / 180,000) * 100 = 16.67%
      assert.equal(line.margin_pct, 16.67);
      // Markup % = (30,000 / 150,000) * 100 = 20.00%
      assert.equal(line.markup_pct, 20);
    });

    it('calculates flat discount override correctly on exclusive line', () => {
      const line = calculateLinePricing({
        selling_price: 50000,
        purchase_price: 35000,
        quantity: 1,
        discount_amount: 5000,
        gst_rate: 18,
        is_gst_inclusive: false,
      });

      assert.equal(line.gross_amount, 50000);
      assert.equal(line.discount_amount, 5000);
      assert.equal(line.discount_pct, 10);
      assert.equal(line.taxable_amount, 45000);
      assert.equal(line.gst_amount, 8100);
      assert.equal(line.total_amount, 53100);
    });
  });

  // ============================================================================
  // 2. GST-INCLUSIVE PRICING CALCULATIONS (Retail & Government Turnkey)
  // ============================================================================
  describe('2. GST-Inclusive Pricing Mathematics', () => {
    it('accurately extracts taxable base and GST from inclusive price', () => {
      // e.g. ₹1,18,000 MRP inclusive of 18% GST = ₹1,00,000 Base + ₹18,000 GST
      const line = calculateLinePricing({
        selling_price: 118000,
        purchase_price: 70000,
        quantity: 1,
        discount_pct: 0,
        gst_rate: 18,
        is_gst_inclusive: true,
      });

      assert.equal(line.gross_amount, 118000);
      assert.equal(line.total_amount, 118000);
      assert.equal(line.taxable_amount, 100000);
      assert.equal(line.gst_amount, 18000);
      assert.equal(line.total_cost, 70000);
      assert.equal(line.gross_profit, 30000);
      // Margin = 30,000 / 100,000 = 30%
      assert.equal(line.margin_pct, 30);
    });

    it('accurately applies discount on GST-inclusive price before tax decomposition', () => {
      // ₹1,18,000 inclusive with 10% discount = ₹1,06,200 final inclusive
      // Taxable = 1,06,200 / 1.18 = ₹90,000
      // GST = 1,06,200 - 90,000 = ₹16,200
      const line = calculateLinePricing({
        selling_price: 118000,
        purchase_price: 70000,
        quantity: 1,
        discount_pct: 10,
        gst_rate: 18,
        is_gst_inclusive: true,
      });

      assert.equal(line.gross_amount, 118000);
      assert.equal(line.discount_amount, 11800);
      assert.equal(line.total_amount, 106200);
      assert.equal(line.taxable_amount, 90000);
      assert.equal(line.gst_amount, 16200);
      assert.equal(line.gross_profit, 20000); // 90,000 - 70,000
      assert.equal(line.margin_pct, 22.22); // (20,000 / 90,000) * 100
    });
  });

  // ============================================================================
  // 3. GST PERCENTAGES (0%, 5%, 12%, 18%, 28%)
  // ============================================================================
  describe('3. GST Rate Spectrum Verification', () => {
    const testRates = [0, 5, 12, 18, 28];

    for (const rate of testRates) {
      it(`verifies accurate tax arithmetic for ${rate}% GST rate`, () => {
        const line = calculateLinePricing({
          selling_price: 10000,
          purchase_price: 6000,
          quantity: 1,
          discount_pct: 0,
          gst_rate: rate,
          is_gst_inclusive: false,
        });

        const expectedGst = (10000 * rate) / 100;
        assert.equal(line.taxable_amount, 10000);
        assert.equal(line.gst_amount, expectedGst);
        assert.equal(line.total_amount, 10000 + expectedGst);
      });
    }
  });

  // ============================================================================
  // 4. MARGIN VS MARKUP TRANSPARENT MATHEMATICS
  // ============================================================================
  describe('4. Margin vs Markup Differentiation', () => {
    it('distinguishes between margin (Profit/Selling) and markup (Profit/Cost)', () => {
      // Cost: ₹100, Selling: ₹125 => Profit: ₹25
      // Margin = 25 / 125 = 20%
      // Markup = 25 / 100 = 25%
      const line = calculateLinePricing({
        selling_price: 125,
        purchase_price: 100,
        quantity: 10,
        gst_rate: 18,
        is_gst_inclusive: false,
      });

      assert.equal(line.gross_profit, 250);
      assert.equal(line.margin_pct, 20);
      assert.equal(line.markup_pct, 25);
    });

    it('handles zero cost gracefully without dividing by zero', () => {
      const line = calculateLinePricing({
        selling_price: 15000,
        purchase_price: 0,
        quantity: 1,
        gst_rate: 18,
      });

      assert.equal(line.gross_profit, 15000);
      assert.equal(line.margin_pct, 100);
      assert.equal(line.markup_pct, 100);
    });
  });

  // ============================================================================
  // 5. BOUNDARY CASES, ZERO/INVALID VALUES & ZERO SILENT ERRORS
  // ============================================================================
  describe('5. Boundary Cases & Zero Silent Errors Policy', () => {
    it('safely handles zero quantity by returning zero amounts and diagnostic warning', () => {
      const line = calculateLinePricing({
        selling_price: 50000,
        purchase_price: 30000,
        quantity: 0,
        gst_rate: 18,
      });

      assert.equal(line.quantity, 0);
      assert.equal(line.gross_amount, 0);
      assert.equal(line.taxable_amount, 0);
      assert.equal(line.total_amount, 0);
      assert.equal(line.margin_pct, 0);
      assert.ok(line.warnings.some((w) => w.includes('Quantity is zero')));
    });

    it('rejects negative quantity or invalid values and flags explicit errors', () => {
      const line = calculateLinePricing({
        selling_price: 50000,
        purchase_price: 30000,
        quantity: -5,
        gst_rate: 18,
      });

      assert.equal(line.is_valid, false);
      assert.ok(line.errors.some((e) => e.includes('Invalid quantity')));
    });

    it('handles 100% discount properly (zero taxable, negative margin if cost > 0)', () => {
      const line = calculateLinePricing({
        selling_price: 50000,
        purchase_price: 30000,
        quantity: 1,
        discount_pct: 100,
        gst_rate: 18,
      });

      assert.equal(line.taxable_amount, 0);
      assert.equal(line.gst_amount, 0);
      assert.equal(line.total_amount, 0);
      assert.equal(line.gross_profit, -30000);
      assert.equal(line.margin_pct, -100);
    });

    it('flags warning when purchase price exceeds selling price (loss-making item)', () => {
      const line = calculateLinePricing({
        selling_price: 20000,
        purchase_price: 25000,
        quantity: 1,
        gst_rate: 18,
      });

      assert.equal(line.gross_profit, -5000);
      assert.ok(line.margin_pct < 0);
      assert.ok(line.warnings.some((w) => w.includes('Negative margin alert')));
    });
  });

  // ============================================================================
  // 6. QUOTATION-LEVEL TOTALS, INTER-STATE VS INTRA-STATE TAX SPLIT
  // ============================================================================
  describe('6. Quotation-Level Totals & Place of Supply Tax Split', () => {
    it('splits tax into CGST + SGST for intra-state (36-TELANGANA)', () => {
      const quote = calculateQuotationPricing({
        items: [
          { selling_price: 100000, purchase_price: 70000, quantity: 1, gst_rate: 18 },
          { selling_price: 50000, purchase_price: 30000, quantity: 2, gst_rate: 18 },
        ],
        place_of_supply: '36-TELANGANA',
      });

      // Total taxable = 100,000 + 100,000 = 200,000
      assert.equal(quote.taxable_amount, 200000);
      // Total tax = 36,000
      assert.equal(quote.total_tax, 36000);
      // Intra-state split: CGST 18,000, SGST 18,000, IGST 0
      assert.equal(quote.is_intra_state, true);
      assert.equal(quote.cgst_amount, 18000);
      assert.equal(quote.sgst_amount, 18000);
      assert.equal(quote.igst_amount, 0);
      assert.equal(quote.grand_total, 236000);
    });

    it('applies full IGST for inter-state supply (e.g. 29-KARNATAKA)', () => {
      const quote = calculateQuotationPricing({
        items: [
          { selling_price: 200000, purchase_price: 150000, quantity: 1, gst_rate: 18 },
        ],
        place_of_supply: '29-KARNATAKA',
      });

      assert.equal(quote.is_intra_state, false);
      assert.equal(quote.cgst_amount, 0);
      assert.equal(quote.sgst_amount, 0);
      assert.equal(quote.igst_amount, 36000);
      assert.equal(quote.grand_total, 236000);
    });
  });

  // ============================================================================
  // 7. MULTI-TIER DISCOUNT APPROVAL GOVERNANCE
  // ============================================================================
  describe('7. Multi-Tier Discount Approval Governance', () => {
    it('allows Sales Executive up to 5% discount without approval', () => {
      const quote = calculateQuotationPricing({
        items: [{ selling_price: 100000, quantity: 1, discount_pct: 5 }],
        user_role: 'Sales Executive',
      });

      assert.equal(quote.requires_discount_approval, false);
      assert.equal(quote.required_approver_role, null);
    });

    it('requires BDM approval when Sales Executive requests > 5% discount (e.g. 10%)', () => {
      const quote = calculateQuotationPricing({
        items: [{ selling_price: 100000, quantity: 1, discount_pct: 10 }],
        user_role: 'Sales Executive',
      });

      assert.equal(quote.requires_discount_approval, true);
      assert.equal(quote.required_approver_role, 'BDM');
    });

    it('requires Admin / BDM approval when discount is between 15% and 25%', () => {
      const quote = calculateQuotationPricing({
        items: [{ selling_price: 100000, quantity: 1, discount_pct: 20 }],
        user_role: 'BDM',
      });

      assert.equal(quote.requires_discount_approval, true);
      assert.equal(quote.required_approver_role, 'Admin / BDM');
    });

    it('requires Managing Director approval when discount exceeds 25%', () => {
      const quote = calculateQuotationPricing({
        items: [{ selling_price: 100000, quantity: 1, discount_pct: 30 }],
        user_role: 'Admin / BDM',
      });

      assert.equal(quote.requires_discount_approval, true);
      assert.equal(quote.required_approver_role, 'Managing Director');
    });

    it('allows Managing Director full discretion for any discount percentage', () => {
      const quote = calculateQuotationPricing({
        items: [{ selling_price: 100000, quantity: 1, discount_pct: 40 }],
        user_role: 'Managing Director',
      });

      assert.equal(quote.requires_discount_approval, false);
    });
  });

  // ============================================================================
  // 8. AI QUOTATION PRICING ASSISTANT (Margin Health & Benchmarking)
  // ============================================================================
  describe('8. AI Quotation Pricing Assistant & Margin Health', () => {
    it('scores excellent margin deal (> 25%) with high health score', () => {
      const quote = calculateQuotationPricing({
        items: [{ selling_price: 100000, purchase_price: 65000, quantity: 1, gst_rate: 18 }],
      });

      const analysis = analyzeQuotationPricing(quote);
      assert.equal(analysis.status, 'EXCELLENT');
      assert.ok(analysis.health_score >= 85);
      assert.ok(analysis.recommendations.some((r) => r.includes('accretive')));
    });

    it('flags critical alert on negative margin line items', () => {
      const quote = calculateQuotationPricing({
        items: [
          { selling_price: 100000, purchase_price: 60000, quantity: 1 },
          { selling_price: 20000, purchase_price: 25000, quantity: 1 }, // loss maker!
        ],
      });

      const analysis = analyzeQuotationPricing(quote);
      assert.ok(analysis.flags.some((f) => f.severity === 'CRITICAL' && f.message.includes('loss')));
    });
  });

  // ============================================================================
  // 9. QUOTATION REVISION HISTORY & VERSION COMPARISON
  // ============================================================================
  describe('9. Quotation Engine Versioning & Snapshotting', () => {
    class MockQuotationVersioningStore {
      constructor() {
        this.quotations = [];
        this.revisions = [];
      }

      createQuotation(quote) {
        const q = {
          ...quote,
          version: 1,
          version_tag: 'v1',
          revision_number: 1,
          versions: [],
        };
        this.quotations.push(q);
        return q;
      }

      reviseQuotation(id, updates, changeReason, author) {
        const quote = this.quotations.find((q) => q.id === id);
        if (!quote) throw new Error('Quotation not found');

        // Snapshot current version
        const snapshot = {
          version_number: quote.version,
          version_tag: quote.version_tag,
          display_number: `${quote.quotation_number} ${quote.version_tag}`,
          items: [...quote.items],
          subtotal: quote.subtotal,
          taxable_amount: quote.taxable_amount,
          grand_total: quote.grand_total,
          margin_pct: quote.margin_pct,
          status: quote.status,
        };

        const revisionRecord = {
          id: `REV-${Date.now()}`,
          quotation_id: quote.id,
          revision_number: quote.version,
          snapshot_data: snapshot,
          change_reason: changeReason,
          created_by: author,
          created_at: new Date().toISOString(),
        };

        this.revisions.push(revisionRecord);
        quote.versions.push(snapshot);

        // Advance version
        quote.version += 1;
        quote.version_tag = `v${quote.version}`;
        quote.revision_number = quote.version;
        Object.assign(quote, updates);
        quote.status = 'Draft';

        return { quote, revision: revisionRecord };
      }

      compareRevisions(id, revA, revB) {
        const quote = this.quotations.find((q) => q.id === id);
        const rA = this.revisions.find((r) => r.quotation_id === id && r.revision_number === revA)?.snapshot_data;
        const rB = quote.version === revB ? quote : this.revisions.find((r) => r.quotation_id === id && r.revision_number === revB)?.snapshot_data;

        if (!rA || !rB) throw new Error('Revisions not found');

        return {
          grand_total_diff: roundTo2Decimals(rB.grand_total - rA.grand_total),
          margin_diff: roundTo2Decimals(rB.margin_pct - rA.margin_pct),
        };
      }
    }

    it('snapshots previous version when revising and increments version monotonically', () => {
      const store = new MockQuotationVersioningStore();
      const initial = store.createQuotation({
        id: 'QTN-001',
        quotation_number: 'QT/2026-27/0001',
        items: [{ product_name: '75-inch IFP', selling_price: 150000, quantity: 1 }],
        subtotal: 150000,
        taxable_amount: 150000,
        grand_total: 177000,
        margin_pct: 25,
        status: 'Sent',
      });

      assert.equal(initial.version, 1);
      assert.equal(initial.version_tag, 'v1');

      // Create revision 2
      const res = store.reviseQuotation(
        'QTN-001',
        {
          items: [{ product_name: '75-inch IFP', selling_price: 140000, quantity: 1 }],
          subtotal: 140000,
          taxable_amount: 140000,
          grand_total: 165200,
          margin_pct: 20,
        },
        'Client requested 10k price concession',
        'Dheeraj Sharma'
      );

      assert.equal(res.quote.version, 2);
      assert.equal(res.quote.version_tag, 'v2');
      assert.equal(res.quote.versions.length, 1);
      assert.equal(res.quote.versions[0].version_number, 1);
      assert.equal(res.quote.versions[0].grand_total, 177000);

      // Compare revisions
      const comparison = store.compareRevisions('QTN-001', 1, 2);
      assert.equal(comparison.grand_total_diff, -11800); // 165,200 - 177,000
      assert.equal(comparison.margin_diff, -5); // 20 - 25
    });
  });

});
