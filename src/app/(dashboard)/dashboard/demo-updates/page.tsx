import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Layers,
  ArrowRight,
  Shield,
  Activity,
  Zap,
} from 'lucide-react';
import { getDemoFeatures } from '@/lib/actions/demo-registry';
import { DemoUpdatesClient } from './DemoUpdatesClient';
import { ERP_SYSTEM_VERSION } from '@/lib/constants/version';

export const metadata = {
  title: 'Demo Updates & Current Changes | ICON TECH PRO ERP',
};

export default async function DemoUpdatesPage() {
  const features = await getDemoFeatures();

  return (
    <div className="space-y-6">
      {/* Top Banner with Clear Local Demo / Testing Mode Demarcation */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 border border-indigo-800/50 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400 text-slate-950">
                LOCAL DEMO / TESTING MODE
              </span>
              <span className="text-slate-400 text-xs font-semibold">&bull;</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                Release Baseline {ERP_SYSTEM_VERSION.versionLabel} Enterprise Release
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Current Build Updates & Feature Registry
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Automated dynamic registry tracking all completed Day 1 through Day 7 implementations.
              Click any feature below to test the live workflow directly in the demonstration environment.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-white/10 hover:bg-white/20 rounded-xl transition cursor-pointer"
            >
              <span>Back to Executive Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Interactive Filter & Feature Grid Client */}
      <DemoUpdatesClient initialFeatures={features} />
    </div>
  );
}
