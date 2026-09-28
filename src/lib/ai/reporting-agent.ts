'use server';

import { getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { executeReport, getReportDefinitions } from '@/lib/actions/reports';
import { queryProductToCustomers, queryOpportunities } from '@/lib/actions/purchase-intelligence';
import { getCustomer360Data } from '@/lib/actions/customer360';
import { detectLanguage } from '@/lib/ai/gateway';
import type { SupportedLanguage } from '@/types/erp';
import type { ReportResult } from '@/types/reports';

export interface AIReportingBrief {
  query: string;
  detectedLanguage: SupportedLanguage;
  intent: string;
  facts: string[];
  calculations: string[];
  recommendations: string[];
  structuredData?: {
    columns: string[];
    rows: any[];
  };
  localizedResponse: string;
  englishSummary: string;
}

export async function processNaturalLanguageReportQuery(
  rawQuery: string
): Promise<{ success: boolean; data?: AIReportingBrief; error?: string }> {
  try {
    const authUser = await getAuthenticatedUser();
    const userRole = authUser?.role || 'Sales Executive';

    const query = (rawQuery || '').trim();
    if (!query) {
      return { success: false, error: 'Query cannot be empty' };
    }

    const lang = detectLanguage(query);
    const lower = query.toLowerCase();

    const facts: string[] = [];
    const calculations: string[] = [];
    const recommendations: string[] = [];
    let intent = 'General Business Query';
    let structuredData: { columns: string[]; rows: any[] } | undefined = undefined;

    // Pattern 1: Pending Balance / Overdue Receivables
    if (/pending|balance|overdue|receivables|due|బాకీ|బకాయి|बाकी/i.test(lower)) {
      intent = 'Receivables & Pending Invoices Analysis';
      const rptRes = await executeReport('RPT-STD-02');
      if (rptRes.success && rptRes.data) {
        const d = rptRes.data;
        facts.push(`Identified ${d.summary.totalRecords} billing records in the system.`);
        if (d.summary.aggregatedValue !== undefined) {
          calculations.push(`Total outstanding balance across all accounts is ₹${d.summary.aggregatedValue.toLocaleString('en-IN')}.`);
        }
        recommendations.push('Trigger automated WhatsApp collection reminders to accounts past due date.');

        structuredData = {
          columns: d.columns.map((c) => c.label),
          rows: d.rows.slice(0, 5),
        };
      }
    }
    // Pattern 2: Sales Performance & Orders
    else if (/sales|revenue|orders?|turnover|rep|సేల్స్|ఆర్డర్|बिक्री|ऑर्डर/i.test(lower)) {
      intent = 'Sales Orders & Performance Breakdown';
      const rptRes = await executeReport('RPT-STD-01');
      if (rptRes.success && rptRes.data) {
        const d = rptRes.data;
        facts.push(`Total confirmed sales orders count: ${d.summary.totalRecords}.`);
        if (d.summary.aggregatedValue !== undefined) {
          calculations.push(`Cumulative confirmed sales order value is ₹${d.summary.aggregatedValue.toLocaleString('en-IN')}.`);
        }
        recommendations.push('Prioritize procurement for backorders with delivery dates within the next 7 days.');

        structuredData = {
          columns: d.columns.map((c) => c.label),
          rows: d.rows,
        };
      }
    }
    // Pattern 3: Opportunities & Expiring Warranties
    else if (/opportunity|warranty|amc|expir|వారంటీ|अवसर|वारंटी/i.test(lower)) {
      intent = 'Proactive Asset Warranty & AMC Opportunity Radar';
      const opps = await queryOpportunities({ daysThreshold: 60 });
      facts.push(`Found ${opps.length} actionable commercial opportunities across the installed client base.`);
      const highUrgency = opps.filter((o) => o.urgency === 'HIGH');
      calculations.push(`${highUrgency.length} client assets require immediate intervention within 7 days.`);
      recommendations.push('Initiate proposal for Icon Care Extended Warranty package.');

      structuredData = {
        columns: ['Customer', 'Reason', 'Urgency', 'Recommended Action'],
        rows: opps.slice(0, 5).map((o) => ({
          Customer: o.customerName,
          Reason: o.reason,
          Urgency: o.urgency,
          'Recommended Action': o.recommendedAction,
        })),
      };
    }
    // Pattern 4: Fallback to General Quotation Pipeline
    else {
      intent = 'Quotation Pipeline Evaluation';
      const rptRes = await executeReport('RPT-STD-03');
      if (rptRes.success && rptRes.data) {
        const d = rptRes.data;
        facts.push(`Active proposal count in pipeline: ${d.summary.totalRecords}.`);
        if (d.summary.aggregatedValue !== undefined) {
          calculations.push(`Pipeline proposal value: ₹${d.summary.aggregatedValue.toLocaleString('en-IN')}.`);
        }
        recommendations.push('Follow up on pending quotations expiring within 48 hours.');

        structuredData = {
          columns: d.columns.map((c) => c.label),
          rows: d.rows,
        };
      }
    }

    // Compose Localized Response
    let localizedResponse = '';
    if (lang === 'te') {
      localizedResponse = `📊 ICON ERP విశ్లేషణ: ${intent}\n\n[వాస్తవం]: ${facts.join(' ')}\n[లెక్కింపు]: ${calculations.join(' ')}\n[సిఫార్సు]: ${recommendations.join(' ')}`;
    } else if (lang === 'hi') {
      localizedResponse = `📊 ICON ERP रिपोर्ट: ${intent}\n\n[तथ्य]: ${facts.join(' ')}\n[गणना]: ${calculations.join(' ')}\n[सिफारिश]: ${recommendations.join(' ')}`;
    } else {
      localizedResponse = `📊 ICON ERP BRIEFING: ${intent}\n\n[FACT]: ${facts.join(' ')}\n[CALCULATION]: ${calculations.join(' ')}\n[RECOMMENDATION]: ${recommendations.join(' ')}`;
    }

    const englishSummary = `Query: "${query}" | Intent: ${intent} | Caller: ${authUser?.name} (${userRole}) | Key Calc: ${calculations.join('; ')}`;

    await logAuditEvent({
      userName: authUser?.name || 'Authorized User',
      action: 'AI_REPORT_QUERY',
      module: 'AI',
      details: englishSummary,
    });

    const brief: AIReportingBrief = {
      query,
      detectedLanguage: lang,
      intent,
      facts,
      calculations,
      recommendations,
      structuredData,
      localizedResponse,
      englishSummary,
    };

    return { success: true, data: brief };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to process AI report query' };
  }
}
