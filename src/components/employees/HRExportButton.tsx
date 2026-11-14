'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { exportToCSV } from '@/lib/utils/export';
import type { EmployeeAttendance } from '@/types/hr';

export function HRExportButton({ records }: { records: EmployeeAttendance[] }) {
  const handleExport = () => {
    exportToCSV('ICON_HR_Attendance_Log', records, [
      { key: 'date', label: 'Date' },
      { key: 'employee_id', label: 'Employee ID' },
      { key: 'work_location', label: 'Work Location' },
      { key: 'site_project_name', label: 'Site / Project' },
      { key: 'check_in', label: 'Check In' },
      { key: 'check_out', label: 'Check Out' },
      { key: 'total_hours', label: 'Total Hours' },
      { key: 'attendance_status', label: 'Status' },
    ]);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={records.length === 0}
      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-40 cursor-pointer"
    >
      <Download className="w-3.5 h-3.5" />
      <span>Export CSV</span>
    </button>
  );
}
