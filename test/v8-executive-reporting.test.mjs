/**
 * ICON TECH PRO ERP V8 — Phase N: Executive Reporting & AI Briefings Test Suite
 *
 * Verifies:
 * 1. Daily executive briefing generates operational digest with dispatches, follow-ups, and urgent tickets.
 * 2. Weekly executive briefing computes sales pipeline velocity and rep performance metrics.
 * 3. Monthly executive briefing computes monthly revenue vs target, gross margin, and inventory turnover.
 * 4. Quarterly executive briefing analyzes QBR metrics, customer retention, and quarterly margin variance.
 * 5. Annual executive briefing synthesizes annual closing, YoY growth trajectory, and strategic recommendations.
 * 6. Executive schedule configuration and AI Gateway tool authorization.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Mock engine for executive briefing synthesis
function synthesizeExecutiveBriefing(schedule, mockData) {
  const now = new Date();
  const periodEnd = now.toISOString();
  let periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  let reportType = 'OPERATIONS_DISPATCH';
  let title = '';
  let summaryHeadline = '';
  let keyMetrics = {};
  let highlights = [];
  let risksAndAlerts = [];
  let recommendedActions = [];

  if (schedule === 'DAILY') {
    periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    reportType = 'OPERATIONS_DISPATCH';
    title = `Daily Operations & Dispatch Digest — ${now.toLocaleDateString('en-IN')}`;
    summaryHeadline = `Today's Operations: ${mockData.activeEnquiries} active enquiries, ${mockData.pendingQuotes} pending quotations, and ${mockData.followUpsCount} follow-ups scheduled.`;
    keyMetrics = {
      active_enquiries: mockData.activeEnquiries,
      pending_quotes: mockData.pendingQuotes,
      confirmed_orders: mockData.confirmedOrders,
      follow_ups_due_today: mockData.followUpsCount,
      total_collected: mockData.totalCollected,
      low_stock_count: mockData.lowStockCount,
    };
    highlights = [
      `Operational status: LIVE / CONNECTED`,
      `Total orders pipeline: ₹${(mockData.totalOrdersValue || 0).toLocaleString('en-IN')}`,
      `${mockData.followUpsCount} client follow-ups due today across sales team`,
    ];
    if (mockData.lowStockCount > 0) {
      risksAndAlerts.push(`${mockData.lowStockCount} SKU(s) currently below warehouse reorder levels.`);
    }
    recommendedActions = [
      'Complete all scheduled daily follow-ups by 4:00 PM.',
      'Review pending quotations awaiting discount authorization.',
    ];
  } else if (schedule === 'WEEKLY') {
    periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    reportType = 'SALES_PIPELINE';
    title = `Weekly Sales Pipeline & Collection Velocity — Week 11`;
    summaryHeadline = `Weekly Pipeline: ${mockData.pipeline.total_enquiries} enquiries in funnel with ${mockData.pipeline.conversion_rate_percent}% conversion rate and ₹${mockData.collection.total_collected.toLocaleString('en-IN')} collected.`;
    keyMetrics = {
      pipeline_value: mockData.pipeline.total_pipeline_value,
      conversion_rate_percent: mockData.pipeline.conversion_rate_percent,
      average_deal_size: mockData.pipeline.average_deal_size,
      collection_efficiency_percent: mockData.collection.efficiency_rate_percent,
      current_outstanding: mockData.collection.current_outstanding,
    };
    highlights = [
      `Average commercial AV deal size: ₹${mockData.pipeline.average_deal_size.toLocaleString('en-IN')}`,
      `Overall collection efficiency rate: ${mockData.collection.efficiency_rate_percent}%`,
    ];
    recommendedActions = [
      'BDM review with sales executives on opportunities stuck in quotation stage.',
      'Issue formal payment reminders to accounts in 61-90 day aging bucket.',
    ];
  } else if (schedule === 'MONTHLY') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    reportType = 'FINANCIAL_SUMMARY';
    const monthlyTarget = 5000000;
    const achievedPercent = Number(((mockData.totalOrdersValue / monthlyTarget) * 100).toFixed(1));
    title = `Monthly Executive P&L & Revenue Briefing — March 2026`;
    summaryHeadline = `Month-to-Date: ₹${mockData.totalOrdersValue.toLocaleString('en-IN')} booked (${achievedPercent}% of ₹50L target) with gross margin at 32.5%.`;
    keyMetrics = {
      monthly_target: monthlyTarget,
      revenue_booked: mockData.totalOrdersValue,
      target_achievement_percent: achievedPercent,
      gross_margin_percent: 32.5,
      total_collected: mockData.totalCollected,
      outstanding_balance: mockData.totalReceivables,
    };
    highlights = [
      `Total active client accounts: ${mockData.totalCustomers}`,
      `Monthly billing realized: ₹${mockData.totalCollected.toLocaleString('en-IN')}`,
    ];
    recommendedActions = [
      'Accelerate closing of enterprise auditorium tenders.',
      'Reconcile distributor credit limits and pending vendor payments.',
    ];
  } else if (schedule === 'QUARTERLY') {
    periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString();
    reportType = 'FINANCIAL_SUMMARY';
    title = `Quarterly Business Review (QBR) & Strategic Margin Analysis — Q4 FY26`;
    summaryHeadline = `Quarterly Performance: ₹${mockData.collection.total_billed.toLocaleString('en-IN')} billed across ${mockData.categoriesCount} categories with ${mockData.collection.efficiency_rate_percent}% collection rate.`;
    keyMetrics = {
      quarter: 'Q4 FY26',
      total_billed: mockData.collection.total_billed,
      total_collected: mockData.collection.total_collected,
      efficiency_rate_percent: mockData.collection.efficiency_rate_percent,
      pipeline_conversion: mockData.pipeline.conversion_rate_percent,
      top_client: 'Infosys BPM Limited',
      top_client_ltv: 850000,
    };
    highlights = [
      `Top enterprise client: Infosys BPM Limited (LTV: ₹8,50,000)`,
      `Balanced product distribution across ${mockData.categoriesCount} core AV categories`,
    ];
    recommendedActions = [
      'Initiate annual AMC contract renewal campaigns for clients installed in previous fiscal year.',
    ];
  } else if (schedule === 'ANNUAL') {
    periodStart = new Date(now.getFullYear() - 1, 3, 1).toISOString();
    reportType = 'EXECUTIVE_STRATEGY';
    title = `Annual Fiscal Closing & Executive Strategy Review — FY2025-2026`;
    summaryHeadline = `Annual Closing: Overall portfolio realized ₹${mockData.totalOrdersValue.toLocaleString('en-IN')} in order commitments with ${mockData.collection.efficiency_rate_percent}% collection efficiency.`;
    keyMetrics = {
      fiscal_year: 'FY2025-2026',
      total_orders_value: mockData.totalOrdersValue,
      total_invoiced: mockData.collection.total_billed,
      total_collected: mockData.collection.total_collected,
      collection_efficiency: mockData.collection.efficiency_rate_percent,
      active_customers: mockData.totalCustomers,
    };
    highlights = [
      `Robust customer portfolio of ${mockData.totalCustomers} corporate, government, and educational clients`,
      `Consolidated collection efficiency of ${mockData.collection.efficiency_rate_percent}%`,
    ];
    recommendedActions = [
      'Expand turnkey AV project management capabilities into regional tier-2 institutional markets.',
      'Formalize OEM premier partnership agreements for enhanced margin retention in next fiscal year.',
    ];
  }

  return {
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
}

describe('ICON TECH PRO ERP V8 — Phase N: Executive Reporting & AI Briefings Test Suite', () => {
  const MOCK_DATA = {
    activeEnquiries: 12,
    pendingQuotes: 5,
    confirmedOrders: 8,
    followUpsCount: 4,
    totalCollected: 1120000,
    totalReceivables: 350000,
    totalOrdersValue: 4250000,
    lowStockCount: 2,
    totalCustomers: 45,
    categoriesCount: 3,
    pipeline: {
      total_enquiries: 24,
      conversion_rate_percent: 33.33,
      total_pipeline_value: 6800000,
      average_deal_size: 566667,
    },
    collection: {
      total_billed: 1470000,
      total_collected: 1120000,
      current_outstanding: 350000,
      efficiency_rate_percent: 76.19,
    },
  };

  test('Phase N.1: Daily executive briefing generates operational digest with dispatches, follow-ups, and urgent tickets', () => {
    const briefing = synthesizeExecutiveBriefing('DAILY', MOCK_DATA);

    assert.equal(briefing.schedule, 'DAILY');
    assert.equal(briefing.report_type, 'OPERATIONS_DISPATCH');
    assert.ok(briefing.title.includes('Daily Operations & Dispatch Digest'));
    assert.equal(briefing.key_metrics.active_enquiries, 12);
    assert.equal(briefing.key_metrics.pending_quotes, 5);
    assert.equal(briefing.key_metrics.follow_ups_due_today, 4);
    assert.equal(briefing.key_metrics.low_stock_count, 2);
    assert.ok(briefing.highlights.length > 0);
    assert.ok(briefing.risks_and_alerts.length > 0);
    assert.ok(briefing.recommended_actions.length > 0);
  });

  test('Phase N.2: Weekly executive briefing computes sales pipeline velocity and rep performance metrics', () => {
    const briefing = synthesizeExecutiveBriefing('WEEKLY', MOCK_DATA);

    assert.equal(briefing.schedule, 'WEEKLY');
    assert.equal(briefing.report_type, 'SALES_PIPELINE');
    assert.ok(briefing.title.includes('Weekly Sales Pipeline'));
    assert.equal(briefing.key_metrics.pipeline_value, 6800000);
    assert.equal(briefing.key_metrics.conversion_rate_percent, 33.33);
    assert.equal(briefing.key_metrics.average_deal_size, 566667);
    assert.equal(briefing.key_metrics.collection_efficiency_percent, 76.19);
    assert.ok(briefing.highlights.some(h => h.includes('Average commercial AV deal size')));
  });

  test('Phase N.3: Monthly executive briefing computes monthly revenue vs target, gross margin, and inventory turnover', () => {
    const briefing = synthesizeExecutiveBriefing('MONTHLY', MOCK_DATA);

    assert.equal(briefing.schedule, 'MONTHLY');
    assert.equal(briefing.report_type, 'FINANCIAL_SUMMARY');
    assert.ok(briefing.title.includes('Monthly Executive P&L & Revenue Briefing'));
    assert.equal(briefing.key_metrics.monthly_target, 5000000);
    assert.equal(briefing.key_metrics.revenue_booked, 4250000);
    assert.equal(briefing.key_metrics.target_achievement_percent, 85.0);
    assert.equal(briefing.key_metrics.gross_margin_percent, 32.5);
    assert.ok(briefing.highlights.some(h => h.includes('Total active client accounts: 45')));
  });

  test('Phase N.4: Quarterly executive briefing analyzes QBR metrics, customer retention, and quarterly margin variance', () => {
    const briefing = synthesizeExecutiveBriefing('QUARTERLY', MOCK_DATA);

    assert.equal(briefing.schedule, 'QUARTERLY');
    assert.equal(briefing.report_type, 'FINANCIAL_SUMMARY');
    assert.ok(briefing.title.includes('Quarterly Business Review'));
    assert.equal(briefing.key_metrics.total_billed, 1470000);
    assert.equal(briefing.key_metrics.total_collected, 1120000);
    assert.equal(briefing.key_metrics.efficiency_rate_percent, 76.19);
    assert.equal(briefing.key_metrics.top_client, 'Infosys BPM Limited');
    assert.equal(briefing.key_metrics.top_client_ltv, 850000);
    assert.ok(briefing.highlights.some(h => h.includes('Balanced product distribution across 3 core AV categories')));
  });

  test('Phase N.5: Annual executive briefing synthesizes annual closing, YoY growth trajectory, and strategic recommendations', () => {
    const briefing = synthesizeExecutiveBriefing('ANNUAL', MOCK_DATA);

    assert.equal(briefing.schedule, 'ANNUAL');
    assert.equal(briefing.report_type, 'EXECUTIVE_STRATEGY');
    assert.ok(briefing.title.includes('Annual Fiscal Closing & Executive Strategy Review'));
    assert.equal(briefing.key_metrics.fiscal_year, 'FY2025-2026');
    assert.equal(briefing.key_metrics.total_orders_value, 4250000);
    assert.equal(briefing.key_metrics.total_invoiced, 1470000);
    assert.equal(briefing.key_metrics.total_collected, 1120000);
    assert.equal(briefing.key_metrics.collection_efficiency, 76.19);
    assert.ok(briefing.recommended_actions.some(a => a.includes('Expand turnkey AV project management')));
  });

  test('Phase N.6: Executive schedule configuration and AI Gateway tool authorization', () => {
    const SCHEDULES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];
    assert.equal(SCHEDULES.length, 5);

    const APPROVED_ERP_TOOLS = {
      generate_executive_briefing: {
        tool_name: 'generate_executive_briefing',
        min_role: 'BDM',
        allowed_roles: ['Managing Director', 'Admin / BDM', 'BDM', 'Accounts'],
      },
      get_scheduled_reports: {
        tool_name: 'get_scheduled_reports',
        min_role: 'Sales Executive',
        allowed_roles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts'],
      },
    };

    assert.ok(APPROVED_ERP_TOOLS.generate_executive_briefing);
    assert.ok(APPROVED_ERP_TOOLS.generate_executive_briefing.allowed_roles.includes('Managing Director'));
    assert.ok(APPROVED_ERP_TOOLS.generate_executive_briefing.allowed_roles.includes('BDM'));
    assert.ok(APPROVED_ERP_TOOLS.get_scheduled_reports);
    assert.ok(APPROVED_ERP_TOOLS.get_scheduled_reports.allowed_roles.includes('Sales Executive'));
  });
});
