'use client';

import React, { useState } from 'react';
import {
  FileCheck,
  Search,
  Printer,
  X,
  Building2,
  Plus,
  Download,
} from 'lucide-react';
import type { Employee, Payslip } from '@/types/hr';
import { generatePayslip } from '@/lib/actions/payroll';

interface PayslipsClientProps {
  initialPayslips: Payslip[];
  employees: Employee[];
  userRole: string;
}

export function PayslipsClient({
  initialPayslips,
  employees,
  userRole,
}: PayslipsClientProps) {
  const [payslips, setPayslips] = useState<Payslip[]>(initialPayslips);
  const [search, setSearch] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  const [genForm, setGenForm] = useState({
    employee_id: employees[0]?.id || '',
    payroll_month: 'September 2026',
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const filteredPayslips = payslips.filter((p) => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        p.payslip_number.toLowerCase().includes(q) ||
        p.employee_name.toLowerCase().includes(q) ||
        p.employee_code.toLowerCase().includes(q) ||
        p.payroll_month.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const res = await generatePayslip(genForm);
      if (res.success && res.payslip) {
        setPayslips((prev) => [res.payslip!, ...prev.filter((p) => p.id !== res.payslip!.id)]);
        setMessage(`Payslip ${res.payslip.payslip_number} generated!`);
        setTimeout(() => {
          setIsGenerateModalOpen(false);
          setMessage('');
        }, 1000);
      } else {
        setMessage(res.error || 'Failed to generate payslip.');
      }
    } catch (err: any) {
      setMessage(`Error: ${err?.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Toolbar & Generate Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search payslips by number (e.g. PAY/26-27/0001), employee name, or month..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsGenerateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Individual Payslip</span>
        </button>
      </div>

      {/* Payslips Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop Zero-Scroll Table */}
        <div className="hidden md:block">
          <table className="w-full text-xs text-left table-fixed">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[24%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Payslip #</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Period & Date</th>
                <th className="px-4 py-3">Gross / Deductions</th>
                <th className="px-4 py-3">Net Take-Home</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayslips.map((ps) => (
                <tr key={ps.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-bold text-indigo-700 truncate">{ps.payslip_number}</td>
                  <td className="px-4 py-3 truncate">
                    <div className="font-bold text-slate-900 truncate">{ps.employee_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">{ps.employee_code} &bull; {ps.designation}</div>
                  </td>
                  <td className="px-4 py-3 truncate">
                    <div className="font-semibold text-slate-800">{ps.payroll_month}</div>
                    <div className="text-[11px] text-slate-400">{ps.generated_at.split('T')[0]}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-slate-600">Gross: ₹{ps.gross_salary.toLocaleString('en-IN')}</div>
                    <div className="font-mono text-rose-600 text-[11px]">Ded: ₹{ps.total_deductions.toLocaleString('en-IN')}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-emerald-700 text-sm">₹{ps.net_salary.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedPayslip(ps)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>View & Print</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPayslips.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No payslips found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Zero-Scroll Cards */}
        <div className="block md:hidden space-y-3 p-3">
          {filteredPayslips.map((ps) => (
            <div key={ps.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">{ps.employee_name}</span>
                  <span className="font-mono text-[10px] text-slate-500">{ps.employee_code} &bull; {ps.designation}</span>
                </div>
                <span className="font-mono font-bold text-indigo-700 text-xs">{ps.payslip_number}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Payroll Month:</span>
                  <span className="font-medium text-slate-800">{ps.payroll_month}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Gross Salary:</span>
                  <span className="font-mono text-slate-700">₹{ps.gross_salary.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Deductions:</span>
                  <span className="font-mono text-rose-600">₹{ps.total_deductions.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Net Take-Home:</span>
                  <span className="font-mono font-black text-emerald-700">₹{ps.net_salary.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-200/70 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Issued: {ps.generated_at.split('T')[0]}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPayslip(ps)}
                  className="min-h-[44px] px-3.5 py-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>View & Print</span>
                </button>
              </div>
            </div>
          ))}
          {filteredPayslips.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-xs">
              No payslips found matching your search.
            </div>
          )}
        </div>
      </div>

      {/* Generate Payslip Modal */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Generate Individual Payslip</h3>
            <p className="text-xs text-slate-500">
              Generates a sequential collision-safe voucher based on the employee&apos;s active salary.
            </p>

            {message && (
              <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
                {message}
              </div>
            )}

            <form onSubmit={handleGenerate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Employee</label>
                <select
                  value={genForm.employee_id}
                  onChange={(e) => setGenForm({ ...genForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payroll Month Label</label>
                <input
                  type="text"
                  placeholder="e.g. September 2026"
                  value={genForm.payroll_month}
                  onChange={(e) => setGenForm({ ...genForm, payroll_month: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  {submitting ? 'Generating...' : 'Issue Payslip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formal Printable Payslip Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in-50 zoom-in-95">
            {/* Modal Actions Bar (hidden on print) */}
            <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
              <span className="text-xs font-bold text-slate-600 font-mono">
                {selectedPayslip.payslip_number}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-xs hover:bg-indigo-700 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Payslip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayslip(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Formal Printable Payslip Content */}
            <div className="p-8 space-y-6 text-slate-900 print:p-0">
              {/* Organization Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <img
                      src="/icon-emblem.png"
                      alt="ICON TECH PRO"
                      className="w-10 h-10 object-contain rounded-lg"
                    />
                    <div>
                      <h2 className="text-base font-black tracking-tight leading-none">ICON TECH PRO</h2>
                      <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">
                        UNIFIED SOLUTIONS PRIVATE LIMITED
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 max-w-sm leading-tight">
                    Plot 42, Image Gardens Rd, VIP Hills, Madhapur, Hyderabad, Telangana 500081
                    <br />
                    GSTIN: 36AAACI2026P1Z1 &bull; PAN: AAACI2026P
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                    PAYSLIP VOUCHER
                  </span>
                  <span className="text-sm font-mono font-black text-indigo-700 block">
                    {selectedPayslip.payslip_number}
                  </span>
                  <span className="text-xs font-bold text-slate-700 block mt-1">
                    Month: {selectedPayslip.payroll_month}
                  </span>
                </div>
              </div>

              {/* Employee Particulars Grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Employee Name</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedPayslip.employee_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Employee ID</span>
                  <span className="font-mono font-bold text-slate-900">{selectedPayslip.employee_code}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Designation</span>
                  <span className="font-semibold text-slate-800">{selectedPayslip.designation}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Department</span>
                  <span className="font-semibold text-slate-800">{selectedPayslip.department}</span>
                </div>
              </div>

              {/* Earnings & Deductions Statement */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* Earnings Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-bold uppercase text-[10px] text-slate-700 border-b border-slate-200 flex justify-between">
                    <span>Earnings Component</span>
                    <span>Amount (₹)</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Basic Salary</span>
                      <span className="font-mono font-semibold">₹{(selectedPayslip.basic || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">House Rent Allowance (HRA)</span>
                      <span className="font-mono font-semibold">₹{(selectedPayslip.hra || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Conveyance Allowance</span>
                      <span className="font-mono font-semibold">₹{(selectedPayslip.conveyance || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Special / Other Allowances</span>
                      <span className="font-mono font-semibold">₹{(selectedPayslip.allowances || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 font-bold flex justify-between text-slate-900">
                    <span>Gross Earnings</span>
                    <span className="font-mono">₹{selectedPayslip.gross_salary.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Deductions Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-bold uppercase text-[10px] text-slate-700 border-b border-slate-200 flex justify-between">
                    <span>Deductions Component</span>
                    <span>Amount (₹)</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Provident Fund (PF)</span>
                      <span className="font-mono font-semibold">₹{(selectedPayslip.pf || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">ESI Contribution</span>
                      <span className="font-mono font-semibold">₹{(selectedPayslip.esi || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Professional Tax (PT)</span>
                      <span className="font-mono font-semibold">₹{(selectedPayslip.pt || 200).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Income Tax (TDS)</span>
                      <span className="font-mono font-semibold">₹{(selectedPayslip.tds || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 font-bold flex justify-between text-rose-700">
                    <span>Total Deductions</span>
                    <span className="font-mono">₹{selectedPayslip.total_deductions.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Net Payout Banner */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 block font-bold">
                    Net Take-Home Pay
                  </span>
                  <span className="text-xs text-slate-300">
                    Direct NEFT Bank Transfer
                  </span>
                </div>
                <div className="text-2xl font-mono font-black text-emerald-400">
                  ₹{selectedPayslip.net_salary.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Signatory Footer */}
              <div className="pt-8 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <div>
                  <span className="block font-semibold text-slate-700">Computer Generated Document</span>
                  <span className="text-[10px]">Timestamp: {selectedPayslip.generated_at}</span>
                </div>

                <div className="text-right">
                  <div className="w-32 border-b border-slate-400 mb-1"></div>
                  <span className="font-bold text-slate-800 text-[11px] block">Authorized Signatory</span>
                  <span className="text-[10px] text-slate-400">ICON TECH PRO</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
