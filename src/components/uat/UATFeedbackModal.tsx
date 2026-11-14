'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Bug,
  Sparkles,
  ShieldAlert,
  Zap,
  Database,
  GraduationCap,
  Upload,
} from 'lucide-react';

export interface UATFeedbackItem {
  id: string;
  createdAt: string;
  module: string;
  page: string;
  issueType: 'BUG' | 'UX' | 'FEATURE' | 'SECURITY' | 'PERFORMANCE' | 'DATA' | 'TRAINING';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  expectedBehavior: string;
  actualBehavior: string;
  evidenceNotes?: string;
  reviewerName: string;
  reviewerRole: string;
}

const STORAGE_KEY = 'itp_uat_feedback_register_v92';

export function getStoredFeedback(): UATFeedbackItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFeedbackItem(item: UATFeedbackItem) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredFeedback();
    const updated = [item, ...existing];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save feedback item:', e);
  }
}

interface UATFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: {
    name: string;
    role: string;
  };
}

export function UATFeedbackModal({ isOpen, onClose, currentUser }: UATFeedbackModalProps) {
  const [module, setModule] = useState('QUOTATIONS');
  const [page, setPage] = useState('');
  const [issueType, setIssueType] = useState<UATFeedbackItem['issueType']>('UX');
  const [priority, setPriority] = useState<UATFeedbackItem['priority']>('MEDIUM');
  const [description, setDescription] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      setPage(window.location.pathname);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;

    const newItem: UATFeedbackItem = {
      id: `FB-${Date.now()}`,
      createdAt: new Date().toISOString(),
      module,
      page: page || window.location.pathname,
      issueType,
      priority,
      description: description.trim(),
      expectedBehavior: expectedBehavior.trim(),
      actualBehavior: actualBehavior.trim(),
      evidenceNotes: evidenceNotes.trim(),
      reviewerName: currentUser?.name || 'Authorized Reviewer',
      reviewerRole: currentUser?.role || 'Human UAT',
    };

    saveFeedbackItem(newItem);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Report UAT Issue / Suggestion</h2>
              <p className="text-[11px] text-slate-400">
                Logged as: <strong className="text-white">{currentUser?.name || 'Reviewer'}</strong> ({currentUser?.role || 'UAT'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Feedback recorded successfully in UAT Register!</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Module
              </label>
              <select
                value={module}
                onChange={(e) => setModule(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="DASHBOARD">Executive Dashboard</option>
                <option value="CUSTOMERS">Customers & CRM 360</option>
                <option value="ENQUIRIES">Enquiries & Prospecting</option>
                <option value="SITE_VISITS">Site Visits</option>
                <option value="QUOTATIONS">Quotation Builder / CPQ</option>
                <option value="ORDERS">Sales Orders</option>
                <option value="INVOICES">Invoices & Billing</option>
                <option value="PAYMENTS">Payments & Collections</option>
                <option value="INVENTORY">Inventory & Stock</option>
                <option value="PURCHASES">Purchases & Sourcing</option>
                <option value="DISPATCH">Dispatch & Delivery</option>
                <option value="SERVICE_AMC">Service & AMC</option>
                <option value="HR_EMPLOYEES">HR & Employees</option>
                <option value="COMMUNICATION">Gmail & Telephony</option>
                <option value="REPORTS">Reports & BI</option>
                <option value="SETTINGS">Settings & Security</option>
                <option value="AUDIT">Audit Logs</option>
                <option value="GENERAL">General Platform / Navigation</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Active Page URL
              </label>
              <input
                type="text"
                value={page}
                onChange={(e) => setPage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="/dashboard/..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Issue Type
              </label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="BUG">BUG — Functional Defect / Error</option>
                <option value="UX">UX — Ergonomics / Visual Alignment</option>
                <option value="FEATURE">FEATURE — Workflow Enhancement</option>
                <option value="SECURITY">SECURITY — Permission / RBAC Barrier</option>
                <option value="PERFORMANCE">PERFORMANCE — Latency / Slow Load</option>
                <option value="DATA">DATA — Data Inconsistency / Calculation</option>
                <option value="TRAINING">TRAINING — Operational Question</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="CRITICAL">CRITICAL — Blocks Business Operations</option>
                <option value="HIGH">HIGH — Severe Impact / Incorrect Calculation</option>
                <option value="MEDIUM">MEDIUM — Minor Impairment / Workaround Exists</option>
                <option value="LOW">LOW — Cosmetic / Minor Polish</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Issue / Observation Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Clearly state what happened..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Expected Behavior
              </label>
              <textarea
                rows={2}
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                placeholder="What should happen..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Actual Behavior
              </label>
              <textarea
                rows={2}
                value={actualBehavior}
                onChange={(e) => setActualBehavior(e.target.value)}
                placeholder="What actually occurred..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Screenshot / Evidence Notes
            </label>
            <input
              type="text"
              value={evidenceNotes}
              onChange={(e) => setEvidenceNotes(e.target.value)}
              placeholder="e.g. Screenshot taken, row #3 in customer table, or steps to reproduce"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Saved locally to your browser UAT Feedback Register.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition shadow-sm"
              >
                Record Feedback
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
