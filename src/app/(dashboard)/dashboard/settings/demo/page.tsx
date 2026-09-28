'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  RefreshCw,
  Layers,
  Database,
  Building2,
} from 'lucide-react';
import { getDemoModeStatus, toggleDemoMode } from '@/lib/actions/demo-mode';
import { ERP_SYSTEM_VERSION } from '@/lib/constants/version';

export default function DemoSettingsPage() {
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getDemoModeStatus()
      .then((res) => setIsActive(res.isActive))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    setUpdating(true);
    setMessage(null);
    try {
      const res = await toggleDemoMode(!isActive);
      if (res.success) {
        setIsActive(!isActive);
        setMessage(
          !isActive
            ? 'Demo / Training Mode is now ACTIVE. The presenter quick-dock is enabled.'
            : 'Demo / Training Mode is now DEACTIVATED. The ERP is operating in clean Production Mode.'
        );
      } else {
        setMessage(res.error || 'Failed to update mode.');
      }
    } catch (err: any) {
      setMessage(err?.message || 'Error toggling demo mode.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/dashboard" className="hover:text-brand-600 transition font-medium">
          Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <Link href="/dashboard/settings" className="hover:text-brand-600 transition font-medium">
          Settings
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-bold text-slate-900">Demo & Training Mode</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Demo & Training Mode Governance</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {ERP_SYSTEM_VERSION.versionLabel}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Isolate sample training scenarios from real commercial production data.
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Settings</span>
        </Link>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Main Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                isActive
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {isActive ? <Sparkles className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {isActive ? 'Training & Demo Mode Active' : 'Production Mode Active'}
                </h3>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    isActive
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {isActive ? 'Demo Mode' : 'Clean Production'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                {isActive
                  ? 'The live demonstration quick-dock and sample touchpoints are currently visible across dashboard views. Authorized for staff training.'
                  : 'Normal daily production mode. Demo docks, canonical chain banners, and sample records are strictly hidden from all users.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            disabled={loading || updating}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 ${
              isActive
                ? 'bg-slate-900 hover:bg-slate-800 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {updating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isActive ? (
              <ToggleRight className="w-4 h-4 text-amber-400" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
            <span>{isActive ? 'Switch to Production Mode' : 'Enable Training Mode'}</span>
          </button>
        </div>

        {/* Operational Safety Rules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              <span>Production Invariants</span>
            </h4>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
              <li>Production users never see demo banners or sample IDs.</li>
              <li>Live customer metrics calculate solely from genuine orders.</li>
              <li>Financial reports exclude sample quotations and invoices.</li>
              <li>Organization is strictly locked to <strong>ICON TECH PRO (ORG-ICON-01)</strong>.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Auditing & Governance</span>
            </h4>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
              <li>Mode switches are cryptographically logged to the audit ledger.</li>
              <li>Only Managing Director and Admin / BDM may toggle this setting.</li>
              <li>Automatic session timeout resets training view after 24 hours.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
