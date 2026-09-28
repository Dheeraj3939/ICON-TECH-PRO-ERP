'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getAMCContracts, renewAMCContract } from '@/lib/actions/services';
import { getCustomers } from '@/lib/actions/customers';
import { getInvoices } from '@/lib/actions/billing';
import { getServiceTickets } from '@/lib/actions/services';
import { queueOutboxMessage } from '@/lib/actions/communication';
import type {
  AMCOpportunity,
  AMCOpportunityStatus,
  AMCOpportunityType,
  AMCOutreachChannel,
  AMCIntelligenceSummary,
} from '@/types/amc';
import type { AMCContract } from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_AMC_OPPORTUNITIES__: AMCOpportunity[] | undefined;
}

const INITIAL_AMC_OPPORTUNITIES: AMCOpportunity[] = [
  {
    id: 'OPP-001',
    opportunity_number: 'AMC-OPP-26-0001',
    customer_id: 'ICON260006',
    customer_name: 'Sri Sai Hospitals & Diagnostic Center',
    company_name: 'Sri Sai Hospitals',
    contact_phone: '+91 98490 22334',
    contact_email: 'facilities@srisaihospitals.com',
    source_contract_id: 'AMC260001',
    source_contract_number: 'AMC260001',
    opportunity_type: 'RENEWAL',
    expiry_date: '2026-10-31',
    days_until_expiry: 33, // Within 45-day proactive window
    target_annual_value: 39600, // Recommended 10% inflation adjustment
    recommended_package: 'COMPREHENSIVE',
    responsible_employee_name: 'B Vineet Babu',
    status: 'IDENTIFIED',
    ai_recommendation: 'Target Comprehensive AMC renewal for 12 months. All 4 quarterly preventive visits completed with zero unresolved breakdowns in 2025-26.',
    draft_message: 'Dear Facilities Desk, Sri Sai Hospitals. Your ICON TECH PRO Comprehensive Annual Maintenance Contract (AMC260001) for IP CCTV & AV Boardroom systems expires on 31-Oct-2026. To ensure zero downtime and uninterrupted 12-hour SLA response, we have prepared your 2026-27 renewal proposal. Please let us know a convenient time to discuss.',
    draft_channel: 'WHATSAPP',
    is_approved: false,
    created_at: '2026-09-28T10:00:00Z',
    updated_at: '2026-09-28T10:00:00Z',
  },
  {
    id: 'OPP-002',
    opportunity_number: 'AMC-OPP-26-0002',
    customer_id: 'ICON260007',
    customer_name: 'Cyber Heights Commercial Complex',
    company_name: 'Cyber Heights Society',
    contact_phone: '+91 99800 44556',
    contact_email: 'estate@cyberheights.in',
    source_contract_id: 'AMC260002',
    source_contract_number: 'AMC260002',
    opportunity_type: 'RENEWAL',
    expiry_date: '2026-11-10',
    days_until_expiry: 43, // Within 45-day window
    target_annual_value: 79200,
    recommended_package: 'NON_COMPREHENSIVE',
    responsible_employee_name: 'Borra Narsimulu',
    status: 'OUTREACH_PENDING_APPROVAL',
    ai_recommendation: 'Renew Non-Comprehensive AMC covering 6 bi-monthly preventive inspections of perimeter surveillance and public address systems.',
    draft_message: 'Respected Estate Manager, Cyber Heights. Your Annual Maintenance Contract (AMC260002) for commercial AV & PA infrastructure completes term on 10-Nov-2026. We recommend continuous renewal with 6 scheduled preventive visits. Attached is the draft terms sheet for your committee approval.',
    draft_channel: 'WHATSAPP',
    is_approved: false,
    created_at: '2026-09-28T11:00:00Z',
    updated_at: '2026-09-28T11:00:00Z',
  },
];

function getAMCOppsStore(): AMCOpportunity[] {
  if (!globalThis.__ICON_AMC_OPPORTUNITIES__) {
    globalThis.__ICON_AMC_OPPORTUNITIES__ = [...INITIAL_AMC_OPPORTUNITIES];
  }
  return globalThis.__ICON_AMC_OPPORTUNITIES__;
}

/**
 * Proactively scans existing AMC contracts and service history within 45 DAYS OF EXPIRY.
 * Generates structured AMC opportunities while preventing duplicates.
 */
export async function scanAndGenerateAMCOpportunities(): Promise<{
  success: boolean;
  opportunitiesFound: number;
  newOpportunitiesCreated: number;
  opportunities: AMCOpportunity[];
}> {
  const authUser = await requireRole([
    'Managing Director',
    'Admin / BDM',
    'BDM',
    'Sales Executive',
    'Office Assistant',
  ]);

  const contracts: AMCContract[] = await getAMCContracts();
  const store = getAMCOppsStore();
  const today = new Date();
  const PROACTIVE_DAYS = 45;

  let newCreated = 0;

  for (const contract of contracts) {
    if (!contract.end_date || !contract.is_active) continue;

    const endDate = new Date(contract.end_date);
    const diffTime = endDate.getTime() - today.getTime();
    const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Target contracts within 45 days of expiry or recently expired (within 30 days)
    if (daysUntilExpiry <= PROACTIVE_DAYS && daysUntilExpiry >= -30) {
      // Check for existing active opportunity (prevent duplicate creation)
      const existing = store.find(
        (o) =>
          o.source_contract_id === contract.id ||
          o.source_contract_number === contract.contract_number ||
          (o.customer_id === contract.customer_id && o.status !== 'RENEWED' && o.status !== 'DECLINED')
      );

      if (!existing) {
        const seq = (store.length + 1).toString().padStart(4, '0');
        const oppNumber = `AMC-OPP-26-${seq}`;
        const targetValue = Math.round(Number(contract.contract_value || 30000) * 1.1);

        const newOpp: AMCOpportunity = {
          id: `OPP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          opportunity_number: oppNumber,
          customer_id: contract.customer_id,
          customer_name: contract.customer_name,
          source_contract_id: contract.id,
          source_contract_number: contract.contract_number,
          opportunity_type: 'RENEWAL',
          expiry_date: contract.end_date,
          days_until_expiry: daysUntilExpiry,
          target_annual_value: targetValue,
          recommended_package: contract.amc_type || 'COMPREHENSIVE',
          responsible_employee_name: 'B Vineet Babu',
          status: 'IDENTIFIED',
          ai_recommendation: `Contract ${contract.contract_number} expires in ${daysUntilExpiry} days. Recommend proactive renewal at ₹${targetValue} with ${contract.annual_visits_count} scheduled visits.`,
          draft_message: `Dear ${contract.customer_name}, your ICON TECH PRO Annual Maintenance Contract (${contract.contract_number}) is scheduled for renewal in ${daysUntilExpiry} days on ${contract.end_date}. We have prepared your renewal quote with zero disruption to your system coverage.`,
          draft_channel: 'WHATSAPP',
          is_approved: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        store.unshift(newOpp);
        newCreated++;

        if (await isSupabaseAvailable()) {
          try {
            const admin = createAdminClient();
            await admin.from('amc_opportunities').insert({
              opportunity_number: newOpp.opportunity_number,
              customer_id: newOpp.customer_id,
              customer_name: newOpp.customer_name,
              source_contract_id: newOpp.source_contract_id,
              source_contract_number: newOpp.source_contract_number,
              opportunity_type: newOpp.opportunity_type,
              expiry_date: newOpp.expiry_date,
              days_until_expiry: newOpp.days_until_expiry,
              target_annual_value: newOpp.target_annual_value,
              recommended_package: newOpp.recommended_package,
              responsible_employee_name: newOpp.responsible_employee_name,
              status: newOpp.status,
              ai_recommendation: newOpp.ai_recommendation,
              draft_message: newOpp.draft_message,
              draft_channel: newOpp.draft_channel,
              is_approved: newOpp.is_approved,
            });
          } catch {
            // Ignore
          }
        }
      }
    }
  }

  await logAuditEvent({
    userName: authUser.name,
    action: 'AMC_SCAN_EXECUTED',
    module: 'AMC_INTELLIGENCE',
    details: `Executed 45-day AMC expiry scan. Created ${newCreated} new renewal opportunities.`,
  });

  revalidatePath('/dashboard/service');
  return {
    success: true,
    opportunitiesFound: store.length,
    newOpportunitiesCreated: newCreated,
    opportunities: store,
  };
}

/**
 * Retrieve all AMC opportunities.
 */
export async function getAMCOpportunities(statusFilter?: AMCOpportunityStatus): Promise<AMCOpportunity[]> {
  const store = getAMCOppsStore();
  if (statusFilter) {
    return store.filter((o) => o.status === statusFilter);
  }
  return store;
}

/**
 * Mandatory Human Approval Gate: Approves AI draft outreach message before sending.
 * Only Managing Director, Admin / BDM, and BDM may authorize outreach.
 */
export async function approveAMCOutreach(
  opportunityId: string,
  customDraft?: string,
  channel: AMCOutreachChannel = 'WHATSAPP'
): Promise<{ success: boolean; data?: AMCOpportunity; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);
    const store = getAMCOppsStore();
    const opp = store.find((o) => o.id === opportunityId || o.opportunity_number === opportunityId);

    if (!opp) {
      return { success: false, error: 'AMC opportunity not found' };
    }

    opp.is_approved = true;
    opp.approved_by_name = authUser.name;
    opp.approved_at = new Date().toISOString();
    opp.status = 'OUTREACH_PENDING_APPROVAL';
    opp.draft_channel = channel;
    if (customDraft) {
      opp.draft_message = customDraft;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('amc_opportunities')
          .update({
            is_approved: true,
            approved_by_name: authUser.name,
            approved_at: opp.approved_at,
            status: opp.status,
            draft_message: opp.draft_message,
            draft_channel: opp.draft_channel,
          })
          .or(`id.eq.${opp.id},opportunity_number.eq.${opp.opportunity_number}`);
      } catch {
        // Fallback
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'AMC_OUTREACH_APPROVED',
      module: 'AMC_INTELLIGENCE',
      details: `Approved AMC renewal outreach for ${opp.customer_name} (${opp.opportunity_number})`,
    });

    revalidatePath('/dashboard/service');
    return { success: true, data: opp };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to approve AMC outreach' };
  }
}

/**
 * Dispatches the approved outreach message via communication outbox.
 * Enforces mandatory human approval gate prior to dispatch.
 */
export async function sendAMCOutreach(
  opportunityId: string
): Promise<{ success: boolean; outboxMessageId?: string; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const store = getAMCOppsStore();
    const opp = store.find((o) => o.id === opportunityId || o.opportunity_number === opportunityId);

    if (!opp) {
      return { success: false, error: 'AMC opportunity not found' };
    }

    if (!opp.is_approved) {
      return {
        success: false,
        error: 'Mandatory Governance Guard: This outreach draft has not been approved by an authorized manager yet.',
      };
    }

    if (opp.status === 'OUTREACH_SENT') {
      return {
        success: false,
        error: 'Anti-Spam Guard: Outreach has already been sent to this customer. Duplicate outreach is prohibited.',
      };
    }

    // Queue in communication outbox
    const recipient = opp.draft_channel === 'WHATSAPP' ? (opp.contact_phone || '+91 98490 22334') : (opp.contact_email || 'client@example.com');
    const outboxRes = await queueOutboxMessage({
      channel: opp.draft_channel === 'EMAIL' ? 'EMAIL' : 'WHATSAPP',
      recipient,
      message_body: opp.draft_message || 'AMC Renewal proposal from ICON TECH PRO.',
      entity_type: 'customers',
      entity_id: opp.customer_id,
      customer_id: opp.customer_id,
      recipient_name: opp.customer_name,
    });

    opp.status = 'OUTREACH_SENT';
    opp.outreach_sent_at = new Date().toISOString();
    opp.last_follow_up_at = new Date().toISOString();

    await logAuditEvent({
      userName: authUser.name,
      action: 'AMC_OUTREACH_SENT',
      module: 'AMC_INTELLIGENCE',
      details: `Dispatched AMC renewal communication to ${opp.customer_name} via ${opp.draft_channel}`,
    });

    revalidatePath('/dashboard/service');
    return { success: true, outboxMessageId: outboxRes.data?.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send AMC outreach' };
  }
}

/**
 * Converts an accepted AMC renewal opportunity directly into an active AMC contract.
 */
export async function convertAMCOpportunityToContract(
  opportunityId: string
): Promise<{ success: boolean; contractId?: string; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);
    const store = getAMCOppsStore();
    const opp = store.find((o) => o.id === opportunityId || o.opportunity_number === opportunityId);

    if (!opp) {
      return { success: false, error: 'AMC opportunity not found' };
    }

    if (opp.source_contract_id) {
      const renewRes = await renewAMCContract(opp.source_contract_id, 12);
      if (!renewRes.success || !renewRes.data) {
        return { success: false, error: renewRes.error || 'Failed to renew contract' };
      }

      opp.status = 'RENEWED';
      opp.updated_at = new Date().toISOString();

      await logAuditEvent({
        userName: authUser.name,
        action: 'AMC_OPPORTUNITY_CONVERTED',
        module: 'AMC_INTELLIGENCE',
        details: `Converted opportunity ${opp.opportunity_number} into renewed contract ${renewRes.data.contract_number}`,
      });

      revalidatePath('/dashboard/service');
      return { success: true, contractId: renewRes.data.id };
    }

    return { success: false, error: 'No source contract associated with this opportunity.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to convert AMC opportunity' };
  }
}

/**
 * Calculates high-level summary metrics for AMC Cockpit & Intelligence dashboard.
 */
export async function getAMCIntelligenceStats(): Promise<AMCIntelligenceSummary> {
  const store = getAMCOppsStore();
  const contracts = await getAMCContracts();

  const totalActive = contracts.filter((c) => c.is_active).length;
  const expiring45 = store.filter((o) => o.days_until_expiry <= 45 && o.days_until_expiry >= 0 && o.status !== 'RENEWED').length;
  const expired = store.filter((o) => o.days_until_expiry < 0 && o.status !== 'RENEWED').length;
  const pipelineValue = store
    .filter((o) => o.status !== 'RENEWED' && o.status !== 'DECLINED')
    .reduce((sum, o) => sum + (o.target_annual_value || 0), 0);

  return {
    totalActiveAMCs: totalActive,
    expiringIn45Days: expiring45,
    alreadyExpired: expired,
    totalOpportunityPipelineValue: pipelineValue,
    pendingApprovalCount: store.filter((o) => o.status === 'OUTREACH_PENDING_APPROVAL').length,
    outreachSentCount: store.filter((o) => o.status === 'OUTREACH_SENT').length,
    renewedCount: store.filter((o) => o.status === 'RENEWED').length,
  };
}
