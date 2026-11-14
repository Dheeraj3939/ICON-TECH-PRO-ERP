'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Wrench,
  Layers,
  Plus,
  Trash2,
  Clock,
  ArrowRight,
  Lock,
  Building2,
  User,
  Calendar,
  Sparkles,
  Save,
  Send,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  SITE_VISIT_PROJECT_CATEGORIES,
  TECHNICAL_EVALUATION_STATUSES,
  type SiteVisitProjectCategory,
  type TechnicalEvaluation,
  type TechnicalEvaluationStatus,
  type TechnicalRecommendedItem,
  type CreateTechnicalEvaluationPayload,
} from '@/types/technical-evaluation';
import {
  createTechnicalEvaluation,
  updateTechnicalEvaluation,
  submitTechnicalEvaluation,
  reviewTechnicalEvaluation,
  closeTechnicalEvaluation,
} from '@/lib/actions/technical-evaluations';

interface TechnicalEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  evaluation?: TechnicalEvaluation | null;
  onSuccess?: () => void;
  // Pre-fill parameters when creating from a Site Visit or Enquiry
  initialContext?: {
    customer_id?: string;
    customer_name?: string;
    company_name?: string;
    enquiry_id?: string;
    enquiry_number?: string;
    site_visit_id?: string;
    site_visit_number?: string;
    project_category?: string;
    site_address?: string;
    measurements?: string;
    notes?: string;
    assigned_technician?: string;
  };
}

export function TechnicalEvaluationModal({
  isOpen,
  onClose,
  evaluation,
  onSuccess,
  initialContext,
}: TechnicalEvaluationModalProps) {
  const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'>('A');

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [enquiryNumber, setEnquiryNumber] = useState('');
  const [enquiryId, setEnquiryId] = useState('');
  const [siteVisitNumber, setSiteVisitNumber] = useState('');
  const [siteVisitId, setSiteVisitId] = useState('');
  const [projectCategory, setProjectCategory] = useState<SiteVisitProjectCategory>('Audio-Visual Solutions');
  const [otherProjectDescription, setOtherProjectDescription] = useState('');
  const [evaluationDate, setEvaluationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [assignedTechnician, setAssignedTechnician] = useState('Vamshi Krishna (Lead AV & Systems Engineer)');

  // Section B: Requirements
  const [statedRequirement, setStatedRequirement] = useState('');
  const [projectObjectives, setProjectObjectives] = useState('');
  const [numberOfRooms, setNumberOfRooms] = useState<number>(1);
  const [roomLocations, setRoomLocations] = useState('');
  const [expectedUsage, setExpectedUsage] = useState('');
  const [commercialBudget, setCommercialBudget] = useState('');

  // Section C: Existing Infrastructure
  const [existingEquipment, setExistingEquipment] = useState('');
  const [networkInfra, setNetworkInfra] = useState('Cat6 structured cabling available, Gigabit PoE+ switch port');
  const [electricalPower, setElectricalPower] = useState('Dedicated Online UPS circuit verified');
  const [cablingConduits, setCablingConduits] = useState('Conduit path clear with pull wire in place');
  const [rackMounting, setRackMounting] = useState('Wall-mount AV/network rack available');
  const [compatibility, setCompatibility] = useState('');

  // Section D: Observations & Measurements
  const [siteMeasurements, setSiteMeasurements] = useState('');
  const [physicalConstraints, setPhysicalConstraints] = useState('');
  const [technicalLimitations, setTechnicalLimitations] = useState('');
  const [infraIssues, setInfraIssues] = useState('');

  // Section E: Proposed Solution & Equipment
  const [solutionSummary, setSolutionSummary] = useState('');
  const [architectureSummary, setArchitectureSummary] = useState('');
  const [connectivityMatrix, setConnectivityMatrix] = useState('');
  const [cablingScope, setCablingScope] = useState('');
  const [commissioningScope, setCommissioningScope] = useState('');
  const [recommendedItems, setRecommendedItems] = useState<TechnicalRecommendedItem[]>([]);

  // Section F: Risks & Dependencies
  const [technicalRisks, setTechnicalRisks] = useState('');
  const [installationLimitations, setInstallationLimitations] = useState('');
  const [civilElectricalDep, setCivilElectricalDep] = useState('');
  const [thirdPartyDep, setThirdPartyDep] = useState('');
  const [customerResponsibilities, setCustomerResponsibilities] = useState('');

  // Section G: Recommendations & Remarks
  const [alternativeOptions, setAlternativeOptions] = useState('');
  const [technicalRecommendations, setTechnicalRecommendations] = useState('');
  const [internalRemarks, setInternalRemarks] = useState('');

  // Section H: Review / Workflow
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load state when modal opens or evaluation changes
  useEffect(() => {
    if (!isOpen) return;

    if (evaluation) {
      setCustomerName(evaluation.customer_name || '');
      setCompanyName(evaluation.company_name || '');
      setCustomerId(evaluation.customer_id || '');
      setEnquiryNumber(evaluation.enquiry_number || '');
      setEnquiryId(evaluation.enquiry_id || '');
      setSiteVisitNumber(evaluation.site_visit_number || '');
      setSiteVisitId(evaluation.site_visit_id || '');
      setProjectCategory(evaluation.project_category);
      setOtherProjectDescription(evaluation.other_project_description || '');
      setEvaluationDate(evaluation.evaluation_date || new Date().toISOString().split('T')[0]);
      setAssignedTechnician(evaluation.assigned_technical_employee_name || 'Vamshi Krishna');

      setStatedRequirement(evaluation.stated_requirement || '');
      setProjectObjectives(evaluation.project_objectives || '');
      setNumberOfRooms(evaluation.number_of_rooms || 1);
      setRoomLocations(evaluation.room_or_endpoint_locations || '');
      setExpectedUsage(evaluation.expected_capacity_usage || '');
      setCommercialBudget(evaluation.commercial_budget_constraints || '');

      setExistingEquipment(evaluation.existing_equipment_details || '');
      setNetworkInfra(evaluation.network_infrastructure || '');
      setElectricalPower(evaluation.electrical_power_availability || '');
      setCablingConduits(evaluation.cabling_conduits_status || '');
      setRackMounting(evaluation.rack_mounting_arrangements || '');
      setCompatibility(evaluation.compatibility_requirements || '');

      setSiteMeasurements(evaluation.site_measurements || '');
      setPhysicalConstraints(evaluation.physical_constraints || '');
      setTechnicalLimitations(evaluation.technical_limitations || '');
      setInfraIssues(evaluation.existing_infrastructure_issues || '');

      setSolutionSummary(evaluation.proposed_solution_summary || '');
      setArchitectureSummary(evaluation.system_architecture_summary || '');
      setConnectivityMatrix(evaluation.connectivity_matrix || '');
      setCablingScope(evaluation.cabling_installation_scope || '');
      setCommissioningScope(evaluation.configuration_commissioning_scope || '');
      setRecommendedItems(evaluation.recommended_items || []);

      setTechnicalRisks(evaluation.technical_risks || '');
      setInstallationLimitations(evaluation.installation_limitations || '');
      setCivilElectricalDep(evaluation.civil_electrical_dependency || '');
      setThirdPartyDep(evaluation.third_party_dependencies || '');
      setCustomerResponsibilities(evaluation.customer_responsibilities || '');

      setAlternativeOptions(evaluation.alternative_options || '');
      setTechnicalRecommendations(evaluation.technical_recommendations || '');
      setInternalRemarks(evaluation.internal_engineer_remarks || '');
    } else if (initialContext) {
      // Pre-fill from site visit or enquiry
      setCustomerName(initialContext.customer_name || '');
      setCompanyName(initialContext.company_name || '');
      setCustomerId(initialContext.customer_id || `CUST-${Date.now()}`);
      setEnquiryNumber(initialContext.enquiry_number || '');
      setEnquiryId(initialContext.enquiry_id || '');
      setSiteVisitNumber(initialContext.site_visit_number || '');
      setSiteVisitId(initialContext.site_visit_id || '');
      if (initialContext.project_category && (SITE_VISIT_PROJECT_CATEGORIES as readonly string[]).includes(initialContext.project_category)) {
        setProjectCategory(initialContext.project_category as SiteVisitProjectCategory);
      }
      setSiteMeasurements(initialContext.measurements || '');
      setStatedRequirement(initialContext.notes || '');
      setAssignedTechnician(initialContext.assigned_technician || 'Vamshi Krishna');
      setRecommendedItems([]);
    } else {
      // Reset defaults
      setCustomerName('');
      setCompanyName('');
      setStatedRequirement('');
      setRecommendedItems([]);
    }
    setActionMessage(null);
  }, [isOpen, evaluation, initialContext]);

  if (!isOpen) return null;

  const handleAddRecommendedItem = () => {
    const newItem: TechnicalRecommendedItem = {
      id: `ITEM-TE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      brand: '',
      model: '',
      specifications: '',
      quantity: 1,
      unit: 'Nos.',
      estimated_unit_price: 0,
      is_selected_for_quote: true,
    };
    setRecommendedItems([...recommendedItems, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof TechnicalRecommendedItem, value: any) => {
    setRecommendedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    setRecommendedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const totalEstimatedCost = recommendedItems.reduce(
    (sum, item) => sum + (item.estimated_unit_price || 0) * (item.quantity || 1),
    0
  );

  const buildPayload = (): CreateTechnicalEvaluationPayload => ({
    customer_id: customerId || `CUST-${Date.now()}`,
    customer_name: customerName,
    company_name: companyName || undefined,
    enquiry_id: enquiryId || undefined,
    enquiry_number: enquiryNumber || undefined,
    site_visit_id: siteVisitId || undefined,
    site_visit_number: siteVisitNumber || undefined,
    project_category: projectCategory,
    other_project_description: projectCategory === 'Other Projects' ? otherProjectDescription : undefined,
    evaluation_date: evaluationDate,
    evaluated_by_id: 'USR-DEV-002',
    evaluated_by_name: assignedTechnician,
    assigned_technical_employee_name: assignedTechnician,

    stated_requirement: statedRequirement || 'Standard Audio-Visual & Systems Architecture Evaluation',
    project_objectives: projectObjectives || undefined,
    number_of_rooms: numberOfRooms,
    room_or_endpoint_locations: roomLocations || undefined,
    expected_capacity_usage: expectedUsage || undefined,
    commercial_budget_constraints: commercialBudget || undefined,

    existing_equipment_details: existingEquipment || undefined,
    network_infrastructure: networkInfra || undefined,
    electrical_power_availability: electricalPower || undefined,
    cabling_conduits_status: cablingConduits || undefined,
    rack_mounting_arrangements: rackMounting || undefined,
    compatibility_requirements: compatibility || undefined,

    site_measurements: siteMeasurements || undefined,
    physical_constraints: physicalConstraints || undefined,
    technical_limitations: technicalLimitations || undefined,
    existing_infrastructure_issues: infraIssues || undefined,

    recommended_items: recommendedItems,
    system_architecture_summary: architectureSummary || undefined,
    connectivity_matrix: connectivityMatrix || undefined,
    cabling_installation_scope: cablingScope || undefined,
    configuration_commissioning_scope: commissioningScope || undefined,

    technical_risks: technicalRisks || undefined,
    installation_limitations: installationLimitations || undefined,
    civil_electrical_dependency: civilElectricalDep || undefined,
    third_party_dependencies: thirdPartyDep || undefined,
    customer_responsibilities: customerResponsibilities || undefined,

    proposed_solution_summary: solutionSummary || statedRequirement,
    alternative_options: alternativeOptions || undefined,
    technical_recommendations: technicalRecommendations || undefined,
    internal_engineer_remarks: internalRemarks || undefined,
  });

  const handleSaveDraft = async () => {
    if (!customerName.trim()) {
      setActionMessage({ type: 'error', text: 'Customer name is required' });
      return;
    }
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      const payload = buildPayload();
      if (evaluation?.id) {
        const res = await updateTechnicalEvaluation(evaluation.id, payload);
        if (res.success) {
          setActionMessage({ type: 'success', text: 'Technical Evaluation saved successfully!' });
          onSuccess?.();
        } else {
          setActionMessage({ type: 'error', text: res.error || 'Failed to update evaluation' });
        }
      } else {
        const res = await createTechnicalEvaluation({ ...payload, status: 'Draft' });
        if (res.success) {
          setActionMessage({ type: 'success', text: `Evaluation ${res.data?.evaluation_number} created as Draft!` });
          onSuccess?.();
        } else {
          setActionMessage({ type: 'error', text: res.error || 'Failed to create evaluation' });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!customerName.trim()) {
      setActionMessage({ type: 'error', text: 'Customer name is required' });
      return;
    }
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      let evalId = evaluation?.id;
      if (!evalId) {
        const createRes = await createTechnicalEvaluation({ ...buildPayload(), status: 'Draft' });
        if (!createRes.success || !createRes.data) {
          setActionMessage({ type: 'error', text: createRes.error || 'Failed to save evaluation before submitting' });
          return;
        }
        evalId = createRes.data.id;
      }
      const res = await submitTechnicalEvaluation(evalId);
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Submitted for Technical Review by MD / BDM.' });
        onSuccess?.();
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to submit' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewApprove = async () => {
    if (!evaluation?.id) return;
    setIsSubmitting(true);
    try {
      const res = await reviewTechnicalEvaluation(
        evaluation.id,
        'Reviewed',
        reviewNotes || 'Evaluation reviewed and approved for quotation generation.'
      );
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Evaluation approved! Quotation preparers can now import items.' });
        onSuccess?.();
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Approval failed' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!evaluation?.id) return;
    if (!reviewNotes.trim()) {
      setActionMessage({ type: 'error', text: 'Please enter revision notes describing what must be modified' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await reviewTechnicalEvaluation(
        evaluation.id,
        'Revision Required',
        reviewNotes.trim()
      );
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Evaluation flagged for revision.' });
        onSuccess?.();
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to request revision' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const status = evaluation?.status || 'Draft';

  const statusBadges: Record<TechnicalEvaluationStatus, { bg: string; text: string }> = {
    Draft: { bg: 'bg-slate-100 text-slate-700 border-slate-200', text: 'Draft' },
    Submitted: { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'Under Review' },
    Reviewed: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'Reviewed & Approved' },
    'Revision Required': { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'Revision Required' },
    Closed: { bg: 'bg-gray-100 text-gray-700 border-gray-200', text: 'Closed' },
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-sm">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Technical Evaluation & System Feasibility Report
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadges[status].bg}`}
                >
                  {statusBadges[status].text}
                </span>
                {evaluation?.version && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                    v{evaluation.version}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {evaluation?.evaluation_number || 'New Technical Evaluation'} &bull; Optional Engineering Baseline for Quotation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-1 overflow-x-auto text-xs py-2 scrollbar-none">
          {[
            { id: 'A', label: 'A. Reference Info' },
            { id: 'B', label: 'B. Requirements' },
            { id: 'C', label: 'C. Infrastructure' },
            { id: 'D', label: 'D. Observations' },
            { id: 'E', label: `E. Proposed Solution (${recommendedItems.length})` },
            { id: 'F', label: 'F. Risks & Readiness' },
            { id: 'G', label: 'G. Recommendations' },
            { id: 'H', label: 'H. Review & Actions' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-center justify-between border ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span className="font-semibold">{actionMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-600 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 text-xs space-y-4">
          {/* SECTION A: REFERENCE INFORMATION */}
          {activeTab === 'A' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Cyient Limited / Dr. Reddy's Lab"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Cyient Technologies Hyderabad"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Project Category *</label>
                  <select
                    value={projectCategory}
                    onChange={(e) => setProjectCategory(e.target.value as SiteVisitProjectCategory)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none font-semibold text-slate-800"
                  >
                    {SITE_VISIT_PROJECT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Evaluation Date</label>
                  <input
                    type="date"
                    value={evaluationDate}
                    onChange={(e) => setEvaluationDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Technical Engineer</label>
                  <input
                    type="text"
                    value={assignedTechnician}
                    onChange={(e) => setAssignedTechnician(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                  />
                </div>
              </div>

              {projectCategory === 'Other Projects' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Describe Project Category *
                  </label>
                  <input
                    type="text"
                    required
                    value={otherProjectDescription}
                    onChange={(e) => setOtherProjectDescription(e.target.value)}
                    placeholder="Specify project nature (e.g. Public Address & Mass Notification, Smart Classroom)"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-amber-300 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Related Enquiry Ref</label>
                  <input
                    type="text"
                    value={enquiryNumber}
                    onChange={(e) => setEnquiryNumber(e.target.value)}
                    placeholder="e.g. ENQ260001"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Site Visit Ref</label>
                  <input
                    type="text"
                    value={siteVisitNumber}
                    onChange={(e) => setSiteVisitNumber(e.target.value)}
                    placeholder="e.g. SV260001"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION B: CUSTOMER REQUIREMENTS */}
          {activeTab === 'B' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Stated Customer Requirements *</label>
                <textarea
                  rows={3}
                  value={statedRequirement}
                  onChange={(e) => setStatedRequirement(e.target.value)}
                  placeholder="e.g. Enterprise Boardroom VC with 4K dual displays, ceiling mic pickup, and native Teams Rooms integration."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Functional Objectives & Performance Expectations</label>
                <textarea
                  rows={2}
                  value={projectObjectives}
                  onChange={(e) => setProjectObjectives(e.target.value)}
                  placeholder="e.g. Broadcast-level speech clarity, zero acoustic feedback, automated speaker tracking, clean table concealment."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Number of Rooms / Zones</label>
                  <input
                    type="number"
                    min="1"
                    value={numberOfRooms}
                    onChange={(e) => setNumberOfRooms(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Room / Zone Locations</label>
                  <input
                    type="text"
                    value={roomLocations}
                    onChange={(e) => setRoomLocations(e.target.value)}
                    placeholder="e.g. 5th Floor Executive Boardroom"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Commercial Budget Constraints</label>
                  <input
                    type="text"
                    value={commercialBudget}
                    onChange={(e) => setCommercialBudget(e.target.value)}
                    placeholder="e.g. ₹8,00,000 - ₹12,00,000"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expected Capacity & Daily Usage</label>
                <input
                  type="text"
                  value={expectedUsage}
                  onChange={(e) => setExpectedUsage(e.target.value)}
                  placeholder="e.g. 24 seated executives, daily 6-8 hours hybrid collaboration"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* SECTION C: EXISTING INFRASTRUCTURE */}
          {activeTab === 'C' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Existing Equipment Status</label>
                  <textarea
                    rows={2}
                    value={existingEquipment}
                    onChange={(e) => setExistingEquipment(e.target.value)}
                    placeholder="e.g. Old analog Polycom conference phone to be decommissioned"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Network & PoE Infrastructure</label>
                  <textarea
                    rows={2}
                    value={networkInfra}
                    onChange={(e) => setNetworkInfra(e.target.value)}
                    placeholder="e.g. Cat6 structured cabling available, Gigabit PoE+ switch port provisioned on VLAN 40"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Electrical & Power Availability</label>
                  <textarea
                    rows={2}
                    value={electricalPower}
                    onChange={(e) => setElectricalPower(e.target.value)}
                    placeholder="e.g. Dedicated 2kVA Online UPS circuit available behind display wall"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cabling Conduits & Pathways</label>
                  <textarea
                    rows={2}
                    value={cablingConduits}
                    onChange={(e) => setCablingConduits(e.target.value)}
                    placeholder="e.g. 2-inch floor conduit from table to display wall verified with pull wire"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rack Mounting & Storage Space</label>
                  <input
                    type="text"
                    value={rackMounting}
                    onChange={(e) => setRackMounting(e.target.value)}
                    placeholder="e.g. 12U wall-mount AV rack provisioned in adjacent server nook"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Software / Platform Compatibility</label>
                  <input
                    type="text"
                    value={compatibility}
                    onChange={(e) => setCompatibility(e.target.value)}
                    placeholder="e.g. Native Microsoft Teams Rooms & Zoom Rooms"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION D: TECHNICAL OBSERVATIONS */}
          {activeTab === 'D' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Physical Room Measurements & Layout</label>
                <input
                  type="text"
                  value={siteMeasurements}
                  onChange={(e) => setSiteMeasurements(e.target.value)}
                  placeholder="e.g. 28ft L x 18ft W x 10.5ft Ceiling Height, Rectangular Table"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Physical & Architectural Constraints</label>
                  <textarea
                    rows={3}
                    value={physicalConstraints}
                    onChange={(e) => setPhysicalConstraints(e.target.value)}
                    placeholder="e.g. East wall is floor-to-ceiling glass; requires acoustic treatment and high-brightness displays"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Technical Bottlenecks & Limitations</label>
                  <textarea
                    rows={3}
                    value={technicalLimitations}
                    onChange={(e) => setTechnicalLimitations(e.target.value)}
                    placeholder="e.g. Ambient daylight requires min 700-nit high-haze displays to prevent glare"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Existing Infrastructure Gaps or Issues</label>
                <textarea
                  rows={2}
                  value={infraIssues}
                  onChange={(e) => setInfraIssues(e.target.value)}
                  placeholder="e.g. RT60 reverb time ~1.1s. Acoustic dampening panels recommended on rear wall."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* SECTION E: PROPOSED SOLUTION & RECOMMENDED EQUIPMENT */}
          {activeTab === 'E' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Recommended Equipment & Materials (Bill of Materials)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      These items can be selectively imported into the quotation workspace upon approval.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRecommendedItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Equipment
                  </button>
                </div>

                {recommendedItems.length === 0 ? (
                  <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-2">
                    <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-600">No equipment items specified yet</p>
                    <p className="text-slate-400 text-[11px]">
                      Add recommended equipment with brand, model, specifications, and estimated price.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddRecommendedItem}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add First Item
                    </button>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                    <div className="grid grid-cols-12 gap-2 p-2.5 bg-slate-50 font-bold text-[11px] text-slate-700">
                      <div className="col-span-2">Brand</div>
                      <div className="col-span-3">Model / Part No</div>
                      <div className="col-span-3">Specifications</div>
                      <div className="col-span-1 text-center">Qty</div>
                      <div className="col-span-2 text-right">Est. Unit Price (₹)</div>
                      <div className="col-span-1 text-center">Action</div>
                    </div>
                    {recommendedItems.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 p-2.5 items-center text-xs">
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={item.brand}
                            onChange={(e) => handleUpdateItem(item.id, 'brand', e.target.value)}
                            placeholder="e.g. Sony / Poly"
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={item.model}
                            onChange={(e) => handleUpdateItem(item.id, 'model', e.target.value)}
                            placeholder="e.g. Studio X70 Video Bar"
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none font-semibold text-slate-900"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={item.specifications}
                            onChange={(e) => handleUpdateItem(item.id, 'specifications', e.target.value)}
                            placeholder="e.g. Dual 4K cam, auto-tracking"
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none"
                          />
                        </div>
                        <div className="col-span-1">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                            className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded-lg text-center outline-none font-bold"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            value={item.estimated_unit_price || ''}
                            onChange={(e) => handleUpdateItem(item.id, 'estimated_unit_price', Number(e.target.value))}
                            placeholder="₹ Unit Price"
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg text-right outline-none font-mono font-bold text-slate-900"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="p-3 bg-slate-50 flex items-center justify-between font-bold text-xs">
                      <span className="text-slate-600">Total Estimated Recommended Hardware:</span>
                      <span className="text-brand-700 text-sm font-mono font-black">
                        ₹ {totalEstimatedCost.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">System Architecture Summary</label>
                  <textarea
                    rows={2}
                    value={architectureSummary}
                    onChange={(e) => setArchitectureSummary(e.target.value)}
                    placeholder="e.g. Dual-display native Teams Room compute with ceiling microphone array networked via Dante PoE switch."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Connectivity & Signal Flow Matrix</label>
                  <textarea
                    rows={2}
                    value={connectivityMatrix}
                    onChange={(e) => setConnectivityMatrix(e.target.value)}
                    placeholder="e.g. HDMI 2.0 4K60, USB-C BYOD passthrough, Dante IP Audio, RS-232 IP display control"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cabling & Physical Installation Scope</label>
                  <textarea
                    rows={2}
                    value={cablingScope}
                    onChange={(e) => setCablingScope(e.target.value)}
                    placeholder="e.g. Pull shielded Cat6A cables through floor conduits, dress rack cabling, mount dual display brackets"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Configuration & Commissioning Scope</label>
                  <textarea
                    rows={2}
                    value={commissioningScope}
                    onChange={(e) => setCommissioningScope(e.target.value)}
                    placeholder="e.g. M365 tenant room enrollment, Shure microphone acoustic lobe tuning, AEC calibration"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION F: RISKS & READINESS */}
          {activeTab === 'F' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Technical Risks & Mitigations</label>
                  <textarea
                    rows={3}
                    value={technicalRisks}
                    onChange={(e) => setTechnicalRisks(e.target.value)}
                    placeholder="e.g. Glass reverberation risk mitigated by Shure directional ceiling pickup and noise dampening."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Installation Constraints & Work Hours</label>
                  <textarea
                    rows={3}
                    value={installationLimitations}
                    onChange={(e) => setInstallationLimitations(e.target.value)}
                    placeholder="e.g. Drilling and loud work permitted only after 7 PM on weekdays or full Saturdays/Sundays."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Civil & Electrical Prerequisites</label>
                  <textarea
                    rows={2}
                    value={civilElectricalDep}
                    onChange={(e) => setCivilElectricalDep(e.target.value)}
                    placeholder="e.g. Client electrician must provide 2x 16A isolated sockets behind display mounting bracket."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer IT & Licensing Responsibilities</label>
                  <textarea
                    rows={2}
                    value={customerResponsibilities}
                    onChange={(e) => setCustomerResponsibilities(e.target.value)}
                    placeholder="e.g. Provide Teams Rooms Pro license, static IP allocation, firewall whitelist."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION G: RECOMMENDATIONS & REMARKS */}
          {activeTab === 'G' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Proposed Solution Summary *</label>
                <textarea
                  rows={2}
                  value={solutionSummary}
                  onChange={(e) => setSolutionSummary(e.target.value)}
                  placeholder="e.g. Complete turnkey executive boardroom AV solution matching enterprise IT reliability standards."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Alternative Options Considered</label>
                  <textarea
                    rows={2}
                    value={alternativeOptions}
                    onChange={(e) => setAlternativeOptions(e.target.value)}
                    placeholder="e.g. Single 85-inch display option available for ₹1,20,000 budget savings."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Technical Recommendations & Next Steps</label>
                  <textarea
                    rows={2}
                    value={technicalRecommendations}
                    onChange={(e) => setTechnicalRecommendations(e.target.value)}
                    placeholder="e.g. Recommend dual 75-inch setup for optimal simultaneous presentation and participant viewing."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              {/* STRICTLY INTERNAL REMARKS (CRITICAL CONFIDENTIALITY BOUNDARY) */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Lock className="w-4 h-4 text-amber-700" />
                  <span>Internal Engineer Remarks (Confidential — Strictly NOT Exported to Quotations)</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Enter technical notes, vendor cost negotiations, margins, or internal technician observations.
                  This field is permanently quarantined from customer-facing documents and quotations.
                </p>
                <textarea
                  rows={3}
                  value={internalRemarks}
                  onChange={(e) => setInternalRemarks(e.target.value)}
                  placeholder="e.g. Client IT lead is very detail-oriented regarding Dante audio. Margin on Poly bar is 18%, Shure mic is 22%."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-amber-300 focus:ring-2 focus:ring-amber-500 outline-none text-slate-900"
                />
              </div>
            </div>
          )}

          {/* SECTION H: REVIEW & WORKFLOW ACTIONS */}
          {activeTab === 'H' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Evaluation Status & Governance Workflow
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block font-semibold text-[10px]">CURRENT STATUS</span>
                    <strong className="text-slate-800 text-xs block mt-0.5">{status}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block font-semibold text-[10px]">EVALUATED BY</span>
                    <strong className="text-slate-800 text-xs block mt-0.5 truncate">
                      {evaluation?.evaluated_by_name || assignedTechnician}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block font-semibold text-[10px]">SUBMITTED AT</span>
                    <strong className="text-slate-800 text-xs block mt-0.5">
                      {evaluation?.submitted_at ? evaluation.submitted_at.replace('T', ' ').slice(0, 16) : 'Not Submitted'}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block font-semibold text-[10px]">REVIEWED BY</span>
                    <strong className="text-slate-800 text-xs block mt-0.5 truncate">
                      {evaluation?.reviewed_by_name || 'Pending Review'}
                    </strong>
                  </div>
                </div>

                {evaluation?.review_notes && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                    <span className="font-bold block">Review Notes ({evaluation.reviewed_by_name}):</span>
                    <p className="mt-1">{evaluation.review_notes}</p>
                  </div>
                )}

                {evaluation?.revision_notes && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                    <span className="font-bold block">Revision Notes ({evaluation.revision_requested_by_name}):</span>
                    <p className="mt-1">{evaluation.revision_notes}</p>
                  </div>
                )}
              </div>

              {/* Review & Revision Controls (For MD / BDM / Admin) */}
              <div className="p-4 rounded-2xl bg-brand-50/50 border border-brand-200/80 space-y-3">
                <h4 className="font-bold text-brand-950 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-600" />
                  Technical Review & Governance Actions (Managing Director / Admin / BDM)
                </h4>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Review / Revision Feedback Notes
                  </label>
                  <textarea
                    rows={2}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Enter approval comments or specify required changes..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={isSubmitting || !evaluation?.id}
                    onClick={handleReviewApprove}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve for Quotation
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !evaluation?.id}
                    onClick={handleRequestRevision}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 font-bold text-xs transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Request Revision
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Section {activeTab} of H</span>
            <span>&bull;</span>
            <span className="font-mono">
              {recommendedItems.length} items (₹{totalEstimatedCost.toLocaleString('en-IN')})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-700 hover:bg-slate-200/60 font-bold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition shadow-xs"
            >
              <Save className="w-3.5 h-3.5 text-slate-500" />
              Save Draft
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitForReview}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition shadow-sm shadow-brand-500/20"
            >
              <Send className="w-3.5 h-3.5" />
              Submit for Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
