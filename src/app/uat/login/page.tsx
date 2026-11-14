'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { switchUATUserSession } from '@/app/uat/actions';
import { LEGITIMATE_UAT_USERS } from '@/lib/uat/uat-users';
import {
  Lock,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Server,
  Zap,
} from 'lucide-react';

function UATLoginForm() {
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleQuickLaunch(userEmail: string) {
    setSwitchingEmail(userEmail);
    setError(null);
    try {
      const res = await switchUATUserSession(userEmail);
      if (res.success) {
        window.location.href = '/dashboard';
      } else {
        setError(res.error || 'Failed to establish UAT user session.');
        setSwitchingEmail(null);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while switching UAT session.');
      setSwitchingEmail(null);
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-6 bg-slate-900/95 p-8 sm:p-10 rounded-2xl shadow-2xl border border-slate-800 backdrop-blur-xl">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <Link
          href="/uat"
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to UAT Hub</span>
        </Link>

        <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-400/30 font-bold">
          PORT 3001 ONLY
        </span>
      </div>

      {/* Prominent Mandatory UAT Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-950/70 border border-blue-500/40 text-blue-200 text-xs font-medium">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="font-bold tracking-wide">UAT TEST USER SESSION — PORT 3001</span>
        </div>
        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Port 3000: Protected
        </span>
      </div>

      {/* Header Branding */}
      <div className="text-center space-y-1.5">
        <h1 className="text-xl font-black text-white tracking-tight">
          ICON TECH PRO ERP V9.2 — Role-by-Role Human UAT
        </h1>
        <p className="text-xs text-slate-400">
          Controlled User Session Switcher • Select any of the 6 official users below to instantly establish their legitimate session and enter their ERP experience. No password required for today&apos;s UAT.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 6 Legitimate UAT User Cards (1-Click Direct Launch) */}
      <div className="space-y-3">
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Select Legitimate Test User (6 Roles)</span>
          <span className="text-emerald-400 font-normal">Real RBAC Enforced</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LEGITIMATE_UAT_USERS.map((u) => {
            const isLoading = switchingEmail === u.email;
            return (
              <button
                key={u.email}
                type="button"
                disabled={switchingEmail !== null}
                onClick={() => handleQuickLaunch(u.email)}
                className={`p-4 rounded-xl border text-left transition cursor-pointer relative group flex flex-col justify-between ${
                  isLoading
                    ? 'bg-blue-600/30 border-blue-400 shadow-lg ring-2 ring-blue-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-blue-500/70 hover:bg-slate-800/60 text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-extrabold text-sm text-white group-hover:text-blue-300 transition">
                      {u.name}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300">
                      {u.role}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mb-1">{u.email}</div>
                  <div className="text-[10px] text-slate-500">{u.department}</div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-blue-400 font-semibold group-hover:underline flex items-center gap-1">
                    {isLoading ? (
                      <>
                        <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Establishing Session...</span>
                      </>
                    ) : (
                      <>
                        <span>Launch ERP Experience</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">1-Click</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-center pt-3 border-t border-slate-800">
        <p className="text-[11px] text-slate-500">
          UAT Test User Session • Available strictly on Port 3001 • Production authentication on Port 3000 remains untouched.
        </p>
      </div>
    </div>
  );
}

export default function UATLoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-600 selection:text-white">
      <Suspense fallback={<div className="text-xs text-slate-400">Loading UAT Sign-In Portal...</div>}>
        <UATLoginForm />
      </Suspense>
    </div>
  );
}
