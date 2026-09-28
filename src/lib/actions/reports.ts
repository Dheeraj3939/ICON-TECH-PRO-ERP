'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { canViewPurchaseCosts } from '@/lib/utils/margin';
import { logAuditEvent } from '@/lib/audit/logger';
import { getOrders } from '@/lib/actions/orders';
import { getQuotations } from '@/lib/actions/quotations';
import { getInvoices } from '@/lib/actions/billing';
import { getProducts } from '@/lib/actions/products';
import { getPurchaseOrders } from '@/lib/actions/procurement';
import { getSerialRecords } from '@/lib/actions/serials';
import { getCustomers } from '@/lib/actions/customers';
import { getServiceTickets, getAMCContracts } from '@/lib/actions/services';
import type {
  ReportDefinition,
  ReportResult,
  ReportColumn,
  ReportFilterCondition,
} from '@/types/reports';

const STANDARD_REPORTS: ReportDefinition[] = [
  {
    id: 'RPT-STD-01',
    title: 'Daily Sales Register & Rep Performance',
    description: 'Confirmed sales orders broken down by salesperson with total turnover and material fulfillment status',
    data_source: 'SALES_ORDERS',
    category: 'SALES',
    selected_fields: ['order_number', 'customer_name', 'salesperson_name', 'total_amount', 'status', 'material_status', 'order_date'],
    group_by_field: 'salesperson_name',
    calculation: 'SUM',
    calculation_field: 'total_amount',
    is_company_report: true,
    is_favorite: true,
    created_by: 'System Administrator',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-12T10:00:00Z',
  },
  {
    id: 'RPT-STD-02',
    title: 'Receivables Aging & Overdue Ledger',
    description: 'Invoices outstanding balances categorized by payment status and due dates',
    data_source: 'INVOICES',
    category: 'FINANCE',
    selected_fields: ['invoice_number', 'customer_name', 'grand_total', 'paid_amount', 'balance_amount', 'status', 'due_date'],
    group_by_field: 'status',
    calculation: 'SUM',
    calculation_field: 'balance_amount',
    is_company_report: true,
    is_favorite: true,
    created_by: 'System Administrator',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-12T10:00:00Z',
  },
  {
    id: 'RPT-STD-03',
    title: 'Quotation Pipeline & Commercial Margins',
    description: 'Proposal value, version progression (v1/v2) and margin percentages (permission protected)',
    data_source: 'QUOTATIONS',
    category: 'SALES',
    selected_fields: ['quotation_number', 'customer_name', 'salesperson_name', 'grand_total', 'margin_pct', 'status'],
    group_by_field: 'status',
    calculation: 'SUM',
    calculation_field: 'grand_total',
    is_company_report: true,
    is_favorite: false,
    created_by: 'System Administrator',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-12T10:00:00Z',
  },
  {
    id: 'RPT-STD-04',
    title: 'Serialized Equipment & Warranty Health',
    description: 'Installed asset lifecycle grouped by warranty provider (OEM, Distributor, Icon Care)',
    data_source: 'SERIALS',
    category: 'OPERATIONS',
    selected_fields: ['serial_number', 'product_name', 'warranty_provider', 'warranty_end_date', 'status'],
    group_by_field: 'warranty_provider',
    calculation: 'COUNT',
    is_company_report: true,
    is_favorite: false,
    created_by: 'System Administrator',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-12T10:00:00Z',
  },
  {
    id: 'RPT-STD-05',
    title: 'Procurement Backorders & Drop-Ship Exposure',
    description: 'Supplier purchase orders grouped by delivery type (Office Receipt vs Direct Site Drop-Ship)',
    data_source: 'PURCHASE_ORDERS',
    category: 'OPERATIONS',
    selected_fields: ['po_number', 'supplier_name', 'delivery_type', 'total_amount', 'status'],
    group_by_field: 'delivery_type',
    calculation: 'SUM',
    calculation_field: 'total_amount',
    is_company_report: true,
    is_favorite: false,
    created_by: 'System Administrator',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-12T10:00:00Z',
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __ICON_REPORTS__: ReportDefinition[] | undefined;
}

function getReportsStore(): ReportDefinition[] {
  if (!globalThis.__ICON_REPORTS__) {
    globalThis.__ICON_REPORTS__ = [...STANDARD_REPORTS];
  }
  return globalThis.__ICON_REPORTS__;
}

export async function getReportDefinitions(filter?: {
  category?: string;
  search?: string;
}): Promise<ReportDefinition[]> {
  let list = getReportsStore();
  if (filter?.category && filter.category !== 'ALL') {
    list = list.filter((r) => r.category === filter.category);
  }
  if (filter?.search) {
    const s = filter.search.toLowerCase();
    list = list.filter((r) => r.title.toLowerCase().includes(s) || r.description.toLowerCase().includes(s));
  }
  return list;
}

export async function createCustomReport(
  definition: Omit<ReportDefinition, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; data?: ReportDefinition; error?: string }> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Authentication required' };
    }

    const store = getReportsStore();
    const newReport: ReportDefinition = {
      ...definition,
      id: `RPT-USR-${Date.now()}`,
      created_by: authUser.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    store.push(newReport);

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_CUSTOM_REPORT',
      module: 'REPORTS',
      details: `Created custom report "${newReport.title}" for data source ${newReport.data_source}`,
    });

    revalidatePath('/dashboard/reports');
    return { success: true, data: newReport };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create report' };
  }
}

export async function toggleReportFavorite(reportId: string): Promise<boolean> {
  const store = getReportsStore();
  const found = store.find((r) => r.id === reportId);
  if (found) {
    found.is_favorite = !found.is_favorite;
    return found.is_favorite;
  }
  return false;
}

export async function executeReport(
  reportIdOrDef: string | ReportDefinition,
  runtimeFilters?: Record<string, any>
): Promise<{ success: boolean; data?: ReportResult; error?: string }> {
  try {
    const authUser = await getAuthenticatedUser();
    const userRole = authUser?.role || 'Sales Executive';
    const showConfidentialCosts = canViewPurchaseCosts(userRole);

    let report: ReportDefinition | undefined;
    if (typeof reportIdOrDef === 'string') {
      const store = getReportsStore();
      report = store.find((r) => r.id === reportIdOrDef);
      if (!report) {
        return { success: false, error: `Report ${reportIdOrDef} not found` };
      }
    } else {
      report = reportIdOrDef;
    }

    // 1. Fetch raw data for data source
    let rawRecords: any[] = [];
    switch (report.data_source) {
      case 'SALES_ORDERS': {
        const res = await getOrders();
        rawRecords = res.orders || [];
        break;
      }
      case 'QUOTATIONS': {
        const res = await getQuotations();
        rawRecords = res.quotations || [];
        break;
      }
      case 'INVOICES': {
        const res = await getInvoices();
        rawRecords = res.invoices || [];
        break;
      }
      case 'PURCHASE_ORDERS': {
        const res = await getPurchaseOrders();
        rawRecords = Array.isArray(res) ? res : [];
        break;
      }
      case 'SERIALS': {
        const res = await getSerialRecords();
        rawRecords = res?.records || [];
        break;
      }
      case 'INVENTORY': {
        const res = await getProducts();
        rawRecords = res.products || [];
        break;
      }
      case 'CUSTOMERS': {
        const res = await getCustomers({ limit: 100 });
        rawRecords = res.customers || [];
        break;
      }
      case 'SERVICE': {
        const res = await getAMCContracts();
        rawRecords = res || [];
        break;
      }
      default:
        rawRecords = [];
    }

    // 2. Enforce Role-Based Commercial Masking (Rule: Never leak purchase cost to unauthorized roles)
    if (!showConfidentialCosts) {
      rawRecords = rawRecords.map((rec) => {
        const safe = { ...rec };
        delete safe.purchase_price;
        delete safe.last_purchase_price;
        delete safe.total_cost;
        delete safe.margin_pct;
        delete safe.quoted_margin_pct;
        delete safe.approved_margin_pct;
        delete safe.supplier_id;
        delete safe.unit_cost;
        return safe;
      });
    }

    // 3. Apply Filters
    let filteredRecords = [...rawRecords];
    if (report.filters && report.filters.length > 0) {
      filteredRecords = filteredRecords.filter((rec) => {
        return report!.filters!.every((f) => {
          const val = rec[f.field];
          if (val === undefined || val === null) return false;
          switch (f.operator) {
            case 'EQUALS':
              return String(val).toLowerCase() === String(f.value).toLowerCase();
            case 'CONTAINS':
              return String(val).toLowerCase().includes(String(f.value).toLowerCase());
            case 'GTE':
              return Number(val) >= Number(f.value);
            case 'LTE':
              return Number(val) <= Number(f.value);
            case 'NOT_EQUALS':
              return String(val).toLowerCase() !== String(f.value).toLowerCase();
            default:
              return true;
          }
        });
      });
    }

    // 4. Generate Columns & Rows (Grouped or Tabular)
    let columns: ReportColumn[] = [];
    let rows: Record<string, any>[] = [];
    let aggregatedValue = 0;

    if (report.group_by_field) {
      const groupField = report.group_by_field;
      const groupedMap = new Map<string, { key: string; count: number; sum: number; items: any[] }>();

      filteredRecords.forEach((rec) => {
        const groupKey = rec[groupField] || 'Unassigned';
        const existing = groupedMap.get(groupKey) || { key: groupKey, count: 0, sum: 0, items: [] as any[] };
        existing.count += 1;

        if (report!.calculation_field && rec[report!.calculation_field]) {
          existing.sum += Number(rec[report!.calculation_field]);
        }
        existing.items.push(rec);
        groupedMap.set(groupKey, existing);
      });

      columns = [
        { key: 'groupKey', label: groupField.replace(/_/g, ' ').toUpperCase(), type: 'string' },
        { key: 'recordCount', label: 'RECORD COUNT', type: 'number' },
      ];

      if (report.calculation === 'SUM' && report.calculation_field) {
        columns.push({
          key: 'aggregatedMetric',
          label: `TOTAL ${report.calculation_field.replace(/_/g, ' ').toUpperCase()}`,
          type: 'currency',
        });
      } else if (report.calculation === 'AVERAGE' && report.calculation_field) {
        columns.push({
          key: 'aggregatedMetric',
          label: `AVG ${report.calculation_field.replace(/_/g, ' ').toUpperCase()}`,
          type: 'number',
        });
      }

      groupedMap.forEach((val) => {
        let metric = val.sum;
        if (report!.calculation === 'AVERAGE') {
          metric = val.count > 0 ? Number((val.sum / val.count).toFixed(2)) : 0;
        }

        aggregatedValue += metric;
        rows.push({
          groupKey: val.key,
          recordCount: val.count,
          aggregatedMetric: metric,
        });
      });
    } else {
      // Tabular View with selected fields
      const selected = report.selected_fields.length > 0
        ? report.selected_fields
        : Object.keys(filteredRecords[0] || {}).slice(0, 7);

      // Filter out confidential fields if unauthorized
      const safeFields = showConfidentialCosts
        ? selected
        : selected.filter((f) => !/cost|margin|supplier_id/i.test(f));

      columns = safeFields.map((f) => ({
        key: f,
        label: f.replace(/_/g, ' ').toUpperCase(),
        type: /amount|total|price|spend/i.test(f)
          ? 'currency'
          : /date/i.test(f)
          ? 'date'
          : /status/i.test(f)
          ? 'badge'
          : 'string',
      }));

      rows = filteredRecords.map((rec) => {
        const row: Record<string, any> = {};
        safeFields.forEach((f) => {
          row[f] = rec[f];
        });
        return row;
      });

      if (report.calculation_field) {
        aggregatedValue = filteredRecords.reduce((sum, r) => sum + (Number(r[report!.calculation_field!]) || 0), 0);
      }
    }

    const result: ReportResult = {
      report,
      columns,
      rows,
      summary: {
        totalRecords: filteredRecords.length,
        aggregatedValue: report.calculation_field || report.group_by_field ? Number(aggregatedValue.toFixed(2)) : undefined,
        calculatedMetricLabel: report.calculation_field ? report.calculation_field.replace(/_/g, ' ') : undefined,
      },
      generated_at: new Date().toISOString(),
      generated_by_role: userRole,
    };

    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to execute report' };
  }
}
