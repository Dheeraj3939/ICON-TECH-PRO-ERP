'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { findByIdOrCode, isUuid, sanitizeSearchTerm, sanitizeUuid } from '@/lib/supabase/db-helpers';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { canViewPurchaseCosts } from '@/lib/utils/margin';
import type {
  Project,
  ProjectMilestone,
  ProjectStatus,
  MilestoneStatus,
  ProjectType,
  FileSalesStatus,
  FileFulfilmentStatus,
  FileFinancialStatus,
  FileClosureCategory,
  FileClosureReason,
  FileDepartmentOwner,
  CustomerPurchaseOrder,
  FileReopenRequest,
  FileOwnershipTransfer,
} from '@/types/erp';

// Initial Project / Open File Records reflecting real ICON TECH PRO business operations
const INITIAL_PROJECTS: Project[] = [
  {
    id: 'PRJ260001',
    project_number: 'FILE-2026-0001',
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
    sales_status: 'Order Confirmed',
    fulfilment_status: 'Installation in Progress',
    financial_status: 'Partially Invoiced',
    file_owner_id: 'USR-SALES-001',
    file_owner_name: 'B Vineet Babu',
    department_owner: 'Technical',
    accounts_owner_name: 'Hemalath',
    has_confirmed_order: true,
    has_financial_commitments: true,
    total_project_value: 372000,
    total_cost: 265000,
    margin_pct: 28.8,
    start_date: '2026-09-05',
    target_completion_date: '2026-09-25',
    notes: '86" Interactive display, all-in-one tracking video bar, motorized cable cubby.',
    created_at: '2026-09-05T10:00:00Z',
    customer_pos: [
      {
        id: 'CPO-26001',
        file_id: 'PRJ260001',
        customer_id: 'ICON260001',
        po_number: 'THUB-PO-2026-0412',
        po_date: '2026-09-04',
        po_value: 372000,
        payment_terms: '30 Days',
        payment_trigger: 'DELIVERY_DATE',
        status: 'VERIFIED_BY_ACCOUNTS',
        created_at: '2026-09-04T12:00:00Z',
      },
    ],
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
    project_number: 'FILE-2026-0002',
    project_name: 'Dolby Atmos 7.1.4 Reference Private Cinema',
    project_type: 'Home Theater',
    customer_id: 'ICON260003',
    customer_name: 'Rajesh Verma (Jubilee Hills)',
    enquiry_id: 'ENQ260003',
    site_visit_id: 'SV260002',
    lead_engineer_name: 'K. Shiva Kumar',
    status: 'Costing & Quote',
    sales_status: 'Quotation Sent',
    fulfilment_status: 'Not Started',
    financial_status: 'No Financial Activity',
    file_owner_id: 'USR-SALES-002',
    file_owner_name: 'B V Dheeraj Reddy',
    department_owner: 'Sales',
    accounts_owner_name: 'Hemalath',
    has_confirmed_order: false,
    has_financial_commitments: false,
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
  {
    id: 'PRJ260003',
    project_number: 'FILE-2026-0003',
    project_name: 'Smart Classrooms Interactive Panels (Phase 1)',
    project_type: 'Interactive Displays',
    customer_id: 'ICON260002',
    customer_name: 'Tech Mahindra SEZ Unit',
    status: 'Procurement',
    sales_status: 'Customer PO Received',
    fulfilment_status: 'Awaiting Procurement',
    financial_status: 'Awaiting Customer Invoice',
    file_owner_id: 'USR-SALES-003',
    file_owner_name: 'Reshma',
    department_owner: 'Accounts',
    accounts_owner_name: 'Hemalath',
    has_confirmed_order: true,
    has_financial_commitments: true,
    total_project_value: 640000,
    total_cost: 480000,
    margin_pct: 25.0,
    start_date: '2026-10-15',
    target_completion_date: '2026-11-20',
    notes: '4x 75-inch 4K UHD Interactive Panels with OPS Windows PC modules and mobile motorized trolleys.',
    created_at: '2026-10-15T09:30:00Z',
    customer_pos: [
      {
        id: 'CPO-26002',
        file_id: 'PRJ260003',
        customer_id: 'ICON260002',
        po_number: 'TM-PO-2026-9921',
        po_date: '2026-10-15',
        po_value: 640000,
        payment_terms: '30 Days',
        payment_trigger: 'DELIVERY_DATE',
        status: 'VERIFIED_BY_ACCOUNTS',
        created_at: '2026-10-15T10:00:00Z',
      },
    ],
  },
  {
    id: 'PRJ260004',
    project_number: 'FILE-2026-0004',
    project_name: 'Outdoor Campus CCTV Surveillance',
    project_type: 'CCTV',
    customer_id: 'ICON260004',
    customer_name: 'Apex Infotech Solutions',
    status: 'Cancelled',
    sales_status: 'Lost',
    fulfilment_status: 'Cancelled',
    financial_status: 'Closed',
    file_owner_id: 'USR-SALES-001',
    file_owner_name: 'B Vineet Babu',
    department_owner: 'Sales',
    accounts_owner_name: 'Hemalath',
    has_confirmed_order: false,
    has_financial_commitments: false,
    closure_category: 'Lost Enquiry',
    closure_reason: 'Requirement Not Needed',
    closure_explanation: 'Client management deferred outdoor perimeter security to next financial year.',
    closed_at: '2026-10-20T14:00:00Z',
    closed_by: 'B Vineet Babu',
    total_project_value: 185000,
    total_cost: 130000,
    margin_pct: 29.7,
    created_at: '2026-10-01T10:00:00Z',
  },
  {
    id: 'PRJ260005',
    project_number: 'FILE-2026-0005',
    project_name: 'Turnkey Boardroom Display Setup',
    project_type: 'AV Solutions',
    customer_id: 'ICON260001',
    customer_name: 'T-Hub Foundation',
    status: 'Completed',
    sales_status: 'Order Confirmed',
    fulfilment_status: 'Fulfilment Completed',
    financial_status: 'Financially Settled',
    file_owner_id: 'USR-SALES-003',
    file_owner_name: 'Reshma',
    department_owner: 'Accounts',
    accounts_owner_name: 'Hemalath',
    has_confirmed_order: true,
    has_financial_commitments: true,
    is_ready_for_closure: true,
    total_project_value: 295000,
    total_cost: 210000,
    margin_pct: 28.8,
    created_at: '2026-08-15T10:00:00Z',
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

/**
 * Retrieve all Open Files / Projects with comprehensive multi-dimensional filtering.
 */
export async function getProjects(filters?: {
  status?: string;
  sales_status?: string;
  fulfilment_status?: string;
  financial_status?: string;
  department_owner?: string;
  file_owner_id?: string;
  search?: string;
  customer_id?: string;
  ready_for_closure?: boolean;
  closure_category?: string;
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
      const admin = createAdminClient();
      let query = admin.from('projects').select('*, milestones:project_milestones(*)', { count: 'exact' });

      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters?.sales_status && filters.sales_status !== 'ALL') {
        query = query.eq('sales_status', filters.sales_status);
      }
      if (filters?.fulfilment_status && filters.fulfilment_status !== 'ALL') {
        query = query.eq('fulfilment_status', filters.fulfilment_status);
      }
      if (filters?.financial_status && filters.financial_status !== 'ALL') {
        query = query.eq('financial_status', filters.financial_status);
      }
      if (filters?.department_owner && filters.department_owner !== 'ALL') {
        query = query.eq('department_owner', filters.department_owner);
      }
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters?.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) {
          query = query.or(`project_number.ilike.%${s}%,project_name.ilike.%${s}%,customer_name.ilike.%${s}%`);
        }
      }

      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;

      if (!error && data) {
        let rows = (data as Project[]).map(sanitizeProject);
        if (filters?.file_owner_id) {
          rows = rows.filter((p) => p.file_owner_id === filters.file_owner_id);
        }
        if (filters?.ready_for_closure !== undefined) {
          rows = rows.filter((p) => p.is_ready_for_closure === filters.ready_for_closure);
        }
        if (filters?.closure_category && filters.closure_category !== 'ALL') {
          rows = rows.filter((p) => p.closure_category === filters.closure_category);
        }
        return {
          projects: rows,
          total: rows.length,
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
  if (filters?.sales_status && filters.sales_status !== 'ALL') {
    list = list.filter((p) => p.sales_status === filters.sales_status);
  }
  if (filters?.fulfilment_status && filters.fulfilment_status !== 'ALL') {
    list = list.filter((p) => p.fulfilment_status === filters.fulfilment_status);
  }
  if (filters?.financial_status && filters.financial_status !== 'ALL') {
    list = list.filter((p) => p.financial_status === filters.financial_status);
  }
  if (filters?.department_owner && filters.department_owner !== 'ALL') {
    list = list.filter((p) => p.department_owner === filters.department_owner);
  }
  if (filters?.file_owner_id) {
    list = list.filter((p) => p.file_owner_id === filters.file_owner_id);
  }
  if (filters?.ready_for_closure !== undefined) {
    list = list.filter((p) => p.is_ready_for_closure === filters.ready_for_closure);
  }
  if (filters?.closure_category && filters.closure_category !== 'ALL') {
    list = list.filter((p) => p.closure_category === filters.closure_category);
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

async function findProjectRecord(idOrNumber: string): Promise<Project | null> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const row = await findByIdOrCode<Project>(
        admin,
        'projects',
        idOrNumber,
        'project_number',
        '*, milestones:project_milestones(*)'
      );
      if (row) return row;
      return null;
    } catch {
      // Fallback
    }
  }
  const store = getProjectsStore();
  return store.find((p) => p.id === idOrNumber || p.project_number === idOrNumber) || null;
}

export async function getProjectById(id: string): Promise<Project | null> {
  const found = await findProjectRecord(id);
  if (!found) return null;
  const { getAuthenticatedUser } = await import('@/lib/auth/session');
  const user = await getAuthenticatedUser();
  if (canViewPurchaseCosts(user?.role || '')) return found;
  return { ...found, total_cost: 0, margin_pct: 0 };
}

/**
 * Creates a new Open Customer Project File.
 * Assigns unique File ID and separates Sales, Fulfilment, and Financial statuses.
 */
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
  sales_status?: FileSalesStatus;
  fulfilment_status?: FileFulfilmentStatus;
  financial_status?: FileFinancialStatus;
  department_owner?: FileDepartmentOwner;
  accounts_owner_name?: string;
  supporting_employees?: string[];
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
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts']);
    const store = getProjectsStore();

    const seq = (store.length + 1).toString().padStart(4, '0');
    const projectNumber = `FILE-2026-${seq}`;
    const projectId = `FILE-${Date.now()}`;

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
      sales_status: payload.sales_status || 'New Lead',
      fulfilment_status: payload.fulfilment_status || 'Not Started',
      financial_status: payload.financial_status || 'No Financial Activity',
      file_owner_id: authUser.id,
      file_owner_name: authUser.name,
      department_owner: payload.department_owner || 'Sales',
      accounts_owner_name: payload.accounts_owner_name || 'Hemalath',
      supporting_employees: payload.supporting_employees || [],
      has_confirmed_order: false,
      has_financial_commitments: false,
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
      action: 'OPEN_FILE_CREATED',
      module: 'OPERATIONS',
      details: `Created Customer Project File ${projectNumber} (${payload.project_name}) for customer ${payload.customer_name}. Owner: ${authUser.name}`,
    });

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data: dbProj, error: projErr } = await admin
          .from('projects')
          .insert([
            {
              project_number: newProject.project_number,
              file_id: newProject.project_number,
              project_name: newProject.project_name,
              project_type: newProject.project_type,
              customer_id: sanitizeUuid(newProject.customer_id),
              customer_name: newProject.customer_name,
              enquiry_id: newProject.enquiry_id || null,
              site_visit_id: newProject.site_visit_id || null,
              quotation_id: newProject.quotation_id || null,
              sales_order_id: newProject.sales_order_id || null,
              lead_engineer_name: newProject.lead_engineer_name,
              status: newProject.status,
              sales_status: newProject.sales_status,
              fulfilment_status: newProject.fulfilment_status,
              financial_status: newProject.financial_status,
              file_owner_id: sanitizeUuid(newProject.file_owner_id),
              file_owner_name: newProject.file_owner_name,
              department_owner: newProject.department_owner,
              total_project_value: newProject.total_project_value,
              total_cost: newProject.total_cost,
              margin_pct: newProject.margin_pct,
              start_date: newProject.start_date,
              target_completion_date: newProject.target_completion_date || null,
              notes: newProject.notes || null,
            },
          ])
          .select('id')
          .single();

        if (!projErr && dbProj?.id) {
          newProject.id = dbProj.id;
          if (milestones.length > 0) {
            const msRows = milestones.map((m) => ({
              project_id: dbProj.id,
              milestone_number: m.milestone_number,
              title: m.title,
              description: m.description || null,
              percentage: m.percentage,
              amount: m.amount,
              due_date: m.due_date || null,
              status: m.status,
            }));
            const { data: insertedMs } = await admin
              .from('project_milestones')
              .insert(msRows)
              .select('*');
            if (Array.isArray(insertedMs)) {
              newProject.milestones = insertedMs as ProjectMilestone[];
            }
          }
        }
      } catch (dbErr) {
        console.warn('Failed to insert project into Supabase:', dbErr);
      }
    }

    revalidatePath('/dashboard/projects');
    return { success: true, data: newProject };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create project file' };
  }
}

/**
 * Updates the independent status dimensions of a project file.
 * Role-gated: Financial status is derived and restricted to Accounts / Admin.
 */
async function persistProjectFields(projectId: string, fields: Record<string, any>) {
  if (!(await isSupabaseAvailable())) return;
  try {
    const admin = createAdminClient();
    const query = admin.from('projects').update(fields);
    await (isUuid(projectId) ? query.eq('id', projectId) : query.eq('project_number', projectId));
  } catch (err) {
    console.warn('Supabase project update fallback:', err);
  }
}

export async function updateFileStatusDimensions(
  projectId: string,
  updates: {
    sales_status?: FileSalesStatus;
    fulfilment_status?: FileFulfilmentStatus;
    financial_status?: FileFinancialStatus;
    department_owner?: FileDepartmentOwner;
    notes?: string;
  }
): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts']);
    const file = await findProjectRecord(projectId);

    if (!file) {
      return { success: false, error: 'Project file not found.' };
    }

    // Role gate on financial status: Sales cannot arbitrarily edit financial status
    if (updates.financial_status && updates.financial_status !== file.financial_status) {
      if (!['Managing Director', 'Admin / BDM', 'Accounts'].includes(authUser.role)) {
        return {
          success: false,
          error: 'Financial status is derived from verified accounting information and restricted to Accounts & Admin.',
        };
      }
      file.financial_status = updates.financial_status;
    }

    if (updates.sales_status) {
      file.sales_status = updates.sales_status;
    }
    if (updates.fulfilment_status) {
      file.fulfilment_status = updates.fulfilment_status;
    }
    if (updates.department_owner) {
      file.department_owner = updates.department_owner;
    }
    if (updates.notes) {
      file.notes = (file.notes ? `${file.notes}\n` : '') + `[${new Date().toISOString().split('T')[0]}] ${updates.notes}`;
    }

    // Check if ready for closure
    file.is_ready_for_closure =
      file.fulfilment_status === 'Fulfilment Completed' &&
      file.financial_status === 'Financially Settled';

    file.updated_at = new Date().toISOString();

    await persistProjectFields(file.id, {
      sales_status: file.sales_status,
      fulfilment_status: file.fulfilment_status,
      financial_status: file.financial_status,
      department_owner: file.department_owner,
      notes: file.notes || null,
      is_ready_for_closure: file.is_ready_for_closure,
      updated_at: file.updated_at,
    });

    await logAuditEvent({
      userName: authUser.name,
      action: 'FILE_STATUS_DIMENSIONS_UPDATED',
      module: 'OPERATIONS',
      details: `Updated File ${file.project_number} statuses - Sales: ${file.sales_status}, Fulfilment: ${file.fulfilment_status}, Financial: ${file.financial_status}, Next Dept: ${file.department_owner}`,
    });

    revalidatePath('/dashboard/projects');
    return { success: true, data: file };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update file statuses' };
  }
}

/**
 * Closes an Open File with strict business criteria:
 * - Lost Enquiry (e.g. Requirement Not Needed) can close immediately if no PO/order/commitments exist.
 * - Confirmed orders MUST have fulfilment completed AND financial transactions settled before closing.
 */
export async function closeProjectFile(
  projectId: string,
  payload: {
    category: FileClosureCategory;
    reason: FileClosureReason;
    explanation?: string;
  }
): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts']);
    const file = await findProjectRecord(projectId);

    if (!file) {
      return { success: false, error: 'Project file not found.' };
    }

    if (payload.reason === 'Other' && (!payload.explanation || payload.explanation.trim().length < 5)) {
      return { success: false, error: 'Explanation is mandatory when closure reason is "Other".' };
    }

    // Rule: Distinguish Lost Enquiry from Cancelled Order
    if (payload.category === 'Lost Enquiry') {
      if (file.has_confirmed_order || (file.customer_pos && file.customer_pos.length > 0)) {
        return {
          success: false,
          error: 'A confirmed customer order or PO already exists for this file. It cannot be closed as a Lost Enquiry. Please use Cancelled Order or complete financial review.',
        };
      }

      // Close as Lost Enquiry (e.g. Requirement Not Needed)
      file.sales_status = 'Lost';
      file.fulfilment_status = 'Cancelled';
      file.financial_status = 'Closed';
      file.status = 'Cancelled';
      file.closure_category = 'Lost Enquiry';
      file.closure_reason = payload.reason;
      file.closure_explanation = payload.explanation;
      file.closed_at = new Date().toISOString();
      file.closed_by = authUser.name;
      file.updated_at = new Date().toISOString();

      await persistProjectFields(file.id, {
        sales_status: file.sales_status,
        fulfilment_status: file.fulfilment_status,
        financial_status: file.financial_status,
        status: file.status,
        closure_category: file.closure_category,
        closure_reason: file.closure_reason,
        closure_explanation: file.closure_explanation || null,
        closed_at: file.closed_at,
        closed_by: file.closed_by,
        updated_at: file.updated_at,
      });

      await logAuditEvent({
        userName: authUser.name,
        action: 'FILE_CLOSED_AS_LOST',
        module: 'SALES',
        details: `Closed File ${file.project_number} as Lost Enquiry. Reason: ${payload.reason}. Notes: ${payload.explanation || 'None'}`,
      });

      revalidatePath('/dashboard/projects');
      return { success: true, data: file };
    }

    // Rule: Successful closure requires BOTH fulfilment complete AND financial settled
    if (payload.category === 'Successfully Completed') {
      const isFulfilmentDone = file.fulfilment_status === 'Fulfilment Completed';
      const isFinancialSettled = file.financial_status === 'Financially Settled';

      if (!isFulfilmentDone || !isFinancialSettled) {
        file.is_ready_for_closure = isFulfilmentDone && isFinancialSettled;
        return {
          success: false,
          error: `Cannot close file as Completed. Both Fulfilment must be Completed (current: ${file.fulfilment_status}) and Financials must be Settled (current: ${file.financial_status}).`,
        };
      }

      file.sales_status = 'Order Confirmed';
      file.status = 'Completed';
      file.closure_category = 'Successfully Completed';
      file.closure_reason = payload.reason;
      file.closed_at = new Date().toISOString();
      file.closed_by = authUser.name;
      file.actual_completion_date = new Date().toISOString().split('T')[0];
      file.updated_at = new Date().toISOString();

      await persistProjectFields(file.id, {
        sales_status: file.sales_status,
        status: file.status,
        closure_category: file.closure_category,
        closure_reason: file.closure_reason,
        closed_at: file.closed_at,
        closed_by: file.closed_by,
        actual_completion_date: file.actual_completion_date,
        updated_at: file.updated_at,
      });

      await logAuditEvent({
        userName: authUser.name,
        action: 'FILE_CLOSED_COMPLETED',
        module: 'OPERATIONS',
        details: `Successfully closed File ${file.project_number}. Fulfilment and accounting reconciliation verified.`,
      });

      revalidatePath('/dashboard/projects');
      return { success: true, data: file };
    }

    // Cancelled Confirmed Order
    if (payload.category === 'Cancelled Confirmed Order' || payload.category === 'Cancelled Before Order') {
      if (!['Managing Director', 'Admin / BDM', 'Accounts'].includes(authUser.role)) {
        return {
          success: false,
          error: 'Only Managing Director or Accounts can approve cancellation of a confirmed order file.',
        };
      }

      file.sales_status = 'Cancelled';
      file.fulfilment_status = 'Cancelled';
      file.financial_status = 'Closed';
      file.status = 'Cancelled';
      file.closure_category = payload.category;
      file.closure_reason = payload.reason;
      file.closure_explanation = payload.explanation;
      file.closed_at = new Date().toISOString();
      file.closed_by = authUser.name;
      file.updated_at = new Date().toISOString();

      await persistProjectFields(file.id, {
        sales_status: file.sales_status,
        fulfilment_status: file.fulfilment_status,
        financial_status: file.financial_status,
        status: file.status,
        closure_category: file.closure_category,
        closure_reason: file.closure_reason,
        closure_explanation: file.closure_explanation || null,
        closed_at: file.closed_at,
        closed_by: file.closed_by,
        updated_at: file.updated_at,
      });

      await logAuditEvent({
        userName: authUser.name,
        action: 'FILE_CANCELLED',
        module: 'OPERATIONS',
        details: `Cancelled File ${file.project_number} (${payload.category}). Reason: ${payload.reason}`,
      });

      revalidatePath('/dashboard/projects');
      return { success: true, data: file };
    }

    return { success: false, error: 'Invalid closure category specified.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to close file' };
  }
}

/**
 * Salesperson submits request to reopen a previously closed file.
 * Restricted to authenticated Sales reps / Admin.
 */
export async function requestFileReopening(
  projectId: string,
  reason: string
): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const file = await findProjectRecord(projectId);

    if (!file) {
      return { success: false, error: 'Project file not found.' };
    }

    if (!file.closed_at) {
      return { success: false, error: 'File is currently active and not closed.' };
    }

    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'A specific business reason is mandatory for reopening.' };
    }

    const request: FileReopenRequest = {
      id: `REOPEN-${Date.now()}`,
      requested_by_id: authUser.id,
      requested_by_name: authUser.name,
      requested_at: new Date().toISOString(),
      reason: reason.trim(),
      status: 'PENDING',
    };

    file.reopen_request = request;
    file.updated_at = new Date().toISOString();

    await persistProjectFields(file.id, {
      reopen_requested: true,
      reopen_requested_by: authUser.name,
      reopen_requested_at: request.requested_at,
      reopen_reason: request.reason,
      updated_at: file.updated_at,
    });

    await logAuditEvent({
      userName: authUser.name,
      action: 'FILE_REOPEN_REQUESTED',
      module: 'SALES',
      details: `Reopen request submitted for File ${file.project_number} by ${authUser.name}. Reason: ${reason}`,
    });

    revalidatePath('/dashboard/projects');
    return { success: true, data: file };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit reopening request' };
  }
}

/**
 * Admin / MD approves or rejects reopening request.
 * On reopening: preserves previous closure record in history, creates audit event.
 */
export async function decideFileReopening(
  projectId: string,
  payload: {
    approve: boolean;
    rejection_reason?: string;
  }
): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM']);
    const file = await findProjectRecord(projectId);

    if (!file || (!file.reopen_request && !(file as any).reopen_requested)) {
      return { success: false, error: 'No active reopening request found for this file.' };
    }

    const req: import('@/types/erp').FileReopenRequest = file.reopen_request || {
      id: `REOPEN-${Date.now()}`,
      requested_by_id: '',
      requested_by_name: (file as any).reopen_requested_by || 'Staff',
      requested_at: (file as any).reopen_requested_at || new Date().toISOString(),
      reason: (file as any).reopen_reason || '',
      status: 'PENDING',
    };

    if (payload.approve) {
      req.status = 'APPROVED';
      req.decided_by_id = authUser.id;
      req.decided_by_name = authUser.name;
      req.decided_at = new Date().toISOString();

      if (!file.reopen_history) file.reopen_history = [];
      file.reopen_history.push({ ...req });

      // Re-activate file
      file.closed_at = undefined;
      file.closed_by = undefined;
      file.sales_status = 'Follow-up';
      file.status = 'In Execution';
      file.reopen_request = undefined;
      file.updated_at = new Date().toISOString();

      await persistProjectFields(file.id, {
        closed_at: null,
        closed_by: null,
        sales_status: file.sales_status,
        status: file.status,
        reopen_requested: false,
        reopen_history: file.reopen_history,
        updated_at: file.updated_at,
      });

      await logAuditEvent({
        userName: authUser.name,
        action: 'FILE_REOPEN_APPROVED',
        module: 'ADMIN',
        details: `Approved reopening of File ${file.project_number}. Approver: ${authUser.name}. Original request by: ${req.requested_by_name}`,
      });
    } else {
      req.status = 'REJECTED';
      req.decided_by_id = authUser.id;
      req.decided_by_name = authUser.name;
      req.decided_at = new Date().toISOString();
      req.rejection_reason = payload.rejection_reason || 'Reopening not justified.';

      if (!file.reopen_history) file.reopen_history = [];
      file.reopen_history.push({ ...req });
      file.reopen_request = undefined;
      file.updated_at = new Date().toISOString();

      await persistProjectFields(file.id, {
        reopen_requested: false,
        reopen_history: file.reopen_history,
        updated_at: file.updated_at,
      });

      await logAuditEvent({
        userName: authUser.name,
        action: 'FILE_REOPEN_REJECTED',
        module: 'ADMIN',
        details: `Rejected reopening of File ${file.project_number}. Decided by: ${authUser.name}. Reason: ${req.rejection_reason}`,
      });
    }

    revalidatePath('/dashboard/projects');
    return { success: true, data: file };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to process reopening decision' };
  }
}

/**
 * Transfers file ownership with explicit admin authorization and immutable audit trail.
 */
export async function transferFileOwnership(
  projectId: string,
  payload: {
    new_owner_id: string;
    new_owner_name: string;
    reason: string;
  }
): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM']);
    const file = await findProjectRecord(projectId);

    if (!file) {
      return { success: false, error: 'Project file not found.' };
    }

    const prevOwnerId = file.file_owner_id || 'UNKNOWN';
    const prevOwnerName = file.file_owner_name || 'Unassigned';

    const transferRecord: FileOwnershipTransfer = {
      id: `TRANS-${Date.now()}`,
      transferred_from_id: prevOwnerId,
      transferred_from_name: prevOwnerName,
      transferred_to_id: payload.new_owner_id,
      transferred_to_name: payload.new_owner_name,
      reason: payload.reason,
      approved_by_id: authUser.id,
      approved_by_name: authUser.name,
      transferred_at: new Date().toISOString(),
    };

    if (!file.ownership_history) file.ownership_history = [];
    file.ownership_history.push(transferRecord);

    file.file_owner_id = payload.new_owner_id;
    file.file_owner_name = payload.new_owner_name;
    file.updated_at = new Date().toISOString();

    await persistProjectFields(file.id, {
      file_owner_id: sanitizeUuid(payload.new_owner_id),
      file_owner_name: payload.new_owner_name,
      ownership_history: file.ownership_history,
      updated_at: file.updated_at,
    });

    await logAuditEvent({
      userName: authUser.name,
      action: 'FILE_OWNERSHIP_TRANSFERRED',
      module: 'USER_MANAGEMENT',
      details: `Transferred ownership of File ${file.project_number} from ${prevOwnerName} to ${payload.new_owner_name}. Reason: ${payload.reason}`,
    });

    revalidatePath('/dashboard/projects');
    return { success: true, data: file };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to transfer file ownership' };
  }
}

/**
 * Uploads and links a verified customer purchase order to a file.
 */
export async function uploadCustomerPO(
  projectId: string,
  payload: {
    po_number: string;
    po_date: string;
    po_value: number;
    document_url?: string;
    document_name?: string;
    payment_terms?: string;
    payment_trigger?: 'INVOICE_DATE' | 'DELIVERY_DATE' | 'GRN' | 'ACCEPTANCE' | 'MILESTONE' | 'CUSTOM';
    delivery_terms?: string;
  }
): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts']);
    const file = await findProjectRecord(projectId);

    if (!file) {
      return { success: false, error: 'Project file not found.' };
    }

    if (!payload.po_number || !payload.po_date || !payload.po_value) {
      return { success: false, error: 'PO Number, PO Date, and PO Value are mandatory.' };
    }

    const newPO: CustomerPurchaseOrder = {
      id: `CPO-${Date.now()}`,
      file_id: file.id,
      customer_id: file.customer_id,
      po_number: payload.po_number.trim(),
      po_date: payload.po_date,
      po_value: payload.po_value,
      document_url: payload.document_url,
      document_name: payload.document_name,
      payment_terms: payload.payment_terms || '30 Days',
      payment_trigger: payload.payment_trigger || 'DELIVERY_DATE',
      delivery_terms: payload.delivery_terms,
      status: 'RECEIVED',
      created_at: new Date().toISOString(),
    };

    if (!file.customer_pos) file.customer_pos = [];
    file.customer_pos.push(newPO);

    file.has_confirmed_order = true;
    file.has_financial_commitments = true;
    file.sales_status = 'Customer PO Received';
    file.department_owner = 'Accounts';
    file.updated_at = new Date().toISOString();

    await persistProjectFields(file.id, {
      customer_po: newPO,
      sales_status: file.sales_status,
      department_owner: file.department_owner,
      updated_at: file.updated_at,
    });

    await logAuditEvent({
      userName: authUser.name,
      action: 'CUSTOMER_PO_UPLOADED',
      module: 'SALES',
      details: `Customer PO ${payload.po_number} uploaded for File ${file.project_number} (Value: ₹${payload.po_value.toLocaleString('en-IN')}). Handoff to Accounts.`,
    });

    revalidatePath('/dashboard/projects');
    return { success: true, data: file };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to upload customer PO' };
  }
}

/**
 * Calculates department responsibility and turnaround delay metrics.
 * Distinguishes Sales delay, Accounts delay, Procurement delay, Dispatch delay, and Customer delay.
 */
export async function getDepartmentDelayMetrics(): Promise<{
  salesDelayDays: number;
  accountsDelayDays: number;
  procurementDelayDays: number;
  dispatchDelayDays: number;
  technicalDelayDays: number;
  customerDelayDays: number;
  externalSupplierDelayDays: number;
  bottleneckDepartment: string;
}> {
  const { projects: store } = await getProjects();

  let salesDelay = 0;
  let accountsDelay = 0;
  let procurementDelay = 0;
  let dispatchDelay = 0;
  let technicalDelay = 0;
  let customerDelay = 0;

  for (const p of store) {
    if (p.closed_at) continue;

    if (p.department_owner === 'Sales' && p.sales_status === 'Follow-up') {
      salesDelay += 2;
    } else if (p.department_owner === 'Accounts' && p.sales_status === 'Customer PO Received') {
      accountsDelay += 3;
    } else if (p.department_owner === 'Procurement' && p.fulfilment_status === 'Awaiting Procurement') {
      procurementDelay += 4;
    } else if (p.department_owner === 'Dispatch' && p.fulfilment_status === 'Ready for Dispatch') {
      dispatchDelay += 1;
    } else if (p.department_owner === 'Technical' && p.fulfilment_status === 'Installation Pending') {
      technicalDelay += 2;
    } else if (p.sales_status === 'Quotation Sent') {
      customerDelay += 5;
    }
  }

  const delays: Record<string, number> = {
    Sales: salesDelay,
    Accounts: accountsDelay,
    Procurement: procurementDelay,
    Dispatch: dispatchDelay,
    Technical: technicalDelay,
  };

  const bottleneck = Object.entries(delays).sort((a, b) => b[1] - a[1])[0][0];

  return {
    salesDelayDays: salesDelay,
    accountsDelayDays: accountsDelay,
    procurementDelayDays: procurementDelay,
    dispatchDelayDays: dispatchDelay,
    technicalDelayDays: technicalDelay,
    customerDelayDays: customerDelay,
    externalSupplierDelayDays: 2,
    bottleneckDepartment: bottleneck,
  };
}

/**
 * Returns overall Open Files statistical summary.
 */
export async function getOpenFilesSummary(): Promise<{
  totalFiles: number;
  activeFiles: number;
  lostEnquiries: number;
  cancelledOrders: number;
  readyForClosure: number;
  closedFiles: number;
  reopenRequestsPending: number;
  awaitingAccounts: number;
  awaitingProcurement: number;
}> {
  const { projects: store } = await getProjects();

  let active = 0;
  let lost = 0;
  let cancelled = 0;
  let readyForClose = 0;
  let closed = 0;
  let reopenPending = 0;
  let awaitingAccounts = 0;
  let awaitingProcurement = 0;

  for (const p of store) {
    if (p.closed_at) {
      closed++;
      if (p.closure_category === 'Lost Enquiry') lost++;
      if (p.closure_category === 'Cancelled Confirmed Order' || p.closure_category === 'Cancelled Before Order') cancelled++;
    } else {
      active++;
      if (p.is_ready_for_closure) readyForClose++;
      if (p.department_owner === 'Accounts') awaitingAccounts++;
      if (p.department_owner === 'Procurement') awaitingProcurement++;
    }

    if (p.reopen_request && p.reopen_request.status === 'PENDING') {
      reopenPending++;
    }
  }

  return {
    totalFiles: store.length,
    activeFiles: active,
    lostEnquiries: lost,
    cancelledOrders: cancelled,
    readyForClosure: readyForClose,
    closedFiles: closed,
    reopenRequestsPending: reopenPending,
    awaitingAccounts,
    awaitingProcurement,
  };
}

export async function updateProjectStatus(
  projectId: string,
  newStatus: ProjectStatus
): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant']);
    const proj = await findProjectRecord(projectId);

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

    await persistProjectFields(proj.id, {
      status: newStatus,
      actual_completion_date: proj.actual_completion_date || null,
      updated_at: proj.updated_at,
    });

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
    const { projects: store } = await getProjects();

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
            await admin
              .from('project_milestones')
              .update({
                status,
                invoice_id: invoiceId || null,
                invoice_number: invoiceNumber || null,
                completed_at: ms.completed_at || null,
              })
              .eq('id', ms.id);
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
