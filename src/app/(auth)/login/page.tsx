'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getLoginUiConfig, getQuickLoginOptions, login, quickLoginAsRole, requestPasswordReset, verifyMfaLoginAction } from './actions';
import { Shield, Lock, Mail, AlertCircle, Building2, UserCheck, ArrowRight, KeyRound, CheckCircle2, ArrowLeft, Smartphone, ShieldCheck } from 'lucide-react';
import { ERP_SYSTEM_VERSION } from '@/lib/constants/version';
type QuickRoleOption = { name: string; role: string; dept: string; badge: string };

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);
  const [quickLoadingRole, setQuickLoadingRole] = useState<string | null>(null);
  const [quickRoles, setQuickRoles] = useState<QuickRoleOption[]>([]);

  // MFA Challenge State
  const [isMfaMode, setIsMfaMode] = useState(false);
  const [mfaTempToken, setMfaTempToken] = useState('');
  const [mfaUser, setMfaUser] = useState<any>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [resetSuccessBanner, setResetSuccessBanner] = useState(false);
  const [loginSubtitle, setLoginSubtitle] = useState(
    'ICON TECH PRO Operations & Commercial ERP • Hyderabad'
  );
  const [emailPlaceholder, setEmailPlaceholder] = useState(
    'username@icontechpro.in'
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reset') === 'success') {
        setResetSuccessBanner(true);
      }
    }

    Promise.all([getQuickLoginOptions(), getLoginUiConfig()])
      .then(([options, ui]) => {
        setQuickRoles(options as QuickRoleOption[]);
        if (ui.subtitle) setLoginSubtitle(ui.subtitle);
        if (ui.emailPlaceholder) setEmailPlaceholder(ui.emailPlaceholder);
      })
      .catch(() => setQuickRoles([]));
  }, []);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const result = await login(formData);
    if (result && (result as any).mfaRequired) {
      setIsMfaMode(true);
      setMfaTempToken((result as any).tempToken);
      setMfaUser((result as any).user);
      setLoading(false);
      return;
    }
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMfaLoading(true);
    setMfaError(null);
    try {
      const res = await verifyMfaLoginAction(mfaTempToken, mfaCode, mfaUser);
      if (res && !res.success && res.error) {
        setMfaError(res.error);
        setMfaLoading(false);
      }
    } catch (err: any) {
      if (err?.message?.includes('NEXT_REDIRECT') || err?.digest?.includes('NEXT_REDIRECT')) {
        window.location.href = '/dashboard';
        return;
      }
      setMfaError(err?.message || 'MFA verification failed');
      setMfaLoading(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setResetErrorMsg(null);
    setResetSuccessMsg(null);

    const fd = new FormData();
    fd.append('email', resetEmail);
    const res = await requestPasswordReset(fd);
    setResetLoading(false);

    if (res.error) {
      setResetErrorMsg(res.error);
    } else {
      setResetSuccessMsg(res.message);
    }
  }

  async function handleQuickLogin(name: string, role: string) {
    setQuickLoadingRole(role);
    try {
      await quickLoginAsRole(name, role);
      window.location.href = '/dashboard';
    } catch (err: any) {
      if (err?.message?.includes('NEXT_REDIRECT') || err?.digest?.includes('NEXT_REDIRECT')) {
        window.location.href = '/dashboard';
        return;
      }
      setQuickLoadingRole(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 bg-slate-900 text-slate-100">
      <div className="w-full max-w-xl space-y-7 bg-slate-800/90 p-8 sm:p-10 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-xl">
        {/* Enterprise System Release Banner */}
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="tracking-wide font-semibold text-white">ICON TECH PRO Commercial Operations</span>
          </div>
          <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 font-bold">
            {ERP_SYSTEM_VERSION.versionLabel} {ERP_SYSTEM_VERSION.environment}
          </span>
        </div>

        {/* Header Branding */}
        <div className="text-center space-y-2 flex flex-col items-center">
          <img
            src="/logo-dark.png"
            alt="ICON TECH PRO - Unified Solutions Specialist"
            className="h-14 sm:h-16 w-auto object-contain drop-shadow-lg"
          />
          <div className="space-y-0.5">
            <h2 className="text-base font-black text-white tracking-tight">
              {ERP_SYSTEM_VERSION.brandWithVersion}
            </h2>
            <p className="text-xs text-slate-400">
              {loginSubtitle}
            </p>
          </div>
        </div>

        {/* Reset Password Success Banner */}
        {resetSuccessBanner && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-sm animate-in fade-in duration-200">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <p className="font-bold">Password Updated Successfully</p>
              <p className="text-xs text-emerald-200/90 mt-0.5">
                Your new account password has been safely stored. Please sign in below.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-sm animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {isMfaMode ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">Two-Factor Authentication</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMfaMode(false);
                  setMfaCode('');
                  setMfaError(null);
                }}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-700 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-brand-400" />
                <span className="text-slate-300 font-medium">Account:</span>
                <span className="text-white font-semibold">{mfaUser?.name}</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 text-[10px] font-bold">
                {mfaUser?.role}
              </span>
            </div>

            {mfaError && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-sm animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
                <span>{mfaError}</span>
              </div>
            )}

            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">
                  {isBackupCode ? 'Emergency Backup Recovery Code' : '6-Digit Authenticator Code'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder={isBackupCode ? 'XXXX-XXXX' : '000000'}
                  maxLength={isBackupCode ? 10 : 6}
                  className="w-full text-center tracking-widest font-mono text-lg py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {isBackupCode
                    ? 'Enter one of your 8 emergency single-use recovery codes.'
                    : 'Open Google Authenticator, Microsoft Authenticator, or Apple Passwords to get your 6-digit TOTP code.'}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsBackupCode(!isBackupCode);
                    setMfaCode('');
                    setMfaError(null);
                  }}
                  className="text-blue-400 hover:text-blue-300 transition cursor-pointer underline text-[11px]"
                >
                  {isBackupCode ? 'Use Authenticator App Code Instead' : 'Lost Device? Use Emergency Backup Code'}
                </button>
              </div>

              <button
                type="submit"
                disabled={mfaLoading || !mfaCode.trim()}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/30 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {mfaLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify & Enter ERP</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : isResetMode ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold text-white">Reset Account Password</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setResetSuccessMsg(null);
                  setResetErrorMsg(null);
                }}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>

            {resetSuccessMsg && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-sm animate-in fade-in duration-200">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
                <span>{resetSuccessMsg}</span>
              </div>
            )}

            {resetErrorMsg && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-sm animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
                <span>{resetErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">
                  Registered Corporate Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder={emailPlaceholder}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  We will dispatch secure cryptographic password reset instructions to your verified address.
                </p>
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {resetLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Send Password Reset Instructions</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">
                ERP Login Email *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder={emailPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-300">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-400 hover:text-blue-300 transition cursor-pointer"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Sign In with Password</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Authorized Personnel Quick Sign-In */}
        {ERP_SYSTEM_VERSION.environment !== 'UAT / TEST ENVIRONMENT' && quickRoles.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              Authorized Personnel Quick Sign-In
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-semibold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              6 Official Team Roles
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quickRoles.map((member) => (
              <button
                key={member.role}
                type="button"
                onClick={() => handleQuickLogin(member.name, member.role)}
                disabled={quickLoadingRole !== null}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-700/80 hover:border-brand-500/50 text-left transition group"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-semibold text-white group-hover:text-brand-300 truncate">
                    {member.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {member.dept}
                  </div>
                  <span
                    className={`inline-block mt-1 text-[9px] font-medium px-1.5 py-0.5 rounded border ${member.badge}`}
                  >
                    {member.role}
                  </span>
                </div>
                <div className="flex-shrink-0 text-slate-500 group-hover:text-brand-400 group-hover:translate-x-0.5 transition">
                  {quickLoadingRole === member.role ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Security Notice */}
        <div className="pt-2 border-t border-slate-700/60 text-center space-y-2">
          <p className="text-xs text-slate-400">
            Secure Enterprise Session &bull; Role-Based Access Control
          </p>
          <div className="flex justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <span className="px-2.5 py-0.5 rounded bg-slate-700/50 text-brand-300 font-bold">ICON TECH PRO</span>
            <span className="px-2.5 py-0.5 rounded bg-slate-700/50">Unified Solutions Specialist</span>
          </div>
          <div className="flex justify-center items-center gap-3 text-xs text-slate-400 pt-1">
            <Link href="/" className="hover:text-white transition">Home</Link>
            <span>&bull;</span>
            <Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link>
            <span>&bull;</span>
            <Link href="/terms-of-service" className="hover:text-white transition">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
