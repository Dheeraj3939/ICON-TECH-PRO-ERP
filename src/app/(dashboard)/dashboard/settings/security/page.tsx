'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Lock,
  Unlock,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Users,
  Clock,
  ArrowLeft,
  KeyRound,
  XCircle,
  RefreshCw,
  X,
  Smartphone,
  ShieldCheck,
  RotateCcw,
  UserX,
  UserCheck2,
  Copy,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';
import { changeOwnPassword } from '@/lib/actions/users';
import {
  getAccountSecurityOverviewAction,
  adminUnlockAccountAction,
  adminSuspendAccountAction,
  adminReactivateAccountAction,
  adminForcePasswordResetAction,
  adminResetMfaAction,
  forceInvalidateUserSession,
  bulkRevokeTemporaryAccess,
  startOwnMfaEnrollmentAction,
  confirmOwnMfaEnrollmentAction,
  getRecentSecurityIncidentsAction,
} from '@/lib/actions/security-controls';
import type { UserSecurityOverviewItem, EnterpriseAuditRecord } from '@/types/security';

export default function SecurityDangerZonePage() {
  const [securityUsers, setSecurityUsers] = useState<UserSecurityOverviewItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<EnterpriseAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Self-Service Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Self-Service MFA Modal State
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaData, setMfaData] = useState<{
    formattedSecret?: string;
    otpauthUri?: string;
    qrDataUrl?: string;
    backupCodes?: string[];
  } | null>(null);
  const [mfaTestCode, setMfaTestCode] = useState('');
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Admin Action Modal State
  type SecurityModalType =
    | 'UNLOCK'
    | 'SUSPEND'
    | 'REACTIVATE'
    | 'FORCE_RESET'
    | 'RESET_MFA'
    | 'FORCE_LOGOUT'
    | 'BULK_REVOKE_TEMP';

  const [activeModal, setActiveModal] = useState<SecurityModalType | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserSecurityOverviewItem | null>(null);
  const [justification, setJustification] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, incidentsData] = await Promise.all([
        getAccountSecurityOverviewAction(),
        getRecentSecurityIncidentsAction(8),
      ]);
      if (res.success) {
        setSecurityUsers(res.users);
        if (res.currentUserId) setCurrentUserId(res.currentUserId);
      }
      setIncidents(incidentsData);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Failed to load security overview',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAdminModal = (type: SecurityModalType, user?: UserSecurityOverviewItem) => {
    setActiveModal(type);
    if (user) setSelectedUser(user);
    setJustification('');
    setNotification(null);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedUser(null);
    setJustification('');
  };

  const handleExecuteAdminAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim() || justification.trim().length < 5) {
      alert('A valid business justification (minimum 5 characters) is mandatory.');
      return;
    }

    setSubmitting(true);
    try {
      let res: { success: boolean; error?: string; revokedCount?: number } = { success: false };

      if (activeModal === 'UNLOCK' && selectedUser) {
        res = await adminUnlockAccountAction(selectedUser.user_id, justification);
      } else if (activeModal === 'SUSPEND' && selectedUser) {
        res = await adminSuspendAccountAction(selectedUser.user_id, justification);
      } else if (activeModal === 'REACTIVATE' && selectedUser) {
        res = await adminReactivateAccountAction(selectedUser.user_id, justification);
      } else if (activeModal === 'FORCE_RESET' && selectedUser) {
        res = await adminForcePasswordResetAction(selectedUser.user_id, justification);
      } else if (activeModal === 'RESET_MFA' && selectedUser) {
        res = await adminResetMfaAction(selectedUser.user_id, justification);
      } else if (activeModal === 'FORCE_LOGOUT' && selectedUser) {
        res = await forceInvalidateUserSession(selectedUser.user_id, justification);
      } else if (activeModal === 'BULK_REVOKE_TEMP') {
        res = await bulkRevokeTemporaryAccess(justification);
      }

      if (res.success) {
        setNotification({
          type: 'success',
          message:
            activeModal === 'BULK_REVOKE_TEMP'
              ? `Bulk revoked ${(res as any).revokedCount} temporary permissions successfully.`
              : `Security action '${activeModal}' completed for ${selectedUser?.name || 'account'}.`,
        });
        closeModal();
        await loadData();
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to execute security action',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Operation failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartMfaSetup = async () => {
    setMfaEnrolling(true);
    setMfaError(null);
    setMfaSuccess(false);
    try {
      const res = await startOwnMfaEnrollmentAction();
      if (res.success && res.formattedSecret) {
        setMfaData(res);
        setShowMfaModal(true);
      } else {
        alert(res.error || 'Could not start MFA setup');
      }
    } catch (err: any) {
      alert(err.message || 'MFA setup error');
    } finally {
      setMfaEnrolling(false);
    }
  };

  const handleConfirmMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaTestCode || mfaTestCode.length !== 6) {
      setMfaError('Please enter a 6-digit verification code.');
      return;
    }
    setMfaEnrolling(true);
    setMfaError(null);
    try {
      const res = await confirmOwnMfaEnrollmentAction(mfaTestCode);
      if (res.success) {
        setMfaSuccess(true);
        await loadData();
      } else {
        setMfaError(res.error || 'Verification failed. Please check code.');
      }
    } catch (err: any) {
      setMfaError(err.message || 'Verification error');
    } finally {
      setMfaEnrolling(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }

    setPasswordUpdating(true);
    try {
      const res = await changeOwnPassword({ currentPassword, newPassword, confirmPassword });
      if (res.success) {
        setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMessage({ type: 'error', text: res.error || 'Failed to update password.' });
      }
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err?.message || 'An unexpected error occurred.' });
    } finally {
      setPasswordUpdating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Enterprise Security & Account Controls
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              Executive Control Authority
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Standard 3-attempt account lockout, administrative suspensions, TOTP multi-factor authentication, and append-only cryptographic audit logging.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      <SettingsNav />

      {/* Global Alert Notification */}
      {notification && (
        <div
          className={`flex items-start justify-between gap-3 p-4 rounded-xl border text-xs animate-in fade-in duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span className="font-semibold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Executive Policy Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-600">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900">3-Attempt Lockout</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              1st: Failure recorded • 2nd: Warning • 3rd: 15-min lockout.
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-50 border border-rose-100 text-rose-600">
            <UserX className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900">Admin Suspension</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Separate from lockout; persists indefinitely until admin reactivation.
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900">RFC 6238 TOTP MFA</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Standard 30s authenticator app + 8 single-use recovery codes.
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900">Zero Password Viewing</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Self-service 15-min recovery links; no admin can view passwords.
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Employee Security & Lockout Management */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-600" />
              Employee Account Security Overview & Lockout Control
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time monitoring of failed password attempts, temporary lockouts, and administrative suspensions across all corporate accounts.
            </p>
          </div>

          <button
            onClick={() => openAdminModal('BULK_REVOKE_TEMP')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Bulk Revoke Temporary Access</span>
          </button>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-3 px-4">Employee & Corporate Email</th>
                <th className="py-3 px-4">Role & Status</th>
                <th className="py-3 px-4">Failed Password Attempts</th>
                <th className="py-3 px-4">Lockout Status</th>
                <th className="py-3 px-4">MFA Policy</th>
                <th className="py-3 px-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {securityUsers.map((u) => {
                const isSelf = currentUserId === u.user_id;

                return (
                  <tr key={u.user_id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        {u.name}
                        {isSelf && (
                          <span className="px-1.5 py-0.2 rounded bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-200">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{u.email}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-700 block">{u.role}</span>
                      <span
                        className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          u.is_suspended
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : u.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {u.is_suspended ? 'SUSPENDED' : u.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          u.failed_attempts >= 3
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : u.failed_attempts === 2
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : u.failed_attempts === 1
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {u.failed_attempts} / 3 Attempts
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {u.is_locked ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-300">
                            <Clock className="w-3 h-3 text-rose-600 animate-pulse" />
                            Locked Out
                          </span>
                          {u.remaining_lockout_seconds > 0 && (
                            <div className="text-[10px] text-rose-600 mt-1 font-mono font-medium">
                              Expires in {Math.ceil(u.remaining_lockout_seconds / 60)}m ({u.remaining_lockout_seconds}s)
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Unlocked
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {u.mfa_enabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          MFA Active
                        </span>
                      ) : u.mfa_required ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                          Mandatory Policy
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Optional</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Unlock Button */}
                        {u.is_locked && (
                          <button
                            onClick={() => openAdminModal('UNLOCK', u)}
                            disabled={isSelf}
                            title={isSelf ? 'Self-unlock is prohibited by enterprise security policy' : 'Unlock Account'}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer"
                          >
                            <Unlock className="w-3 h-3" />
                            <span>Unlock</span>
                          </button>
                        )}

                        {/* Suspend / Reactivate Button */}
                        {u.is_suspended ? (
                          <button
                            onClick={() => openAdminModal('REACTIVATE', u)}
                            disabled={isSelf}
                            title={isSelf ? 'Self-reactivation prohibited' : 'Reactivate Suspended Account'}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer"
                          >
                            <UserCheck2 className="w-3 h-3" />
                            <span>Reactivate</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => openAdminModal('SUSPEND', u)}
                            disabled={isSelf}
                            title={isSelf ? 'Cannot suspend own account' : 'Administratively Suspend Account'}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-[11px] font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
                          >
                            <UserX className="w-3 h-3" />
                            <span>Suspend</span>
                          </button>
                        )}

                        {/* Force Password Reset */}
                        <button
                          onClick={() => openAdminModal('FORCE_RESET', u)}
                          title="Force Password Reset via Corporate Email"
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[11px] font-medium rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Reset Link</span>
                        </button>

                        {/* Reset MFA */}
                        {u.mfa_enabled && (
                          <button
                            onClick={() => openAdminModal('RESET_MFA', u)}
                            title="Reset MFA after Identity Verification"
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-medium rounded-lg transition flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset MFA</span>
                          </button>
                        )}

                        {/* Force Logout */}
                        <button
                          onClick={() => openAdminModal('FORCE_LOGOUT', u)}
                          title="Invalidate All Active Sessions"
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Self-Service Security Credentials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Self-Service MFA Setup */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Two-Factor Authentication (TOTP MFA)
                </h3>
                <p className="text-xs text-slate-500">
                  Protect your corporate login using Google Authenticator, Microsoft Authenticator, or Apple Passwords.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
              RFC 6238
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Multi-Factor Identity Security</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              When enabled, signing in requires both your password and a time-sensitive 6-digit verification code. Emergency backup recovery codes are provided during setup.
            </p>
          </div>

          <button
            onClick={handleStartMfaSetup}
            disabled={mfaEnrolling}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>Setup Authenticator App MFA</span>
          </button>
        </div>

        {/* Change Own Password */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Change Your Corporate Password</h3>
              <p className="text-xs text-slate-500">Update your current account password.</p>
            </div>
          </div>

          {passwordMessage && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                passwordMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {passwordMessage.text}
            </div>
          )}

          <form onSubmit={handlePasswordUpdate} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={passwordUpdating}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {passwordUpdating ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      {/* SECTION 3: Recent Security Incidents & Access Audit */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">Recent Security Incident Feed</h3>
          </div>
          <Link
            href="/dashboard/audit"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition"
          >
            View Full Central Audit Ledger &rarr;
          </Link>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {incidents.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No security incidents recorded.</div>
          ) : (
            incidents.map((inc) => (
              <div key={inc.event_id} className="p-4 hover:bg-slate-50/60 transition flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        inc.severity === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : inc.severity === 'SECURITY'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : inc.severity === 'WARNING'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span className="font-mono font-bold text-slate-900">{inc.action}</span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="font-semibold text-slate-700">{inc.user_name}</span>
                  </div>
                  <div className="text-slate-600 text-[11px]">{inc.reason || inc.related_context}</div>
                </div>

                <div className="text-right font-mono text-[11px] text-slate-400 flex-shrink-0">
                  <div>{new Date(inc.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
                  <div className="text-[10px] text-slate-400">{inc.source_ip}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MFA ENROLLMENT MODAL */}
      {showMfaModal && mfaData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Setup Authenticator App (RFC 6238)</h3>
              </div>
              <button onClick={() => setShowMfaModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {mfaSuccess ? (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">MFA Successfully Activated!</h4>
                  <p className="text-slate-500 max-w-xs mx-auto text-xs">
                    Your account is now protected with Two-Factor Authentication. Keep your backup recovery codes in a secure place.
                  </p>
                  <button
                    onClick={() => setShowMfaModal(false)}
                    className="mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-sm transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 block">Step 1: Scan QR Code or Enter Key</span>
                    <p className="text-slate-500 text-[11px]">
                      Open Google Authenticator, Microsoft Authenticator, or Apple Passwords on your phone and scan the code below.
                    </p>
                  </div>

                  {/* QR Code Presentation */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    {mfaData.qrDataUrl && (
                      <img
                        src={mfaData.qrDataUrl}
                        alt="TOTP QR Code"
                        className="w-32 h-32 border border-slate-300 rounded-xl p-1 bg-white shadow-sm flex-shrink-0"
                      />
                    )}
                    <div className="space-y-1.5 min-w-0">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Manual Secret Key:</span>
                      <div className="font-mono text-xs font-bold text-slate-900 bg-white p-2 rounded-lg border border-slate-200 select-all break-all">
                        {mfaData.formattedSecret}
                      </div>
                      <p className="text-[10px] text-slate-400">Account: ICON TECH PRO ERP</p>
                    </div>
                  </div>

                  {/* Backup Recovery Codes */}
                  {mfaData.backupCodes && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 block">Step 2: Save Emergency Recovery Codes</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(mfaData.backupCodes!.join('\n'));
                            setCopiedCodes(true);
                            setTimeout(() => setCopiedCodes(false), 2000);
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:text-brand-700 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedCodes ? 'Copied!' : 'Copy All Codes'}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        If you ever lose access to your authenticator app, each of these 8 codes can be used once to access your account:
                      </p>
                      <div className="grid grid-cols-4 gap-2 font-mono text-[11px] bg-slate-900 text-slate-200 p-3 rounded-xl border border-slate-800 text-center select-all">
                        {mfaData.backupCodes.map((c) => (
                          <span key={c} className="tracking-wider">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verification Form */}
                  <form onSubmit={handleConfirmMfa} className="space-y-3 pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-900 block">Step 3: Verify 6-Digit Code</span>
                    {mfaError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                        {mfaError}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={mfaTestCode}
                        onChange={(e) => setMfaTestCode(e.target.value)}
                        placeholder="000000"
                        className="flex-1 text-center font-mono text-base font-bold tracking-widest px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={mfaEnrolling || mfaTestCode.length !== 6}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                      >
                        {mfaEnrolling ? 'Verifying...' : 'Activate MFA'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN ACTION JUSTIFICATION MODAL */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {activeModal === 'UNLOCK' && 'Unlock Employee Account'}
                  {activeModal === 'SUSPEND' && 'Administratively Suspend Account'}
                  {activeModal === 'REACTIVATE' && 'Reactivate Suspended Account'}
                  {activeModal === 'FORCE_RESET' && 'Force Corporate Password Reset'}
                  {activeModal === 'RESET_MFA' && 'Reset Multi-Factor Authentication'}
                  {activeModal === 'FORCE_LOGOUT' && 'Force Session Invalidation'}
                  {activeModal === 'BULK_REVOKE_TEMP' && 'Bulk Revoke Temporary Access'}
                </h3>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAdminAction} className="p-5 space-y-4">
              {selectedUser && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">{selectedUser.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{selectedUser.email} &bull; {selectedUser.role}</div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-bold text-slate-800">
                  Mandatory Business Justification *
                </label>
                <textarea
                  required
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Enter detailed reason for this security action (min 5 characters)..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                />
                <p className="text-[11px] text-slate-400">
                  This action is permanent and cryptographically recorded in the Central Audit Ledger with SHA-256 chaining.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || justification.trim().length < 5}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Executing...' : 'Confirm & Execute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
