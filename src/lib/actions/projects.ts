'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { canViewPurchaseCosts } from '@/lib/utils/margin';
import type { Project, ProjectMilestone, ProjectStatus, MilestoneStatus, ProjectType } from '@/types/erp';

// Initial Project Demo Records
const INITIAL_PROJECTS: Project[] = [
  {
    id: 'PRJ260001',
    project_number: 'PRJ/2026-27/0001',
    project_name: 'Executive Boardroom AV & Telepresence Integration',
    project_type: 'Conference Room',
    customer_id: 'ICON260001',
    customer_name: 'T-Hub Foundation',
    enquiry_id: 'ENQ260001',
    site_visit_id: 'SV260001',
    quotation_id: 'QT-1099',
    sales_order_id: 'ORD260001',
    lead_engineer_name: 'Vamshi Krishna',
    status: 'In Execution',
    total_project_value: 372000,
    total_cost: 265000,
    margin_pct: 28.8,
    start_date: '2026-09-05',
    target_completion_date: '2026-09-25',
    notes: '86" Interactive display, all-in-one tracking video bar, motorized cable cubby.',
    created_at: '2026-09-05T10:00:00Z',
    milestones: [
      {
        id: 'MS-001',
        project_id: 'PRJ260001',
        milestone_number: 1,
        title: 'Advance & Procurement Mobilization (40%)',
        description: 'Received upon approval of detailed engineering design.',
        percentage: 40,
        amount: 148800,
        due_date: '2026-09-06',
        status: 'Paid',
        invoice_number: 'ICON/26-27/INV-0001',
        completed_at: '2026-09-06T14:30:00Z',
        created_at: '2026-09-05T10:00:00Z',
      },
      {
        id: 'MS-002',
        project_id: 'PRJ260001',
        milestone_number: 2,
        title: 'Material Delivery & First-Fix Cabling (40%)',
        description: 'Physical equipment delivered to site and conduit pull completed.',
        percentage: 40,
        amount: 148800,
        due_date: '2026-09-18',
        status: 'In Progress',
        created_at: '2026-09-05T10:00:00Z',
      },
      {
        id: 'MS-003',
        project_id: 'PRJ260001',
        milestone_number: 3,
        title: 'Commissioning, Handover & Sign-Off (20%)',
        description: 'Testing, audio calibration and customer acceptance job card handover.',
        percentage: 20,
        amount: 74400,
        due_date: '2026-09-25',
        status: 'Pending',
        created_at: '2026-09-05T10:00:00Z',
      },
    ],
  },
  {
    id: 'PRJ260002',
    project_number: 'PRJ/2026-27/0002',
    project_name: 'Dolby Atmos 7.1.4 Reference Private Cinema',
    project_type: 'Home Theater',
    customer_id: 'ICON260003',
    customer_name: 'Rajesh Verma (Jubilee Hills)',
    enquiry_id: 'ENQ260003',
    site_visit_id: 'SV260002',
    lead_engineer_name: 'K. Shiva Kumar',
    status: 'Costing & Quote',
    total_project_value: 485000,
    total_cost: 345000,
    margin_pct: 28.9,
    start_date: '2026-09-10',
    target_completion_date: '2026-10-15',
    notes: 'Laser UST Projector, 120" ALR screen, architectural in-wall speakers, acoustic paneling.',
    created_at: '2026-09-10T11:00:00Z',
    milestones: [
      {
        id: 'MS-004',
        project_id: 'PRJ260002',
        milestone_number: 1,
        title: 'Mobilization & Acoustic Framing Advance (50%)',
        percentage: 50,
        amount: 242500,
        due_date: '2026-09-15',
        status: 'Pending',
        created_at: '2026-09-10T11:00:00Z',
      },
      {
        id: 'MS-005',
        project_id: 'PRJ260002',
        milestone_number: 2,
        title: 'AV Equipment Installation (30%)',
        percentage: 30,
        amount: 145500,
        due_date: '2026-10-01',
        status: 'Pending',
        created_at: '2026-09-10T11:00:00Z',
      },
      {
        id: 'MS-006',
        project_id: 'PRJ260002',
        milestone_number: 3,
        title: 'Acoustic Tuning & Handover (20%)',
        percentage: 20,
        amount: 97000,
        due_date: '2026-10-15',
        status: 'Pending',
        created_at: '2026-09-10T11:00:00Z',
      },
    ],
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __ICON_PROJECTS__: Project[] | undefined;
}

function getProjectsStore(): Project[] {
  if (!globalThis.__ICON_PROJECTS__) {
    globalThis.__ICON_PROJECTS__ = [...INITIAL_PROJECTS];
  }
  return globalThis.__ICON_PROJECTS__;
}

export async function getProjects(filters?: {
  status?: string;
  search?: string;
  customer_id?: string;
}): Promise<{ projects: Project[]; total: number }> {
  const store = getProjectsStore();

  const { getAuthenticatedUser } = await import('@/lib/auth/session');
  const user = await getAuthenticatedUser();
  const canSeeCost = canViewPurchaseCosts(user?.role || '');

  const sanitizeProject = (p: Project): Project => {
    if (canSeeCost) return p;
    return {
      ...p,
      total_cost: 0,
      margin_pct: 0,
    };
  };

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      let query = supabase.from('projects').select('*, milestones:project_milestones(*)', { count: 'exact' });

      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters?.search) {
        const s = filters.search.trim();
        query = query.or(`project_number.ilike.%${s}%,project_name.ilike.%${s}%,customer_name.ilike.%${s}%`);
      }

      query = query.order('created_at', { ascending: false });
      const { data, error, count } = await query;

      if (!error && data && data.length > 0) {
        return {
          projects: (data as Project[]).map(sanitizeProject),
          total: count ?? data.length,
        };
      }
    } catch (err) {
      console.warn('Supabase projects query failed, using in-memory store:', err);
    }
  }

  let list = store.map(sanitizeProject);
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((p) => p.status === filters.status);
  }
  if (filters?.customer_id) {
    list = list.filter((p) => p.customer_id === filters.customer_id);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase().trim();
    list = list.filter(
      (p) =>
        p.project_number.toLowerCase().includes(s) ||
        p.project_name.toLowerCase().includes(s) ||
        p.customer_name.toLowerCase().includes(s)
    );
  }

  return { projects: list, total: list.length };
}

export async function getProjectById(id: string): Promise<Project | null> {
  const { projects } = await getProjects();
  return projects.find((p) => p.id === id || p.project_number === id) || null;
}

export async function createProject(payload: {
  project_name: string;
  project_type: ProjectType;
  customer_id: string;
  customer_name: string;
  enquiry_id?: string;
  site_visit_id?: string;
  quotation_id?: string;
  sales_order_id?: string;
  lead_engineer_name?: string;
  total_project_value: number;
  total_cost?: number;
  margin_pct?: number;
  start_date?: string;
  target_completion_date?: string;
  notes?: string;
  milestones?: Array<{
    milestone_number?: number;
    title: string;
    description?: string;
    percentage: number;
    amount: number;
    due_date?: string;
    status?: MilestoneStatus;
  }>;
}): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const store = getProjectsStore();

    const seq = (store.length + 1).toString().padStart(4, '0');
    const projectNumber = `PRJ/2026-27/${seq}`;
    const projectId = `PRJ-${Date.now()}`;

    const cost = payload.total_cost || 0;
    const val = payload.total_project_value || 0;
    const margin = val > 0 ? Number((((val - cost) / val) * 100).toFixed(1)) : 0;

    const milestones: ProjectMilestone[] = (payload.milestones || []).map((m, idx) => ({
      id: `MS-${Date.now()}-${idx + 1}`,
      project_id: projectId,
      milestone_number: m.milestone_number || idx + 1,
      title: m.title,
      description: m.description,
      percentage: m.percentage,
      amount: m.amount,
      due_date: m.due_date,
      status: m.status || 'Pending',
      created_at: new Date().toISOString(),
    }));

    const newProject: Project = {
      id: projectId,
      project_number: projectNumber,
      project_name: payload.project_name,
      project_type: payload.project_type,
      customer_id: payload.customer_id,
      customer_name: payload.customer_name,
      enquiry_id: payload.enquiry_id,
      site_visit_id: payload.site_visit_id,
      quotation_id: payload.quotation_id,
      sales_order_id: payload.sales_order_id,
      lead_engineer_name: payload.lead_engineer_name || 'Vamshi Krishna',
      status: 'Planning',
      total_project_value: val,
      total_cost: cost,
      margin_pct: margin,
      start_date: payload.start_date || new Date().toISOString().split('T')[0],
      target_completion_date: payload.target_completion_date,
      notes: payload.notes,
      milestones,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    store.unshift(newProject);

    await logAuditEvent({
      userName: authUser.name,
      action: 'PROJECT_CREATED',
      module: 'OPERATIONS',
      details: `Created Project ${projectNumber} (${payload.project_name}) for customer ${payload.customer_name} valued at ₹${val.toLocaleString('en-IN')}`,
    });

    // Supabase persistence when available
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('projects').insert([
          {
            id: newProject.id,
            project_number: newProject.project_number,
            project_name: newProject.project_name,
            project_type: newProject.project_type,
            customer_name: newProject.customer_name,
            enquiry_id: newProject.enquiry_id,
            site_visit_id: newProject.site_visit_id,
            quotation_id: newProject.quotation_id,
            sales_order_id: newProject.sales_order_id,
            lead_engineer_name: newProject.lead_engineer_name,
            status: newProject.status,
            total_project_value: newProject.total_project_value,
            total_cost: newProject.total_cost,
            margin_pct: newProject.margin_pct,
            start_date: newProject.start_date,
            target_completion_date: newProject.target_completion_date,
            notes: newProject.notes,
          },
        ]);

        if (milestones.length > 0) {
          await admin.from('project_milestones').insert(
            milestones.map((m) => ({
              id: m.id,
              project_id: m.project_id,
              milestone_number: m.milestone_number,
              title: m.title,
              description: m.description,
              percentage: m.percentage,
              amount: m.amount,
              due_date: m.due_date,
              status: m.status,
            }))
          );
        }
      } catch (dbErr) {
        console.warn('Failed to insert project into Supabase:', dbErr);
      }
    }

    revalidatePath('/dashboard/projects');
    return { success: true, data: newProject };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create project' };
  }
}

export async function updateProjectStatus(
  projectId: string,
  newStatus: ProjectStatus
): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant']);
    const store = getProjectsStore();
    const proj = store.find((p) => p.id === projectId || p.project_number === projectId);

    if (!proj) {
      return { success: false, error: 'Project not found.' };
    }

    const prev = proj.status;
    proj.status = newStatus;
    proj.updated_at = new Date().toISOString();

    if (newStatus === 'Completed') {
      proj.actual_completion_date = new Date().toISOString().split('T')[0];
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'PROJECT_STATUS_UPDATED',
      module: 'OPERATIONS',
      details: `Updated Project ${proj.project_number} status from ${prev} to ${newStatus}`,
    });

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('projects').update({ status: newStatus, updated_at: proj.updated_at }).eq('id', proj.id);
      } catch {}
    }

    revalidatePath('/dashboard/projects');
    return { success: true, data: proj };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update project status' };
  }
}

export async function updateMilestoneStatus(
  arg1: string,
  arg2: string,
  arg3?: string,
  arg4?: string
): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts', 'Sales Executive']);
    const store = getProjectsStore();

    let milestoneId: string;
    let status: MilestoneStatus;
    let invoiceId: string | undefined;
    let invoiceNumber: string | undefined;

    if (arg3 && ['Pending', 'In Progress', 'Completed', 'Invoiced', 'Paid'].includes(arg3)) {
      milestoneId = arg2;
      status = arg3 as MilestoneStatus;
    } else {
      milestoneId = arg1;
      status = arg2 as MilestoneStatus;
      invoiceId = arg3;
      invoiceNumber = arg4;
    }

    let targetProj: Project | undefined;
    for (const p of store) {
      const ms = (p.milestones || []).find((m) => m.id === milestoneId);
      if (ms) {
        targetProj = p;
        ms.status = status;
        if (invoiceId) ms.invoice_id = invoiceId;
        if (invoiceNumber) ms.invoice_number = invoiceNumber;
        if (status === 'Completed' || status === 'Paid') {
          ms.completed_at = new Date().toISOString();
        }

        await logAuditEvent({
          userName: authUser.name,
          action: 'PROJECT_MILESTONE_UPDATED',
          module: 'FINANCE',
          details: `Updated milestone "${ms.title}" on Project ${p.project_number} to ${status}`,
        });

        if (await isSupabaseAvailable()) {
          try {
            const admin = createAdminClient();
            await admin.from('project_milestones').update({
              status,
              invoice_id: invoiceId || null,
              invoice_number: invoiceNumber || null,
              completed_at: ms.completed_at || null,
            }).eq('id', ms.id);
          } catch {}
        }
        break;
      }
    }

    revalidatePath('/dashboard/projects');
    return { success: true, data: targetProj };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update milestone status' };
  }
}
