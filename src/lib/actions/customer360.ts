'use server';

import { getAuthenticatedUser } from '@/lib/auth/session';
import { canViewPurchaseCosts } from '@/lib/utils/margin';
import { getCustomers } from '@/lib/actions/customers';
import { getEnquiries } from '@/lib/actions/enquiries';
import { getSiteVisits, getInstallations } from '@/lib/actions/operations';
import { getQuotations } from '@/lib/actions/quotations';
import { getOrders } from '@/lib/actions/orders';
import { getInvoices } from '@/lib/actions/billing';
import { getSerialRecords } from '@/lib/actions/serials';
import { getServiceTickets, getAMCContracts } from '@/lib/actions/services';
import { getOutboxMessages } from '@/lib/actions/communication';
import { getPurchaseOrders } from '@/lib/actions/procurement';
import { getTasks } from '@/lib/actions/tasks';
import { getApprovalRequests } from '@/lib/actions/approvals';
import { getTallySyncQueue } from '@/lib/actions/tally';
import { getCreditNotes, getCustomerReceivablesLedger } from '@/lib/actions/finance';
import { getCustomerOpportunities } from '@/lib/actions/opportunities';

import type { Customer } from '@/types/customer';
import type { SiteVisitDetails } from '@/types/erp';
import type {
  Quotation,
  SalesOrder,
  Invoice,
  Installation,
  SerialRecord,
  ServiceTicket,
  AMCContract,
  CommunicationOutboxItem,
  Enquiry,
  PurchaseOrder,
  ERPTask,
  ApprovalRequest,
  TallySyncItem,
  CreditNote,
  CustomerReceivableSummary,
  CustomerOpportunity,
} from '@/types/erp';

export interface CustomerTimelineEvent {
  id: string;
  type:
    | 'ENQUIRY'
    | 'SITE_VISIT'
    | 'QUOTATION'
    | 'SALES_ORDER'
    | 'DISPATCH'
    | 'INSTALLATION'
    | 'INVOICE'
    | 'PAYMENT'
    | 'SERVICE'
    | 'COMMUNICATION'
    | 'PROCUREMENT'
    | 'TASK'
    | 'APPROVAL'
    | 'TALLY';
  title: string;
  subtitle: string;
  timestamp: string;
  status?: string;
  amount?: number;
  badge?: string;
  referenceCode?: string;
}

export interface Customer360Dossier {
  customer: Customer;
  enquiries: Enquiry[];
  siteVisits: SiteVisitDetails[];
  quotations: Quotation[];
  orders: SalesOrder[];
  invoices: Invoice[];
  installations: Installation[];
  serials: SerialRecord[];
  tickets: ServiceTicket[];
  amcContracts: AMCContract[];
  communications: CommunicationOutboxItem[];
  purchaseOrders: PurchaseOrder[];
  tasks: ERPTask[];
  approvals: ApprovalRequest[];
  tallySyncItems: TallySyncItem[];
  creditNotes?: CreditNote[];
  receivablesSummary?: CustomerReceivableSummary;
  opportunities?: CustomerOpportunity[];
  showCommercialCosts: boolean;
  timeline: CustomerTimelineEvent[];
  financialSummary: {
    totalInvoiced: number;
    totalCollected: number;
    balanceDue: number;
    creditLimit: number;
    creditUtilizationPct: number;
    overdueInvoicesCount: number;
  };
  healthMetrics: {
    healthStatus: 'HEALTHY' | 'ATTENTION_REQUIRED' | 'PAYMENT_OVERDUE';
    lifetimeValue: number;
    ordersCount: number;
    activeAssetsCount: number;
    activeAMCCount: number;
    openTicketsCount: number;
  };
}

export async function getCustomer360Data(
  customerIdOrCode: string
): Promise<{ success: boolean; data?: Customer360Dossier; error?: string }> {
  try {
    const authUser = await getAuthenticatedUser();
    const userRole = authUser?.role || 'Sales Executive';
    const showCommercialCosts = canViewPurchaseCosts(userRole);

    const term = (customerIdOrCode || '').trim();
    if (!term) {
      return { success: false, error: 'Customer identifier is required' };
    }

    // Load customer directory
    const custRes = await getCustomers({ search: term });
    let customer = custRes.customers.find(
      (c) =>
        c.id === term ||
        c.customer_code.toLowerCase() === term.toLowerCase() ||
        c.customer_name.toLowerCase() === term.toLowerCase()
    );

    // Fallback search if exact id did not match search filter
    if (!customer && custRes.customers.length > 0) {
      customer = custRes.customers[0];
    }

    if (!customer) {
      return { success: false, error: `Customer "${term}" not found in directory` };
    }

    const custId = customer.id;
    const custCode = customer.customer_code;
    const custName = customer.customer_name.toLowerCase();
    const compName = (customer.company_name || '').toLowerCase();

    const matchesCust = (id?: string | null, name?: string | null, comp?: string | null) => {
      if (id && (id === custId || id === custCode)) return true;
      if (name && name.toLowerCase().includes(custName)) return true;
      if (comp && compName && comp.toLowerCase().includes(compName)) return true;
      return false;
    };

    // Load all related domain entities concurrently
    const [
      enqRes,
      visitsRes,
      quoteRes,
      orderRes,
      invRes,
      instRes,
      serialRes,
      ticketRes,
      amcRes,
      commRes,
      poList,
      tasksRes,
      approvalsRes,
      tallyRes,
      cnRes,
      recRes,
      oppRes,
    ] = await Promise.all([
      getEnquiries(),
      getSiteVisits(),
      getQuotations(),
      getOrders(),
      getInvoices(),
      getInstallations(),
      getSerialRecords(),
      getServiceTickets(),
      getAMCContracts(),
      getOutboxMessages(),
      getPurchaseOrders(),
      getTasks(),
      getApprovalRequests(),
      getTallySyncQueue(),
      getCreditNotes(),
      getCustomerReceivablesLedger(customer.id),
      getCustomerOpportunities(customer.id),
    ]);

    const creditNotes = (cnRes || []).filter((cn) => matchesCust(cn.customer_id, cn.customer_name));
    const receivablesSummary = (recRes.data || [])[0];
    const opportunities = oppRes.data || [];

    const enquiries = (enqRes.enquiries || []).filter((e) =>
      matchesCust(e.customer_id, e.customer_name, e.company_name)
    );

    const siteVisits = (visitsRes || []).filter((v) =>
      (v.siteAddress && v.siteAddress.toLowerCase().includes(custName)) ||
      (v.notes && v.notes.toLowerCase().includes(custName))
    );

    const quotations = (quoteRes.quotations || []).filter((q) =>
      matchesCust(q.customer_id, q.customer_name, q.company_name)
    );

    const orders = (orderRes.orders || []).filter((o) =>
      matchesCust(o.customer_id, o.customer_name, o.company_name)
    );

    const invoices = (invRes.invoices || []).filter((inv) =>
      matchesCust(inv.customer_id, inv.customer_name)
    );

    const installations = (instRes || []).filter((inst) =>
      matchesCust(inst.customer_id, inst.customer_name)
    );

    const serials = ((serialRes && serialRes.records) || []).filter((s) =>
      matchesCust(s.customer_id, null) ||
      orders.some((o) => o.id === s.sales_order_id)
    );

    const tickets = (ticketRes || []).filter((t) =>
      matchesCust(t.customer_id, t.customer_name)
    );

    const amcContracts = (amcRes || []).filter((amc) =>
      matchesCust(amc.customer_id, amc.customer_name)
    );

    const commList = (commRes && Array.isArray(commRes.messages)) ? commRes.messages : [];
    const communications = commList.filter(
      (m) =>
        (customer?.email && m.recipient.toLowerCase().includes(customer.email.toLowerCase())) ||
        (customer?.phone && m.recipient.includes(customer.phone))
    );

    // Linked Procurement & Drop-ship POs
    const rawPOs = (poList || []).filter((po) => {
      const isConsignee =
        po.consignee_customer_id === custId ||
        po.consignee_customer_id === custCode ||
        (po.consignee_name && po.consignee_name.toLowerCase().includes(custName)) ||
        (po.consignee_address && po.consignee_address.toLowerCase().includes(custName));
      const orderMatch = orders.some(
        (o) =>
          o.id === po.sales_order_id ||
          o.order_number === po.sales_order_id ||
          o.order_number === po.sales_order_number ||
          o.id === po.sales_order_number
      );
      const itemMatch = (po.items || []).some(
        (it) =>
          (it.customer_name && it.customer_name.toLowerCase().includes(custName)) ||
          orders.some((o) => o.id === it.sales_order_id || o.order_number === it.order_number)
      );
      return isConsignee || orderMatch || itemMatch;
    });

    const purchaseOrders: PurchaseOrder[] = rawPOs.map((po) => {
      if (showCommercialCosts) {
        return po;
      }
      return {
        ...po,
        total_amount: 0,
        subtotal: 0,
        gst_amount: 0,
        items: (po.items || []).map((it) => ({
          ...it,
          unit_cost: 0,
          total_cost: 0,
        })),
      };
    });

    // Linked Tasks & Follow-ups
    const allTasks = tasksRes?.tasks || [];
    const tasks = allTasks.filter((t) => {
      if (t.related_entity_id === custId || t.related_entity_id === custCode) return true;
      if (orders.some((o) => o.id === t.related_entity_id || o.order_number === t.related_entity_number)) return true;
      if (quotations.some((q) => q.id === t.related_entity_id || q.quotation_number === t.related_entity_number)) return true;
      if (invoices.some((i) => i.id === t.related_entity_id || i.invoice_number === t.related_entity_number)) return true;
      if (tickets.some((tk) => tk.id === t.related_entity_id || tk.ticket_number === t.related_entity_number)) return true;
      if (t.title.toLowerCase().includes(custName) || (t.notes && t.notes.toLowerCase().includes(custName))) return true;
      return false;
    });

    // Linked Commercial Approvals
    const allApprovals = approvalsRes?.requests || [];
    const approvals = allApprovals.filter((a) => {
      if (a.entity_id === custId || a.entity_id === custCode) return true;
      if (quotations.some((q) => q.id === a.entity_id || q.quotation_number === a.entity_number)) return true;
      if (orders.some((o) => o.id === a.entity_id || o.order_number === a.entity_number)) return true;
      if (enquiries.some((e) => e.id === a.entity_id || e.enquiry_number === a.entity_number)) return true;
      if (a.approval_notes && a.approval_notes.toLowerCase().includes(custName)) return true;
      return false;
    });

    // Linked Tally Sync Status
    const rawTally = tallyRes?.queue || [];
    const tallySyncItems: TallySyncItem[] = rawTally.filter((t: TallySyncItem) => {
      if (t.entity_id === custId || t.entity_id === custCode) return true;
      if (invoices.some((inv) => inv.id === t.entity_id || inv.invoice_number === t.entity_id)) return true;
      if (orders.some((ord) => ord.id === t.entity_id || ord.order_number === t.entity_id)) return true;
      return false;
    });

    // Compute Financial Metrics
    let totalInvoiced = 0;
    let totalCollected = 0;
    let balanceDue = 0;
    let overdueInvoicesCount = 0;
    const now = new Date();

    invoices.forEach((inv) => {
      totalInvoiced += inv.grand_total || 0;
      totalCollected += inv.paid_amount || 0;
      const bal = inv.balance_amount || 0;
      balanceDue += bal;
      if (bal > 0 && inv.due_date && new Date(inv.due_date) < now) {
        overdueInvoicesCount++;
      }
    });

    const creditLimit = customer.credit_limit || 0;
    const creditUtilizationPct = creditLimit > 0 ? Math.min(100, Math.round((balanceDue / creditLimit) * 100)) : 0;

    // Build Unified Chronological Timeline
    const timeline: CustomerTimelineEvent[] = [];

    enquiries.forEach((e) => {
      timeline.push({
        id: `timeline-enq-${e.id}`,
        type: 'ENQUIRY',
        title: `Enquiry ${e.enquiry_number} Logged`,
        subtitle: `Requirement: ${e.requirement_summary} • Budget: ₹${(e.estimated_budget || 0).toLocaleString('en-IN')}`,
        timestamp: e.created_at,
        status: e.status,
        badge: 'Presales',
        referenceCode: e.enquiry_number,
      });
    });

    siteVisits.forEach((v) => {
      timeline.push({
        id: `timeline-visit-${v.id}`,
        type: 'SITE_VISIT',
        title: `Site Survey by ${v.assignedTechnician}`,
        subtitle: `Location: ${v.siteAddress || 'Customer Site'} • Notes: ${v.notes}`,
        timestamp: v.completedDate || v.scheduledDate || new Date().toISOString(),
        status: v.status,
        badge: 'Survey',
        referenceCode: v.visitNumber,
      });
    });

    quotations.forEach((q) => {
      timeline.push({
        id: `timeline-qt-${q.id}`,
        type: 'QUOTATION',
        title: `Quotation ${q.quotation_number} (${q.version_tag || 'v1'})`,
        subtitle: `Amount: ₹${Math.round(q.grand_total || 0).toLocaleString('en-IN')} • Rep: ${q.salesperson_name}`,
        timestamp: q.created_at,
        amount: q.grand_total,
        status: q.status,
        badge: q.status === 'Approved' ? 'Approved Quote' : 'Proposal',
        referenceCode: q.quotation_number,
      });
    });

    orders.forEach((o) => {
      timeline.push({
        id: `timeline-ord-${o.id}`,
        type: 'SALES_ORDER',
        title: `Sales Order ${o.order_number} Confirmed`,
        subtitle: `Total: ₹${o.total_amount.toLocaleString('en-IN')} • Delivery: ${o.material_status}`,
        timestamp: o.created_at,
        amount: o.total_amount,
        status: o.status,
        badge: 'Confirmed Order',
        referenceCode: o.order_number,
      });
    });

    purchaseOrders.forEach((po) => {
      const isDropShip = po.delivery_type === 'DIRECT_CUSTOMER_DROPSHIP';
      timeline.push({
        id: `timeline-po-${po.id}`,
        type: 'PROCUREMENT',
        title: `${isDropShip ? 'Drop-ship' : 'Procurement'} PO ${po.po_number} (${po.supplier_name})`,
        subtitle: `Ref Order: ${po.sales_order_number || 'Direct'} • Status: ${po.status}`,
        timestamp: po.order_date || new Date().toISOString(),
        amount: showCommercialCosts ? po.total_amount : undefined,
        status: po.status,
        badge: isDropShip ? 'Drop-ship PO' : 'Procurement PO',
        referenceCode: po.po_number,
      });
    });

    installations.forEach((inst) => {
      timeline.push({
        id: `timeline-inst-${inst.id}`,
        type: 'INSTALLATION',
        title: `Installation ${inst.installation_number} - ${inst.handover_status || inst.status}`,
        subtitle: `Lead Tech: ${inst.lead_technician_name} • Sign-off by: ${inst.customer_signoff_by || 'Pending'}`,
        timestamp: inst.created_at,
        status: inst.status,
        badge: 'Job Card',
        referenceCode: inst.installation_number,
      });
    });

    invoices.forEach((inv) => {
      timeline.push({
        id: `timeline-inv-${inv.id}`,
        type: 'INVOICE',
        title: `Tax Invoice ${inv.invoice_number} Issued`,
        subtitle: `Grand Total: ₹${inv.grand_total.toLocaleString('en-IN')} • Balance Due: ₹${inv.balance_amount.toLocaleString('en-IN')}`,
        timestamp: inv.created_at,
        amount: inv.grand_total,
        status: inv.status,
        badge: inv.status === 'Paid' ? 'Fully Paid' : 'Tax Invoice',
        referenceCode: inv.invoice_number,
      });
    });

    tickets.forEach((t) => {
      timeline.push({
        id: `timeline-srv-${t.id}`,
        type: 'SERVICE',
        title: `Service Ticket ${t.ticket_number}`,
        subtitle: `Issue: ${t.complaint_description} • Assigned: ${t.assigned_technician_name}`,
        timestamp: t.created_at,
        status: t.status,
        badge: t.priority + ' Priority',
        referenceCode: t.ticket_number,
      });
    });

    tasks.forEach((tsk) => {
      timeline.push({
        id: `timeline-tsk-${tsk.id}`,
        type: 'TASK',
        title: `Task: ${tsk.title}`,
        subtitle: `Type: ${tsk.task_type} • Assigned: ${tsk.assigned_user_name} • Due: ${tsk.due_date}`,
        timestamp: tsk.created_at,
        status: tsk.status,
        badge: `${tsk.priority} Priority Task`,
        referenceCode: tsk.task_number,
      });
    });

    approvals.forEach((app) => {
      timeline.push({
        id: `timeline-app-${app.id}`,
        type: 'APPROVAL',
        title: `Approval ${app.request_number} (${app.approval_type})`,
        subtitle: `Entity: ${app.entity_number} • Requested by: ${app.requested_by_name}`,
        timestamp: app.created_at,
        status: app.status,
        badge: `Approval ${app.status}`,
        referenceCode: app.request_number,
      });
    });

    tallySyncItems.forEach((tSync) => {
      timeline.push({
        id: `timeline-tally-${tSync.id}`,
        type: 'TALLY',
        title: `Tally ${tSync.entity_type} Sync (${tSync.status})`,
        subtitle: `Voucher: ${tSync.tally_voucher_type} • Retries: ${tSync.retry_count}`,
        timestamp: tSync.synced_at || tSync.created_at,
        status: tSync.status,
        badge: `Tally ${tSync.status}`,
        referenceCode: tSync.entity_number || tSync.id,
      });
    });

    communications.forEach((m) => {
      timeline.push({
        id: `timeline-comm-${m.id}`,
        type: 'COMMUNICATION',
        title: `${m.channel} Notification Sent`,
        subtitle: `Recipient: ${m.recipient} • Status: ${m.status}`,
        timestamp: m.sent_at || m.created_at,
        status: m.status,
        badge: m.channel,
        referenceCode: m.id,
      });
    });

    // Sort timeline descending (most recent first)
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Health status determination
    let healthStatus: 'HEALTHY' | 'ATTENTION_REQUIRED' | 'PAYMENT_OVERDUE' = 'HEALTHY';
    if (overdueInvoicesCount > 0) {
      healthStatus = 'PAYMENT_OVERDUE';
    } else if (balanceDue > creditLimit && creditLimit > 0) {
      healthStatus = 'ATTENTION_REQUIRED';
    } else if (tickets.some((t) => t.priority === 'Critical' && t.status !== 'Resolved')) {
      healthStatus = 'ATTENTION_REQUIRED';
    }

    const dossier: Customer360Dossier = {
      customer,
      enquiries,
      siteVisits,
      quotations,
      orders,
      invoices,
      installations,
      serials,
      tickets,
      amcContracts,
      communications,
      purchaseOrders,
      tasks,
      approvals,
      tallySyncItems,
      creditNotes,
      receivablesSummary,
      opportunities,
      showCommercialCosts,
      timeline,
      financialSummary: {
        totalInvoiced: Number(totalInvoiced.toFixed(2)),
        totalCollected: Number(totalCollected.toFixed(2)),
        balanceDue: Number(balanceDue.toFixed(2)),
        creditLimit,
        creditUtilizationPct,
        overdueInvoicesCount,
      },
      healthMetrics: {
        healthStatus,
        lifetimeValue: Number(totalInvoiced.toFixed(2)),
        ordersCount: orders.length,
        activeAssetsCount: serials.length,
        activeAMCCount: amcContracts.filter((a) => a.is_active).length,
        openTicketsCount: tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed').length,
      },
    };

    return { success: true, data: dossier };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to retrieve Customer 360 data' };
  }
}
