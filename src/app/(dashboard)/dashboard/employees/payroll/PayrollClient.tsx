'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Plus,
  Calendar,
  Check,
  CheckCircle2,
  X,
  FileCheck,
  Building2,
  TrendingUp,
} from 'lucide-react';
import type {
  Employee,
  EmployeeSalaryHistory,
  PayrollRun,
} from '@/types/hr';
import {
  createPayrollRun,
  updatePayrollStatus,
  updateEmployeeSalary,
} from '@/lib/actions/payroll';

interface PayrollClientProps {
  initialSalaries: EmployeeSalaryHistory[];
  initialPayrollRuns: PayrollRun[];
  employees: Employee[];
  userRole: string;
}

export function PayrollClient({
  initialSalaries,
  initialPayrollRuns,
  employees,
  userRole,
}: PayrollClientProps) {
  const [salaries, setSalaries] = useState<EmployeeSalaryHistory[]>(initialSalaries);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>(initialPayrollRuns);
  const [activeTab, setActiveTab] = useState<'runs' | 'structures'>('runs');

  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState(false);
  const [newRunMonth, setNewRunMonth] = useState('2026-10');
  const [isReviseModalOpen, setIsReviseModalOpen] = useState(false);
  const [selectedEmpForRevise, setSelectedEmpForRevise] = useState<Employee | null>(null);

  const [reviseForm, setReviseForm] = useState({
    basic_salary: 30000,
    hra: 15000,
    conveyance: 3000,
    special_allowance: 7000,
    other_allowances: 0,
    pf: 3600,
    esi: 0,
    professional_tax: 200,
    tds: 1000,
    revision_reason: 'Annual Performance Appraisal',
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const res = await createPayrollRun(newRunMonth);
      if (res.success && res.payrollRun) {
        setPayrollRuns((prev) => [res.payrollRun!, ...prev]);
        setMessage(`Payroll batch for ${newRunMonth} created!`);
        setTimeout(() => {
          setIsNewRunModalOpen(false);
          setMessage('');
        }, 1000);
      } else {
        setMessage(res.error || 'Failed to generate run.');
      }
    } catch (err: any) {
      setMessage(`Error: ${err?.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (runId: string, newStatus: PayrollRun['status']) => {
    let paymentRef: string | undefined;
    if (newStatus === 'Paid') {
      const ref = prompt('Enter Bank / NEFT Settlement Reference (e.g. HDFC-NEFT-991823):');
      if (!ref) return;
      paymentRef = ref;
    }

    try {
      const res = await updatePayrollStatus(runId, newStatus, paymentRef);
      if (res.success) {
        setPayrollRuns((prev) =>
          prev.map((r) =>
            r.id === runId
              ? {
                  ...r,
                  status: newStatus,
                  payment_reference: paymentRef || r.payment_reference,
                  payment_date: newStatus === 'Paid' ? new Date().toISOString().split('T')[0] : r.payment_date,
                }
              : r
          )
        );
      }
    } catch (err: any) {
      alert(`Error updating payroll status: ${err?.message}`);
    }
  };

  const handleReviseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForRevise) return;
    setSubmitting(true);
    setMessage('');

    try {
      const res = await updateEmployeeSalary({
        employee_id: selectedEmpForRevise.id,
        effective_from: new Date().toISOString().split('T')[0],
        ...reviseForm,
      });

      if (res.success && res.salary) {
        setSalaries((prev) => [
          res.salary!,
          ...prev.filter((s) => s.employee_id !== selectedEmpForRevise.id),
        ]);
        setMessage('Salary revision saved and archived!');
        setTimeout(() => {
          setIsReviseModalOpen(false);
          setSelectedEmpForRevise(null);
          setMessage('');
        }, 1000);
      }
    } catch (err: any) {
      setMessage(`Error: ${err?.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('runs')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'runs'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Monthly Payroll Batches ({payrollRuns.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('structures')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'structures'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Salary Structures & Allowances ({salaries.length})
          </button>
        </div>

        {activeTab === 'runs' && (
          <button
            type="button"
            onClick={() => setIsNewRunModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition mb-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate Monthly Batch</span>
          </button>
        )}
      </div>

      {/* TAB 1: MONTHLY PAYROLL BATCHES */}
      {activeTab === 'runs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop Zero-Scroll Table */}
        <div className="hidden md:block">
          <table className="w-full text-xs text-left table-fixed">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Batch Code</th>
                <th className="px-4 py-3">Payroll Month</th>
                <th className="px-4 py-3">Gross / Deductions</th>
                <th className="px-4 py-3">Net Payout</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment Reference</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrollRuns.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 truncate">{run.payroll_code}</td>
                  <td className="px-4 py-3 truncate">
                    <div className="font-semibold text-slate-800">{run.payroll_month}</div>
                    <div className="text-[11px] text-slate-400 font-bold">{run.total_employees} staff</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-slate-600">Gross: ₹{run.total_gross.toLocaleString('en-IN')}</div>
                    <div className="font-mono text-rose-600 text-[11px]">Ded: ₹{run.total_deductions.toLocaleString('en-IN')}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-700 text-sm">₹{run.total_net_payout.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        run.status === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : run.status === 'Approved'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-[11px] truncate">
                    {run.payment_reference || 'Pending'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {run.status !== 'Paid' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        {run.status === 'Draft' || run.status === 'Calculated' ? (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(run.id, 'Reviewed')}
                            className="px-2 py-1 text-[11px] font-semibold text-sky-700 bg-sky-50 rounded hover:bg-sky-100 cursor-pointer"
                          >
                            Review
                          </button>
                        ) : null}

                        {run.status === 'Reviewed' ? (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(run.id, 'Approved')}
                            className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100 cursor-pointer"
                          >
                            Approve
                          </button>
                        ) : null}

                        {run.status === 'Approved' ? (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(run.id, 'Paid')}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 rounded hover:bg-emerald-700 shadow-2xs cursor-pointer"
                          >
                            Mark Paid
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-600">Disbursed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Zero-Scroll Cards */}
        <div className="block md:hidden space-y-3 p-3">
          {payrollRuns.map((run) => (
            <div key={run.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">{run.payroll_month}</span>
                  <span className="font-mono text-[10px] text-slate-500">{run.payroll_code} &bull; {run.total_employees} staff</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    run.status === 'Paid'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : run.status === 'Approved'
                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {run.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Gross Payout:</span>
                  <span className="font-mono text-slate-700">₹{run.total_gross.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Deductions:</span>
                  <span className="font-mono text-rose-600">₹{run.total_deductions.toLocaleString('en-IN')}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 block">Net Payout:</span>
                  <span className="font-mono font-black text-emerald-700 text-sm">₹{run.total_net_payout.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {run.status !== 'Paid' && (
                <div className="pt-2 border-t border-slate-200/70">
                  {run.status === 'Draft' || run.status === 'Calculated' ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(run.id, 'Reviewed')}
                      className="w-full min-h-[44px] flex items-center justify-center rounded-lg bg-sky-600 text-white font-bold text-xs hover:bg-sky-700 transition"
                    >
                      Mark Reviewed
                    </button>
                  ) : null}

                  {run.status === 'Reviewed' ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(run.id, 'Approved')}
                      className="w-full min-h-[44px] flex items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition"
                    >
                      Approve Batch
                    </button>
                  ) : null}

                  {run.status === 'Approved' ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(run.id, 'Paid')}
                      className="w-full min-h-[44px] flex items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
                    >
                      Confirm Payout Disbursed
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
        </div>
      )}

      {/* TAB 2: SALARY STRUCTURES */}
      {activeTab === 'structures' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Desktop Zero-Scroll Table */}
          <div className="hidden md:block">
            <table className="w-full text-xs text-left table-fixed">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[20%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Basic & HRA</th>
                  <th className="px-4 py-3">Gross Salary</th>
                  <th className="px-4 py-3">Deductions</th>
                  <th className="px-4 py-3">Net & CTC</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salaries.map((sal) => {
                  const emp = employees.find((e) => e.id === sal.employee_id || e.employee_id === sal.employee_id);

                  return (
                    <tr key={sal.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 truncate">
                        <div className="font-bold text-slate-900 truncate">{emp?.full_name || sal.employee_id}</div>
                        <div className="text-[11px] text-slate-400 truncate">{emp?.designation || 'Staff'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-slate-700">B: ₹{sal.basic_salary.toLocaleString('en-IN')}</div>
                        <div className="font-mono text-slate-500 text-[11px]">HRA: ₹{sal.hra.toLocaleString('en-IN')}</div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        ₹{sal.gross_salary.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-mono text-rose-600">
                        ₹{sal.total_deductions.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono font-black text-emerald-700">Net: ₹{sal.net_salary.toLocaleString('en-IN')}</div>
                        <div className="font-mono text-slate-500 text-[11px]">CTC: ₹{sal.ctc.toLocaleString('en-IN')}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (emp) {
                              setSelectedEmpForRevise(emp);
                              setReviseForm({
                                basic_salary: sal.basic_salary,
                                hra: sal.hra,
                                conveyance: sal.conveyance,
                                special_allowance: sal.special_allowance,
                                other_allowances: sal.other_allowances,
                                pf: sal.pf,
                                esi: sal.esi,
                                professional_tax: sal.professional_tax,
                                tds: sal.tds,
                                revision_reason: 'Annual Increment & Performance Revision',
                              });
                              setIsReviseModalOpen(true);
                            }
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                        >
                          Revise
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Zero-Scroll Cards */}
          <div className="block md:hidden space-y-3 p-3">
            {salaries.map((sal) => {
              const emp = employees.find((e) => e.id === sal.employee_id || e.employee_id === sal.employee_id);

              return (
                <div key={sal.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">{emp?.full_name || sal.employee_id}</span>
                      <span className="text-[11px] text-slate-500">{emp?.designation || 'Staff'}</span>
                    </div>
                    <span className="font-mono font-black text-emerald-700 text-xs">
                      ₹{sal.net_salary.toLocaleString('en-IN')}/mo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Basic Pay:</span>
                      <span className="font-mono text-slate-700">₹{sal.basic_salary.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Gross Salary:</span>
                      <span className="font-mono text-slate-700 font-bold">₹{sal.gross_salary.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Deductions:</span>
                      <span className="font-mono text-rose-600">₹{sal.total_deductions.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Annual CTC:</span>
                      <span className="font-mono text-slate-800 font-medium">₹{sal.ctc.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => {
                        if (emp) {
                          setSelectedEmpForRevise(emp);
                          setReviseForm({
                            basic_salary: sal.basic_salary,
                            hra: sal.hra,
                            conveyance: sal.conveyance,
                            special_allowance: sal.special_allowance,
                            other_allowances: sal.other_allowances,
                            pf: sal.pf,
                            esi: sal.esi,
                            professional_tax: sal.professional_tax,
                            tds: sal.tds,
                            revision_reason: 'Annual Increment & Performance Revision',
                          });
                          setIsReviseModalOpen(true);
                        }
                      }}
                      className="w-full min-h-[44px] flex items-center justify-center rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition"
                    >
                      Revise Salary Structure
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Generate Monthly Run Modal */}
      {isNewRunModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Generate Monthly Payroll Run</h3>
            <p className="text-xs text-slate-500">
              Computes earnings and statutory deductions across all active salary structures.
            </p>

            {message && (
              <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
                {message}
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-700 font-semibold mb-1">Select Month</label>
              <input
                type="month"
                value={newRunMonth}
                onChange={(e) => setNewRunMonth(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewRunModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateRun}
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
              >
                {submitting ? 'Calculating...' : 'Generate Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revise Salary Modal */}
      {isReviseModalOpen && selectedEmpForRevise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                Revise Salary: {selectedEmpForRevise.full_name} ({selectedEmpForRevise.employee_id})
              </h3>
              <button
                type="button"
                onClick={() => setIsReviseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReviseSubmit} className="p-6 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Basic Salary (₹) *</label>
                  <input
                    type="number"
                    value={reviseForm.basic_salary}
                    onChange={(e) => setReviseForm({ ...reviseForm, basic_salary: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">HRA (₹) *</label>
                  <input
                    type="number"
                    value={reviseForm.hra}
                    onChange={(e) => setReviseForm({ ...reviseForm, hra: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Conveyance (₹)</label>
                  <input
                    type="number"
                    value={reviseForm.conveyance}
                    onChange={(e) => setReviseForm({ ...reviseForm, conveyance: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Special Allowance (₹)</label>
                  <input
                    type="number"
                    value={reviseForm.special_allowance}
                    onChange={(e) => setReviseForm({ ...reviseForm, special_allowance: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">PF Deduction (₹)</label>
                  <input
                    type="number"
                    value={reviseForm.pf}
                    onChange={(e) => setReviseForm({ ...reviseForm, pf: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">TDS / Income Tax (₹)</label>
                  <input
                    type="number"
                    value={reviseForm.tds}
                    onChange={(e) => setReviseForm({ ...reviseForm, tds: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Revision Justification / Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Promotion & Performance Grade Upgrade"
                  value={reviseForm.revision_reason}
                  onChange={(e) => setReviseForm({ ...reviseForm, revision_reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviseModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  {submitting ? 'Saving...' : 'Save & Archive Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
