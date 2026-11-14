'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { findByIdOrCode, isUuid, sanitizeUuid } from '@/lib/supabase/db-helpers';
import { logHRAudit } from '@/lib/actions/employees';
import {
  INITIAL_SALARIES,
  INITIAL_PAYROLL_RUNS,
  INITIAL_PAYSLIPS,
  INITIAL_EMPLOYEES,
} from '@/lib/constants/hr-data';
import type {
  EmployeeSalaryHistory,
  PayrollRun,
  PayrollItem,
  Payslip,
} from '@/types/hr';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_SALARIES_STORE__: EmployeeSalaryHistory[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_PAYROLL_RUNS_STORE__: PayrollRun[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_PAYSLIPS_STORE__: Payslip[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_PAYSLIP_SEQ__: number | undefined;
}

function getSalariesStore(): EmployeeSalaryHistory[] {
  if (!globalThis.__ICON_SALARIES_STORE__) {
    globalThis.__ICON_SALARIES_STORE__ = [...INITIAL_SALARIES];
  }
  return globalThis.__ICON_SALARIES_STORE__;
}

function getPayrollRunsStore(): PayrollRun[] {
  if (!globalThis.__ICON_PAYROLL_RUNS_STORE__) {
    globalThis.__ICON_PAYROLL_RUNS_STORE__ = [...INITIAL_PAYROLL_RUNS];
  }
  return globalThis.__ICON_PAYROLL_RUNS_STORE__;
}

function getPayslipsStore(): Payslip[] {
  if (!globalThis.__ICON_PAYSLIPS_STORE__) {
    globalThis.__ICON_PAYSLIPS_STORE__ = [...INITIAL_PAYSLIPS];
  }
  return globalThis.__ICON_PAYSLIPS_STORE__;
}

function getNextPayslipNumber(): string {
  if (!globalThis.__ICON_PAYSLIP_SEQ__) {
    globalThis.__ICON_PAYSLIP_SEQ__ = 8;
  }
  const seq = globalThis.__ICON_PAYSLIP_SEQ__++;
  return `PAY/26-27/${String(seq).padStart(4, '0')}`;
}

/**
 * Retrieve active salary records.
 * STRICTLY RESTRICTED TO: Managing Director, Admin / BDM, Accounts.
 * FORBIDDEN TO: Office Assistant (Manisha), Sales Executive (Reshma), BDM (Vineeth).
 */
export async function getSalaries(employeeId?: string): Promise<EmployeeSalaryHistory[]> {
  await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      let query = admin
        .from('employee_salary_history')
        .select('*')
        .order('effective_from', { ascending: false });
      if (employeeId) {
        if (isUuid(employeeId)) {
          query = query.eq('employee_id', employeeId);
        } else {
          const emp = await findByIdOrCode<{ id: string }>(admin, 'employees', employeeId, 'employee_id', 'id');
          if (emp?.id) query = query.eq('employee_id', emp.id);
        }
      } else {
        query = query.eq('is_current', true);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data as EmployeeSalaryHistory[];
      }
    } catch {
      // Fallback
    }
  }

  const store = getSalariesStore();
  if (employeeId) {
    return store.filter((s) => s.employee_id === employeeId);
  }
  return store.filter((s) => s.is_current);
}

/**
 * Retrieve salary history for an employee (immutable revisions).
 * STRICTLY RESTRICTED TO: Managing Director, Admin / BDM, Accounts.
 */
export async function getEmployeeSalaryHistory(
  employeeId: string
): Promise<EmployeeSalaryHistory[]> {
  return getSalaries(employeeId);
}

/**
 * Create or revise employee salary.
 * Creates an immutable historical revision, archiving previous current record.
 * STRICTLY RESTRICTED TO: Managing Director, Admin / BDM, Accounts.
 */
export async function updateEmployeeSalary(data: {
  employee_id: string;
  effective_from: string;
  basic_salary: number;
  hra: number;
  conveyance: number;
  special_allowance: number;
  other_allowances?: number;
  pf: number;
  esi: number;
  professional_tax: number;
  tds: number;
  other_deductions?: number;
  revision_reason: string;
}): Promise<{ success: boolean; salary?: EmployeeSalaryHistory; error?: string }> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

  const store = getSalariesStore();

  // Archive existing current record for this employee
  store.forEach((s) => {
    if (s.employee_id === data.employee_id && s.is_current) {
      s.is_current = false;
    }
  });

  const gross =
    data.basic_salary +
    data.hra +
    data.conveyance +
    data.special_allowance +
    (data.other_allowances || 0);

  const deductions =
    data.pf +
    data.esi +
    data.professional_tax +
    data.tds +
    (data.other_deductions || 0);

  const net = gross - deductions;
  const ctc = gross + Math.round(data.pf * 1.08); // Include employer contribution approximation

  const newRecord: EmployeeSalaryHistory = {
    id: `SAL-${Date.now().toString().slice(-6)}`,
    employee_id: data.employee_id,
    effective_from: data.effective_from,
    basic_salary: data.basic_salary,
    hra: data.hra,
    conveyance: data.conveyance,
    special_allowance: data.special_allowance,
    other_allowances: data.other_allowances || 0,
    gross_salary: gross,
    pf: data.pf,
    esi: data.esi,
    professional_tax: data.professional_tax,
    tds: data.tds,
    other_deductions: data.other_deductions || 0,
    total_deductions: deductions,
    net_salary: net,
    ctc: ctc,
    revision_reason: data.revision_reason,
    approved_by: authUser.name,
    approval_date: new Date().toISOString().split('T')[0],
    is_current: true,
    created_at: new Date().toISOString(),
  };

  store.unshift(newRecord);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      let resolvedEmpId = sanitizeUuid(data.employee_id);
      if (!resolvedEmpId) {
        const emp = await findByIdOrCode<{ id: string }>(admin, 'employees', data.employee_id, 'employee_id', 'id');
        resolvedEmpId = emp?.id || null;
      }
      if (resolvedEmpId) {
        await admin
          .from('employee_salary_history')
          .update({ is_current: false })
          .eq('employee_id', resolvedEmpId)
          .eq('is_current', true);
        const { data: insertedSal } = await admin
          .from('employee_salary_history')
          .insert({
            employee_id: resolvedEmpId,
            effective_from: newRecord.effective_from,
            basic_salary: newRecord.basic_salary,
            hra: newRecord.hra,
            conveyance: newRecord.conveyance,
            special_allowance: newRecord.special_allowance,
            other_allowances: newRecord.other_allowances,
            gross_salary: newRecord.gross_salary,
            pf: newRecord.pf,
            esi: newRecord.esi,
            professional_tax: newRecord.professional_tax,
            tds: newRecord.tds,
            other_deductions: newRecord.other_deductions,
            total_deductions: newRecord.total_deductions,
            net_salary: newRecord.net_salary,
            ctc: newRecord.ctc,
            revision_reason: newRecord.revision_reason,
            approved_by: newRecord.approved_by,
            approval_date: newRecord.approval_date,
            is_current: true,
          })
          .select('id')
          .single();
        if (insertedSal?.id) newRecord.id = insertedSal.id;
      }
    } catch {
      // Non-fatal fallback
    }
  }

  await logHRAudit({
    performed_by: authUser.name,
    performed_by_role: authUser.role,
    action: 'REVISE_SALARY',
    module: 'Salary & Payroll',
    entity: 'employee_salary_history',
    record_id: data.employee_id,
    previous_value: null,
    new_value: { gross_salary: gross, net_salary: net, reason: data.revision_reason },
  });

  revalidatePath('/dashboard/employees/payroll');
  return { success: true, salary: newRecord };
}

/**
 * Retrieve monthly payroll runs.
 * Authorized for: Managing Director, Admin / BDM, Accounts.
 */
export async function getPayrollRuns(): Promise<PayrollRun[]> {
  await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('payroll_runs')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data as PayrollRun[];
    } catch {
      // Fallback
    }
  }
  return getPayrollRunsStore();
}

/**
 * Generate monthly payroll batch.
 * Computes earnings and deductions for all active employees.
 * Authorized for: Accounts (Hemalatha), Admin / BDM, MD.
 */
export async function createPayrollRun(payrollMonth: string): Promise<{
  success: boolean;
  payrollRun?: PayrollRun;
  error?: string;
}> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

  const runs = await getPayrollRuns();
  const existing = runs.find((r) => r.payroll_month === payrollMonth);
  if (existing) {
    return { success: false, error: `Payroll for ${payrollMonth} already exists.` };
  }

  const allSalaries = await getSalaries();
  const salaries = allSalaries.filter((s) => s.is_current);
  const totalGross = salaries.reduce((acc, s) => acc + s.gross_salary, 0);
  const totalDed = salaries.reduce((acc, s) => acc + s.total_deductions, 0);
  const totalNet = totalGross - totalDed;

  const runId = `PAYROLL-${payrollMonth}`;
  const newRun: PayrollRun = {
    id: runId,
    payroll_code: runId,
    payroll_month: payrollMonth,
    total_employees: salaries.length,
    total_gross: totalGross,
    total_deductions: totalDed,
    total_net_payout: totalNet,
    status: 'Calculated',
    processed_by: authUser.name,
    remarks: `Batch generated for ${payrollMonth} across ${salaries.length} staff members.`,
    created_at: new Date().toISOString(),
  };

  getPayrollRunsStore().unshift(newRun);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data: insertedRun } = await admin
        .from('payroll_runs')
        .insert({
          payroll_code: newRun.payroll_code,
          payroll_month: newRun.payroll_month,
          total_employees: newRun.total_employees,
          total_gross: newRun.total_gross,
          total_deductions: newRun.total_deductions,
          total_net_payout: newRun.total_net_payout,
          status: newRun.status,
          processed_by: newRun.processed_by,
          remarks: newRun.remarks,
        })
        .select('id')
        .single();
      if (insertedRun?.id) newRun.id = insertedRun.id;
    } catch {
      // Non-fatal fallback
    }
  }

  await logHRAudit({
    performed_by: authUser.name,
    performed_by_role: authUser.role,
    action: 'CREATE_PAYROLL_RUN',
    module: 'Salary & Payroll',
    entity: 'payroll_runs',
    record_id: runId,
    previous_value: null,
    new_value: { month: payrollMonth, count: salaries.length, net: totalNet },
  });

  revalidatePath('/dashboard/employees/payroll');
  return { success: true, payrollRun: newRun };
}

/**
 * Update payroll status (Review, Approve, Mark Paid).
 * Authorized for: Managing Director, Admin / BDM, Accounts.
 */
export async function updatePayrollStatus(
  runId: string,
  status: PayrollRun['status'],
  paymentRef?: string
): Promise<{ success: boolean; error?: string }> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

  const runs = await getPayrollRuns();
  const run = runs.find((r) => r.id === runId || r.payroll_code === runId);
  if (!run) {
    return { success: false, error: 'Payroll run not found.' };
  }

  if (run.status === 'Paid' && status !== 'Paid') {
    return { success: false, error: 'Paid payroll cannot be silently revised or cancelled.' };
  }

  const prevStatus = run.status;
  run.status = status;
  if (status === 'Paid') {
    run.payment_date = new Date().toISOString().split('T')[0];
    run.payment_reference = paymentRef || `HDFC-NEFT-${Date.now().toString().slice(-8)}`;
  }

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const upQ = admin.from('payroll_runs').update({
        status: run.status,
        payment_date: run.payment_date || null,
        payment_reference: run.payment_reference || null,
      });
      await (isUuid(run.id) ? upQ.eq('id', run.id) : upQ.eq('payroll_code', run.payroll_code));
    } catch {
      // Non-fatal fallback
    }
  }

  await logHRAudit({
    performed_by: authUser.name,
    performed_by_role: authUser.role,
    action: `PAYROLL_STATUS_${status.toUpperCase()}`,
    module: 'Salary & Payroll',
    entity: 'payroll_runs',
    record_id: runId,
    previous_value: { status: prevStatus },
    new_value: { status, paymentRef: run.payment_reference },
  });

  revalidatePath('/dashboard/employees/payroll');
  return { success: true };
}

/**
 * Retrieve payslips.
 * Authorized for: Accounts, Managing Director, Admin.
 */
export async function getPayslips(filters?: {
  month?: string;
  employeeId?: string;
}): Promise<Payslip[]> {
  await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      let query = admin
        .from('payslips')
        .select('*, employees(full_name, designation)')
        .order('generated_at', { ascending: false });
      if (filters?.month && filters.month !== 'ALL') {
        query = query.ilike('payroll_month', `%${filters.month}%`);
      }
      if (filters?.employeeId && filters.employeeId !== 'ALL' && isUuid(filters.employeeId)) {
        query = query.eq('employee_id', filters.employeeId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map((p: any) => ({
          ...p,
          employee_name: p.employees?.full_name || p.employee_name || 'Employee',
          designation: p.employees?.designation || p.designation || '',
        })) as Payslip[];
      }
    } catch {
      // Fallback
    }
  }

  let slips = getPayslipsStore();
  if (filters?.month && filters.month !== 'ALL') {
    slips = slips.filter((p) => p.payroll_month.includes(filters.month!));
  }
  if (filters?.employeeId && filters.employeeId !== 'ALL') {
    slips = slips.filter((p) => p.employee_id === filters.employeeId);
  }
  return slips;
}

/**
 * Generate sequential payslip for an employee.
 * Format: PAY/26-27/0001
 * Authorized for: Accounts, Admin, MD.
 */
export async function generatePayslip(data: {
  employee_id: string;
  payroll_month: string;
}): Promise<{ success: boolean; payslip?: Payslip; error?: string }> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

  const salaries = getSalariesStore();
  const currentSal = salaries.find((s) => s.employee_id === data.employee_id && s.is_current);
  if (!currentSal) {
    return { success: false, error: 'No active salary structure found for employee.' };
  }

  const emp = INITIAL_EMPLOYEES.find(
    (e) => e.id === data.employee_id || e.employee_id === data.employee_id
  );
  if (!emp) {
    return { success: false, error: 'Employee not found.' };
  }

  const payslips = getPayslipsStore();
  const existing = payslips.find(
    (p) => p.employee_id === data.employee_id && p.payroll_month === data.payroll_month
  );
  if (existing) {
    return { success: true, payslip: existing };
  }

  const payslipNum = getNextPayslipNumber();
  const newPayslip: Payslip = {
    id: `PS-${Date.now().toString().slice(-6)}`,
    payslip_number: payslipNum,
    employee_id: data.employee_id,
    employee_name: emp.full_name,
    employee_code: emp.employee_id,
    designation: emp.designation,
    department: emp.department,
    joining_date: emp.joining_date,
    payroll_month: data.payroll_month,
    basic: currentSal.basic_salary,
    hra: currentSal.hra,
    conveyance: currentSal.conveyance,
    allowances: currentSal.special_allowance + currentSal.other_allowances,
    gross_salary: currentSal.gross_salary,
    pf: currentSal.pf,
    esi: currentSal.esi,
    pt: currentSal.professional_tax,
    tds: currentSal.tds,
    total_deductions: currentSal.total_deductions,
    net_salary: currentSal.net_salary,
    generated_at: new Date().toISOString(),
  };

  payslips.unshift(newPayslip);

  await logHRAudit({
    performed_by: authUser.name,
    performed_by_role: authUser.role,
    action: 'GENERATE_PAYSLIP',
    module: 'Salary & Payroll',
    entity: 'payslips',
    record_id: payslipNum,
    previous_value: null,
    new_value: { employee: emp.full_name, net: newPayslip.net_salary },
  });

  revalidatePath('/dashboard/employees/payslips');
  return { success: true, payslip: newPayslip };
}
