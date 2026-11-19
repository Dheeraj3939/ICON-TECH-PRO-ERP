'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, ShieldCheck, LogOut, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { logout } from '@/app/(auth)/login/actions';
import { ERP_SYSTEM_VERSION } from '@/lib/constants/version';

interface SessionIdleLockProps {
  userName: string;
  userRole: string;
  userEmail: string;
  idleTimeoutMinutes?: number;
  warningMinutes?: number;
}

export function SessionIdleLock({
  userName,
  userRole,
  userEmail,
  idleTimeoutMinutes = 30, // 30-minute idle lock (Choice C)
  warningMinutes = 28,     // Warning at 28 minutes (2-minute countdown)
}: SessionIdleLockProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const lastActivityRef = useRef<number>(Date.now());
  const idleTimeoutMs = idleTimeoutMinutes * 60 * 1000;
  const warningTimeoutMs = warningMinutes * 60 * 1000;

  const resetActivity = useCallback(() => {
    // Only update activity if screen is not currently locked
    if (!isLocked) {
      lastActivityRef.current = Date.now();
      if (showWarning) {
        setShowWarning(false);
      }
    }
  }, [isLocked, showWarning]);

  // Check persistent lock state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const persistedLock = sessionStorage.getItem('erp_session_screen_locked');
      if (persistedLock === 'true') {
        setIsLocked(true);
      }
    }
  }, []);

  // Activity listeners (mouse, keyboard, touch, scroll)
  useEffect(() => {
    if (isLocked) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    let throttleTimeout: NodeJS.Timeout | null = null;

    const handleUserActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          resetActivity();
          throttleTimeout = null;
        }, 1000); // Throttled to 1s to protect performance
      }
    };

    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Periodic idle checker every 5 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      if (elapsed >= idleTimeoutMs) {
        setIsLocked(true);
        setShowWarning(false);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('erp_session_screen_locked', 'true');
        }
      } else if (elapsed >= warningTimeoutMs) {
        setShowWarning(true);
        const rem = Math.max(0, Math.round((idleTimeoutMs - elapsed) / 1000));
        setSecondsRemaining(rem);
      } else {
        setShowWarning(false);
      }
    }, 5000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      clearInterval(interval);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [isLocked, idleTimeoutMs, warningTimeoutMs, resetActivity]);

  const handleUnlock = () => {
    setIsUnlocking(true);
    setTimeout(() => {
      lastActivityRef.current = Date.now();
      setIsLocked(false);
      setShowWarning(false);
      setIsUnlocking(false);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('erp_session_screen_locked');
      }
    }, 400);
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('erp_session_screen_locked');
    }
    try {
      await logout();
    } catch {
      window.location.href = '/login';
    }
  };

  return (
    <>
      {/* 2-Minute Inactivity Warning Floating Banner */}
      {showWarning && !isLocked && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-4 rounded-2xl bg-amber-950/90 border border-amber-600/60 shadow-2xl backdrop-blur-lg text-amber-100 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <Clock className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Inactivity Security Lock
                </span>
              </div>
              <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                Your session will lock in <strong className="text-white font-mono">{secondsRemaining}s</strong> to protect commercial records.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetActivity}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Keep Working
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Choice C: Full-Screen 30-Minute Idle Lock Overlay */}
      {isLocked && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-300"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-center text-slate-100">
            {/* Lock Icon & Branding */}
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-slate-900 flex items-center justify-center">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  {ERP_SYSTEM_VERSION.versionLabel} • ZERO TRUST
                </span>
                <h2 className="text-lg font-black text-white mt-2 tracking-tight">
                  Session Locked for Security
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Screen locked due to 30 minutes of inactivity to protect sensitive financial ledgers and customer data.
                </p>
              </div>
            </div>

            {/* Active User Summary */}
            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-left">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Active Operator
                </span>
                <span className="text-xs font-bold text-white truncate block">
                  {userName}
                </span>
                <span className="text-[11px] text-slate-400 truncate block">
                  {userEmail}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold shrink-0">
                {userRole}
              </span>
            </div>

            {/* Unlock & Exit Actions */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleUnlock}
                disabled={isUnlocking}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUnlocking ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Unlock &amp; Resume Working</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700/80 text-rose-300 hover:text-rose-200 text-xs font-semibold rounded-xl border border-slate-700/60 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Sign Out / Switch Account</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-400 font-mono">
              Unsaved work in your open tab is preserved safely.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
