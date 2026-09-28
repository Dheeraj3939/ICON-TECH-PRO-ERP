export type Gender = 'Male' | 'Female' | 'Other';

export type EmploymentType =
  | 'Full Time'
  | 'Part Time'
  | 'Contract'
  | 'Temporary'
  | 'Intern'
  | 'Site Staff'
  | 'Technician'
  | 'Installer'
  | 'Service Engineer'
  | 'Other';

export type EmployeeStatus =
  | 'Active'
  | 'On Leave'
  | 'Notice Period'
  | 'Inactive'
  | 'Resigned'
  | 'Terminated'
  | 'Completed Contract';

export type WorkLocationType =
  | 'Office'
  | 'Site'
  | 'Field'
  | 'Hybrid'
  | 'Remote'
  | 'Other';

export type AttendanceStatus =
  | 'Present'
  | 'Absent'
  | 'Half Day'
  | 'Leave'
  | 'Holiday'
  | 'Weekly Off'
  | 'Work From Home'
  | 'Site Duty'
  | 'On Duty'
  | 'Late'
  | 'Permission';

export type CorrectionStatus = 'Pending' | 'Approved' | 'Rejected';

export type LeaveType =
  | 'Casual Leave'
  | 'Sick Leave'
  | 'Earned Leave'
  | 'Unpaid Leave'
  | 'Other';

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export type PayrollStatus =
  | 'Draft'
  | 'Calculated'
  | 'Reviewed'
  | 'Approved'
  | 'Paid'
  | 'Cancelled';

export type OfferLetterStatus =
  | 'Draft'
  | 'Issued'
  | 'Accepted'
  | 'Rejected'
  | 'Withdrawn';

export type DocumentSensitivity =
  | 'NORMAL'
  | 'CONFIDENTIAL'
  | 'FINANCIAL'
  | 'RESTRICTED';

export type DocumentType =
  | 'Offer Letter'
  | 'Appointment Letter'
  | 'ID Proof'
  | 'Address Proof'
  | 'Resume'
  | 'Qualification Certificate'
  | 'Experience Certificate'
  | 'Salary Revision Letter'
  | 'Payslip'
  | 'Bank Document'
  | 'Other HR Document';

export interface Employee {
  id: string;
  employee_id: string; // e.g. 'EMP-0001'
  user_id?: string | null;
  full_name: string;
  gender?: Gender;
  date_of_birth?: string;
  phone: string;
  personal_email?: string;
  corporate_email: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  department: string;
  designation: string;
  employment_type: EmploymentType;
  joining_date: string;
  work_location_type: WorkLocationType;
  current_site_assignment?: string | null;
  reporting_manager_id?: string | null;
  reporting_manager_name?: string | null;
  status: EmployeeStatus;
  probation_status?: 'On Probation' | 'Confirmed' | 'Extended';
  confirmation_date?: string;
  skills: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeSalaryHistory {
  id: string;
  employee_id: string;
  effective_from: string;
  basic_salary: number;
  hra: number;
  conveyance: number;
  special_allowance: number;
  other_allowances: number;
  gross_salary: number;
  pf: number;
  esi: number;
  professional_tax: number;
  tds: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  ctc: number;
  revision_reason?: string;
  approved_by?: string;
  approval_date?: string;
  is_current: boolean;
  created_at: string;
}

export interface EmployeeAttendance {
  id: string;
  employee_id: string;
  employee_name?: string;
  date: string; // YYYY-MM-DD
  work_location: WorkLocationType;
  site_project_name?: string;
  customer_id?: string;
  check_in?: string;
  check_out?: string;
  total_hours: number;
  attendance_status: AttendanceStatus;
  overtime_hours: number;
  remarks?: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceCorrection {
  id: string;
  attendance_id: string;
  employee_id: string;
  employee_name?: string;
  date?: string;
  previous_status: AttendanceStatus;
  requested_status: AttendanceStatus;
  reason: string;
  requested_by: string;
  requested_date: string;
  status: CorrectionStatus;
  approved_by?: string;
  approval_date?: string;
  review_notes?: string;
}

export interface EmployeeLeave {
  id: string;
  employee_id: string;
  employee_name?: string;
  leave_type: LeaveType;
  from_date: string;
  to_date: string;
  number_of_days: number;
  reason: string;
  status: LeaveStatus;
  approved_by?: string;
  approval_date?: string;
  created_at: string;
}

export interface PayrollRun {
  id: string;
  payroll_code: string; // e.g. 'PAYROLL-2026-09'
  payroll_month: string; // YYYY-MM
  total_employees: number;
  total_gross: number;
  total_deductions: number;
  total_net_payout: number;
  status: PayrollStatus;
  processed_by: string;
  payment_date?: string;
  payment_reference?: string;
  remarks?: string;
  created_at: string;
}

export interface PayrollItem {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  employee_name?: string;
  designation?: string;
  working_days: number;
  present_days: number;
  paid_days: number;
  unpaid_days: number;
  basic: number;
  hra: number;
  conveyance: number;
  allowances: number;
  gross_salary: number;
  pf_deduction: number;
  esi_deduction: number;
  pt_deduction: number;
  tds_deduction: number;
  total_deductions: number;
  net_salary: number;
}

export interface Payslip {
  id: string;
  payslip_number: string; // e.g. 'PAY/26-27/0001'
  payroll_run_id?: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  designation: string;
  department: string;
  joining_date?: string;
  payroll_month: string;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  basic?: number;
  hra?: number;
  conveyance?: number;
  allowances?: number;
  pf?: number;
  esi?: number;
  pt?: number;
  tds?: number;
  generated_at: string;
}

export interface OfferLetter {
  id: string;
  offer_letter_number: string; // e.g. 'OFF/26-27/0001'
  candidate_name: string;
  employee_id?: string;
  offer_date: string;
  joining_date: string;
  designation: string;
  department: string;
  work_location: string;
  annual_ctc: number;
  status: OfferLetterStatus;
  file_url?: string;
  created_by: string;
  approved_by?: string;
  created_at: string;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  employee_name?: string;
  document_type: DocumentType;
  document_name: string;
  file_url: string;
  sensitivity: DocumentSensitivity;
  uploaded_by: string;
  expiry_date?: string;
  notes?: string;
  uploaded_at: string;
}

export interface HRAuditEvent {
  id: number;
  performed_by: string;
  performed_by_role: string;
  action: string;
  module: string;
  entity: string;
  record_id: string;
  previous_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  timestamp: string;
}

export interface DemoFeatureRegistryItem {
  id: string;
  module: string;
  feature_name: string;
  description: string;
  status: 'ACTIVE' | 'TESTED' | 'IN_PROGRESS' | 'BETA';
  version: string;
  added_date: string;
  last_updated: string;
  demo_route: string;
  demo_enabled: boolean;
  notes?: string;
}
