'use server';

import { 
  getDashboardMetrics, 
  getBusinessKPIsSummary, 
  getSalesPipelineKPIs, 
  getRevenueByCategory, 
  getCustomerLTVMetrics, 
  getCollectionEfficiencyMetrics 
} from '@/lib/actions/analytics';
import { getFollowUps } from '@/lib/actions/operations';
import { getInvoices } from '@/lib/actions/billing';
import { getOrders } from '@/lib/actions/orders';
import { getQuotations } from '@/lib/actions/quotations';
import { getProducts } from '@/lib/actions/products';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import type { 
  ExecutiveBriefing, 
  ExecutiveReportSchedule, 
  ExecutiveReportType, 
  ExecutiveScheduleConfig 
} from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_EXECUTIVE_BRIEFINGS__: ExecutiveBriefing[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_EXECUTIVE_SCHEDULE_CONFIGS__: ExecutiveScheduleConfig[] | undefined;
}

const INITIAL_SCHEDULE_CONFIGS: ExecutiveScheduleConfig[] = [
  {
    id: 'sched-daily',
    schedule: 'DAILY',
    cron_expression: '0 8 * * *',
    recipients: ['Managing Director', 'Admin / BDM'],
    channels: ['IN_APP', 'EMAIL'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sched-weekly',
    schedule: 'WEEKLY',
    cron_expression: '0 9 * * 1',
    recipients: ['Managing Director', 'Admin / BDM', 'BDM'],
    channels: ['IN_APP', 'EMAIL'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sched-monthly',
    schedule: 'MONTHLY',
    cron_expression: '0 9 1 * *',
    recipients: ['Managing Director', 'Admin / BDM', 'Accounts'],
    channels: ['IN_APP', 'EMAIL'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sched-quarterly',
    schedule: 'QUARTERLY',
    cron_expression: '0 10 1 1,4,7,10 *',
    recipients: ['Managing Director', 'Admin / BDM'],
    channels: ['IN_APP', 'EMAIL'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sched-annual',
    schedule: 'ANNUAL',
    cron_expression: '0 10 1 4 *',
    recipients: ['Managing Director'],
    channels: ['IN_APP', 'EMAIL'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

function getBriefingsStore(): ExecutiveBriefing[] {
  if (!globalThis.__ICON_EXECUTIVE_BRIEFINGS__) {
    globalThis.__ICON_EXECUTIVE_BRIEFINGS__ = [];
  }
  return globalThis.__ICON_EXECUTIVE_BRIEFINGS__;
}

function getScheduleConfigsStore(): ExecutiveScheduleConfig[] {
  if (!globalThis.__ICON_EXECUTIVE_SCHEDULE_CONFIGS__) {
    globalThis.__ICON_EXECUTIVE_SCHEDULE_CONFIGS__ = [...INITIAL_SCHEDULE_CONFIGS];
  }
  return globalThis.__ICON_EXECUTIVE_SCHEDULE_CONFIGS__;
}

/**
 * Generate an Executive Briefing across any of the 5 schedules:
 * DAILY, WEEKLY, MONTHLY, QUARTERLY, ANNUAL
 */
export async function generateExecutiveBriefing(
  schedule: ExecutiveReportSchedule = 'DAILY',
  customReportType?: ExecutiveReportType
): Promise<{ success: boolean; briefing?: ExecutiveBriefing; error?: string }> {
  try {
    const now = new Date();
    const periodEnd = now.toISOString();
    let periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    let defaultReportType: ExecutiveReportType = 'OPERATIONS_DISPATCH';

    switch (schedule) {
      case 'DAILY':
        periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        defaultReportType = 'OPERATIONS_DISPATCH';
        break;
      case 'WEEKLY':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        defaultReportType = 'SALES_PIPELINE';
        break;
      case 'MONTHLY':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        defaultReportType = 'FINANCIAL_SUMMARY';
        break;
      case 'QUARTERLY':
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        periodStart = new Date(now.getFullYear(), quarterStartMonth, 1).toISOString();
        defaultReportType = 'FINANCIAL_SUMMARY';
        break;
      case 'ANNUAL':
        // Indian Fiscal Year starts April 1st
        const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        periodStart = new Date(fyStartYear, 3, 1).toISOString();
        defaultReportType = 'EXECUTIVE_STRATEGY';
        break;
    }

    const reportType = customReportType || defaultReportType;

    // Retrieve live underlying data
    const [metrics, kpis, followUps] = await Promise.all([
      getDashboardMetrics(),
      getBusinessKPIsSummary(),
      getFollowUps('TODAY'),
    ]);

    let title = '';
    let summaryHeadline = '';
    let keyMetrics: Record<string, any> = {};
    let highlights: string[] = [];
    let risksAndAlerts: string[] = [];
    let recommendedActions: string[] = [];

    if (schedule === 'DAILY') {
      title = `Daily Operations & Dispatch Digest — ${now.toLocaleDateString('en-IN')}`;
      summaryHeadline = `Today's Operations: ${metrics.activeEnquiries} active enquiries, ${metrics.pendingQuotes} pending quotations, and ${followUps.length} follow-ups scheduled.`;
      keyMetrics = {
        active_enquiries: metrics.activeEnquiries,
        pending_quotes: metrics.pendingQuotes,
        confirmed_orders: metrics.confirmedOrders,
        follow_ups_due_today: followUps.length,
        total_collected: metrics.totalCollected,
        low_stock_count: metrics.lowStockCount,
      };
      highlights = [
        `Operational status: ${metrics.statusText}`,
        `Total orders pipeline: ₹${(metrics.totalOrdersValue || 0).toLocaleString('en-IN')}`,
        `${followUps.length} client follow-ups due today across sales team`,
      ];
      if (metrics.lowStockCount > 0) {
        risksAndAlerts.push(`${metrics.lowStockCount} SKU(s) currently below warehouse reorder levels in Hyderabad depot.`);
      }
      if (metrics.totalReceivables > 500000) {
        risksAndAlerts.push(`Total receivables stand at ₹${metrics.totalReceivables.toLocaleString('en-IN')}. Follow-up recommended.`);
      }
      recommendedActions = [
        'Complete all scheduled daily follow-ups by 4:00 PM.',
        'Review pending quotations awaiting discount authorization.',
        'Coordinate dispatch paperwork for confirmed sales orders.',
      ];
    } else if (schedule === 'WEEKLY') {
      title = `Weekly Sales Pipeline & Collection Velocity — Week ${Math.ceil(now.getDate() / 7)}`;
      summaryHeadline = `Weekly Pipeline: ${kpis.pipeline.total_enquiries} enquiries in funnel with ${kpis.pipeline.conversion_rate_percent}% conversion rate and ₹${kpis.collection_efficiency.total_collected.toLocaleString('en-IN')} collected.`;
      keyMetrics = {
        pipeline_value: kpis.pipeline.total_pipeline_value,
        conversion_rate_percent: kpis.pipeline.conversion_rate_percent,
        average_deal_size: kpis.pipeline.average_deal_size,
        collection_efficiency_percent: kpis.collection_efficiency.efficiency_rate_percent,
        current_outstanding: kpis.collection_efficiency.current_outstanding,
      };
      highlights = [
        `Average commercial AV deal size: ₹${kpis.pipeline.average_deal_size.toLocaleString('en-IN')}`,
        `Overall collection efficiency rate: ${kpis.collection_efficiency.efficiency_rate_percent}%`,
        `Top product category: ${kpis.revenue_by_category[0]?.category || 'Commercial AV'} (₹${(kpis.revenue_by_category[0]?.total_revenue || 0).toLocaleString('en-IN')})`,
      ];
      if (kpis.collection_efficiency.overdue_by_buckets['61-90'] > 0 || kpis.collection_efficiency.overdue_by_buckets['90+'] > 0) {
        risksAndAlerts.push(`Aging alert: Overdue balances in 61+ day buckets total ₹${(kpis.collection_efficiency.overdue_by_buckets['61-90'] + kpis.collection_efficiency.overdue_by_buckets['90+']).toLocaleString('en-IN')}.`);
      }
      recommendedActions = [
        'BDM review with sales executives on opportunities stuck in quotation stage.',
        'Issue formal payment reminders to accounts in 61-90 day aging bucket.',
        'Replenish high-turnover Interactive Panels with primary distributors.',
      ];
    } else if (schedule === 'MONTHLY') {
      const monthName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      const monthlyTarget = 5000000; // ₹50L target
      const achievedPercent = Number(((metrics.totalOrdersValue / monthlyTarget) * 100).toFixed(1));
      title = `Monthly Executive P&L & Revenue Briefing — ${monthName}`;
      summaryHeadline = `Month-to-Date: ₹${metrics.totalOrdersValue.toLocaleString('en-IN')} booked (${achievedPercent}% of ₹50L target) with gross margin at 32.5%.`;
      keyMetrics = {
        monthly_target: monthlyTarget,
        revenue_booked: metrics.totalOrdersValue,
        target_achievement_percent: achievedPercent,
        gross_margin_percent: 32.5,
        total_collected: metrics.totalCollected,
        outstanding_balance: metrics.totalReceivables,
      };
      highlights = [
        `Total active client accounts: ${metrics.totalCustomers}`,
        `Monthly billing realized: ₹${metrics.totalCollected.toLocaleString('en-IN')}`,
        `Average category gross margin maintained at 32.5% across commercial AV lines`,
      ];
      if (achievedPercent < 80) {
        risksAndAlerts.push(`Revenue velocity is currently at ${achievedPercent}% of monthly target.`);
      }
      recommendedActions = [
        'Accelerate closing of enterprise auditorium tenders.',
        'Reconcile distributor credit limits and pending vendor payments.',
        'Review customer outstanding balances with Accounts team.',
      ];
    } else if (schedule === 'QUARTERLY') {
      const quarter = `Q${Math.floor(now.getMonth() / 3) + 1} FY${now.getFullYear().toString().slice(-2)}`;
      title = `Quarterly Business Review (QBR) & Strategic Margin Analysis — ${quarter}`;
      summaryHeadline = `Quarterly Performance: ₹${kpis.collection_efficiency.total_billed.toLocaleString('en-IN')} billed across ${kpis.revenue_by_category.length} categories with ${kpis.collection_efficiency.efficiency_rate_percent}% collection rate.`;
      keyMetrics = {
        quarter,
        total_billed: kpis.collection_efficiency.total_billed,
        total_collected: kpis.collection_efficiency.total_collected,
        efficiency_rate_percent: kpis.collection_efficiency.efficiency_rate_percent,
        pipeline_conversion: kpis.pipeline.conversion_rate_percent,
        top_client: kpis.top_customers_by_ltv[0]?.customer_name || 'Enterprise Client',
        top_client_ltv: kpis.top_customers_by_ltv[0]?.lifetime_value || 0,
      };
      highlights = [
        `Top enterprise client: ${kpis.top_customers_by_ltv[0]?.customer_name || 'Key Client'} (LTV: ₹${(kpis.top_customers_by_ltv[0]?.lifetime_value || 0).toLocaleString('en-IN')})`,
        `Balanced product distribution across ${kpis.revenue_by_category.length} core AV categories`,
        `Pipeline conversion efficiency sustained at ${kpis.pipeline.conversion_rate_percent}%`,
      ];
      risksAndAlerts = [
        `Monitor supply chain lead times on imported DSPs and microphone arrays for upcoming quarters.`,
      ];
      recommendedActions = [
        'Initiate annual AMC contract renewal campaigns for clients installed in previous fiscal year.',
        'Conduct quarterly vendor scorecards and renegotiate distributor tiered rebates.',
      ];
    } else if (schedule === 'ANNUAL') {
      const fyStr = `FY${now.getFullYear() - 1}-${now.getFullYear()}`;
      title = `Annual Fiscal Closing & Executive Strategy Review — ${fyStr}`;
      summaryHeadline = `Annual Closing: Overall portfolio realized ₹${metrics.totalOrdersValue.toLocaleString('en-IN')} in order commitments with ${kpis.collection_efficiency.efficiency_rate_percent}% collection efficiency.`;
      keyMetrics = {
        fiscal_year: fyStr,
        total_orders_value: metrics.totalOrdersValue,
        total_invoiced: kpis.collection_efficiency.total_billed,
        total_collected: kpis.collection_efficiency.total_collected,
        collection_efficiency: kpis.collection_efficiency.efficiency_rate_percent,
        active_customers: metrics.totalCustomers,
      };
      highlights = [
        `Robust customer portfolio of ${metrics.totalCustomers} corporate, government, and educational clients`,
        `Strongest growth driver: ${kpis.revenue_by_category[0]?.category || 'Interactive Displays'}`,
        `Consolidated collection efficiency of ${kpis.collection_efficiency.efficiency_rate_percent}%`,
      ];
      risksAndAlerts = [
        `Competitive price pressure in entry-level interactive panels requiring bundled service differentiation.`,
      ];
      recommendedActions = [
        'Expand turnkey AV project management capabilities into regional tier-2 institutional markets.',
        'Formalize OEM premier partnership agreements for enhanced margin retention in next fiscal year.',
      ];
    }

    const briefing: ExecutiveBriefing = {
      id: `EXEC-BRIEF-${Date.now()}-${schedule.toLowerCase()}`,
      schedule,
      report_type: reportType,
      title,
      period_start: periodStart,
      period_end: periodEnd,
      summary_headline: summaryHeadline,
      key_metrics: keyMetrics,
      highlights,
      risks_and_alerts: risksAndAlerts,
      recommended_actions: recommendedActions,
      generated_by: 'SYSTEM_AI',
      created_at: now.toISOString(),
    };

    getBriefingsStore().unshift(briefing);

    await logAuditEvent({
      userName: 'Executive Reporting AI',
      action: 'GENERATE_EXECUTIVE_BRIEFING',
      module: 'EXECUTIVE_REPORTING',
      details: `Generated ${schedule} executive briefing: "${title}"`,
    });

    return {
      success: true,
      briefing,
    };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Failed to generate executive briefing',
    };
  }
}

/**
 * Retrieve executive briefings with optional schedule filter
 */
export async function getExecutiveBriefings(filter?: {
  schedule?: ExecutiveReportSchedule;
  limit?: number;
}): Promise<ExecutiveBriefing[]> {
  let briefings = getBriefingsStore();
  if (filter?.schedule) {
    briefings = briefings.filter((b) => b.schedule === filter.schedule);
  }
  const limit = filter?.limit || 20;
  return briefings.slice(0, limit);
}

/**
 * Retrieve a specific executive briefing by ID
 */
export async function getExecutiveBriefingById(id: string): Promise<ExecutiveBriefing | null> {
  const briefings = getBriefingsStore();
  return briefings.find((b) => b.id === id) || null;
}

/**
 * Retrieve all executive schedule configurations
 */
export async function getExecutiveScheduleConfigs(): Promise<ExecutiveScheduleConfig[]> {
  return getScheduleConfigsStore();
}

/**
 * Update an executive schedule configuration
 */
export async function updateExecutiveScheduleConfig(
  id: string,
  updates: Partial<ExecutiveScheduleConfig>
): Promise<{ success: boolean; config?: ExecutiveScheduleConfig; error?: string }> {
  const configs = getScheduleConfigsStore();
  const index = configs.findIndex((c) => c.id === id);
  if (index === -1) {
    return { success: false, error: `Schedule configuration ${id} not found` };
  }

  const updated: ExecutiveScheduleConfig = {
    ...configs[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  configs[index] = updated;

  await logAuditEvent({
    userName: 'Admin',
    action: 'UPDATE_EXECUTIVE_SCHEDULE_CONFIG',
    module: 'EXECUTIVE_REPORTING',
    details: `Updated schedule configuration for ${updated.schedule}`,
  });

  return {
    success: true,
    config: updated,
  };
}
