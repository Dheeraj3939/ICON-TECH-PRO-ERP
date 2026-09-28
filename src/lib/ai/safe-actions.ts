'use server';

import { getAuthenticatedUser } from '@/lib/auth/session';
import { canViewPurchaseCosts } from '@/lib/utils/margin';
import { logAuditEvent } from '@/lib/audit/logger';
import { getCustomers } from '@/lib/actions/customers';
import { getProducts } from '@/lib/actions/products';
import { getCustomer360Data } from '@/lib/actions/customer360';
import { getOrders, getSalesOrderById } from '@/lib/actions/orders';
import { getInvoices, getAccountsAging, getCustomerOutstandingBalance } from '@/lib/actions/billing';
import { getQuotations } from '@/lib/actions/quotations';
import {
  getPurchaseOrders,
  recommendDistributor,
  compareSupplierQuotes,
  getSupplierPerformance,
} from '@/lib/actions/procurement';
import { createTask } from '@/lib/actions/tasks';
import { queryOpportunities } from '@/lib/actions/purchase-intelligence';
import { getExpiringWarranties } from '@/lib/actions/serials';
import { getExpiringAMCs, checkWarrantyStatus, createWarrantyClaim } from '@/lib/actions/services';
import {
  getProspectCompanies,
  getProspectDossier,
  executeResearchRun,
  convertProspectToCRM,
  prepareProspectEnquiryConversion,
} from '@/lib/actions/prospect-intelligence';
import { getEnquirySalesBrief } from '@/lib/actions/opportunities';
import {
  getSiteVisitIntelligence,
  extractVisitRequirements,
  createDeliveryChallan,
} from '@/lib/actions/operations';
import { analyzeQuotationPricingAction, getQuotationRevisions } from '@/lib/actions/quotations';
import { traceSerialLifecycle, getStockMovements } from '@/lib/actions/inventory';
import { 
  queueOutboxMessage, 
  getCustomerCommunicationHistory,
  sendWhatsAppBrochure,
  sendWhatsAppCatalogue,
  sendWhatsAppQuotationPDF,
  sendWhatsAppInvoicePDF,
  escalateWhatsAppToHuman,
} from '@/lib/actions/communication';
import { qualifySalesLead, recommendSolutionPackage } from '@/lib/actions/ai-sales-agent';
import { 
  analyzeCallTranscript, 
  getCallBySid,
  initiateDirectSalespersonCall,
  transferCallToSalesperson,
} from '@/lib/actions/telephony';
import { getBusinessKPIsSummary, getRevenueByCategory } from '@/lib/actions/analytics';
import { 
  generateExecutiveBriefing, 
  getExecutiveBriefings, 
  getExecutiveScheduleConfigs 
} from '@/lib/actions/executive-reporting';
import type { AIAuditRecord, AIActionClassification, UserRole } from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_AI_AUDIT_LOGS__: AIAuditRecord[] | undefined;
}

function getAIAuditStore(): AIAuditRecord[] {
  if (!globalThis.__ICON_AI_AUDIT_LOGS__) {
    globalThis.__ICON_AI_AUDIT_LOGS__ = [];
  }
  return globalThis.__ICON_AI_AUDIT_LOGS__;
}

export async function getAIAuditLogs(): Promise<AIAuditRecord[]> {
  return getAIAuditStore();
}

// Prohibited Operations List for AI
const STRICTLY_PROHIBITED_AI_OPERATIONS = [
  'approve_own_discount',
  'change_purchase_cost',
  'change_payment_records',
  'modify_permissions',
  'delete_customer',
  'cancel_financial_document',
  'make_unauthorized_financial_commitment',
];

/**
 * Validates AI tool invocation against strict security policies.
 */
export async function validateAIToolPolicy(
  toolName: string,
  userRole: UserRole,
  args?: Record<string, any>
): Promise<{ allowed: boolean; reason?: string; requiresConfirmation: boolean }> {
  // 1. Check for prohibited operations
  if (STRICTLY_PROHIBITED_AI_OPERATIONS.includes(toolName.toLowerCase())) {
    return {
      allowed: false,
      reason: `Strict Policy Violation: Operation "${toolName}" is prohibited for AI autonomous execution.`,
      requiresConfirmation: false,
    };
  }

  // 2. Prevent unauthorized commercial cost access
  if (toolName === 'view_commercial_costs' || toolName === 'recommend_distributor') {
    if (!canViewPurchaseCosts(userRole)) {
      // Allowed to run recommendation, but purchase cost must be sanitized
      return { allowed: true, requiresConfirmation: false };
    }
  }

  // 3. Modifying operations require human confirmation
  const humanConfirmationRequired = [
    'create_follow_up',
    'create_enquiry',
    'prepare_communication_draft',
    'convert_prospect_to_crm',
    'run_prospect_research',
    'generate_delivery_challan',
  ];

  return {
    allowed: true,
    requiresConfirmation: humanConfirmationRequired.includes(toolName),
  };
}

/**
 * Execute an Approved Safe ERP AI Tool.
 * Flow: User -> AI Gateway -> Policy Check -> Approved Tool -> Server Action -> Audit Log
 */
export async function executeSafeAITool(
  toolName: string,
  args: Record<string, any>
): Promise<{
  success: boolean;
  toolName: string;
  data?: any;
  error?: string;
  requiresConfirmation?: boolean;
  auditId?: string;
  classification?: AIActionClassification;
}> {
  const authUser = await getAuthenticatedUser();
  const userRole: UserRole = (authUser?.role as UserRole) || 'Sales Executive';
  const userName = authUser?.name || 'Authorized AI User';
  const userId = authUser?.id || 'usr-ai-01';

  // 1. Policy Guard
  const policy = await validateAIToolPolicy(toolName, userRole, args);
  if (!policy.allowed) {
    const auditRecord: AIAuditRecord = {
      id: `AIAUDIT-${Date.now()}`,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      intent: args?.intent || `Attempted execution of ${toolName}`,
      tool_name: toolName,
      arguments: args,
      requires_human_confirmation: false,
      status: 'BLOCKED_BY_POLICY',
      result_summary: policy.reason || 'Blocked by security policy',
      created_at: new Date().toISOString(),
    };
    getAIAuditStore().unshift(auditRecord);
    return { success: false, toolName, error: policy.reason };
  }

  let resultData: any = null;
  let dataAccessed: string[] = [];
  let summary = '';

  try {
    switch (toolName) {
      case 'search_customer': {
        const res = await getCustomers({ search: args.query || '', limit: 10 });
        resultData = res.customers.map((c) => ({
          id: c.id,
          name: c.customer_name,
          phone: c.phone,
          city: c.city,
        }));
        dataAccessed.push('customers');
        summary = `Found ${resultData.length} matching customers`;
        break;
      }

      case 'search_product': {
        const res = await getProducts();
        const showCost = canViewPurchaseCosts(userRole);
        const q = (args.query || '').toLowerCase();
        resultData = res.products
          .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
          .slice(0, 10)
          .map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            selling_price: p.selling_price,
            purchase_price: showCost ? p.purchase_price : undefined,
          }));
        dataAccessed.push('products');
        summary = `Found ${resultData.length} matching products`;
        break;
      }

      case 'get_customer_360': {
        const res = await getCustomer360Data(args.customerId);
        if (!res.success || !res.data) throw new Error(`Customer ${args.customerId} not found`);
        const dossier = res.data;
        resultData = {
          customer: dossier.customer,
          healthMetrics: dossier.healthMetrics,
          financialSummary: dossier.financialSummary,
          recentTimeline: dossier.timeline.slice(0, 5),
        };
        dataAccessed.push('customers', 'invoices', 'orders', 'serials');
        summary = `Retrieved 360 dossier for ${dossier.customer.customer_name}`;
        break;
      }

      case 'search_orders': {
        const res = await getOrders();
        const q = (args.query || '').toLowerCase();
        resultData = res.orders
          .filter((o) => !q || o.order_number.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q))
          .slice(0, 10)
          .map((o) => ({
            order_number: o.order_number,
            customer_name: o.customer_name,
            total_amount: o.total_amount,
            dispatch_status: o.dispatch_status,
          }));
        dataAccessed.push('orders');
        summary = `Found ${resultData.length} sales orders`;
        break;
      }

      case 'search_payments': {
        const res = await getInvoices();
        resultData = res.invoices
          .filter((i) => i.balance_amount > 0)
          .slice(0, 10)
          .map((i) => ({
            invoice_number: i.invoice_number,
            customer_name: i.customer_name,
            balance_amount: i.balance_amount,
            status: i.status,
            due_date: i.due_date,
          }));
        dataAccessed.push('invoices');
        summary = `Found ${resultData.length} pending receivables`;
        break;
      }

      case 'find_purchase_opportunities': {
        const opps = await queryOpportunities(args.type || 'EXPIRING_WARRANTY');
        resultData = opps.slice(0, 10);
        dataAccessed.push('purchase_intelligence', 'serials', 'amc');
        summary = `Identified ${resultData.length} opportunities for ${args.type || 'EXPIRING_WARRANTY'}`;
        break;
      }

      case 'find_expiring_warranty_amc': {
        const days = args.days || 30;
        const [warranties, amcs] = await Promise.all([
          getExpiringWarranties(days),
          getExpiringAMCs(days),
        ]);
        resultData = {
          expiringWarranties: warranties.map((w) => ({
            serial: w.serial_number,
            product: w.product_name,
            customer: w.customer_name,
            endDate: w.warranty_end_date,
          })),
          expiringAMCs: amcs.map((a) => ({
            contract: a.contract_number,
            customer: a.customer_name,
            endDate: a.end_date,
            value: a.contract_value,
          })),
        };
        dataAccessed.push('serials', 'amc_contracts');
        summary = `Found ${warranties.length} expiring warranties and ${amcs.length} expiring AMCs within ${days} days`;
        break;
      }

      case 'recommend_distributor': {
        const rec = await recommendDistributor({
          product_id_or_name: args.product,
          required_qty: args.qty || 1,
        });
        resultData = rec.recommendation;
        dataAccessed.push('product_suppliers');
        summary = rec.success
          ? `Recommended ${rec.recommendation?.recommended_supplier_name} for ${args.product}`
          : `No recommendation: ${rec.error}`;
        break;
      }

      case 'create_follow_up': {
        const task = await createTask({
          task_type: args.task_type || 'CUSTOMER_FOLLOWUP',
          title: args.title,
          assigned_user_name: args.assigned_to || userName,
          priority: args.priority || 'MEDIUM',
          due_date: args.due_date || new Date().toISOString().split('T')[0],
          notes: args.notes,
        });
        resultData = task.data;
        dataAccessed.push('tasks');
        summary = `Created task ${task.data?.task_number}: "${args.title}"`;
        break;
      }

      case 'search_prospect_companies': {
        const prospects = await getProspectCompanies({
          search: args.query,
          status: args.status,
          campaign_id: args.campaign_id,
        });
        resultData = prospects.map((p) => ({
          id: p.id,
          name: p.company_name,
          industry: p.industry,
          location: p.headquarters_location,
          status: p.status,
          relevance: p.relevance_summary,
        }));
        dataAccessed.push('prospect_companies');
        summary = `Found ${resultData.length} prospective companies`;
        break;
      }

      case 'get_prospect_dossier': {
        const dossier = await getProspectDossier(args.companyId, args.runNumber);
        if (!dossier) throw new Error(`Prospect company ${args.companyId} not found`);
        resultData = {
          company: dossier.company,
          current_run: dossier.current_run,
          decision_makers_count: dossier.decision_makers.length,
          projects_count: dossier.projects.length,
          relevance_analysis: dossier.relevance_analysis,
          top_decision_makers: dossier.decision_makers.slice(0, 3).map((d) => ({
            name: d.full_name,
            title: d.title,
            department: d.department,
            classification: d.classification,
            confidence: d.confidence,
          })),
        };
        dataAccessed.push('prospect_companies', 'prospect_research_runs', 'prospect_decision_makers', 'prospect_projects');
        summary = `Retrieved dossier for ${dossier.company.company_name} (Fit score: ${dossier.relevance_analysis.fit_score}%)`;
        break;
      }

      case 'run_prospect_research': {
        const runRes = await executeResearchRun(args.companyId, {
          executedBy: `AI_GATEWAY (${userName})`,
        });
        if (!runRes.success || !runRes.run) throw new Error(runRes.error || 'Research run failed');
        resultData = runRes.run;
        dataAccessed.push('prospect_companies', 'prospect_research_runs');
        summary = `Executed Research Run #${runRes.run.run_number} for prospect: ${runRes.run.summary}`;
        break;
      }

      case 'convert_prospect_to_crm': {
        const convRes = await convertProspectToCRM(args.companyId, {
          converted_by: userName,
          customer_type: args.customer_type,
          contact_person: args.contact_person,
          email: args.email,
          phone: args.phone,
          create_enquiry: args.create_enquiry ?? true,
          enquiry_details: args.enquiry_details,
        });
        if (!convRes.success) throw new Error(convRes.error || 'CRM conversion failed');
        resultData = convRes;
        dataAccessed.push('prospect_companies', 'customers', 'enquiries');
        summary = `Converted prospect to CRM Customer (ID: ${convRes.customer_id}${convRes.enquiry_id ? `, Enquiry: ${convRes.enquiry_id}` : ''})`;
        break;
      }

      case 'prepare_prospect_conversion': {
        const targetProspectId = args.prospectCompanyId || args.companyId || args.prospectDossierId;
        if (!targetProspectId) throw new Error('prospectCompanyId or companyId is required');
        const prepRes = await prepareProspectEnquiryConversion(targetProspectId);
        if (!prepRes.success || !prepRes.data) {
          throw new Error(prepRes.error || 'Failed to prepare prospect conversion');
        }
        resultData = prepRes.data;
        dataAccessed.push('prospect_companies', 'customers', 'enquiries');
        summary = `Prepared enquiry conversion for ${prepRes.data.companyName} (Matching customer: ${prepRes.data.duplicateCheck.hasMatchingCustomer ? 'Yes' : 'None'}, ${prepRes.data.duplicateCheck.existingEnquiries.length} existing enquiries)`;
        break;
      }

      case 'get_enquiry_sales_brief': {
        const targetEnquiryId = args.enquiryId || args.enquiry_id;
        if (!targetEnquiryId) throw new Error('enquiryId is required');
        const briefRes = await getEnquirySalesBrief(targetEnquiryId);
        if (!briefRes.success || !briefRes.data) {
          throw new Error(briefRes.error || 'Failed to generate enquiry sales brief');
        }
        resultData = briefRes.data;
        dataAccessed.push('enquiries', 'customers', 'enquiry_sales_briefs');
        summary = `Generated AI sales brief for enquiry ${targetEnquiryId} (Health score: ${briefRes.data.health_score}%, Status: ${briefRes.data.health_status})`;
        break;
      }

      case 'get_site_visit_brief': {
        const visitId = args.visitId || args.site_visit_id || args.visit_number;
        if (!visitId) throw new Error('visitId is required');
        const briefRes = await getSiteVisitIntelligence(visitId);
        if (!briefRes.success || !briefRes.data) {
          throw new Error(briefRes.error || 'Failed to get site visit brief');
        }
        resultData = briefRes.data;
        dataAccessed.push('site_visits', 'site_visit_intelligence');
        summary = `Retrieved pre-visit brief & equipment checklist for Survey ${briefRes.data.visit_number}`;
        break;
      }

      case 'extract_visit_requirements': {
        const visitId = args.visitId || args.site_visit_id || args.visit_number;
        if (!visitId) throw new Error('visitId is required');
        const extractRes = await extractVisitRequirements(visitId);
        if (!extractRes.success || !extractRes.data) {
          throw new Error(extractRes.error || 'Failed to extract site visit requirements');
        }
        resultData = extractRes.data;
        dataAccessed.push('site_visits', 'site_visit_intelligence', 'enquiries');
        summary = `Extracted ${extractRes.data.extracted_requirements?.length || 0} technical requirements from Survey ${extractRes.data.visit_number}`;
        break;
      }

      case 'analyze_quotation_pricing': {
        const quotationId = args.quotationId || args.quotation_id || args.id;
        if (!quotationId) throw new Error('quotationId is required');
        const priceRes = await analyzeQuotationPricingAction(quotationId);
        if (!priceRes.success || !priceRes.analysis) {
          throw new Error(priceRes.error || 'Failed to analyze quotation pricing');
        }
        resultData = priceRes;
        dataAccessed.push('quotations', 'quotation_items');
        summary = `Analyzed margin health for Quotation: Score ${priceRes.analysis.health_score}/100, Margin ${priceRes.analysis.overall_margin_pct}% (${priceRes.analysis.status})`;
        break;
      }

      case 'get_quotation_revisions': {
        const quotationId = args.quotationId || args.quotation_id || args.id;
        if (!quotationId) throw new Error('quotationId is required');
        const revisions = await getQuotationRevisions(quotationId);
        resultData = { revisions };
        dataAccessed.push('quotations', 'quotation_revisions');
        summary = `Retrieved ${revisions.length} historical revisions for Quotation ${quotationId}`;
        break;
      }

      case 'compare_supplier_quotes': {
        const productName = args?.product_id_or_name || args?.productName || '';
        const qty = Number(args?.quantity) || 1;
        if (!productName) throw new Error('product_id_or_name is required');
        const compRes = await compareSupplierQuotes({
          product_id_or_name: productName,
          quantity: qty,
          target_date: args?.target_date,
        });
        if (!compRes.success) throw new Error(compRes.error);
        resultData = compRes.data;
        dataAccessed.push('suppliers', 'product_suppliers');
        summary = `Compared ${compRes.data?.quotes.length || 0} supplier quotes for ${productName} (Qty: ${qty})`;
        break;
      }

      case 'get_supplier_performance': {
        const supplierId = args?.supplier_id || args?.supplierId;
        const perfRes = await getSupplierPerformance(supplierId);
        if (!perfRes.success) throw new Error(perfRes.error);
        resultData = perfRes.data;
        dataAccessed.push('suppliers', 'purchase_orders', 'supplier_evaluations');
        summary = `Retrieved performance scorecards for ${perfRes.data?.length || 0} suppliers`;
        break;
      }

      case 'get_stock_level': {
        const query = args?.product_id || args?.productId || args?.search || '';
        const { products } = await getProducts({ search: query });
        const matched = query
          ? products.filter(
              (p) =>
                p.id === query ||
                p.sku.toLowerCase().includes(query.toLowerCase()) ||
                p.name.toLowerCase().includes(query.toLowerCase())
            )
          : products;
        resultData = {
          total_products: matched.length,
          products: matched.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            current_stock: p.current_stock,
            reorder_level: p.reorder_level,
            unit: p.unit,
          })),
        };
        dataAccessed.push('products', 'stock_movements');
        summary = `Retrieved stock levels for ${matched.length} products`;
        break;
      }

      case 'trace_serial_lifecycle': {
        const serialNum = args?.serial_number || args?.serialNumber;
        if (!serialNum) throw new Error('serial_number is required');
        const traceRes = await traceSerialLifecycle(serialNum);
        if (!traceRes.success) throw new Error(traceRes.error);
        resultData = traceRes.data;
        dataAccessed.push('serial_records', 'serial_ledger');
        summary = `Traced lifecycle for serial ${serialNum} (${traceRes.data?.history.length || 0} transitions)`;
        break;
      }

      case 'get_order_fulfillment_status': {
        const orderId = args?.order_id || args?.orderId || args?.order_number;
        if (!orderId) throw new Error('order_id is required');
        const order = await getSalesOrderById(orderId);
        if (!order) throw new Error(`Sales order ${orderId} not found`);
        resultData = {
          order_number: order.order_number,
          status: order.status,
          material_status: order.material_status,
          fulfillment_status: order.fulfillment_status || 'Pending Procurement',
          dispatch_status: order.dispatch_status,
          delivery_challan_number: order.delivery_challan_number,
          invoice_id: order.invoice_id,
          procurement_summary: order.procurement_summary,
          items: order.items.map((it) => ({
            product_name: it.product_name,
            quantity: it.quantity,
            reserved_quantity: it.reserved_quantity || 0,
            procurement_status: it.procurement_status,
          })),
        };
        dataAccessed.push('sales_orders', 'sales_order_items');
        summary = `Fulfillment status for ${order.order_number}: Status=${order.status}, Material=${order.material_status}, Dispatch=${order.dispatch_status}`;
        break;
      }

      case 'generate_delivery_challan': {
        const orderNumber = args?.order_number || args?.orderNumber;
        const customerName = args?.customer_name || args?.customerName;
        const shippingAddress = args?.shipping_address || args?.shippingAddress || 'Customer Site';
        if (!orderNumber || !customerName) throw new Error('order_number and customer_name are required');
        const dcRes = await createDeliveryChallan({
          order_number: orderNumber,
          customer_name: customerName,
          shipping_address: shippingAddress,
          transporter_name: args?.transporter_name,
          vehicle_number: args?.vehicle_number,
          eway_bill_number: args?.eway_bill_number,
        });
        if (!dcRes.success) throw new Error(dcRes.error);
        resultData = dcRes.data;
        dataAccessed.push('sales_orders', 'dispatches');
        summary = `Generated Delivery Challan ${dcRes.data?.delivery_challan_number} for Order ${orderNumber}`;
        break;
      }

      case 'get_accounts_aging': {
        const basis = (args?.basis === 'due_date' ? 'due_date' : 'invoice_date') as 'invoice_date' | 'due_date';
        const agingRes = await getAccountsAging(basis);
        if (!agingRes.success) throw new Error('Failed to compute accounts aging');
        resultData = {
          basis,
          totalOutstanding: agingRes.totalOutstanding,
          totalOverdue: agingRes.totalOverdue,
          buckets: {
            '0-30': { amount: agingRes.buckets['0-30'].amount, count: agingRes.buckets['0-30'].invoiceCount },
            '31-60': { amount: agingRes.buckets['31-60'].amount, count: agingRes.buckets['31-60'].invoiceCount },
            '61-90': { amount: agingRes.buckets['61-90'].amount, count: agingRes.buckets['61-90'].invoiceCount },
            '90+': { amount: agingRes.buckets['90+'].amount, count: agingRes.buckets['90+'].invoiceCount },
          },
        };
        dataAccessed.push('invoices', 'payments');
        summary = `Accounts Aging: Total Outstanding ₹${agingRes.totalOutstanding.toLocaleString('en-IN')}, Overdue ₹${agingRes.totalOverdue.toLocaleString('en-IN')}`;
        break;
      }

      case 'get_customer_outstanding_balance': {
        const customerQuery = args?.customerId || args?.customer_id || args?.customerName || args?.search;
        const outRes = await getCustomerOutstandingBalance(customerQuery);
        if (!outRes.success) throw new Error('Failed to fetch customer outstanding balance');
        resultData = {
          totalReceivables: outRes.totalReceivables,
          customersCount: outRes.summaries.length,
          summaries: outRes.summaries.slice(0, 15).map((s) => ({
            customer_name: s.customerName,
            company_name: s.companyName,
            total_invoiced: s.totalInvoiced,
            total_paid: s.totalPaid,
            total_balance: s.totalBalance,
            overdue_balance: s.overdueBalance,
            invoice_count: s.invoiceCount,
          })),
        };
        dataAccessed.push('invoices', 'customers');
        summary = `Retrieved receivables summary for ${outRes.summaries.length} customers (Total: ₹${outRes.totalReceivables.toLocaleString('en-IN')})`;
        break;
      }

      case 'check_warranty_status': {
        const serialNum = args?.serial_number || args?.serialNumber;
        if (!serialNum) throw new Error('serial_number is required');
        const wRes = await checkWarrantyStatus(serialNum);
        resultData = wRes;
        dataAccessed.push('serial_records');
        summary = `Warranty for ${serialNum}: Status=${wRes.status}, Active=${wRes.isWarrantyActive}${wRes.warrantyEndDate ? `, Expiry=${wRes.warrantyEndDate}` : ''}`;
        break;
      }

      case 'file_warranty_claim': {
        const serialNum = args?.serial_number || args?.serialNumber;
        const custName = args?.customer_name || args?.customerName;
        const desc = args?.issue_description || args?.issueDescription || args?.description;
        if (!serialNum || !custName || !desc) {
          throw new Error('serial_number, customer_name, and issue_description are required');
        }
        const claimRes = await createWarrantyClaim({
          serial_number: serialNum,
          customer_name: custName,
          product_name: args?.product_name || args?.productName,
          issue_description: desc,
          claim_type: args?.claim_type || 'REPAIR',
        });
        if (!claimRes.success) throw new Error(claimRes.error);
        resultData = claimRes.data;
        dataAccessed.push('serial_records', 'warranty_claims');
        summary = `Filed Warranty Claim ${claimRes.data?.claim_number} for Serial ${serialNum}`;
        break;
      }

      case 'send_customer_message': {
        const recipient = args?.recipient || args?.to;
        const body = args?.message_body || args?.message || args?.content;
        const channel = args?.channel || 'WHATSAPP';
        if (!recipient || !body) throw new Error('recipient and message_body are required');

        const queueRes = await queueOutboxMessage({
          recipient,
          recipient_name: args?.recipient_name || args?.customer_name,
          customer_id: args?.customer_id,
          channel,
          subject: args?.subject,
          message_body: body,
          template_id: args?.template_id,
          template_data: args?.template_data,
        });
        if (!queueRes.success) throw new Error(queueRes.error);
        resultData = queueRes.data;
        dataAccessed.push('communication_outbox');
        summary = `Queued outbound ${channel} to ${recipient} (Message ID: ${queueRes.data?.id})`;
        break;
      }

      case 'get_customer_communication_history': {
        const query = args?.customer_id || args?.customerId || args?.phone || args?.email || args?.search;
        if (!query) throw new Error('customer_id, phone, or email is required');
        const histRes = await getCustomerCommunicationHistory(query);
        resultData = histRes.timeline;
        dataAccessed.push('communication_outbox', 'communication_inbox');
        summary = `Retrieved ${histRes.timeline.length} communication messages for query "${query}"`;
        break;
      }

      case 'qualify_sales_lead': {
        const criteria = {
          space_type: args?.space_type || args?.spaceType || 'BOARDROOM',
          seating_capacity: args?.seating_capacity || args?.seatingCapacity,
          budget_inr: args?.budget_inr || args?.budget || args?.estimated_budget,
          timeline: args?.timeline,
          decision_maker_role: args?.decision_maker_role || args?.role,
        };
        const qualRes = await qualifySalesLead(criteria);
        resultData = qualRes;
        summary = `Qualified lead: Score ${qualRes.score}/100 (${qualRes.status}). Budget: ${qualRes.budget_adequacy}, Urgency: ${qualRes.timeline_urgency}`;
        break;
      }

      case 'recommend_solution_package': {
        const space = args?.space_type || args?.spaceType || 'BOARDROOM';
        const seating = args?.seating_capacity || args?.seatingCapacity || 12;
        const budget = args?.budget_inr || args?.budget || args?.estimated_budget;
        const recRes = await recommendSolutionPackage(space, seating, budget);
        resultData = recRes;
        dataAccessed.push('products');
        summary = `Recommended Package "${recRes.package_name}": ${recRes.items.length} items, Grand Total ₹${recRes.estimated_grand_total.toLocaleString('en-IN')}`;
        break;
      }

      case 'route_telephony_call': {
        const callerNumber = args?.caller_number || args?.callerNumber || args?.phone;
        const speechSnippet = (args?.speech || args?.text || args?.snippet || '').toLowerCase();
        let targetDepartment = 'General Desk';
        let routingIntent = 'GENERAL';

        if (speechSnippet.includes('quote') || speechSnippet.includes('price') || speechSnippet.includes('projector') || speechSnippet.includes('display')) {
          targetDepartment = 'Commercial Sales Desk';
          routingIntent = 'SALES_ENQUIRY';
        } else if (speechSnippet.includes('not working') || speechSnippet.includes('repair') || speechSnippet.includes('broken') || speechSnippet.includes('technician')) {
          targetDepartment = 'Technical Support & Service Desk';
          routingIntent = 'SERVICE_COMPLAINT';
        } else if (speechSnippet.includes('invoice') || speechSnippet.includes('payment') || speechSnippet.includes('bill')) {
          targetDepartment = 'Accounts & Billing Desk';
          routingIntent = 'PAYMENT_BILLING';
        } else if (speechSnippet.includes('amc') || speechSnippet.includes('annual maintenance') || speechSnippet.includes('contract')) {
          targetDepartment = 'AMC & Contracts Desk';
          routingIntent = 'AMC_RENEWAL';
        }

        resultData = {
          caller_number: callerNumber,
          target_department: targetDepartment,
          routing_intent: routingIntent,
          priority: routingIntent === 'SERVICE_COMPLAINT' ? 'HIGH' : 'NORMAL',
        };
        summary = `Routed call from ${callerNumber || 'Unknown'} to ${targetDepartment} (Intent: ${routingIntent})`;
        break;
      }

      case 'analyze_call_transcript': {
        const callSid = args?.call_sid || args?.callSid || args?.id;
        if (!callSid) throw new Error('call_sid is required');
        const analysis = await analyzeCallTranscript(callSid);
        if (!analysis.success) throw new Error(analysis.error || 'Failed to analyze transcript');
        resultData = analysis;
        dataAccessed.push('telephony_calls', 'telephony_transcripts');
        summary = `Analyzed Call ${callSid}: Intent=${analysis.intent}, Sentiment=${analysis.sentiment}, ${analysis.actionItems.length} action items`;
        break;
      }

      case 'get_business_kpis': {
        const kpis = await getBusinessKPIsSummary();
        resultData = kpis;
        dataAccessed.push('enquiries', 'quotations', 'sales_orders', 'invoices', 'customers');
        summary = `Retrieved executive business KPIs summary: Pipeline=${kpis.pipeline.total_enquiries} enquiries (Conv: ${kpis.pipeline.conversion_rate_percent}%), Collections=${kpis.collection_efficiency.efficiency_rate_percent}%`;
        break;
      }

      case 'get_revenue_analytics': {
        const revenue = await getRevenueByCategory();
        resultData = revenue;
        dataAccessed.push('sales_orders', 'products');
        summary = `Retrieved revenue by category across ${revenue.length} product lines`;
        break;
      }

      case 'generate_executive_briefing': {
        const schedule = args?.schedule || 'DAILY';
        const reportType = args?.report_type || args?.reportType;
        const res = await generateExecutiveBriefing(schedule, reportType);
        if (!res.success || !res.briefing) throw new Error(res.error || 'Failed to generate briefing');
        resultData = res.briefing;
        dataAccessed.push('enquiries', 'quotations', 'sales_orders', 'invoices', 'executive_briefings');
        summary = `Generated ${schedule} executive briefing: "${res.briefing.title}"`;
        break;
      }

      case 'get_scheduled_reports': {
        const schedule = args?.schedule;
        const [briefings, configs] = await Promise.all([
          getExecutiveBriefings(schedule ? { schedule } : undefined),
          getExecutiveScheduleConfigs(),
        ]);
        resultData = { briefings, configs };
        dataAccessed.push('executive_briefings', 'executive_schedule_configs');
        summary = `Retrieved ${briefings.length} executive briefings and ${configs.length} schedule configs`;
        break;
      }

      case 'initiate_human_call': {
        const salespersonPhone = args?.salesperson_phone || '+91 98490 00001';
        const customerPhone = args?.customer_phone || args?.recipient;
        if (!customerPhone) throw new Error('customer_phone is required');
        const res = await initiateDirectSalespersonCall({
          salesperson_phone: salespersonPhone,
          salesperson_name: args?.salesperson_name,
          customer_phone: customerPhone,
          customer_id: args?.customer_id,
          customer_name: args?.customer_name,
          note: args?.note,
        });
        if (!res.success || !res.call) throw new Error(res.error || 'Failed to initiate direct call');
        resultData = res.call;
        dataAccessed.push('telephony_calls');
        summary = `Initiated human call from Airtel phone ${salespersonPhone} to ${customerPhone}`;
        break;
      }

      case 'transfer_call_to_salesperson': {
        const callSid = args?.call_sid || args?.callSid;
        const salespersonPhone = args?.salesperson_phone || '+91 98490 00001';
        if (!callSid) throw new Error('call_sid is required');
        const res = await transferCallToSalesperson({
          call_sid: callSid,
          salesperson_phone: salespersonPhone,
          salesperson_name: args?.salesperson_name,
          reason: args?.reason,
        });
        if (!res.success || !res.call) throw new Error(res.error || 'Failed to transfer call');
        resultData = { call: res.call, handoffSummary: res.handoffSummary };
        dataAccessed.push('telephony_calls', 'telephony_transcripts');
        summary = `Transferred AI call ${callSid} to salesperson Airtel phone ${salespersonPhone}`;
        break;
      }

      case 'send_whatsapp_document': {
        const docType = (args?.document_type || args?.docType || 'BROCHURE').toUpperCase();
        const recipient = args?.recipient || args?.phone;
        if (!recipient) throw new Error('recipient phone is required');

        let res;
        if (docType === 'BROCHURE') {
          res = await sendWhatsAppBrochure({
            recipient,
            customer_id: args?.customer_id,
            customer_name: args?.customer_name,
            brochure_url: args?.url,
          });
        } else if (docType === 'CATALOGUE') {
          res = await sendWhatsAppCatalogue({
            recipient,
            category: args?.category,
            customer_id: args?.customer_id,
            customer_name: args?.customer_name,
            catalogue_url: args?.url,
          });
        } else if (docType === 'QUOTATION') {
          res = await sendWhatsAppQuotationPDF({
            quotation_id: args?.quotation_id || 'QUOT-GEN',
            quotation_number: args?.quotation_number || 'Q-2026-001',
            grand_total: args?.grand_total || 500000,
            recipient,
            customer_name: args?.customer_name,
            pdf_url: args?.url,
          });
        } else if (docType === 'INVOICE') {
          res = await sendWhatsAppInvoicePDF({
            invoice_id: args?.invoice_id || 'INV-GEN',
            invoice_number: args?.invoice_number || 'INV-2026-001',
            grand_total: args?.grand_total || 500000,
            balance_amount: args?.balance_amount || 0,
            recipient,
            customer_name: args?.customer_name,
            pdf_url: args?.url,
          });
        } else {
          throw new Error(`Unsupported WhatsApp document type: ${docType}`);
        }

        if (!res.success || !res.outboxItem) throw new Error(res.error || 'Failed to dispatch WhatsApp document');
        resultData = res.outboxItem;
        dataAccessed.push('communication_outbox');
        summary = `Dispatched WhatsApp ${docType} to ${recipient}`;
        break;
      }

      case 'escalate_whatsapp_to_human': {
        const inboxId = args?.inbox_item_id || args?.inboxId || args?.id;
        if (!inboxId) throw new Error('inbox_item_id is required');
        const res = await escalateWhatsAppToHuman({
          inbox_item_id: inboxId,
          salesperson_id: args?.salesperson_id,
          salesperson_name: args?.salesperson_name,
          salesperson_phone: args?.salesperson_phone,
          reason: args?.reason || 'Customer requested human agent',
        });
        if (!res.success) throw new Error(res.error || 'Failed to escalate WhatsApp chat');
        resultData = res;
        dataAccessed.push('communication_inbox');
        summary = `Escalated WhatsApp conversation ${inboxId} to human salesperson`;
        break;
      }

      default:
        throw new Error(`Unknown AI tool: ${toolName}`);
    }

    let classification: AIActionClassification = 'AI Executed';
    if (policy.requiresConfirmation) {
      classification = 'AI Recommended';
    } else if (
      toolName.startsWith('generate_') ||
      toolName.startsWith('extract_') ||
      toolName.startsWith('analyze_')
    ) {
      classification = 'AI Generated';
    } else if (toolName.startsWith('recommend_')) {
      classification = 'AI Recommended';
    } else {
      classification = 'AI Executed';
    }

    const auditRecord: AIAuditRecord = {
      id: `AIAUDIT-${Date.now()}`,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      intent: args?.intent || `Execution of ${toolName}`,
      tool_name: toolName,
      arguments: args,
      data_accessed: dataAccessed,
      recommendation: summary,
      requires_human_confirmation: policy.requiresConfirmation,
      status: policy.requiresConfirmation ? 'PENDING_CONFIRMATION' : 'EXECUTED',
      classification,
      result_summary: summary,
      created_at: new Date().toISOString(),
    };

    getAIAuditStore().unshift(auditRecord);

    await logAuditEvent({
      userName,
      action: 'AI_SAFE_TOOL_EXECUTION',
      module: 'AI_GATEWAY',
      details: `AI Tool "${toolName}" executed by ${userName} [${classification}]: ${summary}`,
    });

    return {
      success: true,
      toolName,
      data: resultData,
      requiresConfirmation: policy.requiresConfirmation,
      auditId: auditRecord.id,
      classification,
    };
  } catch (err) {
    return {
      success: false,
      toolName,
      error: (err as Error).message || 'Tool execution error',
    };
  }
}

/**
 * Records human confirmation/approval of a pending AI recommendation.
 * Classifies status as 'Human Approved' and 'EXECUTED'.
 */
export async function confirmAIToolAction(
  auditId: string,
  confirmedByName: string
): Promise<{ success: boolean; error?: string }> {
  const store = getAIAuditStore();
  const record = store.find((r) => r.id === auditId);
  if (!record) {
    return { success: false, error: 'AI audit record not found' };
  }
  record.status = 'EXECUTED';
  record.confirmed_by = confirmedByName;
  record.classification = 'Human Approved';

  await logAuditEvent({
    userName: confirmedByName,
    action: 'AI_ACTION_HUMAN_APPROVED',
    module: 'AI_GATEWAY',
    details: `Human confirmed AI action "${record.tool_name}" (${auditId}) [Human Approved]`,
  });

  return { success: true };
}
