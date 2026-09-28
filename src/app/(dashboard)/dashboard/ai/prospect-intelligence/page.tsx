'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Target,
  Building2,
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Briefcase,
  Layers,
  Database,
  Users,
} from 'lucide-react';
import {
  getProspectCampaigns,
  getProspectCompanies,
  createProspectCompany,
  checkProspectDuplicate,
  executeResearchRun,
} from '@/lib/actions/prospect-intelligence';
import type { ProspectCampaign, ProspectCompany, ProspectStatus } from '@/types/erp';

export default function ProspectIntelligenceHubPage() {
  const [campaigns, setCampaigns] = useState<ProspectCampaign[]>([]);
  const [companies, setCompanies] = useState<ProspectCompany[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [formName, setFormName] = useState<string>('');
  const [formDomain, setFormDomain] = useState<string>('');
  const [formIndustry, setFormIndustry] = useState<string>('Information Technology');
  const [formLocation, setFormLocation] = useState<string>('Hyderabad, Telangana');
  const [formRevenue, setFormRevenue] = useState<string>('₹1,000+ Cr');
  const [formEmployees, setFormEmployees] = useState<string>('1,000 — 5,000');
  const [formRelevance, setFormRelevance] = useState<string>('');
  const [formCampaignId, setFormCampaignId] = useState<string>('');
  const [dupCheckResult, setDupCheckResult] = useState<{
    isDuplicate: boolean;
    matchType?: 'PROSPECT' | 'CUSTOMER';
    warningMessage?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [runningResearchId, setRunningResearchId] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [camps, comps] = await Promise.all([
          getProspectCampaigns(),
          getProspectCompanies(),
        ]);
        setCampaigns(camps);
        setCompanies(comps);
        if (camps.length > 0) {
          setFormCampaignId(camps[0].id);
        }
      } catch (err) {
        console.error('Failed to load prospect data', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Duplicate check on typing
  useEffect(() => {
    if (!formName.trim()) {
      setDupCheckResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await checkProspectDuplicate(formName, formDomain);
      if (res.isDuplicate) {
        setDupCheckResult(res);
      } else {
        setDupCheckResult(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formName, formDomain]);

  // Filter companies
  const filteredCompanies = companies.filter((c) => {
    if (selectedCampaignId !== 'ALL' && c.campaign_id !== selectedCampaignId) return false;
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.company_name.toLowerCase().includes(q);
      const matchInd = c.industry?.toLowerCase().includes(q);
      const matchLoc = c.headquarters_location?.toLowerCase().includes(q);
      if (!matchName && !matchInd && !matchLoc) return false;
    }
    return true;
  });

  // Calculate metrics
  const totalMonitored = companies.length;
  const dossiersReady = companies.filter((c) => c.status === 'DOSSIER_READY' || c.status === 'CONVERTED').length;
  const convertedCount = companies.filter((c) => c.status === 'CONVERTED').length;
  const highFitCount = companies.filter((c) => (c.latest_run_number || 0) > 0).length;

  const handleCreateProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await createProspectCompany({
        company_name: formName.trim(),
        domain: formDomain.trim() || undefined,
        industry: formIndustry,
        headquarters_location: formLocation,
        estimated_revenue: formRevenue,
        employee_count_range: formEmployees,
        relevance_summary: formRelevance.trim() || undefined,
        campaign_id: formCampaignId || undefined,
        allow_duplicate_override: true,
      });

      if (res.success && res.company) {
        setCompanies((prev) => [res.company!, ...prev]);
        setIsAddModalOpen(false);
        // Reset form
        setFormName('');
        setFormDomain('');
        setFormRelevance('');
        setDupCheckResult(null);
      } else {
        alert(res.error || 'Failed to create prospect');
      }
    } catch (err: any) {
      alert(err?.message || 'Error creating prospect');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickResearch = async (companyId: string) => {
    setRunningResearchId(companyId);
    try {
      const res = await executeResearchRun(companyId);
      if (res.success && res.run) {
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === companyId
              ? { ...c, latest_run_number: res.run!.run_number, status: 'DOSSIER_READY' }
              : c
          )
        );
      } else {
        alert(res.error || 'Research run failed');
      }
    } catch (err: any) {
      alert(err?.message || 'Error running research');
    } finally {
      setRunningResearchId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <Target className="w-4 h-4" />
            <span>AI Ecosystem • Version 8 Phase B</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            AI Prospect Intelligence & Market Discovery
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Autonomous enterprise discovery, decision-maker mapping, incumbent vendor displacement, and human-gated CRM conversion.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Prospect Account
          </button>
        </div>
      </div>

      {/* KPI Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Monitored Accounts</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalMonitored}</p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Hyderabad & AP Enterprises
            </p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Dossiers Ready for Outreach</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{dossiersReady}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> With Evidence & Citations
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Researched Runs Synthesized</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{highFitCount}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Append-Only History Active
            </p>
          </div>
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Converted to CRM Customers</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{convertedCount}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
              <Database className="w-3 h-3" /> Human-Gated Sign-off
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Campaigns & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Campaign Tabs */}
        <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setSelectedCampaignId('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              selectedCampaignId === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All Campaigns ({companies.length})
          </button>
          {campaigns.map((camp) => {
            const count = companies.filter((c) => c.campaign_id === camp.id).length;
            return (
              <button
                key={camp.id}
                onClick={() => setSelectedCampaignId(camp.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCampaignId === camp.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {camp.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search companies by name, industry, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="DOSSIER_READY">Dossier Ready</option>
              <option value="DISCOVERED">Discovered</option>
              <option value="CONVERTED">Converted to CRM</option>
            </select>
          </div>
        </div>
      </div>

      {/* Prospect Companies List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-sm text-slate-900 dark:text-white">
              Identified Enterprise Targets ({filteredCompanies.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Strict Zero-Scraping Compliance: Only Permitted Public Signals & Verified Sources
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading prospect intelligence registry...
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="p-12 text-center">
            <Target className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No matching prospect accounts found</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Adjust your search criteria or add a new target enterprise.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredCompanies.map((company) => {
              const hasRuns = (company.latest_run_number || 0) > 0;
              const isRunning = runningResearchId === company.id;

              return (
                <div
                  key={company.id}
                  className="p-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {company.company_name}
                      </h3>
                      {company.domain && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                          {company.domain}
                        </span>
                      )}
                      {/* Status Badge */}
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          company.status === 'CONVERTED'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : company.status === 'DOSSIER_READY'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {company.status === 'CONVERTED'
                          ? 'Converted to CRM'
                          : company.status === 'DOSSIER_READY'
                          ? `Dossier Ready (Run #${company.latest_run_number})`
                          : 'Discovered (Unresearched)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span>{company.industry || 'Enterprise'}</span>
                      <span>•</span>
                      <span>{company.headquarters_location || 'Hyderabad, Telangana'}</span>
                      {company.estimated_revenue && (
                        <>
                          <span>•</span>
                          <span>Rev: {company.estimated_revenue}</span>
                        </>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">Why Relevant: </span>
                      {company.relevance_summary || 'Identified prospective enterprise for AV, CCTV and access control.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => handleQuickResearch(company.id)}
                      disabled={isRunning}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin text-indigo-600' : ''}`} />
                      {isRunning ? 'Synthesizing...' : hasRuns ? `Re-run Research (Run #${(company.latest_run_number || 0) + 1})` : 'Execute Run #1'}
                    </button>

                    <Link
                      href={`/dashboard/ai/prospect-intelligence/${company.id}`}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <span>View Dossier</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Prospect Modal with Duplicate Check Warning */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base">
                <Target className="w-5 h-5 text-indigo-600" />
                <span>Add Prospective Enterprise Account</span>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Duplicate Alert if detected */}
            {dupCheckResult && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    {dupCheckResult.matchType === 'CUSTOMER'
                      ? 'Already an Active CRM Customer'
                      : 'Duplicate Prospect Detected'}
                  </p>
                  <p className="text-amber-700 dark:text-amber-300">{dupCheckResult.warningMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateProspect} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Company / Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cyient Technologies Hyderabad"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Corporate Domain
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. cyient.com"
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Industry Vertical
                  </label>
                  <select
                    value={formIndustry}
                    onChange={(e) => setFormIndustry(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Information Technology">Information Technology</option>
                    <option value="Pharmaceuticals & Life Sciences">Pharmaceuticals & Life Sciences</option>
                    <option value="Infrastructure & Real Estate">Infrastructure & Real Estate</option>
                    <option value="Hospitality & Healthcare">Hospitality & Healthcare</option>
                    <option value="Manufacturing & Industrial">Manufacturing & Industrial</option>
                    <option value="Educational Institutions">Educational Institutions</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Headquarters / Target Campus
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Target Campaign
                  </label>
                  <select
                    value={formCampaignId}
                    onChange={(e) => setFormCampaignId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {campaigns.map((camp) => (
                      <option key={camp.id} value={camp.id}>
                        {camp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Why is this prospect relevant? (Initial Signal)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Planning a 100,000 sq ft office fitout in HITEC City; active RFP anticipated for boardroom AV and CCTV."
                    value={formRelevance}
                    onChange={(e) => setFormRelevance(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formName.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving Target...' : 'Save & Prepare Dossier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
