'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  Calendar,
  CreditCard,
  FileText,
  Shield,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  HardHat,
  Building2,
  FileCheck,
  Download,
  Lock,
  Plus,
  Trash2,
  Sliders,
  KeyRound,
  Pencil,
} from 'lucide-react';
import EditEmployeeModal from '@/components/modals/EditEmployeeModal';
import { getManagedUsers } from '@/lib/actions/users';
import {
  getUserOverrides,
  setUserPermissionOverride,
  removeUserPermissionOverride,
} from '@/lib/actions/permissions';
import {
  ALL_ERP_MODULES,
  ALL_PERMISSION_ACTIONS,
  type ERPModule,
  type PermissionAction,
  type UserPermissionOverride,
  type ManagedUser,
} from '@/types/rbac';
import type {
  Employee,
  EmployeeAttendance,
  EmployeeSalaryHistory,
  Payslip,
  EmployeeDocument,
} from '@/types/hr';

interface EmployeeProfile360ClientProps {
  employee: Employee;
  attendance: EmployeeAttendance[];
  salaryHistory: EmployeeSalaryHistory[];
  payslips: Payslip[];
  documents: EmployeeDocument[];
  canViewFinancials: boolean;
  canViewAudits: boolean;
  userRole: string;
}

export function EmployeeProfile360Client({
  employee,
  attendance,
  salaryHistory,
  payslips,
  documents,
  canViewFinancials,
  canViewAudits,
  userRole,
}: EmployeeProfile360ClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'salary' | 'payslips' | 'documents' | 'access'>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const canEdit = ['Managing Director', 'Admin / BDM'].includes(userRole);

  const tabs = [
    { id: 'overview', label: '1. Overview & Bio', icon: User, allowed: true },
    { id: 'attendance', label: `2. Attendance Logs (${attendance.length})`, icon: Calendar, allowed: true },
    { id: 'salary', label: '3. Salary & Compensation', icon: CreditCard, allowed: canViewFinancials },
    { id: 'payslips', label: `4. Payslips (${payslips.length})`, icon: FileCheck, allowed: canViewFinancials },
    { id: 'documents', label: `5. Documents Vault (${documents.length})`, icon: FileText, allowed: true },
    { id: 'access', label: '6. ERP Access & Permissions', icon: Shield, allowed: true },
  ].filter((t) => t.allowed);

  const [matchedUser, setMatchedUser] = useState<ManagedUser | null>(null);
  const [userOverrides, setUserOverrides] = useState<UserPermissionOverride[]>([]);
  const [overrideModule, setOverrideModule] = useState<ERPModule>('Quotations');
  const [overrideAction, setOverrideAction] = useState<PermissionAction>('approve');
  const [overrideGranted, setOverrideGranted] = useState<boolean>(true);
  const [overrideReason, setOverrideReason] = useState('Delegated special permission');
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  const loadAccessData = async () => {
    try {
      setAccessLoading(true);
      const uRes = await getManagedUsers();
      const u = uRes.users.find(
        (usr) =>
          usr.email.toLowerCase() === employee.corporate_email.toLowerCase() ||
          usr.name.toLowerCase() === employee.full_name.toLowerCase()
      );
      setMatchedUser(u || null);
      if (u) {
        const ovs = await getUserOverrides(u.id);
        setUserOverrides(ovs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'access') {
      loadAccessData();
    }
  }, [activeTab]);

  const handleAddOverride = async () => {
    if (!matchedUser) return;
    const res = await setUserPermissionOverride({
      userId: matchedUser.id,
      userName: matchedUser.name,
      module: overrideModule,
      action: overrideAction,
      granted: overrideGranted,
      reason: overrideReason,
    });
    if (res.success) {
      setAccessMessage(`Permission override updated successfully.`);
      setTimeout(() => setAccessMessage(null), 3500);
      loadAccessData();
    }
  };

  const handleRemoveOverride = async (module: ERPModule, action: PermissionAction) => {
    if (!matchedUser) return;
    const res = await removeUserPermissionOverride(matchedUser.id, module, action);
    if (res.success) {
      setAccessMessage(`Permission override removed.`);
      setTimeout(() => setAccessMessage(null), 3500);
      loadAccessData();
    }
  };

  const currentSalary = salaryHistory.find((s) => s.is_current) || salaryHistory[0];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & BIO */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Employment Master Information */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Employment Information</span>
              </h3>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition text-[11px] border border-indigo-200 shadow-2xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Employee ID</span>
                <span className="font-mono font-bold text-slate-800">{employee.employee_id}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Department</span>
                <span className="font-semibold text-slate-800">{employee.department}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Designation</span>
                <span className="font-semibold text-slate-800">{employee.designation}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Employment Type</span>
                <span className="font-semibold text-slate-800">{employee.employment_type}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Joining Date</span>
                <span className="font-semibold text-slate-800">{employee.joining_date}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Reporting Manager</span>
                <span className="font-semibold text-slate-800">{employee.reporting_manager_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Work Location</span>
                <span className="font-semibold text-slate-800">{employee.work_location_type} Staff</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Confirmation Date</span>
                <span className="font-semibold text-slate-800">{employee.confirmation_date || 'Pending'}</span>
              </div>
            </div>

            {employee.current_site_assignment && (
              <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-xs">
                <span className="font-bold text-amber-800 flex items-center gap-1.5 mb-1">
                  <HardHat className="w-3.5 h-3.5" />
                  <span>Current Site Deployment</span>
                </span>
                <p className="text-amber-900 font-medium">{employee.current_site_assignment}</p>
              </div>
            )}
          </div>

          {/* Personal & Emergency Contact Information */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              <span>Contact & Personal Details</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Corporate Email</span>
                <span className="font-medium text-slate-800 truncate block">{employee.corporate_email}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Personal Email</span>
                <span className="font-medium text-slate-800 truncate block">{employee.personal_email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Primary Phone</span>
                <span className="font-mono font-medium text-slate-800">{employee.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Date of Birth</span>
                <span className="font-medium text-slate-800">{employee.date_of_birth || 'N/A'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[11px]">Emergency Contact</span>
                <span className="font-medium text-slate-800">
                  {employee.emergency_contact_name || 'N/A'} ({employee.emergency_contact_phone || 'N/A'})
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[11px]">Residential Address</span>
                <span className="font-medium text-slate-700">{employee.address || 'Registered on file'}</span>
              </div>
            </div>

            {employee.skills && employee.skills.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5 uppercase tracking-wider">
                  Technical Competencies & Skills
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {employee.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200/60"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE LOGS */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recorded Attendance & Site Deployments</h3>
              <p className="text-xs text-slate-500">History of daily check-ins, site duties, and hours worked.</p>
            </div>
            <Link
              href="/dashboard/employees/attendance"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Open Live Attendance Board &rarr;
            </Link>
          </div>

          {/* Desktop Zero-Scroll Table */}
          <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left text-slate-600 table-fixed">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Check In / Out</th>
                  <th className="px-4 py-3">Total Hours</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Site / Project</th>
                  <th className="px-4 py-3">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-900 truncate">{att.date}</td>
                    <td className="px-4 py-3 truncate">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        {att.work_location === 'Site' ? <HardHat className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <Building2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                        <span className="truncate">{att.work_location}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono truncate">
                      {att.check_in} - {att.check_out}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">{att.total_hours} hrs</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {att.attendance_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium truncate" title={att.site_project_name || '—'}>
                      {att.site_project_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 truncate">{att.recorded_by}</td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No attendance logged for this employee yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Zero-Scroll Cards */}
          <div className="block md:hidden space-y-3">
            {attendance.map((att) => (
              <div key={att.id} className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{att.date}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {att.attendance_status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Location:</span>
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                      {att.work_location === 'Site' ? <HardHat className="w-3.5 h-3.5 text-amber-500" /> : <Building2 className="w-3.5 h-3.5 text-sky-500" />}
                      <span>{att.work_location}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Hours:</span>
                    <span className="font-bold text-slate-800">{att.total_hours} hrs</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 block">In / Out:</span>
                    <span className="font-mono text-slate-800">{att.check_in} - {att.check_out}</span>
                  </div>
                  {att.site_project_name && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 block">Project / Site:</span>
                      <span className="font-medium text-slate-800">{att.site_project_name}</span>
                    </div>
                  )}
                  <div className="col-span-2 text-[10px] text-slate-400">
                    Recorded by: {att.recorded_by}
                  </div>
                </div>
              </div>
            ))}
            {attendance.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                No attendance logged for this employee yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SALARY & COMPENSATION (CONFIDENTIAL) */}
      {activeTab === 'salary' && canViewFinancials && (
        <div className="space-y-6">
          {currentSalary ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">Current Salary Structure</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Effective from: {currentSalary.effective_from} &bull; Approved by: {currentSalary.approved_by || 'MD'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-400 uppercase font-bold block">Annual CTC</span>
                  <span className="text-xl font-black text-slate-900">₹{currentSalary.ctc.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Earnings */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Monthly Earnings</span>
                    <span className="text-indigo-600 font-black">₹{currentSalary.gross_salary.toLocaleString('en-IN')}</span>
                  </h4>

                  <div className="space-y-2 text-xs divide-y divide-slate-200/50">
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Basic Salary</span>
                      <span className="font-semibold text-slate-800">₹{currentSalary.basic_salary.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">House Rent Allowance (HRA)</span>
                      <span className="font-semibold text-slate-800">₹{currentSalary.hra.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Conveyance Allowance</span>
                      <span className="font-semibold text-slate-800">₹{currentSalary.conveyance.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Special Allowance</span>
                      <span className="font-semibold text-slate-800">₹{currentSalary.special_allowance.toLocaleString('en-IN')}</span>
                    </div>
                    {currentSalary.other_allowances > 0 && (
                      <div className="flex justify-between pt-1">
                        <span className="text-slate-500">Other Allowances</span>
                        <span className="font-semibold text-slate-800">₹{currentSalary.other_allowances.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deductions */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Monthly Deductions</span>
                    <span className="text-rose-600 font-black">₹{currentSalary.total_deductions.toLocaleString('en-IN')}</span>
                  </h4>

                  <div className="space-y-2 text-xs divide-y divide-slate-200/50">
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Provident Fund (PF)</span>
                      <span className="font-semibold text-slate-800">₹{currentSalary.pf.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Employee State Insurance (ESI)</span>
                      <span className="font-semibold text-slate-800">₹{currentSalary.esi.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Professional Tax (PT)</span>
                      <span className="font-semibold text-slate-800">₹{currentSalary.professional_tax.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Income Tax (TDS)</span>
                      <span className="font-semibold text-slate-800">₹{currentSalary.tds.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Payable Highlight Card */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Net Take-Home Pay (Monthly)</span>
                  <span className="text-xs text-emerald-600">Calculated as Gross Salary minus Statutory Deductions</span>
                </div>
                <div className="text-2xl font-black text-emerald-700">
                  ₹{currentSalary.net_salary.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No active salary structure configured</h3>
            </div>
          )}

          {/* Immutable Historical Salary Revisions */}
          {salaryHistory.length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Historical Salary Revisions (Audit Trail)
              </h3>
              {/* Desktop Zero-Scroll Table */}
              <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left table-fixed">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                    <col className="w-[20%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Effective Date</th>
                      <th className="px-4 py-2.5">Gross Pay</th>
                      <th className="px-4 py-2.5">Net Pay</th>
                      <th className="px-4 py-2.5">CTC</th>
                      <th className="px-4 py-2.5">Reason</th>
                      <th className="px-4 py-2.5">Approved By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salaryHistory.map((sal) => (
                      <tr key={sal.id} className={sal.is_current ? 'bg-emerald-50/40' : ''}>
                        <td className="px-4 py-2.5 font-semibold text-slate-900 truncate">{sal.effective_from}</td>
                        <td className="px-4 py-2.5 font-mono">₹{sal.gross_salary.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-emerald-700">₹{sal.net_salary.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 font-mono">₹{sal.ctc.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-slate-600 truncate">{sal.revision_reason || 'Periodic Revision'}</td>
                        <td className="px-4 py-2.5 text-slate-500 truncate">{sal.approved_by || 'MD'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Zero-Scroll Cards */}
              <div className="block md:hidden space-y-3">
                {salaryHistory.map((sal) => (
                  <div key={sal.id} className={`p-3.5 border border-slate-200 rounded-xl space-y-2 ${sal.is_current ? 'bg-emerald-50/30 border-emerald-300' : 'bg-white'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{sal.effective_from}</span>
                      {sal.is_current && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Active Structure
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Gross:</span>
                        <span className="font-mono text-slate-700 font-bold">₹{sal.gross_salary.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Net Take-Home:</span>
                        <span className="font-mono text-emerald-700 font-black">₹{sal.net_salary.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Annual CTC:</span>
                        <span className="font-mono text-slate-700 font-medium">₹{sal.ctc.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Approved By:</span>
                        <span className="text-slate-600">{sal.approved_by || 'MD'}</span>
                      </div>
                    </div>
                    {sal.revision_reason && (
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        Reason: {sal.revision_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PAYSLIPS (CONFIDENTIAL) */}
      {activeTab === 'payslips' && canViewFinancials && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Generated Monthly Payslips</h3>
              <p className="text-xs text-slate-500">Official company payslips with collision-safe PAY/26-27/XXXX serial numbering.</p>
            </div>
            <Link
              href="/dashboard/employees/payslips"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Open Payslip Center &rarr;
            </Link>
          </div>

          {/* Desktop Zero-Scroll Table */}
          <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left table-fixed">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Payslip Number</th>
                  <th className="px-4 py-3">Payroll Month</th>
                  <th className="px-4 py-3">Gross Salary</th>
                  <th className="px-4 py-3">Total Deductions</th>
                  <th className="px-4 py-3">Net Take-Home</th>
                  <th className="px-4 py-3">Issued Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payslips.map((ps) => (
                  <tr key={ps.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700 truncate">{ps.payslip_number}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 truncate">{ps.payroll_month}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">₹{ps.gross_salary.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-mono text-rose-600">₹{ps.total_deductions.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700">₹{ps.net_salary.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-slate-500 truncate">{ps.generated_at.split('T')[0]}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/employees/payslips`}
                        className="inline-flex items-center gap-1 text-indigo-600 font-semibold hover:text-indigo-800"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </Link>
                    </td>
                  </tr>
                ))}
                {payslips.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No payslips generated for this employee yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Zero-Scroll Cards */}
          <div className="block md:hidden space-y-3">
            {payslips.map((ps) => (
              <div key={ps.id} className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-indigo-700 text-xs">{ps.payslip_number}</span>
                  <span className="text-[11px] text-slate-500 font-medium">{ps.payroll_month}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Gross:</span>
                    <span className="font-mono text-slate-700 font-bold">₹{ps.gross_salary.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Deductions:</span>
                    <span className="font-mono text-rose-600">₹{ps.total_deductions.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Net Take-Home:</span>
                      <span className="font-mono text-emerald-700 font-black text-sm">₹{ps.net_salary.toLocaleString('en-IN')}</span>
                    </div>
                    <Link
                      href={`/dashboard/employees/payslips`}
                      className="min-h-[44px] px-3.5 py-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition"
                    >
                      <FileCheck className="w-4 h-4" />
                      <span>Inspect</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {payslips.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                No payslips generated for this employee yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: DOCUMENTS VAULT */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Personnel Document Repository</h3>
              <p className="text-xs text-slate-500">
                Sensitive records filtered by role permission tiers (NORMAL, CONFIDENTIAL, FINANCIAL).
              </p>
            </div>
            <Link
              href="/dashboard/employees/documents"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Open Full Documents Vault &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 bg-slate-50/50 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs text-indigo-600 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{doc.document_name}</h4>
                    <p className="text-[11px] text-slate-500">{doc.document_type} &bull; Uploaded by {doc.uploaded_by}</p>
                    <span
                      className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                        doc.sensitivity === 'FINANCIAL'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : doc.sensitivity === 'CONFIDENTIAL'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {doc.sensitivity} ACCESS
                    </span>
                  </div>
                </div>

                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition shrink-0"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))}
            {documents.length === 0 && (
              <div className="col-span-2 p-8 text-center text-slate-400">
                No accessible documents in this profile.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: ERP ACCESS & PERMISSIONS */}
      {activeTab === 'access' && (
        <div className="space-y-6">
          {accessMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{accessMessage}</span>
            </div>
          )}

          {matchedUser ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Account Details & Base Role */}
              <div className="space-y-5">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">ERP Account Status</h3>
                      <p className="text-[11px] text-slate-400 font-mono">User ID: {matchedUser.id}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Account Login:</span>
                      <span className="font-mono font-bold text-slate-800">{matchedUser.email}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Account State:</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          matchedUser.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {matchedUser.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Base Security Role:</span>
                      <span className="px-2.5 py-0.5 rounded-md font-bold text-brand-700 bg-brand-50 border border-brand-200 font-mono text-[11px]">
                        {matchedUser.role}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <Link
                      href="/dashboard/settings/roles"
                      className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                    >
                      <span>View Role Permission Matrix</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Right Column: Individual Permission Overrides */}
              <div className="lg:col-span-2 space-y-5">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-brand-600" />
                      <h3 className="font-bold text-slate-900 text-sm">
                        Individual User Overrides ({userOverrides.length})
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Role + Add - Restrict Model
                    </span>
                  </div>

                  {userOverrides.length > 0 ? (
                    <div className="space-y-2">
                      {userOverrides.map((ov, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              {ov.granted ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  + GRANT
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  - RESTRICT
                                </span>
                              )}
                              <span className="font-bold text-slate-900 text-xs">{ov.module}</span>
                              <span className="font-mono text-slate-500 font-semibold">({ov.action})</span>
                            </div>
                            <p className="text-[11px] text-slate-400 italic">{ov.reason}</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveOverride(ov.module, ov.action)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Remove this override"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                      No custom overrides configured for this user. System strictly enforces the{' '}
                      <strong className="text-slate-700 font-semibold">{matchedUser.role}</strong> baseline permissions.
                    </div>
                  )}

                  {/* Add New Override Tool */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <span className="font-bold text-slate-800 text-xs block">
                      Grant Extra Privilege or Restrict Specific Action
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Module</label>
                        <select
                          value={overrideModule}
                          onChange={(e) => setOverrideModule(e.target.value as ERPModule)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs outline-none"
                        >
                          {ALL_ERP_MODULES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Action</label>
                        <select
                          value={overrideAction}
                          onChange={(e) => setOverrideAction(e.target.value as PermissionAction)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs outline-none"
                        >
                          {ALL_PERMISSION_ACTIONS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Override Type</label>
                        <select
                          value={overrideGranted ? 'grant' : 'restrict'}
                          onChange={(e) => setOverrideGranted(e.target.value === 'grant')}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-bold outline-none"
                        >
                          <option value="grant">+ Grant Extra Access</option>
                          <option value="restrict">- Restrict Access</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Reason for Override *</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="e.g. Authorized by MD for Q3 government project..."
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddOverride}
                          className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg shrink-0 transition text-xs shadow-2xs"
                        >
                          Save Override
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <strong className="block font-bold text-slate-800 text-sm">
                No Linked ERP Login Account Found
              </strong>
              <p className="mt-1 max-w-md mx-auto text-slate-500">
                This employee record ({employee.corporate_email}) does not currently have an active ERP user account provisioned.
              </p>
              <Link
                href="/dashboard/settings/users"
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 text-white font-bold text-xs"
              >
                <span>Provision ERP Account</span>
                <span>→</span>
              </Link>
            </div>
          )}
        </div>
      )}
      {/* Edit Employee Profile Modal */}
      <EditEmployeeModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        employee={employee}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
}
