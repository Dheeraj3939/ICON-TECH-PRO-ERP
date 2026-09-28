import React from 'react';
import Link from 'next/link';
import {
  Settings,
  Shield,
  Building2,
  HardHat,
  Briefcase,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';

export const metadata = {
  title: 'HR Master Settings | ICON TECH PRO ERP',
};

export default async function HRSettingsPage() {
  const authUser = await getAuthenticatedUser();
  const userRole = authUser?.role || 'Managing Director';

  const canManageSettings = ['Managing Director', 'Admin / BDM'].includes(userRole);

  const departments = [
    'Executive Management',
    'Administration & Business Development',
    'Corporate Sales',
    'Field Sales',
    'Finance & Accounts',
    'Service & Operations',
    'Projects & Installations',
    'Technical Services',
  ];

  const employmentTypes = [
    'Full Time',
    'Part Time',
    'Contract',
    'Temporary',
    'Intern',
    'Site Staff',
    'Technician',
    'Installer',
    'Service Engineer',
  ];

  const workLocations = ['Office', 'Site', 'Field', 'Hybrid', 'Remote'];

  const leaveTypes = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Unpaid Leave'];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
            <Settings className="w-4 h-4" />
            <span>Master System Configuration</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            HR Master Parameters & Policy Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configurable departments, designations, work locations, and employment taxonomies.
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Departments List */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
            <span>Configured Enterprise Departments</span>
            <span className="text-xs font-mono text-slate-400 font-bold">{departments.length}</span>
          </h3>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {departments.map((d) => (
              <div key={d} className="px-4 py-2.5 text-xs text-slate-700 font-medium flex items-center justify-between">
                <span>{d}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
            ))}
          </div>
        </div>

        {/* Employment Types */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
            <span>Recognized Employment Types</span>
            <span className="text-xs font-mono text-slate-400 font-bold">{employmentTypes.length}</span>
          </h3>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {employmentTypes.map((t) => (
              <div key={t} className="px-4 py-2.5 text-xs text-slate-700 font-medium flex items-center justify-between">
                <span>{t}</span>
                <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Work Location Types */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
            <span>Work Location Types</span>
            <span className="text-xs font-mono text-slate-400 font-bold">{workLocations.length}</span>
          </h3>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {workLocations.map((l) => (
              <div key={l} className="px-4 py-2.5 text-xs text-slate-700 font-medium flex items-center justify-between">
                <span>{l}</span>
                <span className="text-slate-400 text-[11px]">Supported in Roster</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Types */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
            <span>Standard Leave Types</span>
            <span className="text-xs font-mono text-slate-400 font-bold">{leaveTypes.length}</span>
          </h3>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {leaveTypes.map((lt) => (
              <div key={lt} className="px-4 py-2.5 text-xs text-slate-700 font-medium flex items-center justify-between">
                <span>{lt}</span>
                <span className="text-slate-400 text-[11px]">Paid Entitlement Policy</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
