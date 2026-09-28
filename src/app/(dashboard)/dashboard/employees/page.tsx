import React from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  Building2,
  HardHat,
  Calendar,
  CreditCard,
  Plus,
  ArrowUpRight,
  Shield,
  Search,
  Filter,
  MapPin,
  Mail,
  Phone,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getEmployees } from '@/lib/actions/employees';
import { getAttendance } from '@/lib/actions/attendance';
import { getPayrollRuns } from '@/lib/actions/payroll';
import { EmployeeDirectoryClient } from './EmployeeDirectoryClient';

export const metadata = {
  title: 'HR & Employees | ICON TECH PRO ERP',
  description: 'Enterprise Employee Master, Attendance, Payroll & Personnel Operations',
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const authUser = await getAuthenticatedUser();
  const userRole = authUser?.role || 'Managing Director';

  const params = await searchParams;
  const department = params.department || 'ALL';
  const location = params.location || 'ALL';
  const query = params.q || '';

  const { employees } = await getEmployees({
    department,
    workLocationType: location,
    search: query,
  });

  const today = new Date().toISOString().split('T')[0];
  const { attendance: todayAttendance } = await getAttendance({ date: today });

  let payrollStatusText = 'Locked';
  let canViewPayroll = ['Managing Director', 'Admin / BDM', 'Accounts'].includes(userRole);

  if (canViewPayroll) {
    try {
      const runs = await getPayrollRuns();
      const currentRun = runs[0];
      payrollStatusText = currentRun ? `${currentRun.payroll_month} (${currentRun.status})` : 'Up to date';
    } catch {
      payrollStatusText = 'Restricted';
    }
  }

  const totalCount = employees.length;
  const activeCount = employees.filter((e) => e.status === 'Active').length;
  const officeCount = employees.filter((e) => e.work_location_type === 'Office').length;
  const siteCount = employees.filter((e) => e.work_location_type === 'Site' || e.work_location_type === 'Field').length;

  const presentTodayCount = todayAttendance.filter((a) =>
    ['Present', 'Site Duty', 'On Duty'].includes(a.attendance_status)
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Human Capital & Workforce Management</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Employee Directory & HR Operations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise master roster for office management and field/site installation engineers.
          </p>
        </div>

        {/* Sub-Navigation Quick Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/employees/attendance"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Attendance Board</span>
          </Link>

          {canViewPayroll && (
            <Link
              href="/dashboard/employees/payroll"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-xl transition"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              <span>Salary & Payroll</span>
            </Link>
          )}

          <Link
            href="/dashboard/employees/documents"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <Briefcase className="w-3.5 h-3.5 text-slate-600" />
            <span>Documents & Offers</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200/70 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Staff</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{activeCount} active personnel</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/70 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Office Staff</span>
            <Building2 className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{officeCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">HQ & Admin personnel</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/70 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Site Engineers</span>
            <HardHat className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{siteCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Field / Installation staff</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/70 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Present Today</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{presentTodayCount}</div>
          <div className="text-[11px] text-emerald-600/80 mt-0.5">Office & Site attendance</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/70 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Payroll Status</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-sm font-bold text-slate-900 truncate">{payrollStatusText}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {canViewPayroll ? 'Accounts & MD access' : 'Confidential'}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/70 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Compliance</span>
            <Shield className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-sm font-bold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>100% PF/ESI</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Telangana Labour Reg.</div>
        </div>
      </div>

      {/* Main Interactive Client Component for Directory Search, Add Modal, and Filtering */}
      <EmployeeDirectoryClient
        initialEmployees={employees}
        userRole={userRole}
      />
    </div>
  );
}
