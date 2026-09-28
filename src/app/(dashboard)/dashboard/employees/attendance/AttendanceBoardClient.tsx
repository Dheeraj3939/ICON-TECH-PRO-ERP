'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  HardHat,
  Building2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Filter,
  Check,
  X,
  MapPin,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import type {
  Employee,
  EmployeeAttendance,
  AttendanceCorrection,
  AttendanceStatus,
  WorkLocationType,
} from '@/types/hr';
import {
  recordAttendance,
  submitAttendanceCorrection,
  reviewAttendanceCorrection,
} from '@/lib/actions/attendance';

interface AttendanceBoardClientProps {
  initialAttendance: EmployeeAttendance[];
  corrections: AttendanceCorrection[];
  employees: Employee[];
  selectedDate: string;
  userRole: string;
  canRecordAttendance: boolean;
  canApproveCorrections: boolean;
}

export function AttendanceBoardClient({
  initialAttendance,
  corrections: initialCorrections,
  employees,
  selectedDate,
  userRole,
  canRecordAttendance,
  canApproveCorrections,
}: AttendanceBoardClientProps) {
  const router = useRouter();
  const [attendance, setAttendance] = useState<EmployeeAttendance[]>(initialAttendance);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>(initialCorrections);
  const [date, setDate] = useState(selectedDate);
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedAttForCorrection, setSelectedAttForCorrection] = useState<EmployeeAttendance | null>(null);

  const [recordForm, setRecordForm] = useState({
    employee_id: employees[0]?.id || '',
    date: selectedDate,
    work_location: 'Office' as WorkLocationType,
    site_project_name: '',
    customer_id: '',
    check_in: '09:00',
    check_out: '18:00',
    total_hours: 9,
    attendance_status: 'Present' as AttendanceStatus,
    overtime_hours: 0,
    remarks: '',
  });

  const [correctionForm, setCorrectionForm] = useState({
    requested_status: 'Present' as AttendanceStatus,
    reason: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const filteredAttendance = attendance.filter((a) => {
    if (locationFilter !== 'ALL' && a.work_location !== locationFilter) return false;
    return true;
  });

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const selectedEmp = employees.find((e) => e.id === recordForm.employee_id);
      const res = await recordAttendance({
        ...recordForm,
        employee_name: selectedEmp ? selectedEmp.full_name : undefined,
      });

      if (res.success && res.attendance) {
        setAttendance((prev) => {
          const idx = prev.findIndex(
            (a) => a.employee_id === res.attendance!.employee_id && a.date === res.attendance!.date
          );
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = res.attendance!;
            return next;
          }
          return [res.attendance!, ...prev];
        });
        setMessage('Attendance recorded successfully!');
        setTimeout(() => {
          setIsRecordModalOpen(false);
          setMessage('');
        }, 1000);
      }
    } catch (err: any) {
      setMessage(`Error: ${err?.message || 'Failed to record attendance'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttForCorrection) return;

    setSubmitting(true);
    setMessage('');

    try {
      const res = await submitAttendanceCorrection({
        attendance_id: selectedAttForCorrection.id,
        employee_id: selectedAttForCorrection.employee_id,
        employee_name: selectedAttForCorrection.employee_name,
        date: selectedAttForCorrection.date,
        previous_status: selectedAttForCorrection.attendance_status,
        requested_status: correctionForm.requested_status,
        reason: correctionForm.reason,
      });

      if (res.success && res.correction) {
        setCorrections((prev) => [res.correction!, ...prev]);
        setMessage('Correction request submitted for approval!');
        setTimeout(() => {
          setIsCorrectionModalOpen(false);
          setSelectedAttForCorrection(null);
          setMessage('');
        }, 1000);
      }
    } catch (err: any) {
      setMessage(`Error: ${err?.message || 'Failed to submit correction'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCorrectionReview = async (id: string, decision: 'Approved' | 'Rejected') => {
    try {
      const res = await reviewAttendanceCorrection(id, decision);
      if (res.success) {
        setCorrections((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: decision } : c))
        );
        router.refresh();
      }
    } catch (err: any) {
      alert(`Error reviewing correction: ${err?.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Bar: Date Selector & Location Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700">Date:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                router.push(`/dashboard/employees/attendance?date=${e.target.value}&location=${locationFilter}`);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700">Location:</span>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Staff</option>
              <option value="Office">Office Only</option>
              <option value="Site">Customer Site Only</option>
            </select>
          </div>
        </div>

        {canRecordAttendance && (
          <button
            type="button"
            onClick={() => setIsRecordModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Attendance</span>
          </button>
        )}
      </div>

      {/* Daily Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Attendance Log for <span className="text-indigo-600 font-mono">{date}</span>
          </h3>
          <span className="text-xs text-slate-500">
            {filteredAttendance.length} records on file
          </span>
        </div>

        {/* Desktop Zero-Scroll Table */}
        <div className="hidden md:block">
          <table className="w-full text-xs text-left table-fixed">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[15%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Work Location</th>
                <th className="px-4 py-3">Check In / Out</th>
                <th className="px-4 py-3">Total Hours</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Site / Deployment Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAttendance.map((att) => {
                const isSite = att.work_location === 'Site' || att.work_location === 'Field';

                return (
                  <tr key={att.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 truncate">
                      <div className="font-semibold text-slate-900 truncate">
                        {att.employee_name || att.employee_id}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">{att.employee_id}</div>
                    </td>

                    <td className="px-4 py-3 truncate">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isSite
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-sky-50 text-sky-700 border border-sky-200/60'
                        }`}
                      >
                        {isSite ? <HardHat className="w-3 h-3 shrink-0" /> : <Building2 className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{att.work_location}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-600 truncate">
                      {att.check_in || '—'} &bull; {att.check_out || '—'}
                    </td>

                    <td className="px-4 py-3 font-bold text-slate-800">
                      {att.total_hours} hrs
                      {att.overtime_hours > 0 && (
                        <span className="text-[10px] text-emerald-600 font-semibold block">
                          +{att.overtime_hours}h OT
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          att.attendance_status === 'Present' || att.attendance_status === 'Site Duty'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : att.attendance_status === 'Absent'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {att.attendance_status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-600 truncate">
                      {att.site_project_name && (
                        <div className="font-semibold text-slate-800 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">{att.site_project_name}</span>
                        </div>
                      )}
                      {att.remarks && <div className="text-[11px] text-slate-400 truncate">{att.remarks}</div>}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAttForCorrection(att);
                          setIsCorrectionModalOpen(true);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition cursor-pointer"
                      >
                        Request Correction
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredAttendance.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No attendance records logged for {date}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Zero-Scroll Cards */}
        <div className="block md:hidden space-y-3 p-3">
          {filteredAttendance.map((att) => {
            const isSite = att.work_location === 'Site' || att.work_location === 'Field';

            return (
              <div key={att.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">
                      {att.employee_name || att.employee_id}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{att.employee_id}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      att.attendance_status === 'Present' || att.attendance_status === 'Site Duty'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : att.attendance_status === 'Absent'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {att.attendance_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Location:</span>
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                      {isSite ? <HardHat className="w-3 h-3 text-amber-500" /> : <Building2 className="w-3 h-3 text-sky-500" />}
                      <span>{att.work_location}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Total Hours:</span>
                    <span className="font-bold text-slate-800">{att.total_hours} hrs</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 block">Check In / Out:</span>
                    <span className="font-mono text-slate-700">{att.check_in || '—'} &bull; {att.check_out || '—'}</span>
                  </div>
                  {att.site_project_name && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 block">Site / Project:</span>
                      <span className="font-medium text-slate-800">{att.site_project_name}</span>
                    </div>
                  )}
                </div>

                <div className="pt-1 border-t border-slate-200/70">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAttForCorrection(att);
                      setIsCorrectionModalOpen(true);
                    }}
                    className="w-full min-h-[44px] flex items-center justify-center rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition"
                  >
                    Request Correction
                  </button>
                </div>
              </div>
            );
          })}
          {filteredAttendance.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-xs">
              No attendance records logged for {date}.
            </div>
          )}
        </div>
      </div>

      {/* Attendance Correction Requests Audit Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Attendance Correction Requests</h3>
            <p className="text-xs text-slate-500">Formal audit workflow for roster adjustments.</p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            {corrections.filter((c) => c.status === 'Pending').length} Pending
          </span>
        </div>

        {/* Desktop Zero-Scroll Table */}
        <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-left table-fixed">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[20%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              {canApproveCorrections && <col className="w-[10%]" />}
            </colgroup>
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Employee</th>
                <th className="px-4 py-2.5">Change</th>
                <th className="px-4 py-2.5">Reason</th>
                <th className="px-4 py-2.5">Requested By</th>
                <th className="px-4 py-2.5">Status</th>
                {canApproveCorrections && <th className="px-4 py-2.5 text-right">Decision</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {corrections.map((corr) => (
                <tr key={corr.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-semibold text-slate-900 truncate">{corr.date || '—'}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800 truncate">{corr.employee_name || corr.employee_id}</td>
                  <td className="px-4 py-2.5 truncate">
                    <span className="text-rose-600 font-medium">{corr.previous_status}</span>
                    <span className="text-slate-400 mx-1">&rarr;</span>
                    <span className="text-emerald-600 font-bold">{corr.requested_status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 truncate" title={corr.reason}>{corr.reason}</td>
                  <td className="px-4 py-2.5 text-slate-500 truncate">{corr.requested_by}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        corr.status === 'Approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : corr.status === 'Rejected'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {corr.status}
                    </span>
                  </td>
                  {canApproveCorrections && (
                    <td className="px-4 py-2.5 text-right">
                      {corr.status === 'Pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCorrectionReview(corr.id, 'Approved')}
                            className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold cursor-pointer"
                            title="Approve"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCorrectionReview(corr.id, 'Rejected')}
                            className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold cursor-pointer"
                            title="Reject"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Decided</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Zero-Scroll Cards */}
        <div className="block md:hidden space-y-3">
          {corrections.map((corr) => (
            <div key={corr.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900 block">{corr.employee_name || corr.employee_id}</span>
                  <span className="text-[10px] text-slate-400">{corr.date || '—'}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    corr.status === 'Approved'
                      ? 'bg-emerald-50 text-emerald-700'
                      : corr.status === 'Rejected'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {corr.status}
                </span>
              </div>

              <div className="text-xs space-y-1">
                <div>
                  <span className="text-slate-400">Correction: </span>
                  <span className="text-rose-600 font-medium">{corr.previous_status}</span>
                  <span className="text-slate-400 mx-1">&rarr;</span>
                  <span className="text-emerald-600 font-bold">{corr.requested_status}</span>
                </div>
                <div>
                  <span className="text-slate-400">Reason: </span>
                  <span className="text-slate-700">{corr.reason}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Requested by: {corr.requested_by}
                </div>
              </div>

              {canApproveCorrections && corr.status === 'Pending' && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleCorrectionReview(corr.id, 'Approved')}
                    className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCorrectionReview(corr.id, 'Rejected')}
                    className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Record Attendance Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Record Employee Attendance</h3>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} className="p-6 space-y-3 text-xs">
              {message && (
                <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium">
                  {message}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Employee *</label>
                <select
                  value={recordForm.employee_id}
                  onChange={(e) => {
                    const emp = employees.find((emp) => emp.id === e.target.value);
                    setRecordForm({
                      ...recordForm,
                      employee_id: e.target.value,
                      work_location: (emp?.work_location_type as any) || 'Office',
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_id} - {e.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    value={recordForm.date}
                    onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Location Type</label>
                  <select
                    value={recordForm.work_location}
                    onChange={(e) =>
                      setRecordForm({ ...recordForm, work_location: e.target.value as WorkLocationType })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="Office">Office</option>
                    <option value="Site">Customer Site</option>
                    <option value="Field">Field Duty</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              {recordForm.work_location === 'Site' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Site / Customer Project</label>
                  <input
                    type="text"
                    placeholder="e.g. Swan Technologies Pvt Ltd (HITEC City Phase 2)"
                    value={recordForm.site_project_name}
                    onChange={(e) => setRecordForm({ ...recordForm, site_project_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Check In</label>
                  <input
                    type="time"
                    value={recordForm.check_in}
                    onChange={(e) => setRecordForm({ ...recordForm, check_in: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Check Out</label>
                  <input
                    type="time"
                    value={recordForm.check_out}
                    onChange={(e) => setRecordForm({ ...recordForm, check_out: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status</label>
                  <select
                    value={recordForm.attendance_status}
                    onChange={(e) =>
                      setRecordForm({ ...recordForm, attendance_status: e.target.value as AttendanceStatus })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-emerald-700"
                  >
                    <option value="Present">Present</option>
                    <option value="Site Duty">Site Duty</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Absent">Absent</option>
                    <option value="On Duty">On Duty</option>
                    <option value="Work From Home">WFH</option>
                    <option value="Leave">Leave</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. IFPD Wall mount installation complete"
                  value={recordForm.remarks}
                  onChange={(e) => setRecordForm({ ...recordForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  {submitting ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Correction Modal */}
      {isCorrectionModalOpen && selectedAttForCorrection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Request Attendance Correction</h3>
              <button
                type="button"
                onClick={() => setIsCorrectionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCorrectionSubmit} className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div>
                  <span className="text-slate-400">Employee: </span>
                  <span className="font-bold text-slate-800">
                    {selectedAttForCorrection.employee_name} ({selectedAttForCorrection.employee_id})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Date: </span>
                  <span className="font-bold text-slate-800">{selectedAttForCorrection.date}</span>
                </div>
                <div>
                  <span className="text-slate-400">Current Status: </span>
                  <span className="font-bold text-rose-600">{selectedAttForCorrection.attendance_status}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Requested Status *</label>
                <select
                  value={correctionForm.requested_status}
                  onChange={(e) =>
                    setCorrectionForm({
                      ...correctionForm,
                      requested_status: e.target.value as AttendanceStatus,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-emerald-700"
                >
                  <option value="Present">Present</option>
                  <option value="Site Duty">Site Duty</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Leave">Leave</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason for Correction *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Technician arrived directly at customer site for emergency mounting."
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  {submitting ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
