'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Percent,
  Calendar,
  Layers,
  UserCheck,
  AlertCircle,
  Building2,
  X,
  FileText,
  CreditCard,
  Truck,
  RotateCcw,
  CheckSquare,
  Lock,
} from 'lucide-react';
import {
  getProjects,
  createProject,
  closeProjectFile,
  uploadCustomerPO,
  requestFileReopening,
  getOpenFilesSummary,
} from '@/lib/actions/projects';
import type {
  Project,
  ProjectType,
  ProjectStatus,
  FileSalesStatus,
  FileFulfilmentStatus,
  FileFinancialStatus,
  FileClosureCategory,
  FileClosureReason,
  FileDepartmentOwner,
} from '@/types/erp';

const PROJECT_TYPES: ProjectType[] = [
  'Home Theater',
  'Conference Room',
  'CCTV',
  'Networking',
  'AV Solutions',
  'Projectors',
  'Interactive Displays',
  'Integrated Technology',
  'Other',
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Summary Metrics State
  const [summaryMetrics, setSummaryMetrics] = useState<{
    totalActiveFiles: number;
    readyForClosure: number;
    closedFiles: number;
    lostEnquiries: number;
    awaitingAccounts: number;
    awaitingProcurement: number;
  }>({
    totalActiveFiles: 0,
    readyForClosure: 0,
    closedFiles: 0,
    lostEnquiries: 0,
    awaitingAccounts: 0,
    awaitingProcurement: 0,
  });

  // New Project Form state
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('Home Theater');
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('CUST-AUTO');
  const [leadEngineer, setLeadEngineer] = useState('');
  const [departmentOwner, setDepartmentOwner] = useState<FileDepartmentOwner>('Sales');
  const [totalValue, setTotalValue] = useState<number>(0);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [targetDate, setTargetDate] = useState('');

  // Close File Modal State
  const [closureModalFile, setClosureModalFile] = useState<Project | null>(null);
  const [closureCategory, setClosureCategory] = useState<FileClosureCategory>('Lost Enquiry');
  const [closureReason, setClosureReason] = useState<FileClosureReason>('Requirement Not Needed');
  const [closureExplanation, setClosureExplanation] = useState('');
  const [closureError, setClosureError] = useState<string | null>(null);
  const [closingFile, setClosingFile] = useState(false);

  // Customer PO Modal State
  const [poModalFile, setPoModalFile] = useState<Project | null>(null);
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [poValue, setPoValue] = useState<number>(0);
  const [poPaymentTerms, setPoPaymentTerms] = useState('30 Days Credit');
  const [poPaymentTrigger, setPoPaymentTrigger] = useState('Delivery Date');
  const [uploadingPO, setUploadingPO] = useState(false);

  // Reopening Modal State
  const [reopenModalFile, setReopenModalFile] = useState<Project | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [requestingReopen, setRequestingReopen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, summaryRes] = await Promise.all([
        getProjects({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: search || undefined,
        }),
        getOpenFilesSummary(),
      ]);
      setProjects(res.projects);
      if (summaryRes) {
        setSummaryMetrics({
          totalActiveFiles: summaryRes.activeFiles,
          readyForClosure: summaryRes.readyForClosure,
          closedFiles: summaryRes.closedFiles,
          lostEnquiries: summaryRes.lostEnquiries,
          awaitingAccounts: summaryRes.awaitingAccounts,
          awaitingProcurement: summaryRes.awaitingProcurement,
        });
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName || !customerName) return;
    setSubmitting(true);
    try {
      const marginPct =
        totalValue > 0
          ? Number((((totalValue - totalCost) / totalValue) * 100).toFixed(1))
          : 0;

      const res = await createProject({
        project_name: projectName,
        project_type: projectType,
        customer_id: customerId,
        customer_name: customerName,
        lead_engineer_name: leadEngineer || 'Senior Systems Engineer',
        department_owner: departmentOwner,
        total_project_value: Number(totalValue) || 0,
        total_cost: Number(totalCost) || 0,
        margin_pct: marginPct,
        target_completion_date: targetDate || undefined,
        milestones: [
          { milestone_number: 1, title: 'Mobilization Advance', percentage: 30, amount: Number(totalValue) * 0.3, status: 'Pending' },
          { milestone_number: 2, title: 'Material Delivery to Site', percentage: 40, amount: Number(totalValue) * 0.4, status: 'Pending' },
          { milestone_number: 3, title: 'Installation & Cabling', percentage: 20, amount: Number(totalValue) * 0.2, status: 'Pending' },
          { milestone_number: 4, title: 'Testing, Commissioning & Handover', percentage: 10, amount: Number(totalValue) * 0.1, status: 'Pending' },
        ],
      });

      if (res.success) {
        setShowModal(false);
        setProjectName('');
        setCustomerName('');
        setTotalValue(0);
        setTotalCost(0);
        setTargetDate('');
        loadData();
      } else {
        alert(res.error || 'Failed to create project');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closureModalFile) return;
    setClosingFile(true);
    setClosureError(null);
    try {
      const res = await closeProjectFile(closureModalFile.id, {
        category: closureCategory,
        reason: closureReason,
        explanation: closureExplanation,
      });
      if (res.success) {
        setClosureModalFile(null);
        setClosureExplanation('');
        await loadData();
      } else {
        setClosureError(res.error || 'File closure rejected by business rules');
      }
    } catch (err: any) {
      setClosureError(err.message || 'File closure failed');
    } finally {
      setClosingFile(false);
    }
  };

  const handleUploadPOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poModalFile || !poNumber) return;
    setUploadingPO(true);
    try {
      const res = await uploadCustomerPO(poModalFile.id, {
        po_number: poNumber,
        po_date: poDate,
        po_value: Number(poValue) || 0,
        payment_terms: poPaymentTerms,
        payment_trigger: (poPaymentTrigger === 'Delivery Date' ? 'DELIVERY_DATE' : 'INVOICE_DATE') as any,
        delivery_terms: 'Direct Customer Delivery',
      });
      if (res.success) {
        setPoModalFile(null);
        setPoNumber('');
        setPoValue(0);
        await loadData();
      } else {
        alert(res.error || 'Failed to record Customer PO');
      }
    } finally {
      setUploadingPO(false);
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenModalFile || !reopenReason) return;
    setRequestingReopen(true);
    try {
      const res = await requestFileReopening(reopenModalFile.id, reopenReason);
      if (res.success) {
        setReopenModalFile(null);
        setReopenReason('');
        await loadData();
      } else {
        alert(res.error || 'Failed to request reopening');
      }
    } finally {
      setRequestingReopen(false);
    }
  };

  // Filter projects by department if selected
  const displayedProjects = projects.filter((p) => {
    if (departmentFilter !== 'ALL' && p.department_owner !== departmentFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-brand-600" />
              Open File Management & Projects Cockpit
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold flex items-center gap-1.5">
              <span>Turnkey Execution Engine & 3-Dimension Status Engine</span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-brand-100/80 text-brand-800">
                v9.2
              </span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Independent sales, fulfilment, and financial status tracking for IT hardware orders and turnkey projects
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Create New Project File
        </button>
      </div>

      {/* 6-Counter Open File Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Active Files</span>
          <p className="text-xl font-black text-slate-900">{summaryMetrics.totalActiveFiles || displayedProjects.length}</p>
          <span className="text-[10px] text-slate-400">Open orders in progress</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Ready for Closure</span>
          <p className="text-xl font-black text-amber-600">{summaryMetrics.readyForClosure}</p>
          <span className="text-[10px] text-amber-600 font-semibold">Fulfilled & Settled</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Closed Files</span>
          <p className="text-xl font-black text-emerald-600">{summaryMetrics.closedFiles}</p>
          <span className="text-[10px] text-slate-400">Completed & Archived</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Lost Enquiries</span>
          <p className="text-xl font-black text-rose-600">{summaryMetrics.lostEnquiries}</p>
          <span className="text-[10px] text-slate-400">No order confirmed</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Awaiting Accounts</span>
          <p className="text-xl font-black text-purple-600">{summaryMetrics.awaitingAccounts}</p>
          <span className="text-[10px] text-purple-600 font-semibold">Invoice / Payment due</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Procurement</span>
          <p className="text-xl font-black text-blue-600">{summaryMetrics.awaitingProcurement}</p>
          <span className="text-[10px] text-slate-400">Awaiting supplier goods</span>
        </div>
      </div>

      {/* Filter & Department Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by file ID, project name or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Department Owner Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 mr-1">Dept:</span>
            {['ALL', 'Sales', 'Accounts', 'Procurement', 'Dispatch', 'Technical'].map((dept) => (
              <button
                key={dept}
                onClick={() => setDepartmentFilter(dept)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  departmentFilter === dept
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 mr-1">Status:</span>
          {['ALL', 'Planning', 'In Execution', 'Commissioning', 'Completed', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Loading Open Files...</div>
      ) : displayedProjects.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-bold text-sm">No Open Files matching filter</p>
          <p className="text-xs text-slate-400">Create a new project file or reset search filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedProjects.map((proj) => {
            const milestones = proj.milestones || [];
            const completedCount = milestones.filter((m) => m.status === 'Completed' || m.status === 'Paid').length;
            const progressPct = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;
            const isClosed = proj.status === 'Completed' || proj.status === 'Cancelled';

            return (
              <div
                key={proj.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 hover:border-brand-300 transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-800 text-xs">
                      {proj.file_id || proj.project_number}
                    </span>
                    {proj.department_owner && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {proj.department_owner}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug">{proj.project_name}</h3>
                    <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {proj.customer_name}
                    </p>
                  </div>

                  {/* 3 Status Dimension Badges */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Sales:</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {proj.sales_status || proj.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Fulfilment:</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        {proj.fulfilment_status || 'Not Started'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Financial:</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        {proj.financial_status || 'No Financial Activity'}
                      </span>
                    </div>
                  </div>

                  {/* Customer PO Details if attached */}
                  {proj.customer_po ? (
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>PO #{proj.customer_po.po_number}</span>
                        <span>₹{(proj.customer_po.po_value || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[10px]">
                        <span>Terms: {proj.customer_po.payment_terms}</span>
                        <span>Trigger: {proj.customer_po.payment_trigger}</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPoModalFile(proj);
                        setPoValue(proj.total_project_value || 0);
                      }}
                      className="w-full text-center py-1.5 px-2 rounded-lg border border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50/50 text-[11px] font-bold text-brand-700 transition"
                    >
                      + Attach Customer PO
                    </button>
                  )}

                  {/* Closure / Reopen Details if present */}
                  {proj.closure_category && (
                    <div className="text-[11px] p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 space-y-0.5">
                      <span className="font-bold">Closed as: {proj.closure_category}</span>
                      {proj.closure_reason && <p className="text-[10px] text-rose-700">Reason: {proj.closure_reason}</p>}
                    </div>
                  )}

                  {proj.reopen_requested && (
                    <div className="text-[11px] p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                      <span className="font-bold">Reopen Requested by {proj.reopen_requested_by}</span>
                      <p className="text-[10px] text-amber-700 mt-0.5">{proj.reopen_reason}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1 text-slate-600">
                    <span>Contract Value:</span>
                    <strong className="text-slate-900 font-black">
                      ₹{(proj.total_project_value || 0).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {!isClosed ? (
                    <button
                      type="button"
                      onClick={() => {
                        setClosureModalFile(proj);
                        setClosureError(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition"
                    >
                      Close File
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReopenModalFile(proj);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs border border-amber-200 transition flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Request Reopening</span>
                    </button>
                  )}

                  <Link
                    href={`/dashboard/projects/${proj.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs border border-brand-200 transition ml-auto"
                  >
                    <span>Cockpit</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-brand-600" />
                New Open File / Project
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Project Name / Order Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T-Hub 15-Seat Executive Home Theater"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Project Type</label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value as ProjectType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {PROJECT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. T-Hub Foundation"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department Owner</label>
                  <select
                    value={departmentOwner}
                    onChange={(e) => setDepartmentOwner(e.target.value as FileDepartmentOwner)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Procurement">Procurement</option>
                    <option value="Dispatch">Dispatch</option>
                    <option value="Accounts">Accounts</option>
                    <option value="Technical">Technical</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lead Engineer / Owner</label>
                  <input
                    type="text"
                    placeholder="e.g. Vamshi Krishna"
                    value={leadEngineer}
                    onChange={(e) => setLeadEngineer(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contract Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 850000"
                    value={totalValue || ''}
                    onChange={(e) => setTotalValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estimated Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 620000"
                    value={totalCost || ''}
                    onChange={(e) => setTotalCost(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Open File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Project File Modal */}
      {closureModalFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Close Open File</h2>
                <p className="text-slate-500 text-[11px]">{closureModalFile.file_id || closureModalFile.project_number}: {closureModalFile.project_name}</p>
              </div>
              <button onClick={() => setClosureModalFile(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {closureError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-semibold text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{closureError}</span>
              </div>
            )}

            <form onSubmit={handleCloseFileSubmit} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Closure Category *</label>
                <select
                  value={closureCategory}
                  onChange={(e) => setClosureCategory(e.target.value as FileClosureCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="Lost Enquiry">Lost Enquiry (No order placed)</option>
                  <option value="Cancelled Before Order">Cancelled Before Order</option>
                  <option value="Cancelled Confirmed Order">Cancelled Confirmed Order</option>
                  <option value="Successfully Completed">Successfully Completed (Fulfilled & Settled)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {closureCategory === 'Lost Enquiry' &&
                    'Lost Enquiry files close immediately without waiting for Tally reconciliation, provided no confirmed order exists.'}
                  {closureCategory === 'Successfully Completed' &&
                    'Requires both Fulfilment Completed and Financial Settled status before closing.'}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Closure Reason *</label>
                <select
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value as FileClosureReason)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="Requirement Not Needed">Requirement Not Needed</option>
                  <option value="Budget Not Approved">Budget Not Approved</option>
                  <option value="Project Cancelled Before Order">Project Cancelled Before Order</option>
                  <option value="Competitor Selected">Competitor Selected</option>
                  <option value="No Response">No Response</option>
                  <option value="Requirement Postponed">Requirement Postponed</option>
                  <option value="Duplicate File">Duplicate File</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Detailed Explanation</label>
                <textarea
                  rows={3}
                  placeholder="Record business context and notes regarding closure..."
                  value={closureExplanation}
                  onChange={(e) => setClosureExplanation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClosureModalFile(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={closingFile}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-50"
                >
                  {closingFile ? 'Closing File...' : 'Confirm Closure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer PO Upload Modal */}
      {poModalFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Record Customer Purchase Order (PO)</h2>
                <p className="text-slate-500 text-[11px]">{poModalFile.file_id || poModalFile.project_number}: {poModalFile.customer_name}</p>
              </div>
              <button onClick={() => setPoModalFile(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadPOSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Customer PO Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PO/THUB/2026/041"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">PO Date *</label>
                  <input
                    type="date"
                    required
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">PO Total Value (₹) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={poValue || ''}
                  onChange={(e) => setPoValue(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Terms</label>
                  <select
                    value={poPaymentTerms}
                    onChange={(e) => setPoPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="100% Advance">100% Advance</option>
                    <option value="Against Delivery">Against Delivery</option>
                    <option value="15 Days Credit">15 Days Credit</option>
                    <option value="30 Days Credit">30 Days Credit</option>
                    <option value="45 Days Credit">45 Days Credit</option>
                    <option value="60 Days Credit">60 Days Credit</option>
                    <option value="90 Days Credit">90 Days Credit</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Trigger</label>
                  <select
                    value={poPaymentTrigger}
                    onChange={(e) => setPoPaymentTrigger(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Invoice Date">Invoice Date</option>
                    <option value="Delivery Date">Delivery Date</option>
                    <option value="Installation Sign-off">Installation Sign-off</option>
                    <option value="Advance Confirmation">Advance Confirmation</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPoModalFile(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingPO}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold disabled:opacity-50"
                >
                  {uploadingPO ? 'Saving...' : 'Attach Customer PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Reopening Modal */}
      {reopenModalFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Request File Reopening</h2>
                <p className="text-slate-500 text-[11px]">{reopenModalFile.file_id || reopenModalFile.project_number}</p>
              </div>
              <button onClick={() => setReopenModalFile(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReopenSubmit} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Reopening *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Customer resumed requirement, budget approved, PO received after initial cancellation..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
                <p className="font-bold">Administrative Rule:</p>
                <p className="mt-0.5">
                  Reopening requests are submitted to Admin / MD for approval. The original closure reason and audit history are permanently preserved.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReopenModalFile(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestingReopen}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-50"
                >
                  {requestingReopen ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
