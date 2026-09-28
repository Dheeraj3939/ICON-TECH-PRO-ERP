'use client';

import { useState } from 'react';
import {
  Settings2,
  Percent,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Save,
  Info,
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';

interface TierRule {
  role: string;
  limit: number;
  approver: string;
  description: string;
}

export default function DiscountRulesPage() {
  const [rules, setRules] = useState<TierRule[]>([
    {
      role: 'Sales Executive',
      limit: 5.0,
      approver: 'BDM (Vineet Babu)',
      description: 'Maximum self-approvable discount on line-items or quote header. Exceeding quotes route to BDM.',
    },
    {
      role: 'BDM',
      limit: 15.0,
      approver: 'Admin / BDM (Dheeraj)',
      description: 'Maximum discount approvable by Senior BDM. Exceeding quotes route to Admin / BDM.',
    },
    {
      role: 'Admin / BDM',
      limit: 25.0,
      approver: 'Managing Director (Borra Narsimulu)',
      description: 'Maximum discount approvable by Operations Head. Exceeding quotes route to Managing Director.',
    },
    {
      role: 'Managing Director',
      limit: 100.0,
      approver: 'None (Unrestricted Super Admin)',
      description: 'Final commercial override authority. Quotes below cost or high discount require MD sign-off.',
    },
  ]);

  const [savedSuccess, setSavedSuccess] = useState(false);

  function handleLimitChange(index: number, newLimit: number) {
    const updated = [...rules];
    updated[index].limit = newLimit;
    setRules(updated);
    setSavedSuccess(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    // In production, triggers Server Action to update `discount_approval_rules` in PostgreSQL
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
            <Settings2 className="w-4 h-4" />
            <span>ERP Admin Configuration</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Configurable Discount Approval Rules
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Govern quotation margin thresholds across all sales tiers. Changes take effect immediately without code deployment.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Thresholds Saved to Database</span>
          </div>
        )}
      </div>
      <SettingsNav />

      {/* Info Callout */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3 text-xs text-blue-900">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Automated Quotation Governance Architecture:</span>
          <p className="text-blue-800 leading-relaxed">
            When a salesperson drafts a quotation in Phase 6, the system evaluates the discount against these active thresholds. If the discount exceeds their authorized limit, the quotation is marked <span className="font-semibold">PENDING_APPROVAL</span> and routed to the designated superior role before a PDF can be sent to the customer.
          </p>
        </div>
      </div>

      {/* Threshold Configurator Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rules.map((rule, idx) => (
            <div
              key={rule.role}
              className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">{rule.role}</span>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                    rule.role === 'Managing Director'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-brand-50 text-brand-700 border border-brand-200/60'
                  }`}
                >
                  Tier {idx + 1}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600">
                  Maximum Discount Limit (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    disabled={rule.role === 'Managing Director'}
                    value={rule.limit}
                    onChange={(e) => handleLimitChange(idx, parseFloat(e.target.value) || 0)}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500 transition"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Escalation Approver:</span>
                  <span className="font-medium text-slate-900">{rule.approver}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {rule.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition duration-150"
          >
            <Save className="w-4 h-4" />
            <span>Update Approval Thresholds</span>
          </button>
        </div>
      </form>

      {/* Visual Workflow Diagram Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Discount Approval Escalation Ladder</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
            <div className="font-bold text-slate-800">0% to {rules[0].limit}%</div>
            <div className="text-[11px] text-emerald-600 font-semibold">Self-Approved</div>
            <div className="text-[10px] text-slate-500">Sales Executive</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
            <div className="font-bold text-slate-800">{rules[0].limit}% to {rules[1].limit}%</div>
            <div className="text-[11px] text-brand-600 font-semibold">BDM Approval</div>
            <div className="text-[10px] text-slate-500">Vineet Babu</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
            <div className="font-bold text-slate-800">{rules[1].limit}% to {rules[2].limit}%</div>
            <div className="text-[11px] text-amber-600 font-semibold">Admin Approval</div>
            <div className="text-[10px] text-slate-500">Dheeraj</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
            <div className="font-bold text-slate-800">&gt; {rules[2].limit}%</div>
            <div className="text-[11px] text-purple-700 font-semibold">MD Sign-Off</div>
            <div className="text-[10px] text-slate-500">Borra Narsimulu</div>
          </div>
        </div>
      </div>
    </div>
  );
}
