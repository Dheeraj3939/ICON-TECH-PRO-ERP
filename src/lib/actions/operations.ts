'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { findByIdOrCode, isUuid, sanitizeSearchTerm, sanitizeUuid } from '@/lib/supabase/db-helpers';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { INITIAL_DISPATCHES } from '@/lib/constants/erp-data';
import { getEnquiries, updateEnquiryStatus } from '@/lib/actions/enquiries';
import { getOrdersStore, getSalesOrderById } from '@/lib/actions/orders';
import { incrementProductStock } from '@/lib/actions/products';
import { getNextDispatchNumber } from '@/lib/utils/sequence';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import type { Dispatch, SiteVisitDetails, Installation, EnquiryStatus, SiteVisitIntelligence } from '@/types/erp';

// Shared in-memory store across requests in this Node process
declare global {
  // eslint-disable-next-line no-var
  var __ICON_DISPATCHES__: Dispatch[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_SITE_VISITS__: SiteVisitDetails[] | undefined;
}

function getDispatchesStore(): Dispatch[] {
  if (!globalThis.__ICON_DISPATCHES__) {
    globalThis.__ICON_DISPATCHES__ = [...INITIAL_DISPATCHES];
  }
  return globalThis.__ICON_DISPATCHES__;
}

function getSiteVisitsStore(): SiteVisitDetails[] {
  if (!globalThis.__ICON_SITE_VISITS__) {
    globalThis.__ICON_SITE_VISITS__ = [];
  }
  return globalThis.__ICON_SITE_VISITS__;
}

function hydrateSiteVisitRow(row: any): SiteVisitDetails {
  return {
    id: row.id,
    visitNumber: row.visit_number || row.visitNumber,
    required: true,
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    company_name: row.company_name,
    enquiry_id: row.enquiry_id,
    enquiry_number: row.enquiry_number,
    contact_person: row.contact_person || row.customer_name,
    contact_phone: row.contact_phone,
    salesperson_name: row.salesperson_name,
    project_category: row.project_category || 'Audio-Visual Solutions',
    other_project_description: row.other_project_description,
    purpose: row.purpose || 'Site Inspection & Feasibility',
    siteAddress: row.site_address || row.siteAddress || '',
    roomType: row.room_type || row.roomType,
    measurements: row.measurements,
    scheduledDate: row.scheduled_date ? String(row.scheduled_date).split('T')[0] : (row.scheduledDate || ''),
    scheduled_time: row.scheduled_time,
    completedDate: row.completed_date ? String(row.completed_date).split('T')[0] : row.completedDate,
    assignedTechnician: row.assigned_technician || row.assignedTechnician || 'Vamshi Krishna',
    status: row.status || 'SCHEDULED',
    notes: row.notes,
    photos: Array.isArray(row.photos) ? row.photos : [],
    drawings: Array.isArray(row.drawings) ? row.drawings : [],
    next_action: row.next_action,
    follow_up_date: row.follow_up_date,
  };
}

export async function getSiteVisits(): Promise<SiteVisitDetails[]> {
  const { enquiries } = await getEnquiries();
  const visits: SiteVisitDetails[] = [];
  const store = getSiteVisitsStore();

  // Try fetching evaluations to link status
  let evaluations: any[] = [];
  try {
    const { getTechnicalEvaluations } = await import('@/lib/actions/technical-evaluations');
    const evalRes = await getTechnicalEvaluations();
    evaluations = evalRes.evaluations || [];
  } catch {
    // If not loaded yet, proceed
  }

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      const { data: dbVisits, error } = await admin
        .from('site_visits')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && dbVisits) {
        for (const row of dbVisits) {
          const visit = hydrateSiteVisitRow(row);
          const matchedEval = evaluations.find(
            (ev) =>
              ev.site_visit_id === visit.id ||
              ev.site_visit_number === visit.visitNumber ||
              (visit.enquiry_id && ev.enquiry_id === visit.enquiry_id) ||
              (visit.enquiry_number && ev.enquiry_number === visit.enquiry_number)
          );
          if (matchedEval) {
            visit.technical_evaluation_id = matchedEval.id;
            visit.technical_evaluation_status = matchedEval.status;
          }
          visits.push(visit);
        }
      }
    } catch (err) {
      console.warn('Supabase site_visits query fallback:', err);
    }
  }

  for (const enq of enquiries) {
    if (enq.site_visit_required || enq.site_visit) {
      const alreadyLoaded = visits.some(
        (v) => v.enquiry_id === enq.id || v.enquiry_number === enq.enquiry_number
      );
      if (alreadyLoaded) continue;

      const visitId = `SV-${enq.enquiry_number}`;
      const visitNum = enq.site_visit?.visitNumber || `SV26000${visits.length + 1}`;

      const matchedEval = evaluations.find(
        (ev) =>
          ev.site_visit_id === visitId ||
          ev.site_visit_number === visitNum ||
          ev.enquiry_id === enq.id ||
          ev.enquiry_number === enq.enquiry_number
      );

      visits.push({
        id: visitId,
        visitNumber: visitNum,
        required: true,
        customer_id: enq.customer_id,
        customer_name: enq.customer_name,
        company_name: enq.company_name,
        enquiry_id: enq.id,
        enquiry_number: enq.enquiry_number,
        contact_person: enq.customer_name,
        contact_phone: enq.phone,
        salesperson_name: enq.salesperson_name,
        project_category:
          enq.site_visit?.project_category ||
          (enq.product_category === 'Video Conferencing'
            ? 'Video Conferencing Solutions'
            : enq.product_category === 'Home Theater'
            ? 'Home Theater Solutions'
            : enq.product_category === 'CCTV'
            ? 'CCTV & Surveillance'
            : 'Audio-Visual Solutions'),
        other_project_description: enq.site_visit?.other_project_description,
        purpose: enq.site_visit?.purpose || 'Physical site measurement, conduit path check, and acoustic survey',
        siteAddress: enq.site_visit?.siteAddress || (enq as any).site_address || `${enq.company_name || enq.customer_name} Site, Hyderabad`,
        roomType: enq.site_visit?.roomType || 'Commercial / Residential Hall',
        measurements: enq.site_visit?.measurements || 'Standard Room Dimensions',
        scheduledDate: enq.site_visit?.scheduledDate || enq.follow_up_date || enq.created_at.split('T')[0],
        scheduled_time: enq.site_visit?.scheduled_time || '11:00 AM',
        completedDate: enq.site_visit?.completedDate,
        assignedTechnician: enq.site_visit?.assignedTechnician || enq.salesperson_name || 'Vamshi Krishna / Nagaraju',
        status: enq.status === 'Quotation sent' || enq.status === 'Order done' ? 'COMPLETED' : (enq.site_visit?.status || 'SCHEDULED'),
        notes: enq.site_visit?.notes || enq.requirement_summary,
        next_action: enq.site_visit?.next_action || 'Prepare Technical Evaluation & Bill of Materials',
        follow_up_date: enq.site_visit?.follow_up_date || enq.follow_up_date,
        technical_evaluation_id: matchedEval?.id,
        technical_evaluation_status: matchedEval?.status,
      });
    }
  }

  // Merge any standalone offline created surveys only if DB offline or missing
  if (!isOnline) {
    for (const storedVisit of store) {
      if (!visits.some((v) => v.id === storedVisit.id || v.visitNumber === storedVisit.visitNumber)) {
        const matchedEval = evaluations.find(
          (ev) =>
            ev.site_visit_id === storedVisit.id ||
            ev.site_visit_number === storedVisit.visitNumber
        );
        if (matchedEval) {
          storedVisit.technical_evaluation_id = matchedEval.id;
          storedVisit.technical_evaluation_status = matchedEval.status;
        }
        visits.unshift(storedVisit);
      }
    }
  }

  return visits;
}

export async function createSiteVisit(payload: {
  customer_id?: string;
  customer_name: string;
  company_name?: string;
  enquiry_id?: string;
  enquiry_number?: string;
  siteAddress: string;
  contact_person?: string;
  contact_phone?: string;
  salesperson_name?: string;
  assignedTechnician?: string;
  project_category?: string;
  other_project_description?: string;
  purpose?: string;
  roomType?: string;
  measurements?: string;
  scheduledDate: string;
  scheduled_time?: string;
  notes?: string;
  photos?: string[];
  drawings?: string[];
  next_action?: string;
  follow_up_date?: string;
  status?: 'SCHEDULED' | 'COMPLETED' | 'RESCHEDULED' | 'CANCELLED';
}): Promise<{ success: boolean; data?: SiteVisitDetails; error?: string }> {
  try {
    const actor = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Office Assistant',
    ]);

    const store = getSiteVisitsStore();
    const sequenceNum = 260000 + store.length + 10;
    const visitNumber = `SV${sequenceNum}`;
    const visitId = `SV-${Date.now()}`;

    const newVisit: SiteVisitDetails = {
      id: visitId,
      visitNumber,
      required: true,
      customer_id: payload.customer_id || `CUST-${Date.now()}`,
      customer_name: payload.customer_name,
      company_name: payload.company_name,
      enquiry_id: payload.enquiry_id,
      enquiry_number: payload.enquiry_number,
      siteAddress: payload.siteAddress,
      contact_person: payload.contact_person || payload.customer_name,
      contact_phone: payload.contact_phone,
      salesperson_name: payload.salesperson_name || actor.name,
      assignedTechnician: payload.assignedTechnician || 'Vamshi Krishna',
      project_category: payload.project_category || 'Audio-Visual Solutions',
      other_project_description: payload.other_project_description,
      purpose: payload.purpose || 'Site Inspection & Feasibility',
      roomType: payload.roomType || 'Home Theater',
      measurements: payload.measurements,
      scheduledDate: payload.scheduledDate,
      scheduled_time: payload.scheduled_time || '11:00 AM',
      notes: payload.notes,
      photos: payload.photos || [],
      drawings: payload.drawings || [],
      next_action: payload.next_action || 'Complete Technical Evaluation',
      follow_up_date: payload.follow_up_date || payload.scheduledDate,
      status: payload.status || 'SCHEDULED',
    };

    store.unshift(newVisit);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data: dbVisit, error: visitErr } = await admin
          .from('site_visits')
          .insert({
            visit_number: newVisit.visitNumber,
            enquiry_id: payload.enquiry_id || null,
            enquiry_number: payload.enquiry_number || null,
            customer_id: newVisit.customer_id,
            customer_name: newVisit.customer_name,
            company_name: newVisit.company_name || null,
            site_address: newVisit.siteAddress,
            contact_person: newVisit.contact_person || null,
            contact_phone: newVisit.contact_phone || null,
            salesperson_name: newVisit.salesperson_name || null,
            assigned_technician: newVisit.assignedTechnician,
            project_category: newVisit.project_category || 'Audio-Visual Solutions',
            other_project_description: newVisit.other_project_description || null,
            purpose: newVisit.purpose || null,
            room_type: newVisit.roomType || null,
            measurements: newVisit.measurements || null,
            scheduled_date: newVisit.scheduledDate,
            scheduled_time: newVisit.scheduled_time || null,
            notes: newVisit.notes || null,
            photos: newVisit.photos || [],
            drawings: newVisit.drawings || [],
            next_action: newVisit.next_action || null,
            follow_up_date: newVisit.follow_up_date || null,
            status: newVisit.status,
          })
          .select('id')
          .single();

        if (!visitErr && dbVisit?.id) {
          newVisit.id = dbVisit.id;
        }
        if (payload.enquiry_id || payload.enquiry_number) {
          const enqQuery = admin.from('enquiries').update({ site_visit_required: true });
          await (isUuid(payload.enquiry_id)
            ? enqQuery.eq('id', payload.enquiry_id!)
            : payload.enquiry_number
            ? enqQuery.eq('enquiry_number', payload.enquiry_number)
            : Promise.resolve());
        }
      } catch (err) {
        console.warn('Supabase createSiteVisit fallback:', err);
      }
    }

    // If linked to an enquiry, update enquiry record in memory if present
    if (payload.enquiry_id || payload.enquiry_number) {
      const { enquiries } = await getEnquiries();
      const target = enquiries.find(
        (e) => e.id === payload.enquiry_id || e.enquiry_number === payload.enquiry_number
      );
      if (target) {
        target.site_visit_required = true;
        target.site_visit = newVisit;
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'CREATE_SITE_VISIT',
      module: 'OPERATIONS',
      details: `Created site visit ${visitNumber} for ${payload.customer_name} (Category: ${newVisit.project_category}, Tech: ${newVisit.assignedTechnician})`,
    });

    revalidatePath('/dashboard/site-visits');
    revalidatePath('/dashboard/enquiries');
    return { success: true, data: newVisit };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create site visit' };
  }
}

export type FollowUpFilter =
  | 'ALL'
  | 'TODAY'
  | 'TOMORROW'
  | 'OVERDUE'
  | 'THIS_WEEK'
  | 'UPCOMING'
  | 'COMPLETED'
  | 'HIGH_VALUE'
  | 'EXPIRING_SOON'
  | 'PAYMENT_OVERDUE'
  | 'SITE_VISIT_PENDING'
  | 'APPROVAL_PENDING';

export interface FollowUpItem {
  id: string;
  enquiry_number: string;
  customer_name: string;
  company_name?: string;
  phone: string;
  salesperson_name: string;
  follow_up_date: string;
  requirement: string;
  status: string;
  is_overdue: boolean;
  estimated_budget?: number;
  site_visit_required?: boolean;
  notes?: Array<{ text: string; author: string; timestamp: string }>;
}

export async function getFollowUps(filter: FollowUpFilter = 'ALL'): Promise<FollowUpItem[]> {
  const { enquiries } = await getEnquiries();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const weekEnd = new Date();
  weekEnd.setDate(today.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  let items: FollowUpItem[] = enquiries.map((e) => ({
    id: e.id,
    enquiry_number: e.enquiry_number,
    customer_name: e.customer_name,
    company_name: e.company_name,
    phone: e.phone,
    salesperson_name: e.salesperson_name,
    follow_up_date: e.follow_up_date || todayStr,
    requirement: e.requirement_summary,
    status: e.status,
    is_overdue: Boolean(e.follow_up_date && e.follow_up_date < todayStr && e.status !== 'Order done' && e.status !== 'Closed'),
    estimated_budget: e.estimated_budget || 0,
    site_visit_required: Boolean(e.site_visit_required),
    notes: e.notes || [],
  }));

  switch (filter) {
    case 'TODAY':
      items = items.filter((i) => i.follow_up_date === todayStr && i.status !== 'Order done' && i.status !== 'Closed');
      break;
    case 'TOMORROW':
      items = items.filter((i) => i.follow_up_date === tomorrowStr && i.status !== 'Order done' && i.status !== 'Closed');
      break;
    case 'OVERDUE':
      items = items.filter((i) => i.is_overdue);
      break;
    case 'THIS_WEEK':
      items = items.filter((i) => i.follow_up_date >= todayStr && i.follow_up_date <= weekEndStr && i.status !== 'Order done' && i.status !== 'Closed');
      break;
    case 'UPCOMING':
      items = items.filter((i) => i.follow_up_date > todayStr && i.status !== 'Order done' && i.status !== 'Closed');
      break;
    case 'HIGH_VALUE':
      items = items.filter((i) => (i.estimated_budget || 0) >= 100000 && i.status !== 'Closed');
      break;
    case 'SITE_VISIT_PENDING':
      items = items.filter((i) => i.site_visit_required && i.status !== 'Order done' && i.status !== 'Closed');
      break;
    case 'APPROVAL_PENDING':
      items = items.filter((i) => i.status === 'Quotation sent' || i.status === 'Follow up');
      break;
    case 'COMPLETED':
      items = items.filter((i) => i.status === 'Order done' || i.status === 'Closed');
      break;
    case 'ALL':
    default:
      break;
  }

  items.sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date));
  return items;
}

export async function completeFollowUp(payload: {
  enquiryId: string;
  notes: string;
  authorName?: string;
  nextFollowUpDate?: string;
  newStatus?: EnquiryStatus;
  outcome?:
    | 'Call Connected'
    | 'WhatsApp Sent'
    | 'Meeting Done'
    | 'Follow-up Rescheduled'
    | 'Converted to Order'
    | 'Lost to Competitor';
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
    ]);

    const { enquiries } = await getEnquiries();
    const target = enquiries.find((e) => e.id === payload.enquiryId || e.enquiry_number === payload.enquiryId);

    if (target) {
      if (!target.notes) target.notes = [];
      const noteText = payload.outcome ? `[${payload.outcome}] ${payload.notes}` : payload.notes;
      target.notes.push({
        text: noteText,
        author: authUser.name,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      });

      if (payload.nextFollowUpDate) {
        target.follow_up_date = payload.nextFollowUpDate;
      }

      const statusToSet =
        payload.outcome === 'Converted to Order'
          ? 'Order done'
          : payload.outcome === 'Lost to Competitor'
          ? 'Closed'
          : payload.newStatus;

      if (statusToSet) {
        await updateEnquiryStatus(target.id, statusToSet);
      }
    }

    revalidatePath('/dashboard/follow-ups');
    revalidatePath('/dashboard/enquiries');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to complete follow up' };
  }
}

/**
 * Reschedule a follow-up with reason and audit trail.
 */
export async function rescheduleFollowUp(payload: {
  enquiryId: string;
  newDate: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
    ]);

    const { enquiries } = await getEnquiries();
    const target = enquiries.find((e) => e.id === payload.enquiryId || e.enquiry_number === payload.enquiryId);

    if (!target) {
      return { success: false, error: 'Enquiry not found for follow-up reschedule' };
    }

    const previousDate = target.follow_up_date || 'None';
    target.follow_up_date = payload.newDate;

    if (!target.notes) target.notes = [];
    target.notes.push({
      text: `[Follow-up Rescheduled by ${authUser.name}]: Moved from ${previousDate} to ${payload.newDate}${payload.reason ? ` — Reason: ${payload.reason}` : ''}`,
      author: authUser.name,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    });

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        await admin
          .from('enquiries')
          .update({
            follow_up_date: payload.newDate,
            updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${target.id},enquiry_number.eq.${target.enquiry_number}`);
      } catch (err) {
        console.warn('Supabase rescheduleFollowUp failed, using store:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'RESCHEDULE_FOLLOW_UP',
      module: 'OPERATIONS',
      details: `Rescheduled follow-up on ${target.enquiry_number} to ${payload.newDate} (${payload.reason || 'Routine reschedule'})`,
    });

    revalidatePath('/dashboard/follow-ups');
    revalidatePath('/dashboard/enquiries');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to reschedule follow-up' };
  }
}

/**
 * Update Site Visit details (schedule, assigned technician, measurements, notes).
 */
export async function updateSiteVisit(payload: {
  visitId: string;
  scheduledDate?: string;
  scheduled_time?: string;
  assignedTechnician?: string;
  siteAddress?: string;
  contact_person?: string;
  contact_phone?: string;
  salesperson_name?: string;
  project_category?: string;
  other_project_description?: string;
  purpose?: string;
  roomType?: string;
  measurements?: string;
  notes?: string;
  next_action?: string;
  follow_up_date?: string;
  status?: 'SCHEDULED' | 'COMPLETED' | 'RESCHEDULED' | 'CANCELLED';
}): Promise<{ success: boolean; data?: SiteVisitDetails; error?: string }> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Office Assistant',
    ]);

    const { enquiries } = await getEnquiries();
    // visitId format can be SV-ENQxxx or enquiry_number or id
    const enqNumber = payload.visitId.replace(/^SV-/, '');
    const target = enquiries.find(
      (e) => e.id === payload.visitId || e.enquiry_number === payload.visitId || e.enquiry_number === enqNumber || e.id === enqNumber
    );

    const store = getSiteVisitsStore();
    const storedVisit = store.find((v) => v.id === payload.visitId || v.visitNumber === payload.visitId);

    if (!target && !storedVisit) {
      return { success: false, error: 'Site visit record not found' };
    }

    if (storedVisit) {
      if (payload.scheduledDate !== undefined) storedVisit.scheduledDate = payload.scheduledDate;
      if (payload.scheduled_time !== undefined) storedVisit.scheduled_time = payload.scheduled_time;
      if (payload.assignedTechnician !== undefined) storedVisit.assignedTechnician = payload.assignedTechnician;
      if (payload.siteAddress !== undefined) storedVisit.siteAddress = payload.siteAddress;
      if (payload.contact_person !== undefined) storedVisit.contact_person = payload.contact_person;
      if (payload.contact_phone !== undefined) storedVisit.contact_phone = payload.contact_phone;
      if (payload.salesperson_name !== undefined) storedVisit.salesperson_name = payload.salesperson_name;
      if (payload.project_category !== undefined) storedVisit.project_category = payload.project_category;
      if (payload.other_project_description !== undefined) storedVisit.other_project_description = payload.other_project_description;
      if (payload.purpose !== undefined) storedVisit.purpose = payload.purpose;
      if (payload.roomType !== undefined) storedVisit.roomType = payload.roomType;
      if (payload.measurements !== undefined) storedVisit.measurements = payload.measurements;
      if (payload.notes !== undefined) storedVisit.notes = payload.notes;
      if (payload.next_action !== undefined) storedVisit.next_action = payload.next_action;
      if (payload.follow_up_date !== undefined) storedVisit.follow_up_date = payload.follow_up_date;
      if (payload.status !== undefined) storedVisit.status = payload.status;
    }

    if (target) {
      if (!target.site_visit) {
        target.site_visit = {
          id: `SV-${target.enquiry_number}`,
          visitNumber: `SV-${target.enquiry_number}`,
          required: true,
        };
      }

      if (payload.scheduledDate !== undefined) target.site_visit.scheduledDate = payload.scheduledDate;
      if (payload.scheduled_time !== undefined) target.site_visit.scheduled_time = payload.scheduled_time;
      if (payload.assignedTechnician !== undefined) target.site_visit.assignedTechnician = payload.assignedTechnician;
      if (payload.siteAddress !== undefined) target.site_visit.siteAddress = payload.siteAddress;
      if (payload.contact_person !== undefined) target.site_visit.contact_person = payload.contact_person;
      if (payload.contact_phone !== undefined) target.site_visit.contact_phone = payload.contact_phone;
      if (payload.salesperson_name !== undefined) target.site_visit.salesperson_name = payload.salesperson_name;
      if (payload.project_category !== undefined) target.site_visit.project_category = payload.project_category;
      if (payload.other_project_description !== undefined) target.site_visit.other_project_description = payload.other_project_description;
      if (payload.purpose !== undefined) target.site_visit.purpose = payload.purpose;
      if (payload.roomType !== undefined) target.site_visit.roomType = payload.roomType;
      if (payload.measurements !== undefined) target.site_visit.measurements = payload.measurements;
      if (payload.notes !== undefined) target.site_visit.notes = payload.notes;
      if (payload.next_action !== undefined) target.site_visit.next_action = payload.next_action;
      if (payload.follow_up_date !== undefined) target.site_visit.follow_up_date = payload.follow_up_date;
      if (payload.status !== undefined) target.site_visit.status = payload.status;

      target.site_visit_required = true;

      if (!target.notes) target.notes = [];
      target.notes.push({
        text: `[Site Visit Updated by ${authUser.name}]: Date=${target.site_visit.scheduledDate || 'N/A'}, Tech=${target.site_visit.assignedTechnician || 'N/A'}, Status=${target.site_visit.status || 'SCHEDULED'}`,
        author: authUser.name,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      });

      const isOnline = await isSupabaseAvailable();
      if (isOnline) {
        try {
          const admin = createAdminClient();
          const enqQuery = admin
            .from('enquiries')
            .update({
              site_visit_required: true,
              updated_at: new Date().toISOString(),
            });
          await (isUuid(target.id)
            ? enqQuery.eq('id', target.id)
            : enqQuery.eq('enquiry_number', target.enquiry_number));
        } catch (err) {
          console.warn('Supabase updateSiteVisit sync failed, using store:', err);
        }
      }
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const visitUpdates: Record<string, any> = {};
        if (payload.scheduledDate !== undefined) visitUpdates.scheduled_date = payload.scheduledDate;
        if (payload.scheduled_time !== undefined) visitUpdates.scheduled_time = payload.scheduled_time;
        if (payload.assignedTechnician !== undefined) visitUpdates.assigned_technician = payload.assignedTechnician;
        if (payload.siteAddress !== undefined) visitUpdates.site_address = payload.siteAddress;
        if (payload.contact_person !== undefined) visitUpdates.contact_person = payload.contact_person;
        if (payload.contact_phone !== undefined) visitUpdates.contact_phone = payload.contact_phone;
        if (payload.salesperson_name !== undefined) visitUpdates.salesperson_name = payload.salesperson_name;
        if (payload.project_category !== undefined) visitUpdates.project_category = payload.project_category;
        if (payload.other_project_description !== undefined) visitUpdates.other_project_description = payload.other_project_description;
        if (payload.purpose !== undefined) visitUpdates.purpose = payload.purpose;
        if (payload.roomType !== undefined) visitUpdates.room_type = payload.roomType;
        if (payload.measurements !== undefined) visitUpdates.measurements = payload.measurements;
        if (payload.notes !== undefined) visitUpdates.notes = payload.notes;
        if (payload.next_action !== undefined) visitUpdates.next_action = payload.next_action;
        if (payload.follow_up_date !== undefined) visitUpdates.follow_up_date = payload.follow_up_date;
        if (payload.status !== undefined) visitUpdates.status = payload.status;

        if (Object.keys(visitUpdates).length > 0) {
          await admin
            .from('site_visits')
            .update(visitUpdates)
            .or(`id.eq.${payload.visitId},visit_number.eq.${payload.visitId}`);
        }
      } catch (err) {
        console.warn('Supabase site_visits update fallback:', err);
      }
    }

    const updatedData = storedVisit || target?.site_visit;

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_SITE_VISIT',
      module: 'OPERATIONS',
      details: `Updated site visit ${payload.visitId} for ${target?.customer_name || storedVisit?.customer_name || 'Customer'} (Category: ${updatedData?.project_category || 'N/A'}, Tech: ${updatedData?.assignedTechnician}, Date: ${updatedData?.scheduledDate})`,
    });

    revalidatePath('/dashboard/site-visits');
    revalidatePath('/dashboard/enquiries');
    revalidatePath('/dashboard');
    return { success: true, data: updatedData };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update site visit' };
  }
}


export async function getDispatches(): Promise<Dispatch[]> {
  const store = getDispatchesStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.from('dispatches').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        return data as Dispatch[];
      }
    } catch (err) {
      console.warn('Supabase dispatches query failed, using store:', err);
    }
  }

  return store;
}

export async function createDeliveryChallan(payload: {
  order_number: string;
  customer_name: string;
  shipping_address: string;
  transporter_name?: string;
  vehicle_number?: string;
  eway_bill_number?: string;
  dispatched_by_name?: string;
}): Promise<{ success: boolean; data?: Dispatch; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

    const store = getDispatchesStore();
    const dspNumber = await getNextDispatchNumber();
    const dcNumber = `DC-${dspNumber.replace('ICON/', '').replace('DSP-', '')}`;
    const nowIso = new Date().toISOString();

    const dispatch: Dispatch = {
      id: `DSP-${Date.now()}`,
      dispatch_number: dspNumber,
      delivery_challan_number: dcNumber,
      order_number: payload.order_number,
      customer_name: payload.customer_name,
      shipping_address: payload.shipping_address,
      transporter_name: payload.transporter_name || 'Direct Vehicle Dispatch',
      vehicle_number: payload.vehicle_number,
      eway_bill_number: payload.eway_bill_number,
      status: 'Dispatched',
      dispatched_by_name: authUser.name,
      dispatch_date: nowIso,
      created_at: nowIso,
    };

    const linkedOrder = await getSalesOrderById(payload.order_number);
    const isOnline = await isSupabaseAvailable();

    if (isOnline) {
      try {
        const admin = createAdminClient();
        const { data: dbDispatch, error: dspErr } = await admin
          .from('dispatches')
          .insert({
            dispatch_number: dispatch.dispatch_number,
            delivery_challan_number: dispatch.delivery_challan_number,
            order_id: sanitizeUuid(linkedOrder?.id),
            order_number: dispatch.order_number,
            customer_name: dispatch.customer_name,
            shipping_address: dispatch.shipping_address,
            transporter_name: dispatch.transporter_name || null,
            vehicle_number: dispatch.vehicle_number || null,
            eway_bill_number: dispatch.eway_bill_number || null,
            status: dispatch.status,
            dispatched_by_name: dispatch.dispatched_by_name,
            dispatch_date: dispatch.dispatch_date,
          })
          .select('id')
          .single();

        if (!dspErr && dbDispatch?.id) {
          dispatch.id = dbDispatch.id;
        }

        if (linkedOrder && isUuid(linkedOrder.id)) {
          await admin
            .from('sales_orders')
            .update({
              dispatch_status: 'Dispatched',
              fulfillment_status: 'Packed',
              delivery_challan_id: sanitizeUuid(dispatch.id),
              delivery_challan_number: dispatch.delivery_challan_number,
            })
            .eq('id', linkedOrder.id);
        }
      } catch (err) {
        console.warn('Supabase createDeliveryChallan fallback:', err);
      }
    }

    // Decrement physical office stock for non-dropshipped items on the linked order
    if (linkedOrder && Array.isArray(linkedOrder.items)) {
      for (const item of linkedOrder.items) {
        if (item.procurement_status === 'DROPSHIPPED') continue;
        const qtyToDeduct = Math.max(0, (item.quantity || 0) - (item.dispatched_quantity || 0));
        if (qtyToDeduct > 0) {
          const stockTarget = item.sku || item.product_id || item.product_name;
          const res = await incrementProductStock(
            stockTarget,
            -qtyToDeduct,
            'SALES_DISPATCH',
            'DISPATCH',
            dcNumber,
            `Dispatched for Order ${linkedOrder.order_number} (${dcNumber})`
          );
          if (!res.success) {
            console.warn(`Stock decrement skipped for ${item.product_name}: ${res.error}`);
          }
        }
      }
    }

    store.unshift(dispatch);

    // Link dispatch and update distinct fulfillment/dispatch status on linked Sales Order store
    const ordersStore = await getOrdersStore();
    const order = ordersStore.find((o) => o.order_number === payload.order_number || o.id === payload.order_number);
    if (order) {
      order.dispatch_status = 'Dispatched';
      order.fulfillment_status = 'Packed';
      order.delivery_challan_id = dispatch.id;
      order.delivery_challan_number = dispatch.delivery_challan_number;
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_DELIVERY_CHALLAN',
      module: 'DISPATCH',
      details: `Dispatched Delivery Challan ${dcNumber} for Order ${payload.order_number}`,
    });

    revalidatePath('/dashboard/dispatch');
    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard');
    return { success: true, data: dispatch };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create delivery challan' };
  }
}

/**
 * Update Dispatch / Delivery Challan status progression.
 * Progression: Draft DC -> Ready to Ship -> Dispatched -> In Transit -> Delivered -> POD Confirmed.
 */
export async function updateDispatchStatus(
  dispatchId: string,
  newStatus: Dispatch['status'],
  payload?: {
    pod_reference?: string;
    carrier_tracking_url?: string;
    notes?: string;
  }
): Promise<{ success: boolean; data?: Dispatch; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Office Assistant', 'BDM']);
    const isOnline = await isSupabaseAvailable();
    const admin = isOnline ? createAdminClient() : null;

    let dsp: Dispatch | undefined;
    if (admin) {
      dsp =
        (await findByIdOrCode<Dispatch>(admin, 'dispatches', dispatchId, 'dispatch_number')) ||
        undefined;
      if (!dsp) {
        const { data: byDc } = await admin
          .from('dispatches')
          .select('*')
          .eq('delivery_challan_number', dispatchId)
          .maybeSingle();
        if (byDc) dsp = byDc as Dispatch;
      }
    }
    if (!dsp) {
      dsp = getDispatchesStore().find(
        (d) => d.id === dispatchId || d.dispatch_number === dispatchId || d.delivery_challan_number === dispatchId
      );
    }
    if (!dsp) {
      return { success: false, error: `Dispatch ${dispatchId} not found` };
    }

    const prevStatus = dsp.status;
    dsp.status = newStatus;
    if (payload?.pod_reference) dsp.pod_reference = payload.pod_reference;
    if (payload?.carrier_tracking_url) dsp.carrier_tracking_url = payload.carrier_tracking_url;
    if (payload?.notes) dsp.notes = dsp.notes ? `${dsp.notes}\n${payload.notes}` : payload.notes;

    if (newStatus === 'POD Confirmed') {
      dsp.pod_confirmed_at = new Date().toISOString();
      if (!dsp.pod_reference && payload?.pod_reference) {
        dsp.pod_reference = payload.pod_reference;
      }
    }

    if (admin && isUuid(dsp.id)) {
      await admin
        .from('dispatches')
        .update({
          status: dsp.status,
          pod_reference: dsp.pod_reference || null,
          carrier_tracking_url: dsp.carrier_tracking_url || null,
          pod_confirmed_at: dsp.pod_confirmed_at || null,
          notes: dsp.notes || null,
        })
        .eq('id', dsp.id);
    }

    // If linked to an order and delivered/confirmed, update order dispatch status
    if (dsp.order_number) {
      const ordersStore = await getOrdersStore();
      const order = ordersStore.find((o) => o.order_number === dsp.order_number || o.id === dsp.order_number);
      if (order && newStatus === 'POD Confirmed') {
        order.dispatch_status = 'Installed & Handed Over';
      }
      if (admin && newStatus === 'POD Confirmed') {
        await admin
          .from('sales_orders')
          .update({ dispatch_status: 'Installed & Handed Over' })
          .eq('order_number', dsp.order_number);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_DISPATCH_STATUS',
      module: 'DISPATCH',
      details: `Delivery Challan ${dsp.delivery_challan_number} status changed from ${prevStatus} to ${newStatus}${payload?.pod_reference ? ` (POD: ${payload.pod_reference})` : ''}`,
    });

    revalidatePath('/dashboard/dispatch');
    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard');
    return { success: true, data: dsp };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update dispatch status' };
  }
}

// Shared in-memory store for installations across requests in this Node process
declare global {
  // eslint-disable-next-line no-var
  var __ICON_INSTALLATIONS__: Installation[] | undefined;
}

const INITIAL_INSTALLATIONS: Installation[] = [
  {
    id: 'INS001',
    installation_number: 'INS260001',
    order_number: 'ICON/26-27/ORD-0003',
    customer_id: 'ICON260006',
    customer_name: 'Sri Sai Hospitals & Diagnostic Center',
    lead_technician_name: 'Nagaraju & Team',
    scheduled_date: '2026-08-28',
    completed_date: '2026-08-28',
    status: 'COMPLETED',
    handover_status: 'HANDED_OVER',
    customer_signoff_by: 'Dr. R. K. Varma (Admin Director)',
    customer_signoff_date: '2026-08-28',
    site_address: 'Kukatpally Main Road, Hyderabad',
    site_contact_person: 'Ramesh (IT Admin)',
    site_contact_phone: '+91 98480 22334',
    installed_products: [
      { product_name: '8MP 4K ColorVu IP Bullet Camera', sku: 'HIK-4K-CAM-081', serial_number: 'HIK-4K-CAM-081', quantity: 8 },
    ],
    checklist: [
      { id: 'chk-1', label: 'Site readiness & mounting verified', completed: true },
      { id: 'chk-2', label: 'Power & PoE cabling dressed', completed: true },
      { id: 'chk-3', label: 'NVR networked & live mobile view tested', completed: true },
      { id: 'chk-4', label: 'Client staff training completed', completed: true },
    ],
    handover_notes: '8x 4K cameras mounted, NVR networked, live mobile view sign-off completed.',
    created_at: '2026-08-28T10:00:00Z',
  },
  {
    id: 'INS002',
    installation_number: 'INS260002',
    order_number: 'ICON/26-27/ORD-0004',
    customer_id: 'ICON260007',
    customer_name: 'Cyber Heights Commercial Complex',
    lead_technician_name: 'Dheeraj & Technical Support',
    scheduled_date: '2026-08-21',
    completed_date: '2026-08-21',
    status: 'COMPLETED',
    handover_status: 'HANDED_OVER',
    customer_signoff_by: 'Col. Sanjeev Rao (Estate Manager)',
    customer_signoff_date: '2026-08-21',
    site_address: 'Road No. 2, Banjara Hills, Hyderabad',
    site_contact_person: 'Sanjeev Rao',
    site_contact_phone: '+91 99490 88776',
    checklist: [
      { id: 'chk-1', label: 'Mounting & cabling verified', completed: true },
      { id: 'chk-2', label: 'PoE Switch & VLAN commissioned', completed: true },
    ],
    handover_notes: '12 cameras and PoE network switch commissioned on 2nd and 3rd floors.',
    created_at: '2026-08-21T14:00:00Z',
  },
  {
    id: 'INS003',
    installation_number: 'INS260003',
    order_number: 'ICON/26-27/ORD-0001',
    customer_id: 'ICON260001',
    customer_name: 'Swan Solutions & Services',
    lead_technician_name: 'Dheeraj',
    scheduled_date: '2026-09-05',
    status: 'SCHEDULED',
    handover_status: 'PENDING_HANDOVER',
    site_address: 'Hitec City Phase 2, Madhapur, Hyderabad',
    site_contact_person: 'Suresh Menon',
    site_contact_phone: '+91 98201 55667',
    checklist: [
      { id: 'chk-1', label: 'Rack mounting & power inspection', completed: true },
      { id: 'chk-2', label: 'PoE Switch installation & VLAN config', completed: false },
      { id: 'chk-3', label: 'Client testing & handover', completed: false },
    ],
    handover_notes: 'PoE Switch installation and VLAN configuration scheduled for 4:00 PM.',
    created_at: '2026-09-04T10:00:00Z',
  },
];

function getInstallationsStore(): Installation[] {
  if (!globalThis.__ICON_INSTALLATIONS__) {
    globalThis.__ICON_INSTALLATIONS__ = [...INITIAL_INSTALLATIONS];
  }
  return globalThis.__ICON_INSTALLATIONS__;
}

export async function getInstallations(filters?: {
  status?: string;
  search?: string;
}): Promise<Installation[]> {
  const store = getInstallationsStore();

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      let query = admin.from('installations').select('*').order('scheduled_date', { ascending: false });

      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters?.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) {
          query = query.or(`installation_number.ilike.%${s}%,customer_name.ilike.%${s}%,order_number.ilike.%${s}%`);
        }
      }

      const { data, error } = await query;
      if (!error && data) {
        return data as Installation[];
      }
    } catch (err) {
      console.warn('Supabase getInstallations query fallback:', err);
    }
  }

  let filtered = [...store];
  if (filters?.status && filters.status !== 'ALL') {
    filtered = filtered.filter((i) => i.status === filters.status);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.installation_number.toLowerCase().includes(s) ||
        i.customer_name.toLowerCase().includes(s) ||
        (i.order_number && i.order_number.toLowerCase().includes(s))
    );
  }

  return filtered;
}

/**
 * Create a new Installation Job Card linked to a confirmed Sales Order.
 */
export async function createInstallation(payload: {
  order_id?: string;
  order_number?: string;
  customer_id: string;
  customer_name: string;
  lead_technician_name: string;
  scheduled_date: string;
  site_address?: string;
  site_contact_person?: string;
  site_contact_phone?: string;
  installed_products?: Array<{ product_name: string; sku?: string; serial_number?: string; quantity: number }>;
  remarks?: string;
}): Promise<{ success: boolean; data?: Installation; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Office Assistant', 'BDM']);

    const store = getInstallationsStore();
    const { getNextInstallationNumber } = await import('@/lib/utils/sequence');
    const insNumber = await getNextInstallationNumber();

    const defaultChecklist = [
      { id: 'chk-1', label: 'Site readiness & mounting inspection', completed: false },
      { id: 'chk-2', label: 'Power & surge protection verification', completed: false },
      { id: 'chk-3', label: 'Equipment cabling & signal dressing', completed: false },
      { id: 'chk-4', label: 'Firmware & network IP configuration', completed: false },
      { id: 'chk-5', label: 'Operational testing & calibration', completed: false },
      { id: 'chk-6', label: 'Client training & handover demonstration', completed: false },
    ];

    let installedProducts = payload.installed_products || [];
    let resolvedOrderId = sanitizeUuid(payload.order_id);
    let resolvedCustomerId = sanitizeUuid(payload.customer_id);

    if (payload.order_id || payload.order_number) {
      const linkedOrder = await getSalesOrderById(payload.order_id || payload.order_number!);
      if (linkedOrder) {
        if (!resolvedOrderId && isUuid(linkedOrder.id)) {
          resolvedOrderId = linkedOrder.id;
        }
        if (!resolvedCustomerId && isUuid(linkedOrder.customer_id)) {
          resolvedCustomerId = linkedOrder.customer_id;
        }
        if (installedProducts.length === 0 && Array.isArray(linkedOrder.items)) {
          installedProducts = linkedOrder.items.map((it) => ({
            product_name: it.product_name,
            sku: it.sku || undefined,
            quantity: it.quantity,
          }));
        }
      }
    }

    const newInstallation: Installation = {
      id: `INS-${Date.now()}`,
      installation_number: insNumber,
      order_id: resolvedOrderId || payload.order_id,
      order_number: payload.order_number,
      customer_id: resolvedCustomerId || payload.customer_id,
      customer_name: payload.customer_name,
      lead_technician_name: payload.lead_technician_name || 'Technical Support Team',
      scheduled_date: payload.scheduled_date,
      status: 'SCHEDULED',
      handover_status: 'PENDING_HANDOVER',
      site_address: payload.site_address || 'Customer Premises, Hyderabad',
      site_contact_person: payload.site_contact_person,
      site_contact_phone: payload.site_contact_phone,
      installed_products: installedProducts,
      checklist: defaultChecklist,
      remarks: payload.remarks,
      created_at: new Date().toISOString(),
    };

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        if (!resolvedCustomerId && payload.customer_id) {
          const cust = await findByIdOrCode<{ id: string }>(admin, 'customers', payload.customer_id, 'customer_code', 'id');
          if (cust?.id) resolvedCustomerId = cust.id;
        }
        if (resolvedCustomerId) {
          const { data: dbIns, error: insErr } = await admin
            .from('installations')
            .insert({
              installation_number: newInstallation.installation_number,
              order_id: resolvedOrderId,
              order_number: newInstallation.order_number || null,
              customer_id: resolvedCustomerId,
              customer_name: newInstallation.customer_name,
              lead_technician_name: newInstallation.lead_technician_name,
              scheduled_date: newInstallation.scheduled_date,
              status: newInstallation.status,
              site_address: newInstallation.site_address,
              site_contact_person: newInstallation.site_contact_person || null,
              site_contact_phone: newInstallation.site_contact_phone || null,
              installed_products: newInstallation.installed_products,
              checklist: newInstallation.checklist,
              handover_status: newInstallation.handover_status,
              remarks: newInstallation.remarks || null,
            })
            .select()
            .single();

          if (!insErr && dbIns) {
            newInstallation.id = dbIns.id;
          }
        }
      } catch (err) {
        console.warn('Supabase createInstallation insert fallback:', err);
      }
    }

    store.unshift(newInstallation);

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_INSTALLATION',
      module: 'OPERATIONS',
      details: `Scheduled Installation ${insNumber} for ${newInstallation.customer_name} (Lead: ${newInstallation.lead_technician_name})`,
    });

    revalidatePath('/dashboard/installations');
    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard');

    return { success: true, data: newInstallation };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create installation' };
  }
}

/**
 * Update Installation Checklist and Progress
 */
export async function updateInstallationJobCard(
  id: string,
  updates: {
    status?: any;
    checklist?: Array<{ id: string; label: string; completed: boolean }>;
    installed_products?: Array<{ product_name: string; sku?: string; serial_number?: string; quantity: number }>;
    handover_notes?: string;
    remarks?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Office Assistant', 'BDM']);

    const store = getInstallationsStore();
    const isOnline = await isSupabaseAvailable();
    const admin = isOnline ? createAdminClient() : null;
    let found: Installation | undefined;

    if (admin) {
      found = (await findByIdOrCode<Installation>(admin, 'installations', id, 'installation_number')) || undefined;
    }
    if (!found) {
      found = store.find((i) => i.id === id || i.installation_number === id);
    }

    if (found) {
      if (updates.status) found.status = updates.status;
      if (updates.checklist) found.checklist = updates.checklist;
      if (updates.installed_products) found.installed_products = updates.installed_products;
      if (updates.handover_notes) found.handover_notes = updates.handover_notes;
      if (updates.remarks) found.remarks = updates.remarks;
    }

    if (admin) {
      try {
        const targetId = found?.id;
        const query = admin.from('installations').update(updates);
        await (targetId && isUuid(targetId)
          ? query.eq('id', targetId)
          : query.eq('installation_number', found?.installation_number || id));
      } catch (err) {
        console.warn('Supabase updateInstallationJobCard fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_INSTALLATION_JOBCARD',
      module: 'OPERATIONS',
      details: `Updated job card ${id}: status is now ${found?.status || updates.status}`,
    });

    revalidatePath('/dashboard/installations');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update installation' };
  }
}

/**
 * Complete Installation & Record Customer Handover Sign-off
 */
export async function completeInstallationHandover(
  id: string,
  signoff: {
    customer_signoff_by: string;
    customer_signoff_date: string;
    handover_notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Office Assistant', 'BDM']);

    const store = getInstallationsStore();
    const isOnline = await isSupabaseAvailable();
    const admin = isOnline ? createAdminClient() : null;
    let found: Installation | undefined;

    if (admin) {
      found = (await findByIdOrCode<Installation>(admin, 'installations', id, 'installation_number')) || undefined;
    }
    if (!found) {
      found = store.find((i) => i.id === id || i.installation_number === id);
    }

    if (!found) {
      return { success: false, error: 'Installation record not found' };
    }

    found.status = 'COMPLETED';
    found.completed_date = signoff.customer_signoff_date;
    found.customer_signoff_by = signoff.customer_signoff_by;
    found.customer_signoff_date = signoff.customer_signoff_date;
    found.handover_status = 'HANDED_OVER';
    if (signoff.handover_notes) found.handover_notes = signoff.handover_notes;

    // Update linked Sales Order dispatch status to 'Installed & Handed Over'
    if (found.order_number) {
      const { updateOrderStatus } = await import('@/lib/actions/orders');
      await updateOrderStatus(found.order_number, {
        dispatch_status: 'Installed & Handed Over',
      });
    }

    // Auto Warranty Activation for Installed Serialized Equipment
    if (found.installed_products && found.installed_products.length > 0) {
      const serialsStore = globalThis.__ICON_SERIAL_RECORDS__;
      for (const prod of found.installed_products) {
        if (prod.serial_number) {
          const serialRecord = serialsStore?.find((s) => s.serial_number === prod.serial_number);
          if (serialRecord) {
            serialRecord.status = 'INSTALLED';
            serialRecord.installation_id = found.id;
            serialRecord.installation_number = found.installation_number;
            serialRecord.warranty_start_date = signoff.customer_signoff_date;
            const start = new Date(signoff.customer_signoff_date);
            start.setMonth(start.getMonth() + (serialRecord.warranty_duration_months || 12));
            serialRecord.warranty_end_date = start.toISOString().split('T')[0];
          }
          if (admin) {
            try {
              await admin
                .from('inventory_serials')
                .update({ status: 'INSTALLED', allocated_order_number: found.order_number || null })
                .eq('serial_number', prod.serial_number);
            } catch {
              // Optional serial record update
            }
          }
        }
      }
    }

    if (admin) {
      try {
        const query = admin
          .from('installations')
          .update({
            status: 'COMPLETED',
            completed_date: signoff.customer_signoff_date,
            customer_signoff_by: signoff.customer_signoff_by,
            customer_signoff_date: signoff.customer_signoff_date,
            handover_status: 'HANDED_OVER',
            handover_notes: signoff.handover_notes || found.handover_notes,
          });
        await (isUuid(found.id) ? query.eq('id', found.id) : query.eq('installation_number', found.installation_number));
      } catch (err) {
        console.warn('Supabase completeInstallationHandover fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'COMPLETE_INSTALLATION_HANDOVER',
      module: 'OPERATIONS',
      details: `Signed off installation ${found.installation_number} with ${signoff.customer_signoff_by} on ${signoff.customer_signoff_date}`,
    });

    revalidatePath('/dashboard/installations');
    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to complete handover' };
  }
}

/**
 * Technician Workload Analytics
 */
export async function getTechnicianWorkload(): Promise<
  Array<{
    technician_name: string;
    active_installations: number;
    completed_installations: number;
    upcoming_dates: string[];
  }>
> {
  const store = getInstallationsStore();
  const map = new Map<string, { active: number; completed: number; dates: string[] }>();

  store.forEach((ins) => {
    const tech = ins.lead_technician_name || 'Technical Team';
    const current = map.get(tech) || { active: 0, completed: 0, dates: [] };
    if (ins.status === 'COMPLETED') {
      current.completed += 1;
    } else if (ins.status !== 'CANCELLED') {
      current.active += 1;
      if (ins.scheduled_date && !current.dates.includes(ins.scheduled_date)) {
        current.dates.push(ins.scheduled_date);
      }
    }
    map.set(tech, current);
  });

  return Array.from(map.entries()).map(([tech, data]) => ({
    technician_name: tech,
    active_installations: data.active,
    completed_installations: data.completed,
    upcoming_dates: data.dates.sort(),
  }));
}

declare global {
  // eslint-disable-next-line no-var
  var __ICON_SITE_VISIT_INTELLIGENCE__: SiteVisitIntelligence[] | undefined;
}

function getSiteVisitIntelligenceStore(): SiteVisitIntelligence[] {
  if (!globalThis.__ICON_SITE_VISIT_INTELLIGENCE__) {
    globalThis.__ICON_SITE_VISIT_INTELLIGENCE__ = [];
  }
  return globalThis.__ICON_SITE_VISIT_INTELLIGENCE__;
}

export async function getSiteVisitIntelligence(
  visitIdOrNumber: string
): Promise<{ success: boolean; data?: SiteVisitIntelligence; error?: string }> {
  try {
    await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant']);
    const store = getSiteVisitIntelligenceStore();
    const existing = store.find((v) => v.site_visit_id === visitIdOrNumber || v.visit_number === visitIdOrNumber);
    if (existing) {
      return { success: true, data: existing };
    }
    return await generatePreVisitBrief(visitIdOrNumber);
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to retrieve site visit intelligence' };
  }
}

export async function generatePreVisitBrief(
  visitIdOrNumber: string,
  forceRefresh: boolean = false
): Promise<{ success: boolean; data?: SiteVisitIntelligence; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant']);
    const store = getSiteVisitIntelligenceStore();

    if (!forceRefresh) {
      const existing = store.find((v) => v.site_visit_id === visitIdOrNumber || v.visit_number === visitIdOrNumber);
      if (existing) return { success: true, data: existing };
    }

    const visits = await getSiteVisits();
    const visit = visits.find((v) => v.id === visitIdOrNumber || v.visitNumber === visitIdOrNumber);
    if (!visit) {
      return { success: false, error: `Site visit '${visitIdOrNumber}' not found.` };
    }

    // Correlate with enquiry if available
    const { enquiries } = await getEnquiries();
    const enq = enquiries.find((e) => e.site_visit?.visitNumber === visit.visitNumber || `SV-${e.enquiry_number}` === visit.id || e.company_name === visit.siteAddress);

    const room = visit.roomType || 'Commercial Boardroom';
    const address = visit.siteAddress || 'Hyderabad Facility';

    const requirementChecklist: SiteVisitIntelligence['requirement_checklist'] = [
      {
        item: 'Exact Room Dimensions (Length x Width x Height in feet)',
        category: 'DIMENSIONS',
        mandatory: true,
        verified: Boolean(visit.measurements && visit.measurements !== 'Standard Room Dimensions'),
        notes: visit.measurements || 'Measure with laser distance meter at 3 distinct wall points.',
      },
      {
        item: 'Display Mounting Wall Structural Verification (Brick/Concrete vs Gypsum/Drywall)',
        category: 'CIVIL',
        mandatory: true,
        verified: false,
        notes: 'Confirm if plywood reinforcement backer is present for heavy IFP wall mount.',
      },
      {
        item: 'Conduit & Low-Voltage Cable Raceway Pathway (Floor/Ceiling/Wall)',
        category: 'NETWORK',
        mandatory: true,
        verified: false,
        notes: 'Check 25mm conduit availability from table floor-box to display wall.',
      },
      {
        item: 'Dedicated Raw & UPS Power Points (6A/16A grounded sockets)',
        category: 'ELECTRICAL',
        mandatory: true,
        verified: false,
        notes: 'Measure ground-to-neutral voltage (< 2V AC required for sensitive AV electronics).',
      },
      {
        item: 'Ambient Lighting LUX Measurement & Window Glare Assessment',
        category: 'LIGHTING',
        mandatory: false,
        verified: false,
        notes: 'Measure lux levels with curtains open and lights on for anti-glare display sizing.',
      },
      {
        item: 'Acoustic Reverberation (RT60) & HVAC Background Noise Floor',
        category: 'ACOUSTICS',
        mandatory: false,
        verified: false,
        notes: 'Inspect hard reflective surfaces (glass/tile) for beamforming microphone tuning.',
      },
    ];

    const technicalQuestions: SiteVisitIntelligence['technical_questions'] = [
      {
        question: 'What is the exact wall composition where the primary display will be mounted?',
        context: 'Determines whether heavy-duty expansion bolts or custom unistrut framing is required.',
        suggested_answer_type: 'CHOICE',
      },
      {
        question: 'Are concealed conduits already laid from the conference table to the display wall?',
        context: 'Determines if surface casing-capping or floor raceway must be quoted in the presales proposal.',
        suggested_answer_type: 'BOOLEAN',
      },
      {
        question: 'Is continuous online UPS power available at the equipment rack location?',
        context: 'Crucial for system reliability and warranty protection against voltage surges.',
        suggested_answer_type: 'BOOLEAN',
      },
      {
        question: 'What is the ceiling type and plenum height (False ceiling grid vs exposed slab)?',
        context: 'Determines ceiling microphone drop length and projector/speaker mounting hardware.',
        suggested_answer_type: 'TEXT',
      },
    ];

    const equipmentChecklist: SiteVisitIntelligence['equipment_checklist'] = [
      { tool_name: 'Digital Laser Distance Measure (Bosch GLM 50C)', purpose: 'High-precision room length, width, and ceiling height', mandatory: true, packed: true },
      { tool_name: 'Digital LUX Light Meter', purpose: 'Measure ambient lighting lux levels for display nit selection', mandatory: true, packed: true },
      { tool_name: 'Digital Multi-meter (Fluke 101)', purpose: 'Verify grounding and neutral-to-earth voltage', mandatory: true, packed: true },
      { tool_name: 'Stud & Pipe Detector (Wall Scanner)', purpose: 'Locate embedded rebar, live AC wires, and plumbing pipes', mandatory: true, packed: true },
      { tool_name: 'Sample HDMI 2.1 & Cat6 Patch Cable Reel', purpose: 'Test existing conduit pull-through clearance', mandatory: false, packed: true },
      { tool_name: 'Inspection Camera / Smartphone with Wide-Angle', purpose: 'Capture high-resolution conduit and ceiling photo logs', mandatory: true, packed: true },
    ];

    const intelligence: SiteVisitIntelligence = {
      id: `SVI-${visit.visitNumber || visit.id}-${Date.now()}`,
      site_visit_id: visit.id || `SV-${Date.now()}`,
      visit_number: visit.visitNumber || `SV260001`,
      enquiry_id: enq?.id,
      customer_id: enq?.customer_id,
      pre_visit_brief: {
        customer_overview: `${enq?.company_name || enq?.customer_name || 'Client'} presales site survey at ${address}.`,
        site_context: `Room Type: ${room}. Physical survey required to confirm dimensions, conduit pathways, and electrical readiness before commercial quotation.`,
        proposed_solution_overview: enq?.requirement_summary || `Turnkey installation of commercial hardware and low-voltage AV cabling.`,
        key_stakeholder: enq?.customer_name || 'Facility Manager / Project In-Charge',
        critical_measurement_focus: [
          'Wall-to-seating viewing distance (determines 75-inch vs 86-inch IFP selection)',
          'Conduit bend radius and pull box locations between table and wall',
          'Ceiling height and acoustic tile grid alignment',
        ],
      },
      requirement_checklist: requirementChecklist,
      technical_questions: technicalQuestions,
      equipment_checklist: equipmentChecklist,
      status: 'BRIEF_READY',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const idx = store.findIndex((s) => s.visit_number === intelligence.visit_number);
    if (idx >= 0) {
      store[idx] = intelligence;
    } else {
      store.push(intelligence);
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'GENERATE_PRE_VISIT_BRIEF',
      module: 'OPERATIONS_SITE_VISIT',
      details: `Generated AI Pre-Visit Brief and Equipment Checklist for Survey ${intelligence.visit_number}`,
    });

    return { success: true, data: intelligence };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to generate pre-visit brief' };
  }
}

export async function recordPostVisitFindings(
  visitIdOrNumber: string,
  findings: {
    room_dimensions: string;
    ambient_lux_level?: string;
    reverberation_notes?: string;
    conduit_and_cabling_readiness: string;
    power_and_grounding_readiness: string;
    mounting_surface_strength: string;
    technician_observations: string;
    checklist_updates?: Array<{ item: string; verified: boolean; notes?: string }>;
  }
): Promise<{ success: boolean; data?: SiteVisitIntelligence; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant']);
    const store = getSiteVisitIntelligenceStore();
    let intelligence = store.find((v) => v.site_visit_id === visitIdOrNumber || v.visit_number === visitIdOrNumber);

    if (!intelligence) {
      const briefRes = await generatePreVisitBrief(visitIdOrNumber);
      if (!briefRes.success || !briefRes.data) {
        return { success: false, error: 'Could not initialize site visit intelligence.' };
      }
      intelligence = briefRes.data;
    }

    intelligence.post_visit_summary = {
      room_dimensions: findings.room_dimensions,
      ambient_lux_level: findings.ambient_lux_level || '350 LUX (Standard Indoor Ambient)',
      reverberation_notes: findings.reverberation_notes || 'Moderate echo; acoustic panels recommended on rear wall.',
      conduit_and_cabling_readiness: findings.conduit_and_cabling_readiness,
      power_and_grounding_readiness: findings.power_and_grounding_readiness,
      mounting_surface_strength: findings.mounting_surface_strength,
      technician_observations: findings.technician_observations,
    };

    if (findings.checklist_updates && findings.checklist_updates.length > 0) {
      findings.checklist_updates.forEach((update) => {
        const item = intelligence!.requirement_checklist.find((c) => c.item === update.item);
        if (item) {
          item.verified = update.verified;
          if (update.notes) item.notes = update.notes;
        }
      });
    }

    intelligence.status = 'SURVEYED';
    intelligence.updated_at = new Date().toISOString();

    await logAuditEvent({
      userName: authUser.name,
      action: 'RECORD_SITE_VISIT_FINDINGS',
      module: 'OPERATIONS_SITE_VISIT',
      details: `Recorded post-visit survey findings for ${intelligence.visit_number}: ${findings.room_dimensions}, ${findings.mounting_surface_strength}`,
    });

    return { success: true, data: intelligence };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to record site visit findings' };
  }
}

export async function extractVisitRequirements(
  visitIdOrNumber: string
): Promise<{ success: boolean; data?: SiteVisitIntelligence; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const store = getSiteVisitIntelligenceStore();
    const intelligence = store.find((v) => v.site_visit_id === visitIdOrNumber || v.visit_number === visitIdOrNumber);

    if (!intelligence || !intelligence.post_visit_summary) {
      return { success: false, error: 'Survey findings must be recorded before extracting requirements.' };
    }

    const sum = intelligence.post_visit_summary;
    const extracted: SiteVisitIntelligence['extracted_requirements'] = [
      {
        component: 'Commercial Display / Interactive Panel',
        specification: `Sized for ${sum.room_dimensions}. Anti-glare coating verified against ${sum.ambient_lux_level}. Heavy-duty bracket for ${sum.mounting_surface_strength}.`,
        quantity_estimate: 1,
        readiness_prerequisite: sum.mounting_surface_strength.includes('Reinforcement') ? 'Client must install wooden backing ply before mounting' : 'Direct masonry anchors verified',
      },
      {
        component: 'Structured Low-Voltage Cabling & Conduit Kit',
        specification: `High-speed 4K HDMI 2.1 & Cat6 UTP cabling. Pathway: ${sum.conduit_and_cabling_readiness}.`,
        quantity_estimate: 1,
        readiness_prerequisite: sum.conduit_and_cabling_readiness.includes('Casing') ? 'Surface casing-capping required' : 'Conduit pull wires ready',
      },
      {
        component: 'Electrical & Surge Protection Interface',
        specification: `Isolated electrical distribution. Grounding status: ${sum.power_and_grounding_readiness}.`,
        quantity_estimate: 1,
        readiness_prerequisite: 'Dedicated 16A UPS line at display location',
      },
    ];

    if (sum.reverberation_notes && sum.reverberation_notes.toLowerCase().includes('acoustic')) {
      extracted.push({
        component: 'Acoustic Absorption Treatment Panels',
        specification: 'Fabric-wrapped sound absorption panels (NRC 0.85) to mitigate boardroom echo.',
        quantity_estimate: 4,
        readiness_prerequisite: 'Mounting on rear brick wall',
      });
    }

    intelligence.extracted_requirements = extracted;
    intelligence.status = 'SYNTHESIZED';
    intelligence.updated_at = new Date().toISOString();

    await logAuditEvent({
      userName: authUser.name,
      action: 'EXTRACT_SITE_VISIT_REQUIREMENTS',
      module: 'OPERATIONS_SITE_VISIT',
      details: `Extracted ${extracted.length} technical bill-of-materials requirements from survey ${intelligence.visit_number}`,
    });

    return { success: true, data: intelligence };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to extract site visit requirements' };
  }
}

export async function applyVisitFindingsToEnquiry(
  visitIdOrNumber: string,
  confirmedBy: string
): Promise<{ success: boolean; data?: SiteVisitIntelligence; enquiry_id?: string; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    if (!confirmedBy || confirmedBy.trim().length === 0) {
      return { success: false, error: 'Human confirmation is required to sync site visit findings into the commercial enquiry.' };
    }

    const store = getSiteVisitIntelligenceStore();
    const intelligence = store.find((v) => v.site_visit_id === visitIdOrNumber || v.visit_number === visitIdOrNumber);

    if (!intelligence || !intelligence.extracted_requirements) {
      return { success: false, error: 'Extracted requirements not found. Please extract requirements first.' };
    }

    // Correlate with enquiry
    const { enquiries } = await getEnquiries();
    let enquiry = enquiries.find((e) => e.id === intelligence.enquiry_id || `SV-${e.enquiry_number}` === intelligence.site_visit_id);

    if (!enquiry) {
      // Find by visitNumber match
      enquiry = enquiries.find((e) => e.site_visit?.visitNumber === intelligence.visit_number);
    }

    if (!enquiry) {
      return { success: false, error: 'Linked presales enquiry not found for this site visit.' };
    }

    // Append findings into enquiry requirement summary and notes
    const formattedExtracted = intelligence.extracted_requirements
      .map((r) => `- ${r.component} (Qty: ${r.quantity_estimate}): ${r.specification}`)
      .join('\n');

    const updatedSummary = `${enquiry.requirement_summary}\n\n[Site Survey Verified by ${confirmedBy} on ${new Date().toISOString().split('T')[0]}]:\nRoom: ${intelligence.post_visit_summary?.room_dimensions || 'Verified'}\n${formattedExtracted}`;

    enquiry.requirement_summary = updatedSummary;
    enquiry.status = 'Site Visit Scheduled'; // confirmed survey
    if (!enquiry.notes) enquiry.notes = [];
    enquiry.notes.push({
      text: `Site survey ${intelligence.visit_number} completed and synchronized by ${confirmedBy}. Bill of quantities verified.`,
      author: confirmedBy,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    });

    intelligence.status = 'CONVERTED';
    intelligence.converted_to_enquiry_at = new Date().toISOString();
    intelligence.updated_at = new Date().toISOString();

    await logAuditEvent({
      userName: authUser.name,
      action: 'APPLY_SITE_VISIT_TO_ENQUIRY',
      module: 'OPERATIONS_SITE_VISIT',
      details: `Synchronized site survey ${intelligence.visit_number} findings into Enquiry ${enquiry.enquiry_number} (Confirmed by ${confirmedBy})`,
    });

    return {
      success: true,
      data: intelligence,
      enquiry_id: enquiry.id,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to apply site visit findings to enquiry' };
  }
}

