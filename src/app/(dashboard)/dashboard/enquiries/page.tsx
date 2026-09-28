'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Phone,
  MessageSquare,
  Calendar,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Clock,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  HelpCircle,
  CheckCircle,
  Building2,
  DollarSign,
  Lightbulb,
  Edit3,
} from 'lucide-react';
import { getEnquiries, updateEnquiryStatus } from '@/lib/actions/enquiries';
import { getEnquirySalesBrief, generateEnquirySalesBrief } from '@/lib/actions/opportunities';
import { NewEnquiryModal } from '@/components/modals/NewEnquiryModal';
import { EditEnquiryModal } from '@/components/modals/EditEnquiryModal';
import { NewQuotationModal } from '@/components/modals/NewQuotationModal';
import { STAFF_MEMBERS } from '@/lib/constants/erp-data';
import type { Enquiry, EnquiryStatus, EnquirySalesBrief } from '@/types/erp';

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [salespersonFilter, setSalespersonFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedEnquiryForQuote, setSelectedEnquiryForQuote] = useState<Enquiry | null>(null);
  const [selectedEnquiryForEdit, setSelectedEnquiryForEdit] = useState<Enquiry | null>(null);

  // Phase C.2: AI Sales Brief & Opportunity Intelligence States
  const [selectedEnquiryForBrief, setSelectedEnquiryForBrief] = useState<Enquiry | null>(null);
  const [salesBrief, setSalesBrief] = useState<EnquirySalesBrief | null>(null);
  const [isLoadingBrief, setIsLoadingBrief] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [activeBriefTab, setActiveBriefTab] = useState<'HEALTH' | 'SCOPE' | 'DECISION' | 'RISKS' | 'ACTIONS'>('HEALTH');

  const loadData = async () => {
    const res = await getEnquiries({
      status: statusFilter,
      search,
      salesperson: salespersonFilter,
    });
    setEnquiries(res.enquiries);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, salespersonFilter, search]);

  const handleStatusChange = async (id: string, newStatus: EnquiryStatus) => {
    await updateEnquiryStatus(id, newStatus);
    loadData();
  };

  const handleOpenSalesBrief = async (enq: Enquiry, forceRefresh: boolean = false) => {
    setSelectedEnquiryForBrief(enq);
    setIsLoadingBrief(true);
    setBriefError(null);
    try {
      const res = await (forceRefresh
        ? generateEnquirySalesBrief(enq.id, true)
        : getEnquirySalesBrief(enq.id));
      if (res.success && res.data) {
        setSalesBrief(res.data);
      } else {
        setBriefError(res.error || 'Failed to load sales brief');
      }
    } catch (err: any) {
      setBriefError(err?.message || 'Error generating sales brief');
    } finally {
      setIsLoadingBrief(false);
    }
  };

  const statusCounts = {
    all: enquiries.length,
    quotationSent: enquiries.filter((e) => e.status === 'Quotation sent').length,
    followUp: enquiries.filter((e) => e.status === 'Follow up').length,
    orderDone: enquiries.filter((e) => e.status === 'Order done').length,
  };

  const totalPages = Math.ceil(enquiries.length / pageSize) || 1;
  const paginatedEnquiries = enquiries.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Presales Enquiries & Leads
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold">
              {enquiries.length} Active Leads
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Capture inbound requirements, schedule site measurements, and advance to commercial proposals
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer Lead</span>
        </button>
      </div>

      {/* Simple Visual Business Workflow Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            BUSINESS WORKFLOW PROGRESSION
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            Commercial pipeline from lead to final GST tax invoice
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-bold py-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
            <span>NEW ENQUIRY</span>
          </div>
          <span className="text-slate-300 font-bold hidden sm:inline">&rarr;</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 text-slate-700 border border-slate-200">
            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">2</span>
            <span>SITE VISIT</span>
          </div>
          <span className="text-slate-300 font-bold hidden sm:inline">&rarr;</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 text-slate-700 border border-slate-200">
            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">3</span>
            <span>QUOTATION</span>
          </div>
          <span className="text-slate-300 font-bold hidden sm:inline">&rarr;</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 text-slate-700 border border-slate-200">
            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">4</span>
            <span>FOLLOW-UP</span>
          </div>
          <span className="text-slate-300 font-bold hidden sm:inline">&rarr;</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 text-slate-700 border border-slate-200">
            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">5</span>
            <span>ORDER</span>
          </div>
          <span className="text-slate-300 font-bold hidden sm:inline">&rarr;</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 text-slate-700 border border-slate-200">
            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">6</span>
            <span>INVOICE</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Leads
          </span>
          <span className="text-xl font-black text-slate-900 mt-1 block">
            {statusCounts.all}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Quotations Sent
          </span>
          <span className="text-xl font-black text-blue-600 mt-1 block">
            {statusCounts.quotationSent}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Follow-up Required
          </span>
          <span className="text-xl font-black text-amber-600 mt-1 block">
            {statusCounts.followUp}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Closed Won (Orders)
          </span>
          <span className="text-xl font-black text-emerald-600 mt-1 block">
            {statusCounts.orderDone}
          </span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lead #, customer, requirement..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-700 flex-1 md:flex-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="Enquiry">Enquiry</option>
            <option value="Site Visit Scheduled">Site Visit Scheduled</option>
            <option value="Quotation sent">Quotation sent</option>
            <option value="Follow up">Follow up</option>
            <option value="Order done">Order done</option>
            <option value="On Hold">On Hold</option>
            <option value="Lost">Lost</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Closed">Closed</option>
          </select>

          <select
            value={salespersonFilter}
            onChange={(e) => setSalespersonFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-700 flex-1 md:flex-none"
          >
            <option value="ALL">All Sales Reps</option>
            {STAFF_MEMBERS.filter((s) => s.role === 'Sales Executive' || s.role === 'BDM').map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container with Desktop Table & Mobile Cards */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* Desktop Table View - Designed to fit available width without horizontal scrolling */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3 w-[15%]">Lead #</th>
                <th className="py-2.5 px-3 w-[25%]">Customer</th>
                <th className="py-2.5 px-3 w-[22%]">Category & Requirement</th>
                <th className="py-2.5 px-3 w-[12%]">Budget / Rep</th>
                <th className="py-2.5 px-3 w-[13%]">Status</th>
                <th className="py-2.5 px-3 text-right w-[13%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedEnquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No matching enquiries found.
                  </td>
                </tr>
              ) : (
                paginatedEnquiries.map((enq) => (
                  <tr key={enq.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 align-top font-bold text-slate-900">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-brand-700">{enq.enquiry_number}</span>
                        {enq.site_visit_required && (
                          <span title="Site measurement scheduled" className="p-0.5 rounded bg-brand-50 text-brand-600">
                            <MapPin className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                        Follow: {enq.follow_up_date || '—'}
                      </div>
                    </td>

                    <td className="py-3 px-3 align-top">
                      <strong className="font-bold text-slate-900 block truncate">
                        {enq.company_name || enq.customer_name}
                      </strong>
                      {enq.company_name && (
                        <span className="text-slate-500 text-[11px] block truncate">Attn: {enq.customer_name}</span>
                      )}
                      <span className="text-slate-400 text-[11px] block">{enq.phone}</span>
                    </td>

                    <td className="py-3 px-3 align-top">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-700 text-[10px] inline-block mb-1">
                        {enq.product_category}
                      </span>
                      <p className="text-slate-600 line-clamp-2 leading-tight text-[11px]">
                        {enq.requirement_summary}
                      </p>
                    </td>

                    <td className="py-3 px-3 align-top">
                      <div className="font-bold text-slate-800 font-mono">
                        ₹{Number(enq.estimated_budget).toLocaleString('en-IN')}
                      </div>
                      <div className="text-slate-500 text-[11px] truncate">
                        {enq.salesperson_name}
                      </div>
                    </td>

                    <td className="py-3 px-3 align-top">
                      <select
                        value={enq.status}
                        onChange={(e) => handleStatusChange(enq.id, e.target.value as EnquiryStatus)}
                        className={`w-full px-2 py-1 rounded-full text-[10px] font-bold border outline-none cursor-pointer ${
                          enq.status === 'Order done'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : enq.status === 'Quotation sent'
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : enq.status === 'Follow up'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : enq.status === 'Site Visit Scheduled'
                            ? 'bg-purple-50 text-purple-700 border-purple-300'
                            : enq.status === 'On Hold'
                            ? 'bg-orange-50 text-orange-700 border-orange-300'
                            : enq.status === 'Lost'
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : enq.status === 'Cancelled'
                            ? 'bg-slate-100 text-slate-600 border-slate-300'
                            : enq.status === 'Closed'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                            : 'bg-cyan-50 text-cyan-700 border-cyan-300'
                        }`}
                      >
                        <option value="Enquiry">Enquiry</option>
                        <option value="Site Visit Scheduled">Site Visit</option>
                        <option value="Quotation sent">Quote sent</option>
                        <option value="Follow up">Follow up</option>
                        <option value="Order done">Order done</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Lost">Lost</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="NA">NA</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </td>

                    <td className="py-3 px-3 align-top text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`tel:${enq.phone.replace(/\s+/g, '')}`}
                          title="Call Client"
                          className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`https://wa.me/${enq.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          title="WhatsApp Client"
                          className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleOpenSalesBrief(enq)}
                          title="AI Sales Brief"
                          className="p-1 rounded-md text-indigo-600 hover:bg-indigo-50 transition"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSelectedEnquiryForEdit(enq)}
                          title="Edit Enquiry"
                          className="p-1 rounded-md text-amber-600 hover:bg-amber-50 transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSelectedEnquiryForQuote(enq)}
                          title="Create Proposal Quotation"
                          className="px-2 py-1 rounded-md bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold transition text-[10.5px]"
                        >
                          <span>Quote</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Touch-Friendly Card View (Presales in the field) */}
        <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {paginatedEnquiries.length === 0 ? (
            <p className="text-center text-slate-400 py-6 text-xs">No matching enquiries found.</p>
          ) : (
            paginatedEnquiries.map((enq) => (
              <div key={enq.id} className="pt-3 first:pt-0 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-brand-700">
                    {enq.enquiry_number}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {enq.status}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {enq.company_name || enq.customer_name}
                  </h4>
                  {enq.company_name && enq.customer_name && (
                    <p className="text-xs text-slate-500">Attn: {enq.customer_name}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span><strong>Req:</strong> {enq.product_category}</span>
                    <span><strong>Budget:</strong> ₹{Number(enq.estimated_budget).toLocaleString('en-IN')}</span>
                    <span><strong>Rep:</strong> {enq.salesperson_name}</span>
                    {enq.follow_up_date && <span><strong>Follow-up:</strong> {enq.follow_up_date}</span>}
                  </div>
                  {enq.requirement_summary && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">{enq.requirement_summary}</p>
                  )}
                </div>

                {/* Mobile Quick Action Buttons (min 44px touch targets) */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <a
                    href={`tel:${enq.phone.replace(/\s+/g, '')}`}
                    className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>
                  <a
                    href={`https://wa.me/${enq.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setSelectedEnquiryForEdit(enq)}
                    className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEnquiryForQuote(enq)}
                    className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl bg-blue-600 text-white text-[10px] font-bold shadow-xs"
                  >
                    <ReceiptText className="w-3.5 h-3.5" />
                    <span>Quote</span>
                  </button>
                </div>
              </div>
            ))
          )}
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
              Showing {paginatedEnquiries.length} of {enquiries.length} leads
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

      {/* Modals */}
      <NewEnquiryModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={loadData}
      />
      <EditEnquiryModal
        isOpen={Boolean(selectedEnquiryForEdit)}
        enquiry={selectedEnquiryForEdit}
        onClose={() => setSelectedEnquiryForEdit(null)}
        onSuccess={loadData}
      />
      {selectedEnquiryForQuote && (
        <NewQuotationModal
          isOpen={true}
          onClose={() => setSelectedEnquiryForQuote(null)}
          onSuccess={loadData}
          initialCustomer={{
            id: selectedEnquiryForQuote.customer_id,
            name: selectedEnquiryForQuote.customer_name,
            company: selectedEnquiryForQuote.company_name,
            phone: selectedEnquiryForQuote.phone,
            email: selectedEnquiryForQuote.email,
            customer_type: selectedEnquiryForQuote.customer_type,
          }}
          enquiryContext={{
            enquiry_id: selectedEnquiryForQuote.id,
            enquiry_number: selectedEnquiryForQuote.enquiry_number,
            product_category: selectedEnquiryForQuote.product_category,
            requirement_summary: selectedEnquiryForQuote.requirement_summary,
            estimated_budget: selectedEnquiryForQuote.estimated_budget,
            site_visit: selectedEnquiryForQuote.site_visit,
          }}
        />
      )}


      {/* Phase C.2: AI Sales Brief & Opportunity Intelligence Modal */}
      {selectedEnquiryForBrief && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                    Presales Intelligence & Opportunity Health
                  </span>
                </div>
                <h2 className="text-xl font-black tracking-tight text-white">
                  AI Sales Brief — {selectedEnquiryForBrief.enquiry_number}
                </h2>
                <p className="text-xs text-indigo-200/80 font-medium">
                  {selectedEnquiryForBrief.company_name || selectedEnquiryForBrief.customer_name} &bull; {selectedEnquiryForBrief.product_category}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {salesBrief && (
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                    salesBrief.health_status === 'STRONG'
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                      : salesBrief.health_status === 'MODERATE'
                      ? 'bg-blue-500/20 border-blue-400/40 text-blue-300'
                      : salesBrief.health_status === 'AT_RISK'
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                      : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                  }`}>
                    <Target className="w-3.5 h-3.5" />
                    <span>{salesBrief.health_score}% {salesBrief.health_status}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenSalesBrief(selectedEnquiryForBrief, true)}
                  disabled={isLoadingBrief}
                  title="Re-synthesize Intelligence"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingBrief ? 'animate-spin' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedEnquiryForBrief(null);
                    setSalesBrief(null);
                    setBriefError(null);
                  }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 sm:px-6 shrink-0">
              <button
                type="button"
                onClick={() => setActiveBriefTab('HEALTH')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                  activeBriefTab === 'HEALTH'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Health & Signals</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveBriefTab('SCOPE')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                  activeBriefTab === 'SCOPE'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Scope & Customer</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveBriefTab('DECISION')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                  activeBriefTab === 'DECISION'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Stakeholder & Competition</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveBriefTab('RISKS')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                  activeBriefTab === 'RISKS'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Risks & Missing Info</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveBriefTab('ACTIONS')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                  activeBriefTab === 'ACTIONS'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Actions & Script</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-700 dark:text-slate-300">
              {isLoadingBrief && (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Synthesizing comprehensive presales intelligence...
                  </p>
                  <p className="text-xs text-slate-400">
                    Cross-referencing customer history, prospect research signals, and competitive displacement angles.
                  </p>
                </div>
              )}

              {briefError && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Failed to load sales brief</span>
                  </div>
                  <p>{briefError}</p>
                  <button
                    type="button"
                    onClick={() => handleOpenSalesBrief(selectedEnquiryForBrief, true)}
                    className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition"
                  >
                    Retry
                  </button>
                </div>
              )}

              {salesBrief && !isLoadingBrief && (
                <>
                  {/* TAB 1: HEALTH & SIGNALS */}
                  {activeBriefTab === 'HEALTH' && (
                    <div className="space-y-6">
                      {/* Health Gauge Card */}
                      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/50 dark:from-slate-800/50 dark:to-indigo-950/30 border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Opportunity Health Index
                          </span>
                          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                            {salesBrief.health_score} / 100
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              salesBrief.health_score >= 75
                                ? 'bg-emerald-500'
                                : salesBrief.health_score >= 55
                                ? 'bg-blue-500'
                                : salesBrief.health_score >= 35
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${salesBrief.health_score}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Overall health is <strong className="text-slate-900 dark:text-white font-bold">{salesBrief.health_status}</strong> based on budget commitment, requirement detail, follow-up timeline, and customer historical spend.
                        </p>
                      </div>

                      {/* Buying Signals */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Target className="w-4 h-4 text-emerald-500" />
                          <span>Detected Buying Signals ({salesBrief.buying_signals.length})</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {salesBrief.buying_signals.map((sig, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                  {sig.signal}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  sig.strength === 'HIGH'
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                    : sig.strength === 'MEDIUM'
                                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {sig.strength}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {sig.evidence}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Project Signals */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-indigo-500" />
                          <span>Project Signals & Timeline</span>
                        </h4>
                        <div className="space-y-2">
                          {salesBrief.project_signals.map((proj, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white block">{proj.project_type}</span>
                                <span className="text-slate-500 text-[11px]">{proj.site_readiness}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                  {proj.timeline}
                                </span>
                                {proj.estimated_scale && (
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {proj.estimated_scale}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: SCOPE & CUSTOMER */}
                  {activeBriefTab === 'SCOPE' && (
                    <div className="space-y-6">
                      {/* Scope & Requirement Analysis */}
                      <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            Scope & Requirement Analysis
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 text-xs font-bold">
                            Complexity: {salesBrief.requirement_analysis.scope_complexity}
                          </span>
                        </div>

                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {salesBrief.requirement_analysis.core_need}
                        </p>

                        <div>
                          <span className="text-xs font-bold text-slate-500 block mb-2">Key Specifications Identified:</span>
                          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                            {salesBrief.requirement_analysis.key_specifications.map((spec, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span>{spec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <span className="text-xs font-bold text-slate-500 block mb-2">Inferred Technology Stack:</span>
                          <div className="flex flex-wrap gap-2">
                            {salesBrief.requirement_analysis.inferred_technology_stack.map((item, idx) => (
                              <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Budget Assessment:</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {salesBrief.requirement_analysis.budget_realism}
                          </span>
                        </div>
                      </div>

                      {/* Customer Context */}
                      <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Customer Account Context
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block text-[11px]">Type</span>
                            <strong className="text-slate-900 dark:text-white font-bold">{salesBrief.customer_context.relationship_type}</strong>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block text-[11px]">Historical Revenue</span>
                            <strong className="text-slate-900 dark:text-white font-bold">₹{salesBrief.customer_context.historical_revenue.toLocaleString('en-IN')}</strong>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block text-[11px]">Deployments</span>
                            <strong className="text-slate-900 dark:text-white font-bold">{salesBrief.customer_context.active_installations_count} Orders</strong>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block text-[11px]">Credit Standing</span>
                            <strong className="text-slate-900 dark:text-white font-bold">{salesBrief.customer_context.credit_standing}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: STAKEHOLDER & COMPETITION */}
                  {activeBriefTab === 'DECISION' && (
                    <div className="space-y-6">
                      {/* Stakeholder Card */}
                      <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-indigo-500" />
                            <span>Primary Stakeholder & Decision Maker</span>
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                            Influence: {salesBrief.decision_maker_context.influence_level}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {salesBrief.decision_maker_context.primary_contact_name}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {salesBrief.decision_maker_context.role_or_designation} &bull; {salesBrief.decision_maker_context.department}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Recommended Engagement Approach:</span>
                          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                            {salesBrief.decision_maker_context.recommended_engagement}
                          </p>
                        </div>
                      </div>

                      {/* Competition & Incumbent Vendor */}
                      <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            Vendor & Competition Intelligence
                          </h4>
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                            Pricing Pressure: {salesBrief.vendor_intelligence.pricing_pressure}
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Incumbent Vendor:</span>
                            <strong className="text-slate-900 dark:text-white font-bold">{salesBrief.vendor_intelligence.incumbent_vendor}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Displacement Angle:</span>
                            <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                              {salesBrief.vendor_intelligence.displacement_angle}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: RISKS & MISSING INFO */}
                  {activeBriefTab === 'RISKS' && (
                    <div className="space-y-6">
                      {/* Identified Risks */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span>Opportunity Risks ({salesBrief.opportunity_risks.length})</span>
                        </h4>
                        <div className="space-y-2.5">
                          {salesBrief.opportunity_risks.map((risk, idx) => (
                            <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 space-y-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">{risk.risk}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  risk.severity === 'HIGH'
                                    ? 'bg-rose-100 text-rose-700'
                                    : risk.severity === 'MEDIUM'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {risk.severity} Severity
                                </span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-400">
                                <strong className="text-slate-700 dark:text-slate-300">Mitigation: </strong>
                                {risk.mitigation}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Missing Information Checklist */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <HelpCircle className="w-4 h-4 text-indigo-500" />
                          <span>Missing Presales Information Checklist</span>
                        </h4>
                        <div className="space-y-2.5">
                          {salesBrief.missing_information.map((item, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">{item.item}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.impact === 'BLOCKING'
                                    ? 'bg-rose-100 text-rose-700'
                                    : item.impact === 'IMPORTANT'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {item.impact}
                                </span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-400 italic">
                                &ldquo;{item.suggested_question}&rdquo;
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: ACTIONS & SCRIPT */}
                  {activeBriefTab === 'ACTIONS' && (
                    <div className="space-y-6">
                      {/* Action Checklist */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <span>Recommended Presales Actions</span>
                        </h4>
                        <div className="space-y-2.5">
                          {salesBrief.recommended_next_actions.map((act, idx) => (
                            <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    act.priority === 'IMMEDIATE'
                                      ? 'bg-rose-100 text-rose-700'
                                      : act.priority === 'HIGH'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {act.priority}
                                  </span>
                                  <strong className="text-slate-900 dark:text-white font-bold">{act.action}</strong>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                                  Target: {act.target_outcome}
                                </p>
                              </div>
                              <span className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-300">
                                Due in {act.due_in_days} day{act.due_in_days > 1 ? 's' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Follow-up Intelligence & Script */}
                      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50/50 dark:from-indigo-950/40 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                            <span>Follow-up Intelligence & Recommended Script</span>
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] border border-indigo-200">
                            Channel: {salesBrief.follow_up_intelligence.recommended_channel} &bull; Date: {salesBrief.follow_up_intelligence.recommended_follow_up_date}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Suggested Opening Script:</span>
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-indigo-100 dark:border-indigo-800/60 italic leading-relaxed">
                            &ldquo;{salesBrief.follow_up_intelligence.suggested_opening_script}&rdquo;
                          </div>
                        </div>

                        <div className="space-y-1 text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Key Value Hook:</span>
                          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                            {salesBrief.follow_up_intelligence.key_value_hook}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs">
              <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Advisory Presales Intelligence &bull; Commercial quotations remain governed by sales rep</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedEnquiryForBrief(null);
                  setSalesBrief(null);
                  setBriefError(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition"
              >
                Close Brief
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
