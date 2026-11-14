'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Clock,
  User,
  CheckCircle2,
  ShieldAlert,
  Lock,
  FileText,
  Building2,
  Calendar,
  Briefcase,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Eye,
  Check,
  X,
  AlertTriangle,
  Bookmark,
  Hash,
  Download,
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';
import {
  fetchEnterpriseAuditLogs,
  verifyAuditIntegrityAction,
  createAuditCheckpointAction,
  toggleLegalHoldAction,
} from '@/lib/actions/audit';
import type {
  EnterpriseAuditRecord,
  AuditCategory,
  AuditSeverity,
  AuditFieldDiff,
} from '@/types/security';

type AuditViewKey =
  | 'ALL'
  | 'EMPLOYEE'
  | 'CUSTOMER'
  | 'ENQUIRY'
  | 'SITE_VISIT'
  | 'TECH_EVAL'
  | 'QUOTATION'
  | 'ORDER'
  | 'INVOICE'
  | 'DOCUMENT'
  | 'SECURITY'
  | 'ADMIN'
  | 'SYSTEM';

const AUDIT_VIEWS: Array<{ key: AuditViewKey; label: string; icon: any; countFilter?: any }> = [
  { key: 'ALL', label: '1. All Company Stream', icon: Layers },
  { key: 'EMPLOYEE', label: '2. Employee Activity', icon: User },
  { key: 'CUSTOMER', label: '3. Customer Master', icon: Building2 },
  { key: 'ENQUIRY', label: '4. Enquiries & Leads', icon: Briefcase },
  { key: 'SITE_VISIT', label: '5. Site Visits', icon: Calendar },
  { key: 'TECH_EVAL', label: '6. Technical Evaluations', icon: Sparkles },
  { key: 'QUOTATION', label: '7. Quotations & CPQ', icon: FileText },
  { key: 'ORDER', label: '8. Sales Orders', icon: FileSpreadsheet },
  { key: 'INVOICE', label: '9. Invoices & Billing', icon: FileSpreadsheet },
  { key: 'DOCUMENT', label: '10. Documents & Challans', icon: FileText },
  { key: 'SECURITY', label: '11. Security & Logins', icon: Lock },
  { key: 'ADMIN', label: '12. Admin & Overrides', icon: ShieldAlert },
  { key: 'SYSTEM', label: '13. System & Automation', icon: Clock },
];

export default function CentralAuditCentrePage() {
  const [activeView, setActiveView] = useState<AuditViewKey>('ALL');
  const [records, setRecords] = useState<EnterpriseAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | 'ALL'>('ALL');
  const [legalHoldOnly, setLegalHoldOnly] = useState(false);

  // Selected Record Diff Drawer State
  const [selectedRecord, setSelectedRecord] = useState<EnterpriseAuditRecord | null>(null);

  // Integrity Check State
  const [verifying, setVerifying] = useState(false);
  const [integrityReport, setIntegrityReport] = useState<{
    isValid: boolean;
    checkedCount: number;
    errors: string[];
    headHash: string;
  } | null>(null);

  // Retention Policy Modal State
  const [showRetentionPolicy, setShowRetentionPolicy] = useState(false);

  // Legal Hold Modal State
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdTargetId, setHoldTargetId] = useState<string | null>(null);
  const [holdTargetState, setHoldTargetState] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [holdSubmitting, setHoldSubmitting] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let moduleFilter: string | undefined = undefined;
      let effectiveCategory: AuditCategory | 'ALL' = categoryFilter;

      if (activeView === 'EMPLOYEE') effectiveCategory = 'EMPLOYEE_ACTIVITY';
      else if (activeView === 'CUSTOMER') moduleFilter = 'CUSTOMERS';
      else if (activeView === 'ENQUIRY') moduleFilter = 'LEADS';
      else if (activeView === 'SITE_VISIT') moduleFilter = 'SITE_VISITS';
      else if (activeView === 'TECH_EVAL') moduleFilter = 'TECHNICAL_EVALUATION';
      else if (activeView === 'QUOTATION') moduleFilter = 'QUOTATIONS';
      else if (activeView === 'ORDER') moduleFilter = 'ORDERS';
      else if (activeView === 'INVOICE') moduleFilter = 'INVOICES';
      else if (activeView === 'DOCUMENT') moduleFilter = 'DOCUMENTS';
      else if (activeView === 'SECURITY') effectiveCategory = 'SECURITY_EVENT';
      else if (activeView === 'ADMIN') moduleFilter = 'SECURITY_CONTROLS';
      else if (activeView === 'SYSTEM') effectiveCategory = 'SYSTEM_EVENT';

      const res = await fetchEnterpriseAuditLogs({
        search: search.trim() || undefined,
        severity: severityFilter,
        category: effectiveCategory,
        module: moduleFilter,
        legal_hold_only: legalHoldOnly ? true : undefined,
      });

      setRecords(res.records);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Failed to load enterprise audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [activeView, severityFilter, categoryFilter, legalHoldOnly]);

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      const res = await verifyAuditIntegrityAction();
      setIntegrityReport(res);
    } catch (err: any) {
      alert(err.message || 'Integrity verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateCheckpoint = async () => {
    try {
      const cp = await createAuditCheckpointAction();
      alert(`Integrity Checkpoint created!\nBlock Height: #${cp.block_height}\nHead Hash: ${cp.head_hash.substring(0, 16)}...\nDigest: ${cp.signed_digest.substring(0, 16)}...`);
    } catch (err: any) {
      alert(err.message || 'Checkpoint creation failed');
    }
  };

  const handleToggleLegalHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdTargetId || holdReason.trim().length < 5) {
      alert('A valid business justification (minimum 5 characters) is required.');
      return;
    }

    setHoldSubmitting(true);
    try {
      const res = await toggleLegalHoldAction(holdTargetId, holdTargetState, holdReason);
      if (res.success) {
        setShowHoldModal(false);
        setHoldReason('');
        await loadLogs();
        if (selectedRecord && selectedRecord.event_id === holdTargetId) {
          setSelectedRecord({ ...selectedRecord, legal_hold: holdTargetState });
        }
      } else {
        alert(res.error || 'Failed to update legal hold');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating legal hold');
    } finally {
      setHoldSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Central Audit & Activity Centre
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Cryptographically Chained (SHA-256)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative, append-only enterprise audit trail across commercial transactions, employee workflows, and security events. 5-year retention enforced.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRetentionPolicy(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            5-Year Retention Policy
          </button>

          <button
            onClick={handleVerifyIntegrity}
            disabled={verifying}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Verifying...' : 'Verify Chain Integrity'}</span>
          </button>
        </div>
      </div>

      <SettingsNav />

      {/* Cryptographic Chain Integrity Banner */}
      {integrityReport && (
        <div
          className={`p-4 rounded-2xl border text-xs animate-in fade-in duration-200 flex items-start justify-between gap-3 ${
            integrityReport.isValid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-sm">
                {integrityReport.isValid
                  ? 'Cryptographic Ledger Verified • 0 Integrity Anomalies'
                  : 'Ledger Integrity Alert: Chain Break Detected!'}
              </div>
              <div className="text-[11px] font-mono text-emerald-800 space-x-2">
                <span>Verified Events: {integrityReport.checkedCount}</span>
                <span>&bull;</span>
                <span>Head Hash: {integrityReport.headHash.substring(0, 16)}...</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateCheckpoint}
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition text-[11px] cursor-pointer"
            >
              Sign Checkpoint
            </button>
            <button
              onClick={() => setIntegrityReport(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 13 History Views Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold scrollbar-thin">
        {AUDIT_VIEWS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap transition cursor-pointer border ${
                isActive
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
              placeholder="Search by action, employee, reason, record ID..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <button
            onClick={loadLogs}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 rounded-xl transition cursor-pointer"
          >
            Search
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="px-2.5 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Categories</option>
            <option value="BUSINESS_AUDIT">Business Audit</option>
            <option value="EMPLOYEE_ACTIVITY">Employee Activity</option>
            <option value="SECURITY_EVENT">Security Events</option>
            <option value="SYSTEM_EVENT">System Events</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="px-2.5 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="SECURITY">Security</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          {/* Legal Hold Toggle */}
          <button
            onClick={() => setLegalHoldOnly(!legalHoldOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border font-semibold transition cursor-pointer ${
              legalHoldOnly
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${legalHoldOnly ? 'text-amber-600 fill-amber-600' : ''}`} />
            <span>Legal Hold Only</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-3 px-4">Timestamp & Acting Identity</th>
                <th className="py-3 px-4">Category & Module</th>
                <th className="py-3 px-4">Action & Context</th>
                <th className="py-3 px-4">Severity & Outcome</th>
                <th className="py-3 px-4">Diff Snapshot</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                    <span>Loading cryptographic audit trail...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No audit records match the current filter criteria.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const hasDiff = r.diff && r.diff.length > 0;

                  return (
                    <tr
                      key={r.event_id}
                      onClick={() => setSelectedRecord(r)}
                      className="hover:bg-slate-50/70 transition cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{r.user_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {new Date(r.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.source_ip}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">{r.module}</span>
                        <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {r.category}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{r.action}</div>
                        <div className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                          {r.reason || r.related_context || `Record: ${r.record_id}`}
                        </div>
                        {r.legal_hold && (
                          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                            <Bookmark className="w-2.5 h-2.5 fill-amber-700 text-amber-700" />
                            Legal Hold Active
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              r.severity === 'CRITICAL'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : r.severity === 'SECURITY'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : r.severity === 'WARNING'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {r.severity}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.outcome === 'SUCCESS'
                                ? 'text-emerald-700'
                                : r.outcome === 'BLOCKED'
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {r.outcome}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {hasDiff ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            <Eye className="w-3 h-3 text-emerald-600" />
                            {r.diff?.length} Field Diff(s)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Immutable Event</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button className="text-brand-600 hover:text-brand-700 font-semibold text-[11px] flex items-center gap-1 ml-auto">
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD INSPECTION & DIFF DRAWER MODAL */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-brand-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Audit Event Details & Field Diff
                  </h3>
                  <div className="text-[10px] text-slate-400 font-mono">
                    ID: {selectedRecord.event_id}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Event Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold block">Actor Identity</span>
                  <span className="font-bold text-slate-900">{selectedRecord.user_name}</span>
                  <div className="text-[10px] text-slate-500">{selectedRecord.role}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold block">Timestamp (IST)</span>
                  <span className="font-mono font-bold text-slate-900 text-[11px]">
                    {new Date(selectedRecord.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </span>
                  <div className="text-[10px] text-slate-500">
                    {new Date(selectedRecord.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold block">Module & Category</span>
                  <span className="font-bold text-slate-900">{selectedRecord.module}</span>
                  <div className="text-[10px] text-slate-500">{selectedRecord.category}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold block">Client Context</span>
                  <span className="font-mono text-[11px] font-bold text-slate-900">{selectedRecord.source_ip}</span>
                  <div className="text-[10px] text-slate-500 truncate">{selectedRecord.device_browser}</div>
                </div>
              </div>

              {/* Justification / Reason */}
              {selectedRecord.reason && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
                  <span className="font-bold text-amber-900 block mb-0.5">Business Justification / Reason:</span>
                  <p className="text-amber-800">{selectedRecord.reason}</p>
                </div>
              )}

              {/* Cryptographic Hashes */}
              <div className="p-3 rounded-xl bg-slate-900 text-slate-300 font-mono text-[10px] space-y-1">
                <div className="text-slate-400 uppercase tracking-wider font-bold">Cryptographic Chain Chaining (SHA-256):</div>
                <div className="truncate">
                  <span className="text-slate-500">PREVIOUS: </span>{selectedRecord.previous_hash}
                </div>
                <div className="truncate text-emerald-400">
                  <span className="text-slate-500">INTEGRITY: </span>{selectedRecord.integrity_hash}
                </div>
              </div>

              {/* Before-and-After Structured Diff */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-brand-600" />
                    Structured Before-and-After Diff
                  </h4>
                  <span className="text-[10px] text-slate-500">Sensitive fields automatically [REDACTED]</span>
                </div>

                {selectedRecord.diff && selectedRecord.diff.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="py-2 px-3 w-1/3">Field</th>
                          <th className="py-2 px-3 w-1/3 text-rose-700 bg-rose-50/50">Previous Value</th>
                          <th className="py-2 px-3 w-1/3 text-emerald-700 bg-emerald-50/50">New Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {selectedRecord.diff.map((d) => (
                          <tr key={d.field}>
                            <td className="py-2 px-3 font-semibold text-slate-800">{d.field_label || d.field}</td>
                            <td className="py-2 px-3 bg-rose-50/30 text-rose-800 line-through">
                              {d.old_value !== null && d.old_value !== undefined ? String(d.old_value) : '<empty>'}
                            </td>
                            <td className="py-2 px-3 bg-emerald-50/30 text-emerald-800 font-bold">
                              {d.new_value !== null && d.new_value !== undefined ? String(d.new_value) : '<empty>'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-xs">
                    No field mutations recorded (standard system action or append-only event).
                  </div>
                )}
              </div>

              {/* Legal Hold Action Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  Retention Category: <span className="font-bold text-slate-800">{selectedRecord.retention_category}</span> (5-Year Minimum)
                </div>

                <button
                  onClick={() => {
                    setHoldTargetId(selectedRecord.event_id);
                    setHoldTargetState(!selectedRecord.legal_hold);
                    setShowHoldModal(true);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold transition text-xs flex items-center gap-1.5 cursor-pointer ${
                    selectedRecord.legal_hold
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{selectedRecord.legal_hold ? 'Release Legal Hold' : 'Apply Legal Hold'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEGAL HOLD CONFIRMATION MODAL */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {holdTargetState ? 'Place Under Legal Hold' : 'Release Legal Hold'}
                </h3>
              </div>
              <button onClick={() => setShowHoldModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleToggleLegalHold} className="p-5 space-y-4">
              <p className="text-slate-600 text-xs">
                {holdTargetState
                  ? 'Placing this record under legal hold strictly prevents any retention purge or archival deletion indefinitely.'
                  : 'Releasing legal hold will restore this record to standard 5-year retention lifecycle rules.'}
              </p>

              <div className="space-y-1">
                <label className="block font-bold text-slate-800">
                  Mandatory Business / Legal Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="Enter formal justification (min 5 characters)..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowHoldModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={holdSubmitting || holdReason.trim().length < 5}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {holdSubmitting ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5-YEAR RETENTION POLICY MODAL */}
      {showRetentionPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  ICON TECH PRO Enterprise 5-Year Data Retention & Backup Policy
                </h3>
              </div>
              <button onClick={() => setShowRetentionPolicy(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900">Corporate Compliance Standard</h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Under the ICON TECH PRO Commercial & Technical Operations Governance Directive, all business, financial, communication, and audit data are classified and preserved according to statutory periods:
                </p>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Data Classification</th>
                      <th className="py-2.5 px-3">Statutory Retention</th>
                      <th className="py-2.5 px-3">Purge Protection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Financial & Tax (Invoices, Ledgers)</td>
                      <td className="py-2.5 px-3 font-bold text-brand-600">8 Years</td>
                      <td className="py-2.5 px-3 text-slate-500">Statutory Tax Requirement</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Commercial & Sales (Quotations, Orders, Challans)</td>
                      <td className="py-2.5 px-3 font-bold text-brand-600">5 Years</td>
                      <td className="py-2.5 px-3 text-slate-500">Commercial Contract Integrity</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Customer Master Records</td>
                      <td className="py-2.5 px-3 font-bold text-brand-600">5 Years Post-Transaction</td>
                      <td className="py-2.5 px-3 text-slate-500">Preserved with Historical Orders</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Audit Ledger & Security Incidents</td>
                      <td className="py-2.5 px-3 font-bold text-brand-600">5 Years Minimum</td>
                      <td className="py-2.5 px-3 text-slate-500">Append-Only Immutability</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Communication & Email Logs</td>
                      <td className="py-2.5 px-3 font-bold text-brand-600">3 Years</td>
                      <td className="py-2.5 px-3 text-slate-500">Audit Trail Verification</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">System Logs & Automation Crons</td>
                      <td className="py-2.5 px-3 font-bold text-brand-600">1 Year</td>
                      <td className="py-2.5 px-3 text-slate-500">Rolling Operational Archive</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-800 block">Purge Protection & Dual Authorization</span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Automated purging is disabled by default across all production databases. Any manual purge requires explicit dual authorization from the Managing Director and Administrator, and cannot purge any records flagged under active Legal Hold.
                </p>
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setShowRetentionPolicy(false)}
                  className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                >
                  Close Policy Guide
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
