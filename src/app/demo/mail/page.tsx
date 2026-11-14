import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, ArrowLeft, ShieldAlert } from 'lucide-react';
import { UnifiedMailWorkspace } from '@/components/mail/UnifiedMailWorkspace';

export const metadata: Metadata = {
  title: 'Unified Mail Workspace Preview | ICON TECH PRO ERP V9.2',
  description: 'Interactive design preview of the unified Gmail & Zoho Mail workspace for ICON TECH PRO ERP',
};

export default function DemoMailPreviewPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Breadcrumb & UAT Indicator */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="text-slate-400 hover:text-white flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>ERP Dashboard</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-400">Design & Preview Lab</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="font-semibold text-indigo-400">Unified Mail (Gmail / Zoho)</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-amber-400 font-medium text-[11px] bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded">
            <ShieldAlert className="w-3 h-3" />
            <span>Interactive Preview Mode — Zero External API Calls</span>
          </div>
          <span className="text-slate-400 font-mono text-[11px]">UAT Port 3001</span>
        </div>
      </div>

      {/* Main Mail Workspace Area */}
      <div className="flex-1 p-2 sm:p-4 md:p-6 max-w-[1700px] w-full mx-auto">
        <UnifiedMailWorkspace isDemoMode={true} />
      </div>
    </div>
  );
}
