'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { INITIAL_DISPATCHES } from '@/lib/constants/erp-data';
import { getEnquiries, updateEnquiryStatus } from '@/lib/actions/enquiries';
import { getOrdersStore } from '@/lib/actions/orders';
import { getNextDispatchNumber } from '@/lib/utils/sequence';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import type { Dispatch, SiteVisitDetails, Installation, EnquiryStatus, SiteVisitIntelligence } from '@/types/erp';

// Shared in-memory store across requests in this Node process
declare global {
  // eslint-disable-next-line no-var
  var __ICON_DISPATCHES__: Dispatch[] | undefined;
}

function getDispatchesStore(): Dispatch[] {
  if (!globalThis.__ICON_DISPATCHES__) {
    globalThis.__ICON_DISPATCHES__ = [...INITIAL_DISPATCHES];
  }
  return globalThis.__ICON_DISPATCHES__;
}

export async function getSiteVisits(): Promise<SiteVisitDetails[]> {
  const { enquiries } = await getEnquiries();
  const visits: SiteVisitDetails[] = [];

  for (const enq of enquiries) {
    if (enq.site_visit_required || enq.site_visit) {
      visits.push({
        id: `SV-${enq.enquiry_number}`,
        visitNumber: `SV26000${visits.length + 1}`,
        required: true,
        siteAddress: enq.site_visit?.siteAddress || `${enq.company_name || enq.customer_name} Site, Hyderabad`,
        roomType: enq.site_visit?.roomType || 'Commercial / Residential Hall',
        measurements: enq.site_visit?.measurements || 'Standard Room Dimensions',
        scheduledDate: enq.site_visit?.scheduledDate || enq.created_at.split('T')[0],
        completedDate: enq.site_visit?.completedDate,
        assignedTechnician: enq.site_visit?.assignedTechnician || enq.salesperson_name || 'Nagaraju / Dheeraj',
        status: enq.status === 'Quotation sent' || enq.status === 'Order done' ? 'COMPLETED' : 'SCHEDULED',
        notes: enq.site_visit?.notes || enq.requirement_summary,
      });
    }
  }

  return visits;
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
  assignedTechnician?: string;
  siteAddress?: string;
  roomType?: string;
  measurements?: string;
  notes?: string;
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

    if (!target) {
      return { success: false, error: 'Site visit record not found' };
    }

    if (!target.site_visit) {
      target.site_visit = {
        id: `SV-${target.enquiry_number}`,
        visitNumber: `SV-${target.enquiry_number}`,
        required: true,
      };
    }

    if (payload.scheduledDate !== undefined) target.site_visit.scheduledDate = payload.scheduledDate;
    if (payload.assignedTechnician !== undefined) target.site_visit.assignedTechnician = payload.assignedTechnician;
    if (payload.siteAddress !== undefined) target.site_visit.siteAddress = payload.siteAddress;
    if (payload.roomType !== undefined) target.site_visit.roomType = payload.roomType;
    if (payload.measurements !== undefined) target.site_visit.measurements = payload.measurements;
    if (payload.notes !== undefined) target.site_visit.notes = payload.notes;
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
        await admin
          .from('enquiries')
          .update({
            site_visit_required: true,
            updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${target.id},enquiry_number.eq.${target.enquiry_number}`);
      } catch (err) {
        console.warn('Supabase updateSiteVisit sync failed, using store:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_SITE_VISIT',
      module: 'OPERATIONS',
      details: `Updated site visit ${payload.visitId} for ${target.customer_name} (Tech: ${target.site_visit.assignedTechnician}, Date: ${target.site_visit.scheduledDate})`,
    });

    revalidatePath('/dashboard/site-visits');
    revalidatePath('/dashboard/enquiries');
    revalidatePath('/dashboard');
    return { success: true, data: target.site_visit };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update site visit' };
  }
}


export async function getDispatches(): Promise<Dispatch[]> {
  const store = getDispatchesStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.from('dispatches').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
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
      dispatch_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    store.unshift(dispatch);

    // Link dispatch and update distinct fulfillment/dispatch status on linked Sales Order
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
    const store = getDispatchesStore();
    const dsp = store.find(
      (d) => d.id === dispatchId || d.dispatch_number === dispatchId || d.delivery_challan_number === dispatchId
    );
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

    // If linked to an order and delivered/confirmed, update order dispatch status
    if (dsp.order_number) {
      const ordersStore = await getOrdersStore();
      const order = ordersStore.find((o) => o.order_number === dsp.order_number || o.id === dsp.order_number);
      if (order && newStatus === 'POD Confirmed') {
        order.dispatch_status = 'Installed & Handed Over';
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
      const supabase = await createClient();
      let query = supabase.from('installations').select('*').order('scheduled_date', { ascending: false });

      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters?.search) {
        const s = filters.search.trim();
        query = query.or(`installation_number.ilike.%${s}%,customer_name.ilike.%${s}%,order_number.ilike.%${s}%`);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
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

    const newInstallation: Installation = {
      id: `INS-${Date.now()}`,
      installation_number: insNumber,
      order_id: payload.order_id,
      order_number: payload.order_number,
      customer_id: payload.customer_id,
      customer_name: payload.customer_name,
      lead_technician_name: payload.lead_technician_name || 'Technical Support Team',
      scheduled_date: payload.scheduled_date,
      status: 'SCHEDULED',
      handover_status: 'PENDING_HANDOVER',
      site_address: payload.site_address || 'Customer Premises, Hyderabad',
      site_contact_person: payload.site_contact_person,
      site_contact_phone: payload.site_contact_phone,
      installed_products: payload.installed_products || [],
      checklist: defaultChecklist,
      remarks: payload.remarks,
      created_at: new Date().toISOString(),
    };

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data: dbIns, error: insErr } = await admin
          .from('installations')
          .insert({
            installation_number: newInstallation.installation_number,
            order_id: newInstallation.order_id || null,
            order_number: newInstallation.order_number || null,
            customer_id: newInstallation.customer_id,
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
    const found = store.find((i) => i.id === id || i.installation_number === id);

    if (found) {
      if (updates.status) found.status = updates.status;
      if (updates.checklist) found.checklist = updates.checklist;
      if (updates.installed_products) found.installed_products = updates.installed_products;
      if (updates.handover_notes) found.handover_notes = updates.handover_notes;
      if (updates.remarks) found.remarks = updates.remarks;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('installations').update(updates).or(`id.eq.${id},installation_number.eq.${id}`);
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
    const found = store.find((i) => i.id === id || i.installation_number === id);

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
      if (serialsStore) {
        found.installed_products.forEach((prod) => {
          if (prod.serial_number) {
            const serialRecord = serialsStore.find((s) => s.serial_number === prod.serial_number);
            if (serialRecord) {
              serialRecord.status = 'INSTALLED';
              serialRecord.installation_id = found.id;
              serialRecord.installation_number = found.installation_number;
              serialRecord.warranty_start_date = signoff.customer_signoff_date;
              const start = new Date(signoff.customer_signoff_date);
              start.setMonth(start.getMonth() + (serialRecord.warranty_duration_months || 12));
              serialRecord.warranty_end_date = start.toISOString().split('T')[0];
            }
          }
        });
      }
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('installations')
          .update({
            status: 'COMPLETED',
            completed_date: signoff.customer_signoff_date,
            customer_signoff_by: signoff.customer_signoff_by,
            customer_signoff_date: signoff.customer_signoff_date,
            handover_status: 'HANDED_OVER',
            handover_notes: signoff.handover_notes || found.handover_notes,
          })
          .or(`id.eq.${id},installation_number.eq.${id}`);
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

