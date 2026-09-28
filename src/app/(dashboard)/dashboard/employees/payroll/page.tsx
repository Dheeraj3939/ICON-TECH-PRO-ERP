import React from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Shield,
  AlertTriangle,
  ArrowLeft,
  Users,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getSalaries, getPayrollRuns } from '@/lib/actions/payroll';
import { getEmployees } from '@/lib/actions/employees';
import { PayrollClient } from './PayrollClient';

export const metadata = {
  title: 'Salary & Payroll | ICON TECH PRO ERP',
};

export default async function PayrollPage() {
  const authUser = await getAuthenticatedUser();
  const userRole = authUser?.role || 'Managing Director';

  // Strict role security gate
  const isAuthorized = ['Managing Director', 'Admin / BDM', 'Accounts'].includes(userRole);

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-14 h-14 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <Shield className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Restricted Compensation Access</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          You are authenticated as <strong>{userRole}</strong>. Access to corporate salary structures,
          compensation histories, and monthly payroll batches is strictly restricted to Accounts and Executive Leadership.
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard/employees"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Employee Directory</span>
          </Link>
        </div>
      </div>
    );
  }

  const salaries = await getSalaries();
  const payrollRuns = await getPayrollRuns();
  const { employees } = await getEmployees();

  const totalMonthlyGross = salaries.reduce((acc, s) => acc + s.gross_salary, 0);
  const totalMonthlyNet = salaries.reduce((acc, s) => acc + s.net_salary, 0);
  const totalMonthlyDed = salaries.reduce((acc, s) => acc + s.total_deductions, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Finance & Compensation Management</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Corporate Payroll & Salary Structures
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monthly payroll calculation, statutory PF/ESI/TDS deductions, and immutable salary revision history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/employees/payslips"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded-xl transition"
          >
            <span>Payslip Center &rarr;</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Monthly Net Payout
          </span>
          <div className="text-2xl font-black text-emerald-600">
            ₹{totalMonthlyNet.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400">Across {salaries.length} active personnel</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Total Gross Earnings
          </span>
          <div className="text-2xl font-black text-slate-900">
            ₹{totalMonthlyGross.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400">Basic + HRA + Allowances</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Statutory Deductions
          </span>
          <div className="text-2xl font-black text-rose-600">
            ₹{totalMonthlyDed.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400">PF + ESI + PT + TDS</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Last Closed Batch
          </span>
          <div className="text-xl font-black text-indigo-700">
            {payrollRuns[0]?.payroll_month || '2026-08'}
          </div>
          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
            <CheckCircle2 className="w-3 h-3" />
            <span>{payrollRuns[0]?.status || 'Paid'}</span>
          </span>
        </div>
      </div>

      {/* Main Interactive Payroll Client Component */}
      <PayrollClient
        initialSalaries={salaries}
        initialPayrollRuns={payrollRuns}
        employees={employees}
        userRole={userRole}
      />
    </div>
  );
}
