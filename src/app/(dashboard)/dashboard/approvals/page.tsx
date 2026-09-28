'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileCheck,
  Search,
  Filter,
  UserCheck,
  ArrowRight,
  Eye,
  Sliders,
  Check,
  X,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import {
  getApprovalRequests,
  getApprovalRules,
  processApprovalRequest,
} from '@/lib/actions/approvals';
import type {
  ApprovalRequest,
  ApprovalRuleConfig,
  ApprovalType,
  ApprovalRequestStatus,
} from '@/types/erp';

export default function ApprovalCenterPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [rules, setRules] = useState<ApprovalRuleConfig[]>([]);
  const [scope, setScope] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'MY_REQUESTS' | 'ALL'>('PENDING');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Detail / Decision Modal State
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqRes, ruleRes] = await Promise.all([
        getApprovalRequests({ scope }),
        getApprovalRules(),
      ]);
      setRequests(reqRes.requests || []);
      setRules(ruleRes || []);
    } catch (err) {
      console.error('Error loading approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [scope]);

  const handleProcess = async (decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES') => {
    if (!selectedRequest) return;
    setActionError(null);
    setSubmitting(true);
    try {
      const res = await processApprovalRequest(selectedRequest.id, decision, decisionNotes);
      if (res.success) {
        setSelectedRequest(null);
        setDecisionNotes('');
        await loadData();
      } else {
        setActionError(res.error || 'Failed to process approval');
      }
    } catch (err) {
      setActionError((err as Error).message || 'Action error');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = requests.filter((r) => {
    if (typeFilter !== 'ALL' && r.approval_type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchNum = r.request_number.toLowerCase().includes(q);
      const matchEntity = r.entity_number.toLowerCase().includes(q);
      const matchRequester = r.requested_by_name.toLowerCase().includes(q);
      const matchNotes = r.approval_notes && r.approval_notes.toLowerCase().includes(q);
      return matchNum || matchEntity || matchRequester || matchNotes;
    }
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            Commercial Approval Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Role-governed exception authorization with self-approval guards and audit trails
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {[
            { id: 'PENDING', label: 'Pending Queue' },
            { id: 'APPROVED', label: 'Approved' },
            { id: 'REJECTED', label: 'Rejected' },
            { id: 'MY_REQUESTS', label: 'My Requests' },
            { id: 'ALL', label: 'All History' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setScope(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                scope === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rules Banner */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-900">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Active Governance Thresholds:</strong> Sales Exec Discount &gt; 5% (BDM), BDM Discount &gt; 12% (MD),
            Gross Margin &lt; 15% (MD), PO Value &gt; ₹2,00,000 (MD).
          </span>
        </div>
        <div className="text-indigo-600 font-semibold flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Strict Self-Approval Prohibited
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search request #, entity, or requester..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs font-semibold text-slate-500">Filter Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Exception Types</option>
            <option value="DISCOUNT">Discount % Cap</option>
            <option value="MARGIN">Low Margin Trigger</option>
            <option value="PURCHASE_ORDER">High-Value PO</option>
            <option value="CREDIT_LIMIT">Credit Period Exception</option>
            <option value="CANCELLATION">Document Cancellation</option>
            <option value="SALES_ORDER_EXCEPTION">Sales Order Exception</option>
          </select>
        </div>
      </div>

      {/* Approvals Zero-Scroll Register */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Desktop Zero-Scroll Table */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left border-collapse text-xs table-fixed">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3">Request & Type</th>
                <th className="py-2.5 px-3">Linked Entity</th>
                <th className="py-2.5 px-3">Requester & Approver</th>
                <th className="py-2.5 px-3">Proposed vs Limit</th>
                <th className="py-2.5 px-3 text-right">Status & Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Loading approval queue...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No requests found for this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-mono text-xs font-bold text-slate-800">
                        {req.request_number}
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {req.approval_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono text-xs font-semibold text-slate-900">{req.entity_number}</div>
                      <div className="text-[11px] text-slate-500 capitalize">{req.entity_type}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-xs font-semibold text-slate-900 truncate">{req.requested_by_name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                        <UserCheck className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span>Requires: {req.required_approver_role}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs">
                      <div>
                        <span className="font-bold text-rose-600">{req.requested_value}%</span>
                        <span className="text-slate-400"> / Cap: {req.threshold_limit}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        {req.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Pending Review
                          </span>
                        )}
                        {req.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        )}
                        {req.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setSelectedRequest(req);
                            setDecisionNotes('');
                            setActionError(null);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
                        >
                          {req.status === 'PENDING' ? 'Review & Decide' : 'View Details'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Approval Cards */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs">Loading approval queue...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">No requests found for this filter.</div>
          ) : (
            filtered.map((req) => (
              <div key={req.id} className="p-4 space-y-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-xs text-slate-900">{req.request_number}</span>
                    <div className="text-[11px] text-indigo-700 font-semibold mt-0.5">
                      {req.approval_type.replace('_', ' ')}
                    </div>
                  </div>
                  {req.status === 'PENDING' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                  {req.status === 'APPROVED' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Approved
                    </span>
                  )}
                  {req.status === 'REJECTED' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      <XCircle className="w-3 h-3" />
                      Rejected
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Entity: <strong className="font-mono text-slate-900">{req.entity_number}</strong> ({req.entity_type})</span>
                    <span className="font-mono font-bold text-rose-600">{req.requested_value}% <span className="text-slate-400 font-normal">/ {req.threshold_limit}%</span></span>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                    <span>By: {req.requested_by_name}</span>
                    <span>Approver: {req.required_approver_role}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRequest(req);
                    setDecisionNotes('');
                    setActionError(null);
                  }}
                  className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{req.status === 'PENDING' ? 'Review & Decide' : 'View Details'}</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* DETAIL / DECISION MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                Approval Evaluation: {selectedRequest.request_number}
              </h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {actionError && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {actionError}
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">Entity Document</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedRequest.entity_number}</p>
                  <span className="text-xs text-slate-500 capitalize">{selectedRequest.entity_type}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">Requested Value vs Cap</span>
                  <p className="text-sm font-bold text-rose-600 mt-0.5">
                    {selectedRequest.requested_value}%{' '}
                    <span className="text-xs text-slate-500 font-normal">
                      (Cap: {selectedRequest.threshold_limit}%)
                    </span>
                  </p>
                  <span className="text-xs text-slate-500">{selectedRequest.approval_type}</span>
                </div>
              </div>

              {/* Requester & Approver */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested By:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedRequest.requested_by_name} ({selectedRequest.requested_by_role})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Minimum Approver Role:</span>
                  <span className="font-semibold text-indigo-700">{selectedRequest.required_approver_role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Self-Approval Rule:</span>
                  <span className="font-semibold text-emerald-700">Strictly Prohibited</span>
                </div>
              </div>

              {/* Justification Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Requester Justification</label>
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700">
                  {selectedRequest.approval_notes || 'No notes provided by requester.'}
                </div>
              </div>

              {/* Decision Section */}
              {selectedRequest.status === 'PENDING' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approver Audit Decision Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter decision rationale or conditions..."
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ) : (
                <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-700">
                  <p>
                    <strong>Decision Outcome:</strong> {selectedRequest.status} by {selectedRequest.approver_name || 'Approver'}
                  </p>
                  {selectedRequest.rejection_reason && (
                    <p className="text-rose-700 mt-1">
                      <strong>Rejection Reason:</strong> {selectedRequest.rejection_reason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {selectedRequest.status === 'PENDING' && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleProcess('REQUEST_CHANGES')}
                    className="px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                  >
                    Request Changes
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleProcess('REJECT')}
                    className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleProcess('APPROVE')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve Request
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
