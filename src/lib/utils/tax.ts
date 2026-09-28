/**
 * Centralized Indian GST & Tax Calculation Engine
 * Compliant with GST Rule 46 and Inter-State Tax laws.
 * Pre-engineered for future NIC E-Invoice and E-Way Bill API integration.
 */

export interface TaxCalculationParams {
  subtotal: number;
  discount_amount?: number;
  gst_rate?: number; // E.g. 0, 5, 12, 18, 28
  hsn_sac?: string;
  customer_gstin?: string | null;
  billing_state_code?: string | null;
  shipping_state_code?: string | null;
  shipping_state_name?: string | null;
  is_sez?: boolean; // Special Economic Zone (Zero-rated)
  company_state_code?: string | null; // Defaults to '36' (Telangana)
  is_tax_inclusive?: boolean; // True if subtotal includes GST
}

export interface TaxCalculationResult {
  taxable_amount: number;
  gst_rate: number;
  is_interstate: boolean;
  is_sez: boolean;
  is_utgst: boolean;
  place_of_supply: string;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  utgst_rate: number;
  utgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_gst_amount: number;
  grand_total: number;
  hsn_sac: string;
}

export interface DocumentItemTaxInput {
  hsn_sac?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  discount_percent?: number;
  gst_rate?: number;
  is_tax_inclusive?: boolean;
}

export interface HsnTaxSummary {
  hsn_sac: string;
  taxable_amount: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  utgst_amount: number;
  igst_amount: number;
  total_tax: number;
}

export interface DocumentTaxCalculationResult {
  subtotal: number;
  total_discount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  utgst_amount: number;
  igst_amount: number;
  total_tax_amount: number;
  round_off: number;
  grand_total: number;
  is_interstate: boolean;
  is_sez: boolean;
  place_of_supply: string;
  hsn_summary: HsnTaxSummary[];
}

// Reseller Established HSN/SAC Master with default GST rates
export const HSN_SAC_RATES: Record<string, { description: string; defaultGstRate: number; isService: boolean }> = {
  '85286900': { description: 'Projectors / Laser AV Equipment', defaultGstRate: 18, isService: false },
  '85285200': { description: 'Interactive Flat Panels (IFP) / Monitors', defaultGstRate: 18, isService: false },
  '85182200': { description: 'Commercial Audio Zone Speakers / Amps', defaultGstRate: 18, isService: false },
  '85258900': { description: 'CCTV / Video Conference PTZ Cameras', defaultGstRate: 18, isService: false },
  '85176290': { description: 'Enterprise Networking Switches / Routers', defaultGstRate: 18, isService: false },
  '84713010': { description: 'Commercial Laptops & Servers', defaultGstRate: 18, isService: false },
  '85444290': { description: 'Cabling / Connectors / HDMI / Fiber', defaultGstRate: 18, isService: false },
  '847330': { description: 'Computer Parts & Server Memory / Storage', defaultGstRate: 18, isService: false },
  '998313': { description: 'IT Consulting & Systems Integration', defaultGstRate: 18, isService: true },
  '998719': { description: 'AV / IT AMC & Repair Services', defaultGstRate: 18, isService: true },
  '997331': { description: 'AV Equipment Rental Services', defaultGstRate: 18, isService: true },
  '998729': { description: 'Installation & Commissioning Services', defaultGstRate: 18, isService: true },
};

export const TELANGANA_STATE_CODE = '36';

// Indian Union Territories without legislature: UTGST applies instead of SGST
export const UT_WITHOUT_LEGISLATURE = new Set(['35', '04', '26', '38', '31']);

/**
 * Calculates accurate CGST, SGST, UTGST, and IGST for any transaction.
 * Tax is never hard-coded and supports configurable company state.
 */
export function calculateTax(params: TaxCalculationParams): TaxCalculationResult {
  const hsn = (params.hsn_sac || '85286900').trim();
  const defaultRate = HSN_SAC_RATES[hsn]?.defaultGstRate ?? 18;
  const gstRate = params.gst_rate !== undefined ? params.gst_rate : defaultRate;

  // Resolve Company State Code (Default to Telangana 36)
  const companyState = (params.company_state_code || TELANGANA_STATE_CODE).trim();

  // Resolve State Codes & Place of Supply
  const rawStateCode = (params.shipping_state_code || params.billing_state_code || '').trim();
  const rawStateName = (params.shipping_state_name || '').trim().toLowerCase();

  let resolvedStateCode = rawStateCode;
  if (!resolvedStateCode && params.customer_gstin && params.customer_gstin.length >= 2) {
    resolvedStateCode = params.customer_gstin.substring(0, 2);
  }

  // Determine Inter-State status vs Intra-State
  const isInterstate = Boolean(
    resolvedStateCode
      ? resolvedStateCode !== companyState
      : rawStateName !== '' && !rawStateName.includes('telangana')
  );

  const isSez = Boolean(params.is_sez);
  const isUtgst = !isInterstate && UT_WITHOUT_LEGISLATURE.has(resolvedStateCode || companyState);

  const placeOfSupply = resolvedStateCode
    ? `${resolvedStateCode} - ${rawStateName ? rawStateName.toUpperCase() : 'OTHER STATE'}`
    : rawStateName
    ? rawStateName.toUpperCase()
    : `${companyState} - TELANGANA`;

  const grossSubtotal = Math.max(0, (params.subtotal || 0) - (params.discount_amount || 0));

  let taxableAmount = grossSubtotal;
  let totalGstAmount = 0;

  if (isSez || gstRate === 0) {
    // SEZ supplies zero-rated under LUT
    return {
      taxable_amount: Number(taxableAmount.toFixed(2)),
      gst_rate: 0,
      is_interstate: isInterstate,
      is_sez: isSez,
      is_utgst: false,
      place_of_supply: placeOfSupply,
      cgst_rate: 0,
      cgst_amount: 0,
      sgst_rate: 0,
      sgst_amount: 0,
      utgst_rate: 0,
      utgst_amount: 0,
      igst_rate: 0,
      igst_amount: 0,
      total_gst_amount: 0,
      grand_total: Number(taxableAmount.toFixed(2)),
      hsn_sac: hsn,
    };
  }

  if (params.is_tax_inclusive) {
    // Backward calculate taxable amount from inclusive total
    taxableAmount = Number((grossSubtotal / (1 + gstRate / 100)).toFixed(2));
    totalGstAmount = Number((grossSubtotal - taxableAmount).toFixed(2));
  } else {
    taxableAmount = Number(grossSubtotal.toFixed(2));
    totalGstAmount = Number(((taxableAmount * gstRate) / 100).toFixed(2));
  }

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let utgstRate = 0;
  let utgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (isInterstate) {
    igstRate = gstRate;
    igstAmount = totalGstAmount;
  } else if (isUtgst) {
    cgstRate = gstRate / 2;
    utgstRate = gstRate / 2;
    cgstAmount = Number((totalGstAmount / 2).toFixed(2));
    utgstAmount = Number((totalGstAmount - cgstAmount).toFixed(2));
  } else {
    cgstRate = gstRate / 2;
    sgstRate = gstRate / 2;
    cgstAmount = Number((totalGstAmount / 2).toFixed(2));
    sgstAmount = Number((totalGstAmount - cgstAmount).toFixed(2));
  }

  const grandTotal = params.is_tax_inclusive
    ? grossSubtotal
    : Number((taxableAmount + totalGstAmount).toFixed(2));

  return {
    taxable_amount: taxableAmount,
    gst_rate: gstRate,
    is_interstate: isInterstate,
    is_sez: isSez,
    is_utgst: isUtgst,
    place_of_supply: placeOfSupply,
    cgst_rate: cgstRate,
    cgst_amount: cgstAmount,
    sgst_rate: sgstRate,
    sgst_amount: sgstAmount,
    utgst_rate: utgstRate,
    utgst_amount: utgstAmount,
    igst_rate: igstRate,
    igst_amount: igstAmount,
    total_gst_amount: totalGstAmount,
    grand_total: grandTotal,
    hsn_sac: hsn,
  };
}

/**
 * Multi-Item Document Tax Calculation Engine.
 * Aggregates line items, handles discount, computes rounding off and HSN summary table.
 */
export function calculateDocumentTaxes(
  items: DocumentItemTaxInput[],
  options?: {
    company_state_code?: string;
    customer_gstin?: string;
    shipping_state_code?: string;
    shipping_state_name?: string;
    is_sez?: boolean;
  }
): DocumentTaxCalculationResult {
  let subtotal = 0;
  let totalDiscount = 0;
  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let utgstAmount = 0;
  let igstAmount = 0;

  const hsnMap: Record<string, HsnTaxSummary> = {};
  let isInterstate = false;
  let placeOfSupply = '36 - TELANGANA';

  for (const item of items) {
    const rawItemSubtotal = item.quantity * item.unit_price;
    const discount = item.discount_amount || (item.discount_percent ? (rawItemSubtotal * item.discount_percent) / 100 : 0);
    const itemSubtotal = rawItemSubtotal - discount;

    subtotal += rawItemSubtotal;
    totalDiscount += discount;

    const itemTax = calculateTax({
      subtotal: itemSubtotal,
      gst_rate: item.gst_rate,
      hsn_sac: item.hsn_sac,
      customer_gstin: options?.customer_gstin,
      shipping_state_code: options?.shipping_state_code,
      shipping_state_name: options?.shipping_state_name,
      company_state_code: options?.company_state_code,
      is_sez: options?.is_sez,
      is_tax_inclusive: item.is_tax_inclusive,
    });

    isInterstate = itemTax.is_interstate;
    placeOfSupply = itemTax.place_of_supply;

    taxableAmount += itemTax.taxable_amount;
    cgstAmount += itemTax.cgst_amount;
    sgstAmount += itemTax.sgst_amount;
    utgstAmount += itemTax.utgst_amount;
    igstAmount += itemTax.igst_amount;

    const hsnKey = itemTax.hsn_sac;
    if (!hsnMap[hsnKey]) {
      hsnMap[hsnKey] = {
        hsn_sac: hsnKey,
        taxable_amount: 0,
        gst_rate: itemTax.gst_rate,
        cgst_amount: 0,
        sgst_amount: 0,
        utgst_amount: 0,
        igst_amount: 0,
        total_tax: 0,
      };
    }
    hsnMap[hsnKey].taxable_amount = Number((hsnMap[hsnKey].taxable_amount + itemTax.taxable_amount).toFixed(2));
    hsnMap[hsnKey].cgst_amount = Number((hsnMap[hsnKey].cgst_amount + itemTax.cgst_amount).toFixed(2));
    hsnMap[hsnKey].sgst_amount = Number((hsnMap[hsnKey].sgst_amount + itemTax.sgst_amount).toFixed(2));
    hsnMap[hsnKey].utgst_amount = Number((hsnMap[hsnKey].utgst_amount + itemTax.utgst_amount).toFixed(2));
    hsnMap[hsnKey].igst_amount = Number((hsnMap[hsnKey].igst_amount + itemTax.igst_amount).toFixed(2));
    hsnMap[hsnKey].total_tax = Number((hsnMap[hsnKey].total_tax + itemTax.total_gst_amount).toFixed(2));
  }

  const totalTaxAmount = Number((cgstAmount + sgstAmount + utgstAmount + igstAmount).toFixed(2));
  const exactGrandTotal = taxableAmount + totalTaxAmount;
  const roundedGrandTotal = Math.round(exactGrandTotal);
  const roundOff = Number((roundedGrandTotal - exactGrandTotal).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    total_discount: Number(totalDiscount.toFixed(2)),
    taxable_amount: Number(taxableAmount.toFixed(2)),
    cgst_amount: Number(cgstAmount.toFixed(2)),
    sgst_amount: Number(sgstAmount.toFixed(2)),
    utgst_amount: Number(utgstAmount.toFixed(2)),
    igst_amount: Number(igstAmount.toFixed(2)),
    total_tax_amount: totalTaxAmount,
    round_off: roundOff,
    grand_total: roundedGrandTotal,
    is_interstate: isInterstate,
    is_sez: Boolean(options?.is_sez),
    place_of_supply: placeOfSupply,
    hsn_summary: Object.values(hsnMap),
  };
}

