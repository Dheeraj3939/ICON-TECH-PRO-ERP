'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Building,
  Briefcase,
  Phone,
  Mail,
  RefreshCw,
  ExternalLink,
  PlayCircle,
  PauseCircle,
  UserX,
  UserCheck,
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';
import {
  getManagedUsers,
  createManagedUser,
  updateManagedUserProfile,
  toggleUserStatus,
  deleteManagedUser,
  activateUser,
  suspendUser,
  deactivateUser,
  reactivateUser,
} from '@/lib/actions/users';
import { getRoles } from '@/lib/actions/permissions';
import { AddEmployeeModal } from '@/components/admin/AddEmployeeModal';
import type { ManagedUser, AppRole, AccountLifecycleStatus } from '@/types/rbac';

export default function UsersManagementPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & form state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Sales Executive',
    department: 'Sales',
    designation: 'Sales Executive',
    notes: '',
  });

  async function loadData() {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([
        getManagedUsers({ search, role: roleFilter, status: statusFilter }),
        getRoles(),
      ]);
      setUsers(uRes.users);
      setRoles(rRes.roles);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to load user records' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [search, roleFilter, statusFilter]);

  function showMessage(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;

    const res = await updateManagedUserProfile(selectedUser.id, {
      name: formData.name,
      phone: formData.phone,
      role: formData.role,
      department: formData.department,
      designation: formData.designation,
      notes: formData.notes,
    });

    if (res.success) {
      showMessage('success', `Profile for ${formData.name} updated successfully.`);
      setIsEditModalOpen(false);
      setSelectedUser(null);
      loadData();
    } else {
      showMessage('error', res.error || 'Failed to update user');
    }
  }

  async function handleActivate(user: ManagedUser) {
    const res = await activateUser(user.id);
    if (res.success) {
      showMessage('success', `User ${user.name} is now ACTIVE with login access enabled.`);
      loadData();
    } else {
      showMessage('error', res.error || 'Failed to activate user');
    }
  }

  async function handleSuspend(user: ManagedUser) {
    const res = await suspendUser(user.id);
    if (res.success) {
      showMessage('success', `User ${user.name} has been SUSPENDED.`);
      loadData();
    } else {
      showMessage('error', res.error || 'Failed to suspend user');
    }
  }

  async function handleDeactivate(user: ManagedUser) {
    const res = await deactivateUser(user.id);
    if (res.success) {
      showMessage('success', `User ${user.name} has been DEACTIVATED. All historical quotations, orders, and dispatches are preserved.`);
      loadData();
    } else {
      showMessage('error', res.error || 'Failed to deactivate user');
    }
  }

  async function handleReactivate(user: ManagedUser) {
    const res = await reactivateUser(user.id);
    if (res.success) {
      showMessage('success', `User ${user.name} has been REACTIVATED.`);
      loadData();
    } else {
      showMessage('error', res.error || 'Failed to reactivate user');
    }
  }

  async function handleDelete(user: ManagedUser) {
    if (
      !confirm(
        `Are you sure you want to delete user "${user.name}"? If they have ERP transaction history, the system will safely block deletion.`
      )
    ) {
      return;
    }

    const res = await deleteManagedUser(user.id);
    if (res.success) {
      showMessage('success', `User "${user.name}" deleted.`);
      loadData();
    } else {
      showMessage('error', res.error || 'Failed to delete user');
    }
  }

  function openEditModal(user: ManagedUser) {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      department: user.department || '',
      designation: user.designation || '',
      notes: user.notes || '',
    });
    setIsEditModalOpen(true);
  }

  function renderStatusBadge(status: string, canLogin: boolean) {
    let bg = 'bg-slate-100 text-slate-700 border-slate-200';
    let dot = 'bg-slate-400';
    if (status === 'ACTIVE' && canLogin) {
      bg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      dot = 'bg-emerald-500';
    } else if (status === 'SUSPENDED') {
      bg = 'bg-amber-50 text-amber-800 border-amber-200';
      dot = 'bg-amber-500';
    } else if (status === 'DEACTIVATED' || !canLogin) {
      bg = 'bg-rose-50 text-rose-800 border-rose-200';
      dot = 'bg-rose-500';
    } else if (status === 'INVITED' || status === 'PENDING') {
      bg = 'bg-blue-50 text-blue-800 border-blue-200';
      dot = 'bg-blue-500';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {status} {!canLogin && status === 'ACTIVE' ? '(Login Disabled)' : ''}
      </span>
    );
  }

  const activeCount = users.filter((u) => u.status === 'ACTIVE' && u.can_login).length;
  const suspendedCount = users.filter((u) => u.status === 'SUSPENDED').length;
  const deactivatedCount = users.filter((u) => u.status === 'DEACTIVATED' || !u.can_login).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Settings Tab Navigation */}
      <SettingsNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Employee User Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold">
              Access Governance
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage employee identities, corporate roles, account lifecycle (Active, Suspended, Deactivated), and granular access.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormData({
              name: '',
              email: '',
              phone: '',
              role: roles[0]?.role_name || 'Sales Executive',
              department: 'Field Sales',
              designation: 'Sales Executive',
              notes: '',
            });
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Employee</span>
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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Total Accounts
          </span>
          <div className="text-2xl font-black text-slate-900">{users.length}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Active Staff
          </span>
          <div className="text-2xl font-black text-emerald-600">{activeCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Suspended Staff
          </span>
          <div className="text-2xl font-black text-amber-600">{suspendedCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Deactivated / Blocked
          </span>
          <div className="text-2xl font-black text-rose-600">{deactivatedCount}</div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-700 text-xs"
          >
            <option value="ALL">All Roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.role_name}>
                {r.role_name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-700 text-xs"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INVITED">Invited</option>
            <option value="PENDING">Pending</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
        </div>
      </div>

      {/* Desktop Users Table */}
      <div className="hidden md:block border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden text-xs w-full">
        <table className="w-full text-left border-collapse table-fixed">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[22%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
            <tr>
              <th className="py-2.5 px-3">Employee Details</th>
              <th className="py-2.5 px-3">Contact Info</th>
              <th className="py-2.5 px-3">Department & Designation</th>
              <th className="py-2.5 px-3">Assigned Role</th>
              <th className="py-2.5 px-3">Status & Access</th>
              <th className="py-2.5 px-3 text-right">Lifecycle Actions</th>
            </tr>
          </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((user) => {
                const isAct = user.status === 'ACTIVE' && user.can_login;
                const isSusp = user.status === 'SUSPENDED';
                const isDeact = user.status === 'DEACTIVATED';

                return (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{user.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        ID: {user.id}
                      </div>
                    </td>
                    <td className="p-4 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{user.email}</span>
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{user.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">
                        {user.designation || 'Staff'}
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        {user.department || 'Operations'}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-bold text-[11px]">
                        <Shield className="w-3 h-3 text-brand-600" />
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4 space-y-1">
                      {renderStatusBadge(user.status, user.can_login)}
                      <div className="text-[11px] text-slate-500">
                        Login: {user.can_login ? 'Permitted' : 'Disabled'}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                        {/* Edit Profile */}
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          title="Edit Profile"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 border border-slate-200 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Review Access */}
                        <Link
                          href={`/dashboard/settings/permissions?userId=${user.id}`}
                          title="Review & Override Permissions"
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 border border-blue-200 transition inline-flex items-center"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>

                        {/* Lifecycle Buttons */}
                        {isAct && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSuspend(user)}
                              title="Suspend User Account"
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                            >
                              Suspend
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivate(user)}
                              title="Deactivate User Account (Preserves History)"
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                            >
                              Deactivate
                            </button>
                          </>
                        )}

                        {isSusp && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleActivate(user)}
                              title="Activate Account"
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                            >
                              Activate
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivate(user)}
                              title="Deactivate Account"
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                            >
                              Deactivate
                            </button>
                          </>
                        )}

                        {isDeact && (
                          <button
                            type="button"
                            onClick={() => handleReactivate(user)}
                            title="Reactivate Account"
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                          >
                            Reactivate
                          </button>
                        )}

                        {!isAct && !isSusp && !isDeact && (
                          <button
                            type="button"
                            onClick={() => handleActivate(user)}
                            title="Activate Account"
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                          >
                            Activate
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          title="Delete User Record (Preserves transaction history)"
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 border border-rose-200 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>

      {/* Mobile-Responsive Card View */}
      <div className="block md:hidden space-y-3">
        {users.map((user) => {
          const isAct = user.status === 'ACTIVE' && user.can_login;
          const isSusp = user.status === 'SUSPENDED';
          const isDeact = user.status === 'DEACTIVATED';

          return (
            <div
              key={user.id}
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{user.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">ID: {user.id}</div>
                </div>
                {renderStatusBadge(user.status, user.can_login)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl">
                <div>
                  <span className="text-slate-400 block">Role</span>
                  <span className="font-bold text-slate-800">{user.role}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Department</span>
                  <span className="font-semibold text-slate-700">{user.department || 'Operations'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Designation</span>
                  <span className="font-semibold text-slate-700">{user.designation || 'Staff'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Login Status</span>
                  <span className={`font-semibold ${user.can_login ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {user.can_login ? 'Permitted' : 'Disabled'}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-slate-600 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{user.phone}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(user)}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200"
                    title="Edit Profile"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <Link
                    href={`/dashboard/settings/permissions?userId=${user.id}`}
                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 border border-blue-200"
                    title="Review Permissions"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="flex items-center gap-1.5">
                  {isAct && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSuspend(user)}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200"
                      >
                        Suspend
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeactivate(user)}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200"
                      >
                        Deactivate
                      </button>
                    </>
                  )}
                  {isSusp && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleActivate(user)}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200"
                      >
                        Activate
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeactivate(user)}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200"
                      >
                        Deactivate
                      </button>
                    </>
                  )}
                  {isDeact && (
                    <button
                      type="button"
                      onClick={() => handleReactivate(user)}
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200"
                    >
                      Reactivate
                    </button>
                  )}
                  {!isAct && !isSusp && !isDeact && (
                    <button
                      type="button"
                      onClick={() => handleActivate(user)}
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add User / Onboarding Modal */}
      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        roles={roles}
        onSuccess={(msg) => {
          showMessage('success', msg);
          loadData();
        }}
      />

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-brand-600" />
                <span>Edit Profile: {selectedUser.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email (Read-only)</label>
                  <input
                    type="email"
                    disabled
                    value={formData.email}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-800"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.role_name}>
                        {r.role_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Administrative Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
