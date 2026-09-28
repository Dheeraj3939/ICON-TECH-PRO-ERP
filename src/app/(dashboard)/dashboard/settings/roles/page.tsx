'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  Plus,
  Trash2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';
import { getRoles, createCustomRole, deleteRole } from '@/lib/actions/permissions';
import type { AppRole } from '@/types/rbac';

export default function RolesManagementPage() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ role_name: '', description: '' });

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  async function loadRoles() {
    setLoading(true);
    try {
      const res = await getRoles();
      setRoles(res.roles);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to load roles' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoles();
  }, []);

  function showMessage(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    const res = await createCustomRole(formData);
    if (res.success) {
      showMessage('success', `Custom role "${formData.role_name}" created successfully.`);
      setIsModalOpen(false);
      setFormData({ role_name: '', description: '' });
      loadRoles();
    } else {
      showMessage('error', res.error || 'Failed to create role');
    }
  }

  async function handleDeleteRole(role: AppRole) {
    if (
      !confirm(
        `Are you sure you want to delete custom role "${role.role_name}"? Core system roles cannot be deleted.`
      )
    ) {
      return;
    }

    const res = await deleteRole(role.id);
    if (res.success) {
      showMessage('success', `Role "${role.role_name}" deleted.`);
      loadRoles();
    } else {
      showMessage('error', res.error || 'Failed to delete role');
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Settings Tab Navigation */}
      <SettingsNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Role Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold">
              Dynamic RBAC
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure system and custom employee roles. Custom roles allow specialized access tiers without code deployment.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormData({ role_name: '', description: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create Custom Role</span>
        </button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl text-xs font-semibold animate-in fade-in duration-200 border ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Info Callout */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3 text-xs text-blue-900">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">System Role Protection Rule:</span>
          <p className="text-blue-800 leading-relaxed">
            The 6 core system roles are required by the standard operational workflows and discount escalation ladders. They cannot be deleted or renamed. Custom roles can be created for unique organizational units (e.g. Warehouse In-Charge, Field Technician) and can be deleted if no active users are assigned.
          </p>
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{role.role_name}</h3>
                    <div className="text-[10px] text-slate-400 font-mono">
                      ID: {role.id}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    role.is_system
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {role.is_system ? 'CORE SYSTEM' : 'CUSTOM'}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed min-h-[36px]">
                {role.description || 'No role description provided.'}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>{role.user_count || 0} active user(s)</span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/settings/permissions?role=${encodeURIComponent(role.role_name)}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold transition"
                >
                  <KeyRound className="w-3 h-3 text-slate-500" />
                  <span>Permissions</span>
                </Link>

                {!role.is_system && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRole(role)}
                    title="Delete Custom Role"
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 border border-rose-200 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Custom Role Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-600" />
                <span>Create New Custom Role</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Custom Role Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.role_name}
                  onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                  placeholder="e.g. Field Engineer / Warehouse Head"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Role Description & Scope
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe operational responsibilities and authority level..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold shadow-sm"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
