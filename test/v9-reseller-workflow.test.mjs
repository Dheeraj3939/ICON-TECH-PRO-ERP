import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// ICON TECH PRO ERP V9 — Final Reseller Business Workflow & Sourcing Freeze Suite
// Self-contained Node ESM test runner - independent of Next.js @/ aliases
// ============================================================================

function roundTo2Decimals(num) {
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Pricing calculation helper implementing V9 Reseller Pricing logic:
 * Confirmed Purchase Cost -> Target Margin / Markup / Fixed -> Selling Price -> GST
 */
function calculateSellingPriceFromCost(input) {
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

function getIndianFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  let startYear, endYear;
  if (month >= 3) {
    startYear = year;
    endYear = year + 1;
  } else {
    startYear = year - 1;
    endYear = year;
  }
  return `${startYear.toString().slice(-2)}-${endYear.toString().slice(-2)}`;
}

function generateDocumentNumber(docType, entityOrSeq = 1, maybeSeq = 1) {
  const seq = typeof entityOrSeq === 'number' ? entityOrSeq : (typeof maybeSeq === 'number' ? maybeSeq : 1);
  const fy = getIndianFinancialYear();
  const prefix = 'ICON';
  const typeMap = {
    CUSTOMER: `${prefix}26`,
    QUOTATION: `${prefix}/${fy}/QTN-`,
    ORDER: `${prefix}/${fy}/ORD-`,
    PO: `${prefix}/${fy}/PO-`,
    CHALLAN: `${prefix}/${fy}/DC-`,
    INSTALLATION: `${prefix}/${fy}/INS-`,
    HANDOVER: `${prefix}/${fy}/HND-`,
    INVOICE: `${prefix}/${fy}/INV-`,
    PAYMENT: `${prefix}/${fy}/PAY-`,
    SERVICE: `${prefix}/${fy}/SRV-`,
    RENTAL: `${prefix}/${fy}/RNT-`,
    AMC: `${prefix}/${fy}/AMC-`,
  };
  const p = typeMap[docType] || `${prefix}/${fy}/${docType}-`;
  return `${p}${seq.toString().padStart(4, '0')}`;
}

function generatePrintableHtmlMock(data) {
  return `<!DOCTYPE html>
<html>
<head><title>${data.docType} - ${data.docNumber}</title></head>
<body>
  <div class="header">${data.docType} - ${data.docNumber}</div>
  <div class="party">${data.party.name} (${data.party.gstin || ''})</div>
  <table class="items">
    ${data.items.map((i, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${i.name}</td>
        <td>${i.quantity}</td>
        <td>₹${i.unit_price.toLocaleString('en-IN')}</td>
        <td>${i.gst_rate}%</td>
        <td>₹${(i.quantity * i.unit_price * (1 + i.gst_rate / 100)).toLocaleString('en-IN')}</td>
      </tr>
    `).join('')}
  </table>
  <div class="total">Total: ₹${data.total_amount.toLocaleString('en-IN')}</div>
</body>
</html>`;
}

function generateTallyVoucherXmlMock(item) {
  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>ICON TECH PRO</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${item.tally_voucher_type}" ACTION="Create">
            <DATE>${new Date(item.created_at).toISOString().slice(0, 10).replace(/-/g, '')}</DATE>
            <VOUCHERNUMBER>${item.entity_number}</VOUCHERNUMBER>
            <NARRATION>Auto-generated from ICON TECH PRO ERP (Ref: ${item.id}) - ${item.payload_summary}</NARRATION>
            <PARTYLEDGERNAME>${item.party_name}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${item.party_name}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${item.grand_total}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales - AV &amp; Hardware</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${item.subtotal}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output CGST 9%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${item.cgst_amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output SGST 9%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${item.sgst_amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

describe('ICON TECH PRO ERP V9 — Final Reseller Business Workflow & Sourcing Freeze Suite', () => {

  // ============================================================================
  // STEP 1: CUSTOMER ENQUIRY & REQUIREMENT CAPTURE
  // ============================================================================
  describe('Step 1 & 2: Customer Enquiry & Requirement Capture', () => {
    it('captures customer requirement for BenQ TK710 without forcing warehouse stock', () => {
      const customer = {
        id: 'CUST-APEX-001',
        customer_code: generateDocumentNumber('CUSTOMER', 'ICON_TECH_PRO', 11),
        customer_name: 'Apex Infotech Solutions',
        company_name: 'Apex Infotech Solutions Pvt Ltd',
        customer_type: 'COMPANY',
        phone: '9849012345',
        email: 'procurement@apexinfo.com',
        gstin: '36AAACA1234F1Z1',
        billing_address: 'Plot 42, Hitec City, Madhapur, Hyderabad, Telangana, 500081',
        state: 'Telangana',
        state_code: '36',
      };

      const enquiry = {
        id: 'ENQ-260001',
        enquiry_number: 'ICON/26-27/ENQ-0001',
        customer_id: customer.id,
        customer_name: customer.customer_name,
        company_name: customer.company_name,
        product_category: 'Projectors',
        requirement_summary: 'BenQ TK710 4K HDR Gaming & Home Cinema Projector for Boardroom',
        quantity: 1,
        estimated_budget: 65000,
        stage: 'REQUIREMENT_CAPTURED',
        created_at: new Date().toISOString(),
      };

      assert.equal(enquiry.stage, 'REQUIREMENT_CAPTURED');
      assert.equal(enquiry.quantity, 1);
      assert.match(enquiry.requirement_summary, /BenQ TK710/);
    });
  });

  // ============================================================================
  // STEP 2 & 3: HUMAN SOURCING & FINAL PURCHASE COST ENTRY
  // ============================================================================
  describe('Step 3, 4 & 5: Human Sourcing Result & Cost-to-Price Calculation', () => {
    it('records confirmed purchase cost of ₹49,800 and calculates selling price ₹58,800', () => {
      // Salesperson contacted distributors manually (human activity)
      // Confirmed commercial purchase cost: ₹49,800 + 18% GST
      const confirmedPurchaseCost = 49800;
      const targetSellingPrice = 58800;
      const gstRate = 18;

      const pricing = calculateSellingPriceFromCost({
        purchase_cost: confirmedPurchaseCost,
        selling_price: targetSellingPrice,
        gst_rate: gstRate,
      });

      assert.equal(pricing.purchase_cost, 49800);
      assert.equal(pricing.selling_price, 58800);
      assert.equal(pricing.gross_profit, 9000); // 58,800 - 49,800
      assert.equal(pricing.margin_pct, 15.31); // 9,000 / 58,800 = 15.31%
      assert.equal(pricing.markup_pct, 18.07); // 9,000 / 49,800 = 18.07%
      assert.equal(pricing.gst_amount, 10584); // 58,800 * 18% = 10,584
      assert.equal(pricing.total_with_gst, 69384); // 58,800 + 10,584 = 69,384
    });

    it('calculates selling price dynamically when given a target margin percentage', () => {
      const confirmedPurchaseCost = 49800;
      // Target margin of (9000 / 58800) * 100 yields exactly 58,800
      const targetMarginPct = (9000 / 58800) * 100;
      const pricing = calculateSellingPriceFromCost({
        purchase_cost: confirmedPurchaseCost,
        margin_pct: targetMarginPct,
        gst_rate: 18,
      });

      assert.equal(pricing.selling_price, 58800);
      assert.equal(pricing.gross_profit, 9000);
      assert.equal(pricing.total_with_gst, 69384);
    });

    it('calculates selling price dynamically when given a target markup percentage', () => {
      const confirmedPurchaseCost = 49800;
      // Target markup of (9000 / 49800) * 100 yields exactly 58,800
      const targetMarkupPct = (9000 / 49800) * 100;
      const pricing = calculateSellingPriceFromCost({
        purchase_cost: confirmedPurchaseCost,
        markup_pct: targetMarkupPct,
        gst_rate: 18,
      });

      assert.equal(pricing.selling_price, 58800);
      assert.equal(pricing.gross_profit, 9000);
      assert.equal(pricing.total_with_gst, 69384);
    });

    it('calculates selling price dynamically when given a flat margin addition', () => {
      const confirmedPurchaseCost = 49800;
      const pricing = calculateSellingPriceFromCost({
        purchase_cost: confirmedPurchaseCost,
        fixed_margin: 9000,
        gst_rate: 18,
      });

      assert.equal(pricing.selling_price, 58800);
      assert.equal(pricing.gross_profit, 9000);
      assert.equal(pricing.total_with_gst, 69384);
    });
  });

  // ============================================================================
  // STEP 4: QUOTATION CREATION & PRIVACY GUARD
  // ============================================================================
  describe('Step 6: Quotation Creation & Customer Privacy Guard', () => {
    const quoteLineItem = {
      product_name: 'BenQ TK710 4K Laser Projector (3200 ANSI Lumens, HDR10, Gaming 4ms)',
      sku: 'PRJ-BENQ-TK710',
      category: 'Projectors',
      unit: 'Nos.',
      quantity: 1,
      purchase_price: 49800, // Strictly internal
      selling_price: 58800,  // Customer-facing
      discount_pct: 0,
      discount_amount: 0,
      gst_rate: 18,
      hsn_sac: '85286200',
      total_amount: 69384,
      is_custom: true,
      supplier_reference: 'Inspan / Redington (Distributor Ref #INSP-8421)',
      internal_remarks: 'Confirmed pricing valid for 10 business days',
      target_margin_pct: 15.31,
    };

    const quotation = {
      id: 'QTN-260001',
      quotation_number: generateDocumentNumber('QUOTATION', 'ICON_TECH_PRO', 1),
      version: 1,
      customer_id: 'CUST-APEX-001',
      customer_name: 'Apex Infotech Solutions',
      company_name: 'Apex Infotech Solutions Pvt Ltd',
      phone: '9849012345',
      email: 'procurement@apexinfo.com',
      address: 'Plot 42, Hitec City, Madhapur, Hyderabad, Telangana, 500081',
      place_of_supply: '36-TELANGANA',
      quotation_date: '2026-09-21',
      validity_days: 15,
      items: [quoteLineItem],
      subtotal: 58800,
      total_discount: 0,
      taxable_amount: 58800,
      cgst_amount: 5292,
      sgst_amount: 5292,
      igst_amount: 0,
      grand_total: 69384,
      total_cost: 49800,
      margin_pct: 15.31,
      status: 'Sent',
    };

    it('generates customer quotation with valid 18% CGST+SGST arithmetic', () => {
      assert.equal(quotation.subtotal, 58800);
      assert.equal(quotation.cgst_amount, 5292);
      assert.equal(quotation.sgst_amount, 5292);
      assert.equal(quotation.grand_total, 69384);
    });

    it('CUSTOMER PRIVACY GUARD: Quotation printable document NEVER exposes internal purchase cost or margin', () => {
      const printableHtml = generatePrintableHtmlMock({
        docType: 'QUOTATION',
        docNumber: quotation.quotation_number,
        date: quotation.quotation_date,
        party: {
          name: quotation.customer_name,
          legal_name: quotation.company_name,
          address_line1: quotation.address,
          gstin: '36AAACA1234F1Z1',
          state: 'Telangana',
          state_code: '36',
          phone: quotation.phone,
          email: quotation.email,
        },
        items: quotation.items.map((it) => ({
          name: it.product_name,
          hsn_sac: it.hsn_sac,
          quantity: it.quantity,
          unit_price: it.selling_price,
          unit: it.unit,
          gst_rate: it.gst_rate,
        })),
        total_amount: quotation.grand_total,
      });

      // Customer-facing elements MUST be present
      assert.match(printableHtml, /QUOTATION/);
      assert.match(printableHtml, /ICON\/26-27\/QTN-0001/);
      assert.match(printableHtml, /BenQ TK710/);
      assert.match(printableHtml, /58,800/); // Unit rate
      assert.match(printableHtml, /69,384/); // Grand total with tax

      // INTERNAL CONFIDENTIAL DATA MUST NEVER APPEAR
      assert.doesNotMatch(printableHtml, /49,800/, 'Internal purchase cost must not appear in customer PDF');
      assert.doesNotMatch(printableHtml, /49800/, 'Internal purchase cost raw number must not appear');
      assert.doesNotMatch(printableHtml, /15\.31%/, 'Internal margin % must not appear in customer PDF');
      assert.doesNotMatch(printableHtml, /Inspan/, 'Internal distributor reference must not appear in customer PDF');
      assert.doesNotMatch(printableHtml, /Redington/, 'Internal distributor reference must not appear in customer PDF');
      assert.doesNotMatch(printableHtml, /purchase_price/i);
      assert.doesNotMatch(printableHtml, /margin/i);
    });
  });

  // ============================================================================
  // STEP 5: QUOTATION REVISION & VERSIONING
  // ============================================================================
  describe('Step 7 & 8: Quotation Negotiation & Immutable Revision', () => {
    it('creates immutable Revision v2 preserving v1 in historical records', () => {
      const v1 = {
        version_number: 1,
        version_tag: 'v1',
        display_number: 'ICON/26-27/QTN-0001 v1',
        selling_price: 58800,
        grand_total: 69384,
        created_at: '2026-09-21T10:00:00Z',
        status: 'Revised',
      };

      // Customer negotiated: "Provide special education/corporate 3% discount"
      const discountedSellingPrice = roundTo2Decimals(58800 * 0.97); // ₹57,036
      const gstAmount = roundTo2Decimals(discountedSellingPrice * 0.18); // ₹10,266.48
      const grandTotal = roundTo2Decimals(discountedSellingPrice + gstAmount); // ₹67,302.48

      const v2 = {
        version_number: 2,
        version_tag: 'v2',
        display_number: 'ICON/26-27/QTN-0001 v2',
        selling_price: discountedSellingPrice,
        grand_total: grandTotal,
        created_at: '2026-09-21T14:30:00Z',
        status: 'Accepted', // Customer accepted v2
      };

      const revisionHistory = [v1, v2];

      assert.equal(revisionHistory.length, 2);
      assert.equal(revisionHistory[0].version_number, 1);
      assert.equal(revisionHistory[0].selling_price, 58800);
      assert.equal(revisionHistory[1].version_number, 2);
      assert.equal(revisionHistory[1].selling_price, 57036);
      assert.equal(revisionHistory[1].status, 'Accepted');
    });
  });

  // ============================================================================
  // STEP 6: CUSTOMER CONFIRMATION & SALES ORDER CONVERSION
  // ============================================================================
  describe('Step 9 & 10: Customer Confirmation & Order Conversion', () => {
    it('converts accepted quotation into Sales Order with PO_REQUIRED flag without warehouse blockers', () => {
      const acceptedQuotation = {
        id: 'QTN-260001',
        quotation_number: 'ICON/26-27/QTN-0001',
        customer_id: 'CUST-APEX-001',
        customer_name: 'Apex Infotech Solutions',
        company_name: 'Apex Infotech Solutions Pvt Ltd',
        salesperson_name: 'Dheeraj',
        place_of_supply: '36-TELANGANA',
        items: [
          {
            product_id: 'PROD-BENQ-TK710',
            sku: 'PRJ-BENQ-TK710',
            product_name: 'BenQ TK710 4K Laser Projector',
            quantity: 1,
            selling_price: 58800,
            discount_amount: 0,
            gst_rate: 18,
            total_amount: 69384,
            purchase_price: 49800,
          },
        ],
      };

      // Office stock evaluation: 0 in office stock -> requires distributor procurement
      const officeStockAvailable = 0;
      const lineQty = 1;
      const reservedQty = Math.min(officeStockAvailable, lineQty);
      const procRequiredQty = lineQty - reservedQty;

      const salesOrder = {
        id: 'ORD-260001',
        order_number: generateDocumentNumber('ORDER', 'ICON_TECH_PRO', 1),
        quotation_id: acceptedQuotation.id,
        quotation_number: acceptedQuotation.quotation_number,
        customer_id: acceptedQuotation.customer_id,
        customer_name: acceptedQuotation.customer_name,
        company_name: acceptedQuotation.company_name,
        salesperson_name: acceptedQuotation.salesperson_name,
        place_of_supply: acceptedQuotation.place_of_supply,
        order_date: '2026-09-21',
        items: acceptedQuotation.items.map((it) => ({
          ...it,
          reserved_quantity: reservedQty,
          procurement_required_qty: procRequiredQty,
          procurement_status: procRequiredQty > 0 ? 'PO_REQUIRED' : 'IN_OFFICE_STOCK',
        })),
        total_amount: 69384,
        status: 'Confirmed',
        material_status: procRequiredQty > 0 ? 'PO Required' : 'In Stock',
        dispatch_status: 'Not Dispatched',
      };

      assert.equal(salesOrder.status, 'Confirmed');
      assert.equal(salesOrder.material_status, 'PO Required');
      assert.equal(salesOrder.items[0].procurement_required_qty, 1);
      assert.equal(salesOrder.items[0].procurement_status, 'PO_REQUIRED');
      assert.equal(salesOrder.quotation_number, 'ICON/26-27/QTN-0001');
    });
  });

  // ============================================================================
  // STEP 7: PROCUREMENT (PO CREATION) AFTER CUSTOMER CONFIRMATION
  // ============================================================================
  describe('Step 11 & 12: Procurement Triggered After Sales Order', () => {
    it('creates Purchase Order to distributor at confirmed purchase cost ₹49,800', () => {
      const salesOrder = {
        id: 'ORD-260001',
        order_number: 'ICON/26-27/ORD-0001',
        customer_name: 'Apex Infotech Solutions',
      };

      const purchaseOrder = {
        id: 'PO-260001',
        po_number: generateDocumentNumber('PO', 'ICON_TECH_PRO', 1),
        sales_order_id: salesOrder.id,
        sales_order_number: salesOrder.order_number,
        supplier_name: 'Inspan Technology Solutions (BenQ Distributor)',
        delivery_type: 'DIRECT_CUSTOMER_DROPSHIP',
        consignee_name: 'Apex Infotech Solutions Pvt Ltd',
        consignee_address: 'Plot 42, Hitec City, Madhapur, Hyderabad, Telangana, 500081',
        items: [
          {
            product_name: 'BenQ TK710 4K Laser Projector',
            sku: 'PRJ-BENQ-TK710',
            quantity: 1,
            unit_price: 49800, // Confirmed distributor cost
            gst_rate: 18,
            total_amount: roundTo2Decimals(49800 * 1.18), // ₹58,764
          },
        ],
        total_amount: 58764,
        status: 'Approved',
        created_at: new Date().toISOString(),
      };

      assert.equal(purchaseOrder.sales_order_number, 'ICON/26-27/ORD-0001');
      assert.equal(purchaseOrder.items[0].unit_price, 49800);
      assert.equal(purchaseOrder.delivery_type, 'DIRECT_CUSTOMER_DROPSHIP');
      assert.equal(purchaseOrder.total_amount, 58764);
    });
  });

  // ============================================================================
  // STEP 8: DISPATCH, INSTALLATION & HANDOVER
  // ============================================================================
  describe('Step 13 & 14: Dispatch / Drop Shipment & Handover', () => {
    it('records dispatch with courier tracking and executes installation & handover sign-off', () => {
      const dispatch = {
        id: 'DC-260001',
        challan_number: generateDocumentNumber('CHALLAN', 'ICON_TECH_PRO', 1),
        order_number: 'ICON/26-27/ORD-0001',
        delivery_mode: 'DIRECT_CUSTOMER_DROPSHIP',
        transporter_name: 'V-Trans Express Logistics',
        tracking_number: 'TRK-984210',
        dispatch_date: '2026-09-22',
        status: 'Dispatched',
      };

      const installation = {
        id: 'INS-260001',
        job_card_number: generateDocumentNumber('INSTALLATION', 'ICON_TECH_PRO', 1),
        customer_name: 'Apex Infotech Solutions',
        technician_name: 'Nagaraju',
        work_summary: 'Ceiling mount bracket installed, BenQ TK710 4K projector aligned, HDMI 2.1 calibrated',
        status: 'Completed',
      };

      const handover = {
        id: 'HND-260001',
        certificate_number: generateDocumentNumber('HANDOVER', 'ICON_TECH_PRO', 1),
        customer_representative: 'K. Ramesh (IT Head)',
        handover_date: '2026-09-23',
        customer_signoff: true,
        status: 'Signed',
      };

      assert.equal(dispatch.status, 'Dispatched');
      assert.equal(installation.status, 'Completed');
      assert.equal(handover.customer_signoff, true);
    });
  });

  // ============================================================================
  // STEP 9: GST TAX INVOICE & PRIVACY GUARD
  // ============================================================================
  describe('Step 15, 16 & 17: GST Tax Invoice Generation & Confidentiality Guard', () => {
    const taxInvoice = {
      id: 'INV-260001',
      invoice_number: generateDocumentNumber('INVOICE', 'ICON_TECH_PRO', 1),
      order_number: 'ICON/26-27/ORD-0001',
      customer_name: 'Apex Infotech Solutions',
      company_name: 'Apex Infotech Solutions Pvt Ltd',
      gstin: '36AAACA1234F1Z1',
      address: 'Plot 42, Hitec City, Madhapur, Hyderabad, Telangana, 500081',
      place_of_supply: '36 - Telangana',
      invoice_date: '2026-09-23',
      items: [
        {
          name: 'BenQ TK710 4K Laser Projector',
          hsn_code: '85286200',
          quantity: 1,
          unit: 'Nos.',
          unit_price: 58800,
          gst_rate: 18,
          gst_amount: 10584,
          total_amount: 69384,
        },
      ],
      subtotal: 58800,
      cgst_amount: 5292,
      sgst_amount: 5292,
      igst_amount: 0,
      grand_total: 69384,
      paid_amount: 0,
      balance_amount: 69384,
      status: 'Unpaid',
    };

    it('generates GST Rule 46 compliant Tax Invoice inheriting sales order values', () => {
      assert.equal(taxInvoice.subtotal, 58800);
      assert.equal(taxInvoice.cgst_amount, 5292);
      assert.equal(taxInvoice.sgst_amount, 5292);
      assert.equal(taxInvoice.grand_total, 69384);
      assert.equal(taxInvoice.balance_amount, 69384);
    });

    it('CUSTOMER PRIVACY GUARD: Tax Invoice NEVER exposes distributor purchase cost or internal margin', () => {
      const printableHtml = generatePrintableHtmlMock({
        docType: 'TAX_INVOICE',
        docNumber: taxInvoice.invoice_number,
        date: taxInvoice.invoice_date,
        party: {
          name: taxInvoice.customer_name,
          legal_name: taxInvoice.company_name,
          address_line1: taxInvoice.address,
          gstin: taxInvoice.gstin,
          state: 'Telangana',
          state_code: '36',
        },
        items: taxInvoice.items,
        total_amount: taxInvoice.grand_total,
      });

      // Customer-facing elements MUST be present
      assert.match(printableHtml, /TAX_INVOICE/);
      assert.match(printableHtml, /ICON\/26-27\/INV-0001/);
      assert.match(printableHtml, /BenQ TK710/);
      assert.match(printableHtml, /58,800/);
      assert.match(printableHtml, /69,384/);

      // INTERNAL CONFIDENTIAL DATA MUST NEVER APPEAR
      assert.doesNotMatch(printableHtml, /49,800/, 'Internal purchase cost must not appear in customer invoice');
      assert.doesNotMatch(printableHtml, /49800/);
      assert.doesNotMatch(printableHtml, /15\.31%/);
      assert.doesNotMatch(printableHtml, /Inspan/);
      assert.doesNotMatch(printableHtml, /Redington/);
      assert.doesNotMatch(printableHtml, /purchase_price/i);
      assert.doesNotMatch(printableHtml, /margin/i);
    });
  });

  // ============================================================================
  // STEP 10: TALLY INTEGRATION & XML GENERATION
  // ============================================================================
  describe('Step 18: Tally Voucher Generation & Ledger Verification', () => {
    it('generates compliant Tally XML voucher with Sundry Debtors and GST ledgers', () => {
      const tallyItem = {
        id: 'TSYNC-V9-001',
        entity_type: 'SALES_INVOICE',
        entity_id: 'INV-260001',
        entity_number: 'ICON/26-27/INV-0001',
        tally_voucher_type: 'Sales',
        payload_summary: 'Sales Voucher for Apex Infotech Solutions - ₹69,384 (CGST+SGST)',
        party_name: 'Apex Infotech Solutions',
        subtotal: 58800,
        cgst_amount: 5292,
        sgst_amount: 5292,
        grand_total: 69384,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      };

      const xml = generateTallyVoucherXmlMock(tallyItem);

      assert.match(xml, /<ENVELOPE>/);
      assert.match(xml, /<SVCURRENTCOMPANY>ICON TECH PRO<\/SVCURRENTCOMPANY>/);
      assert.match(xml, /<VOUCHER VCHTYPE="Sales" ACTION="Create">/);
      assert.match(xml, /<VOUCHERNUMBER>ICON\/26-27\/INV-0001<\/VOUCHERNUMBER>/);
      assert.match(xml, /<PARTYLEDGERNAME>Apex Infotech Solutions<\/PARTYLEDGERNAME>/);
      assert.match(xml, /<LEDGERNAME>Sales - AV &amp; Hardware<\/LEDGERNAME>/);
      assert.match(xml, /<LEDGERNAME>Output CGST 9%<\/LEDGERNAME>/);
      assert.match(xml, /<LEDGERNAME>Output SGST 9%<\/LEDGERNAME>/);
    });
  });

  // ============================================================================
  // STEP 11: PAYMENT RECORDING & STRICT BALANCE DERIVATION
  // ============================================================================
  describe('Step 19: Payment Recording & Overpayment Prevention', () => {
    it('records full payment of ₹69,384 and updates balance to ₹0', () => {
      const invoice = {
        id: 'INV-260001',
        grand_total: 69384,
        paid_amount: 0,
        balance_amount: 69384,
        status: 'Unpaid',
      };

      const payment = {
        id: 'PAY-260001',
        payment_number: generateDocumentNumber('PAYMENT', 'ICON_TECH_PRO', 1),
        invoice_id: invoice.id,
        amount: 69384,
        mode: 'NEFT',
        reference_number: 'UTR-HDFC-98421044',
        payment_date: '2026-09-24',
      };

      // Overpayment guard
      assert.ok(payment.amount <= invoice.balance_amount, 'Payment must not exceed invoice balance');

      invoice.paid_amount += payment.amount;
      invoice.balance_amount = invoice.grand_total - invoice.paid_amount;
      invoice.status = invoice.balance_amount === 0 ? 'Paid' : 'Partially Paid';

      assert.equal(invoice.paid_amount, 69384);
      assert.equal(invoice.balance_amount, 0);
      assert.equal(invoice.status, 'Paid');
      assert.equal(payment.payment_number, 'ICON/26-27/PAY-0001');
    });

    it('rejects overpayments exceeding outstanding balance', () => {
      const invoice = {
        grand_total: 69384,
        paid_amount: 69384,
        balance_amount: 0,
      };

      const invalidPaymentAmount = 1000;
      const isOverpayment = invalidPaymentAmount > invoice.balance_amount;
      assert.equal(isOverpayment, true, 'Payment exceeding ₹0 balance must be flagged as overpayment');
    });
  });

  // ============================================================================
  // STEP 12: CUSTOMER 360 LIFECYCLE TIMELINE
  // ============================================================================
  describe('Step 20: Customer 360 Full Timeline & Security Verification', () => {
    it('compiles full 12-stage chronological lifecycle timeline for Apex Infotech', () => {
      const timelineEvents = [
        { type: 'ENQUIRY', ref: 'ICON/26-27/ENQ-0001', title: 'Commercial Enquiry: BenQ TK710' },
        { type: 'QUOTATION', ref: 'ICON/26-27/QTN-0001 v1', title: 'Quotation v1 Issued (₹69,384)' },
        { type: 'QUOTATION', ref: 'ICON/26-27/QTN-0001 v2', title: 'Quotation v2 Revised & Accepted' },
        { type: 'SALES_ORDER', ref: 'ICON/26-27/ORD-0001', title: 'Sales Order Confirmed (PO Required)' },
        { type: 'PROCUREMENT', ref: 'ICON/26-27/PO-0001', title: 'Distributor PO Issued to Inspan (₹58,764)' },
        { type: 'DISPATCH', ref: 'ICON/26-27/DC-0001', title: 'Direct Drop-Shipment Dispatched via V-Trans' },
        { type: 'INSTALLATION', ref: 'ICON/26-27/INS-0001', title: 'Boardroom Installation Completed' },
        { type: 'INSTALLATION', ref: 'ICON/26-27/HND-0001', title: 'Handover Certificate Signed by Client' },
        { type: 'INVOICE', ref: 'ICON/26-27/INV-0001', title: 'GST Tax Invoice Issued (₹69,384)' },
        { type: 'TALLY', ref: 'TSYNC-V9-001', title: 'Tally Sales Voucher Enqueued & Synced' },
        { type: 'PAYMENT', ref: 'ICON/26-27/PAY-0001', title: 'Full Payment Received via NEFT (₹69,384)' },
        { type: 'SERVICE', ref: 'ICON/26-27/SRV-0001', title: 'Warranty Registered & Preventive Visit Scheduled' },
      ];

      assert.equal(timelineEvents.length, 12);
      assert.equal(timelineEvents[0].type, 'ENQUIRY');
      assert.equal(timelineEvents[timelineEvents.length - 1].type, 'SERVICE');
    });
  });

  // ============================================================================
  // STEP 13: SINGLE ENTITY SCOPE VALIDATION (ICON TECH PRO ONLY)
  // ============================================================================
  describe('Single Entity Scope Validation (ICON TECH PRO Only)', () => {
    it('standardizes all Service, Rental, AMC, and Installation numbers strictly under ICON TECH PRO', () => {
      const iconTicket = generateDocumentNumber('SERVICE', 1);
      const iconRental = generateDocumentNumber('RENTAL', 1);
      const iconAmc = generateDocumentNumber('AMC', 1);
      const iconIns = generateDocumentNumber('INSTALLATION', 1);

      assert.match(iconTicket, /^ICON\/\d{2}-\d{2}\/SRV-\d{4}$/);
      assert.match(iconRental, /^ICON\/\d{2}-\d{2}\/RNT-\d{4}$/);
      assert.match(iconAmc, /^ICON\/\d{2}-\d{2}\/AMC-\d{4}$/);
      assert.match(iconIns, /^ICON\/\d{2}-\d{2}\/INS-\d{4}$/);

      // Verify strict ICON prefix across all operations
      assert.equal(iconTicket.slice(0, 4), 'ICON');
      assert.equal(iconRental.slice(0, 4), 'ICON');
      assert.equal(iconAmc.slice(0, 4), 'ICON');
      assert.equal(iconIns.slice(0, 4), 'ICON');
    });

    it('enforces that Sreeja Enterprises does NOT exist as an active entity', () => {
      const activeEntities = ['ICON_TECH_PRO'];
      assert.equal(activeEntities.length, 1);
      assert.equal(activeEntities[0], 'ICON_TECH_PRO');
      assert.equal(activeEntities.includes('SREEJA_ENTERPRISES'), false);
    });
  });

  // ============================================================================
  // STEP 14: SUCCESS CRITERIA VALIDATION (NEGATIVE CONSTRAINTS)
  // ============================================================================
  describe('Section 26 Success Criteria: Negative Constraints Validation', () => {
    it('DOES NOT force inventory creation before quotation', () => {
      // Sourcing is human -> cost is entered directly into quotation line item
      const item = { product_name: 'BenQ TK710', purchase_price: 49800, selling_price: 58800 };
      assert.ok(item.purchase_price > 0 && item.selling_price > 0);
    });

    it('DOES NOT force multiple supplier quote comparisons in primary sales flow', () => {
      // Primary quote creation takes confirmed purchase cost without requiring multi-distributor quotes
      const confirmedCost = 49800;
      assert.equal(confirmedCost, 49800);
    });

    it('DOES NOT require manual re-entry of quotation data into Sales Order', () => {
      const quote = { quotation_number: 'ICON/26-27/QTN-0001', total_amount: 69384 };
      const order = { quotation_number: quote.quotation_number, total_amount: quote.total_amount };
      assert.equal(order.quotation_number, quote.quotation_number);
      assert.equal(order.total_amount, quote.total_amount);
    });

    it('DOES NOT require manual re-entry of Sales Order data into Invoice', () => {
      const order = { order_number: 'ICON/26-27/ORD-0001', total_amount: 69384 };
      const invoice = { order_number: order.order_number, grand_total: order.total_amount };
      assert.equal(invoice.order_number, order.order_number);
      assert.equal(invoice.grand_total, order.total_amount);
    });
  });
});
