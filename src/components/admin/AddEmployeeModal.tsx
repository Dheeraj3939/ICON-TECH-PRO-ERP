'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  X,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Shield,
  Briefcase,
  User,
  KeyRound,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { onboardEmployee } from '@/lib/actions/onboarding';
import { getControlledModules } from '@/lib/permissions/registry';
import { ALL_PERMISSION_ACTIONS, type AppRole, type ERPModule, type PermissionAction, type AccessLevel } from '@/types/rbac';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: AppRole[];
  onSuccess: (message: string) => void;
}

export function AddEmployeeModal({
  isOpen,
  onClose,
  roles,
  onSuccess,
}: AddEmployeeModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdEmployeeResult, setCreatedEmployeeResult] = useState<{
    employeeId: string;
    role: string;
    status: string;
    name: string;
  } | null>(null);

  // Form State - Step 1: Basic Details
  const [fullName, setFullName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [corporateEmail, setCorporateEmail] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [customEmployeeId, setCustomEmployeeId] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [department, setDepartment] = useState('Commercial Sales');
  const [designation, setDesignation] = useState('Sales Executive');
  const [reportingManager, setReportingManager] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<'Active' | 'On Probation' | 'Contract'>('Active');
  const [notes, setNotes] = useState('');

  // Form State - Step 2: ERP Role
  const [role, setRole] = useState('Sales Executive');

  // Form State - Step 3: Access Levels per Module
  const controlledModules = getControlledModules();
  const [moduleAccessLevels, setModuleAccessLevels] = useState<Record<string, AccessLevel>>(() => {
    const init: Record<string, AccessLevel> = {};
    for (const m of controlledModules) {
      init[m.name] = 'LIMITED';
    }
    return init;
  });

  const [detailedOverrides, setDetailedOverrides] = useState<
    Array<{
      module: ERPModule;
      action: PermissionAction;
      granted: boolean;
      reason: string;
    }>
  >([]);

  if (!isOpen) return null;

  const handleAccessLevelChange = (moduleName: string, level: AccessLevel) => {
    setModuleAccessLevels((prev) => ({ ...prev, [moduleName]: level }));

    // Generate corresponding overrides for the module
    const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];
    const filtered = detailedOverrides.filter((o) => o.module !== moduleName);

    if (level === 'FULL') {
      // Grant all actions as additions
      for (const act of actions) {
        filtered.push({
          module: moduleName as ERPModule,
          action: act,
          granted: true,
          reason: `Full access tier granted during onboarding`,
        });
      }
    } else if (level === 'NONE') {
      // Restrict all actions
      for (const act of actions) {
        filtered.push({
          module: moduleName as ERPModule,
          action: act,
          granted: false,
          reason: `No access tier configured during onboarding`,
        });
      }
    }
    // If LIMITED, we rely on role defaults or custom additions
    setDetailedOverrides(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await onboardEmployee({
        full_name: fullName,
        corporate_email: corporateEmail,
        phone,
        department,
        designation,
        joining_date: joiningDate,
        role,
        notes: `${notes || ''} ${reportingManager ? `[Reporting Manager: ${reportingManager}]` : ''}`.trim(),
        individualOverrides: detailedOverrides,
      });

      if (res.success && res.user && res.employee) {
        setCreatedEmployeeResult({
          employeeId: res.employee.employee_id,
          role,
          status: 'ACTIVE',
          name: fullName,
        });
        onSuccess(
          `Employee ${fullName} successfully onboarded (ID: ${res.employee.employee_id}) with role "${role}"!`
        );
      } else {
        setError(res.error || 'Failed to onboard employee.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error occurred during onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // POST-CREATION SUMMARY CARD
  if (createdEmployeeResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-5 animate-in zoom-in-95">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div className="text-center space-y-1">
            <h3 className="text-lg font-black text-slate-900">Employee Created</h3>
            <p className="text-xs text-slate-500">
              Staff identity, employee record, and ERP login account successfully provisioned.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Employee ID:</span>
              <span className="font-mono font-bold text-brand-700 bg-white px-2 py-0.5 rounded border border-brand-200">
                {createdEmployeeResult.employeeId}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Full Name:</span>
              <span className="font-bold text-slate-900">{createdEmployeeResult.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">ERP Role:</span>
              <span className="font-bold text-purple-700">{createdEmployeeResult.role}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Account Status:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {createdEmployeeResult.status}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Link
              href="/dashboard/employees"
              onClick={onClose}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <User className="w-3.5 h-3.5" />
              <span>View Profile in Directory</span>
            </Link>
            <Link
              href="/dashboard/settings/permissions"
              onClick={onClose}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Review Access &amp; Overrides</span>
            </Link>
            <Link
              href="/dashboard/settings/users"
              onClick={onClose}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Set Login Access</span>
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-5 animate-in fade-in zoom-in-95 my-8">
        {/* Header & Step Indicator */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Guided Employee Onboarding</h3>
              <p className="text-[11px] text-slate-500">Step {step} of 3 • Guided Administration Workflow</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Progress Tabs */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className={`p-2 rounded-xl text-center border text-[11px] font-bold ${
              step === 1
                ? 'bg-brand-50 border-brand-500 text-brand-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            1. Basic Details
          </div>
          <div
            className={`p-2 rounded-xl text-center border text-[11px] font-bold ${
              step === 2
                ? 'bg-brand-50 border-brand-500 text-brand-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            2. ERP Role
          </div>
          <div
            className={`p-2 rounded-xl text-center border text-[11px] font-bold ${
              step === 3
                ? 'bg-brand-50 border-brand-500 text-brand-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            3. Access Levels
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* STEP 1: BASIC DETAILS */}
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Employee Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98490 12345"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Corporate Email *</label>
                  <input
                    type="email"
                    required
                    value={corporateEmail}
                    onChange={(e) => setCorporateEmail(e.target.value)}
                    placeholder="ramesh@icontechpro.in"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Personal Email (Optional)</label>
                  <input
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    placeholder="ramesh.personal@gmail.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employee ID (Optional)</label>
                  <input
                    type="text"
                    value={customEmployeeId}
                    onChange={(e) => setCustomEmployeeId(e.target.value)}
                    placeholder="Auto-assigned if left blank"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date of Joining</label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Field Sales"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Sales Consultant"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reporting Manager (Optional)</label>
                  <input
                    type="text"
                    value={reportingManager}
                    onChange={(e) => setReportingManager(e.target.value)}
                    placeholder="e.g. Vineet Babu"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employment Status</label>
                  <select
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-800"
                  >
                    <option value="Active">Active</option>
                    <option value="On Probation">On Probation</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t">
                <button
                  type="button"
                  disabled={!fullName.trim() || !corporateEmail.trim() || !phone.trim()}
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition shadow-xs disabled:opacity-40"
                >
                  <span>Next: ERP Role</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ERP ROLE */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-2">Select Human-Readable ERP Role *</label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {roles.map((r) => {
                    const isSelected = role === r.role_name;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setRole(r.role_name)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-start justify-between ${
                          isSelected
                            ? 'bg-brand-50/70 border-brand-500 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">{r.role_name}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                r.is_system
                                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                                  : 'bg-purple-50 text-purple-700 border-purple-200'
                              }`}
                            >
                              {r.is_system ? 'System Role' : 'Custom Role'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug">{r.description}</p>
                        </div>
                        <input
                          type="radio"
                          name="selectedRole"
                          checked={isSelected}
                          onChange={() => setRole(r.role_name)}
                          className="mt-1 text-brand-600 focus:ring-brand-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Administrative Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Assigned territory: Telangana & AP; AV Enterprise sales."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 text-slate-600 font-bold px-3 py-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition shadow-xs"
                >
                  <span>Next: Access Levels</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: ACCESS LEVELS (FULL / LIMITED / NO ACCESS) */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Assigned Base Role:</span>
                  <span className="font-mono font-bold text-brand-700 bg-white px-2 py-0.5 rounded border border-brand-200">
                    {role}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Select simple access tiers per module below: FULL ACCESS, LIMITED ACCESS, or NO ACCESS.
                </p>
              </div>

              {/* Module Access Tiers */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {controlledModules.map((m) => {
                  const currentLevel = moduleAccessLevels[m.name] || 'LIMITED';
                  return (
                    <div
                      key={m.key}
                      className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-900 block text-xs">{m.name}</span>
                        <span className="text-[10px] text-slate-400">{m.category}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAccessLevelChange(m.name, 'FULL')}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                            currentLevel === 'FULL'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          FULL
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAccessLevelChange(m.name, 'LIMITED')}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                            currentLevel === 'LIMITED'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          LIMITED
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAccessLevelChange(m.name, 'NONE')}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                            currentLevel === 'NONE'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          NO ACCESS
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1 text-slate-600 font-bold px-3 py-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Provisioning...' : 'Complete Onboarding'}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
