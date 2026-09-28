'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Printer,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Download,
  Mail,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getInvoices, getPayments } from '@/lib/actions/billing';
import { PrintInvoiceModal } from '@/components/modals/PrintInvoiceModal';
import { RecordPaymentModal } from '@/components/modals/RecordPaymentModal';
import { PaymentReminderModal } from '@/components/modals/PaymentReminderModal';
import { exportToCSV } from '@/lib/utils/export';
import type { Invoice, Payment } from '@/types/erp';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalReceivables, setTotalReceivables] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [agingBucket, setAgingBucket] = useState<'ALL' | '0-30' | '31-60' | '61-90' | '90+'>('ALL');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices');

  const [selectedPrintInvoice, setSelectedPrintInvoice] = useState<Invoice | null>(null);
  const [selectedPayInvoice, setSelectedPayInvoice] = useState<Invoice | null>(null);
  const [selectedRemindInvoice, setSelectedRemindInvoice] = useState<Invoice | null>(null);

  const loadData = async () => {
    const res = await getInvoices({ status: statusFilter, search });
    setInvoices(res.invoices);
    setTotalReceivables(res.totalReceivables);
    setTotalCollected(res.totalCollected);

    const payRes = await getPayments();
    setPayments(payRes.payments);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, search]);

  const getInvoiceAgeDays = (dueDateStr: string, invoiceDateStr: string) => {
    const ref = new Date(dueDateStr || invoiceDateStr).getTime();
    return Math.max(0, Math.floor((Date.now() - ref) / (1000 * 60 * 60 * 24)));
  };

  const bucket0_30 = invoices
    .filter((i) => i.balance_amount > 0 && getInvoiceAgeDays(i.due_date, i.invoice_date) <= 30)
    .reduce((acc, i) => acc + i.balance_amount, 0);

  const bucket31_60 = invoices
    .filter((i) => {
      const age = getInvoiceAgeDays(i.due_date, i.invoice_date);
      return i.balance_amount > 0 && age > 30 && age <= 60;
    })
    .reduce((acc, i) => acc + i.balance_amount, 0);

  const bucket61_90 = invoices
    .filter((i) => {
      const age = getInvoiceAgeDays(i.due_date, i.invoice_date);
      return i.balance_amount > 0 && age > 60 && age <= 90;
    })
    .reduce((acc, i) => acc + i.balance_amount, 0);

  const bucket90_plus = invoices
    .filter((i) => i.balance_amount > 0 && getInvoiceAgeDays(i.due_date, i.invoice_date) > 90)
    .reduce((acc, i) => acc + i.balance_amount, 0);

  const filteredInvoices = invoices.filter((i) => {
    if (agingBucket === 'ALL') return true;
    const age = getInvoiceAgeDays(i.due_date, i.invoice_date);
    if (agingBucket === '0-30') return age <= 30;
    if (agingBucket === '31-60') return age > 30 && age <= 60;
    if (agingBucket === '61-90') return age > 60 && age <= 90;
    if (agingBucket === '90+') return age > 90;
    return true;
  });

  const totalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExportCSV = () => {
    if (activeTab === 'invoices') {
      exportToCSV('ICON_Tax_Invoices', invoices, [
        { key: 'invoice_number', label: 'Invoice #' },
        { key: 'customer_name', label: 'Customer Name' },
        { key: 'company_name', label: 'Company Name' },
        { key: 'gstin', label: 'GSTIN' },
        { key: 'invoice_date', label: 'Invoice Date' },
        { key: 'due_date', label: 'Due Date' },
        { key: 'grand_total', label: 'Grand Total (₹)' },
        { key: 'paid_amount', label: 'Amount Paid (₹)' },
        { key: 'balance_amount', label: 'Balance Due (₹)' },
        { key: 'status', label: 'Status' },
      ]);
    } else {
      exportToCSV('ICON_Payment_Receipts', payments, [
        { key: 'payment_number', label: 'Receipt #' },
        { key: 'invoice_id', label: 'Invoice Ref' },
        { key: 'amount', label: 'Amount Received (₹)' },
        { key: 'mode', label: 'Mode' },
        { key: 'reference_number', label: 'UTR / Cheque #' },
        { key: 'payment_date', label: 'Payment Date' },
      ]);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Invoices & Financial Receivables
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold">
              GST Tax Invoices
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Compliant 18% CGST + SGST tax invoicing, payment tracking, and ledger reconciliation
          </p>
        </div>

        {/* Tab Selector & Export */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                activeTab === 'invoices' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tax Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                activeTab === 'payments' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Payment Receipts ({payments.length})
            </button>
          </div>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Outstanding Receivables
            </span>
            <div className="text-2xl font-black text-rose-600 mt-1">
              ₹{totalReceivables.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Pending collection from clients</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Payments Cleared
            </span>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              ₹{totalCollected.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Deposited to HDFC Bank A/C</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Receivable Aging Analysis Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Receivable Aging Analysis (Days Overdue)
            </span>
            <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 text-[10px] font-bold font-mono">
              Working Capital Health
            </span>
          </div>
          {agingBucket !== 'ALL' && (
            <button
              onClick={() => setAgingBucket('ALL')}
              className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
            >
              Clear Aging Filter ({agingBucket})
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: '0-30', label: '0-30 Days', desc: 'Current / Due Soon', amount: bucket0_30, color: 'text-emerald-700', bg: 'bg-emerald-50/70 border-emerald-200' },
            { key: '31-60', label: '31-60 Days', desc: 'Mild Delay', amount: bucket31_60, color: 'text-blue-700', bg: 'bg-blue-50/70 border-blue-200' },
            { key: '61-90', label: '61-90 Days', desc: 'Overdue Follow-up', amount: bucket61_90, color: 'text-amber-700', bg: 'bg-amber-50/70 border-amber-200' },
            { key: '90+', label: '90+ Days', desc: 'Critical Default Risk', amount: bucket90_plus, color: 'text-rose-700', bg: 'bg-rose-50/70 border-rose-200' },
          ].map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setAgingBucket(agingBucket === b.key ? 'ALL' : b.key as any)}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${b.bg} ${
                agingBucket === b.key ? 'ring-2 ring-brand-500 font-bold' : 'hover:opacity-90'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-black">{b.label}</span>
                <span className="text-[10px] text-slate-500 font-medium">{b.desc}</span>
              </div>
              <div className={`text-base font-black mt-1 ${b.color}`}>
                ₹{Math.round(b.amount).toLocaleString('en-IN')}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Invoice #, Customer Name, GSTIN..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {activeTab === 'invoices' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-700 w-full sm:w-auto"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
          </select>
        )}
      </div>

      {activeTab === 'invoices' ? (
        /* Invoices Table & Cards Container */
        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
          {/* Desktop Table View - Fitted to available width without horizontal scrollbars */}
          <div className="hidden md:block w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3 w-[20%]">Invoice # / Dates</th>
                  <th className="py-2.5 px-3 w-[26%]">Customer / Company</th>
                  <th className="py-2.5 px-3 text-right w-[20%]">Financials (₹)</th>
                  <th className="py-2.5 px-3 text-center w-[16%]">Status</th>
                  <th className="py-2.5 px-3 text-right w-[18%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 align-top font-bold text-slate-900">
                      <span className="font-mono text-brand-700 block">{inv.invoice_number}</span>
                      <div className="text-[10.5px] text-slate-500 font-normal mt-0.5">
                        <span>Inv: {inv.invoice_date}</span>
                        <span className="block text-slate-400">Due: {inv.due_date}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 align-top">
                      <strong className="text-slate-900 font-bold block truncate">
                        {inv.company_name || inv.customer_name}
                      </strong>
                      {inv.gstin && (
                        <span className="text-slate-400 font-mono text-[10px] block truncate">
                          GSTIN: {inv.gstin}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 align-top text-right">
                      <div className="font-black text-slate-900 text-sm font-mono">
                        ₹{Math.round(inv.grand_total).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10.5px] mt-0.5 font-medium">
                        <span className="text-emerald-600">Paid: ₹{Math.round(inv.paid_amount || 0).toLocaleString('en-IN')}</span>
                      </div>
                      {inv.balance_amount > 0 && (
                        <div className="text-[10.5px] font-bold text-rose-600">
                          Bal: ₹{Math.round(inv.balance_amount || 0).toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 align-top text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                          inv.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : inv.status === 'Partially Paid'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : 'bg-rose-50 text-rose-700 border-rose-300'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 align-top text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedPrintInvoice(inv)}
                          title="Print GST Invoice"
                          className="p-1 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50 border border-slate-200 transition"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {inv.status !== 'Paid' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedRemindInvoice(inv)}
                              title="Send Payment Reminder"
                              className="px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition text-[10.5px] border border-blue-200"
                            >
                              <span>Remind</span>
                            </button>

                            <button
                              onClick={() => setSelectedPayInvoice(inv)}
                              title="Record Payment Receipt"
                              className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold transition text-[10.5px] border border-emerald-200"
                            >
                              <span>Pay</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards View */}
          <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
            {paginatedInvoices.map((inv) => (
              <div key={inv.id} className="pt-3 first:pt-0 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-brand-700">
                    {inv.invoice_number}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      inv.status === 'Paid'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : inv.status === 'Partially Paid'
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-rose-50 text-rose-700 border-rose-300'
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {inv.company_name || inv.customer_name}
                  </h4>
                  {inv.gstin && (
                    <p className="text-[11px] text-slate-400 font-mono">GSTIN: {inv.gstin}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span><strong>Date:</strong> {inv.invoice_date}</span>
                    <span><strong>Due:</strong> {inv.due_date}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                      Paid / Balance
                    </span>
                    <span className="text-emerald-700 font-bold text-xs">
                      Paid: ₹{Math.round(inv.paid_amount || 0).toLocaleString('en-IN')}
                    </span>
                    {inv.balance_amount > 0 && (
                      <span className="text-rose-600 font-bold text-xs block">
                        Bal: ₹{Math.round(inv.balance_amount || 0).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                      Grand Total
                    </span>
                    <span className="font-mono font-black text-slate-950 text-sm">
                      ₹{Math.round(inv.grand_total).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Mobile Quick Action Buttons (min 44px touch targets) */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPrintInvoice(inv)}
                    className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>View / Print</span>
                  </button>

                  {inv.status !== 'Paid' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedRemindInvoice(inv)}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Remind</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPayInvoice(inv)}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Table Pagination Toolbar */}
          <div className="p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/50">
            <div className="flex items-center gap-2 text-slate-600">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 border border-slate-200 rounded-lg bg-white font-medium text-slate-700 outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-slate-400 font-mono">
                Showing {paginatedInvoices.length} of {filteredInvoices.length} invoices
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-bold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Payments Table & Cards Container */
        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
          {/* Desktop Table View - Fitted to available width without horizontal scrollbars */}
          <div className="hidden md:block w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3 w-[22%]">Receipt # / Invoice #</th>
                  <th className="py-2.5 px-3 w-[26%]">Customer Name</th>
                  <th className="py-2.5 px-3 w-[22%]">Payment Date / Mode</th>
                  <th className="py-2.5 px-3 text-right w-[15%]">Amount (₹)</th>
                  <th className="py-2.5 px-3 w-[15%]">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 align-top font-bold text-slate-900">
                      <span className="font-mono block">{p.payment_number}</span>
                      <span className="text-brand-700 font-semibold font-mono text-[11px]">{p.invoice_number}</span>
                    </td>
                    <td className="py-3 px-3 align-top font-medium text-slate-900 truncate">
                      {p.customer_name}
                    </td>
                    <td className="py-3 px-3 align-top">
                      <span className="text-slate-600 block">{p.payment_date}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 font-semibold text-slate-700 text-[9.5px]">
                          {p.mode}
                        </span>
                        {p.reference_number && (
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">
                            {p.reference_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top text-right font-black text-emerald-600 text-sm whitespace-nowrap font-mono">
                      ₹{Math.round(p.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 align-top text-slate-600 font-medium truncate">
                      {p.recorded_by_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards View */}
          <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
            {payments.map((p) => (
              <div key={p.id} className="pt-3 first:pt-0 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-slate-900">
                    {p.payment_number}
                  </span>
                  <span className="font-mono text-xs font-bold text-brand-700">
                    {p.invoice_number}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {p.customer_name}
                </h4>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-600">{p.payment_date} &bull; {p.mode}</span>
                    {p.reference_number && (
                      <span className="text-[10px] text-slate-400 block font-mono">Ref: {p.reference_number}</span>
                    )}
                  </div>
                  <span className="font-mono font-black text-emerald-600 text-sm">
                    ₹{Math.round(p.amount).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Recorded by: <span className="font-medium text-slate-600">{p.recorded_by_name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <PrintInvoiceModal
        invoice={selectedPrintInvoice}
        isOpen={!!selectedPrintInvoice}
        onClose={() => setSelectedPrintInvoice(null)}
      />
      <RecordPaymentModal
        invoice={selectedPayInvoice}
        isOpen={!!selectedPayInvoice}
        onClose={() => setSelectedPayInvoice(null)}
        onSuccess={loadData}
      />
      <PaymentReminderModal
        invoice={selectedRemindInvoice}
        isOpen={!!selectedRemindInvoice}
        onClose={() => setSelectedRemindInvoice(null)}
      />
    </div>
  );
}
