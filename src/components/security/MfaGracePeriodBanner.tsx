'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck, ArrowRight, X, Clock, Shield } from 'lucide-react';
import type { MfaPolicyStatus } from '@/types/security';

export function MfaGracePeriodBanner({ policy }: { policy: MfaPolicyStatus }) {
  const [dismissed, setDismissed] = useState(true); // default true to avoid hydration flicker

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDismissed = sessionStorage.getItem('mfa_banner_dismissed') === 'true';
      setDismissed(isDismissed);
    }
  }, []);

  // If already compliant, do not show banner
  if (policy.mfaEnabled || policy.policyStatus === 'COMPLIANT' || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('mfa_banner_dismissed', 'true');
    }
  };

  const isGrace = policy.policyStatus === 'IN_GRACE_PERIOD';
  const isExpired = policy.policyStatus === 'EXPIRED_GRACE_ACTION_REQUIRED';
  const isMandatory = policy.policyStatus === 'ENFORCED_MANDATORY';

  return (
    <div
      className={`w-full px-4 py-2 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-medium transition-all ${
        isGrace
          ? 'bg-amber-500/10 border-b border-amber-500/20 text-amber-900'
          : 'bg-slate-900 text-slate-100 border-b border-slate-800'
      }`}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {isGrace ? (
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
        ) : (
          <Shield className="w-4 h-4 text-blue-400 shrink-0" />
        )}
        <div className="truncate">
          {isGrace && (
            <span>
              <strong>MFA Enrollment Window:</strong> You have{' '}
              <span className="font-bold underline decoration-amber-400">
                {policy.daysRemainingInGrace} day(s) remaining
              </span>{' '}
              to configure Two-Factor Authentication for your account.
            </span>
          )}
          {isExpired && (
            <span>
              <strong>MFA Recommended:</strong> Enhanced authentication recommended for your operational profile.
            </span>
          )}
          {isMandatory && (
            <span>
              <strong>Administrator Security:</strong> Multi-Factor Authentication is recommended for role (
              {policy.role}).
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/dashboard/settings/security"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold shadow-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          <span>Configure 2FA</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className="text-slate-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
          title="Dismiss for this session"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
