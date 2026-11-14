'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeSearchTerm } from '@/lib/supabase/db-helpers';
import type {
  TechnicalEvaluation,
  CreateTechnicalEvaluationPayload,
  TechnicalEvaluationStatus,
  TechnicalRecommendedItem,
} from '@/types/technical-evaluation';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_TECHNICAL_EVALUATIONS__: TechnicalEvaluation[] | undefined;
}

const SEED_TECHNICAL_EVALUATIONS: TechnicalEvaluation[] = [
  {
    id: 'TE-2026-0001',
    evaluation_number: 'TE/2026-27/0001',
    version: 1,
    status: 'Reviewed',
    customer_id: 'CUST-CYIENT-001',
    customer_name: 'Cyient Technologies Hyderabad Campus',
    company_name: 'Cyient Limited',
    enquiry_id: 'ENQ260001',
    enquiry_number: 'ENQ260001',
    site_visit_id: 'SV-ENQ260001',
    site_visit_number: 'SV260001',
    project_category: 'Video Conferencing Solutions',
    evaluation_date: '2026-08-25',
    evaluated_by_id: 'USR-DEV-002',
    evaluated_by_name: 'Vamshi Krishna (Lead AV & Systems Engineer)',
    assigned_technical_employee_id: 'USR-DEV-002',
    assigned_technical_employee_name: 'Vamshi Krishna',
    stated_requirement: 'Enterprise 24-seater Boardroom Video Conferencing with 4K Dual Displays, Ceiling Beamforming Microphones, and Teams Rooms native integration.',
    project_objectives: 'Achieve broadcast-quality audio-video clarity with zero acoustic echo and full cable management concealing in boardroom table.',
    number_of_rooms: 1,
    room_or_endpoint_locations: 'Main Executive Boardroom, 5th Floor, Block B',
    expected_capacity_usage: '24 Executive Participants, Daily Hybrid Executive Meetings',
    commercial_budget_constraints: '₹8,00,000 to ₹12,00,000 complete turnkey solution',
    existing_equipment_details: 'Outdated Polycom analog conference phone, damaged HDMI wall plate',
    network_infrastructure: 'Cat6 structured cabling available, Gigabit PoE+ switch port provisioned on VLAN 40',
    electrical_power_availability: 'Dedicated 2kVA Online UPS circuit available behind display wall',
    cabling_conduits_status: '2-inch floor conduit from table to display wall verified with pull wire',
    rack_mounting_arrangements: '12U wall-mount AV rack provisioned in adjacent server nook',
    compatibility_requirements: 'Strict compatibility with Microsoft Teams Rooms and Zoom Rooms',
    site_measurements: 'Room Dimensions: 28ft Length x 18ft Width x 10.5ft Ceiling Height',
    physical_constraints: 'Glass partition on east wall requires directional boundary acoustic management',
    technical_limitations: 'Direct afternoon sunlight requires min. 700 nits high-haze commercial displays',
    existing_infrastructure_issues: 'High reverberation (~1.1s RT60). Acoustic paneling recommended on rear wall.',
    recommended_items: [
      {
        id: 'ITEM-TE-001',
        brand: 'Poly / HP',
        model: 'Studio X70 All-in-One 4K Video Bar',
        specifications: 'Dual 4K cameras, auto-tracking, native Teams/Zoom Room compute built-in',
        quantity: 1,
        unit: 'Set',
        estimated_unit_price: 385000,
        hsn_sac: '85285200',
        gst_rate: 18,
        notes: 'Primary Boardroom VC Engine',
        is_selected_for_quote: true,
      },
      {
        id: 'ITEM-TE-002',
        brand: 'Sony',
        model: 'FW-75BZ40L 75" 4K Commercial Displays',
        specifications: '700 nits brightness, anti-glare, 24/7 commercial operation rating',
        quantity: 2,
        unit: 'Nos.',
        estimated_unit_price: 185000,
        hsn_sac: '85285200',
        gst_rate: 18,
        notes: 'Dual Display Setup for Content and Video Callers',
        is_selected_for_quote: true,
      },
      {
        id: 'ITEM-TE-003',
        brand: 'Shure',
        model: 'Microflex Advance MXA920 Ceiling Array Microphone',
        specifications: 'Steerable coverage, Dante audio networking, integrated AEC',
        quantity: 1,
        unit: 'Set',
        estimated_unit_price: 245000,
        hsn_sac: '85181000',
        gst_rate: 18,
        notes: 'Over-table ceiling pickup eliminating tabletop wire clutter',
        is_selected_for_quote: true,
      },
    ],
    system_architecture_summary: 'Fully integrated Microsoft Teams Rooms system with dual 75-inch Sony commercial displays, Poly X70 video codec bar, and Shure MXA920 ceiling array audio networked via Dante PoE switch.',
    connectivity_matrix: 'HDMI 2.0 4K60, USB 3.0 Type-C BYOD passthrough, Dante IP Audio, RS-232 IP Control',
    required_accessories: 'Heavy-duty dual display wall mounts, 15m optical active HDMI cables, custom motorized table pop-up cubby',
    cabling_installation_scope: 'Pull Cat6A shielded cables through existing floor conduit, terminate patch panel, dress rack cabling',
    configuration_commissioning_scope: 'Teams Rooms tenant enrollment, Shure Designer microphone lobe tuning, EDID display handshake verification',
    technical_risks: 'Glass reverberation may require secondary acoustic treatment if customer declines wall panels',
    installation_limitations: 'Installation work permitted only on weekends or after 7:00 PM on weekdays',
    civil_electrical_dependency: 'Client electrical team must provide 2x 16A switch sockets behind display mounts',
    third_party_dependencies: 'Client IT must whitelist Microsoft Teams Rooms gateway URLs',
    customer_responsibilities: 'Provide M365 Teams Rooms Pro license and static IP configuration',
    unconfirmed_specifications: 'Exact position of motorized table cubby pending client facilities approval',
    proposed_solution_summary: 'Complete Turnkey Executive Boardroom Solution matching enterprise IT standards with high-end dual display video conference architecture.',
    alternative_options: 'Single 85-inch display option available for ₹1,20,000 lower budget',
    technical_recommendations: 'Proceed with dual 75-inch setup for optimal simultaneous presentation and participant viewing.',
    internal_engineer_remarks: 'Client IT director Venkat Rao is technically sophisticated and values clean cable management and Dante audio reliability.',
    submitted_at: '2026-08-25T16:00:00Z',
    submitted_by_name: 'Vamshi Krishna',
    reviewed_at: '2026-08-26T10:00:00Z',
    reviewed_by_name: 'B V Dheeraj Reddy (Admin / BDM)',
    review_notes: 'Thorough evaluation. Proposed Sony + Poly + Shure combination is optimal for Cyient requirements. Approved for commercial quotation generation.',
    created_at: '2026-08-25T14:00:00Z',
    updated_at: '2026-08-26T10:00:00Z',
  },
];

function getEvaluationStore(): TechnicalEvaluation[] {
  if (!globalThis.__ICON_TECHNICAL_EVALUATIONS__) {
    globalThis.__ICON_TECHNICAL_EVALUATIONS__ = [...SEED_TECHNICAL_EVALUATIONS];
  }
  return globalThis.__ICON_TECHNICAL_EVALUATIONS__;
}

/**
 * Fetch all Technical Evaluations with optional filtering.
 */
export async function getTechnicalEvaluations(filters?: {
  customer_id?: string;
  enquiry_id?: string;
  site_visit_id?: string;
  status?: string;
  search?: string;
}): Promise<{ evaluations: TechnicalEvaluation[]; total: number }> {
  await requireAuth();
  const store = getEvaluationStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      let query = admin.from('technical_evaluations').select('*');

      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters?.enquiry_id) {
        query = query.eq('enquiry_id', filters.enquiry_id);
      }
      if (filters?.site_visit_id) {
        query = query.eq('site_visit_id', filters.site_visit_id);
      }
      if (filters?.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) {
          query = query.or(
            `evaluation_number.ilike.%${s}%,customer_name.ilike.%${s}%,project_category.ilike.%${s}%`
          );
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) {
        return { evaluations: data as TechnicalEvaluation[], total: data.length };
      }
    } catch {
      // In-memory fallback
    }
  }

  let list = [...store];
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((e) => e.status === filters.status);
  }
  if (filters?.customer_id) {
    list = list.filter((e) => e.customer_id === filters.customer_id);
  }
  if (filters?.enquiry_id) {
    list = list.filter((e) => e.enquiry_id === filters.enquiry_id || e.enquiry_number === filters.enquiry_id);
  }
  if (filters?.site_visit_id) {
    list = list.filter((e) => e.site_visit_id === filters.site_visit_id || e.site_visit_number === filters.site_visit_id);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    list = list.filter(
      (e) =>
        e.evaluation_number.toLowerCase().includes(s) ||
        e.customer_name.toLowerCase().includes(s) ||
        e.project_category.toLowerCase().includes(s) ||
        (e.company_name && e.company_name.toLowerCase().includes(s))
    );
  }

  return { evaluations: list, total: list.length };
}

/**
 * Get single Technical Evaluation by ID or Number.
 */
export async function getTechnicalEvaluationById(
  idOrNumber: string
): Promise<TechnicalEvaluation | null> {
  await requireAuth();

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data: byId, error: byIdErr } = await admin
        .from('technical_evaluations')
        .select('*')
        .eq('id', idOrNumber)
        .maybeSingle();
      if (!byIdErr && byId) return byId as TechnicalEvaluation;

      const { data: byNum, error: byNumErr } = await admin
        .from('technical_evaluations')
        .select('*')
        .eq('evaluation_number', idOrNumber)
        .maybeSingle();
      if (!byNumErr && byNum) return byNum as TechnicalEvaluation;
      return null;
    } catch {
      // In-memory fallback
    }
  }

  const store = getEvaluationStore();
  return store.find((e) => e.id === idOrNumber || e.evaluation_number === idOrNumber) || null;
}

/**
 * Create a new Technical Evaluation.
 */
export async function createTechnicalEvaluation(
  payload: CreateTechnicalEvaluationPayload
): Promise<{ success: boolean; data?: TechnicalEvaluation; error?: string }> {
  try {
    const actor = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Office Assistant',
    ]);

    const store = getEvaluationStore();
    const sequenceNumber = store.length + 1;
    const evalNumber = `TE/2026-27/${sequenceNumber.toString().padStart(4, '0')}`;

    const newEvaluation: TechnicalEvaluation = {
      ...payload,
      id: `TE-2026-${sequenceNumber.toString().padStart(4, '0')}`,
      evaluation_number: evalNumber,
      version: 1,
      status: payload.status || 'Draft',
      evaluated_by_id: actor.id,
      evaluated_by_name: actor.name,
      recommended_items: payload.recommended_items || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revisions: [],
    };

    store.unshift(newEvaluation);

    // Persist to Supabase if table exists
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('technical_evaluations').insert(newEvaluation);
      } catch (dbErr) {
        console.warn('Supabase technical_evaluations insert fallback:', dbErr);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'CREATE_TECHNICAL_EVALUATION',
      module: 'OPERATIONS',
      details: `Created Technical Evaluation ${evalNumber} for ${newEvaluation.customer_name} (${newEvaluation.project_category})`,
    });

    revalidatePath('/dashboard/site-visits');
    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard/quotations');
    return { success: true, data: newEvaluation };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create technical evaluation' };
  }
}

/**
 * Update an existing Technical Evaluation.
 */
export async function updateTechnicalEvaluation(
  id: string,
  payload: Partial<TechnicalEvaluation>
): Promise<{ success: boolean; data?: TechnicalEvaluation; error?: string }> {
  try {
    const actor = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Office Assistant',
    ]);

    const store = getEvaluationStore();
    const evaluation = store.find((e) => e.id === id || e.evaluation_number === id);
    if (!evaluation) {
      return { success: false, error: 'Technical evaluation not found' };
    }

    // Role safety: Only MD or Admin/BDM can edit a Reviewed or Closed evaluation
    if (
      (evaluation.status === 'Reviewed' || evaluation.status === 'Closed') &&
      actor.role !== 'Managing Director' &&
      actor.role !== 'Admin / BDM'
    ) {
      return {
        success: false,
        error: 'Only Managing Director or Admin / BDM can modify a reviewed or closed evaluation.',
      };
    }

    // Record revision history if substantive changes are made
    const prevVersion = evaluation.version;
    const newVersion = prevVersion + 1;

    const revisionEntry = {
      revision_number: prevVersion,
      revised_at: new Date().toISOString(),
      revised_by_name: actor.name,
      change_summary: payload.review_notes || 'Updated technical parameters and recommendations.',
      previous_status: evaluation.status,
    };

    const revisions = evaluation.revisions ? [...evaluation.revisions, revisionEntry] : [revisionEntry];

    Object.assign(evaluation, payload, {
      version: newVersion,
      updated_at: new Date().toISOString(),
      revisions,
    });

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('technical_evaluations')
          .update({ ...payload, version: newVersion, updated_at: evaluation.updated_at, revisions })
          .or(`id.eq.${id},evaluation_number.eq.${id}`);
      } catch (dbErr) {
        console.warn('Supabase technical_evaluations update fallback:', dbErr);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'UPDATE_TECHNICAL_EVALUATION',
      module: 'OPERATIONS',
      details: `Updated Technical Evaluation ${evaluation.evaluation_number} to v${newVersion}`,
    });

    revalidatePath('/dashboard/site-visits');
    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard/quotations');
    return { success: true, data: evaluation };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update technical evaluation' };
  }
}

/**
 * Submit Technical Evaluation for Review.
 */
export async function submitTechnicalEvaluation(
  id: string
): Promise<{ success: boolean; data?: TechnicalEvaluation; error?: string }> {
  try {
    const actor = await requireAuth();
    return await updateTechnicalEvaluation(id, {
      status: 'Submitted',
      submitted_at: new Date().toISOString(),
      submitted_by_name: actor.name,
    });
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit evaluation' };
  }
}

/**
 * Review / Approve / Request Revision on Technical Evaluation.
 */
export async function reviewTechnicalEvaluation(
  id: string,
  newStatus: 'Reviewed' | 'Revision Required',
  reviewNotes?: string
): Promise<{ success: boolean; data?: TechnicalEvaluation; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);
    const updatePayload: Partial<TechnicalEvaluation> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'Reviewed') {
      updatePayload.reviewed_at = new Date().toISOString();
      updatePayload.reviewed_by_name = actor.name;
      updatePayload.review_notes = reviewNotes;
    } else {
      updatePayload.revision_requested_at = new Date().toISOString();
      updatePayload.revision_requested_by_name = actor.name;
      updatePayload.revision_notes = reviewNotes;
    }

    return await updateTechnicalEvaluation(id, updatePayload);
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to review evaluation' };
  }
}

/**
 * Close Technical Evaluation.
 */
export async function closeTechnicalEvaluation(
  id: string
): Promise<{ success: boolean; data?: TechnicalEvaluation; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    return await updateTechnicalEvaluation(id, {
      status: 'Closed',
      closed_at: new Date().toISOString(),
      closed_by_name: actor.name,
    });
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to close evaluation' };
  }
}
