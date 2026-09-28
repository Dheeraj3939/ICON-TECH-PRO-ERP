'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  User,
  Clock,
  CheckCircle2,
  Ruler,
  Plus,
  FileSpreadsheet,
  ArrowRight,
  Camera,
  Layers,
  X,
  Check,
  Building2,
  Paperclip,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Sliders,
  Wrench,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import {
  getSiteVisits,
  getSiteVisitIntelligence,
  generatePreVisitBrief,
  recordPostVisitFindings,
  extractVisitRequirements,
  applyVisitFindingsToEnquiry,
} from '@/lib/actions/operations';
import { uploadAttachment } from '@/lib/actions/attachments';
import type { SiteVisitDetails, SiteVisitIntelligence } from '@/types/erp';
import EditSiteVisitModal from '@/components/modals/EditSiteVisitModal';

export default function SiteVisitsPage() {
  const [visits, setVisits] = useState<SiteVisitDetails[]>([]);
  const [isNewSurveyModalOpen, setIsNewSurveyModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<SiteVisitDetails | null>(null);

  // Site Visit Intelligence Modal state
  const [isIntelligenceOpen, setIsIntelligenceOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<SiteVisitDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'brief' | 'checklist' | 'findings' | 'sync'>('brief');
  const [intelligence, setIntelligence] = useState<SiteVisitIntelligence | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [intelActionMsg, setIntelActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for findings
  const [findingDimensions, setFindingDimensions] = useState('');
  const [findingLux, setFindingLux] = useState('Controlled dim lighting (150-250 Lux)');
  const [findingWall, setFindingWall] = useState('Heavy reinforced masonry (suitable for direct wall-mounting)');
  const [findingConduit, setFindingConduit] = useState('Conduit path clear with pull-wire in place');
  const [findingPower, setFindingPower] = useState('Dedicated 16A circuit with isolated ground verified');
  const [findingReverb, setFindingReverb] = useState('Moderate reverberation (~0.8s RT60). Acoustic treatment recommended.');
  const [findingNotes, setFindingNotes] = useState('');
  const [syncConfirmedBy, setSyncConfirmedBy] = useState('Vamshi Krishna (Lead Technician)');

  // New Survey Form state
  const [customerName, setCustomerName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [roomType, setRoomType] = useState('Home Theater');
  const [dimensions, setDimensions] = useState('22ft L x 16ft W x 10.5ft H');
  const [wallType, setWallType] = useState('Brick / Concrete');
  const [conduitVerified, setConduitVerified] = useState(true);
  const [powerAvailable, setPowerAvailable] = useState(true);
  const [assignedTechnician, setAssignedTechnician] = useState('Vamshi Krishna');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadVisits = async () => {
    const data = await getSiteVisits();
    setVisits(data);
  };

  useEffect(() => {
    loadVisits();
  }, []);

  const handleOpenIntelligence = async (visit: SiteVisitDetails) => {
    const visitId = visit.id || visit.visitNumber || '';
    if (!visitId) return;
    setSelectedVisit(visit);
    setIsIntelligenceOpen(true);
    setActiveTab('brief');
    setIntelActionMsg(null);
    setLoadingIntel(true);

    try {
      const res = await getSiteVisitIntelligence(visitId);
      if (res.success && res.data) {
        setIntelligence(res.data);
        if (res.data.post_visit_summary) {
          setFindingDimensions(res.data.post_visit_summary.room_dimensions);
          setFindingLux(res.data.post_visit_summary.ambient_lux_level || 'Controlled dim lighting (150-250 Lux)');
          setFindingWall(res.data.post_visit_summary.mounting_surface_strength);
          setFindingConduit(res.data.post_visit_summary.conduit_and_cabling_readiness);
          setFindingPower(res.data.post_visit_summary.power_and_grounding_readiness);
          setFindingReverb(res.data.post_visit_summary.reverberation_notes || '');
          setFindingNotes(res.data.post_visit_summary.technician_observations || '');
        } else {
          setFindingDimensions(visit.measurements || '24ft L x 18ft W x 11ft H');
        }
      } else {
        // Auto-generate initial pre-visit brief
        const genRes = await generatePreVisitBrief(visitId);
        if (genRes.success && genRes.data) {
          setIntelligence(genRes.data);
          setFindingDimensions(visit.measurements || '24ft L x 18ft W x 11ft H');
        }
      }
    } catch (e: any) {
      setIntelActionMsg({ type: 'error', text: e?.message || 'Failed to load intelligence brief' });
    } finally {
      setLoadingIntel(false);
    }
  };

  const handleSaveFindings = async () => {
    const visitId = selectedVisit?.id || selectedVisit?.visitNumber || '';
    if (!visitId) return;
    setLoadingIntel(true);
    setIntelActionMsg(null);
    try {
      const res = await recordPostVisitFindings(visitId, {
        room_dimensions: findingDimensions,
        ambient_lux_level: findingLux,
        mounting_surface_strength: findingWall,
        conduit_and_cabling_readiness: findingConduit,
        power_and_grounding_readiness: findingPower,
        reverberation_notes: findingReverb,
        technician_observations: findingNotes,
      });
      if (res.success && res.data) {
        setIntelligence(res.data);
        setIntelActionMsg({ type: 'success', text: 'Site survey findings saved successfully!' });
      } else {
        setIntelActionMsg({ type: 'error', text: res.error || 'Failed to save findings' });
      }
    } finally {
      setLoadingIntel(false);
    }
  };

  const handleExtractRequirements = async () => {
    const visitId = selectedVisit?.id || selectedVisit?.visitNumber || '';
    if (!visitId) return;
    setLoadingIntel(true);
    setIntelActionMsg(null);
    try {
      const res = await extractVisitRequirements(visitId);
      if (res.success && res.data) {
        setIntelligence(res.data);
        setIntelActionMsg({ type: 'success', text: `Extracted ${res.data.extracted_requirements?.length || 0} component requirements!` });
      } else {
        setIntelActionMsg({ type: 'error', text: res.error || 'Failed to extract requirements' });
      }
    } finally {
      setLoadingIntel(false);
    }
  };

  const handleSyncToEnquiry = async () => {
    const visitId = selectedVisit?.id || selectedVisit?.visitNumber || '';
    if (!visitId || !syncConfirmedBy.trim()) return;
    setLoadingIntel(true);
    setIntelActionMsg(null);
    try {
      const res = await applyVisitFindingsToEnquiry(visitId, syncConfirmedBy);
      if (res.success && res.data) {
        setIntelligence(res.data);
        setIntelActionMsg({
          type: 'success',
          text: `Successfully synchronized technical requirements into commercial presales enquiry! (Confirmed by ${syncConfirmedBy})`,
        });
        loadVisits();
      } else {
        setIntelActionMsg({ type: 'error', text: res.error || 'Failed to sync to enquiry' });
      }
    } finally {
      setLoadingIntel(false);
    }
  };

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !siteAddress) return;
    setSubmitting(true);
    try {
      const newVisitNum = `SV26000${visits.length + 1}`;
      const newVisit: SiteVisitDetails = {
        id: `SV-${Date.now()}`,
        visitNumber: newVisitNum,
        required: true,
        siteAddress,
        roomType,
        measurements: dimensions,
        scheduledDate,
        assignedTechnician,
        status: 'SCHEDULED',
        notes: `${notes} [Wall: ${wallType}, Conduit: ${conduitVerified ? 'Yes' : 'No'}, Power: ${powerAvailable ? 'Yes' : 'No'}]`,
      };

      if (photoUrl) {
        await uploadAttachment({
          entity_type: 'site_visit',
          entity_id: newVisit.id || `SV-${Date.now()}`,
          file_name: `Site_Photo_${newVisitNum}.jpg`,
          file_url: photoUrl,
        });
      }

      setVisits((prev) => [newVisit, ...prev]);
      setIsNewSurveyModalOpen(false);
      setCustomerName('');
      setSiteAddress('');
      setNotes('');
      setPhotoUrl('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Site Measurements & Technical Surveys
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold">
              {visits.length} Surveys
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dispatch technicians for physical room dimensions, acoustic checks, conduit paths & photo logs
          </p>
        </div>

        <button
          onClick={() => setIsNewSurveyModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          New Mobile Survey
        </button>
      </div>

      {/* Grid of Site Visits */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visits.map((sv, idx) => (
          <div
            key={sv.id || idx}
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 hover:border-brand-300 transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 text-xs">
                  {sv.visitNumber || `SV26000${idx + 1}`}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    sv.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {sv.status}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-base">{sv.roomType || 'Home Theater / Boardroom'}</h3>
                <p className="text-xs text-slate-600 flex items-start gap-1.5 mt-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 mt-0.5" />
                  <span>{sv.siteAddress}</span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <Ruler className="w-3.5 h-3.5 text-slate-400" />
                    Dimensions:
                  </span>
                  <strong className="text-slate-800">{sv.measurements || '22ft L x 16ft W x 10.5ft H'}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Technician:
                  </span>
                  <strong className="text-slate-800">{sv.assignedTechnician}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Scheduled:
                  </span>
                  <strong className="text-slate-800">{sv.scheduledDate}</strong>
                </div>
              </div>

              {sv.notes && (
                <p className="text-slate-500 text-[11px] italic bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                  &ldquo;{sv.notes}&rdquo;
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400 font-medium">Actions</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingVisit(sv)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs border border-amber-200 transition shadow-2xs"
                  title="Edit Site Visit Details"
                >
                  <Pencil className="w-3.5 h-3.5 text-amber-600" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenIntelligence(sv)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-xs border border-violet-200 transition shadow-sm"
                  title="Open AI Survey Intelligence & Brief"
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  <span>AI Brief</span>
                </button>
                <Link
                  href={`/dashboard/quotations?site_visit=${encodeURIComponent(sv.visitNumber || `SV26000${idx + 1}`)}&room_type=${encodeURIComponent(sv.roomType || '')}&dimensions=${encodeURIComponent(sv.measurements || '')}&notes=${encodeURIComponent(sv.notes || '')}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs border border-brand-200 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-brand-600" />
                  <span>Quote</span>
                  <ArrowRight className="w-3 h-3 text-brand-500" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Survey Form Modal */}
      {isNewSurveyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-brand-600" />
                Mobile Technical Survey Form
              </h2>
              <button
                type="button"
                onClick={() => setIsNewSurveyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSurvey} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer / Site Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Reddy Villa / T-Hub"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Site Address *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jubilee Hills Road No. 36, Hyderabad"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Room / Space Type</label>
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Home Theater">Home Theater</option>
                    <option value="Boardroom">Boardroom</option>
                    <option value="Conference Room">Conference Room</option>
                    <option value="Classroom">Classroom</option>
                    <option value="Auditorium">Auditorium</option>
                    <option value="Living Room AV">Living Room AV</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dimensions (L x W x H)</label>
                  <input
                    type="text"
                    placeholder="e.g. 24ft L x 18ft W x 11ft H"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Wall Construction</label>
                  <select
                    value={wallType}
                    onChange={(e) => setWallType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Brick / Concrete">Brick / Concrete</option>
                    <option value="Drywall / Gypsum">Drywall / Gypsum</option>
                    <option value="Wood Paneling">Wood Paneling</option>
                    <option value="Glass Partition">Glass Partition</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Technician</label>
                  <input
                    type="text"
                    value={assignedTechnician}
                    onChange={(e) => setAssignedTechnician(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Conduits & Power Checkboxes */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={conduitVerified}
                    onChange={(e) => setConduitVerified(e.target.checked)}
                    className="rounded text-brand-600"
                  />
                  <span>Conduit & Cabling Path Verified</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={powerAvailable}
                    onChange={(e) => setPowerAvailable(e.target.checked)}
                    className="rounded text-brand-600"
                  />
                  <span>Power Points Ready</span>
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Site Photo / Drawing URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="https://... or photo path"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Acoustic & Site Notes</label>
                <textarea
                  rows={2}
                  placeholder="Notes on ambient light, speaker placement, throw distance..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewSurveyModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Site Survey'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Site Visit Intelligence Modal */}
      {isIntelligenceOpen && selectedVisit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 text-xs overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-violet-100 text-violet-700">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h2 className="text-base font-black text-slate-900">
                    Site Visit Intelligence & Technical Survey
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[11px]">
                    {selectedVisit.visitNumber || selectedVisit.id}
                  </span>
                  {intelligence && (
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        intelligence.status === 'CONVERTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : intelligence.status === 'SYNTHESIZED'
                          ? 'bg-blue-100 text-blue-800'
                          : intelligence.status === 'SURVEYED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {intelligence.status}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {selectedVisit.roomType} &bull; {selectedVisit.siteAddress}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsIntelligenceOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Banner */}
            {intelActionMsg && (
              <div
                className={`px-5 py-2.5 text-xs font-medium flex items-center gap-2 ${
                  intelActionMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-100'
                    : 'bg-rose-50 text-rose-800 border-b border-rose-100'
                }`}
              >
                {intelActionMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{intelActionMsg.text}</span>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 bg-slate-50/75 px-5 pt-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('brief')}
                className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'brief'
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Pre-Brief & Tools</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('checklist')}
                className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'checklist'
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Survey Checklist ({intelligence?.requirement_checklist?.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('findings')}
                className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'findings'
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Findings Log</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sync')}
                className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'sync'
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>AI Extractor & Presales Sync</span>
              </button>
            </div>

            {/* Tab Content Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {loadingIntel ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-violet-600" />
                  <p className="font-semibold text-xs">Analyzing survey technical parameters...</p>
                </div>
              ) : (
                <>
                  {/* TAB 1: Pre-Brief & Equipment */}
                  {activeTab === 'brief' && (
                    <div className="space-y-4">
                      {intelligence?.pre_visit_brief ? (
                        <>
                          <div className="p-4 rounded-xl bg-violet-50/50 border border-violet-100 space-y-3">
                            <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider text-violet-900 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                              Pre-Survey Technical Brief
                            </h4>
                            <div className="space-y-2 text-slate-700">
                              <p>
                                <strong>Customer Overview:</strong>{' '}
                                {intelligence.pre_visit_brief.customer_overview}
                              </p>
                              <p>
                                <strong>Site Context:</strong>{' '}
                                {intelligence.pre_visit_brief.site_context}
                              </p>
                              <p>
                                <strong>Proposed Solution:</strong>{' '}
                                {intelligence.pre_visit_brief.proposed_solution_overview}
                              </p>
                              <p>
                                <strong>Key Stakeholder:</strong>{' '}
                                {intelligence.pre_visit_brief.key_stakeholder}
                              </p>
                              <div>
                                <strong className="block mb-1">Critical Measurement Focus:</strong>
                                <div className="flex flex-wrap gap-1.5">
                                  {intelligence.pre_visit_brief.critical_measurement_focus.map((f: string, i: number) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 rounded-full bg-white border border-violet-200 text-violet-800 font-semibold text-[11px]"
                                    >
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-slate-500 italic">No pre-visit brief generated yet.</p>
                      )}

                      {/* Equipment Checklist */}
                      <div className="space-y-2 pt-2">
                        <h4 className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-slate-600" />
                          Assigned Survey Equipment Checklist
                        </h4>
                        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                          {intelligence?.equipment_checklist?.map((eq, idx: number) => (
                            <div
                              key={idx}
                              className="p-2.5 flex items-center justify-between bg-white hover:bg-slate-50 text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="font-semibold text-slate-800">{eq.tool_name}</span>
                                <span className="text-slate-500 text-[11px]">&bull; {eq.purpose}</span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  eq.packed
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {eq.packed ? 'Packed / Ready' : 'Pending Pack'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Survey Checklist */}
                  {activeTab === 'checklist' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-slate-500 text-[11px]">
                          Complete all mandatory survey parameters during the on-site walkthrough:
                        </p>
                      </div>

                      <div className="space-y-2">
                        {intelligence?.requirement_checklist?.map((item, idx: number) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl border border-slate-200 bg-white hover:border-violet-200 transition space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-700 font-bold text-[10px]">
                                  {item.category}
                                </span>
                                <span className="font-bold text-slate-800">{item.item}</span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.mandatory
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {item.mandatory ? 'Required' : 'Optional'}
                              </span>
                            </div>
                            {item.notes && (
                              <p className="text-[11px] text-slate-500 pl-2 border-l-2 border-slate-200">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Technical Questions */}
                      {intelligence?.technical_questions && intelligence.technical_questions.length > 0 && (
                        <div className="space-y-2 pt-3 border-t border-slate-100">
                          <h4 className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-600" />
                            Technical Questions & Feasibility
                          </h4>
                          <div className="space-y-2">
                            {intelligence.technical_questions.map((q, idx: number) => (
                              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                <span className="font-bold text-slate-900 block">{q.question}</span>
                                <p className="text-slate-500 text-[11px]">{q.context}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: Findings Log */}
                  {activeTab === 'findings' && (
                    <div className="space-y-4">
                      <p className="text-slate-500 text-[11px]">
                        Record physical measurements, ambient light, wall construction strength, and cabling pathways:
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Laser-Measured Dimensions (L x W x H) *
                          </label>
                          <input
                            type="text"
                            value={findingDimensions}
                            onChange={(e) => setFindingDimensions(e.target.value)}
                            placeholder="e.g. 24ft L x 18ft W x 11ft H"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Ambient Lux Level
                          </label>
                          <input
                            type="text"
                            value={findingLux}
                            onChange={(e) => setFindingLux(e.target.value)}
                            placeholder="e.g. High ambient light (350+ Lux)"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Mounting Surface Strength
                          </label>
                          <input
                            type="text"
                            value={findingWall}
                            onChange={(e) => setFindingWall(e.target.value)}
                            placeholder="e.g. Heavy reinforced masonry"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Conduit & Cabling Readiness
                          </label>
                          <input
                            type="text"
                            value={findingConduit}
                            onChange={(e) => setFindingConduit(e.target.value)}
                            placeholder="e.g. Conduit path clear with pull-wire"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Power & Grounding Readiness
                          </label>
                          <input
                            type="text"
                            value={findingPower}
                            onChange={(e) => setFindingPower(e.target.value)}
                            placeholder="e.g. Dedicated 16A circuit with isolated ground"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Reverberation & Acoustic Notes
                          </label>
                          <input
                            type="text"
                            value={findingReverb}
                            onChange={(e) => setFindingReverb(e.target.value)}
                            placeholder="e.g. Moderate reverberation (~0.8s RT60)"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          General Survey Notes & Obstacles
                        </label>
                        <textarea
                          rows={2}
                          value={findingNotes}
                          onChange={(e) => setFindingNotes(e.target.value)}
                          placeholder="Note any HVAC ducts, false ceiling drops, or line-of-sight constraints..."
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleSaveFindings}
                          disabled={loadingIntel}
                          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
                        >
                          {loadingIntel ? 'Saving Findings...' : 'Save Survey Findings'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: AI Extractor & Presales Sync */}
                  {activeTab === 'sync' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-slate-500 text-[11px]">
                          Synthesize physical survey findings into technical bill-of-quantities components:
                        </p>
                        <button
                          type="button"
                          onClick={handleExtractRequirements}
                          disabled={loadingIntel || !intelligence?.post_visit_summary}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-800 font-bold text-xs transition disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                          <span>Extract Requirements</span>
                        </button>
                      </div>

                      {/* Extracted Requirements Table */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs divide-y divide-slate-200">
                          <thead className="bg-slate-50 text-slate-700 font-bold">
                            <tr>
                              <th className="p-3">Component</th>
                              <th className="p-3">Specification</th>
                              <th className="p-3 text-center">Qty</th>
                              <th className="p-3">Readiness Prerequisite</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {intelligence?.extracted_requirements &&
                            intelligence.extracted_requirements.length > 0 ? (
                              intelligence.extracted_requirements.map((req, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="p-3 font-bold text-slate-900">{req.component}</td>
                                  <td className="p-3 text-slate-600">{req.specification}</td>
                                  <td className="p-3 text-center font-bold text-slate-800">
                                    {req.quantity_estimate}
                                  </td>
                                  <td className="p-3 text-slate-500 text-[11px]">
                                    {req.readiness_prerequisite}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                                  No requirements extracted yet. Record survey findings in Tab 3 and click &quot;Extract Requirements&quot;.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Human-Gated Commercial Sync */}
                      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 space-y-3">
                        <div className="flex items-start gap-2.5">
                          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <h4 className="font-bold text-slate-900 text-xs">
                              Human-Gated Commercial Presales Synchronization
                            </h4>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              In accordance with ICON TECH PRO ERP governance, AI extracts and recommends bill-of-quantities specifications, but an authorized human technician or sales engineer must explicitly verify and confirm the survey findings before synchronizing them into the presales commercial enquiry.
                            </p>
                          </div>
                        </div>

                        {intelligence?.status === 'CONVERTED' ? (
                          <div className="p-3 rounded-lg bg-emerald-100/70 border border-emerald-300 text-emerald-900 font-semibold flex items-center justify-between">
                            <span>
                              &check; Synchronized with Presales Enquiry on{' '}
                              {intelligence.converted_to_enquiry_at?.split('T')[0] || 'Today'}
                            </span>
                            <span className="text-[11px] font-normal text-emerald-800">
                              Enquiry Status: Site Visit Scheduled / Verified
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                            <div className="w-full sm:w-2/3">
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Authorizing Officer / Technician Name *
                              </label>
                              <input
                                type="text"
                                value={syncConfirmedBy}
                                onChange={(e) => setSyncConfirmedBy(e.target.value)}
                                placeholder="Enter your full name and role..."
                                className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-800"
                              />
                            </div>
                            <div className="w-full sm:w-1/3 sm:self-end">
                              <button
                                type="button"
                                onClick={handleSyncToEnquiry}
                                disabled={
                                  loadingIntel ||
                                  !intelligence?.extracted_requirements ||
                                  intelligence.extracted_requirements.length === 0 ||
                                  !syncConfirmedBy.trim()
                                }
                                className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Confirm & Sync Enquiry</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-[11px] text-slate-400 font-mono">
                Site Visit Intelligence Engine &bull; Human-in-the-Loop Architecture
              </span>
              <button
                type="button"
                onClick={() => setIsIntelligenceOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Site Visit Modal */}
      <EditSiteVisitModal
        isOpen={!!editingVisit}
        onClose={() => setEditingVisit(null)}
        visit={editingVisit}
        onSuccess={loadVisits}
      />
    </div>
  );
}
