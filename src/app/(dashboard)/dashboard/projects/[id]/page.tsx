'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Briefcase,
  ArrowLeft,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  User,
  Paperclip,
  Upload,
  Layers,
  Percent,
  TrendingUp,
  FileText,
  AlertCircle,
  X,
  CreditCard,
  Truck,
  RotateCcw,
  CheckSquare,
  ShieldCheck,
} from 'lucide-react';
import {
  getProjectById,
  updateProjectStatus,
  updateMilestoneStatus,
  updateFileStatusDimensions,
  closeProjectFile,
  uploadCustomerPO,
  requestFileReopening,
  decideFileReopening,
} from '@/lib/actions/projects';
import { uploadAttachment, getAttachments } from '@/lib/actions/attachments';
import type {
  Project,
  ProjectStatus,
  MilestoneStatus,
  RecordAttachment,
  FileSalesStatus,
  FileFulfilmentStatus,
  FileFinancialStatus,
  FileClosureCategory,
  FileClosureReason,
} from '@/types/erp';

const ALL_PROJECT_STATUSES: ProjectStatus[] = [
  'Planning',
  'Site Survey',
  'Costing & Quote',
  'Client Approval',
  'Advance Received',
  'Procurement',
  'In Execution',
  'Commissioning',
  'Handover',
  'Completed',
  'On Hold',
  'Cancelled',
];

const SALES_STATUS_OPTIONS: FileSalesStatus[] = [
  'New Lead',
  'Enquiry',
  'Follow-up',
  'Site Visit',
  'Technical Evaluation',
  'Quotation Preparation',
  'Quotation Sent',
  'Negotiation',
  'Customer PO Received',
  'Order Confirmed',
  'Lost',
  'Cancelled',
  'On Hold',
];

const FULFILMENT_STATUS_OPTIONS: FileFulfilmentStatus[] = [
  'Not Started',
  'Awaiting Procurement',
  'Procurement in Progress',
  'Material Received',
  'Invoice Pending',
  'Invoice Created',
  'E-Way Bill Pending',
  'Ready for Dispatch',
  'Partially Dispatched',
  'Dispatched',
  'Installation Pending',
  'Installation in Progress',
  'Fulfilment Completed',
  'Cancelled',
];

const FINANCIAL_STATUS_OPTIONS: FileFinancialStatus[] = [
  'No Financial Activity',
  'Awaiting Customer Invoice',
  'Partially Invoiced',
  'Invoiced',
  'Partially Paid',
  'Payment Pending',
  'Overdue',
  'Advance Received',
  'Unallocated Receipt',
  'Refund Pending',
  'Credit Note Pending',
  'Disputed',
  'Reconciliation Pending',
  'Financially Settled',
  'Closed',
];

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [attachments, setAttachments] = useState<RecordAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Attachment upload state
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  // Close File Modal State
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closureCategory, setClosureCategory] = useState<FileClosureCategory>('Lost Enquiry');
  const [closureReason, setClosureReason] = useState<FileClosureReason>('Requirement Not Needed');
  const [closureExplanation, setClosureExplanation] = useState('');
  const [closureError, setClosureError] = useState<string | null>(null);
  const [closingFile, setClosingFile] = useState(false);

  // Customer PO Modal State
  const [showPOModal, setShowPOModal] = useState(false);
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [poValue, setPoValue] = useState<number>(0);
  const [poPaymentTerms, setPoPaymentTerms] = useState('30 Days');
  const [poPaymentTrigger, setPoPaymentTrigger] = useState<'INVOICE_DATE' | 'DELIVERY_DATE' | 'GRN' | 'ACCEPTANCE' | 'MILESTONE' | 'CUSTOM'>('DELIVERY_DATE');
  const [uploadingPO, setUploadingPO] = useState(false);

  // Reopen Modal State
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [requestingReopen, setRequestingReopen] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const proj = await getProjectById(id);
      setProject(proj);
      const atts = await getAttachments('project', id);
      setAttachments(atts);
      if (proj?.total_project_value) {
        setPoValue(proj.total_project_value);
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!project) return;
    setUpdating(true);
    try {
      const res = await updateProjectStatus(project.id, newStatus);
      if (res.success && res.data) {
        setProject(res.data);
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleDimensionChange = async (dimension: 'sales' | 'fulfilment' | 'financial', val: string) => {
    if (!project) return;
    setUpdating(true);
    try {
      const payload: any = {};
      if (dimension === 'sales') payload.sales_status = val;
      if (dimension === 'fulfilment') payload.fulfilment_status = val;
      if (dimension === 'financial') payload.financial_status = val;

      const res = await updateFileStatusDimensions(project.id, payload);
      if (res.success && res.data) {
        setProject(res.data);
      } else {
        alert(res.error || 'Failed to update status dimension');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleMilestoneChange = async (milestoneId: string, newStatus: MilestoneStatus) => {
    if (!project) return;
    setUpdating(true);
    try {
      const res = await updateMilestoneStatus(project.id, milestoneId, newStatus);
      if (res.success && res.data) {
        setProject(res.data);
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleCloseFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setClosingFile(true);
    setClosureError(null);
    try {
      const res = await closeProjectFile(project.id, {
        category: closureCategory,
        reason: closureReason,
        explanation: closureExplanation,
      });
      if (res.success && res.data) {
        setProject(res.data);
        setShowCloseModal(false);
        setClosureExplanation('');
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
    if (!project || !poNumber) return;
    setUploadingPO(true);
    try {
      const res = await uploadCustomerPO(project.id, {
        po_number: poNumber,
        po_date: poDate,
        po_value: Number(poValue) || 0,
        payment_terms: poPaymentTerms,
        payment_trigger: poPaymentTrigger,
      });
      if (res.success && res.data) {
        setProject(res.data);
        setShowPOModal(false);
      } else {
        alert(res.error || 'Failed to record Customer PO');
      }
    } finally {
      setUploadingPO(false);
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !reopenReason) return;
    setRequestingReopen(true);
    try {
      const res = await requestFileReopening(project.id, reopenReason);
      if (res.success && res.data) {
        setProject(res.data);
        setShowReopenModal(false);
        setReopenReason('');
      } else {
        alert(res.error || 'Failed to request reopening');
      }
    } finally {
      setRequestingReopen(false);
    }
  };

  const handleDecideReopening = async (approved: boolean) => {
    if (!project) return;
    setUpdating(true);
    try {
      const res = await decideFileReopening(project.id, {
        approve: approved,
        rejection_reason: approved ? undefined : 'Rejected by Admin / MD',
      });
      if (res.success && res.data) {
        setProject(res.data);
      } else {
        alert(res.error || 'Failed to process decision');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !fileName || !fileUrl) return;
    try {
      const res = await uploadAttachment({
        entity_type: 'project',
        entity_id: project.id,
        file_name: fileName,
        file_url: fileUrl,
      });
      if (res.success) {
        setFileName('');
        setFileUrl('');
        const atts = await getAttachments('project', project.id);
        setAttachments(atts);
      }
    } catch (err) {
      console.error('Failed to add attachment:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center text-slate-400 text-xs">
        Loading Open File cockpit...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-4">
        <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
        <p className="font-bold text-sm">Open File not found: {id}</p>
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-50 text-brand-700 font-bold text-xs border border-brand-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects & Open Files
        </Link>
      </div>
    );
  }

  const milestones = project.milestones || [];
  const completedMilestones = milestones.filter((m) => m.status === 'Completed' || m.status === 'Paid').length;
  const progressPct = milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0;
  const isClosed = project.status === 'Completed' || project.status === 'Cancelled';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/projects"
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-800 text-xs">
                {project.file_id || project.project_number}
              </span>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{project.project_name}</h1>
              {project.department_owner && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Dept: {project.department_owner}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span>{project.project_type}</span>
              &bull;
              <span>Customer: {project.customer_name}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {!isClosed ? (
            <button
              type="button"
              onClick={() => {
                setShowCloseModal(true);
                setClosureError(null);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition"
            >
              Close Open File
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowReopenModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs border border-amber-200 transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Request Reopening</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Status Dimensions Independent Control Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-600" />
            3 Independent Status Dimensions (Business Progress Control)
          </span>
          <span className="text-[11px] text-slate-400">Never compressed into a single status</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Dimension 1: Sales Status */}
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/60 space-y-1.5">
            <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-wider">
              1. Sales Dimension
            </label>
            <select
              value={project.sales_status || 'New Lead'}
              disabled={updating || isClosed}
              onChange={(e) => handleDimensionChange('sales', e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-blue-300 bg-white font-bold text-blue-900 outline-none"
            >
              {SALES_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Dimension 2: Fulfilment Status */}
          <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/60 space-y-1.5">
            <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider">
              2. Fulfilment Dimension
            </label>
            <select
              value={project.fulfilment_status || 'Not Started'}
              disabled={updating || isClosed}
              onChange={(e) => handleDimensionChange('fulfilment', e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white font-bold text-amber-900 outline-none"
            >
              {FULFILMENT_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Dimension 3: Financial Status */}
          <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200/60 space-y-1.5">
            <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-wider">
              3. Financial Dimension (Accounts Gated)
            </label>
            <select
              value={project.financial_status || 'No Financial Activity'}
              disabled={updating || isClosed}
              onChange={(e) => handleDimensionChange('financial', e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-purple-300 bg-white font-bold text-purple-900 outline-none"
            >
              {FINANCIAL_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reopening Pending Banner (Admin / MD Actionable) */}
      {project.reopen_request && project.reopen_request.status === 'PENDING' && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <p className="font-bold">File Reopening Requested by {project.reopen_request.requested_by_name}:</p>
            <p className="text-[11px] text-amber-800">{project.reopen_request.reason}</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              disabled={updating}
              onClick={() => handleDecideReopening(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition"
            >
              Approve Reopening
            </button>
            <button
              type="button"
              disabled={updating}
              onClick={() => handleDecideReopening(false)}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Customer PO & Commercial Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-600" />
            Customer Purchase Order (PO) Details
          </h3>
          {!project.customer_po && !isClosed && (
            <button
              type="button"
              onClick={() => setShowPOModal(true)}
              className="text-xs font-bold text-brand-600 hover:text-brand-700"
            >
              + Attach Customer PO
            </button>
          )}
        </div>

        {project.customer_po ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">PO Number</span>
              <span className="font-mono font-bold text-slate-900">{project.customer_po.po_number}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">PO Date</span>
              <span className="font-bold text-slate-700">{project.customer_po.po_date}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">PO Value</span>
              <span className="font-mono font-black text-slate-900">₹{(project.customer_po.po_value || 0).toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Payment Terms</span>
              <span className="font-bold text-slate-700">{project.customer_po.payment_terms}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Payment Trigger</span>
              <span className="font-bold text-brand-700">{project.customer_po.payment_trigger}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No Customer Purchase Order attached yet.</p>
        )}
      </div>

      {/* Financial & Engineering Snapshot Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Project Value
          </span>
          <p className="text-xl font-black text-slate-900">
            ₹{(project.total_project_value || 0).toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-slate-400">Total Contract</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-500" /> Estimated Cost
          </span>
          <p className="text-xl font-black text-slate-900">
            ₹{(project.total_cost || 0).toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-slate-400">Bill of Materials</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-indigo-500" /> Gross Margin
          </span>
          <p className="text-xl font-black text-emerald-600">{project.margin_pct}%</p>
          <span className="text-[11px] text-emerald-600 font-semibold">Protected Commercials</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-purple-500" /> Lead Engineer
          </span>
          <p className="text-base font-black text-slate-900 truncate">
            {project.lead_engineer_name || 'Unassigned'}
          </p>
          <span className="text-[11px] text-slate-400">On-site Lead</span>
        </div>
      </div>

      {/* Main Grid: Milestones & Attachments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Milestones Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-600" />
                  Turnkey Milestones & Payment Schedule
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Contractual milestones controlling billing, installation signoff, and final handover
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                {progressPct}% Complete
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="space-y-3 pt-2">
              {milestones.map((ms, idx) => (
                <div
                  key={ms.id || idx}
                  className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-800 text-xs font-black flex items-center justify-center">
                        {ms.milestone_number}
                      </span>
                      <h4 className="font-bold text-slate-900 text-xs">{ms.title}</h4>
                      <span className="text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                        {ms.percentage}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 pl-8">
                      Milestone Amount: <strong className="text-slate-900">₹{(ms.amount || 0).toLocaleString('en-IN')}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pl-8 sm:pl-0">
                    <select
                      value={ms.status}
                      disabled={updating}
                      onChange={(e) => handleMilestoneChange(ms.id, e.target.value as MilestoneStatus)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Invoiced">Invoiced</option>
                      <option value="Paid">Paid</option>
                    </select>

                    {ms.status === 'Completed' || ms.status === 'Paid' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Universal Attachments & Documents */}
        <div className="space-y-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-brand-600" />
              Project Attachments & Drawings
            </h2>
            <p className="text-xs text-slate-500">
              Schematics, site surveys, acoustic layouts, customer handover signoffs
            </p>

            {/* Upload form */}
            <form onSubmit={handleAddAttachment} className="space-y-2 text-xs pt-2">
              <input
                type="text"
                required
                placeholder="Document Title (e.g. AutoCAD Wiring Layout)"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                type="text"
                required
                placeholder="File URL or Cloud Path"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="submit"
                className="w-full py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold border border-brand-200 flex items-center justify-center gap-1.5 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                Add Attachment
              </button>
            </form>

            {/* List */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {attachments.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">No attachments uploaded yet.</p>
              ) : (
                attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="font-bold text-slate-800 truncate">{att.file_name}</span>
                    </div>
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-brand-600 font-bold hover:underline flex-shrink-0 ml-2"
                    >
                      View
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Close File Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Close Open File</h2>
                <p className="text-slate-500 text-[11px]">{project.file_id || project.project_number}: {project.project_name}</p>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
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
                  onClick={() => setShowCloseModal(false)}
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
      {showPOModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Record Customer Purchase Order (PO)</h2>
                <p className="text-slate-500 text-[11px]">{project.file_id || project.project_number}: {project.customer_name}</p>
              </div>
              <button onClick={() => setShowPOModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
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
                    <option value="15 Days">15 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="45 Days">45 Days</option>
                    <option value="60 Days">60 Days</option>
                    <option value="90 Days">90 Days</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Trigger</label>
                  <select
                    value={poPaymentTrigger}
                    onChange={(e) => setPoPaymentTrigger(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="DELIVERY_DATE">Delivery Date</option>
                    <option value="INVOICE_DATE">Invoice Date</option>
                    <option value="ACCEPTANCE">Acceptance / Signoff</option>
                    <option value="GRN">Goods Receipt Note (GRN)</option>
                    <option value="MILESTONE">Milestone Completion</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPOModal(false)}
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
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Request File Reopening</h2>
                <p className="text-slate-500 text-[11px]">{project.file_id || project.project_number}</p>
              </div>
              <button onClick={() => setShowReopenModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
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
                  onClick={() => setShowReopenModal(false)}
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
