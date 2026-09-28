'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Printer,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  Edit3,
  Copy,
  History,
  TrendingUp,
  X,
  RefreshCw,
  Eye,
  Calendar,
  Filter,
} from 'lucide-react';
import {
  getQuotations,
  convertQuotationToOrder,
  updateQuotationStatus,
  cloneQuotation,
  getQuotationRevisions,
} from '@/lib/actions/quotations';
import { INITIAL_QUOTATIONS } from '@/lib/constants/erp-data';
import { PrintQuotationModal } from '@/components/modals/PrintQuotationModal';
import { exportToCSV } from '@/lib/utils/export';
import type { Quotation, QuotationStatus } from '@/types/erp';

export default function QuotationsRegisterPage() {
  const router = useRouter();

  const [quotations, setQuotations] = useState<Quotation[]>(INITIAL_QUOTATIONS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [salespersonFilter, setSalespersonFilter] = useState('ALL');

  const [selectedPrintQuote, setSelectedPrintQuote] = useState<Quotation | null>(null);

  // Revision History Modal state
  const [revisionModalQuote, setRevisionModalQuote] = useState<Quotation | null>(null);
  const [revisionsList, setRevisionsList] = useState<any[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  const loadData = async () => {
    try {
      const res = await getQuotations({ status: statusFilter, search });
      if (res && res.quotations) {
        setQuotations(res.quotations);
      }
    } catch (err) {
      console.error('Failed to load quotations:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, search]);

  const handleConvert = async (quoteId: string) => {
    await convertQuotationToOrder(quoteId);
    loadData();
  };

  const handleClone = async (quoteId: string) => {
    const res = await cloneQuotation(quoteId);
    if (res.success) {
      loadData();
    }
  };

  const handleExportCSV = () => {
    exportToCSV('ICON_Quotations_Register', quotations, [
      { key: 'quotation_number', label: 'Quotation No.' },
      { key: 'quotation_date', label: 'Date' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'company_name', label: 'Company' },
      { key: 'salesperson_name', label: 'Salesperson' },
      { key: 'subtotal', label: 'Subtotal (₹)' },
      { key: 'taxable_amount', label: 'Taxable (₹)' },
      { key: 'grand_total', label: 'Grand Total (₹)' },
      { key: 'status', label: 'Status' },
    ]);
  };

  const handleOpenRevisions = async (quote: Quotation) => {
    setRevisionModalQuote(quote);
    setLoadingRevisions(true);
    setRevisionsList([]);
    try {
      const revisions = await getQuotationRevisions(quote.id);
      setRevisionsList(revisions || []);
    } finally {
      setLoadingRevisions(false);
    }
  };

  // Filter by salesperson
  const filteredQuotes = quotations.filter((q) => {
    if (salespersonFilter === 'ALL') return true;
    return q.salesperson_name === salespersonFilter;
  });

  // Helper: Determine next action based on quotation status
  const getNextAction = (q: Quotation) => {
    switch (q.status) {
      case 'Draft':
        return { label: 'Complete & Send', color: 'text-amber-700 bg-amber-50 border-amber-200' };
      case 'Sent':
      case 'Follow-up':
        return { label: 'Follow-up Due', color: 'text-blue-700 bg-blue-50 border-blue-200' };
      case 'Approved':
      case 'Accepted':
        return { label: 'Prepare Order', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'Approval Pending':
        return { label: 'Approval Required', color: 'text-purple-700 bg-purple-50 border-purple-200' };
      case 'Expired':
        return { label: 'Re-engage', color: 'text-slate-600 bg-slate-100 border-slate-200' };
      case 'Rejected':
        return { label: 'Archived', color: 'text-rose-700 bg-rose-50 border-rose-200' };
      default:
        return { label: 'Active', color: 'text-slate-600 bg-slate-50 border-slate-200' };
    }
  };

  // Helper: Clean status badge formatting
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Accepted':
      case 'Approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Approval Pending':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Sent':
      case 'Follow-up':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Draft':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Rejected':
      case 'Expired':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              QUOTATIONS
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
              {filteredQuotes.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create, manage and track customer quotations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 text-xs font-bold shadow-2xs transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <Link
            href="/dashboard/quotations/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ NEW QUOTATION</span>
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quotations by quote #, customer..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Follow-up">Follow-up</option>
            <option value="Approved">Approved</option>
            <option value="Accepted">Order Confirmed</option>
            <option value="Approval Pending">Approval Pending</option>
            <option value="Expired">Expired</option>
            <option value="Rejected">Cancelled</option>
          </select>

          {/* Salesperson Filter */}
          <select
            value={salespersonFilter}
            onChange={(e) => setSalespersonFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Salespeople</option>
            <option value="Borra Narsimulu">Borra Narsimulu</option>
            <option value="B Vineet Babu">B Vineet Babu</option>
            <option value="B V Dheeraj Reddy">B V Dheeraj Reddy</option>
            <option value="Reshma">Reshma</option>
            <option value="Hemalath">Hemalath</option>
            <option value="Manisha">Manisha</option>
          </select>
        </div>
      </div>

      {/* Quotations Container: Desktop Table & Mobile Cards */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-2xs overflow-hidden">
        {/* Desktop Table View - Fitted to available width without horizontal scrollbars */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3 w-[18%]">Quotation No. / Date</th>
                <th className="py-2.5 px-3 w-[26%]">Customer</th>
                <th className="py-2.5 px-3 w-[14%]">Salesperson</th>
                <th className="py-2.5 px-3 text-right w-[14%]">Amount</th>
                <th className="py-2.5 px-3 text-center w-[14%]">Status & Action</th>
                <th className="py-2.5 px-3 text-right w-[14%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <p className="text-sm font-bold text-slate-700">No quotations found</p>
                      <p className="text-xs text-slate-500">
                        {search
                          ? `No quotations match "${search}". Try clearing search or status filters.`
                          : 'No quotations created yet. Click "+ NEW QUOTATION" to create your first proposal.'}
                      </p>
                      {search && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setStatusFilter('ALL');
                            setSalespersonFilter('ALL');
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((q) => {
                  const action = getNextAction(q);
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/70 transition">
                      {/* Quotation No. & Date */}
                      <td className="py-3 px-3 align-top font-bold">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPrintQuote(q)}
                            className="font-mono font-black text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            title="Preview customer proposal"
                          >
                            {q.quotation_number}
                          </button>
                          {q.revision_number > 1 && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[9.5px] font-bold">
                              R{q.revision_number}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                          {q.quotation_date}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-3 align-top">
                        <strong className="text-slate-900 font-bold block truncate">
                          {q.company_name || q.customer_name}
                        </strong>
                        {q.company_name && q.customer_name && (
                          <span className="text-slate-500 text-[11px] block truncate">
                            Attn: {q.customer_name}
                          </span>
                        )}
                      </td>

                      {/* Salesperson */}
                      <td className="py-3 px-3 align-top font-medium text-slate-700 truncate">
                        {q.salesperson_name}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 align-top text-right font-black text-slate-900 text-sm font-mono">
                        ₹{Math.round(q.grand_total).toLocaleString('en-IN')}
                      </td>

                      {/* Status & Next Action */}
                      <td className="py-3 px-3 align-top text-center space-y-1">
                        <div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                              q.status
                            )}`}
                          >
                            {q.status}
                          </span>
                        </div>
                        <div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold border inline-block ${action.color}`}
                          >
                            {action.label}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View / Print */}
                          <button
                            type="button"
                            onClick={() => setSelectedPrintQuote(q)}
                            title="Preview customer proposal"
                            className="p-1 rounded-md text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 transition text-[11px] font-semibold cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-blue-600" />
                          </button>

                          {/* Edit Full Page */}
                          <Link
                            href={`/dashboard/quotations/${q.id}/edit`}
                            title="Edit quotation"
                            className="p-1 rounded-md text-slate-600 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 transition text-[11px] font-semibold"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                          </Link>

                          {/* Convert to Order */}
                          {q.status !== 'Accepted' && (
                            <button
                              type="button"
                              onClick={() => handleConvert(q.id)}
                              title="Convert to Sales Order"
                              className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold transition text-[10.5px] cursor-pointer"
                            >
                              <span>Order</span>
                            </button>
                          )}

                          {/* Revisions */}
                          {q.revision_number > 1 && (
                            <button
                              type="button"
                              onClick={() => handleOpenRevisions(q)}
                              title="View Revision History"
                              className="p-1 rounded-md text-amber-700 hover:bg-amber-50 transition"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Cards View */}
        <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {filteredQuotes.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <p className="text-sm font-bold text-slate-700">No quotations found</p>
              <p className="text-xs text-slate-500 mt-1">
                {search
                  ? `No quotations match "${search}". Try clearing search or status filters.`
                  : 'Click "+ NEW QUOTATION" to create your first proposal.'}
              </p>
            </div>
          ) : (
            filteredQuotes.map((q) => {
              const action = getNextAction(q);
              return (
                <div key={q.id} className="pt-3 first:pt-0 space-y-2.5">
                  {/* Card Top: Quote # & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPrintQuote(q)}
                        className="font-mono font-black text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        title="Preview customer proposal"
                      >
                        {q.quotation_number}
                      </button>
                      {q.revision_number > 1 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">
                          Rev {q.revision_number}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                        q.status
                      )}`}
                    >
                      {q.status}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {q.company_name || q.customer_name}
                    </h4>
                    {q.company_name && q.customer_name && (
                      <span className="text-slate-500 text-xs">
                        Attn: {q.customer_name}
                      </span>
                    )}
                  </div>

                  {/* Key Metadata: Date, Sales Rep, Amount */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                        Date &bull; Sales
                      </span>
                      <span className="text-slate-700 font-medium text-xs">
                        {q.quotation_date} &bull; {q.salesperson_name ? q.salesperson_name.split(' ')[0] : 'Sales'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                        Grand Total
                      </span>
                      <span className="font-mono font-black text-slate-950 text-sm">
                        ₹{Math.round(q.grand_total).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Next Action pill & Touch Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${action.color}`}
                    >
                      {action.label}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* View / Print button */}
                      <button
                        type="button"
                        onClick={() => setSelectedPrintQuote(q)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-700 hover:text-blue-700 bg-white border border-slate-200 transition text-xs font-semibold shadow-2xs cursor-pointer"
                        title="View / Print Proposal"
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-600" />
                        <span>View</span>
                      </button>

                      {/* Edit button */}
                      <Link
                        href={`/dashboard/quotations/${q.id}/edit`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-700 hover:text-amber-700 bg-white border border-slate-200 transition text-xs font-semibold shadow-2xs"
                        title="Edit Proposal"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                        <span>Edit</span>
                      </Link>

                      {/* Convert to Order if not accepted */}
                      {q.status !== 'Accepted' && (
                        <button
                          type="button"
                          onClick={() => handleConvert(q.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold transition text-xs shadow-2xs cursor-pointer"
                          title="Convert to Sales Order"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Order</span>
                        </button>
                      )}

                      {/* Revision history button if rev > 1 */}
                      {q.revision_number > 1 && (
                        <button
                          type="button"
                          onClick={() => handleOpenRevisions(q)}
                          className="p-1.5 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer"
                          title="View Revision History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Customer Preview & PDF Modal */}
      <PrintQuotationModal
        quotation={selectedPrintQuote}
        isOpen={!!selectedPrintQuote}
        onClose={() => setSelectedPrintQuote(null)}
      />

      {/* Revision History Modal */}
      {revisionModalQuote && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full border border-slate-200 text-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-600" />
                <h3 className="font-black text-slate-900">
                  Revision History &bull; {revisionModalQuote.quotation_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRevisionModalQuote(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-slate-500 text-[11px]">
                Each revision snapshot is permanently archived and immutable.
              </p>

              {loadingRevisions ? (
                <div className="p-4 text-center text-slate-400">Loading revisions...</div>
              ) : revisionsList.length === 0 ? (
                <div className="p-4 text-center text-slate-400">
                  No historical revisions found.
                </div>
              ) : (
                <div className="space-y-2">
                  {revisionsList.map((rev, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between"
                    >
                      <div>
                        <strong className="block font-bold text-slate-900">
                          Revision {rev.revision_number}
                        </strong>
                        <span className="text-[11px] text-slate-500">
                          Date: {rev.created_at ? new Date(rev.created_at).toLocaleDateString('en-IN') : 'N/A'} &bull; By: {rev.created_by || 'Staff'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-900 block">
                          ₹{Math.round(rev.grand_total || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 font-bold text-slate-700">
                          {rev.status || 'Archived'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
