'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  KeyRound,
  Mail,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { requestPasswordReset } from '../login/actions';
import { ERP_SYSTEM_VERSION } from '@/lib/constants/version';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('email', trimmedEmail);

    const result = await requestPasswordReset(formData);
    setLoading(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setSuccessMessage(result.message);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-950 text-slate-100 font-sans selection:bg-brand-500 selection:text-white">
      <div className="w-full max-w-lg space-y-7 bg-slate-900/90 p-8 sm:p-10 rounded-3xl shadow-2xl border border-slate-800 backdrop-blur-xl">
        {/* Release Pill */}
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="tracking-wide font-semibold text-white">
              {ERP_SYSTEM_VERSION.brandWithVersion}
            </span>
          </div>
          <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 font-bold">
            {ERP_SYSTEM_VERSION.environment}
          </span>
        </div>

        {/* Header */}
        <div className="text-center space-y-2 flex flex-col items-center">
          <Link href="/" className="inline-block transition hover:opacity-90">
            <img
              src="/logo-dark.png"
              alt="ICON TECH PRO"
              className="h-14 sm:h-16 w-auto object-contain drop-shadow-lg"
            />
          </Link>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Reset Your Password
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
              Enter your registered ERP Login Email. If an active account matches, password reset instructions will be sent.
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-sm animate-in fade-in duration-200">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
            <div className="space-y-1">
              <span className="font-semibold block">Instructions Dispatched</span>
              <p className="text-xs text-emerald-400/90 leading-relaxed">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-sm animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
            <span className="text-xs">{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        {!successMessage ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
              >
                ERP Login Email *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Rate-limited to 3 requests per 15 minutes. Links expire after 24 hours.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-600/30 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Send Password Reset Instructions</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        )}

        {/* Links */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 font-semibold transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/privacy-policy" className="hover:text-slate-300 transition">
              Privacy Policy
            </Link>
            <span>&bull;</span>
            <Link href="/terms-of-service" className="hover:text-slate-300 transition">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
