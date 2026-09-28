import React from 'react';
import Link from 'next/link';
import {
  FileCheck,
  Shield,
  CreditCard,
  ArrowLeft,
  Users,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getPayslips } from '@/lib/actions/payroll';
import { getEmployees } from '@/lib/actions/employees';
import { PayslipsClient } from './PayslipsClient';

export const metadata = {
  title: 'Payslip Center | ICON TECH PRO ERP',
};

export default async function PayslipsPage() {
  const authUser = await getAuthenticatedUser();
  const userRole = authUser?.role || 'Managing Director';

  const isAuthorized = ['Managing Director', 'Admin / BDM', 'Accounts'].includes(userRole);

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-14 h-14 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <Shield className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Restricted Payslip Access</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          You are authenticated as <strong>{userRole}</strong>. Access to issued payslips and salary vouchers is strictly restricted to Accounts and Executive Leadership.
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

  const payslips = await getPayslips();
  const { employees } = await getEmployees();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
            <FileCheck className="w-4 h-4" />
            <span>Personnel Documents & Compensation</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Official Payslip Center & Vouchers
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Formal company payslips with collision-safe PAY/26-27/XXXX serial numbering and printable layout.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/employees/payroll"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Payroll Batches</span>
          </Link>
        </div>
      </div>

      <PayslipsClient initialPayslips={payslips} employees={employees} userRole={userRole} />
    </div>
  );
}
