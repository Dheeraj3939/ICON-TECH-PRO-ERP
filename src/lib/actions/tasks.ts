'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getNextTaskNumber } from '@/lib/utils/sequence';
import type { ERPTask, TaskType, TaskPriority, TaskStatus } from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_TASKS__: ERPTask[] | undefined;
}

const INITIAL_TASKS: ERPTask[] = [
  {
    id: 'TSK-001',
    task_number: 'ICON/26-27/TSK-0001',
    task_type: 'QUOTATION_FOLLOWUP',
    related_entity_type: 'quotations',
    related_entity_id: 'QT-1099',
    related_entity_number: 'ICON-EST-1099',
    title: 'Follow up on 4K AV Infrastructure Quotation',
    notes: 'Client requested institutional approval; check committee status.',
    assigned_user_name: 'Vamshi Krishna',
    priority: 'HIGH',
    due_date: '2026-04-10',
    status: 'Pending',
    created_by_name: 'Dheeraj',
    created_at: '2026-04-05T10:00:00.000Z',
  },
  {
    id: 'TSK-002',
    task_number: 'ICON/26-27/TSK-0002',
    task_type: 'PAYMENT_COLLECTION',
    related_entity_type: 'invoices',
    related_entity_id: 'INV-260002',
    related_entity_number: 'ICON/26-27/INV-0002',
    title: 'Collect Balance Payment of ₹1,48,000',
    notes: 'Payment terms 30 days due on April 15.',
    assigned_user_name: 'Vamshi Krishna',
    priority: 'URGENT',
    due_date: '2026-04-15',
    status: 'Pending',
    created_by_name: 'Managing Director',
    created_at: '2026-04-06T11:30:00.000Z',
  },
  {
    id: 'TSK-003',
    task_number: 'ICON/26-27/TSK-0003',
    task_type: 'AMC_RENEWAL',
    related_entity_type: 'customers',
    related_entity_id: 'CUST0001',
    related_entity_number: 'CUST0001',
    title: 'Pitch 1-Year Comprehensive AMC Renewal',
    notes: 'Warranty expiring on 2x Interactive Flat Panels.',
    assigned_user_name: 'Vamshi Krishna',
    priority: 'MEDIUM',
    due_date: '2026-04-18',
    status: 'In Progress',
    created_by_name: 'Dheeraj',
    created_at: '2026-04-07T09:15:00.000Z',
  },
];

function getInternalTasksStore(): ERPTask[] {
  if (!globalThis.__ICON_TASKS__) {
    globalThis.__ICON_TASKS__ = [...INITIAL_TASKS];
  }
  return globalThis.__ICON_TASKS__;
}

export type TaskViewScope = 'ALL' | 'MY_TASKS' | 'TEAM' | 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'COMPLETED';

export async function getTasks(filters?: {
  scope?: TaskViewScope;
  status?: TaskStatus;
  task_type?: TaskType;
  assigned_user_name?: string;
  related_entity_id?: string;
}): Promise<{ tasks: ERPTask[]; total: number }> {
  const store = getInternalTasksStore();
  const authUser = await getAuthenticatedUser();
  const todayStr = new Date().toISOString().split('T')[0];

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      let query = supabase.from('tasks').select('*', { count: 'exact' });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.task_type) query = query.eq('task_type', filters.task_type);
      if (filters?.related_entity_id) query = query.eq('related_entity_id', filters.related_entity_id);

      query = query.order('due_date', { ascending: true });
      const { data, error, count } = await query;
      if (!error && data && data.length > 0) {
        return { tasks: data as ERPTask[], total: count ?? data.length };
      }
    } catch (err) {
      console.warn('Supabase tasks query fallback to memory:', err);
    }
  }

  let filtered = [...store];

  // Apply scope filtering
  if (filters?.scope === 'MY_TASKS' && authUser) {
    filtered = filtered.filter(
      (t) => t.assigned_user_name.toLowerCase() === authUser.name.toLowerCase() || t.assigned_user_id === authUser.id
    );
  } else if (filters?.scope === 'OVERDUE') {
    filtered = filtered.filter((t) => t.due_date < todayStr && t.status !== 'Completed' && t.status !== 'Cancelled');
  } else if (filters?.scope === 'TODAY') {
    filtered = filtered.filter((t) => t.due_date === todayStr && t.status !== 'Completed' && t.status !== 'Cancelled');
  } else if (filters?.scope === 'UPCOMING') {
    filtered = filtered.filter((t) => t.due_date > todayStr && t.status !== 'Completed' && t.status !== 'Cancelled');
  } else if (filters?.scope === 'COMPLETED') {
    filtered = filtered.filter((t) => t.status === 'Completed');
  }

  if (filters?.status) {
    filtered = filtered.filter((t) => t.status === filters.status);
  }
  if (filters?.task_type) {
    filtered = filtered.filter((t) => t.task_type === filters.task_type);
  }
  if (filters?.assigned_user_name) {
    filtered = filtered.filter((t) => t.assigned_user_name.toLowerCase() === filters.assigned_user_name!.toLowerCase());
  }
  if (filters?.related_entity_id) {
    filtered = filtered.filter((t) => t.related_entity_id === filters.related_entity_id);
  }

  // Sort by due date ascending
  filtered.sort((a, b) => a.due_date.localeCompare(b.due_date));

  return { tasks: filtered, total: filtered.length };
}

/**
 * Create an Automated Task / Follow-up.
 */
export async function createTask(payload: {
  task_type: TaskType;
  title: string;
  notes?: string;
  assigned_user_name: string;
  priority: TaskPriority;
  due_date: string;
  reminder_date?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  related_entity_number?: string;
}): Promise<{ success: boolean; data?: ERPTask; error?: string }> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Accounts',
      'Office Assistant',
    ]);

    const store = getInternalTasksStore();
    const taskNumber = await getNextTaskNumber();

    const task: ERPTask = {
      id: `TSK-${Date.now()}`,
      task_number: taskNumber,
      task_type: payload.task_type,
      related_entity_type: payload.related_entity_type,
      related_entity_id: payload.related_entity_id,
      related_entity_number: payload.related_entity_number,
      title: payload.title,
      notes: payload.notes,
      assigned_user_name: payload.assigned_user_name,
      priority: payload.priority,
      due_date: payload.due_date,
      reminder_date: payload.reminder_date,
      status: 'Pending',
      created_by_name: authUser.name,
      created_at: new Date().toISOString(),
    };

    store.unshift(task);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('tasks').insert({
          id: task.id,
          task_number: task.task_number,
          task_type: task.task_type,
          related_entity_type: task.related_entity_type || null,
          related_entity_id: task.related_entity_id || null,
          related_entity_number: task.related_entity_number || null,
          title: task.title,
          notes: task.notes || null,
          assigned_user_name: task.assigned_user_name,
          priority: task.priority,
          due_date: task.due_date,
          status: task.status,
          created_by_name: task.created_by_name,
        });
      } catch (err) {
        console.warn('Supabase createTask fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_TASK',
      module: 'TASKS',
      details: `Created ${payload.task_type} task ${taskNumber}: "${task.title}" assigned to ${task.assigned_user_name}`,
    });

    revalidatePath('/dashboard/follow-ups');
    revalidatePath('/dashboard');
    return { success: true, data: task };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create task' };
  }
}

/**
 * Update Task Status and Record Completion Outcome.
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  outcome?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Accounts',
      'Office Assistant',
    ]);

    const store = getInternalTasksStore();
    const found = store.find((t) => t.id === taskId || t.task_number === taskId);
    if (!found) {
      return { success: false, error: 'Task record not found.' };
    }

    found.status = status;
    if (outcome) found.outcome = outcome;
    if (status === 'Completed') {
      found.completed_by_name = authUser.name;
      found.completed_at = new Date().toISOString();
    }
    found.updated_at = new Date().toISOString();

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('tasks')
          .update({
            status: found.status,
            outcome: found.outcome || null,
            completed_by_name: found.completed_by_name || null,
            completed_at: found.completed_at || null,
            updated_at: found.updated_at,
          })
          .or(`id.eq.${taskId},task_number.eq.${taskId}`);
      } catch (err) {
        console.warn('Supabase updateTaskStatus fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_TASK_STATUS',
      module: 'TASKS',
      details: `Updated task ${found.task_number} status to ${status}${outcome ? ` (Outcome: ${outcome})` : ''}`,
    });

    revalidatePath('/dashboard/follow-ups');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update task status' };
  }
}

/**
 * Safely update task details before completion (due date, priority, assignment, notes).
 */
export async function updateTask(
  taskId: string,
  values: Partial<{
    title: string;
    notes: string;
    assigned_user_name: string;
    priority: TaskPriority;
    due_date: string;
    reminder_date: string;
    task_type: TaskType;
  }>
): Promise<{ success: boolean; data?: ERPTask; error?: string }> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Accounts',
      'Office Assistant',
    ]);

    const store = getInternalTasksStore();
    const found = store.find((t) => t.id === taskId || t.task_number === taskId);
    if (!found) {
      return { success: false, error: 'Task record not found.' };
    }

    if (found.status === 'Completed') {
      return { success: false, error: 'Completed tasks cannot be directly modified. Create a follow-up task instead.' };
    }

    if (values.title !== undefined) found.title = values.title;
    if (values.notes !== undefined) found.notes = values.notes;
    if (values.assigned_user_name !== undefined) found.assigned_user_name = values.assigned_user_name;
    if (values.priority !== undefined) found.priority = values.priority;
    if (values.due_date !== undefined) found.due_date = values.due_date;
    if (values.reminder_date !== undefined) found.reminder_date = values.reminder_date;
    if (values.task_type !== undefined) found.task_type = values.task_type;
    found.updated_at = new Date().toISOString();

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('tasks')
          .update({
            title: found.title,
            notes: found.notes || null,
            assigned_user_name: found.assigned_user_name,
            priority: found.priority,
            due_date: found.due_date,
            task_type: found.task_type,
            updated_at: found.updated_at,
          })
          .or(`id.eq.${taskId},task_number.eq.${taskId}`);
      } catch (err) {
        console.warn('Supabase updateTask fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_TASK',
      module: 'TASKS',
      details: `Updated task ${found.task_number}: "${found.title}" (Assigned: ${found.assigned_user_name}, Priority: ${found.priority}, Due: ${found.due_date})`,
    });

    revalidatePath('/dashboard/follow-ups');
    revalidatePath('/dashboard');
    return { success: true, data: found };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update task' };
  }
}

