'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileCheck,
  Plus,
  Search,
  Printer,
  Upload,
  Download,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { getProformaInvoices, cancelProformaInvoice } from '@/lib/actions/proforma';
import { PrintProformaModal } from '@/components/modals/PrintProformaModal';
import { NewProformaModal } from '@/components/modals/NewProformaModal';
import { UploadSignedDocumentModal } from '@/components/modals/UploadSignedDocumentModal';
import { exportToCSV } from '@/lib/utils/export';
import { getCurrentSessionUser } from '@/lib/actions/users';
import { canExportCSV } from '@/lib/permissions/registry';
import type { ProformaInvoice } from '@/types/proforma';
import type { AuthenticatedUser } from '@/lib/auth/session';

export default function ProformaInvoicesPage() {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [proformas, setProformas] = useState<ProformaInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [selectedPrintProforma, setSelectedPrintProforma] = useState<ProformaInvoice | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [uploadDocTarget, setUploadDocTarget] = useState<ProformaInvoice | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getProformaInvoices({ status: statusFilter, search });
      setProformas(res.proformas);
    } catch (err) {
      console.error('Failed to load proformas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCurrentSessionUser().then(setCurrentUser);
  }, []);

  useEffect(() => {
    loadData();
  }, [statusFilter, search]);

  const totalValue = proformas.reduce((sum, p) => sum + (p.grand_total || 0), 0);
  const totalAdvance = proformas.reduce((sum, p) => sum + (p.advance_amount || 0), 0);
  const issuedCount = proformas.filter((p) => p.status === 'Issued' || p.status === 'Sent').length;
  const convertedCount = proformas.filter((p) => p.status === 'Converted to Order' || p.status === 'Converted to Invoice').length;

  const totalPages = Math.ceil(proformas.length / pageSize) || 1;
  const paginatedProformas = proformas.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCancel = async (p: ProformaInvoice) => {
    const reason = window.prompt(`Enter mandatory cancellation reason for ${p.proforma_number}:`);
    if (!reason || !reason.trim()) return;

    const res = await cancelProformaInvoice(p.id, reason.trim());
    if (res.success) {
      loadData();
    } else {
      alert(res.error || 'Failed to cancel proforma invoice');
    }
  };

  const handleExportCSV = () => {
    const rows = proformas.map((p) => ({
      proforma_number: p.proforma_number,
      date: p.proforma_date,
      customer: p.customer_name,
      company: p.company_name || '',
      gstin: p.gstin || '',
      subtotal: p.subtotal,
      discount: p.total_discount,
      taxable: p.taxable_amount,
      gst_total: p.gst_amount,
      grand_total: p.grand_total,
      advance_amount: p.advance_amount,
      balance_amount: p.balance_amount,
      status: p.status,
      quotation_ref: p.quotation_number || '',
      order_ref: p.order_number || '',
    }));
    const columns = [
      { key: 'proforma_no', label: 'Proforma Number' },
      { key: 'date', label: 'Date' },
      { key: 'customer', label: 'Customer' },
      { key: 'company', label: 'Company' },
      { key: 'gstin', label: 'GSTIN' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'discount', label: 'Discount' },
      { key: 'taxable', label: 'Taxable Amount' },
      { key: 'gst_total', label: 'GST Amount' },
      { key: 'grand_total', label: 'Grand Total' },
      { key: 'advance_amount', label: 'Advance Amount' },
      { key: 'balance_amount', label: 'Balance Due' },
      { key: 'status', label: 'Status' },
      { key: 'quotation_ref', label: 'Quotation Ref' },
      { key: 'order_ref', label: 'Order Ref' },
    ];
    exportToCSV(`Proforma_Invoices_${new Date().toISOString().split('T')[0]}`, rows, columns);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Issued':
      case 'Sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" />
            {status}
          </span>
        );
      case 'Converted to Order':
      case 'Converted to Invoice':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            {status}
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileCheck className="w-6 h-6 text-brand-700" />
              Proforma Invoices
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
              Not a Tax Invoice
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Optional commercial proforma billing for advance collection, purchase order processing, and customer approval.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {currentUser && canExportCSV(currentUser.role) && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition active:scale-95"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export CSV
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-800 hover:bg-brand-900 rounded-xl shadow-md transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Create Proforma
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Proformas</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{proformas.length}</div>
          <span className="text-[10px] text-slate-400">Recorded across FY</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Gross Proforma Value</span>
          <div className="text-xl font-extrabold text-brand-900 mt-1">₹{totalValue.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-slate-400">Total Commercial Proposals</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Advance Payable</span>
          <div className="text-xl font-extrabold text-emerald-700 mt-1">₹{totalAdvance.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-slate-400">Advance Required with Order</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Pipeline</span>
          <div className="text-xl font-extrabold text-blue-700 mt-1">{issuedCount} Issued</div>
          <span className="text-[10px] text-slate-400">{convertedCount} Converted to Orders</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by PI number, customer, company, quotation ref..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 text-xs">
          <span className="font-semibold text-slate-500 text-[11px] shrink-0">Filter Status:</span>
          {['ALL', 'Issued', 'Sent', 'Converted to Order', 'Cancelled'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-brand-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[11px]">
                <th className="py-3 px-4 font-bold">Proforma No</th>
                <th className="py-3 px-3 font-bold">Date / Valid Until</th>
                <th className="py-3 px-4 font-bold">Customer & Organization</th>
                <th className="py-3 px-3 font-bold text-right">Grand Total (₹)</th>
                <th className="py-3 px-3 font-bold text-right">Advance Terms</th>
                <th className="py-3 px-3 font-bold text-center">Status</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading proforma invoices...
                  </td>
                </tr>
              ) : paginatedProformas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <FileCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No proforma invoices found. Click "Create Proforma" to generate one.
                  </td>
                </tr>
              ) : (
                paginatedProformas.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-brand-900">{p.proforma_number}</div>
                      {p.quotation_number && (
                        <div className="text-[10px] text-slate-400 font-mono">Ref: {p.quotation_number}</div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-800 font-medium">{p.proforma_date}</div>
                      <div className="text-[10px] text-slate-500">Valid: {p.due_date}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{p.customer_name}</div>
                      {p.company_name && (
                        <div className="text-[11px] text-slate-500">{p.company_name}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{p.grand_total.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="font-mono font-semibold text-emerald-800">
                        ₹{p.advance_amount.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-slate-500">Bal: ₹{p.balance_amount.toLocaleString('en-IN')}</div>
                    </td>
                    <td className="py-3 px-3 text-center">{getStatusBadge(p.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPrintProforma(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition"
                          title="Print / Save Two-Copy PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setUploadDocTarget(p)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                          title="Archive Signed & Stamped Scan"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>

                        {p.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleCancel(p)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Cancel Proforma"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {proformas.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs">
            <span className="text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, proformas.length)} of{' '}
              {proformas.length} proformas
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <PrintProformaModal
        proforma={selectedPrintProforma}
        isOpen={Boolean(selectedPrintProforma)}
        onClose={() => setSelectedPrintProforma(null)}
      />

      <NewProformaModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={(created) => {
          loadData();
          setSelectedPrintProforma(created);
        }}
      />

      {uploadDocTarget && (
        <UploadSignedDocumentModal
          isOpen={Boolean(uploadDocTarget)}
          onClose={() => setUploadDocTarget(null)}
          onSuccess={() => {
            loadData();
            alert('Signed copy successfully archived!');
          }}
          defaultDocument={{
            document_type: 'PROFORMA_INVOICE',
            document_number: uploadDocTarget.proforma_number,
            customer_id: uploadDocTarget.customer_id,
            customer_name: uploadDocTarget.customer_name,
            company_name: uploadDocTarget.company_name,
            related_transaction_number: uploadDocTarget.quotation_number || uploadDocTarget.order_number,
          }}
        />
      )}
    </div>
  );
}
