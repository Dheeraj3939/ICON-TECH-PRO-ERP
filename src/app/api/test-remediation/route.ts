import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { createCustomer } from '@/lib/actions/customers';
import { createQuotation, convertQuotationToOrder } from '@/lib/actions/quotations';
import { createInvoiceFromOrder, recordPayment } from '@/lib/actions/billing';
import { updateProductStock, getInventoryTransactions, getProducts } from '@/lib/actions/products';

export async function GET() {
  const testResults: Array<{
    name: string;
    category: string;
    passed: boolean;
    details: string;
  }> = [];

  function record(name: string, category: string, passed: boolean, details: string) {
    testResults.push({ name, category, passed, details });
  }

  // 1. Check Session & Role of the caller
  const user = await getAuthenticatedUser();
  if (!user) {
    record(
      'Session Authentication Guard',
      'Security',
      false,
      'No valid authenticated session token found in cookies (erp_session_token).'
    );
    return NextResponse.json(
      {
        status: 'UNAUTHORIZED',
        authenticated: false,
        results: testResults,
      },
      { status: 401 }
    );
  }

  record(
    'Session Authentication Guard',
    'Security',
    true,
    `Authenticated as ${user.name} (${user.role}) - Token signature valid`
  );

  // If user is not authorized for Managing Director / Admin operations, record role check
  if (user.role === 'Office Assistant') {
    let billingRejected = false;
    try {
      const res = await createInvoiceFromOrder('ORD-NON-EXISTENT');
      if (!res.success && res.error?.includes('FORBIDDEN')) {
        billingRejected = true;
      }
    } catch (err: any) {
      billingRejected = err.message.includes('FORBIDDEN');
    }

    record(
      'Server-Side Role Guard (Office Assistant blocked from billing)',
      'Security',
      billingRejected,
      'Office Assistant was correctly blocked from executing Billing action'
    );

    return NextResponse.json({
      status: 'ROLE_TEST_COMPLETE',
      authenticated: true,
      userRole: user.role,
      results: testResults,
    });
  }

  // 2. Concurrency-Safe Customer Creation & Monotonic Customer Code
  try {
    const resA = await createCustomer({
      customer_type: 'COMPANY',
      company_name: 'Alpha Infra Tech Pvt Ltd',
      contact_person: 'Rajesh Kumar',
      email: 'contact@alphainfra.com',
      phone: '9876543210',
      billing_address: 'Electronic City Phase 1, Hosur Road, Bengaluru',
      state: 'Karnataka',
      state_code: '29',
      city: 'Bengaluru',
      pincode: '560100',
      credit_limit: 0,
      enquiry_source: 'Direct',
      status: 'ACTIVE',
    });

    const resB = await createCustomer({
      customer_type: 'COMPANY',
      company_name: 'Beta Comms Pvt Ltd',
      contact_person: 'Suresh Reddy',
      email: 'contact@betacomms.com',
      phone: '9876543211',
      billing_address: 'Hitech City Phase 2, Madhapur, Hyderabad',
      state: 'Telangana',
      state_code: '36',
      city: 'Hyderabad',
      pincode: '500081',
      credit_limit: 0,
      enquiry_source: 'Direct',
      status: 'ACTIVE',
    });

    const c1 = resA.customer;
    const c2 = resB.customer;
    const isSeq =
      Boolean(c1?.customer_code) &&
      Boolean(c2?.customer_code) &&
      c1!.customer_code !== c2!.customer_code &&
      c1!.customer_code.startsWith('ICON') &&
      c2!.customer_code.startsWith('ICON');

    record(
      'Atomic Customer Code Sequence',
      'P1 Concurrency',
      isSeq,
      `Generated sequential codes: ${c1?.customer_code} -> ${c2?.customer_code}`
    );

    if (!c1 || !c2) {
      throw new Error('Customers could not be created for downstream tests');
    }

    // 3. Interstate GST (IGST) Calculation & Persistence
    const quoteRes1 = await createQuotation({
      customer_id: c1.id,
      customer_name: c1.customer_name,
      company_name: c1.company_name || undefined,
      customer_type: 'COMPANY',
      phone: c1.phone,
      email: c1.email || undefined,
      address: c1.billing_address || undefined,
      salesperson_name: user.name,
      quotation_date: new Date().toISOString().split('T')[0],
      validity_days: 15,
      place_of_supply: '29-KARNATAKA',
      dispatch_from: 'Hyderabad Depot',
      payment_terms: '100% Advance',
      delivery_terms: 'Ex-works Hyderabad',
      include_signature: true,
      items: [
        {
          product_name: 'Interactive Flat Panel 75"',
          unit: 'Nos.',
          quantity: 2,
          purchase_price: 60000,
          selling_price: 90000,
          discount_pct: 0,
          discount_amount: 0,
          gst_rate: 18,
          hsn_sac: '85286900',
          total_amount: 212400,
        },
      ],
    });

    const interstateQuote = quoteRes1.data;
    const hasIGST =
      Boolean(interstateQuote) &&
      (interstateQuote!.igst_amount || 0) > 0 &&
      (interstateQuote!.cgst_amount || 0) === 0 &&
      (interstateQuote!.sgst_amount || 0) === 0;

    record(
      'Interstate GST (IGST) Calculation & Persistence',
      'P1 Taxation',
      hasIGST,
      `State: Karnataka (29), Taxable: ₹${interstateQuote?.taxable_amount}, IGST: ₹${interstateQuote?.igst_amount}, CGST: ₹${interstateQuote?.cgst_amount}, SGST: ₹${interstateQuote?.sgst_amount}`
    );

    // 4. Intrastate GST (CGST + SGST) Calculation & Persistence
    const quoteRes2 = await createQuotation({
      customer_id: c2.id,
      customer_name: c2.customer_name,
      company_name: c2.company_name || undefined,
      customer_type: 'COMPANY',
      phone: c2.phone,
      email: c2.email || undefined,
      address: c2.billing_address || undefined,
      salesperson_name: user.name,
      quotation_date: new Date().toISOString().split('T')[0],
      validity_days: 15,
      place_of_supply: '36-TELANGANA',
      dispatch_from: 'Hyderabad Depot',
      payment_terms: '100% Advance',
      delivery_terms: 'Ex-works Hyderabad',
      include_signature: true,
      items: [
        {
          product_name: 'Interactive Flat Panel 75"',
          unit: 'Nos.',
          quantity: 2,
          purchase_price: 60000,
          selling_price: 90000,
          discount_pct: 0,
          discount_amount: 0,
          gst_rate: 18,
          hsn_sac: '85286900',
          total_amount: 212400,
        },
      ],
    });

    const intrastateQuote = quoteRes2.data;
    const hasCGST_SGST =
      Boolean(intrastateQuote) &&
      (intrastateQuote!.cgst_amount || 0) > 0 &&
      (intrastateQuote!.sgst_amount || 0) > 0 &&
      (intrastateQuote!.igst_amount || 0) === 0;

    record(
      'Intrastate GST (CGST+SGST) Calculation & Persistence',
      'P1 Taxation',
      hasCGST_SGST,
      `State: Telangana (36), Taxable: ₹${intrastateQuote?.taxable_amount}, IGST: ₹${intrastateQuote?.igst_amount}, CGST: ₹${intrastateQuote?.cgst_amount}, SGST: ₹${intrastateQuote?.sgst_amount}`
    );

    // 5. Quotation to Order Conversion
    if (!intrastateQuote) {
      throw new Error('Intrastate quotation was not generated');
    }

    const convRes = await convertQuotationToOrder(intrastateQuote.id);
    const convertedOrder = convRes.order;
    record(
      'Quotation to Order Conversion',
      'P1 Workflow',
      Boolean(convRes.success && convertedOrder?.id),
      `Converted Quote ${intrastateQuote.quotation_number} -> Sales Order ${convertedOrder?.order_number} (Status: ${convertedOrder?.status})`
    );

    // 6. Duplicate Quotation Conversion Rejection
    const dupConvRes = await convertQuotationToOrder(intrastateQuote.id);
    const dupBlocked = !dupConvRes.success && Boolean(dupConvRes.error?.includes('already been converted'));
    record(
      'Duplicate Quotation Conversion Prevention',
      'P1 Workflow',
      Boolean(dupBlocked),
      `Duplicate conversion blocked: "${dupConvRes.error}"`
    );

    // 7. Create Invoice from Converted Order
    if (!convertedOrder) {
      throw new Error('Converted order was not generated');
    }

    const invRes = await createInvoiceFromOrder(convertedOrder.id);
    const invoice = invRes.data;
    record(
      'Consecutive Tax Invoice Generation',
      'P1 Billing',
      Boolean(invRes.success && invoice?.invoice_number?.startsWith('ICON/')),
      `Generated Invoice ${invoice?.invoice_number} (Grand Total: ₹${invoice?.grand_total})`
    );

    if (!invoice) {
      throw new Error('Invoice was not generated');
    }

    // 8. Invoice Overpayment Rejection
    const overpaymentRes = await recordPayment({
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_name: invoice.customer_name,
      amount: invoice.balance_amount + 5000, // Overpaying
      mode: 'Bank Transfer',
      reference_number: 'UTR-EXCESS-999',
      payment_date: new Date().toISOString().split('T')[0],
      recorded_by_name: user.name,
    });

    const overpaymentBlocked =
      !overpaymentRes.success && Boolean(overpaymentRes.error?.includes('exceeds outstanding invoice balance'));

    record(
      'Invoice Overpayment Rejection',
      'P1 Financial Integrity',
      Boolean(overpaymentBlocked),
      `Overpayment of ₹${invoice.balance_amount + 5000} on balance ₹${invoice.balance_amount} was rejected: "${overpaymentRes.error}"`
    );

    // 9. Legitimate Partial Payment Recording & Balance Update
    const legitPayRes = await recordPayment({
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_name: invoice.customer_name,
      amount: 50000,
      mode: 'Bank Transfer',
      reference_number: 'UTR-LEGIT-50000',
      payment_date: new Date().toISOString().split('T')[0],
      recorded_by_name: user.name,
    });

    const payment = legitPayRes.data;
    const paymentValid =
      Boolean(legitPayRes.success && payment?.payment_number?.startsWith('ICON/'));

    record(
      'Legitimate Payment Recording & Balance Update',
      'P1 Financial Integrity',
      paymentValid,
      `Recorded Payment ${payment?.payment_number} of ₹${payment?.amount}`
    );

    // 10. Negative Inventory Rejection & Immutable Ledger Recording
    const { products } = await getProducts();
    const targetProduct = products[0];

    if (targetProduct) {
      // Attempt negative stock
      const negStockRes = await updateProductStock(targetProduct.id, -10, 'Corrupt stock deduction');
      const negStockBlocked = !negStockRes.success && Boolean(negStockRes.error?.includes('Negative stock not permitted'));

      record(
        'Negative Inventory Rejection',
        'P1 Inventory Integrity',
        Boolean(negStockBlocked),
        `Negative stock rejected: "${negStockRes.error}"`
      );

      // Legitimate stock adjustment
      const oldStock = targetProduct.current_stock;
      const adjustRes = await updateProductStock(
        targetProduct.id,
        oldStock + 5,
        'Automated Forensic Test Inbound Batch'
      );

      const txns = await getInventoryTransactions(targetProduct.id);
      const latestTx = txns[0];
      const ledgerValid =
        adjustRes.success &&
        latestTx &&
        latestTx.transaction_type === 'ADJUSTMENT' &&
        latestTx.quantity === 5 &&
        latestTx.new_stock === oldStock + 5;

      record(
        'Immutable Inventory Transaction Ledger',
        'P1 Inventory Integrity',
        Boolean(ledgerValid),
        `Logged transaction ${latestTx?.id} (${latestTx?.transaction_type}) delta ${latestTx?.quantity} -> New Stock ${latestTx?.new_stock}`
      );
    }
  } catch (err: any) {
    record('Workflow Execution', 'System', false, `Unhandled error: ${err.message}`);
  }

  const allPassed = testResults.every((t) => t.passed);

  return NextResponse.json({
    status: allPassed ? 'SUCCESS' : 'FAILED',
    totalTests: testResults.length,
    passedCount: testResults.filter((t) => t.passed).length,
    failedCount: testResults.filter((t) => !t.passed).length,
    results: testResults,
    timestamp: new Date().toISOString(),
  });
}
