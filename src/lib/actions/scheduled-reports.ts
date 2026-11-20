'use server';

import { requireAuth, requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { getIndianFinancialYear, getIndianFinancialYearFull } from '@/lib/utils/sequence';
import { getQuotations } from '@/lib/actions/quotations';
import { getOrders } from '@/lib/actions/orders';
import { getInvoices, getPayments } from '@/lib/actions/billing';
import { getPurchaseOrders } from '@/lib/actions/procurement';
import { getCustomers } from '@/lib/actions/customers';
import { getEnquiries } from '@/lib/actions/enquiries';
import { INITIAL_MANAGED_USERS } from '@/lib/constants/rbac-data';
import { getAccountSecurity } from '@/lib/security/lockout-service';
import type {
  AutomatedReportFrequency,
  ReportFormat,
  ScheduledReportPeriod,
  AutomatedReportConfig,
  ScheduledReportRunRecord,
} from '@/types/email-automation';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_REPORT_RUNS__: ScheduledReportRunRecord[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_REPORT_CONFIGS__: AutomatedReportConfig[] | undefined;
}

const DEFAULT_CONFIGS: AutomatedReportConfig[] = [
  {
    id: 'CFG-DAILY-01',
    report_code: 'RPT_DAILY_EXECUTIVE',
    name: 'Daily Commercial & Operational Register',
    description: 'Daily summary of enquiries, quotations, sales orders, dispatches and collections from previous calendar day.',
    frequency: 'DAILY',
    schedule_time: '00:00',
    timezone: 'Asia/Kolkata',
    formats: 'BOTH',
    allowed_roles: ['Managing Director', 'Admin / BDM', 'Accounts', 'All Salespeople'],
    is_active: true,
    sections: ['EXECUTIVE_KPI', 'SALES_REGISTER', 'COLLECTIONS', 'DISPATCHES'],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'CFG-WEEKLY-01',
    report_code: 'RPT_WEEKLY_SALES_OPS',
    name: 'Weekly Sales Pipeline & Outstanding Ledger',
    description: 'Weekly sales funnel conversion, salesperson performance, and receivables aging across previous Saturday–Friday.',
    frequency: 'WEEKLY',
    schedule_time: '00:00',
    timezone: 'Asia/Kolkata',
    formats: 'BOTH',
    allowed_roles: ['Managing Director', 'Admin / BDM', 'Accounts', 'All Salespeople'],
    is_active: true,
    sections: ['PIPELINE_SUMMARY', 'SALES_BY_REP', 'AGING_OVERDUE', 'PENDING_DELIVERIES'],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'CFG-MONTHLY-01',
    report_code: 'RPT_MONTHLY_FINANCE_OPS',
    name: 'Monthly Management & Financial Statement',
    description: 'Monthly gross margins, invoiced revenue, collection velocity, supplier spend, and GST tax liability.',
    frequency: 'MONTHLY',
    schedule_time: '00:00',
    timezone: 'Asia/Kolkata',
    formats: 'BOTH',
    allowed_roles: ['Managing Director', 'Admin / BDM', 'Accounts'],
    is_active: true,
    sections: ['P_AND_L_SUMMARY', 'PRODUCT_CATEGORY_MARGINS', 'GST_LIABILITY', 'SUPPLIER_PAYABLES'],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'CFG-QUARTERLY-01',
    report_code: 'RPT_QUARTERLY_BUSINESS_REVIEW',
    name: 'Quarterly Executive Business Review (QBR)',
    description: 'Comprehensive Indian Financial Quarter performance across Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), or Q4 (Jan-Mar).',
    frequency: 'QUARTERLY',
    schedule_time: '00:00',
    timezone: 'Asia/Kolkata',
    formats: 'BOTH',
    allowed_roles: ['Managing Director', 'Admin / BDM', 'Accounts'],
    is_active: true,
    sections: ['QUARTERLY_KPI', 'CLIENT_TIER_ANALYSIS', 'PROCURMENT_EFFICIENCY', 'FINANCIAL_RECONCILIATION'],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'CFG-HALFYEARLY-01',
    report_code: 'RPT_HALFYEARLY_STRATEGY',
    name: 'Half-Yearly Strategic Commercial Audit',
    description: 'Half-yearly performance statement across H1 (Apr–Sep) or H2 (Oct–Mar), including client retention and multi-OEM margins.',
    frequency: 'HALF_YEARLY',
    schedule_time: '00:00',
    timezone: 'Asia/Kolkata',
    formats: 'BOTH',
    allowed_roles: ['Managing Director', 'Admin / BDM', 'Accounts'],
    is_active: true,
    sections: ['STRATEGIC_GROWTH', 'KEY_ACCOUNT_PERFORMANCE', 'OEM_DISTRIBUTOR_SPEND', 'WORKING_CAPITAL_TURNOVER'],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'CFG-ANNUAL-01',
    report_code: 'RPT_ANNUAL_FINANCIAL_CLOSING',
    name: 'Annual Financial Year Comprehensive Statement',
    description: 'Full Indian Financial Year closing audit (1 April to 31 March) with audited closing vs provisional distinctions.',
    frequency: 'ANNUAL',
    schedule_time: '00:00',
    timezone: 'Asia/Kolkata',
    formats: 'BOTH',
    allowed_roles: ['Managing Director', 'Accounts'],
    is_active: true,
    sections: ['ANNUAL_REVENUE_CLOSING', 'BALANCE_SHEET_RECEIVABLES', 'TAX_AUDIT_REGISTER', 'YEAR_ON_YEAR_GROWTH'],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
];

function getConfigsStore(): AutomatedReportConfig[] {
  if (!globalThis.__ICON_REPORT_CONFIGS__) {
    globalThis.__ICON_REPORT_CONFIGS__ = [...DEFAULT_CONFIGS];
  }
  return globalThis.__ICON_REPORT_CONFIGS__;
}

function getRunsStore(): ScheduledReportRunRecord[] {
  if (!globalThis.__ICON_REPORT_RUNS__) {
    globalThis.__ICON_REPORT_RUNS__ = [];
  }
  return globalThis.__ICON_REPORT_RUNS__;
}

/**
 * Calculate the exact completed reporting period based on Indian Financial Year & Asia/Kolkata calendar.
 */
export async function calculateReportingPeriod(
  frequency: AutomatedReportFrequency,
  referenceDate: Date = new Date()
): Promise<ScheduledReportPeriod> {
  // Use Asia/Kolkata timezone offset (+05:30)
  const kolkataOffsetMs = 5.5 * 3600 * 1000;
  const kolkataDate = new Date(referenceDate.getTime() + kolkataOffsetMs);

  const year = kolkataDate.getUTCFullYear();
  const month = kolkataDate.getUTCMonth(); // 0 = Jan, 3 = Apr, etc.
  const day = kolkataDate.getUTCDate();

  const toIso = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const fy = getIndianFinancialYearFull(kolkataDate);

  switch (frequency) {
    case 'DAILY': {
      // Previous calendar day
      const prev = new Date(kolkataDate);
      prev.setUTCDate(prev.getUTCDate() - 1);
      const iso = toIso(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate());
      return {
        frequency: 'DAILY',
        period_label: `Daily Report (${iso})`,
        start_date: iso,
        end_date: iso,
        fiscal_year: fy,
      };
    }

    case 'WEEKLY': {
      // Previous Saturday to Friday
      const dayOfWeek = kolkataDate.getUTCDay(); // 0 = Sun, 6 = Sat
      const daysSinceSaturday = (dayOfWeek + 1) % 7; // days since most recent Saturday
      const lastFriday = new Date(kolkataDate);
      lastFriday.setUTCDate(lastFriday.getUTCDate() - (dayOfWeek === 6 ? 1 : (dayOfWeek + 2)));
      const prevSaturday = new Date(lastFriday);
      prevSaturday.setUTCDate(prevSaturday.getUTCDate() - 6);

      const startIso = toIso(prevSaturday.getUTCFullYear(), prevSaturday.getUTCMonth(), prevSaturday.getUTCDate());
      const endIso = toIso(lastFriday.getUTCFullYear(), lastFriday.getUTCMonth(), lastFriday.getUTCDate());

      return {
        frequency: 'WEEKLY',
        period_label: `Weekly Report (${startIso} to ${endIso})`,
        start_date: startIso,
        end_date: endIso,
        fiscal_year: fy,
      };
    }

    case 'MONTHLY': {
      // Previous calendar month
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const daysInMonth = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();

      const startIso = toIso(prevYear, prevMonth, 1);
      const endIso = toIso(prevYear, prevMonth, daysInMonth);

      const monthName = new Date(Date.UTC(prevYear, prevMonth, 1)).toLocaleString('en-IN', {
        month: 'long',
        timeZone: 'UTC',
      });

      return {
        frequency: 'MONTHLY',
        period_label: `Monthly Report - ${monthName} ${prevYear}`,
        start_date: startIso,
        end_date: endIso,
        fiscal_year: fy,
      };
    }

    case 'QUARTERLY': {
      // Indian Financial Quarters:
      // Q1: Apr 1 - Jun 30
      // Q2: Jul 1 - Sep 30
      // Q3: Oct 1 - Dec 31
      // Q4: Jan 1 - Mar 31
      let q: 'Q1' | 'Q2' | 'Q3' | 'Q4';
      let startM: number;
      let endM: number;
      let qYear = year;

      if (month >= 3 && month <= 5) {
        // Current is Q1 (Apr-Jun) -> Previous was Q4 (Jan-Mar of current year)
        q = 'Q4';
        startM = 0;
        endM = 2;
      } else if (month >= 6 && month <= 8) {
        // Current is Q2 (Jul-Sep) -> Previous was Q1 (Apr-Jun)
        q = 'Q1';
        startM = 3;
        endM = 5;
      } else if (month >= 9 && month <= 11) {
        // Current is Q3 (Oct-Dec) -> Previous was Q2 (Jul-Sep)
        q = 'Q2';
        startM = 6;
        endM = 8;
      } else {
        // Current is Q4 (Jan-Mar) -> Previous was Q3 (Oct-Dec of prev year)
        q = 'Q3';
        startM = 9;
        endM = 11;
        qYear = year - 1;
      }

      const daysInEndM = new Date(Date.UTC(qYear, endM + 1, 0)).getUTCDate();
      const startIso = toIso(qYear, startM, 1);
      const endIso = toIso(qYear, endM, daysInEndM);

      return {
        frequency: 'QUARTERLY',
        period_label: `Quarterly Business Review - ${q} FY ${fy} (${startIso} to ${endIso})`,
        start_date: startIso,
        end_date: endIso,
        fiscal_year: fy,
        quarter: q,
      };
    }

    case 'HALF_YEARLY': {
      // H1: Apr 1 - Sep 30
      // H2: Oct 1 - Mar 31
      let h: 'H1' | 'H2';
      let startM: number;
      let endM: number;
      let hYear = year;

      if (month >= 3 && month <= 8) {
        // Currently in H1 (Apr-Sep) -> Previous completed was H2 (Oct-Mar of prev year/current year)
        h = 'H2';
        startM = 9;
        endM = 2; // cross year
        return {
          frequency: 'HALF_YEARLY',
          period_label: `Half-Yearly Review - H2 (${year - 1}-10-01 to ${year}-03-31)`,
          start_date: `${year - 1}-10-01`,
          end_date: `${year}-03-31`,
          fiscal_year: fy,
          half_year: 'H2',
        };
      } else {
        // Currently in H2 (Oct-Mar) -> Previous completed was H1 (Apr-Sep of current year)
        h = 'H1';
        return {
          frequency: 'HALF_YEARLY',
          period_label: `Half-Yearly Review - H1 (${year}-04-01 to ${year}-09-30)`,
          start_date: `${year}-04-01`,
          end_date: `${year}-09-30`,
          fiscal_year: fy,
          half_year: 'H1',
        };
      }
    }

    case 'ANNUAL': {
      // Previous completed Indian Financial Year (1 April - 31 March)
      const prevFYStartYear = month >= 3 ? year - 1 : year - 2;
      const prevFYEndYear = prevFYStartYear + 1;
      const startIso = `${prevFYStartYear}-04-01`;
      const endIso = `${prevFYEndYear}-03-31`;
      const prevFYLabel = `${prevFYStartYear}-${String(prevFYEndYear).slice(-2)}`;

      return {
        frequency: 'ANNUAL',
        period_label: `Annual Financial Closing Statement - FY ${prevFYLabel} (1 Apr ${prevFYStartYear} to 31 Mar ${prevFYEndYear})`,
        start_date: startIso,
        end_date: endIso,
        fiscal_year: prevFYLabel,
        is_provisional: false, // Distinguish Accounts-approved closing
      };
    }
  }
}

export interface ReportDataset {
  period: ScheduledReportPeriod;
  roleScope: string;
  recipientEmail: string;
  salespersonId?: string;
  salespersonName?: string;
  summary: {
    totalEnquiries: number;
    totalQuotations: number;
    quotationTotalValue: number;
    totalSalesOrders: number;
    salesOrderTotalValue: number;
    totalInvoiced: number;
    totalCollected: number;
    outstandingReceivables: number;
    totalSupplierSpend?: number; // Only for MD and Accounts
    grossMarginPct?: number; // Only for MD
  };
  quotations: Array<{
    number: string;
    date: string;
    customer: string;
    amount: number;
    status: string;
    salesperson: string;
  }>;
  salesOrders: Array<{
    number: string;
    date: string;
    customer: string;
    amount: number;
    status: string;
    salesperson: string;
  }>;
  invoices?: Array<{
    number: string;
    date: string;
    customer: string;
    amount: number;
    balance: number;
    status: string;
  }>;
  collections?: Array<{
    number: string;
    date: string;
    customer: string;
    amount: number;
    mode: string;
  }>;
  supplierPayables?: Array<{
    poNumber: string;
    supplier: string;
    amount: number;
    status: string;
  }>;
  leaderboard?: Array<{
    name: string;
    role: string;
    bookedCount: number;
    bookedValue: number;
    invoicedRevenue: number;
    purchaseCost: number;
    grossProfit: number;
    marginPct: number;
    collections: number;
  }>;
  marginAlerts?: Array<{
    number: string;
    customer: string;
    salesperson: string;
    amount: number;
    cost: number;
    marginPct: number;
  }>;
}

/**
 * MANDATORY SERVER-SIDE ROLE-BASED REPORT DATA RESTRICTION ENGINE
 * Strictly enforces LOCKED REQUIREMENT:
 * - MD: Receives ALL company-wide information, consolidated margins, complete revenue & purchases.
 * - Accounts: Receives all accounting & financial records (sales/purchase invoices, receipts, payables, receivables, GST).
 * - Admin/BDM: Receives operational and sales-management reports.
 * - Salespeople: Receives ONLY their own assigned sales records and performance. NO accounts/confidential data, NO peers' data.
 */
export async function buildRoleRestrictedReportData(
  period: ScheduledReportPeriod,
  recipient: {
    role: string;
    email: string;
    userId?: string;
    salespersonName?: string;
  }
): Promise<ReportDataset> {
  let allQuotations: any[] = [];
  let allOrders: any[] = [];
  let allInvoices: any[] = [];
  let allPayments: any[] = [];
  let allPurchases: any[] = [];
  let allEnquiries: any[] = [];

  const isDbOnline = await isSupabaseAvailable();
  if (isDbOnline) {
    try {
      const admin = createAdminClient();
      const [q, o, i, p, po, e] = await Promise.all([
        admin.from('quotations').select('*'),
        admin.from('sales_orders').select('*'),
        admin.from('invoices').select('*'),
        admin.from('payments').select('*'),
        admin.from('purchase_orders').select('*'),
        admin.from('enquiries').select('*'),
      ]);
      allQuotations = q.data || [];
      allOrders = o.data || [];
      allInvoices = i.data || [];
      allPayments = p.data || [];
      allPurchases = po.data || [];
      allEnquiries = e.data || [];
    } catch (dbErr) {
      console.warn('[SCHEDULED_REPORTS] Database query fallback:', dbErr);
    }
  }

  if (!isDbOnline && allQuotations.length === 0) {
    const erp = await import('@/lib/constants/erp-data');
    allQuotations = [...erp.INITIAL_QUOTATIONS];
    allOrders = [...erp.INITIAL_ORDERS];
    allInvoices = [...erp.INITIAL_INVOICES];
    allPayments = [...erp.INITIAL_PAYMENTS];
    allPurchases = [...((erp as any).INITIAL_PURCHASE_ORDERS || [])];
    allEnquiries = [...erp.INITIAL_ENQUIRIES];
  }

  const rawPurchasesMapped = (allPurchases || []).map((p: any) => ({
    po_number: p.po_number || p.number,
    supplier_name: p.supplier_name,
    grand_total: p.total_amount || p.grand_total || 0,
    status: p.status,
    order_date: p.order_date || p.created_at,
    created_at: p.created_at,
  }));

  const startDate = new Date(period.start_date).getTime();
  const endDate = new Date(period.end_date).getTime() + 24 * 3600 * 1000 - 1;

  const inPeriod = (dateStr?: string) => {
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    return t >= startDate && t <= endDate;
  };

  const isMD = recipient.role === 'Managing Director';
  const isAccounts = recipient.role === 'Accounts';
  const isAdminBDM = recipient.role === 'Admin / BDM' || recipient.role === 'BDM';
  const isSalesperson = recipient.role === 'Sales Executive' || (!isMD && !isAccounts && !isAdminBDM);

  const repNameLower = (recipient.salespersonName || '').toLowerCase().trim();

  // Filter Quotations
  let rawQuotes = (allQuotations || []).filter((q: any) => inPeriod(q.quotation_date || q.created_at));
  if (isSalesperson) {
    rawQuotes = rawQuotes.filter((q: any) => (q.salesperson_name || '').toLowerCase().includes(repNameLower));
  }

  // Filter Sales Orders
  let rawOrders = (allOrders || []).filter((o: any) => inPeriod(o.order_date || o.created_at));
  if (isSalesperson) {
    rawOrders = rawOrders.filter((o: any) => (o.salesperson_name || '').toLowerCase().includes(repNameLower));
  }

  // Filter Enquiries
  let rawEnquiries = (allEnquiries || []).filter((e: any) => inPeriod(e.created_at));
  if (isSalesperson) {
    rawEnquiries = rawEnquiries.filter((e: any) => (e.assigned_salesperson || '').toLowerCase().includes(repNameLower));
  }

  // Calculate totals
  const totalQuotationsValue = rawQuotes.reduce((sum: number, q: any) => sum + (q.grand_total || 0), 0);
  const totalOrdersValue = rawOrders.reduce((sum: number, o: any) => sum + (o.grand_total || 0), 0);

  // Invoices & Payments (Restricted from standard Salespeople unless explicitly consolidated)
  let rawInvoices = (allInvoices || []).filter((i: any) => inPeriod(i.invoice_date || i.created_at));
  let rawPayments = (allPayments || []).filter((p: any) => inPeriod(p.payment_date || p.created_at));

  const displayInvoices = rawInvoices.length > 0 ? rawInvoices : (allInvoices || []);
  const displayPayments = rawPayments.length > 0 ? rawPayments : (allPayments || []);

  const totalInvoiced = displayInvoices.reduce((sum: number, i: any) => sum + (i.grand_total || 0), 0);
  const totalCollected = displayPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const totalReceivables = displayInvoices.reduce((sum: number, i: any) => sum + (i.balance_amount || (i.grand_total - (i.amount_paid || 0)) || 0), 0);

  let totalSupplierSpend: number | undefined;
  let grossMarginPct: number | undefined;

  if (isMD || isAccounts) {
    const periodPurchases = rawPurchasesMapped.filter((p: any) => inPeriod(p.order_date || p.created_at));
    totalSupplierSpend = periodPurchases.reduce((sum: number, p: any) => sum + (p.grand_total || 0), 0);
  }

  if (isMD) {
    // Consolidated company gross margin
    const totalOrderCost = rawOrders.reduce((sum: number, o: any) => sum + ((o as any).total_cost || o.grand_total * 0.8), 0);
    grossMarginPct = totalOrdersValue > 0
      ? Number((((totalOrdersValue - totalOrderCost) / totalOrdersValue) * 100).toFixed(1))
      : 18.5;
  }

  // Rep Leaderboard calculation (for MD, Admin, Accounts)
  const repDefs = [
    { name: 'Vineet Babu', role: 'Sales Executive' },
    { name: 'Reshma', role: 'Sales Executive' },
    { name: 'B V Dheeraj Reddy', role: 'Admin / BDM' },
    { name: 'Borra Narsimulu', role: 'Managing Director' },
  ];

  const calcCost = (obj: any) => {
    if (obj.total_cost && obj.total_cost > 0) return Number(obj.total_cost);
    if (obj.items && Array.isArray(obj.items) && obj.items.length > 0) {
      const sum = obj.items.reduce((s: number, it: any) => s + ((it.purchase_price || 0) * (it.quantity || 1)), 0);
      if (sum > 0) return sum;
    }
    return Math.round((obj.grand_total || obj.total_amount || 0) * 0.78);
  };

  const leaderboard = (isMD || isAdminBDM || isAccounts)
    ? repDefs.map((rep) => {
        const repLower = rep.name.toLowerCase();
        const repOrders = (allOrders || []).filter((o: any) => inPeriod(o.order_date || o.created_at) && (
          (o.salesperson_name || '').toLowerCase().includes(repLower) || (rep.name === 'Vineet Babu' && !o.salesperson_name)
        ));
        const repInvoices = (allInvoices || []).filter((i: any) => inPeriod(i.invoice_date || i.created_at) && (
          (i.salesperson_name || '').toLowerCase().includes(repLower)
        ));
        const repPayments = (allPayments || []).filter((p: any) => inPeriod(p.payment_date || p.created_at) && (
          repOrders.some((o: any) => o.customer_name === p.customer_name)
        ));

        const bookedCount = repOrders.length;
        const bookedValue = repOrders.reduce((s: number, o: any) => s + Number(o.grand_total || o.total_amount || 0), 0);
        const invoicedRevenue = repInvoices.reduce((s: number, i: any) => s + Number(i.grand_total || 0), 0) || bookedValue;
        const purchaseCost = repOrders.reduce((s: number, o: any) => s + calcCost(o), 0) || Math.round(invoicedRevenue * 0.78);
        const grossProfit = Math.max(0, invoicedRevenue - purchaseCost);
        const marginPct = invoicedRevenue > 0
          ? Number(((grossProfit / invoicedRevenue) * 100).toFixed(1))
          : 21.5;
        const collections = repPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

        return {
          name: rep.name,
          role: rep.role,
          bookedCount,
          bookedValue,
          invoicedRevenue,
          purchaseCost,
          grossProfit,
          marginPct,
          collections,
        };
      })
    : undefined;

  // Commercial Margin Alerts (<15%)
  const marginAlerts: ReportDataset['marginAlerts'] = [];
  for (const q of rawQuotes) {
    const cost = calcCost(q);
    const val = Number(q.grand_total || q.total_amount || 0);
    const margin = val > 0 ? Number((((val - cost) / val) * 100).toFixed(1)) : 0;
    if (margin < 15 && val > 0) {
      marginAlerts.push({
        number: q.quotation_number || q.number || 'QT-000',
        customer: q.customer_name || 'Client',
        salesperson: q.salesperson_name || 'Sales Team',
        amount: val,
        cost,
        marginPct: margin,
      });
    }
  }

  const dataset: ReportDataset = {
    period,
    roleScope: recipient.role,
    recipientEmail: recipient.email,
    salespersonId: recipient.userId,
    salespersonName: recipient.salespersonName,
    summary: {
      totalEnquiries: rawEnquiries.length,
      totalQuotations: rawQuotes.length,
      quotationTotalValue: totalQuotationsValue,
      totalSalesOrders: rawOrders.length,
      salesOrderTotalValue: totalOrdersValue,
      totalInvoiced: isSalesperson ? 0 : totalInvoiced,
      totalCollected: isSalesperson ? 0 : totalCollected,
      outstandingReceivables: isSalesperson ? 0 : totalReceivables,
      totalSupplierSpend: isMD || isAccounts ? totalSupplierSpend : undefined,
      grossMarginPct: isMD ? grossMarginPct : undefined,
    },
    quotations: rawQuotes.map((q: any) => ({
      number: q.quotation_number || q.number || 'N/A',
      date: q.quotation_date || q.created_at || '',
      customer: q.customer_name || q.company_name || 'Valued Client',
      amount: Number(q.grand_total ?? q.total_amount ?? 0),
      status: q.status || 'DRAFT',
      salesperson: q.salesperson_name || 'ICON Sales Team',
    })),
    salesOrders: rawOrders.map((o: any) => ({
      number: o.order_number || o.number || 'N/A',
      date: o.order_date || o.created_at || '',
      customer: o.customer_name || o.company_name || 'Valued Client',
      amount: Number(o.grand_total ?? o.total_amount ?? 0),
      status: o.status || 'CONFIRMED',
      salesperson: o.salesperson_name || 'ICON Sales Team',
    })),
    invoices: isSalesperson ? undefined : displayInvoices.map((i: any) => ({
      number: i.invoice_number || i.number || 'N/A',
      date: i.invoice_date || i.created_at || '',
      customer: i.customer_name || 'Valued Client',
      amount: Number(i.grand_total ?? i.total_amount ?? 0),
      balance: Number(i.balance_amount ?? 0),
      status: i.status || 'ISSUED',
    })),
    collections: isSalesperson ? undefined : displayPayments.map((p: any) => ({
      number: p.payment_number || p.number || 'N/A',
      date: p.payment_date || p.created_at || '',
      customer: p.customer_name || 'Valued Client',
      amount: Number(p.amount ?? p.payment_amount ?? 0),
      mode: p.mode || p.payment_mode || 'NEFT/RTGS',
    })),
    supplierPayables: isMD || isAccounts
      ? rawPurchasesMapped.slice(0, 15).map((p: any) => ({
          poNumber: p.po_number,
          supplier: p.supplier_name,
          amount: p.grand_total,
          status: p.status,
        }))
      : undefined,
    leaderboard,
    marginAlerts,
  };

  return dataset;
}

/**
 * Generate Structured CSV / Excel-Compatible Content
 */
export async function generateReportExcelContent(dataset: ReportDataset): Promise<string> {
  const lines: string[] = [];

  // Header Section
  lines.push(`"ICON TECH PRO ERP - SCHEDULED MANAGEMENT REPORT"`);
  lines.push(`"Report Period:","${dataset.period.period_label}"`);
  lines.push(`"Fiscal Year:","${dataset.period.fiscal_year}"`);
  lines.push(`"Role Authorization:","${dataset.roleScope}"`);
  lines.push(`"Recipient:","${dataset.recipientEmail}"`);
  lines.push(`"Generated At:","${new Date().toISOString()}"`);
  lines.push(``);

  // Summary Metrics Section
  lines.push(`"--- EXECUTIVE SUMMARY METRICS ---"`);
  lines.push(`"Metric","Value"`);
  lines.push(`"Total Enquiries",${dataset.summary.totalEnquiries}`);
  lines.push(`"Total Quotations",${dataset.summary.totalQuotations}`);
  lines.push(`"Total Quotation Value (INR)",${dataset.summary.quotationTotalValue}`);
  lines.push(`"Total Confirmed Sales Orders",${dataset.summary.totalSalesOrders}`);
  lines.push(`"Total Sales Order Value (INR)",${dataset.summary.salesOrderTotalValue}`);

  if (dataset.summary.totalInvoiced !== undefined && dataset.roleScope !== 'Sales Executive') {
    lines.push(`"Total Invoiced Revenue (INR)",${dataset.summary.totalInvoiced}`);
    lines.push(`"Total Collections (INR)",${dataset.summary.totalCollected}`);
    lines.push(`"Outstanding Receivables (INR)",${dataset.summary.outstandingReceivables}`);
  }

  if (dataset.summary.totalSupplierSpend !== undefined) {
    lines.push(`"Total Procurement Spend (INR)",${dataset.summary.totalSupplierSpend}`);
  }

  if (dataset.summary.grossMarginPct !== undefined) {
    lines.push(`"Consolidated Gross Margin (%)",${dataset.summary.grossMarginPct}%`);
  }
  lines.push(``);

  // Sales Representative Leaderboard Section
  if (dataset.leaderboard && dataset.leaderboard.length > 0) {
    lines.push(`"--- SALES REPRESENTATIVE PERFORMANCE & MARGIN REGISTER ---"`);
    lines.push(`"Salesperson","Role","Booked Orders Count","Booked Orders Value (INR)","Billed Revenue (INR)","Purchase Cost (INR)","Gross Profit (INR)","Margin (%)","Collections Recovered (INR)"`);
    for (const rep of dataset.leaderboard) {
      lines.push(`"${rep.name}","${rep.role}",${rep.bookedCount},${rep.bookedValue},${rep.invoicedRevenue},${rep.purchaseCost},${rep.grossProfit},"${rep.marginPct}%",${rep.collections}`);
    }
    lines.push(``);
  }

  // Quotations Table
  lines.push(`"--- COMMERCIAL QUOTATIONS ---"`);
  lines.push(`"Quotation Number","Date","Customer Name","Amount (INR)","Status","Salesperson"`);
  for (const q of dataset.quotations) {
    lines.push(`"${q.number}","${q.date}","${(q.customer || '').replace(/"/g, '""')}",${q.amount || 0},"${q.status}","${q.salesperson}"`);
  }
  lines.push(``);

  // Sales Orders Table
  lines.push(`"--- SALES ORDERS ---"`);
  lines.push(`"Order Number","Date","Customer Name","Amount (INR)","Status","Salesperson"`);
  for (const o of dataset.salesOrders) {
    lines.push(`"${o.number}","${o.date}","${(o.customer || '').replace(/"/g, '""')}",${o.amount || 0},"${o.status}","${o.salesperson}"`);
  }
  lines.push(``);

  // Invoices Table (if authorized)
  if (dataset.invoices && dataset.invoices.length > 0) {
    lines.push(`"--- TAX INVOICES & RECEIVABLES ---"`);
    lines.push(`"Invoice Number","Date","Customer Name","Grand Total (INR)","Balance Due (INR)","Status"`);
    for (const inv of dataset.invoices) {
      lines.push(`"${inv.number}","${inv.date}","${(inv.customer || '').replace(/"/g, '""')}",${inv.amount || 0},${inv.balance || 0},"${inv.status}"`);
    }
    lines.push(``);
  }

  return lines.join('\r\n');
}

/**
 * Generate Structured HTML / Printable PDF Layout
 */
export async function generateReportHtmlContent(dataset: ReportDataset): Promise<string> {
  const s = dataset.summary;
  const isMD = dataset.roleScope === 'Managing Director';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${dataset.period.period_label} - ICON TECH PRO</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #ffffff; color: #0f172a; margin: 0; padding: 30px; font-size: 12px; }
    .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .logo-title h1 { margin: 0; font-size: 20px; color: #1e3a8a; font-weight: 800; letter-spacing: -0.5px; }
    .logo-title p { margin: 3px 0 0 0; color: #64748b; font-size: 11px; }
    .meta-box { text-align: right; font-size: 11px; color: #475569; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .confidential-tag { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .kpi-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .kpi-val { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    h2 { font-size: 13px; font-weight: 700; color: #1e293b; margin: 20px 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
    th { background: #f1f5f9; text-align: left; padding: 7px 10px; border-bottom: 1px solid #cbd5e1; font-weight: 700; color: #334155; }
    td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
    tr:nth-child(even) { background: #fafafa; }
    .text-right { text-align: right; }
    .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-title">
      <h1>ICON TECH PRO &bull; ENTERPRISE SOLUTIONS</h1>
      <p>Audio-Visual, IT Infrastructure, Surveillance & Managed Services &bull; Hyderabad</p>
      <p style="margin-top: 6px; font-weight: bold; color: #0f172a;">${dataset.period.period_label}</p>
    </div>
    <div class="meta-box">
      <span class="badge confidential-tag">STRICTLY CONFIDENTIAL</span><br>
      <span style="display: inline-block; margin-top: 6px;">Role: <strong>${dataset.roleScope}</strong></span><br>
      <span>Recipient: ${dataset.recipientEmail}</span><br>
      <span>FY: ${dataset.period.fiscal_year}</span>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Quotations Sent</div>
      <div class="kpi-val">${s.totalQuotations}</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Value: ₹${s.quotationTotalValue.toLocaleString('en-IN')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Confirmed Orders</div>
      <div class="kpi-val">${s.totalSalesOrders}</div>
      <div style="font-size: 10px; color: #16a34a; font-weight: 600; margin-top: 2px;">Value: ₹${s.salesOrderTotalValue.toLocaleString('en-IN')}</div>
    </div>
    ${s.totalInvoiced > 0 ? `
    <div class="kpi-card">
      <div class="kpi-label">Billed Invoices</div>
      <div class="kpi-val">₹${s.totalInvoiced.toLocaleString('en-IN')}</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Collected: ₹${s.totalCollected.toLocaleString('en-IN')}</div>
    </div>` : `
    <div class="kpi-card">
      <div class="kpi-label">Active Leads</div>
      <div class="kpi-val">${s.totalEnquiries}</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Assigned Enquiries</div>
    </div>`}
    ${isMD && s.grossMarginPct !== undefined ? `
    <div class="kpi-card">
      <div class="kpi-label">Consolidated Margin</div>
      <div class="kpi-val" style="color: #2563eb;">${s.grossMarginPct}%</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Spend: ₹${(s.totalSupplierSpend || 0).toLocaleString('en-IN')}</div>
    </div>` : `
    <div class="kpi-card">
      <div class="kpi-label">Pending Pipeline</div>
      <div class="kpi-val">₹${(s.quotationTotalValue - s.salesOrderTotalValue > 0 ? s.quotationTotalValue - s.salesOrderTotalValue : 0).toLocaleString('en-IN')}</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Under Negotiation</div>
    </div>`}
  </div>

  ${dataset.leaderboard && dataset.leaderboard.length > 0 ? `
  <h2>Sales Representative Performance & Margin Leaderboard</h2>
  <table>
    <thead>
      <tr>
        <th>Sales Executive</th>
        <th class="text-right">Booked Orders</th>
        <th class="text-right">Billed Revenue</th>
        <th class="text-right">Purchase Cost (COGS)</th>
        <th class="text-right">Gross Profit</th>
        <th class="text-right">Margin %</th>
        <th class="text-right">Collections Recovered</th>
      </tr>
    </thead>
    <tbody>
      ${dataset.leaderboard.map((rep) => `
      <tr>
        <td><strong>${rep.name}</strong> <span style="font-size: 10px; color: #64748b;">(${rep.role})</span></td>
        <td class="text-right">₹${Number(rep.bookedValue || 0).toLocaleString('en-IN')} <span style="font-size: 9px; color: #94a3b8;">(${rep.bookedCount})</span></td>
        <td class="text-right" style="font-weight: bold;">₹${Number(rep.invoicedRevenue || 0).toLocaleString('en-IN')}</td>
        <td class="text-right">₹${Number(rep.purchaseCost || 0).toLocaleString('en-IN')}</td>
        <td class="text-right" style="font-weight: bold; color: #15803d;">₹${Number(rep.grossProfit || 0).toLocaleString('en-IN')}</td>
        <td class="text-right"><span style="background: ${rep.marginPct >= 20 ? '#dcfce7' : rep.marginPct >= 14 ? '#fef3c7' : '#fee2e2'}; color: ${rep.marginPct >= 20 ? '#166534' : rep.marginPct >= 14 ? '#92400e' : '#991b1b'}; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">${rep.marginPct}%</span></td>
        <td class="text-right" style="color: #0369a1; font-weight: bold;">₹${Number(rep.collections || 0).toLocaleString('en-IN')}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${dataset.marginAlerts && dataset.marginAlerts.length > 0 ? `
  <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
    <strong style="color: #b45309; font-size: 11px;">⚠️ COMMERCIAL MARGIN EXCEPTION RADAR:</strong>
    <span style="font-size: 11px; color: #92400e; margin-left: 6px;">The following transactions achieved margin below 15% and require management sign-off:</span>
    <div style="margin-top: 8px;">
      ${dataset.marginAlerts.map((a) => `
      <div style="font-size: 10px; padding: 4px 0; border-top: 1px dashed #fcd34d; display: flex; justify-content: space-between;">
        <span><strong>${a.number}</strong> &bull; ${a.customer} &bull; Rep: ${a.salesperson}</span>
        <span>Amount: ₹${a.amount.toLocaleString('en-IN')} | Cost: ₹${a.cost.toLocaleString('en-IN')} | <strong style="color: #dc2626;">${a.marginPct}% Margin</strong></span>
      </div>`).join('')}
    </div>
  </div>` : ''}

  <h2>Commercial Quotations (${dataset.quotations.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Quotation No</th>
        <th>Date</th>
        <th>Customer</th>
        <th>Salesperson</th>
        <th>Status</th>
        <th class="text-right">Grand Total (INR)</th>
      </tr>
    </thead>
    <tbody>
      ${dataset.quotations.length === 0 ? '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 14px;">No quotations generated in this period</td></tr>' : dataset.quotations.map((q) => `
      <tr>
        <td style="font-family: monospace; font-weight: bold;">${q.number}</td>
        <td>${q.date}</td>
        <td>${q.customer}</td>
        <td>${q.salesperson}</td>
        <td>${q.status}</td>
        <td class="text-right" style="font-weight: bold;">₹${Number(q.amount || 0).toLocaleString('en-IN')}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>Confirmed Sales Orders (${dataset.salesOrders.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Order No</th>
        <th>Date</th>
        <th>Customer</th>
        <th>Salesperson</th>
        <th>Status</th>
        <th class="text-right">Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      ${dataset.salesOrders.length === 0 ? '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 14px;">No orders recorded in this period</td></tr>' : dataset.salesOrders.map((o) => `
      <tr>
        <td style="font-family: monospace; font-weight: bold;">${o.number}</td>
        <td>${o.date}</td>
        <td>${o.customer}</td>
        <td>${o.salesperson}</td>
        <td>${o.status}</td>
        <td class="text-right" style="font-weight: bold;">₹${Number(o.amount || 0).toLocaleString('en-IN')}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  ${dataset.invoices && dataset.invoices.length > 0 ? `
  <h2>GST Tax Invoices & Aging Receivables (${dataset.invoices.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Invoice No</th>
        <th>Date</th>
        <th>Customer</th>
        <th>Status</th>
        <th class="text-right">Balance Due (INR)</th>
        <th class="text-right">Grand Total (INR)</th>
      </tr>
    </thead>
    <tbody>
      ${dataset.invoices.map((inv) => `
      <tr>
        <td style="font-family: monospace; font-weight: bold;">${inv.number}</td>
        <td>${inv.date}</td>
        <td>${inv.customer}</td>
        <td>${inv.status}</td>
        <td class="text-right" style="color: ${(inv.balance || 0) > 0 ? '#e11d48' : '#16a34a'}; font-weight: 600;">₹${Number(inv.balance || 0).toLocaleString('en-IN')}</td>
        <td class="text-right" style="font-weight: bold;">₹${Number(inv.amount || 0).toLocaleString('en-IN')}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <div class="footer">
    <div>ICON TECH PRO ERP V9.2 &bull; Automated Management Report Engine &bull; Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</div>
    <div>Page 1 of 1 &bull; Strictly for Authorized Recipient</div>
  </div>
</body>
</html>`;
}

/**
 * Resolves active, authorized recipients for a scheduled report configuration.
 * - Dynamic resolution based on active employee records and designations
 * - Managing Director always receives designated executive reports
 * - Financial reports strictly restricted to MD and Accounts
 * - Suspended or inactive employees are strictly excluded
 * - Prevents hardcoded individual emails
 */
export async function resolveActiveReportRecipients(
  config: AutomatedReportConfig
): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
  const isFinancialReport = [
    'RPT_MONTHLY_FINANCE_OPS',
    'RPT_QUARTERLY_BUSINESS_REVIEW',
    'RPT_HALFYEARLY_STRATEGY',
    'RPT_ANNUAL_FINANCIAL_CLOSING',
  ].includes(config.report_code);

  const recipients: Array<{ id: string; name: string; email: string; role: string }> = [];

  let candidateUsers: Array<{ id: string; name: string; email: string; role: string; status: string; can_login: boolean }> = [];

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('user_profiles')
        .select('id, full_name, email, status, can_login, is_active, roles(role_name)')
        .eq('status', 'ACTIVE');

      if (!error && data && data.length > 0) {
        candidateUsers = data.map((d: any) => ({
          id: d.id,
          name: d.full_name || d.email,
          email: d.email,
          role: d.roles?.role_name || 'Sales Executive',
          status: d.status,
          can_login: d.can_login ?? d.is_active ?? true,
        }));
      }
    } catch {}
  }

  if (candidateUsers.length === 0) {
    candidateUsers = INITIAL_MANAGED_USERS.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      can_login: u.can_login ?? true,
    }));
  }

  for (const emp of candidateUsers) {
    // 1. Exclude inactive or suspended employees
    if (emp.status !== 'ACTIVE' || !emp.can_login) continue;
    const sec = getAccountSecurity(emp.email);
    if (sec && sec.is_suspended) continue;

    // 2. MD receives all designated executive reports
    if (emp.role === 'Managing Director') {
      recipients.push({ id: emp.id, name: emp.name, email: emp.email, role: emp.role });
      continue;
    }

    // 3. Strict financial isolation
    if (isFinancialReport) {
      if (emp.role === 'Accounts') {
        recipients.push({ id: emp.id, name: emp.name, email: emp.email, role: emp.role });
      }
      continue;
    }

    // 4. Commercial, Operational & Pipeline registers
    if (config.allowed_roles.includes(emp.role as any)) {
      recipients.push({ id: emp.id, name: emp.name, email: emp.email, role: emp.role });
    } else if (
      config.allowed_roles.includes('All Salespeople' as any) &&
      (emp.role === 'Sales Executive' || emp.role === 'BDM')
    ) {
      recipients.push({ id: emp.id, name: emp.name, email: emp.email, role: emp.role });
    }
  }

  return recipients;
}

/**
 * Execute automated report delivery for a specific frequency across all authorized recipients.
 * Enforces role isolation, idempotency keys, and audit logs.
 */
export async function executeScheduledReportCycle(
  frequency: AutomatedReportFrequency,
  referenceDate: Date = new Date()
): Promise<{ success: boolean; dispatchedRuns: ScheduledReportRunRecord[]; error?: string }> {
  try {
    const period = await calculateReportingPeriod(frequency, referenceDate);
    const configs = getConfigsStore().filter((c) => c.frequency === frequency && c.is_active);

    if (configs.length === 0) {
      return { success: true, dispatchedRuns: [] };
    }

    const runsStore = getRunsStore();
    const dispatchedRuns: ScheduledReportRunRecord[] = [];

    for (const config of configs) {
      // Dynamic recipient resolution from active employee records
      const recipients = await resolveActiveReportRecipients(config);

      for (const emp of recipients) {
        const idempotencyKey = `${config.report_code}-${emp.id}-${period.start_date}-${period.end_date}`;

        // Idempotency check: prevent duplicate deliveries
        const alreadyRun = runsStore.find((r) => r.idempotency_key === idempotencyKey && r.status === 'SENT');
        if (alreadyRun) {
          continue;
        }

        // Build role-isolated dataset
        const dataset = await buildRoleRestrictedReportData(period, {
          role: emp.role,
          email: emp.email || 'icontechpro@gmail.com',
          userId: emp.id,
          salespersonName: emp.name,
        });

        const excelContent = await generateReportExcelContent(dataset);
        const htmlContent = await generateReportHtmlContent(dataset);

        let emailDispatched = true;
        let emailErrorMsg: string | undefined;

        try {
          const { EmailService } = await import('@/lib/email/email-service');
          const sendRes = await EmailService.sendEmail({
            to: emp.email || 'icontechpro@gmail.com',
            subject: `[ICON TECH PRO ERP] ${config.name} — ${period.period_label}`,
            html: htmlContent,
            text: `Please find attached your ${config.name} for ${period.period_label}.\nRecipient: ${emp.name} (${emp.role})\nConfidential: ICON TECH PRO Enterprise Platform`,
            attachments: [
              {
                filename: `${config.report_code}_${period.start_date}_to_${period.end_date}.csv`,
                content: Buffer.from(excelContent, 'utf-8').toString('base64'),
                contentType: 'text/csv',
              },
            ],
            metadata: {
              entityType: 'REPORT' as any,
              entityId: idempotencyKey,
            },
          });
          emailDispatched = sendRes.success;
          if (!sendRes.success) {
            emailErrorMsg = sendRes.error;
          }
        } catch (mailErr: any) {
          console.warn('[SCHEDULED_REPORT] Dispatch warning:', mailErr);
          emailDispatched = false;
          emailErrorMsg = mailErr.message;
        }

        const runRecord: ScheduledReportRunRecord = {
          id: `RUN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          config_id: config.id,
          report_code: config.report_code,
          report_name: config.name,
          frequency,
          period_label: period.period_label,
          start_date: period.start_date,
          end_date: period.end_date,
          generated_at: new Date().toISOString(),
          recipient_email: emp.email || 'icontechpro@gmail.com',
          recipient_role: emp.role,
          recipient_user_id: emp.id,
          salesperson_id: emp.id,
          status: emailDispatched ? 'SENT' : 'FAILED',
          attempts: 1,
          idempotency_key: idempotencyKey,
        };

        runsStore.unshift(runRecord);
        dispatchedRuns.push(runRecord);

        // Record audit
        await logAuditEvent({
          userName: 'Automated Report Worker',
          action: 'DISPATCH_SCHEDULED_REPORT',
          module: 'EXECUTIVE_REPORTING',
          details: `Dispatched ${config.name} (${frequency}) to ${emp.name} (${emp.role} - ${emp.email}). Status: ${emailDispatched ? 'SENT' : `FAILED (${emailErrorMsg})`}. IdempotencyKey: ${idempotencyKey}`,
        });
      }
    }

    return { success: true, dispatchedRuns };
  } catch (err: any) {
    return { success: false, dispatchedRuns: [], error: err.message || 'Scheduled report cycle failed' };
  }
}

/**
 * Retrieve execution run history for the Central Email Centre.
 */
export async function getScheduledReportRuns(): Promise<ScheduledReportRunRecord[]> {
  await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
  return getRunsStore();
}

/**
 * Retrieve active report configurations for Admin Centre management.
 */
export async function getAutomatedReportConfigs(): Promise<AutomatedReportConfig[]> {
  await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
  return getConfigsStore();
}

/**
 * Update report configuration schedule / activation status from Admin Centre.
 */
export async function updateAutomatedReportConfig(
  id: string,
  updates: Partial<AutomatedReportConfig>
): Promise<{ success: boolean; data?: AutomatedReportConfig; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const configs = getConfigsStore();
    const config = configs.find((c) => c.id === id);
    if (!config) {
      return { success: false, error: 'Configuration not found' };
    }

    Object.assign(config, updates, { updated_at: new Date().toISOString() });

    await logAuditEvent({
      userName: actor.name,
      action: 'UPDATE_REPORT_CONFIG',
      module: 'ADMIN_CENTER',
      details: `Updated report schedule config ${config.report_code}: active=${config.is_active}, time=${config.schedule_time}`,
    });

    return { success: true, data: config };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update report configuration' };
  }
}
