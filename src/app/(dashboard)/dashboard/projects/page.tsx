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
} from 'lucide-react';
import { getProjects, createProject } from '@/lib/actions/projects';
import type { Project, ProjectType, ProjectStatus } from '@/types/erp';

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
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Project Form state
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('Home Theater');
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('CUST-AUTO');
  const [leadEngineer, setLeadEngineer] = useState('');
  const [totalValue, setTotalValue] = useState<number>(0);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [targetDate, setTargetDate] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getProjects({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: search || undefined,
      });
      setProjects(res.projects);
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

  // Metrics
  const activeCount = projects.filter((p) => p.status !== 'Completed' && p.status !== 'Cancelled').length;
  const totalValSum = projects.reduce((sum, p) => sum + (p.total_project_value || 0), 0);
  const avgMargin =
    projects.length > 0
      ? (projects.reduce((sum, p) => sum + (p.margin_pct || 0), 0) / projects.length).toFixed(1)
      : '0';
  const handoverPending = projects.filter((p) => p.status === 'Commissioning' || p.status === 'Handover').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-brand-600" />
              Turnkey Projects Cockpit
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold flex items-center gap-1.5">
              <span>Turnkey Execution Engine</span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-brand-100/80 text-brand-800">
                v9.2
              </span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            End-to-end execution for Home Theaters, AV Integrations, CCTV & Conference Room turnkey setups
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Create New Project
        </button>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-500" /> Active Projects
          </span>
          <p className="text-2xl font-black text-slate-900">{activeCount}</p>
          <span className="text-[11px] text-slate-400">Under engineering & execution</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Total Project Pipeline
          </span>
          <p className="text-2xl font-black text-slate-900">
            ₹{totalValSum.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-emerald-600 font-semibold">Contracted Value</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-indigo-500" /> Average Margin
          </span>
          <p className="text-2xl font-black text-slate-900">{avgMargin}%</p>
          <span className="text-[11px] text-slate-400">Target baseline: ≥ 25%</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-amber-500" /> Handover Ready
          </span>
          <p className="text-2xl font-black text-slate-900">{handoverPending}</p>
          <span className="text-[11px] text-amber-600 font-semibold">Commissioning stage</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by project name or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {['ALL', 'Planning', 'In Execution', 'Commissioning', 'Completed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-brand-600 text-white shadow-sm'
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
        <div className="p-12 text-center text-slate-400 text-xs">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-bold text-sm">No turnkey projects found</p>
          <p className="text-xs text-slate-400">Create your first turnkey project to track milestones & margins</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => {
            const milestones = proj.milestones || [];
            const completedCount = milestones.filter((m) => m.status === 'Completed' || m.status === 'Paid').length;
            const progressPct = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

            return (
              <div
                key={proj.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 hover:border-brand-300 transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 text-xs">
                      {proj.project_number}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        proj.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : proj.status === 'In Execution'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : proj.status === 'Commissioning'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {proj.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug">{proj.project_name}</h3>
                    <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {proj.customer_name}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Type:</span>
                      <strong className="text-slate-800">{proj.project_type}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Project Value:</span>
                      <strong className="text-slate-900 font-black">
                        ₹{(proj.total_project_value || 0).toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Margin:</span>
                      <strong className="text-emerald-600 font-bold">{proj.margin_pct}%</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Lead Engineer:</span>
                      <span className="text-slate-700">{proj.lead_engineer_name || 'Unassigned'}</span>
                    </div>
                  </div>

                  {/* Milestone Progress */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span>Milestones Progress</span>
                      <span>{completedCount}/{milestones.length} Completed ({progressPct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {proj.target_completion_date ? `Due ${proj.target_completion_date}` : 'No target set'}
                  </span>
                  <Link
                    href={`/dashboard/projects/${proj.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs border border-brand-200 transition"
                  >
                    View Cockpit
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
                New Turnkey Project
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
                <label className="block font-bold text-slate-700 mb-1">Project Name *</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lead Engineer</label>
                  <input
                    type="text"
                    placeholder="e.g. Vamshi Krishna"
                    value={leadEngineer}
                    onChange={(e) => setLeadEngineer(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Completion Date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-700 block">Default Turnkey Milestones:</span>
                <p className="text-[11px] text-slate-500">
                  1. Advance (30%) &bull; 2. Material Delivery (40%) &bull; 3. Installation & Cabling (20%) &bull; 4. Handover (10%)
                </p>
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
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
