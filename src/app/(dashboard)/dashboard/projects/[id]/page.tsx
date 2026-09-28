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
  FileSpreadsheet,
} from 'lucide-react';
import { getProjectById, updateProjectStatus, updateMilestoneStatus } from '@/lib/actions/projects';
import { uploadAttachment, getAttachments } from '@/lib/actions/attachments';
import type { Project, ProjectStatus, MilestoneStatus, RecordAttachment } from '@/types/erp';

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

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const proj = await getProjectById(id);
      setProject(proj);
      const atts = await getAttachments('project', id);
      setAttachments(atts);
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
        Loading project cockpit...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-4">
        <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
        <p className="font-bold text-sm">Project not found: {id}</p>
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-50 text-brand-700 font-bold text-xs border border-brand-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>
      </div>
    );
  }

  const milestones = project.milestones || [];
  const completedMilestones = milestones.filter((m) => m.status === 'Completed' || m.status === 'Paid').length;
  const progressPct = milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0;

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
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 text-xs">
                {project.project_number}
              </span>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{project.project_name}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span>{project.project_type}</span>
              &bull;
              <span>Customer: {project.customer_name}</span>
            </p>
          </div>
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">Status:</span>
          <select
            value={project.status}
            disabled={updating}
            onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {ALL_PROJECT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
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
    </div>
  );
}
