'use server';

import { getAuthenticatedUser } from '@/lib/auth/session';
import { canViewPurchaseCosts } from '@/lib/utils/margin';
import { getCustomers } from '@/lib/actions/customers';
import { getQuotations } from '@/lib/actions/quotations';
import { getOrders } from '@/lib/actions/orders';
import { getInvoices } from '@/lib/actions/billing';
import { getProducts } from '@/lib/actions/products';
import { getPurchaseOrders } from '@/lib/actions/procurement';
import { getInstallations, getSiteVisits, getDispatches } from '@/lib/actions/operations';
import { getEnquiries } from '@/lib/actions/enquiries';
import { getSerialRecords } from '@/lib/actions/serials';
import { getOutboxMessages } from '@/lib/actions/communication';
import { getServiceTickets, getAMCContracts } from '@/lib/actions/services';
import { getTasks } from '@/lib/actions/tasks';
import { getApprovalRequests } from '@/lib/actions/approvals';
import { getSupplierInvoices } from '@/lib/actions/supplier-invoices';
import { getTallySyncQueue } from '@/lib/actions/tally';
import { getCreditNotes, getDebitNotes } from '@/lib/actions/finance';
import { getTallyReconciliationItems } from '@/lib/actions/tally-reconciliation';
import { getBusinessRisks } from '@/lib/actions/risk-engine';
import { getCustomerOpportunities } from '@/lib/actions/opportunities';

export interface SearchResultItem {
  id: string;
  category:
    | 'Customer'
    | 'Enquiry'
    | 'Site Visit'
    | 'Quotation'
    | 'Sales Order'
    | 'Purchase Order'
    | 'Invoice'
    | 'Payment'
    | 'Dispatch'
    | 'Product'
    | 'Serial'
    | 'Installation'
    | 'Service'
    | 'AMC'
    | 'Communication'
    | 'Intelligence'
    | 'Approval'
    | 'Task'
    | 'Supplier Invoice'
    | 'Tally'
    | 'Credit Note'
    | 'Debit Note'
    | 'Risk'
    | 'Opportunity'
    | 'Module';
  title: string;
  subtitle: string;
  badge?: string;
  href: string;
  meta?: Record<string, any>;
}

export interface SearchResponse {
  query: string;
  interpretedIntent?: string;
  totalResults: number;
  results: SearchResultItem[];
}

export async function globalSearch(
  rawQuery: string,
  categoryFilter: string = 'ALL'
): Promise<SearchResponse> {
  const query = (rawQuery || '').trim();
  if (!query) {
    return { query: '', totalResults: 0, results: [] };
  }

  const authUser = await getAuthenticatedUser();
  const userRole = authUser?.role || 'Sales Executive';
  const showPurchaseCost = canViewPurchaseCosts(userRole);

  const lower = query.toLowerCase();
  const todayStr = new Date().toISOString().split('T')[0];

  // Load all datasets concurrently
  const [
    custRes,
    quoteRes,
    orderRes,
    invRes,
    prodRes,
    poRes,
    instRes,
    serialRes,
    commRes,
    ticketRes,
    amcRes,
    taskRes,
    apprRes,
    sinvRes,
    tallyRes,
    cnRes,
    dnRes,
    reconRes,
    riskRes,
    oppRes,
    enqRes,
    visitsRes,
    dispatchRes,
  ] = await Promise.all([
    getCustomers({ limit: 100 }),
    getQuotations(),
    getOrders(),
    getInvoices(),
    getProducts(),
    getPurchaseOrders(),
    getInstallations(),
    getSerialRecords(),
    getOutboxMessages(),
    getServiceTickets(),
    getAMCContracts(),
    getTasks(),
    getApprovalRequests(),
    getSupplierInvoices(),
    getTallySyncQueue(),
    getCreditNotes(),
    getDebitNotes(),
    getTallyReconciliationItems(),
    getBusinessRisks(),
    getCustomerOpportunities(),
    getEnquiries(),
    getSiteVisits(),
    getDispatches(),
  ]);

  const customers = custRes.customers || [];
  const quotations = quoteRes.quotations || [];
  const orders = orderRes.orders || [];
  const invoices = invRes.invoices || [];
  const products = prodRes.products || [];
  const purchaseOrders = Array.isArray(poRes) ? poRes : [];
  const installations = instRes || [];
  const serials = (serialRes && Array.isArray(serialRes.records)) ? serialRes.records : [];
  const communications = commRes || [];
  const tickets = ticketRes || [];
  const amcContracts = amcRes || [];
  const tasks = taskRes?.tasks || [];
  const approvals = apprRes?.requests || [];
  const supplierInvoices = sinvRes?.invoices || [];
  const tallyQueue = tallyRes?.queue || [];
  const creditNotes = cnRes || [];
  const debitNotes = dnRes || [];
  const reconItems = reconRes?.data || [];
  const riskAlerts = riskRes?.data || [];
  const opportunities = oppRes?.data || [];
  const enquiries = enqRes?.enquiries || [];
  const siteVisits = visitsRes || [];
  const dispatches = dispatchRes || [];

  const results: SearchResultItem[] = [];
  let interpretedIntent: string | undefined = undefined;

  // -------------------------------------------------------------------------
  // 1. Natural Language Intent Processing
  // -------------------------------------------------------------------------

  // Pattern 1: "pending approvals"
  if (/pendings+approvals?|approvals+requests?/i.test(lower)) {
    interpretedIntent = 'Pending Commercial Approvals Queue';
    const pending = approvals.filter((a) => a.status === 'PENDING');
    pending.forEach((a) => {
      results.push({
        id: `apr-${a.id}`,
        category: 'Approval',
        title: `${a.request_number} — ${a.approval_type} (${a.requested_value}%)`,
        subtitle: `Requested by ${a.requested_by_name} for ${a.entity_number} • Cap: ${a.threshold_limit}%`,
        badge: 'Pending Review',
        href: '/dashboard/approvals',
      });
    });
    return { query, interpretedIntent, totalResults: results.length, results };
  }

  // Pattern 2: "overdue customer payments" / "overdue payments"
  if (/overdues+(?:customers+)?payments?|overdues+invoices?/i.test(lower)) {
    interpretedIntent = 'Overdue Customer Invoices & Receivables';
    const overdue = invoices.filter((i) => i.balance_amount > 0 && i.due_date < todayStr);
    overdue.forEach((inv) => {
      results.push({
        id: `overdue-inv-${inv.id}`,
        category: 'Invoice',
        title: `${inv.invoice_number} — ${inv.customer_name}`,
        subtitle: `Overdue Balance: ₹${inv.balance_amount.toLocaleString('en-IN')} • Due: ${inv.due_date}`,
        badge: 'Overdue',
        href: `/dashboard/invoices?search=${inv.invoice_number}`,
      });
    });
    return { query, interpretedIntent, totalResults: results.length, results };
  }

  // Pattern 3: "perfora invoices" / "supplier invoices"
  if (/perfora|suppliers+invoices?|purchases+invoices?/i.test(lower)) {
    if (!showPurchaseCost) {
      return {
        query,
        interpretedIntent: 'Supplier invoices & distributor costs are restricted to commercial/accounts roles.',
        totalResults: 0,
        results: [],
      };
    }
    interpretedIntent = 'Supplier & Distributor Invoices (3-Way Match)';
    supplierInvoices.forEach((si) => {
      results.push({
        id: `sinv-${si.id}`,
        category: 'Supplier Invoice',
        title: `${si.invoice_number} — ${si.supplier_name}`,
        subtitle: `₹${si.total_amount.toLocaleString('en-IN')} against PO ${si.po_number} • Match: ${si.match_status}`,
        badge: si.match_status,
        href: '/dashboard/purchases',
      });
    });
    return { query, interpretedIntent, totalResults: results.length, results };
  }

  // Pattern 4: "projector installations this month" / "[item] installations"
  if (/(?:projector|screen|panel|audio)s+installations?|installations?.*(?:month|today|scheduled)/i.test(lower)) {
    interpretedIntent = 'Scheduled Systems Integrator Installations';
    installations.forEach((ins) => {
      results.push({
        id: `inst-nl-${ins.id}`,
        category: 'Installation',
        title: `${ins.installation_number} — ${ins.customer_name}`,
        subtitle: `Lead Tech: ${ins.lead_technician_name} • Scheduled: ${ins.scheduled_date} • ${ins.site_address}`,
        badge: ins.status,
        href: '/dashboard/installations',
      });
    });
    return { query, interpretedIntent, totalResults: results.length, results };
  }

  // Pattern 5: "customers who bought [product/category]"
  const boughtMatch = lower.match(/(?:customers|who|clients)\s+(?:who\s+)?(?:bought|purchased|ordered)\s+(.+)/i);
  if (boughtMatch) {
    const itemTerm = boughtMatch[1].trim();
    interpretedIntent = `Customer Purchase Intelligence: Accounts that ordered "${itemTerm}"`;

    const matchedCustomers = new Map<string, { customerName: string; code: string; products: string[] }>();

    orders.forEach((o) => {
      const hasItem = o.items.some(
        (it) =>
          it.product_name.toLowerCase().includes(itemTerm) ||
          (it.sku && it.sku.toLowerCase().includes(itemTerm))
      );
      if (hasItem) {
        const existing = matchedCustomers.get(o.customer_id) || {
          customerName: o.customer_name,
          code: o.customer_id,
          products: [],
        };
        o.items.forEach((it) => {
          if (
            it.product_name.toLowerCase().includes(itemTerm) &&
            !existing.products.includes(it.product_name)
          ) {
            existing.products.push(it.product_name);
          }
        });
        matchedCustomers.set(o.customer_id, existing);
      }
    });

    matchedCustomers.forEach((val, custId) => {
      results.push({
        id: `intel-cust-${custId}`,
        category: 'Intelligence',
        title: val.customerName,
        subtitle: `Purchased ${val.products.join(', ')} • Click for Customer 360`,
        badge: 'Buyer Match',
        href: `/dashboard/customers/${custId}`,
        meta: { customerId: custId },
      });
    });

    return {
      query,
      interpretedIntent,
      totalResults: results.length,
      results,
    };
  }

  // Pattern 6: Customer-Specific Queries ("[Customer] installations", "[Customer] warranty", "[Customer] amc", "[Customer] pending procurement", "[Customer] orders", "[Customer] payments")
  const custNameMatch = customers.find(
    (c) =>
      lower.includes(c.customer_name.toLowerCase()) ||
      (c.company_name && lower.includes(c.company_name.toLowerCase()))
  );

  if (custNameMatch) {
    const custName = custNameMatch.customer_name;
    const isInstIntent = /installations?|job\s*cards?/i.test(lower);
    const isWarrantyIntent = /warrant(?:y|ies)|serials?/i.test(lower);
    const isAMCIntent = /amc|maintenance|contracts?/i.test(lower);
    const isProcureIntent = /procurement|backorders?|pending\s+procurement/i.test(lower);
    const isOrdersIntent = /orders?|sales/i.test(lower);
    const isPaymentsIntent = /payments?|invoices?|pending|outstanding|balance|due/i.test(lower);
    const isEverythingIntent = /everything|all|history|360/i.test(lower);

    // Direct match to Customer 360
    results.push({
      id: `cust-360-${custNameMatch.id}`,
      category: 'Customer',
      title: `Customer 360: ${custNameMatch.customer_name}`,
      subtitle: `Code: ${custNameMatch.customer_code} • ${custNameMatch.phone} • ${custNameMatch.city || 'Hyderabad'}`,
      badge: 'Customer 360',
      href: `/dashboard/customers/${custNameMatch.id}`,
    });

    // Customer Installations
    if (isInstIntent || isEverythingIntent) {
      interpretedIntent = `Installations & Job Cards for ${custName}`;
      const custInst = installations.filter((ins) =>
        ins.customer_name.toLowerCase().includes(custName.toLowerCase())
      );
      custInst.forEach((ins) => {
        results.push({
          id: `inst-${ins.id}`,
          category: 'Installation',
          title: `Job Card: ${ins.installation_number} — ${ins.customer_name}`,
          subtitle: `Tech: ${ins.lead_technician_name} • Scheduled: ${ins.scheduled_date} • Status: ${ins.status}`,
          badge: ins.status,
          href: '/dashboard/installations',
        });
      });
    }

    // Customer Warranty & Serials
    if (isWarrantyIntent || isEverythingIntent) {
      interpretedIntent = `Installed Assets & Warranty for ${custName}`;
      const custSerials = serials.filter((s) =>
        s.customer_name && s.customer_name.toLowerCase().includes(custName.toLowerCase())
      );
      custSerials.forEach((s) => {
        results.push({
          id: `serial-${s.id}`,
          category: 'Serial',
          title: `${s.product_name} (SN: ${s.serial_number})`,
          subtitle: `Warranty End: ${s.warranty_end_date || 'N/A'} • Provider: ${s.warranty_provider} • Status: ${s.status}`,
          badge: s.status,
          href: `/dashboard/customers/${custNameMatch.id}?tab=assets`,
        });
      });
    }

    // Customer AMC
    if (isAMCIntent || isEverythingIntent) {
      interpretedIntent = `AMC Contracts for ${custName}`;
      const custAMCs = amcContracts.filter((a) =>
        a.customer_name.toLowerCase().includes(custName.toLowerCase())
      );
      custAMCs.forEach((a) => {
        results.push({
          id: `amc-${a.id}`,
          category: 'AMC',
          title: `AMC Contract: ${a.contract_number} — ₹${a.contract_value.toLocaleString('en-IN')}`,
          subtitle: `Valid: ${a.start_date} to ${a.end_date} • Visits: ${a.annual_visits_count}/yr`,
          badge: a.is_active ? 'Active' : 'Expired',
          href: '/dashboard/service',
        });
      });
    }

    // Customer Pending Procurement
    if (isProcureIntent || isEverythingIntent) {
      interpretedIntent = `Distributor Procurement & Backorders for ${custName}`;
      const custOrders = orders.filter((o) =>
        o.customer_name.toLowerCase().includes(custName.toLowerCase())
      );
      custOrders.forEach((o) => {
        const backorders = o.items.filter((it) => it.procurement_status === 'PO_REQUIRED' || it.procurement_status === 'PARTIALLY_RESERVED');
        if (backorders.length > 0) {
          results.push({
            id: `procure-${o.id}`,
            category: 'Purchase Order',
            title: `Backorders on ${o.order_number} for ${custName}`,
            subtitle: `${backorders.length} items awaiting distributor dispatch • Delivery Mode: ${o.material_status}`,
            badge: 'Procurement Required',
            href: '/dashboard/purchases',
          });
        }
      });
    }

    // Customer Orders
    if (isOrdersIntent || isEverythingIntent) {
      interpretedIntent = `Filtered Sales Orders for ${custName}`;
      const custOrders = orders.filter((o) =>
        o.customer_name.toLowerCase().includes(custName.toLowerCase())
      );
      custOrders.forEach((o) => {
        results.push({
          id: `so-${o.id}`,
          category: 'Sales Order',
          title: `${o.order_number} — ${o.customer_name}`,
          subtitle: `₹${o.total_amount.toLocaleString('en-IN')} • ${o.items.length} items • Status: ${o.status}`,
          badge: o.status,
          href: `/dashboard/sales-orders?search=${o.order_number}`,
        });
      });
    }

    // Customer Payments (Restricted to commercial/accounts/sales authorized roles)
    if ((isPaymentsIntent || isEverythingIntent) && userRole !== 'Office Assistant') {
      interpretedIntent = `Receivables & Financial Ledger for ${custName}`;
      const custInvoices = invoices.filter((inv) =>
        inv.customer_name.toLowerCase().includes(custName.toLowerCase())
      );
      let totalDue = 0;
      custInvoices.forEach((inv) => {
        totalDue += inv.balance_amount || 0;
        results.push({
          id: `inv-${inv.id}`,
          category: 'Invoice',
          title: `${inv.invoice_number} — ₹${inv.grand_total.toLocaleString('en-IN')}`,
          subtitle: `Paid: ₹${inv.paid_amount.toLocaleString('en-IN')} • Balance Due: ₹${inv.balance_amount.toLocaleString('en-IN')}`,
          badge: inv.status,
          href: `/dashboard/invoices?search=${inv.invoice_number}`,
        });
      });

      if (custInvoices.length > 0) {
        results.unshift({
          id: `pending-summary-${custNameMatch.id}`,
          category: 'Intelligence',
          title: `${custName} — Total Outstanding: ₹${totalDue.toLocaleString('en-IN')}`,
          subtitle: `Found ${custInvoices.length} billing records. Click to open ledger.`,
          badge: totalDue > 0 ? 'Payment Due' : 'Settled',
          href: `/dashboard/customers/${custNameMatch.id}?tab=ledger`,
        });
      }
    }

    if (results.length > 1) {
      return {
        query,
        interpretedIntent: interpretedIntent || `Customer records for ${custName}`,
        totalResults: results.length,
        results,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 2. Multi-Entity Keyword Search
  // -------------------------------------------------------------------------

  // Search Customers
  if (categoryFilter === 'ALL' || categoryFilter === 'Customer') {
    customers
      .filter((c) =>
        (c.customer_name || '').toLowerCase().includes(lower) ||
        (c.customer_code || '').toLowerCase().includes(lower) ||
        (c.phone || '').includes(lower) ||
        (c.email || '').toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .forEach((c) => {
        results.push({
          id: `cust-${c.id}`,
          category: 'Customer',
          title: c.customer_name,
          subtitle: `${c.customer_code} • ${c.phone} • ${c.city || 'Hyderabad'}`,
          badge: c.status,
          href: `/dashboard/customers/${c.id}`,
        });
      });
  }

  // Search Quotations
  if (categoryFilter === 'ALL' || categoryFilter === 'Quotation') {
    quotations
      .filter((q) =>
        q.quotation_number.toLowerCase().includes(lower) ||
        q.customer_name.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .forEach((q) => {
        results.push({
          id: `quote-${q.id}`,
          category: 'Quotation',
          title: `${q.quotation_number} — ${q.customer_name}`,
          subtitle: `₹${q.grand_total.toLocaleString('en-IN')} • ${q.items.length} items • Status: ${q.status}`,
          badge: q.status,
          href: `/dashboard/quotations?search=${q.quotation_number}`,
        });
      });
  }

  // Search Sales Orders
  if (categoryFilter === 'ALL' || categoryFilter === 'Sales Order') {
    orders
      .filter((o) =>
        o.order_number.toLowerCase().includes(lower) ||
        o.customer_name.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .forEach((o) => {
        results.push({
          id: `order-${o.id}`,
          category: 'Sales Order',
          title: `${o.order_number} — ${o.customer_name}`,
          subtitle: `₹${o.total_amount.toLocaleString('en-IN')} • Status: ${o.status}`,
          badge: o.status,
          href: `/dashboard/sales-orders?search=${o.order_number}`,
        });
      });
  }

  // Search Invoices
  if (categoryFilter === 'ALL' || categoryFilter === 'Invoice') {
    invoices
      .filter((inv) =>
        inv.invoice_number.toLowerCase().includes(lower) ||
        inv.customer_name.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .forEach((inv) => {
        results.push({
          id: `inv-${inv.id}`,
          category: 'Invoice',
          title: `${inv.invoice_number} — ${inv.customer_name}`,
          subtitle: `₹${inv.grand_total.toLocaleString('en-IN')} • Balance: ₹${inv.balance_amount.toLocaleString('en-IN')}`,
          badge: inv.status,
          href: `/dashboard/invoices?search=${inv.invoice_number}`,
        });
      });
  }

  // Search Products
  if (categoryFilter === 'ALL' || categoryFilter === 'Product') {
    products
      .filter((p) =>
        p.name.toLowerCase().includes(lower) ||
        p.sku.toLowerCase().includes(lower) ||
        p.category_name.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .forEach((p) => {
        const costSnippet = showPurchaseCost ? ` • Cost: ₹${p.purchase_price.toLocaleString('en-IN')}` : '';
        results.push({
          id: `prod-${p.id}`,
          category: 'Product',
          title: p.name,
          subtitle: `SKU: ${p.sku} • Price: ₹${p.selling_price.toLocaleString('en-IN')}${costSnippet} • Stock: ${p.current_stock}`,
          badge: p.category_name,
          href: '/dashboard/products',
        });
      });
  }

  // Search Tasks / Follow-ups
  if (categoryFilter === 'ALL' || categoryFilter === 'Task') {
    tasks
      .filter((t) =>
        t.task_number.toLowerCase().includes(lower) ||
        t.title.toLowerCase().includes(lower) ||
        t.assigned_user_name.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .forEach((t) => {
        results.push({
          id: `task-${t.id}`,
          category: 'Task',
          title: `${t.task_number}: ${t.title}`,
          subtitle: `Assigned: ${t.assigned_user_name} • Due: ${t.due_date} • Priority: ${t.priority}`,
          badge: t.status,
          href: '/dashboard/follow-ups',
        });
      });
  }

  // Search Approvals
  if (categoryFilter === 'ALL' || categoryFilter === 'Approval') {
    approvals
      .filter((a) =>
        a.request_number.toLowerCase().includes(lower) ||
        a.entity_number.toLowerCase().includes(lower) ||
        a.requested_by_name.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .forEach((a) => {
        results.push({
          id: `appr-${a.id}`,
          category: 'Approval',
          title: `${a.request_number}: ${a.approval_type} on ${a.entity_number}`,
          subtitle: `Requested by: ${a.requested_by_name} • Value: ${a.requested_value} • Approver: ${a.required_approver_role}`,
          badge: a.status,
          href: '/dashboard/approvals',
        });
      });
  }

  // Search Supplier Invoices (Commercial Permission Required)
  if (showPurchaseCost && (categoryFilter === 'ALL' || categoryFilter === 'Supplier Invoice')) {
    supplierInvoices
      .filter((si) =>
        si.invoice_number.toLowerCase().includes(lower) ||
        si.supplier_name.toLowerCase().includes(lower) ||
        (si.po_number && si.po_number.toLowerCase().includes(lower))
      )
      .slice(0, 5)
      .forEach((si) => {
        results.push({
          id: `sinv-${si.id}`,
          category: 'Supplier Invoice',
          title: `${si.invoice_number} — ${si.supplier_name}`,
          subtitle: `₹${si.total_amount.toLocaleString('en-IN')} • PO: ${si.po_number} • Match: ${si.match_status}`,
          badge: si.match_status,
          href: '/dashboard/purchases',
        });
      });
  }

  // Search Tally Sync Queue
  if (categoryFilter === 'ALL' || categoryFilter === 'Tally') {
    tallyQueue
      .filter((t) =>
        t.entity_number.toLowerCase().includes(lower) ||
        t.payload_summary.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .forEach((t) => {
        results.push({
          id: `tally-${t.id}`,
          category: 'Tally',
          title: `Tally Sync: ${t.entity_number} (${t.tally_voucher_type})`,
          subtitle: `${t.payload_summary} • Status: ${t.status}`,
          badge: t.status,
          href: '/dashboard/tally',
        });
      });
  }

  // Search Credit Notes
  if (categoryFilter === 'ALL' || categoryFilter === 'Credit Note') {
    creditNotes
      .filter((cn) =>
        cn.credit_note_number.toLowerCase().includes(lower) ||
        cn.customer_name.toLowerCase().includes(lower) ||
        cn.invoice_number.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .forEach((cn) => {
        results.push({
          id: `cn-${cn.id}`,
          category: 'Credit Note',
          title: `${cn.credit_note_number} — ${cn.customer_name}`,
          subtitle: `₹${cn.total_amount.toLocaleString('en-IN')} against ${cn.invoice_number} • ${cn.reason}`,
          badge: cn.status,
          href: '/dashboard/invoices',
        });
      });
  }

  // Search Debit Notes (Commercial Permission Required)
  if (showPurchaseCost && (categoryFilter === 'ALL' || categoryFilter === 'Debit Note')) {
    debitNotes
      .filter((dn) =>
        dn.debit_note_number.toLowerCase().includes(lower) ||
        dn.supplier_name.toLowerCase().includes(lower) ||
        dn.supplier_invoice_number.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .forEach((dn) => {
        results.push({
          id: `dn-${dn.id}`,
          category: 'Debit Note',
          title: `${dn.debit_note_number} — ${dn.supplier_name}`,
          subtitle: `₹${dn.total_amount.toLocaleString('en-IN')} against ${dn.supplier_invoice_number} • ${dn.reason}`,
          badge: dn.status,
          href: '/dashboard/purchases',
        });
      });
  }

  // Search Business Risks
  if (categoryFilter === 'ALL' || categoryFilter === 'Risk') {
    riskAlerts
      .filter((r) =>
        r.title.toLowerCase().includes(lower) ||
        r.description.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .forEach((r) => {
        results.push({
          id: `risk-${r.id}`,
          category: 'Risk',
          title: r.title,
          subtitle: `${r.description} • Action: ${r.recommendation}`,
          badge: r.severity,
          href: '/dashboard',
        });
      });
  }

  // Search Customer Opportunities
  if (categoryFilter === 'ALL' || categoryFilter === 'Opportunity') {
    opportunities
      .filter((o) =>
        o.title.toLowerCase().includes(lower) ||
        o.customer_name.toLowerCase().includes(lower) ||
        o.pitch_summary.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .forEach((o) => {
        results.push({
          id: `opp-${o.id}`,
          category: 'Opportunity',
          title: `${o.title} (${o.customer_name})`,
          subtitle: `Est. Value: ₹${o.estimated_value.toLocaleString('en-IN')} • ${o.pitch_summary}`,
          badge: `${o.confidence_score}% Confidence`,
          href: '/dashboard/reports',
        });
      });
  }

  // Search Enquiries / Leads
  if (categoryFilter === 'ALL' || categoryFilter === 'Enquiry') {
    enquiries
      .filter((enq) =>
        enq.enquiry_number.toLowerCase().includes(lower) ||
        enq.customer_name.toLowerCase().includes(lower) ||
        (enq.company_name && enq.company_name.toLowerCase().includes(lower)) ||
        (enq.requirement_summary && enq.requirement_summary.toLowerCase().includes(lower))
      )
      .slice(0, 5)
      .forEach((enq) => {
        results.push({
          id: `enq-${enq.id}`,
          category: 'Enquiry',
          title: `${enq.enquiry_number} — ${enq.company_name || enq.customer_name}`,
          subtitle: `${enq.requirement_summary || 'AV Requirement'} • Stage: ${enq.status} • Rep: ${enq.salesperson_name || 'Assigned'}`,
          badge: enq.status,
          href: '/dashboard/enquiries',
        });
      });
  }

  // Search Site Visits
  if (categoryFilter === 'ALL' || categoryFilter === 'Site Visit') {
    siteVisits
      .filter((sv) =>
        (sv.visitNumber && sv.visitNumber.toLowerCase().includes(lower)) ||
        (sv.siteAddress && sv.siteAddress.toLowerCase().includes(lower)) ||
        (sv.roomType && sv.roomType.toLowerCase().includes(lower)) ||
        (sv.assignedTechnician && sv.assignedTechnician.toLowerCase().includes(lower))
      )
      .slice(0, 5)
      .forEach((sv) => {
        results.push({
          id: `sv-${sv.id}`,
          category: 'Site Visit',
          title: `Site Survey ${sv.visitNumber}: ${sv.siteAddress}`,
          subtitle: `Type: ${sv.roomType} • Technician: ${sv.assignedTechnician} • Scheduled: ${sv.scheduledDate}`,
          badge: sv.status,
          href: '/dashboard/site-visits',
        });
      });
  }

  // Search Dispatches / Delivery Challans
  if (categoryFilter === 'ALL' || categoryFilter === 'Dispatch') {
    dispatches
      .filter((d) =>
        d.delivery_challan_number.toLowerCase().includes(lower) ||
        d.customer_name.toLowerCase().includes(lower) ||
        (d.dispatch_number && d.dispatch_number.toLowerCase().includes(lower)) ||
        (d.order_number && d.order_number.toLowerCase().includes(lower)) ||
        (d.transporter_name && d.transporter_name.toLowerCase().includes(lower))
      )
      .slice(0, 5)
      .forEach((d) => {
        results.push({
          id: `dc-${d.id}`,
          category: 'Dispatch',
          title: `Delivery Challan ${d.delivery_challan_number} — ${d.customer_name}`,
          subtitle: `Order: ${d.order_number || 'N/A'} • Destination: ${d.shipping_address} • Transporter: ${d.transporter_name}`,
          badge: d.status,
          href: '/dashboard/dispatch',
        });
      });
  }

  return {
    query,
    totalResults: results.length,
    results,
  };
}
