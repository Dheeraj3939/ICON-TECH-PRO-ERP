import React from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  HardHat,
  Building2,
  CheckCircle2,
  AlertCircle,
  Users,
  Filter,
  ArrowLeft,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getAttendance, getAttendanceCorrections } from '@/lib/actions/attendance';
import { getEmployees } from '@/lib/actions/employees';
import { AttendanceBoardClient } from './AttendanceBoardClient';

export const metadata = {
  title: 'Attendance & Site Duty | ICON TECH PRO ERP',
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const authUser = await getAuthenticatedUser();
  const userRole = authUser?.role || 'Managing Director';

  const params = await searchParams;
  const today = new Date().toISOString().split('T')[0];
  const selectedDate = params.date || today;
  const selectedLocation = params.location || 'ALL';

  const { attendance } = await getAttendance({
    date: selectedDate,
    workLocation: selectedLocation,
  });

  const corrections = await getAttendanceCorrections();
  const { employees } = await getEmployees();

  const canApproveCorrections = ['Managing Director', 'Admin / BDM'].includes(userRole);
  const canRecordAttendance = ['Managing Director', 'Admin / BDM', 'Office Assistant'].includes(userRole);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
            <Calendar className="w-4 h-4" />
            <span>Attendance & Field Operations Roster</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Attendance Board & Site Duty Tracking
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Daily check-in logs, hours, customer-site assignments, and audited correction workflow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/employees"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Employee Directory</span>
          </Link>
        </div>
      </div>

      {/* Main Interactive Attendance Board Client */}
      <AttendanceBoardClient
        initialAttendance={attendance}
        corrections={corrections}
        employees={employees}
        selectedDate={selectedDate}
        userRole={userRole}
        canRecordAttendance={canRecordAttendance}
        canApproveCorrections={canApproveCorrections}
      />
    </div>
  );
}
