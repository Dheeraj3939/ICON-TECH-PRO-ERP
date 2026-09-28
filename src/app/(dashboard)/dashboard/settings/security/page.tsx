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
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';
import { getManagedUsers } from '@/lib/actions/users';
import {
  forceInvalidateUserSession,
  lockUserAccount,
  unlockUserAccount,
  bulkRevokeTemporaryAccess,
} from '@/lib/actions/security-controls';
import type { ManagedUser } from '@/types/rbac';

export default function SecurityDangerZonePage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Modal State
  const [activeModal, setActiveModal] = useState<
    'FORCE_LOGOUT' | 'LOCK_ACCOUNT' | 'UNLOCK_ACCOUNT' | 'BULK_REVOKE_TEMP' | null
  >(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [justification, setJustification] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getManagedUsers();
      setUsers(res.users);
      if (res.users.length > 0 && !selectedUserId) {
        setSelectedUserId(res.users[0].id);
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Failed to load user list',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = (
    action: 'FORCE_LOGOUT' | 'LOCK_ACCOUNT' | 'UNLOCK_ACCOUNT' | 'BULK_REVOKE_TEMP',
    userId?: string
  ) => {
    setActiveModal(action);
    if (userId) setSelectedUserId(userId);
    setJustification('');
    setNotification(null);
  };

  const closeModal = () => {
    setActiveModal(null);
    setJustification('');
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim() || justification.trim().length < 5) {
      alert('A valid business justification (minimum 5 characters) is mandatory for this security action.');
      return;
    }

    setSubmitting(true);
    try {
      let res: { success: boolean; error?: string; revokedCount?: number } = { success: false };

      if (activeModal === 'FORCE_LOGOUT') {
        res = await forceInvalidateUserSession(selectedUserId, justification);
      } else if (activeModal === 'LOCK_ACCOUNT') {
        res = await lockUserAccount(selectedUserId, justification);
      } else if (activeModal === 'UNLOCK_ACCOUNT') {
        res = await unlockUserAccount(selectedUserId, justification);
      } else if (activeModal === 'BULK_REVOKE_TEMP') {
        res = await bulkRevokeTemporaryAccess(justification);
      }

      if (res.success) {
        setNotification({
          type: 'success',
          message:
            activeModal === 'BULK_REVOKE_TEMP'
              ? `Successfully revoked ${res.revokedCount ?? 0} temporary permission overrides.`
              : 'Security action executed successfully and recorded in the audit trail.',
        });
        closeModal();
        loadData();
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Security action failed to execute.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'An unexpected error occurred.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Security Controls &amp; Danger Zone
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
              Restricted (MD &amp; Admin Only)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controlled administrative tools for identity locking, session revocation, and emergency security interventions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/settings"
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Settings Overview</span>
          </Link>
        </div>
      </div>

      <SettingsNav />

      {/* Safety Alert Banner */}
      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-900 text-xs flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-bold text-rose-900 block">Strict Accountability &amp; Audit Trail Mandate</strong>
          <p className="text-[11px] text-rose-800">
            Every action executed in this zone is permanently written to the immutable audit log with your authenticated identity, the target employee, old status, new status, and mandatory business justification. Actions take effect immediately.
          </p>
        </div>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* DANGER ZONE ACTION PANELS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* ACTION 1: FORCE SESSION INVALIDATION */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Force Invalidate Active Sessions</h2>
              <p className="text-[11px] text-slate-400">Immediately logs out target staff member from all active devices</p>
            </div>
          </div>

          <p className="text-slate-600 text-[11px]">
            Use this action if an employee device is lost, stolen, or compromised. The user will be required to re-authenticate on their next request.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => openModal('FORCE_LOGOUT')}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Force Invalidate Session...</span>
            </button>
          </div>
        </div>

        {/* ACTION 2: ACCOUNT LOCK / UNLOCK */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Account Lock &amp; Suspension</h2>
              <p className="text-[11px] text-slate-400">Revoke login credentials while strictly preserving historical records</p>
            </div>
          </div>

          <p className="text-slate-600 text-[11px]">
            Immediately blocks login access for an employee under investigation or leave. All historical quotations, orders, and invoices created by this user remain 100% intact.
          </p>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => openModal('LOCK_ACCOUNT')}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Account...</span>
            </button>
            <button
              type="button"
              onClick={() => openModal('UNLOCK_ACCOUNT')}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 transition"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlock Account...</span>
            </button>
          </div>
        </div>

        {/* ACTION 3: BULK TEMPORARY ACCESS REVOCATION */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 md:col-span-2">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Emergency Bulk Revoke Temporary Access</h2>
              <p className="text-[11px] text-slate-400">Instantly revoke all active temporary permission overrides across the system</p>
            </div>
          </div>

          <p className="text-slate-600 text-[11px]">
            In an emergency audit or security lockdown, this action immediately terminates all time-bounded temporary permissions across all staff members, instantly restoring standard role-based baselines. Non-temporary permissions and role defaults remain unaffected.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => openModal('BULK_REVOKE_TEMP')}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center gap-2 transition shadow-xs"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Bulk Revoke All Temporary Permissions...</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION & JUSTIFICATION MODAL */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>
                  {activeModal === 'FORCE_LOGOUT' && 'Confirm Force Session Invalidation'}
                  {activeModal === 'LOCK_ACCOUNT' && 'Confirm Account Lock & Suspension'}
                  {activeModal === 'UNLOCK_ACCOUNT' && 'Confirm Account Unlock'}
                  {activeModal === 'BULK_REVOKE_TEMP' && 'Confirm Bulk Temporary Access Revocation'}
                </span>
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteAction} className="space-y-4">
              {activeModal !== 'BULK_REVOKE_TEMP' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Target Employee *</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role}) — {u.status}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeModal === 'BULK_REVOKE_TEMP' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                  <strong>Warning:</strong> This will immediately cancel all time-bounded temporary access delegations for all employees.
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mandatory Business Justification / Reason * (min 5 chars)
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={5}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="State the explicit operational or security justification for this administrative action..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 resize-none text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || justification.trim().length < 5}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Executing...' : 'Confirm & Audit Action'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
