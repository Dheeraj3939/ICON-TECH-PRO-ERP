'use server';

import { getCustomers } from '@/lib/actions/customers';
import { getEnquiries } from '@/lib/actions/enquiries';
import { getQuotations } from '@/lib/actions/quotations';
import { getOrders } from '@/lib/actions/orders';
import { getInvoices, getAccountsAging } from '@/lib/actions/billing';
import { getProducts } from '@/lib/actions/products';
import { getFollowUps } from '@/lib/actions/operations';
import { getAuditLogsStore } from '@/lib/audit/logger';
import { isSupabaseAvailable, getDatabaseHealth } from '@/lib/supabase/health';
import type { 
  DashboardMetrics, 
  AuditLog, 
  SalesPipelineKPIs, 
  RevenueByCategory, 
  CustomerLTVMetric, 
  CollectionEfficiencyMetric, 
  BusinessKPIsSummary 
} from '@/types/erp';

export { getDatabaseHealth as getDatabaseStatus };

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [
    custRes,
    enqRes,
    quoteRes,
    orderRes,
    invRes,
    prodRes,
    todayFollowUps,
    isOnline,
  ] = await Promise.all([
    getCustomers(),
    getEnquiries(),
    getQuotations(),
    getOrders(),
    getInvoices(),
    getProducts({ lowStockOnly: true }),
    getFollowUps('TODAY'),
    isSupabaseAvailable(),
  ]);

  const totalCustomers = custRes.total || custRes.customers.length;
  const activeEnquiries = enqRes.enquiries.filter(
    (e) => e.status !== 'Lost' && e.status !== 'Cancelled' && e.status !== 'Closed'
  ).length;

  const pendingQuotes = quoteRes.quotations.filter(
    (q) => q.status === 'Sent' || q.status === 'Draft' || q.status === 'Approval Pending'
  ).length;

  const confirmedOrders = orderRes.orders.length;

  const totalQuotedValue = quoteRes.quotations.reduce(
    (sum, q) => sum + (q.grand_total || 0),
    0
  );

  const totalOrdersValue = orderRes.orders.reduce(
    (sum, o) => sum + (o.total_amount || 0),
    0
  );

  const totalReceivables = invRes.totalReceivables;
  const totalCollected = invRes.totalCollected;
  const lowStockCount = prodRes.total || prodRes.products.length;
  const followUpsDueToday = todayFollowUps.length;

  const activeInvoicesCount = invRes.invoices.filter(
    (inv) => inv.status !== 'Paid'
  ).length;
  const clearedPaymentsCount = invRes.invoices.filter(
    (inv) => (inv.paid_amount || 0) > 0
  ).length;

  return {
    totalCustomers,
    activeEnquiries,
    pendingQuotes,
    confirmedOrders,
    totalQuotedValue,
    totalOrdersValue,
    totalReceivables,
    totalCollected,
    lowStockCount,
    followUpsDueToday,
    activeInvoicesCount,
    clearedPaymentsCount,
    isOnline,
    dbStatus: isOnline ? 'CONNECTED' : 'DATABASE_UNAVAILABLE',
    statusText: isOnline ? 'LIVE / CONNECTED' : 'OFFLINE / DATABASE UNAVAILABLE',
  };
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  return getAuditLogsStore();
}

// ---------------------------------------------------------------------------
// ADVANCED BI & ANALYTICS ACTIONS (Phase M)
// ---------------------------------------------------------------------------

export async function getSalesPipelineKPIs(): Promise<SalesPipelineKPIs> {
  const [enqRes, quoteRes, orderRes] = await Promise.all([
    getEnquiries(),
    getQuotations(),
    getOrders(),
  ]);

  const enquiries = enqRes.enquiries || [];
  const quotations = quoteRes.quotations || [];
  const orders = orderRes.orders || [];

  const total_enquiries = enquiries.length;
  const converted_to_quotations = quotations.length;
  const converted_to_orders = orders.length;

  const conversion_rate_percent = total_enquiries > 0
    ? Number(((converted_to_orders / total_enquiries) * 100).toFixed(2))
    : 0;

  const total_pipeline_value = quotations.reduce(
    (sum, q) => sum + (q.grand_total || 0),
    0
  );

  const average_deal_size = quotations.length > 0
    ? Number((total_pipeline_value / quotations.length).toFixed(2))
    : 0;

  const by_stage: Record<string, number> = {};
  for (const e of enquiries) {
    const stage = e.status || 'New';
    by_stage[stage] = (by_stage[stage] || 0) + 1;
  }

  return {
    total_enquiries,
    converted_to_quotations,
    converted_to_orders,
    conversion_rate_percent,
    total_pipeline_value,
    average_deal_size,
    by_stage,
  };
}

export async function getRevenueByCategory(): Promise<RevenueByCategory[]> {
  const [orderRes, prodRes] = await Promise.all([
    getOrders(),
    getProducts(),
  ]);

  const orders = orderRes.orders || [];
  const products = prodRes.products || [];
  const productMap = new Map<string, string>();
  for (const p of products) {
    if (p.id) productMap.set(p.id, p.category_name || 'Commercial AV');
  }

  const categoryMap = new Map<string, { total_revenue: number; total_orders: number }>();

  for (const o of orders) {
    let category = 'Commercial AV';
    if (o.items && o.items.length > 0) {
      const firstItem = o.items[0];
      if (firstItem.product_id && productMap.has(firstItem.product_id)) {
        category = productMap.get(firstItem.product_id)!;
      } else if (firstItem.product_name) {
        const lowerName = firstItem.product_name.toLowerCase();
        if (lowerName.includes('display') || lowerName.includes('panel')) {
          category = 'Interactive Displays';
        } else if (lowerName.includes('mic') || lowerName.includes('speaker')) {
          category = 'Audio Systems';
        } else if (lowerName.includes('camera') || lowerName.includes('video')) {
          category = 'Video Conferencing';
        }
      }
    }

    const existing = categoryMap.get(category) || { total_revenue: 0, total_orders: 0 };
    existing.total_revenue += (o.total_amount || 0);
    existing.total_orders += 1;
    categoryMap.set(category, existing);
  }

  if (categoryMap.size === 0) {
    categoryMap.set('Commercial AV', { total_revenue: 0, total_orders: 0 });
  }

  return Array.from(categoryMap.entries()).map(([cat, data]) => ({
    category: cat,
    total_revenue: data.total_revenue,
    total_orders: data.total_orders,
    gross_margin_percent: 32.5,
    average_order_value: data.total_orders > 0 ? Number((data.total_revenue / data.total_orders).toFixed(2)) : 0,
  }));
}

export async function getCustomerLTVMetrics(limit = 10): Promise<CustomerLTVMetric[]> {
  const [custRes, orderRes, invRes] = await Promise.all([
    getCustomers(),
    getOrders(),
    getInvoices(),
  ]);

  const customers = custRes.customers || [];
  const orders = orderRes.orders || [];
  const invoices = invRes.invoices || [];

  const metrics: CustomerLTVMetric[] = customers.map((c) => {
    const customerOrders = orders.filter((o) => o.customer_id === c.id);
    const customerInvoices = invoices.filter((i) => i.customer_id === c.id);

    const total_orders = customerOrders.length;
    const lifetime_value = customerOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const total_invoiced = customerInvoices.reduce((sum, i) => sum + (i.grand_total || 0), 0);
    const total_collected = customerInvoices.reduce((sum, i) => sum + (i.paid_amount || 0), 0);
    // Strictly derived balance: balance_amount = grand_total - SUM(payments.amount)
    const outstanding_balance = Math.max(0, total_invoiced - total_collected);

    let last_order_date: string | undefined;
    if (customerOrders.length > 0) {
      last_order_date = customerOrders[customerOrders.length - 1].created_at;
    }

    return {
      customer_id: c.id,
      customer_name: c.customer_name || c.company_name || 'Customer',
      customer_type: c.customer_type || 'Corporate',
      lifetime_value,
      total_orders,
      total_invoiced,
      total_collected,
      outstanding_balance,
      last_order_date,
    };
  });

  return metrics
    .sort((a, b) => b.lifetime_value - a.lifetime_value)
    .slice(0, limit);
}

export async function getCollectionEfficiencyMetrics(): Promise<CollectionEfficiencyMetric> {
  const [invRes, agingRes] = await Promise.all([
    getInvoices(),
    getAccountsAging(),
  ]);

  const invoices = invRes.invoices || [];
  const total_billed = invoices.reduce((sum, i) => sum + (i.grand_total || 0), 0);
  const total_collected = invoices.reduce((sum, i) => sum + (i.paid_amount || 0), 0);
  const current_outstanding = Math.max(0, total_billed - total_collected);

  const efficiency_rate_percent = total_billed > 0
    ? Number(((total_collected / total_billed) * 100).toFixed(2))
    : 100;

  const overdue_by_buckets = {
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0,
  };

  if (agingRes && agingRes.buckets) {
    overdue_by_buckets['0-30'] = agingRes.buckets['0-30']?.amount || 0;
    overdue_by_buckets['31-60'] = agingRes.buckets['31-60']?.amount || 0;
    overdue_by_buckets['61-90'] = agingRes.buckets['61-90']?.amount || 0;
    overdue_by_buckets['90+'] = agingRes.buckets['90+']?.amount || 0;
  }

  return {
    total_billed,
    total_collected,
    efficiency_rate_percent,
    current_outstanding,
    overdue_by_buckets,
  };
}

export async function getBusinessKPIsSummary(): Promise<BusinessKPIsSummary> {
  const [pipeline, revenue_by_category, top_customers_by_ltv, collection_efficiency] = await Promise.all([
    getSalesPipelineKPIs(),
    getRevenueByCategory(),
    getCustomerLTVMetrics(5),
    getCollectionEfficiencyMetrics(),
  ]);

  return {
    pipeline,
    revenue_by_category,
    top_customers_by_ltv,
    collection_efficiency,
    generated_at: new Date().toISOString(),
  };
}
