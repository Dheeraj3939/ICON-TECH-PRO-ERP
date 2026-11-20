'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser, requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { findByIdOrCode, isUuid } from '@/lib/supabase/db-helpers';
import { INITIAL_EMPLOYEES, INITIAL_HR_AUDIT_EVENTS } from '@/lib/constants/hr-data';
import type { Employee, HRAuditEvent } from '@/types/hr';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_EMPLOYEES_STORE__: Employee[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_HR_AUDIT_STORE__: HRAuditEvent[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_EMP_SEQ__: number | undefined;
}

function getEmployeesStore(): Employee[] {
  if (!globalThis.__ICON_EMPLOYEES_STORE__) {
    globalThis.__ICON_EMPLOYEES_STORE__ = [...INITIAL_EMPLOYEES];
  }
  return globalThis.__ICON_EMPLOYEES_STORE__;
}

function getHRAuditStore(): HRAuditEvent[] {
  if (!globalThis.__ICON_HR_AUDIT_STORE__) {
    globalThis.__ICON_HR_AUDIT_STORE__ = [...INITIAL_HR_AUDIT_EVENTS];
  }
  return globalThis.__ICON_HR_AUDIT_STORE__;
}

function getNextEmployeeId(): string {
  if (!globalThis.__ICON_EMP_SEQ__) {
    globalThis.__ICON_EMP_SEQ__ = 9;
  }
  const nextNum = globalThis.__ICON_EMP_SEQ__++;
  return `EMP-${String(nextNum).padStart(4, '0')}`;
}

export async function logHRAudit(event: Omit<HRAuditEvent, 'id' | 'timestamp'>): Promise<void> {
  const auditStore = getHRAuditStore();
  const newEvent: HRAuditEvent = {
    ...event,
    id: auditStore.length + 1,
    timestamp: new Date().toISOString(),
  };
  auditStore.unshift(newEvent);

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      await admin.from('hr_audit_events').insert({
        performed_by: event.performed_by,
        performed_by_role: event.performed_by_role,
        action: event.action,
        module: event.module,
        entity: event.entity,
        record_id: event.record_id,
        previous_value: event.previous_value,
        new_value: event.new_value,
      });
    } catch {
      // Non-fatal fallback to in-memory audit
    }
  }
}

/**
 * Retrieve all employees with optional department, work location, and search filtering.
 */
export async function getEmployees(filters?: {
  search?: string;
  department?: string;
  workLocationType?: string;
  status?: string;
}): Promise<{ employees: Employee[]; total: number }> {
  // Authoritative server-side identity verification
  await requireRole([
    'Managing Director',
    'Admin / BDM',
    'BDM',
    'Sales Executive',
    'Accounts',
    'Office Assistant',
  ]);

  const store = getEmployeesStore();
  const isOnline = await isSupabaseAvailable();

  let list = [...store];

  if (isOnline) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('employees')
        .select('*')
        .order('employee_id', { ascending: true });

      if (!error && data) {
        list = data.map((d: any) => ({
          id: d.id,
          employee_id: d.employee_id,
          full_name: d.full_name,
          gender: d.gender,
          date_of_birth: d.date_of_birth,
          phone: d.phone,
          personal_email: d.personal_email,
          corporate_email: d.corporate_email,
          address: d.address,
          emergency_contact_name: d.emergency_contact_name,
          emergency_contact_phone: d.emergency_contact_phone,
          department: d.department,
          designation: d.designation,
          employment_type: d.employment_type,
          joining_date: d.joining_date,
          work_location_type: d.work_location_type,
          current_site_assignment: d.current_site_assignment,
          reporting_manager_id: d.reporting_manager_id,
          status: d.status,
          probation_status: d.probation_status,
          confirmation_date: d.confirmation_date,
          skills: d.skills || [],
          notes: d.notes,
          created_at: d.created_at,
          updated_at: d.updated_at,
        }));
      }
    } catch {
      // Graceful fallback to in-memory store
    }
  }

  // In-memory filter pipeline
  if (filters?.department && filters.department !== 'ALL') {
    list = list.filter((e) => e.department === filters.department);
  }
  if (filters?.workLocationType && filters.workLocationType !== 'ALL') {
    list = list.filter((e) => e.work_location_type === filters.workLocationType);
  }
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((e) => e.status === filters.status);
  }
  if (filters?.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        e.employee_id.toLowerCase().includes(q) ||
        e.corporate_email.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q)
    );
  }

  return { employees: list, total: list.length };
}

/**
 * Get detailed Employee 360 profile by ID.
 */
export async function getEmployeeById(id: string): Promise<Employee | null> {
  await requireRole([
    'Managing Director',
    'Admin / BDM',
    'BDM',
    'Sales Executive',
    'Accounts',
    'Office Assistant',
  ]);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const row = await findByIdOrCode<Employee>(admin, 'employees', id, 'employee_id');
      if (row) return row;
      return null;
    } catch {
      // Fallback
    }
  }

  const store = getEmployeesStore();
  const emp = store.find((e) => e.id === id || e.employee_id === id);
  return emp || null;
}

/**
 * Create a new employee record.
 * Restricted to Managing Director and Admin / BDM.
 */
export async function createEmployee(data: {
  full_name: string;
  corporate_email: string;
  phone: string;
  department: string;
  designation: string;
  employment_type: Employee['employment_type'];
  joining_date: string;
  work_location_type: Employee['work_location_type'];
  current_site_assignment?: string;
  personal_email?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  skills?: string[];
  notes?: string;
}): Promise<{ success: boolean; employee?: Employee; error?: string }> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

  const store = getEmployeesStore();
  const isOnline = await isSupabaseAvailable();

  let newEmpId = getNextEmployeeId();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      const { data: existingDb } = await admin
        .from('employees')
        .select('*')
        .ilike('corporate_email', data.corporate_email.trim())
        .maybeSingle();
      if (existingDb) {
        await admin
          .from('employees')
          .update({
            full_name: data.full_name,
            phone: data.phone,
            department: data.department,
            designation: data.designation,
            employment_type: data.employment_type,
            joining_date: data.joining_date,
            work_location_type: data.work_location_type,
            notes: data.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingDb.id);

        const updatedEmp: Employee = {
          ...existingDb,
          full_name: data.full_name,
          phone: data.phone,
          department: data.department,
          designation: data.designation,
          employment_type: data.employment_type,
          joining_date: data.joining_date,
          work_location_type: data.work_location_type,
          notes: data.notes || undefined,
        };
        return { success: true, employee: updatedEmp };
      }
      const { data: allIds } = await admin.from('employees').select('employee_id');
      if (allIds && allIds.length > 0) {
        let maxNum = 0;
        for (const r of allIds) {
          const m = String(r.employee_id || '').match(/(\d+)$/);
          if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
        }
        newEmpId = `EMP-${String(maxNum + 1).padStart(4, '0')}`;
      } else {
        newEmpId = 'EMP-0001';
      }
    } catch {}
  } else {
    const existing = store.find(
      (e) => e.corporate_email.toLowerCase() === data.corporate_email.toLowerCase()
    );
    if (existing) {
      return { success: false, error: 'An employee with this corporate email already exists.' };
    }
  }

  const newId = `EMP-UUID-${newEmpId.replace('EMP-', '')}`;

  const newEmployee: Employee = {
    id: newId,
    employee_id: newEmpId,
    full_name: data.full_name,
    corporate_email: data.corporate_email,
    phone: data.phone,
    department: data.department,
    designation: data.designation,
    employment_type: data.employment_type,
    joining_date: data.joining_date,
    work_location_type: data.work_location_type,
    current_site_assignment: data.current_site_assignment || null,
    personal_email: data.personal_email || undefined,
    address: data.address || undefined,
    emergency_contact_name: data.emergency_contact_name || undefined,
    emergency_contact_phone: data.emergency_contact_phone || undefined,
    skills: data.skills || [],
    notes: data.notes || undefined,
    status: 'Active',
    probation_status: 'On Probation',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  store.push(newEmployee);

  if (isOnline) {
    try {
      const admin = createAdminClient();
      await admin.from('employees').insert({
        employee_id: newEmpId,
        full_name: data.full_name,
        corporate_email: data.corporate_email,
        phone: data.phone,
        department: data.department,
        designation: data.designation,
        employment_type: data.employment_type,
        joining_date: data.joining_date,
        work_location_type: data.work_location_type,
        current_site_assignment: data.current_site_assignment || null,
        personal_email: data.personal_email || null,
        address: data.address || null,
        emergency_contact_name: data.emergency_contact_name || null,
        emergency_contact_phone: data.emergency_contact_phone || null,
        skills: data.skills || [],
        notes: data.notes || null,
        status: 'Active',
        probation_status: 'On Probation',
      });
    } catch {
      // Non-fatal persistence fallback
    }
  }

  await logHRAudit({
    performed_by: authUser.name,
    performed_by_role: authUser.role,
    action: 'CREATE_EMPLOYEE',
    module: 'HR',
    entity: 'employees',
    record_id: newEmpId,
    previous_value: null,
    new_value: { employee_id: newEmpId, name: data.full_name, department: data.department },
  });

  revalidatePath('/dashboard/employees');
  return { success: true, employee: newEmployee };
}

/**
 * Update employee profile.
 * Restricted to Managing Director and Admin / BDM.
 */
export async function updateEmployee(
  id: string,
  updates: Partial<Employee>
): Promise<{ success: boolean; error?: string }> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

  const isOnline = await isSupabaseAvailable();
  const admin = isOnline ? createAdminClient() : null;
  const store = getEmployeesStore();
  const idx = store.findIndex((e) => e.id === id || e.employee_id === id);

  let target: Employee | null = idx >= 0 ? store[idx] : null;
  if (admin) {
    const dbEmp = await findByIdOrCode<Employee>(admin, 'employees', id, 'employee_id');
    if (dbEmp) target = dbEmp;
  }

  if (!target) {
    return { success: false, error: 'Employee record not found.' };
  }

  const prev = { ...target };
  const updatedRecord: Employee = {
    ...target,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (idx >= 0) {
    store[idx] = updatedRecord;
  }

  if (admin) {
    try {
      const query = admin.from('employees').update({ ...updates, updated_at: updatedRecord.updated_at });
      await (isUuid(target.id) ? query.eq('id', target.id) : query.eq('employee_id', target.employee_id));
    } catch {
      // Non-fatal
    }
  }

  await logHRAudit({
    performed_by: authUser.name,
    performed_by_role: authUser.role,
    action: 'UPDATE_EMPLOYEE',
    module: 'HR',
    entity: 'employees',
    record_id: updatedRecord.employee_id,
    previous_value: prev as any,
    new_value: updatedRecord as any,
  });

  revalidatePath('/dashboard/employees');
  return { success: true };
}

/**
 * Retrieve recent HR Audit Events.
 * Restricted to Managing Director, Admin / BDM, and Accounts.
 */
export async function getHRAuditEvents(): Promise<HRAuditEvent[]> {
  await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('hr_audit_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      if (!error && data) {
        return data as HRAuditEvent[];
      }
    } catch {
      // Fallback
    }
  }
  return getHRAuditStore();
}
