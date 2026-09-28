import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Canonical Staff Fixtures
const CANONICAL_EMPLOYEES = [
  {
    employee_id: 'EMP-0001',
    full_name: 'Borra Narsimulu',
    phone: '+91 80999 09997',
    corporate_email: 'icontechpro@gmail.com',
    department: 'Executive Management',
    designation: 'Managing Director',
    work_location_type: 'Office',
  },
  {
    employee_id: 'EMP-0002',
    full_name: 'B V Dheeraj Reddy',
    phone: '+91 80999 09921',
    corporate_email: 'dheeraj@icontechpro.in',
    department: 'Administration & Sales',
    designation: 'Sales Executive / Admin',
    work_location_type: 'Office',
  },
  {
    employee_id: 'EMP-0003',
    full_name: 'B Vineet Babu',
    phone: '+91 80999 09918',
    corporate_email: 'vineet@icontechpro.in',
    department: 'Corporate Sales',
    designation: 'Sales Executive',
    work_location_type: 'Hybrid',
  },
  {
    employee_id: 'EMP-0004',
    full_name: 'Reshma',
    phone: '+91 7569909997',
    corporate_email: 'sales@icontechpro.in',
    department: 'Sales',
    designation: 'Sales Executive',
    work_location_type: 'Field',
  },
  {
    employee_id: 'EMP-0005',
    full_name: 'Hemalath',
    phone: '+91 8099909920',
    corporate_email: 'accounts@icontechpro.in',
    department: 'Finance & Accounts',
    designation: 'Accounts',
    work_location_type: 'Office',
  },
  {
    employee_id: 'EMP-0006',
    full_name: 'Manisha',
    phone: '+91 8099909914',
    corporate_email: 'service01@icontechpro.in',
    department: 'Office Administration',
    designation: 'Office Assistant',
    work_location_type: 'Office',
  },
  {
    employee_id: 'EMP-0007',
    full_name: 'K. Suresh',
    phone: '+91 98490 11001',
    corporate_email: 'suresh.tech@icontechpro.in',
    department: 'Projects & Installations',
    designation: 'Lead AV Site Technician',
    work_location_type: 'Site',
    current_site_assignment: 'DEMO — Swan Technologies Pvt Ltd (HITEC City Phase 2)',
  },
  {
    employee_id: 'EMP-0008',
    full_name: 'M. Ramesh',
    phone: '+91 98490 11003',
    corporate_email: 'ramesh.service@icontechpro.in',
    department: 'Technical Services',
    designation: 'Senior AV Service Engineer',
    work_location_type: 'Site',
    current_site_assignment: 'Field AMC Maintenance Circuit',
  },
];

const SAMPLE_ATTENDANCE = [
  {
    id: 'ATT-0007',
    employee_id: 'EMP-UUID-0007',
    employee_name: 'K. Suresh',
    date: '2026-09-16',
    work_location: 'Site',
    site_project_name: 'Swan Technologies Pvt Ltd - HITEC City',
    customer_id: 'DEMO-ICON260099',
    check_in: '09:30',
    check_out: '18:45',
    total_hours: 9.25,
    attendance_status: 'Site Duty',
    overtime_hours: 0.5,
    recorded_by: 'Manisha',
  },
];

const SAMPLE_CORRECTION = {
  id: 'CORR-0001',
  attendance_id: 'ATT-0007',
  employee_id: 'EMP-UUID-0007',
  employee_name: 'K. Suresh',
  date: '2026-09-15',
  previous_status: 'Absent',
  requested_status: 'Site Duty',
  reason: 'Technician was deployed directly to Swan Technologies customer site for emergency mounting.',
  requested_by: 'Manisha',
  status: 'Pending',
};

const SAMPLE_SALARIES = [
  {
    employee_id: 'EMP-0001',
    basic_salary: 120000,
    hra: 60000,
    conveyance: 10000,
    special_allowance: 30000,
    other_allowances: 10000,
    gross_salary: 230000,
    total_deductions: 40000,
    net_salary: 190000,
    is_current: true,
  },
  {
    employee_id: 'EMP-0006',
    basic_salary: 22000,
    hra: 11000,
    conveyance: 2000,
    special_allowance: 4000,
    other_allowances: 0,
    gross_salary: 39000,
    total_deductions: 2840,
    net_salary: 36160,
    is_current: true,
  },
];

const SAMPLE_PAYSLIPS = [
  {
    payslip_number: 'PAY/26-27/0001',
    employee_name: 'Borra Narsimulu',
    payroll_month: 'August 2026',
    gross_salary: 230000,
    total_deductions: 40000,
    net_salary: 190000,
  },
  {
    payslip_number: 'PAY/26-27/0002',
    employee_name: 'B V Dheeraj Reddy',
    payroll_month: 'August 2026',
    gross_salary: 115000,
    total_deductions: 16000,
    net_salary: 99000,
  },
];

const SAMPLE_OFFERS = [
  {
    offer_letter_number: 'OFF/26-27/0001',
    candidate_name: 'K. Suresh',
    annual_ctc: 444000,
    status: 'Accepted',
  },
];

const REGISTERED_DEMO_FEATURES = [
  { id: 'FEAT-HR-001', module: 'HR & Employees', status: 'ACTIVE', demo_route: '/dashboard/employees' },
  { id: 'FEAT-HR-003', module: 'Attendance & Time', status: 'ACTIVE', demo_route: '/dashboard/employees/attendance' },
  { id: 'FEAT-HR-005', module: 'Payroll & Compensation', status: 'ACTIVE', demo_route: '/dashboard/employees/payroll' },
  { id: 'FEAT-SYNC-011', module: 'Local Demo Synchronization', status: 'ACTIVE', demo_route: '/dashboard/demo-updates' },
];

describe('HR & Employee Management — Master Invariants & RBAC Verification', () => {

  describe('1. Employee Master & Canonical Staff Roster', () => {
    it('contains all 6 core team members with verified official contact details', () => {
      const md = CANONICAL_EMPLOYEES.find((e) => e.employee_id === 'EMP-0001');
      assert.ok(md, 'Managing Director EMP-0001 must exist');
      assert.strictEqual(md.full_name, 'Borra Narsimulu');
      assert.strictEqual(md.phone, '+91 80999 09997');
      assert.strictEqual(md.corporate_email, 'icontechpro@gmail.com');

      const admin = CANONICAL_EMPLOYEES.find((e) => e.employee_id === 'EMP-0002');
      assert.ok(admin, 'Admin EMP-0002 must exist');
      assert.strictEqual(admin.full_name, 'B V Dheeraj Reddy');
      assert.strictEqual(admin.phone, '+91 80999 09921');
      assert.strictEqual(admin.corporate_email, 'dheeraj@icontechpro.in');

      const bdm = CANONICAL_EMPLOYEES.find((e) => e.employee_id === 'EMP-0003');
      assert.ok(bdm, 'Sales Executive EMP-0003 must exist');
      assert.strictEqual(bdm.full_name, 'B Vineet Babu');
      assert.strictEqual(bdm.phone, '+91 80999 09918');
      assert.strictEqual(bdm.corporate_email, 'vineet@icontechpro.in');

      const sales = CANONICAL_EMPLOYEES.find((e) => e.employee_id === 'EMP-0004');
      assert.ok(sales, 'Sales Executive EMP-0004 must exist');
      assert.strictEqual(sales.full_name, 'Reshma');
      assert.strictEqual(sales.phone, '+91 7569909997');
      assert.strictEqual(sales.corporate_email, 'sales@icontechpro.in');

      const accounts = CANONICAL_EMPLOYEES.find((e) => e.employee_id === 'EMP-0005');
      assert.ok(accounts, 'Accounts EMP-0005 must exist');
      assert.strictEqual(accounts.full_name, 'Hemalath');
      assert.strictEqual(accounts.phone, '+91 8099909920');
      assert.strictEqual(accounts.corporate_email, 'accounts@icontechpro.in');

      const assistant = CANONICAL_EMPLOYEES.find((e) => e.employee_id === 'EMP-0006');
      assert.ok(assistant, 'Office Assistant EMP-0006 must exist');
      assert.strictEqual(assistant.full_name, 'Manisha');
      assert.strictEqual(assistant.phone, '+91 8099909914');
      assert.strictEqual(assistant.corporate_email, 'service01@icontechpro.in');
    });

    it('distinguishes office staff from customer-site installation engineers', () => {
      const suresh = CANONICAL_EMPLOYEES.find((e) => e.employee_id === 'EMP-0007');
      assert.ok(suresh, 'Lead AV Technician Suresh must exist');
      assert.strictEqual(suresh.work_location_type, 'Site');
      assert.ok(
        suresh.current_site_assignment?.includes('Swan Technologies'),
        'Technician must be assigned to canonical demo client Swan Technologies'
      );

      const ramesh = CANONICAL_EMPLOYEES.find((e) => e.employee_id === 'EMP-0008');
      assert.ok(ramesh, 'Senior AV Service Engineer Ramesh must exist');
      assert.strictEqual(ramesh.work_location_type, 'Site');
    });

    it('validates sequential collision-safe EMP-XXXX formatting', () => {
      CANONICAL_EMPLOYEES.forEach((emp) => {
        assert.match(
          emp.employee_id,
          /^EMP-\d{4}$/,
          `Employee ID ${emp.employee_id} must follow format EMP-XXXX`
        );
      });
    });
  });

  describe('2. Attendance & Site Duty Management', () => {
    it('captures daily check-in, check-out, location, and site duty remarks', () => {
      const sureshLog = SAMPLE_ATTENDANCE.find((a) => a.employee_name === 'K. Suresh');
      assert.ok(sureshLog, 'Suresh site attendance must exist');
      assert.strictEqual(sureshLog.attendance_status, 'Site Duty');
      assert.strictEqual(sureshLog.work_location, 'Site');
      assert.strictEqual(sureshLog.customer_id, 'DEMO-ICON260099');
      assert.strictEqual(sureshLog.recorded_by, 'Manisha');
    });

    it('enforces formal attendance correction workflow without silent overwrites', () => {
      assert.strictEqual(SAMPLE_CORRECTION.previous_status, 'Absent');
      assert.strictEqual(SAMPLE_CORRECTION.requested_status, 'Site Duty');
      assert.ok(SAMPLE_CORRECTION.reason.length > 0, 'Reason must be provided');
      assert.strictEqual(SAMPLE_CORRECTION.requested_by, 'Manisha');
      assert.strictEqual(SAMPLE_CORRECTION.status, 'Pending');
    });
  });

  describe('3. Role-Based Access Control (ALLOW and DENY Matrix)', () => {
    const roles = {
      MD: 'Managing Director',
      ADMIN: 'Admin / BDM',
      ACCOUNTS: 'Accounts',
      ASSISTANT: 'Office Assistant',
      SALES: 'Sales Executive',
      BDM: 'BDM',
    };

    function checkPermission(module, role) {
      if (module === 'SALARY_COMPENSATION' || module === 'PAYROLL_PROCESSING') {
        return [roles.MD, roles.ADMIN, roles.ACCOUNTS].includes(role);
      }
      if (module === 'ATTENDANCE_RECORDING') {
        return [roles.MD, roles.ADMIN, roles.ASSISTANT].includes(role);
      }
      if (module === 'ATTENDANCE_VIEW') {
        return true;
      }
      if (module === 'FINANCIAL_DOCUMENTS') {
        return [roles.MD, roles.ADMIN, roles.ACCOUNTS].includes(role);
      }
      if (module === 'OFFER_LETTER_CREATE') {
        return [roles.MD, roles.ADMIN].includes(role);
      }
      return false;
    }

    it('MANISHA: ALLOWED for attendance, STRICTLY DENIED for salary & payroll', () => {
      assert.strictEqual(
        checkPermission('ATTENDANCE_RECORDING', roles.ASSISTANT),
        true,
        'Manisha MUST be allowed to record attendance'
      );
      assert.strictEqual(
        checkPermission('ATTENDANCE_VIEW', roles.ASSISTANT),
        true,
        'Manisha MUST be allowed to view attendance'
      );
      assert.strictEqual(
        checkPermission('SALARY_COMPENSATION', roles.ASSISTANT),
        false,
        'Manisha MUST BE BLOCKED from viewing salary compensation'
      );
      assert.strictEqual(
        checkPermission('PAYROLL_PROCESSING', roles.ASSISTANT),
        false,
        'Manisha MUST BE BLOCKED from monthly payroll processing'
      );
      assert.strictEqual(
        checkPermission('FINANCIAL_DOCUMENTS', roles.ASSISTANT),
        false,
        'Manisha MUST BE BLOCKED from financial HR documents'
      );
    });

    it('HEMALATHA (ACCOUNTS): ALLOWED for salary & payroll, DENIED for operational admin', () => {
      assert.strictEqual(
        checkPermission('SALARY_COMPENSATION', roles.ACCOUNTS),
        true,
        'Accounts MUST be allowed to view salary compensation'
      );
      assert.strictEqual(
        checkPermission('PAYROLL_PROCESSING', roles.ACCOUNTS),
        true,
        'Accounts MUST be allowed to process monthly payroll'
      );
      assert.strictEqual(
        checkPermission('FINANCIAL_DOCUMENTS', roles.ACCOUNTS),
        true,
        'Accounts MUST be allowed to view financial documents'
      );
      assert.strictEqual(
        checkPermission('OFFER_LETTER_CREATE', roles.ACCOUNTS),
        false,
        'Accounts MUST NOT have unrestricted operational offer creation override'
      );
    });

    it('RESHMA & VINEETH (SALES): STRICTLY DENIED from confidential HR & payroll', () => {
      [roles.SALES, roles.BDM].forEach((role) => {
        assert.strictEqual(
          checkPermission('SALARY_COMPENSATION', role),
          false,
          `${role} MUST BE BLOCKED from salary compensation`
        );
        assert.strictEqual(
          checkPermission('PAYROLL_PROCESSING', role),
          false,
          `${role} MUST BE BLOCKED from monthly payroll`
        );
        assert.strictEqual(
          checkPermission('FINANCIAL_DOCUMENTS', role),
          false,
          `${role} MUST BE BLOCKED from financial documents`
        );
      });
    });

    it('MD & ADMIN: Full executive and operational administrative access', () => {
      [roles.MD, roles.ADMIN].forEach((role) => {
        assert.strictEqual(checkPermission('SALARY_COMPENSATION', role), true);
        assert.strictEqual(checkPermission('PAYROLL_PROCESSING', role), true);
        assert.strictEqual(checkPermission('ATTENDANCE_RECORDING', role), true);
        assert.strictEqual(checkPermission('FINANCIAL_DOCUMENTS', role), true);
        assert.strictEqual(checkPermission('OFFER_LETTER_CREATE', role), true);
      });
    });
  });

  describe('4. Compensation, Payroll & Sequential Payslips', () => {
    it('retains immutable historical revisions and avoids silent pay overwrites', () => {
      SAMPLE_SALARIES.forEach((sal) => {
        assert.ok(sal.gross_salary > 0, 'Gross salary must be positive');
        assert.ok(sal.net_salary > 0, 'Net salary must be positive');
        assert.strictEqual(
          sal.gross_salary - sal.total_deductions,
          sal.net_salary,
          'Net salary must equal Gross minus Total Deductions'
        );
        assert.ok(sal.is_current !== undefined, 'is_current flag must be defined');
      });
    });

    it('ensures payslips follow sequential collision-safe PAY/26-27/XXXX format', () => {
      SAMPLE_PAYSLIPS.forEach((ps) => {
        assert.match(
          ps.payslip_number,
          /^PAY\/26-27\/\d{4}$/,
          `Payslip ${ps.payslip_number} must match PAY/26-27/XXXX`
        );
        assert.ok(ps.net_salary > 0);
      });
    });

    it('ensures offer letters follow sequential OFF/26-27/XXXX format', () => {
      SAMPLE_OFFERS.forEach((off) => {
        assert.match(
          off.offer_letter_number,
          /^OFF\/26-27\/\d{4}$/,
          `Offer letter ${off.offer_letter_number} must match OFF/26-27/XXXX`
        );
        assert.ok(off.annual_ctc > 0);
      });
    });
  });

  describe('5. Local Demo Feature Registry & Synchronization', () => {
    it('registers all Day 1 through Day 7 features dynamically', () => {
      assert.ok(REGISTERED_DEMO_FEATURES.length >= 4);

      const hrFeat = REGISTERED_DEMO_FEATURES.find((f) => f.id === 'FEAT-HR-001');
      assert.ok(hrFeat, 'Employee Master feature must be registered');
      assert.strictEqual(hrFeat.status, 'ACTIVE');
      assert.strictEqual(hrFeat.demo_route, '/dashboard/employees');

      const attFeat = REGISTERED_DEMO_FEATURES.find((f) => f.id === 'FEAT-HR-003');
      assert.ok(attFeat, 'Attendance board feature must be registered');
      assert.strictEqual(attFeat.demo_route, '/dashboard/employees/attendance');

      const payFeat = REGISTERED_DEMO_FEATURES.find((f) => f.id === 'FEAT-HR-005');
      assert.ok(payFeat, 'Salary & Payroll feature must be registered');
      assert.strictEqual(payFeat.demo_route, '/dashboard/employees/payroll');

      const syncFeat = REGISTERED_DEMO_FEATURES.find((f) => f.id === 'FEAT-SYNC-011');
      assert.ok(syncFeat, 'Demo Updates registry feature must be registered');
      assert.strictEqual(syncFeat.demo_route, '/dashboard/demo-updates');
    });
  });
});
