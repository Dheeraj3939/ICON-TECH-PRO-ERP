'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Target,
  ArrowLeft,
  Building2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Briefcase,
  Layers,
  Database,
  Radio,
  FileText,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Eye,
  Check,
  X,
  Phone,
  Mail,
  Linkedin,
  MapPin,
  DollarSign,
  AlertCircle,
  Link as LinkIcon,
  PlusCircle,
  CheckSquare,
  ShieldAlert,
  ArrowRight,
  Send,
} from 'lucide-react';
import {
  getProspectDossier,
  executeResearchRun,
  compareResearchRuns,
  updateFindingVerification,
  convertProspectToCRM,
  prepareProspectEnquiryConversion,
  convertProspectToEnquiry,
  cancelProspectConversion,
} from '@/lib/actions/prospect-intelligence';
import type {
  ProspectDossier,
  ProspectResearchRun,
  ProspectDecisionMaker,
  ProspectProject,
  ProspectVendorIntelligence,
  ProspectTechnologySignal,
  ProspectOpportunitySignal,
  ProspectEvidenceSource,
  ProspectClassification,
  ProspectConfidence,
  ProspectEnquiryPreparation,
  ProspectConversionPayload,
} from '@/types/erp';

export default function ProspectDossierPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [dossier, setDossier] = useState<ProspectDossier | null>(null);
  const [selectedRunNumber, setSelectedRunNumber] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<
    'decision-makers' | 'projects' | 'vendors' | 'tech' | 'opportunities' | 'evidence'
  >('decision-makers');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExecutingRun, setIsExecutingRun] = useState<boolean>(false);

  // Compare Runs State
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [compareResult, setCompareResult] = useState<{
    newDecisionMakers: string[];
    vendorChanges: string[];
    newProjects: string[];
    summaryDiff: string;
  } | null>(null);

  // CRM Conversion Modal State
  const [isConvertModalOpen, setIsConvertModalOpen] = useState<boolean>(false);
  const [convertForm, setConvertForm] = useState({
    customerType: 'Corporate' as 'Corporate' | 'Commercial' | 'Government' | 'Residential',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    createEnquiry: true,
    enquiryDetails: '',
  });
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionSuccess, setConversionSuccess] = useState<{
    customerId: string;
    enquiryId?: string;
  } | null>(null);

  // Governed Phase C.1 Enquiry Bridge State
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState<boolean>(false);
  const [isLoadingPrep, setIsLoadingPrep] = useState<boolean>(false);
  const [prepData, setPrepData] = useState<ProspectEnquiryPreparation | null>(null);
  const [prepError, setPrepError] = useState<string | null>(null);

  // Form State
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    customer_type: 'Corporate' as 'Corporate' | 'Commercial' | 'Government' | 'Residential',
    contact_person: '',
    email: '',
    phone: '',
    city: 'Hyderabad',
    billing_address: '',
  });
  const [enquiryData, setEnquiryData] = useState({
    title: '',
    requirement_details: '',
    category: 'HVAC',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    assigned_salesperson: 'Sales Team',
    advisory_budget: '',
    site_visit_required: false,
    notes: '',
  });
  const [humanConfirmed, setHumanConfirmed] = useState<boolean>(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [isConvertingEnquiry, setIsConvertingEnquiry] = useState<boolean>(false);
  const [enquirySuccess, setEnquirySuccess] = useState<{
    customerId: string;
    enquiryId: string;
    enquiryNumber: string;
  } | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  // Load Dossier
  useEffect(() => {
    async function loadDossier() {
      setIsLoading(true);
      try {
        const data = await getProspectDossier(companyId);
        if (data) {
          setDossier(data);
          setSelectedRunNumber(data.current_run?.run_number || data.company.latest_run_number || 0);
          setConvertForm((prev) => ({
            ...prev,
            contactPerson: data.decision_makers[0]?.full_name || '',
            email: data.decision_makers[0]?.email || `info@${data.company.domain || 'company.com'}`,
            phone: data.decision_makers[0]?.phone || '',
            address: data.company.headquarters_location || 'Hyderabad, Telangana',
            enquiryDetails: `Opportunity from AI Prospect Dossier: ${data.relevance_analysis.recommended_entry_angle}`,
          }));
        }
      } catch (err) {
        console.error('Failed to load dossier', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDossier();
  }, [companyId]);

  // Handle Switch Run (Append-Only Snapshot View)
  const handleSelectRun = async (runNum: number) => {
    setSelectedRunNumber(runNum);
    setIsLoading(true);
    try {
      const data = await getProspectDossier(companyId, runNum);
      if (data) {
        setDossier(data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Execute Append-Only Research Run
  const handleExecuteNewRun = async () => {
    setIsExecutingRun(true);
    try {
      const res = await executeResearchRun(companyId);
      if (res.success && res.run) {
        const updatedDossier = await getProspectDossier(companyId, res.run.run_number);
        if (updatedDossier) {
          setDossier(updatedDossier);
          setSelectedRunNumber(res.run.run_number);
        }
      } else {
        alert(res.error || 'Failed to execute research run');
      }
    } catch (err: any) {
      alert(err?.message || 'Error running research');
    } finally {
      setIsExecutingRun(false);
    }
  };

  // Compare Runs
  const handleOpenCompare = async () => {
    if (!dossier || dossier.run_history.length < 2) {
      alert('Need at least 2 research runs to compare.');
      return;
    }
    const runs = [...dossier.run_history].sort((a, b) => a.run_number - b.run_number);
    const runA = runs[0].run_number;
    const runB = runs[runs.length - 1].run_number;
    const comp = await compareResearchRuns(companyId, runA, runB);
    setCompareResult(comp);
    setIsCompareModalOpen(true);
  };

  // Human Verification of a Decision Maker
  const handleToggleVerification = async (dm: ProspectDecisionMaker) => {
    const newStatus = !dm.human_verified;
    const notes = newStatus
      ? prompt('Enter verification notes (e.g. verified via conference directory or call):', 'Verified by sales lead')
      : undefined;

    const res = await updateFindingVerification({
      type: 'DECISION_MAKER',
      id: dm.id,
      human_verified: newStatus,
      verified_by: 'Sales Lead / Admin',
      verification_notes: notes || undefined,
      classification: newStatus ? 'VERIFIED' : dm.classification,
    });

    if (res.success) {
      setDossier((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          decision_makers: prev.decision_makers.map((d) =>
            d.id === dm.id
              ? {
                  ...d,
                  human_verified: newStatus,
                  verified_by: newStatus ? 'Sales Lead / Admin' : undefined,
                  verification_notes: notes || undefined,
                  classification: newStatus ? 'VERIFIED' : d.classification,
                }
              : d
          ),
        };
      });
    }
  };

  // Convert to CRM
  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConverting(true);
    try {
      const res = await convertProspectToCRM(companyId, {
        converted_by: 'Authorized Sales Director',
        customer_type: convertForm.customerType,
        contact_person: convertForm.contactPerson,
        email: convertForm.email,
        phone: convertForm.phone,
        billing_address: convertForm.address,
        create_enquiry: convertForm.createEnquiry,
        enquiry_details: convertForm.enquiryDetails,
      });

      if (res.success && res.customer_id) {
        setConversionSuccess({
          customerId: res.customer_id,
          enquiryId: res.enquiry_id,
        });
        if (dossier) {
          setDossier({
            ...dossier,
            company: {
              ...dossier.company,
              status: 'CONVERTED',
              crm_customer_id: res.customer_id,
            },
          });
        }
      } else {
        alert(res.error || 'Failed to convert prospect');
      }
    } catch (err: any) {
      alert(err?.message || 'Error converting prospect');
    } finally {
      setIsConverting(false);
    }
  };

  // Open Governed Phase C.1 Enquiry Bridge Modal
  const handleOpenEnquiryBridge = async () => {
    setIsEnquiryModalOpen(true);
    setIsLoadingPrep(true);
    setPrepError(null);
    setBridgeError(null);
    setEnquirySuccess(null);
    setHumanConfirmed(false);
    const newKey = `conv-${companyId}-${Date.now()}`;
    setIdempotencyKey(newKey);

    try {
      const res = await prepareProspectEnquiryConversion(companyId);
      if (!res.success || !res.data) {
        setPrepError(res.error || 'Failed to prepare enquiry conversion');
        return;
      }
      const data = res.data;
      setPrepData(data);

      // Determine initial customer mode
      if (dossier?.company.crm_customer_id) {
        setCustomerMode('existing');
        setSelectedCustomerId(dossier.company.crm_customer_id);
      } else if (data.duplicateCheck.hasMatchingCustomer && data.duplicateCheck.matchingCustomer) {
        setCustomerMode('existing');
        setSelectedCustomerId(data.duplicateCheck.matchingCustomer.id);
      } else {
        setCustomerMode('new');
      }

      setNewCustomerData({
        name: data.companyName,
        customer_type: 'Corporate',
        contact_person: data.primaryContact.fullName,
        email: data.primaryContact.email || (data.domain ? `info@${data.domain}` : ''),
        phone: data.primaryContact.phone || '',
        city: data.headquartersLocation?.split(',')[0]?.trim() || 'Hyderabad',
        billing_address: data.headquartersLocation || 'Hyderabad, Telangana',
      });

      setEnquiryData({
        title: `[Enterprise] ${data.companyName} — ${data.recommendedEntryAngle}`,
        requirement_details: data.proposedRequirementSummary,
        category: data.proposedProductCategory || 'HVAC',
        priority: 'MEDIUM',
        assigned_salesperson: data.proposedSalesperson || 'Sales Team',
        advisory_budget: data.proposedEstimatedBudget ? String(data.proposedEstimatedBudget) : '',
        site_visit_required: data.proposedSiteVisitRequired || false,
        notes: `Sourced from AI Prospect Dossier (Fit: ${dossier?.relevance_analysis.fit_score}%). Entry angle: ${data.recommendedEntryAngle}`,
      });
    } catch (err: any) {
      setPrepError(err?.message || 'Error loading preparation data');
    } finally {
      setIsLoadingPrep(false);
    }
  };

  // Submit Governed Enquiry Conversion
  const handleConfirmEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!humanConfirmed) {
      alert('Human confirmation is required before proceeding.');
      return;
    }
    setIsConvertingEnquiry(true);
    setBridgeError(null);

    const payload: ProspectConversionPayload = {
      prospectCompanyId: companyId,
      prospectDossierId: companyId,
      idempotencyKey,
      linkExistingCustomer: customerMode === 'existing',
      crmCustomerId: customerMode === 'existing' ? selectedCustomerId : undefined,
      customerData: customerMode === 'new' ? {
        customerType: 'COMPANY',
        customerName: newCustomerData.name,
        companyName: newCustomerData.name,
        phone: newCustomerData.phone || '9849012345',
        email: newCustomerData.email,
        billingAddress: newCustomerData.billing_address,
      } : undefined,
      enquiryData: {
        salespersonName: enquiryData.assigned_salesperson,
        productCategory: enquiryData.category,
        requirementSummary: enquiryData.requirement_details,
        estimatedBudget: enquiryData.advisory_budget ? parseFloat(enquiryData.advisory_budget) : 0,
        siteVisitRequired: enquiryData.site_visit_required,
        priority: enquiryData.priority,
        initialNotes: enquiryData.notes,
      },
      convertedBy: 'Authorized Sales Director',
    };

    try {
      const res = await convertProspectToEnquiry(payload);
      if (res.success && res.enquiry_id) {
        setEnquirySuccess({
          customerId: res.customer_id!,
          enquiryId: res.enquiry_id,
          enquiryNumber: res.enquiry_number || res.enquiry_id,
        });
        if (dossier) {
          setDossier({
            ...dossier,
            company: {
              ...dossier.company,
              status: 'CONVERTED',
              crm_customer_id: res.customer_id,
            },
          });
        }
      } else {
        setBridgeError(res.error || 'Conversion failed');
      }
    } catch (err: any) {
      setBridgeError(err?.message || 'Error converting prospect to enquiry');
    } finally {
      setIsConvertingEnquiry(false);
    }
  };

  // Cancel Conversion (Explicit Human Audit)
  const handleCancelConversion = async () => {
    const reason = prompt('Please enter the reason for cancelling this conversion:', 'Not qualified at this time');
    if (reason === null) return;
    try {
      await cancelProspectConversion(companyId, reason, 'Authorized Sales Director');
    } catch (err) {
      console.error('Error logging cancellation', err);
    }
    setIsEnquiryModalOpen(false);
  };

  if (isLoading && !dossier) {
    return (
      <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading comprehensive intelligence dossier...
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="p-12 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Prospect Not Found</h2>
        <Link
          href="/dashboard/ai/prospect-intelligence"
          className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 inline-block hover:underline"
        >
          ← Back to Prospect Intelligence Hub
        </Link>
      </div>
    );
  }

  const { company, current_run, run_history, decision_makers, projects, vendor_intelligence, technology_signals, opportunity_signals, evidence_sources, relevance_analysis } = dossier;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Back Button & Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link
          href="/dashboard/ai/prospect-intelligence"
          className="hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Prospect Intelligence Hub</span>
        </Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-semibold">{company.company_name}</span>
      </div>

      {/* Primary Dossier Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {company.company_name}
              </h1>
              {company.domain && (
                <a
                  href={`https://${company.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-md font-mono flex items-center gap-1 hover:underline"
                >
                  <span>{company.domain}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {/* Status Badge */}
              <span
                className={`text-xs px-3 py-1 rounded-full font-semibold ${
                  company.status === 'CONVERTED'
                    ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    : company.status === 'DOSSIER_READY'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {company.status === 'CONVERTED'
                  ? `Active CRM Customer (ID: ${company.crm_customer_id})`
                  : company.status === 'DOSSIER_READY'
                  ? `Dossier Ready • Run #${selectedRunNumber}`
                  : 'Discovered (Pending Deep Run)'}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" />
                {company.industry || 'Enterprise'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {company.headquarters_location || 'Hyderabad, Telangana'}
              </span>
              {company.estimated_revenue && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    {company.estimated_revenue}
                  </span>
                </>
              )}
              {company.employee_count_range && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {company.employee_count_range}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={handleExecuteNewRun}
              disabled={isExecutingRun}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isExecutingRun ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{isExecutingRun ? 'Synthesizing...' : `Execute Run #${(company.latest_run_number || 0) + 1} (Append-Only)`}</span>
            </button>

            {/* Governed Phase C.1 Action: Create Enquiry Bridge */}
            <button
              onClick={handleOpenEnquiryBridge}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Create Enquiry (Governed Bridge)</span>
            </button>

            {company.status === 'CONVERTED' ? (
              <Link
                href="/dashboard/customers"
                className="px-4 py-2 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>View in Customer 360</span>
              </Link>
            ) : (
              <button
                onClick={() => setIsConvertModalOpen(true)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 border border-slate-200 dark:border-slate-700"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Quick CRM Convert</span>
              </button>
            )}
          </div>
        </div>

        {/* Why is this prospect relevant? Rationale Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/80 via-white to-blue-50/80 dark:from-indigo-950/40 dark:via-slate-900 dark:to-blue-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Why is this prospect relevant to ICON TECH PRO?</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Solution Fit Score:</span>
              <div className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                {relevance_analysis.fit_score}% Match
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
            {relevance_analysis.why_relevant}
          </p>

          <div className="pt-2 border-t border-indigo-100/60 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
            <div className="text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white">Recommended Entry Angle: </span>
              {relevance_analysis.recommended_entry_angle}
            </div>

            <div className="flex items-center gap-3 shrink-0 text-slate-500">
              <span>{relevance_analysis.key_decision_makers_count} Decision Makers</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {relevance_analysis.verified_contacts_count} Verified Contacts
              </span>
            </div>
          </div>
        </div>

        {/* Append-Only Research Run Bar */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Research History:
            </span>
            {run_history.length === 0 ? (
              <span className="text-xs text-slate-400">No runs executed yet</span>
            ) : (
              run_history
                .sort((a, b) => a.run_number - b.run_number)
                .map((run) => (
                  <button
                    key={run.id}
                    onClick={() => handleSelectRun(run.run_number)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                      selectedRunNumber === run.run_number
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>Run #{run.run_number}</span>
                    <span className="text-[10px] opacity-75">
                      ({new Date(run.created_at).toLocaleDateString()})
                    </span>
                  </button>
                ))
            )}
          </div>

          {run_history.length >= 2 && (
            <button
              onClick={handleOpenCompare}
              className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Compare Runs Diff
            </button>
          )}
        </div>

        {/* Current Run Change Summary */}
        {current_run && current_run.change_summary && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              <strong className="text-slate-900 dark:text-white">Run #{current_run.run_number} Synthesis:</strong>{' '}
              {current_run.change_summary}
            </span>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('decision-makers')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'decision-makers'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Decision Makers ({decision_makers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'projects'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Projects & Expansion ({projects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'vendors'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Vendor & Competitor Intel ({vendor_intelligence.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tech')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'tech'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Technology Signals ({technology_signals.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('opportunities')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'opportunities'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Opportunity Angles ({opportunity_signals.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('evidence')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'evidence'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Evidence & Citations ({evidence_sources.length})</span>
        </button>
      </div>

      {/* Tab 1: Decision Makers */}
      {activeTab === 'decision-makers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              All contacts are categorized by department (Projects, Purchase, Maintenance, Security, Executive).
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Strictly No Inferences as Facts: Every contact displays Classification & Confidence.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {decision_makers.map((dm) => (
              <div
                key={dm.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white">{dm.full_name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{dm.title}</p>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {dm.department}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  {dm.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`mailto:${dm.email}`} className="hover:underline text-indigo-600 dark:text-indigo-400">
                        {dm.email}
                      </a>
                    </div>
                  )}
                  {dm.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dm.phone}</span>
                    </div>
                  )}
                  {dm.linkedin_url && (
                    <div className="flex items-center gap-2">
                      <Linkedin className="w-3.5 h-3.5 text-blue-500" />
                      <a
                        href={dm.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline text-blue-600 dark:text-blue-400 flex items-center gap-1"
                      >
                        <span>Profile Link</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Classification & Confidence Badges */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        dm.classification === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {dm.classification}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {dm.confidence} Conf.
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleVerification(dm)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                      dm.human_verified
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {dm.human_verified ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Human Verified</span>
                      </>
                    ) : (
                      <span>Verify Contact</span>
                    )}
                  </button>
                </div>

                {dm.verification_notes && (
                  <p className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded">
                    Notes: {dm.verification_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Projects & Expansion */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-base text-slate-900 dark:text-white">
                    {proj.project_name}
                  </h4>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {proj.estimated_value || 'Value TBD'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>Location: {proj.location || 'Hyderabad'}</span>
                  <span>•</span>
                  <span>Timeline: {proj.timeline || 'Upcoming'}</span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {proj.description}
                </p>

                {proj.technology_requirements && proj.technology_requirements.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Technology Scope:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {proj.technology_requirements.map((req, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px]"
                        >
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {proj.classification}
                  </span>
                  <span className="text-[10px] text-slate-400">Confidence: {proj.confidence}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Vendor & Competitor Intel */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vendor_intelligence.map((vi) => (
              <div
                key={vi.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs text-slate-400 font-mono uppercase">{vi.category}</span>
                    <h4 className="font-semibold text-base text-slate-900 dark:text-white mt-0.5">
                      {vi.incumbent_vendor || 'Undisclosed Vendor'}
                    </h4>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                    {vi.contract_status || 'Active'}
                  </span>
                </div>

                {vi.pain_points && (
                  <div className="p-3 bg-red-50/60 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-900/40 text-xs text-red-900 dark:text-red-200 space-y-1">
                    <span className="font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                      Reported Pain Points / Displacement Opportunity:
                    </span>
                    <p className="leading-relaxed">{vi.pain_points}</p>
                  </div>
                )}

                {vi.satisfaction_score && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Client Satisfaction: <strong className="text-slate-800 dark:text-slate-200">{vi.satisfaction_score}</strong>
                  </p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {vi.classification}
                  </span>
                  <span className="text-[10px] text-slate-400">Confidence: {vi.confidence}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Technology Signals */}
      {activeTab === 'tech' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {technology_signals.map((tech) => (
              <div
                key={tech.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white">{tech.category}</h4>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                    {tech.solution_fit_score}% Fit
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Technologies Detected:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {tech.technologies_identified.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {tech.notes && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {tech.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Opportunity Signals */}
      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          {opportunity_signals.map((opp) => (
            <div
              key={opp.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {opp.signal_type}
                  </span>
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">{opp.headline}</h4>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                    opp.urgency === 'HIGH' || opp.urgency === 'CRITICAL'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  Urgency: {opp.urgency}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{opp.detail}</p>

              {opp.recommended_entry_angle && (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-lg border border-indigo-100 dark:border-indigo-900/50 text-xs">
                  <strong className="text-indigo-900 dark:text-indigo-200">Recommended Sales Entry Angle: </strong>
                  <span className="text-indigo-800 dark:text-indigo-300">{opp.recommended_entry_angle}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 6: Evidence & Citations */}
      {activeTab === 'evidence' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Audit trail of public sources cited for this dossier. No blackbox scraping is utilized.
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {evidence_sources.map((ev) => (
              <div key={ev.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <h4 className="font-semibold text-xs text-slate-900 dark:text-white">{ev.source_name}</h4>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                    Reliability: {ev.reliability}
                  </span>
                </div>

                <a
                  href={ev.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-mono"
                >
                  <span>{ev.source_url}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <blockquote className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded border-l-2 border-indigo-500 text-xs text-slate-600 dark:text-slate-300 italic">
                  "{ev.snippet_content}"
                </blockquote>

                <p className="text-[10px] text-slate-400">
                  Retrieved: {new Date(ev.retrieval_date).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compare Runs Modal */}
      {isCompareModalOpen && compareResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                <span>Append-Only Research Runs Comparison</span>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              {compareResult.summaryDiff}
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="font-semibold text-slate-900 dark:text-white">Newly Discovered Decision Makers:</span>
                {compareResult.newDecisionMakers.length > 0 ? (
                  <ul className="list-disc list-inside text-indigo-600 dark:text-indigo-400">
                    {compareResult.newDecisionMakers.map((dm, idx) => (
                      <li key={idx}>{dm}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400">No new decision makers between these runs.</p>
                )}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="font-semibold text-slate-900 dark:text-white">Vendor & Expiration Updates:</span>
                {compareResult.vendorChanges.length > 0 ? (
                  <ul className="list-disc list-inside text-amber-600 dark:text-amber-400">
                    {compareResult.vendorChanges.map((vc, idx) => (
                      <li key={idx}>{vc}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400">No vendor changes detected.</p>
                )}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="font-semibold text-slate-900 dark:text-white">New Projects Tracked:</span>
                {compareResult.newProjects.length > 0 ? (
                  <ul className="list-disc list-inside text-emerald-600 dark:text-emerald-400">
                    {compareResult.newProjects.map((p, idx) => (
                      <li key={idx}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400">No new projects.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Human-Gated CRM Conversion Modal */}
      {isConvertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base">
                <Database className="w-5 h-5 text-indigo-600" />
                <span>Convert Prospect to CRM Customer</span>
              </div>
              <button
                onClick={() => setIsConvertModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {conversionSuccess ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Successfully Converted to CRM!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  New Customer ID: <strong>{conversionSuccess.customerId}</strong>
                  {conversionSuccess.enquiryId && (
                    <>
                      <br />
                      Initial Sales Enquiry: <strong>{conversionSuccess.enquiryId}</strong>
                    </>
                  )}
                  <br />
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">
                    Cross-referenced via prospect_dossier_id: {companyId}
                  </span>
                </p>
                <div className="pt-3">
                  <button
                    onClick={() => {
                      setIsConvertModalOpen(false);
                      setConversionSuccess(null);
                    }}
                    className="px-5 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConvertSubmit} className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-xs text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                  <strong>Human-Gated Governance:</strong> AI research never creates active CRM customers automatically.
                  Submitting this form creates a validated customer profile with a back-link to this dossier.
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Name</label>
                    <input
                      type="text"
                      disabled
                      value={company.company_name}
                      className="w-full mt-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Type</label>
                      <select
                        value={convertForm.customerType}
                        onChange={(e) =>
                          setConvertForm({
                            ...convertForm,
                            customerType: e.target.value as any,
                          })
                        }
                        className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                      >
                        <option value="Corporate">Corporate</option>
                        <option value="Commercial">Commercial</option>
                        <option value="Government">Government</option>
                        <option value="Residential">Residential</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Primary Contact Person</label>
                      <input
                        type="text"
                        value={convertForm.contactPerson}
                        onChange={(e) => setConvertForm({ ...convertForm, contactPerson: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Email</label>
                      <input
                        type="email"
                        value={convertForm.email}
                        onChange={(e) => setConvertForm({ ...convertForm, email: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Phone</label>
                      <input
                        type="text"
                        value={convertForm.phone}
                        onChange={(e) => setConvertForm({ ...convertForm, phone: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Billing Address</label>
                    <input
                      type="text"
                      value={convertForm.address}
                      onChange={(e) => setConvertForm({ ...convertForm, address: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={convertForm.createEnquiry}
                        onChange={(e) => setConvertForm({ ...convertForm, createEnquiry: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Create Initial Sales Lead / Enquiry for Sales Team
                      </span>
                    </label>

                    {convertForm.createEnquiry && (
                      <textarea
                        rows={2}
                        value={convertForm.enquiryDetails}
                        onChange={(e) => setConvertForm({ ...convertForm, enquiryDetails: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsConvertModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isConverting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {isConverting ? 'Creating Customer...' : 'Confirm & Convert to CRM'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Governed Phase C.1 Enquiry Bridge Modal */}
      {isEnquiryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full my-8 p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Prospect → ERP Enquiry / Opportunity Bridge
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Governed human conversion workflow with duplicate verification and audit trail
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEnquiryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1"
              >
                ✕
              </button>
            </div>

            {isLoadingPrep ? (
              <div className="p-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Analyzing duplicate accounts, existing enquiries, and pre-populating opportunity dossier...
                </p>
              </div>
            ) : prepError ? (
              <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold">
                  <AlertCircle className="w-5 h-5" />
                  <span>Preparation Error</span>
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-400">{prepError}</p>
                <button
                  onClick={handleOpenEnquiryBridge}
                  className="px-4 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg"
                >
                  Retry
                </button>
              </div>
            ) : enquirySuccess ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    ERP Enquiry Successfully Created!
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Enquiry Number: <strong className="text-indigo-600 font-mono">{enquirySuccess.enquiryNumber}</strong>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Customer ID: <span className="font-mono">{enquirySuccess.customerId}</span> • Dossier Ref: <span className="font-mono">{companyId}</span>
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-left max-w-md mx-auto space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Enquiry Status:</span>
                    <span className="font-semibold text-emerald-600">Active (Pipeline)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Traceability:</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">prospect_dossier_id linked</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Audit Trail:</span>
                    <span className="text-slate-700 dark:text-slate-300">PROSPECT_CONVERSION_COMPLETED</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-4">
                  <Link
                    href={`/dashboard/enquiries`}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2"
                  >
                    <span>Go to Enquiries List</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={() => {
                      setIsEnquiryModalOpen(false);
                      setEnquirySuccess(null);
                    }}
                    className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : prepData && (
              <form onSubmit={handleConfirmEnquirySubmit} className="space-y-6">
                {/* Error Banner if any */}
                {bridgeError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{bridgeError}</span>
                  </div>
                )}

                {/* Section A: Prospect Summary */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span>Section A: Prospect Intelligence Summary</span>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      Fit: {dossier?.relevance_analysis.fit_score}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Company</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{prepData.companyName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Industry</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{prepData.industry || 'Enterprise'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Location</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{prepData.headquartersLocation || 'Hyderabad'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Domain</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">{prepData.domain || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <strong className="text-slate-800 dark:text-slate-200">Recommended Entry Angle: </strong>
                    {prepData.recommendedEntryAngle}
                  </div>
                </div>

                {/* Section B: Duplicate Check & Customer Resolution */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>Section B: Duplicate Check & Customer Resolution</span>
                    </div>
                    {prepData.duplicateCheck.hasMatchingCustomer ? (
                      <span className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded font-semibold border border-amber-200 dark:border-amber-800">
                        Potential Match Found
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded font-semibold border border-emerald-200 dark:border-emerald-800">
                        Zero Duplicates Detected
                      </span>
                    )}
                  </div>

                  {/* Existing Enquiries Warning if any */}
                  {prepData.duplicateCheck.existingEnquiries.length > 0 && (
                    <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Existing Enquiries for this Dossier ({prepData.duplicateCheck.existingEnquiries.length}):</span>
                      </div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {prepData.duplicateCheck.existingEnquiries.map((enq) => (
                          <div key={enq.id} className="flex items-center justify-between bg-white dark:bg-slate-900 px-2.5 py-1 rounded border border-amber-100 dark:border-amber-900/40 text-[11px]">
                            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{enq.number}</span>
                            <span className="text-slate-600 dark:text-slate-400 truncate max-w-xs">{enq.requirement}</span>
                            <span className="text-slate-500">{enq.status}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Multiple legitimate project enquiries are supported for enterprise accounts. Please ensure this submission represents a new distinct project/scope.
                      </p>
                    </div>
                  )}

                  {/* Mode Selector */}
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      onClick={() => setCustomerMode('existing')}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                        customerMode === 'existing'
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="customerMode"
                        checked={customerMode === 'existing'}
                        onChange={() => setCustomerMode('existing')}
                        className="text-indigo-600"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <LinkIcon className="w-3.5 h-3.5" />
                          <span>Link Existing Customer</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Attach to matched CRM profile without creating a duplicate
                        </div>
                      </div>
                    </label>

                    <label
                      onClick={() => setCustomerMode('new')}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                        customerMode === 'new'
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="customerMode"
                        checked={customerMode === 'new'}
                        onChange={() => setCustomerMode('new')}
                        className="text-indigo-600"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Create New Customer</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Provision a new customer in CRM with back-reference
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* If Existing Mode */}
                  {customerMode === 'existing' && (
                    <div className="space-y-3 pt-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Select Matched or Existing Customer
                      </label>
                      {prepData.duplicateCheck.matchingCustomer ? (
                        <div className="space-y-2">
                          {(() => {
                            const c = prepData.duplicateCheck.matchingCustomer!;
                            return (
                              <label
                                key={c.id}
                                className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer text-xs ${
                                  selectedCustomerId === c.id
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 dark:border-indigo-400'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name="selectedCustomerId"
                                    value={c.id}
                                    checked={selectedCustomerId === c.id}
                                    onChange={() => setSelectedCustomerId(c.id)}
                                    className="text-indigo-600"
                                  />
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-white">
                                      {c.name} {c.code ? `(${c.code})` : ''}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      {c.phone || 'No phone'} • {c.domain || 'No domain'}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold rounded text-[11px]">
                                    Matched Account
                                  </span>
                                </div>
                              </label>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          <input
                            type="text"
                            placeholder="Enter Customer ID (e.g. cust-001)"
                            value={selectedCustomerId}
                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* If New Mode */}
                  {customerMode === 'new' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Name *</label>
                        <input
                          type="text"
                          required
                          value={newCustomerData.name}
                          onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Type</label>
                        <select
                          value={newCustomerData.customer_type}
                          onChange={(e) => setNewCustomerData({ ...newCustomerData, customer_type: e.target.value as any })}
                          className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                        >
                          <option value="Corporate">Corporate</option>
                          <option value="Commercial">Commercial</option>
                          <option value="Government">Government</option>
                          <option value="Residential">Residential</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-300">Contact Person</label>
                        <input
                          type="text"
                          value={newCustomerData.contact_person}
                          onChange={(e) => setNewCustomerData({ ...newCustomerData, contact_person: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-300">Email</label>
                        <input
                          type="email"
                          value={newCustomerData.email}
                          onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-300">Phone</label>
                        <input
                          type="text"
                          value={newCustomerData.phone}
                          onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-300">City</label>
                        <input
                          type="text"
                          value={newCustomerData.city}
                          onChange={(e) => setNewCustomerData({ ...newCustomerData, city: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="font-semibold text-slate-700 dark:text-slate-300">Billing Address</label>
                        <input
                          type="text"
                          value={newCustomerData.billing_address}
                          onChange={(e) => setNewCustomerData({ ...newCustomerData, billing_address: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Section C: Proposed Enquiry Information (AI-prepopulated, advisory) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Section C: Proposed Enquiry Information (Pre-Populated Advisory)</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Enquiry Title / Subject *</label>
                      <input
                        type="text"
                        required
                        value={enquiryData.title}
                        onChange={(e) => setEnquiryData({ ...enquiryData, title: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Requirement Scope & Analysis Details *</label>
                      <textarea
                        rows={3}
                        required
                        value={enquiryData.requirement_details}
                        onChange={(e) => setEnquiryData({ ...enquiryData, requirement_details: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 leading-relaxed"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400">
                        Lead Source: <strong>AI Prospect Intelligence</strong> (locked)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section D: Editable Commercial & Sales Fields */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <DollarSign className="w-4 h-4 text-indigo-600" />
                    <span>Section D: Editable Commercial & Sales Fields</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Assigned Salesperson</label>
                      <input
                        type="text"
                        value={enquiryData.assigned_salesperson}
                        onChange={(e) => setEnquiryData({ ...enquiryData, assigned_salesperson: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Category / Solution</label>
                      <select
                        value={enquiryData.category}
                        onChange={(e) => setEnquiryData({ ...enquiryData, category: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                      >
                        <option value="HVAC">HVAC Solutions</option>
                        <option value="Electrical">Electrical Infrastructure</option>
                        <option value="MEP">MEP Engineering</option>
                        <option value="Automation">Building Automation</option>
                        <option value="Fire & Safety">Fire & Life Safety</option>
                        <option value="Solar">Solar & Renewable</option>
                        <option value="Networking">Networking & IT</option>
                        <option value="Civil">Civil / Structural</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Priority</label>
                      <select
                        value={enquiryData.priority}
                        onChange={(e) => setEnquiryData({ ...enquiryData, priority: e.target.value as any })}
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        Customer / Advisory Budget (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="Optional advisory budget"
                        value={enquiryData.advisory_budget}
                        onChange={(e) => setEnquiryData({ ...enquiryData, advisory_budget: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">Strictly advisory; no removed commercial fields restored</span>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enquiryData.site_visit_required}
                          onChange={(e) => setEnquiryData({ ...enquiryData, site_visit_required: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Site Visit Required</span>
                      </label>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Internal Sales Notes</label>
                      <textarea
                        rows={2}
                        value={enquiryData.notes}
                        onChange={(e) => setEnquiryData({ ...enquiryData, notes: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Section E: Impact Preview */}
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Section E: Impact Preview</span>
                  </div>

                  <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Customer: </strong>
                        {customerMode === 'existing'
                          ? `Will link to existing customer #${selectedCustomerId || '(Please select)'}`
                          : `Will create a new validated customer record: "${newCustomerData.name}"`}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Enquiry: </strong>
                        A new ERP Enquiry will be created with <code className="font-mono text-indigo-600">prospect_dossier_id = {companyId}</code>
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Dossier Status: </strong>
                        Prospect company status will update to <span className="font-semibold text-indigo-600">CONVERTED</span>
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Audit Trail: </strong>
                        Events <code className="text-[11px]">PROSPECT_DUPLICATE_CHECK_PERFORMED</code> and <code className="text-[11px]">PROSPECT_CONVERSION_COMPLETED</code> logged
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Section F: Evidence & Research References */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Section F: Evidence & Research References</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">Identified Contacts:</span>
                      {dossier && dossier.decision_makers.length > 0 ? (
                        <ul className="list-disc list-inside text-[11px] space-y-0.5 mt-1">
                          {dossier.decision_makers.slice(0, 3).map((dm, idx) => (
                            <li key={idx}>
                              {dm.full_name} — {dm.title} {dm.human_verified && '✓'}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[11px]">No contacts recorded</span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">Tracked Projects & Signals:</span>
                      {dossier && dossier.projects.length > 0 ? (
                        <ul className="list-disc list-inside text-[11px] space-y-0.5 mt-1">
                          {dossier.projects.slice(0, 3).map((pj, idx) => (
                            <li key={idx}>
                              {pj.project_name} ({pj.timeline || 'Active'})
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[11px]">General expansion signals</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section G: Explicit Human Confirmation & Governance */}
                <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Section G: Explicit Human Confirmation & Governance</span>
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={humanConfirmed}
                      onChange={(e) => setHumanConfirmed(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 mt-0.5"
                    />
                    <span className="text-slate-800 dark:text-slate-200 font-medium">
                      I confirm that I have reviewed the duplicate check, customer linkage, and enquiry details. I authorize the creation of this ERP Enquiry. (AI autonomous conversion is prohibited).
                    </span>
                  </label>
                </div>

                {/* Modal Footer / Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleCancelConversion}
                    className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-lg transition-colors border border-rose-200 dark:border-rose-900"
                  >
                    Cancel Conversion (Audit Logged)
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEnquiryModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={!humanConfirmed || isConvertingEnquiry || (customerMode === 'existing' && !selectedCustomerId)}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isConvertingEnquiry ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating Enquiry...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Confirm & Create ERP Enquiry</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
