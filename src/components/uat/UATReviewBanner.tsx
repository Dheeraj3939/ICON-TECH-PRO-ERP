'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { UATFeedbackModal } from './UATFeedbackModal';

interface UATReviewBannerProps {
  user: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
}

export function UATReviewBanner({ user }: UATReviewBannerProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <div className="w-full bg-slate-900 border-b border-slate-800 text-white px-4 py-1.5 text-xs flex items-center justify-between gap-3 select-none">
        {/* Left: Compact UAT Status & Active Signed-In User */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded font-bold tracking-wide text-[10px] uppercase flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            UAT Environment
          </span>

          <div className="flex items-center gap-1.5 text-slate-200 truncate">
            <span className="font-semibold text-white truncate">{user.name}</span>
            <span className="text-slate-400 shrink-0">&bull; {user.role}</span>
          </div>
        </div>

        {/* Right: Team Review Issue Logger */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="px-2.5 py-1 rounded-md bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 transition text-[11px] cursor-pointer"
            title="Log UI, workflow, or data feedback during UAT review"
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Report Issue</span>
          </button>
        </div>
      </div>

      <UATFeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        currentUser={{ name: user.name, role: user.role }}
      />
    </>
  );
}
