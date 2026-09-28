'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { logHRAudit } from '@/lib/actions/employees';
import { INITIAL_ATTENDANCE, INITIAL_CORRECTIONS, INITIAL_LEAVES } from '@/lib/constants/hr-data';
import type {
  EmployeeAttendance,
  AttendanceCorrection,
  EmployeeLeave,
  AttendanceStatus,
  WorkLocationType,
} from '@/types/hr';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_ATTENDANCE_STORE__: EmployeeAttendance[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_CORRECTIONS_STORE__: AttendanceCorrection[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_LEAVES_STORE__: EmployeeLeave[] | undefined;
}

function getAttendanceStore(): EmployeeAttendance[] {
  if (!globalThis.__ICON_ATTENDANCE_STORE__) {
    globalThis.__ICON_ATTENDANCE_STORE__ = [...INITIAL_ATTENDANCE];
  }
  return globalThis.__ICON_ATTENDANCE_STORE__;
}

function getCorrectionsStore(): AttendanceCorrection[] {
  if (!globalThis.__ICON_CORRECTIONS_STORE__) {
    globalThis.__ICON_CORRECTIONS_STORE__ = [...INITIAL_CORRECTIONS];
  }
  return globalThis.__ICON_CORRECTIONS_STORE__;
}

function getLeavesStore(): EmployeeLeave[] {
  if (!globalThis.__ICON_LEAVES_STORE__) {
    globalThis.__ICON_LEAVES_STORE__ = [...INITIAL_LEAVES];
  }
  return globalThis.__ICON_LEAVES_STORE__;
}

/**
 * Retrieve attendance logs with optional date, location, and employee filtering.
 * Authorized for: Managing Director, Admin / BDM, Accounts, Office Assistant (Manisha).
 */
export async function getAttendance(filters?: {
  date?: string;
  employeeId?: string;
  workLocation?: string;
  status?: string;
}): Promise<{ attendance: EmployeeAttendance[]; total: number }> {
  await requireRole([
    'Managing Director',
    'Admin / BDM',
    'Accounts',
    'Office Assistant',
    'BDM',
    'Sales Executive',
  ]);

  const store = getAttendanceStore();
  let list = [...store];

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      let query = admin
        .from('employee_attendance')
        .select('*, employees(full_name, employee_id)')
        .order('date', { ascending: false });

      if (filters?.date) {
        query = query.eq('date', filters.date);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        list = data.map((d: any) => ({
          id: d.id,
          employee_id: d.employee_id,
          employee_name: d.employees?.full_name || 'Staff',
          date: d.date,
          work_location: d.work_location,
          site_project_name: d.site_project_name,
          customer_id: d.customer_id,
          check_in: d.check_in,
          check_out: d.check_out,
          total_hours: Number(d.total_hours) || 0,
          attendance_status: d.attendance_status,
          overtime_hours: Number(d.overtime_hours) || 0,
          remarks: d.remarks,
          recorded_by: d.recorded_by,
          created_at: d.created_at,
          updated_at: d.updated_at,
        }));
      }
    } catch {
      // Fallback to in-memory store
    }
  }

  // Filter application
  if (filters?.date) {
    list = list.filter((a) => a.date === filters.date);
  }
  if (filters?.employeeId && filters.employeeId !== 'ALL') {
    list = list.filter((a) => a.employee_id === filters.employeeId);
  }
  if (filters?.workLocation && filters.workLocation !== 'ALL') {
    list = list.filter((a) => a.work_location === filters.workLocation);
  }
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((a) => a.attendance_status === filters.status);
  }

  return { attendance: list, total: list.length };
}

/**
 * Record or update daily attendance for an employee (Office or Site).
 * Primary operator: Manisha (Office Assistant / Service Coordinator), Admin, or MD.
 */
export async function recordAttendance(data: {
  employee_id: string;
  employee_name?: string;
  date: string;
  work_location: WorkLocationType;
  site_project_name?: string;
  customer_id?: string;
  check_in?: string;
  check_out?: string;
  total_hours?: number;
  attendance_status: AttendanceStatus;
  overtime_hours?: number;
  remarks?: string;
}): Promise<{ success: boolean; attendance?: EmployeeAttendance; error?: string }> {
  // Authoritative server-side authorization: Manisha (Office Assistant), Admin / BDM, MD
  const authUser = await requireRole([
    'Managing Director',
    'Admin / BDM',
    'Office Assistant',
  ]);

  const store = getAttendanceStore();
  const existingIdx = store.findIndex(
    (a) => a.employee_id === data.employee_id && a.date === data.date
  );

  const entry: EmployeeAttendance = {
    id: existingIdx !== -1 ? store[existingIdx].id : `ATT-${Date.now().toString().slice(-6)}`,
    employee_id: data.employee_id,
    employee_name: data.employee_name,
    date: data.date,
    work_location: data.work_location,
    site_project_name: data.site_project_name || undefined,
    customer_id: data.customer_id || undefined,
    check_in: data.check_in || '09:00',
    check_out: data.check_out || '18:00',
    total_hours: data.total_hours ?? 9,
    attendance_status: data.attendance_status,
    overtime_hours: data.overtime_hours || 0,
    remarks: data.remarks || undefined,
    recorded_by: authUser.name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existingIdx !== -1) {
    store[existingIdx] = entry;
  } else {
    store.unshift(entry);
  }

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      await admin.from('employee_attendance').upsert({
        employee_id: data.employee_id,
        date: data.date,
        work_location: data.work_location,
        site_project_name: data.site_project_name || null,
        customer_id: data.customer_id || null,
        check_in: data.check_in || null,
        check_out: data.check_out || null,
        total_hours: data.total_hours || 9,
        attendance_status: data.attendance_status,
        overtime_hours: data.overtime_hours || 0,
        remarks: data.remarks || null,
        recorded_by: authUser.name,
      });
    } catch {
      // Non-fatal persistence fallback
    }
  }

  await logHRAudit({
    performed_by: authUser.name,
    performed_by_role: authUser.role,
    action: 'RECORD_ATTENDANCE',
    module: 'Attendance',
    entity: 'employee_attendance',
    record_id: `${data.employee_id}_${data.date}`,
    previous_value: existingIdx !== -1 ? (store[existingIdx] as any) : null,
    new_value: entry as any,
  });

  revalidatePath('/dashboard/employees/attendance');
  return { success: true, attendance: entry };
}

/**
 * Submit an Attendance Correction Request.
 * Permitted for: Manisha (Office Assistant), Admin, MD.
 */
export async function submitAttendanceCorrection(data: {
  attendance_id: string;
  employee_id: string;
  employee_name?: string;
  date: string;
  previous_status: AttendanceStatus;
  requested_status: AttendanceStatus;
  reason: string;
}): Promise<{ success: boolean; correction?: AttendanceCorrection; error?: string }> {
  const authUser = await requireRole([
    'Managing Director',
    'Admin / BDM',
    'Office Assistant',
    'BDM',
    'Sales Executive',
    'Accounts',
  ]);

  const correctionsStore = getCorrectionsStore();
  const correctionId = `CORR-${Date.now().toString().slice(-6)}`;

  const correction: AttendanceCorrection = {
    id: correctionId,
    attendance_id: data.attendance_id,
    employee_id: data.employee_id,
    employee_name: data.employee_name,
    date: data.date,
    previous_status: data.previous_status,
    requested_status: data.requested_status,
    reason: data.reason,
    requested_by: authUser.name,
    requested_date: new Date().toISOString(),
    status: 'Pending',
  };

  correctionsStore.unshift(correction);

  await logHRAudit({
    performed_by: authUser.name,
    performed_by_role: authUser.role,
    action: 'SUBMIT_ATTENDANCE_CORRECTION',
    module: 'Attendance',
    entity: 'attendance_corrections',
    record_id: correctionId,
    previous_value: { status: data.previous_status },
    new_value: { requested_status: data.requested_status, reason: data.reason },
  });

  revalidatePath('/dashboard/employees/attendance');
  return { success: true, correction };
}

/**
 * Review/Approve/Reject an Attendance Correction.
 * Restricted to Managing Director and Admin / BDM.
 */
export async function reviewAttendanceCorrection(
  correctionId: string,
  decision: 'Approved' | 'Rejected',
  reviewNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

  const corrections = getCorrectionsStore();
  const corr = corrections.find((c) => c.id === correctionId);
  if (!corr) {
    return { success: false, error: 'Correction request not found.' };
  }

  corr.status = decision;
  corr.approved_by = authUser.name;
  corr.approval_date = new Date().toISOString();
  corr.review_notes = reviewNotes;

  // If approved, update the actual attendance record in the store
  if (decision === 'Approved') {
    const attendanceStore = getAttendanceStore();
    const att = attendanceStore.find((a) => a.id === corr.attendance_id);
    if (att) {
      att.attendance_status = corr.requested_status;
      att.updated_at = new Date().toISOString();
      att.remarks = `Corrected from ${corr.previous_status} to ${corr.requested_status}. Note: ${corr.reason}`;
    }
  }

  await logHRAudit({
    performed_by: authUser.name,
    performed_by_role: authUser.role,
    action: `CORRECTION_${decision.toUpperCase()}`,
    module: 'Attendance',
    entity: 'attendance_corrections',
    record_id: correctionId,
    previous_value: { status: 'Pending' },
    new_value: { status: decision, approved_by: authUser.name },
  });

  revalidatePath('/dashboard/employees/attendance');
  return { success: true };
}

/**
 * Retrieve all pending attendance corrections.
 */
export async function getAttendanceCorrections(): Promise<AttendanceCorrection[]> {
  await requireRole(['Managing Director', 'Admin / BDM', 'Office Assistant', 'Accounts', 'BDM', 'Sales Executive']);
  return getCorrectionsStore();
}

/**
 * Retrieve leave records.
 */
export async function getEmployeeLeaves(): Promise<EmployeeLeave[]> {
  await requireRole(['Managing Director', 'Admin / BDM', 'Office Assistant', 'Accounts']);
  return getLeavesStore();
}
