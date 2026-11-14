'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  Lock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowRight,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';
import { ERP_SYSTEM_VERSION } from '@/lib/constants/version';
import {
  verifyPasswordActionToken,
  completeAccountPasswordSetup,
} from '@/lib/actions/users';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get('token') || '';
  const type = searchParams.get('type') || 'reset';
  const isInvite = type === 'invite';

  const [email, setEmail] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState<boolean>(true);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (success) return;
    if (!token) {
      setTokenValid(false);
      setTokenError('Missing security token in URL. Please use the link provided in your email.');
      setLoadingToken(false);
      return;
    }

    verifyPasswordActionToken(token).then((res) => {
      setLoadingToken(false);
      if (res.valid && res.email) {
        setTokenValid(true);
        setEmail(res.email);
      } else {
        setTokenValid(false);
        setTokenError(res.error || 'This security link is invalid or has expired.');
      }
    });
  }, [token, success]);

  // Real-time password rules
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid =
    hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !token) return;

    setSubmitting(true);
    setSubmitError(null);

    const res = await completeAccountPasswordSetup({ token, password });
    setSubmitting(false);

    if (res.success) {
      setSuccess(true);
      setTimeout(() => {
        router.push('/login?reset=success');
      }, 2000);
    } else {
      setSubmitError(res.error || 'Failed to update password. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 bg-slate-900 text-slate-100">
      <div className="w-full max-w-lg space-y-7 bg-slate-800/90 p-8 sm:p-10 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-xl">
        {/* Release Pill */}
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="tracking-wide font-semibold text-white">
              {ERP_SYSTEM_VERSION.brandWithVersion}
            </span>
          </div>
          <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 font-bold">
            {isInvite ? 'ACCOUNT ACTIVATION' : 'PASSWORD RECOVERY'}
          </span>
        </div>

        {/* Title & Branding */}
        <div className="text-center space-y-2 flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-1">
            {isInvite ? <UserCheck className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
          </div>
          <h2 className="text-lg font-black text-white tracking-tight">
            {isInvite ? 'Activate Employee Account' : 'Set New Account Password'}
          </h2>
          <p className="text-xs text-slate-400 max-w-sm">
            {isInvite
              ? 'Welcome to ICON TECH PRO. Please create your confidential password to activate access.'
              : 'Enter a strong, secure password for your authorized corporate account.'}
          </p>
        </div>

        {/* Loading Token Check */}
        {loadingToken && (
          <div className="p-6 text-center space-y-2">
            <span className="inline-block w-6 h-6 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Verifying security token...</p>
          </div>
        )}

        {/* Token Error State */}
        {!loadingToken && !tokenValid && !success && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-bold text-sm">Security Token Invalid or Expired</p>
                <p className="mt-1">{tokenError}</p>
                {tokenError?.toLowerCase().includes('consumed') ? (
                  <p className="mt-2 text-emerald-300 font-medium">
                    ✓ If you just finished setting or changing your password, your new password has already been saved successfully in the database. You can proceed directly to sign in!
                  </p>
                ) : (
                  <p className="mt-2 text-slate-400">
                    For assistance, please contact your system administrator or Managing Director to dispatch a new activation link.
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <span>{tokenError?.toLowerCase().includes('consumed') ? 'Proceed to Sign In' : 'Return to Login'}</span>
            </Link>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
              <div>
                <p className="font-bold text-sm">
                  {isInvite ? 'Account Activated Successfully!' : 'Password Reset Complete!'}
                </p>
                <p className="mt-1">
                  Your new password has been securely stored and your account is now fully active.
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-600/30 transition"
            >
              <span>Proceed to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Password Form */}
        {!loadingToken && tokenValid && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {submitError && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{submitError}</span>
              </div>
            )}

            {email && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">
                  Target Account Identity
                </label>
                <input
                  type="text"
                  disabled
                  value={email}
                  className="w-full px-4 py-2 bg-slate-900/40 border border-slate-700/50 rounded-xl text-xs text-slate-400 font-mono"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">
                New Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter strong password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">
                Confirm New Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                />
              </div>
            </div>

            {/* Complexity Validation Checklist */}
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5 text-[11px]">
              <span className="font-bold text-slate-300 block mb-1">
                Enterprise Password Security Standards:
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-slate-400">
                <span className={hasMinLength ? 'text-emerald-400 font-semibold' : ''}>
                  {hasMinLength ? '✓' : '•'} 8+ characters
                </span>
                <span className={hasUpper ? 'text-emerald-400 font-semibold' : ''}>
                  {hasUpper ? '✓' : '•'} Uppercase (A-Z)
                </span>
                <span className={hasLower ? 'text-emerald-400 font-semibold' : ''}>
                  {hasLower ? '✓' : '•'} Lowercase (a-z)
                </span>
                <span className={hasNumber ? 'text-emerald-400 font-semibold' : ''}>
                  {hasNumber ? '✓' : '•'} Numeric (0-9)
                </span>
                <span className={hasSpecial ? 'text-emerald-400 font-semibold' : ''}>
                  {hasSpecial ? '✓' : '•'} Special (!@#$...)
                </span>
                <span className={passwordsMatch ? 'text-emerald-400 font-semibold' : ''}>
                  {passwordsMatch ? '✓' : '•'} Passwords match
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !isFormValid}
              className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>
                    {isInvite ? 'Activate Account & Set Password' : 'Save New Password'}
                  </span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Security Footer */}
        <div className="pt-2 border-t border-slate-700/60 text-center space-y-1 text-slate-400 text-xs">
          <p>Confidential Authentication System &bull; ICON TECH PRO</p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400">
          <span className="inline-block w-6 h-6 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
