import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  User,
  Building2,
  HardHat,
  Calendar,
  CreditCard,
  FileText,
  Shield,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getEmployeeById } from '@/lib/actions/employees';
import { getAttendance } from '@/lib/actions/attendance';
import { getEmployeeSalaryHistory, getPayslips } from '@/lib/actions/payroll';
import { getEmployeeDocuments } from '@/lib/actions/hr-documents';
import { EmployeeProfile360Client } from './EmployeeProfile360Client';

export const metadata = {
  title: 'Employee 360 Profile | ICON TECH PRO ERP',
};

export default async function Employee360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authUser = await getAuthenticatedUser();
  const userRole = authUser?.role || 'Managing Director';

  const { id } = await params;
  const employee = await getEmployeeById(id);

  if (!employee) {
    notFound();
  }

  // Authoritative Role Filtering for Sensitive HR Tabs
  const canViewFinancials = ['Managing Director', 'Admin / BDM', 'Accounts'].includes(userRole);
  const canViewAudits = ['Managing Director', 'Admin / BDM', 'Accounts'].includes(userRole);

  // Fetch Attendance for this employee
  const { attendance } = await getAttendance({ employeeId: employee.id });

  // Fetch Salary and Payslips only if authorized
  let salaryHistory: any[] = [];
  let payslips: any[] = [];
  if (canViewFinancials) {
    salaryHistory = await getEmployeeSalaryHistory(employee.id);
    payslips = await getPayslips({ employeeId: employee.id });
  }

  // Fetch Documents with server-side sensitivity filtering
  const documents = await getEmployeeDocuments(employee.id);

  return (
    <div className="space-y-6">
      {/* Back Button & Top Action */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/employees"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Employee Directory</span>
        </Link>

        <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
          Viewing as: <strong className="text-indigo-600">{userRole}</strong>
        </span>
      </div>

      {/* Hero Banner / Profile Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0">
              {employee.full_name.charAt(0)}
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black text-slate-900">{employee.full_name}</h1>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-xs font-bold border border-indigo-200/50">
                  {employee.employee_id}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    employee.work_location_type === 'Site'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                      : 'bg-sky-50 text-sky-700 border border-sky-200/60'
                  }`}
                >
                  {employee.work_location_type === 'Site' ? (
                    <HardHat className="w-3 h-3" />
                  ) : (
                    <Building2 className="w-3 h-3" />
                  )}
                  <span>{employee.work_location_type} Staff</span>
                </span>
              </div>

              <p className="text-xs text-slate-500 font-medium mt-1">
                {employee.designation} &bull; <span className="text-slate-700 font-semibold">{employee.department}</span>
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-700 font-medium">{employee.corporate_email}</span>
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{employee.phone}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Joined: {employee.joining_date}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Status: {employee.status}</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Probation: <strong className="text-slate-600">{employee.probation_status || 'Confirmed'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Role-Filtered 360 Tabbed Layout Client */}
      <EmployeeProfile360Client
        employee={employee}
        attendance={attendance}
        salaryHistory={salaryHistory}
        payslips={payslips}
        documents={documents}
        canViewFinancials={canViewFinancials}
        canViewAudits={canViewAudits}
        userRole={userRole}
      />
    </div>
  );
}
