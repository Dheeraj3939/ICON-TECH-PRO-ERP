'use client';

import { useState } from 'react';
import { login, quickLoginAsRole } from './actions';
import { Shield, Lock, Mail, AlertCircle, Building2, UserCheck, ArrowRight } from 'lucide-react';
import { ERP_SYSTEM_VERSION } from '@/lib/constants/version';

const QUICK_ROLES = [
  {
    name: 'Borra Narsimulu',
    role: 'Managing Director',
    dept: 'Executive / Leadership',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    name: 'B V Dheeraj Reddy',
    role: 'Admin / BDM',
    dept: 'Sales Executive / Admin & System Admin',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
  {
    name: 'B Vineet Babu',
    role: 'Sales Executive',
    dept: 'Corporate Sales',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  {
    name: 'Reshma',
    role: 'Sales Executive',
    dept: 'Field Sales & Customer Communication',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    name: 'Hemalath',
    role: 'Accounts',
    dept: 'Finance, Invoicing & Accounts',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  },
  {
    name: 'Manisha',
    role: 'Office Assistant',
    dept: 'Operations & Service Coordination',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  },
];

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickLoadingRole, setQuickLoadingRole] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
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
              Hyderabad, Telangana &bull; Production-Hardened Commercial & HR Platform
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-sm animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Corporate Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                name="email"
                required
                placeholder="name@icontechpro.in"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Password
            </label>
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
            className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

        {/* Authorized Personnel Quick Sign-In */}
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
            {QUICK_ROLES.map((member) => (
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

        {/* Security Notice */}
        <div className="pt-2 border-t border-slate-700/60 text-center space-y-2">
          <p className="text-xs text-slate-400">
            Secure Enterprise Session &bull; Role-Based Access Control
          </p>
          <div className="flex justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <span className="px-2.5 py-0.5 rounded bg-slate-700/50 text-brand-300 font-bold">ICON TECH PRO</span>
            <span className="px-2.5 py-0.5 rounded bg-slate-700/50">Unified Solutions Specialist</span>
          </div>
        </div>
      </div>
    </div>
  );
}
