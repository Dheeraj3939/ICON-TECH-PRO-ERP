'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { logAuditEvent } from '@/lib/audit/logger';

// ==============================================================================
// ICON TECH PRO ERP — CANONICAL DEMO TRANSACTION LIFECYCLE
// Customer: "DEMO — Swan Technologies Pvt Ltd" (Code: DEMO-ICON260099)
// Project:  "DEMO — Corporate Boardroom AV & Display Solution"
// ==============================================================================

export const DEMO_CUSTOMER_ID = '00000000-0000-0000-0000-000000000099';
export const DEMO_ENQUIRY_ID = '00000000-0000-0000-0000-000000000199';
export const DEMO_SITE_VISIT_ID = '00000000-0000-0000-0000-000000000198';
export const DEMO_QUOTATION_ID = '00000000-0000-0000-0000-000000000299';
export const DEMO_ORDER_ID = '00000000-0000-0000-0000-000000000399';
export const DEMO_PO_ID = '00000000-0000-0000-0000-000000000388';
export const DEMO_GRN_ID = '00000000-0000-0000-0000-000000000377';
export const DEMO_DISPATCH_ID = '00000000-0000-0000-0000-000000000699';
export const DEMO_INSTALLATION_ID = '00000000-0000-0000-0000-000000000799';
export const DEMO_INVOICE_ID = '00000000-0000-0000-0000-000000000499';
export const DEMO_PAYMENT_ID = '00000000-0000-0000-0000-000000000599';
export const DEMO_AMC_ID = '00000000-0000-0000-0000-000000000899';

export const DEMO_ENTITIES = {
  customer: {
    id: DEMO_CUSTOMER_ID,
    customer_code: 'DEMO-ICON260099',
    customer_type: 'COMPANY' as const,
    customer_name: 'DEMO — Swan Technologies Pvt Ltd',
    company_name: 'DEMO — Swan Technologies Pvt Ltd',
    contact_person: 'DEMO Contact - Rajesh Verma',
    designation: 'Head of Corporate IT',
    phone: '+91 98490 99999',
    email: 'demo.rajesh@swantech.example.com',
    billing_address: 'Plot 100, Cyber Towers Road, Madhapur',
    shipping_address: 'Plot 100, Cyber Towers Road, Madhapur',
    city: 'Hyderabad',
    state: 'Telangana',
    state_code: '36',
    pincode: '500081',
    gstin: '36AAACS9999P1ZK',
    pan: 'AAACS9999P',
    credit_limit: 1000000,
    status: 'ACTIVE' as const,
    notes: 'DEMO — Key Enterprise Client for Executive Boardroom AV & Display Systems',
  },
  enquiry: {
    id: DEMO_ENQUIRY_ID,
    enquiry_number: 'DEMO-ENQ260099',
    customer_id: DEMO_CUSTOMER_ID,
    company_name: 'DEMO — Swan Technologies Pvt Ltd',
    customer_name: 'DEMO — Swan Technologies Pvt Ltd',
    customer_type: 'COMPANY',
    phone: '+91 98490 99999',
    email: 'demo.rajesh@swantech.example.com',
    source: 'Direct',
    salesperson_name: 'Dheeraj',
    product_category: 'Interactive Boards',
    requirement_summary: 'DEMO — Corporate Boardroom AV & Display Solution (75\" 4K ViewSonic Interactive Panel, PTZ Camera, PoE Switch & Acoustic Audio)',
    estimated_budget: 350000,
    status: 'Order done',
    site_visit_required: true,
  },
  quotation: {
    id: DEMO_QUOTATION_ID,
    quotation_number: 'DEMO-QT260099',
    revision_number: 1,
    entity_code: 'ICON_TECH_PRO',
    enquiry_id: DEMO_ENQUIRY_ID,
    customer_id: DEMO_CUSTOMER_ID,
    company_name: 'DEMO — Swan Technologies Pvt Ltd',
    customer_name: 'DEMO — Swan Technologies Pvt Ltd',
    customer_type: 'COMPANY',
    phone: '+91 98490 99999',
    email: 'demo.rajesh@swantech.example.com',
    address: 'Plot 100, Cyber Towers Road, Madhapur, Hyderabad',
    salesperson_name: 'Dheeraj',
    quotation_date: '2026-09-04',
    validity_days: 15,
    subtotal: 277000,
    total_discount: 22160,
    taxable_amount: 254840,
    cgst_amount: 22935.6,
    sgst_amount: 22935.6,
    igst_amount: 0,
    grand_total: 300711,
    total_cost: 210000,
    margin_pct: 17.6,
    status: 'Accepted',
  },
  quotation_item: {
    id: '00000000-0000-0000-0000-000000000201',
    quotation_id: DEMO_QUOTATION_ID,
    product_name: 'ViewSonic 75\" 4K Interactive Flat Panel with Wall Mount & Cable Loom',
    sku: 'VS-IFP-75-4K',
    category: 'Interactive Boards',
    unit: 'Nos.',
    quantity: 1,
    purchase_price: 135000,
    selling_price: 175000,
    discount_pct: 8,
    discount_amount: 14000,
    gst_rate: 18,
    hsn_sac: '85285200',
    total_amount: 189980,
  },
  approval: {
    id: '00000000-0000-0000-0000-000000000202',
    quotation_id: DEMO_QUOTATION_ID,
    quotation_number: 'DEMO-QT260099',
    requested_by_name: 'Reshma (Sales Executive)',
    role_name: 'Sales Executive',
    discount_percent: 8.0,
    required_approver_role: 'BDM',
    status: 'APPROVED' as const,
    approved_by_name: 'Dheeraj (Admin / BDM)',
    remarks: 'Approved for Swan Technologies boardroom reference showcase.',
  },
  order: {
    id: DEMO_ORDER_ID,
    order_number: 'DEMO-ORD260099',
    entity_code: 'ICON_TECH_PRO',
    quotation_id: DEMO_QUOTATION_ID,
    quotation_number: 'DEMO-QT260099',
    customer_id: DEMO_CUSTOMER_ID,
    customer_name: 'DEMO — Swan Technologies Pvt Ltd',
    company_name: 'DEMO — Swan Technologies Pvt Ltd',
    salesperson_name: 'Dheeraj',
    order_date: '2026-09-05',
    total_amount: 300711,
    status: 'Confirmed',
    material_status: 'In Stock',
    dispatch_status: 'Installed & Handed Over',
  },
  order_item: {
    id: '00000000-0000-0000-0000-000000000301',
    sales_order_id: DEMO_ORDER_ID,
    product_name: 'ViewSonic 75\" 4K Interactive Flat Panel with Wall Mount & Cable Loom',
    sku: 'VS-IFP-75-4K',
    quantity: 1,
    selling_price: 161000,
    total_amount: 189980,
  },
  dispatch: {
    id: DEMO_DISPATCH_ID,
    dispatch_number: 'DEMO-DSP260099',
    delivery_challan_number: 'DEMO-DC260099',
    order_id: DEMO_ORDER_ID,
    order_number: 'DEMO-ORD260099',
    invoice_id: DEMO_INVOICE_ID,
    invoice_number: 'DEMO-INV260099',
    customer_name: 'DEMO — Swan Technologies Pvt Ltd',
    shipping_address: 'Plot 100, Cyber Towers Road, Madhapur, Hyderabad',
    transporter_name: 'Local Dedicated Express Delivery',
    vehicle_number: 'TS 09 UA 9988',
    status: 'Delivered',
    dispatched_by_name: 'Manisha (Office Assistant)',
  },
  installation: {
    id: DEMO_INSTALLATION_ID,
    installation_number: 'DEMO-INS260099',
    order_id: DEMO_ORDER_ID,
    order_number: 'DEMO-ORD260099',
    customer_id: DEMO_CUSTOMER_ID,
    customer_name: 'DEMO — Swan Technologies Pvt Ltd',
    lead_technician_name: 'Nagaraju (Lead AV Technician)',
    scheduled_date: '2026-09-08',
    completed_date: '2026-09-08',
    status: 'Completed',
    handover_notes: 'Executive boardroom 75\" interactive display mounted, 4K camera & PoE switch configured. Handover accepted by Rajesh Verma.',
  },
  invoice: {
    id: DEMO_INVOICE_ID,
    invoice_number: 'DEMO-INV260099',
    invoice_type: 'TAX_INVOICE',
    entity_code: 'ICON_TECH_PRO',
    order_id: DEMO_ORDER_ID,
    order_number: 'DEMO-ORD260099',
    customer_id: DEMO_CUSTOMER_ID,
    customer_name: 'DEMO — Swan Technologies Pvt Ltd',
    company_name: 'DEMO — Swan Technologies Pvt Ltd',
    invoice_date: '2026-09-09',
    due_date: '2026-09-24',
    subtotal: 254840,
    cgst_amount: 22935.6,
    sgst_amount: 22935.6,
    igst_amount: 0,
    gst_amount: 45871.2,
    grand_total: 300711,
    paid_amount: 200000,
    status: 'Partially Paid',
    created_by_name: 'Hemalatha (Accounts)',
  },
  payment: {
    id: DEMO_PAYMENT_ID,
    payment_number: 'DEMO-PAY260099',
    invoice_id: DEMO_INVOICE_ID,
    invoice_number: 'DEMO-INV260099',
    customer_id: DEMO_CUSTOMER_ID,
    customer_name: 'DEMO — Swan Technologies Pvt Ltd',
    amount: 200000,
    mode: 'Bank Transfer',
    reference_number: 'DEMO-UTR-HDFC-998822',
    payment_date: '2026-09-10',
    recorded_by_name: 'Hemalatha (Accounts)',
  },
  amc: {
    id: DEMO_AMC_ID,
    contract_number: 'DEMO-AMC260099',
    customer_id: DEMO_CUSTOMER_ID,
    customer_name: 'DEMO — Swan Technologies Pvt Ltd',
    start_date: '2026-09-10',
    end_date: '2027-09-09',
    annual_visits_count: 4,
    contract_value: 35000,
    is_active: true,
  },
};

/**
 * Check whether the canonical DEMO transaction is active in Supabase.
 */
export async function isDemoSeeded(): Promise<boolean> {
  const isOnline = await isSupabaseAvailable();
  if (!isOnline) return false;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('customers')
      .select('id')
      .eq('id', DEMO_CUSTOMER_ID)
      .maybeSingle();

    return !!data;
  } catch {
    return false;
  }
}

/**
 * Seed the complete interconnected DEMO transaction into Supabase.
 */
export async function seedDemoLifecycle(): Promise<{ success: boolean; message: string }> {
  const isOnline = await isSupabaseAvailable();
  if (!isOnline) {
    return { success: false, message: 'Supabase database is unreachable.' };
  }

  try {
    const admin = createAdminClient();

    // 1. Customer
    await admin.from('customers').upsert(DEMO_ENTITIES.customer);

    // 2. Enquiry
    await admin.from('enquiries').upsert(DEMO_ENTITIES.enquiry);

    // 3. Quotation & Item
    await admin.from('quotations').upsert(DEMO_ENTITIES.quotation);
    await admin.from('quotation_items').upsert(DEMO_ENTITIES.quotation_item);
    await admin.from('discount_approval_requests').upsert(DEMO_ENTITIES.approval);

    // 4. Sales Order & Item
    await admin.from('sales_orders').upsert(DEMO_ENTITIES.order);
    await admin.from('sales_order_items').upsert(DEMO_ENTITIES.order_item);

    // 5. Invoice (balance_amount is auto-calculated by Postgres)
    await admin.from('invoices').upsert(DEMO_ENTITIES.invoice);

    // 6. Payment
    await admin.from('payments').upsert(DEMO_ENTITIES.payment);

    // 7. Dispatch
    await admin.from('dispatches').upsert(DEMO_ENTITIES.dispatch);

    // 8. Installation
    await admin.from('installations').upsert(DEMO_ENTITIES.installation);

    // 9. AMC Contract
    await admin.from('amc_contracts').upsert(DEMO_ENTITIES.amc);

    logAuditEvent({
      userName: 'Demo System',
      action: 'DEMO_LIFECYCLE_SEEDED',
      module: 'DEMO',
      details: `Seeded DEMO transaction lifecycle for ${DEMO_ENTITIES.customer.customer_name}`,
    });

    return {
      success: true,
      message: 'Complete DEMO transaction lifecycle successfully seeded for Swan Technologies Pvt Ltd.',
    };
  } catch (err: any) {
    return { success: false, message: `Failed to seed demo lifecycle: ${err.message}` };
  }
}

/**
 * Safe reset mechanism: Removes ONLY records with DEMO IDs.
 * Never deletes real records, never resets schema, never truncates.
 */
export async function resetDemoLifecycle(): Promise<{ success: boolean; message: string }> {
  const isOnline = await isSupabaseAvailable();
  if (!isOnline) {
    return { success: false, message: 'Supabase database is unreachable.' };
  }

  try {
    const admin = createAdminClient();

    // Delete in reverse foreign key order
    await admin.from('amc_contracts').delete().eq('id', DEMO_AMC_ID);
    await admin.from('installations').delete().eq('id', DEMO_INSTALLATION_ID);
    await admin.from('dispatches').delete().eq('id', DEMO_DISPATCH_ID);
    await admin.from('payments').delete().eq('id', DEMO_PAYMENT_ID);
    await admin.from('invoices').delete().eq('id', DEMO_INVOICE_ID);
    await admin.from('sales_order_items').delete().eq('id', DEMO_ENTITIES.order_item.id);
    await admin.from('sales_orders').delete().eq('id', DEMO_ORDER_ID);
    await admin.from('discount_approval_requests').delete().eq('id', DEMO_ENTITIES.approval.id);
    await admin.from('quotation_items').delete().eq('id', DEMO_ENTITIES.quotation_item.id);
    await admin.from('quotations').delete().eq('id', DEMO_QUOTATION_ID);
    await admin.from('enquiries').delete().eq('id', DEMO_ENQUIRY_ID);
    await admin.from('customers').delete().eq('id', DEMO_CUSTOMER_ID);

    logAuditEvent({
      userName: 'Demo System',
      action: 'DEMO_LIFECYCLE_RESET',
      module: 'DEMO',
      details: 'Safe cleanup of DEMO records only. Zero production records modified.',
    });

    return {
      success: true,
      message: 'DEMO records cleanly and safely removed. Zero production business records touched.',
    };
  } catch (err: any) {
    return { success: false, message: `Failed to reset demo records: ${err.message}` };
  }
}
