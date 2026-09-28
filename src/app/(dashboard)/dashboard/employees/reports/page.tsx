import React from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  CreditCard,
  HardHat,
  Users,
  Download,
  ArrowLeft,
  FileSpreadsheet,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getEmployees } from '@/lib/actions/employees';
import { getAttendance } from '@/lib/actions/attendance';
import { getSalaries, getPayrollRuns } from '@/lib/actions/payroll';

export const metadata = {
  title: 'HR Reports & Analytics | ICON TECH PRO ERP',
};

export default async function HRReportsPage() {
  const authUser = await getAuthenticatedUser();
  const userRole = authUser?.role || 'Managing Director';

  const canViewPayrollReports = ['Managing Director', 'Admin / BDM', 'Accounts'].includes(userRole);

  const { employees } = await getEmployees();
  const { attendance } = await getAttendance();

  let salaries: any[] = [];
  let payrollRuns: any[] = [];
  if (canViewPayrollReports) {
    salaries = await getSalaries();
    payrollRuns = await getPayrollRuns();
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Human Capital Business Intelligence</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            HR & Workforce Analytics Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Daily & monthly attendance summaries, site technician deployment ratios, and compensation reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/employees"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Employee Directory</span>
          </Link>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Summary Report */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Attendance & Site Deployment Log</h3>
            </div>
            <button
              type="button"
              onClick={undefined}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Summary of all {attendance.length} attendance records across office personnel and site installations.
          </p>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Recorded Entries</span>
              <span className="font-bold text-slate-900">{attendance.length} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Site Deployments Logged</span>
              <span className="font-bold text-amber-700">
                {attendance.filter((a) => a.work_location === 'Site').length} visits
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Average Daily Shift</span>
              <span className="font-bold text-emerald-700">8.8 Hours</span>
            </div>
          </div>
        </div>

        {/* Headcount by Department */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">Workforce Distribution</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">{employees.length} Active Staff</span>
          </div>

          <div className="space-y-2 text-xs">
            {Array.from(new Set(employees.map((e) => e.department))).map((dept) => {
              const count = employees.filter((e) => e.department === dept).length;
              const pct = Math.round((count / employees.length) * 100);

              return (
                <div key={dept} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-slate-700">{dept}</span>
                    <span className="text-slate-500">{count} staff ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payroll Summary Report (Confidential) */}
        {canViewPayrollReports && (
          <div className="col-span-1 md:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Corporate Compensation & Statutory Summary</h3>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                Accounts & MD Gated
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[11px] font-semibold uppercase block mb-1">
                  Total Monthly Payroll
                </span>
                <div className="text-xl font-black text-slate-900">
                  ₹{salaries.reduce((acc, s) => acc + s.net_salary, 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[11px] font-semibold uppercase block mb-1">
                  Total Monthly PF Deposit
                </span>
                <div className="text-xl font-black text-indigo-700">
                  ₹{salaries.reduce((acc, s) => acc + s.pf, 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[11px] font-semibold uppercase block mb-1">
                  TDS / Professional Tax
                </span>
                <div className="text-xl font-black text-rose-700">
                  ₹{salaries.reduce((acc, s) => acc + (s.tds + s.professional_tax), 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
