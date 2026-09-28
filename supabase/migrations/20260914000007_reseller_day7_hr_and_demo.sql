-- ==============================================================================
-- ICON TECH PRO ERP - MIGRATION 20260914000007
-- RESELLER DAY 7: HR & EMPLOYEE MANAGEMENT + DEMO FEATURE REGISTRY
-- 100% ADDITIVE & NON-DESTRUCTIVE
-- ==============================================================================

-- 1. Sequences for Collision-Safe Document Numbering
CREATE SEQUENCE IF NOT EXISTS employee_id_seq START WITH 10 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS payslip_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS offer_letter_seq START WITH 1 INCREMENT BY 1;

-- 2. Employee Master Table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL, -- e.g., 'EMP-0001'
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  date_of_birth DATE,
  phone TEXT NOT NULL,
  personal_email TEXT,
  corporate_email TEXT UNIQUE NOT NULL,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  department TEXT NOT NULL,
  designation TEXT NOT NULL,
  employment_type TEXT NOT NULL CHECK (
    employment_type IN ('Full Time', 'Part Time', 'Contract', 'Temporary', 'Intern', 'Site Staff', 'Technician', 'Installer', 'Service Engineer', 'Other')
  ),
  joining_date DATE NOT NULL,
  work_location_type TEXT NOT NULL CHECK (
    work_location_type IN ('Office', 'Site', 'Field', 'Hybrid', 'Remote', 'Other')
  ),
  current_site_assignment TEXT,
  reporting_manager_id UUID REFERENCES employees(id),
  status TEXT NOT NULL CHECK (
    status IN ('Active', 'On Leave', 'Notice Period', 'Inactive', 'Resigned', 'Terminated', 'Completed Contract')
  ) DEFAULT 'Active',
  probation_status TEXT CHECK (probation_status IN ('On Probation', 'Confirmed', 'Extended')) DEFAULT 'Confirmed',
  confirmation_date DATE,
  skills TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_work_location ON employees(work_location_type);
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);

-- 3. Employee Salary History Table (Confidential - Accounts & MD/Admin only)
CREATE TABLE IF NOT EXISTS employee_salary_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  hra NUMERIC(12, 2) NOT NULL DEFAULT 0,
  conveyance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  special_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  other_allowances NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gross_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pf NUMERIC(12, 2) NOT NULL DEFAULT 0,
  esi NUMERIC(12, 2) NOT NULL DEFAULT 0,
  professional_tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tds NUMERIC(12, 2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ctc NUMERIC(12, 2) NOT NULL DEFAULT 0,
  revision_reason TEXT,
  approved_by TEXT,
  approval_date DATE,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_history_employee ON employee_salary_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_history_current ON employee_salary_history(employee_id, is_current);

-- 4. Employee Attendance Table (Office & Site - Manisha, Admin, MD, Employee)
CREATE TABLE IF NOT EXISTS employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  work_location TEXT NOT NULL CHECK (work_location IN ('Office', 'Site', 'Field', 'Remote', 'Hybrid')),
  site_project_name TEXT,
  customer_id TEXT,
  check_in TIME,
  check_out TIME,
  total_hours NUMERIC(4, 2) DEFAULT 0,
  attendance_status TEXT NOT NULL CHECK (
    attendance_status IN ('Present', 'Absent', 'Half Day', 'Leave', 'Holiday', 'Weekly Off', 'Work From Home', 'Site Duty', 'On Duty', 'Late', 'Permission')
  ),
  overtime_hours NUMERIC(4, 2) DEFAULT 0,
  remarks TEXT,
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON employee_attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON employee_attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON employee_attendance(attendance_status);

-- 5. Attendance Corrections Workflow Table
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES employee_attendance(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  requested_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
  approved_by TEXT,
  approval_date TIMESTAMPTZ,
  review_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_status ON attendance_corrections(status);

-- 6. Leave Management Table
CREATE TABLE IF NOT EXISTS employee_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('Casual Leave', 'Sick Leave', 'Earned Leave', 'Unpaid Leave', 'Other')),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  number_of_days NUMERIC(4, 1) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')) DEFAULT 'Pending',
  approved_by TEXT,
  approval_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaves_employee ON employee_leaves(employee_id);

-- 7. Payroll Runs (Monthly Batches)
CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_code TEXT UNIQUE NOT NULL, -- e.g. 'PAYROLL-2026-09'
  payroll_month TEXT NOT NULL,       -- format 'YYYY-MM'
  total_employees INTEGER NOT NULL DEFAULT 0,
  total_gross NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_net_payout NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Calculated', 'Reviewed', 'Approved', 'Paid', 'Cancelled')) DEFAULT 'Draft',
  processed_by TEXT NOT NULL,
  payment_date DATE,
  payment_reference TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_month ON payroll_runs(payroll_month);

-- 8. Payroll Items (Per Employee breakdown per run)
CREATE TABLE IF NOT EXISTS payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  working_days INTEGER NOT NULL DEFAULT 30,
  present_days NUMERIC(4, 1) NOT NULL DEFAULT 30,
  paid_days NUMERIC(4, 1) NOT NULL DEFAULT 30,
  unpaid_days NUMERIC(4, 1) NOT NULL DEFAULT 0,
  basic NUMERIC(12, 2) NOT NULL DEFAULT 0,
  hra NUMERIC(12, 2) NOT NULL DEFAULT 0,
  conveyance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gross_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pf_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
  esi_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pt_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tds_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  UNIQUE(payroll_run_id, employee_id)
);

-- 9. Payslips Table (Sequential e.g. PAY/26-27/0001)
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_number TEXT UNIQUE NOT NULL,
  payroll_run_id UUID REFERENCES payroll_runs(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  payroll_month TEXT NOT NULL,
  gross_salary NUMERIC(12, 2) NOT NULL,
  total_deductions NUMERIC(12, 2) NOT NULL,
  net_salary NUMERIC(12, 2) NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_month ON payslips(payroll_month);

-- 10. Offer Letters Table (Sequential e.g. OFF/26-27/0001)
CREATE TABLE IF NOT EXISTS offer_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_letter_number TEXT UNIQUE NOT NULL,
  candidate_name TEXT NOT NULL,
  employee_id UUID REFERENCES employees(id),
  offer_date DATE NOT NULL,
  joining_date DATE NOT NULL,
  designation TEXT NOT NULL,
  department TEXT NOT NULL,
  work_location TEXT NOT NULL,
  annual_ctc NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Issued', 'Accepted', 'Rejected', 'Withdrawn')) DEFAULT 'Draft',
  file_url TEXT,
  created_by TEXT NOT NULL,
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Employee Documents Table with Classification
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('NORMAL', 'CONFIDENTIAL', 'FINANCIAL', 'RESTRICTED')) DEFAULT 'NORMAL',
  uploaded_by TEXT NOT NULL,
  expiry_date DATE,
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_docs_employee ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_docs_sensitivity ON employee_documents(sensitivity);

-- 12. HR Audit Events Table
CREATE TABLE IF NOT EXISTS hr_audit_events (
  id BIGSERIAL PRIMARY KEY,
  performed_by TEXT NOT NULL,
  performed_by_role TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL DEFAULT 'HR',
  entity TEXT NOT NULL,
  record_id TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_audit_entity ON hr_audit_events(entity, record_id);
CREATE INDEX IF NOT EXISTS idx_hr_audit_timestamp ON hr_audit_events(timestamp DESC);

-- 13. Dynamic Demo Feature Registry Table
CREATE TABLE IF NOT EXISTS demo_feature_registry (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'TESTED', 'IN_PROGRESS', 'BETA')) DEFAULT 'ACTIVE',
  version TEXT NOT NULL DEFAULT 'v1.0',
  added_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  demo_route TEXT NOT NULL,
  demo_enabled BOOLEAN DEFAULT TRUE,
  notes TEXT
);

-- 14. Row-Level Security (RLS) Configuration
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_feature_registry ENABLE ROW LEVEL SECURITY;

-- Permissive authenticated read for demo & production under application role filtering
CREATE POLICY "Allow authenticated read on employees" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on demo_registry" ON demo_feature_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public read on demo_registry" ON demo_feature_registry FOR SELECT TO anon USING (true);
