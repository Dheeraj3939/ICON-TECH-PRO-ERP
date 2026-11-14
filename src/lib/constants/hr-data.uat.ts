import type {
  AttendanceCorrection,
  Employee,
  EmployeeAttendance,
  EmployeeDocument,
  EmployeeLeave,
  EmployeeSalaryHistory,
  HRAuditEvent,
  OfferLetter,
  PayrollItem,
  PayrollRun,
  Payslip,
} from '@/types/hr';

// UAT-only HR fallback data. Payroll remains outside the approved UAT scope.
export const INITIAL_EMPLOYEES = [
  {
    id: 'UAT-EMPLOYEE-001',
    employee_id: 'UAT-E001',
    full_name: 'UAT Test Employee 001',
    gender: 'UNSPECIFIED',
    phone: '0000000000',
    corporate_email: 'employee001@example.invalid',
    personal_email: null,
    department: 'UAT TEST',
    designation: 'UAT Test User',
    employment_type: 'TEST',
    joining_date: '2026-09-30',
    work_location_type: 'TEST',
    status: 'ACTIVE',
    probation_status: 'NOT_APPLICABLE',
    skills: [],
    notes: 'Synthetic UAT-only fallback record.',
  },
] as unknown as Employee[];

export const INITIAL_SALARIES: EmployeeSalaryHistory[] = [];
export const INITIAL_ATTENDANCE: EmployeeAttendance[] = [];
export const INITIAL_CORRECTIONS: AttendanceCorrection[] = [];
export const INITIAL_LEAVES: EmployeeLeave[] = [];
export const INITIAL_PAYROLL_RUNS: PayrollRun[] = [];
export const INITIAL_PAYROLL_ITEMS: PayrollItem[] = [];
export const INITIAL_PAYSLIPS: Payslip[] = [];
export const INITIAL_OFFER_LETTERS: OfferLetter[] = [];
export const INITIAL_DOCUMENTS: EmployeeDocument[] = [];
export const INITIAL_HR_AUDIT_EVENTS: HRAuditEvent[] = [];
