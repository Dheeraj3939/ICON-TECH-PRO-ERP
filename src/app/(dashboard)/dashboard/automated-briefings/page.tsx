'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Mail,
  MessageSquare,
  Sparkles,
  Shield,
  FileText,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Send,
  Sliders,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { generateDailyBriefing } from '@/lib/ai/daily-briefing';
import type { AIDailyBriefing } from '@/types/erp';

export default function AutomatedBriefingsPage() {
  const [briefing, setBriefing] = useState<AIDailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'>('DAILY');
  const [deliveryChannel, setDeliveryChannel] = useState<'ERP' | 'EMAIL' | 'WHATSAPP'>('ERP');
  const [refreshing, setRefreshing] = useState(false);

  const loadBriefing = async () => {
    setLoading(true);
    try {
      const res = await generateDailyBriefing();
      if (res.success && res.data) {
        setBriefing(res.data);
      }
    } catch (err) {
      console.error('Failed to generate automated briefing:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBriefing();
  }, []);

  const handleTriggerBriefing = async () => {
    setRefreshing(true);
    try {
      const res = await generateDailyBriefing();
      if (res.success && res.data) {
        setBriefing(res.data);
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 border border-brand-800/40 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-brand-600/20 border border-brand-500/30 text-brand-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white tracking-tight">
                Automated Briefing & Scheduled Intelligence
              </h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                Active Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Automated executive briefings classified strictly into [FACT], [CALCULATION], and [RECOMMENDATION]
            </p>
          </div>
        </div>

        <button
          onClick={handleTriggerBriefing}
          disabled={refreshing || loading}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition shadow-md self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Generate Briefing Now</span>
        </button>
      </div>

      {/* Schedule & Delivery Preferences Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg text-xs">
        {/* Frequency Tabs */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Scheduled Cadence:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const).map((freq) => (
              <button
                key={freq}
                onClick={() => setFrequency(freq)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  frequency === freq
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {freq}
              </button>
            ))}
          </div>
        </div>

        {/* Delivery Channels */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Delivery Channel:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDeliveryChannel('ERP')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition ${
                deliveryChannel === 'ERP'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>In-App ERP</span>
            </button>
            <button
              onClick={() => setDeliveryChannel('EMAIL')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition ${
                deliveryChannel === 'EMAIL'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Corporate Email</span>
            </button>
            <button
              onClick={() => setDeliveryChannel('WHATSAPP')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition ${
                deliveryChannel === 'WHATSAPP'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp (Requires Provider)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Financial Radar Tiles */}
      {briefing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
            <div className="text-[11px] font-medium text-slate-400 uppercase">Today's Invoiced Revenue</div>
            <div className="text-xl font-black text-white mt-1 font-mono">
              ₹{briefing.sales.today.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Fully GST compliant
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
            <div className="text-[11px] font-medium text-slate-400 uppercase">Cash Collected Today</div>
            <div className="text-xl font-black text-emerald-400 mt-1 font-mono">
              ₹{briefing.collections.received_today.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Realized bank remittances</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
            <div className="text-[11px] font-medium text-slate-400 uppercase">Expected Pipeline Value</div>
            <div className="text-xl font-black text-brand-400 mt-1 font-mono">
              ₹{briefing.pipeline.expected_value.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-brand-300 mt-1">Active client quotations</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
            <div className="text-[11px] font-medium text-slate-400 uppercase">Overdue Balance Risk</div>
            <div className="text-xl font-black text-amber-400 mt-1 font-mono">
              ₹{briefing.collections.overdue_amount.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-amber-300 mt-1">Overdue &gt;30 days aging</div>
          </div>
        </div>
      )}

      {/* Attention Items Classified into [FACT], [CALCULATION], [RECOMMENDATION] */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-400" />
            <h2 className="text-sm font-bold text-white">Executive Attention Items (Strict Classification)</h2>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {briefing?.attention_items.length || 0} items evaluated
          </span>
        </div>

        <div className="space-y-3">
          {briefing?.attention_items.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                      item.statement_type === 'FACT'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : item.statement_type === 'CALCULATION'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    [{item.statement_type}]
                  </span>
                  <span className="font-bold text-white">{item.title}</span>
                </div>
              </div>

              {item.link_url && (
                <a
                  href={item.link_url}
                  className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-brand-600 text-slate-200 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition shrink-0 self-start sm:self-auto"
                >
                  <span>Resolve in Ledger</span>
                  <ArrowRight className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}

          {(!briefing || briefing.attention_items.length === 0) && (
            <div className="text-center py-6 text-slate-500 text-xs">
              No critical executive attention items detected. Operational ledgers are within nominal bounds.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
