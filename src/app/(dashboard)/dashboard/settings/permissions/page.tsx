'use client';

import React, { useState, useEffect, useTransition, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  KeyRound,
  Shield,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  Search,
  Lock,
  Sparkles,
  Layers,
  FileCheck,
  Info,
  Clock,
  PlusCircle,
  MinusCircle,
  Calendar,
  User,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';
import {
  getRoles,
  getRolePermissionMatrix,
  updateFullRoleMatrix,
  getUserEffectivePermissions,
  setUserPermissionOverride,
  removeUserPermissionOverride,
  getUserOverrides,
} from '@/lib/actions/permissions';
import { getManagedUsers } from '@/lib/actions/users';
import { ALL_ERP_MODULES, ALL_PERMISSION_ACTIONS } from '@/types/rbac';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/constants/rbac-data';
import type {
  AppRole,
  ERPModule,
  PermissionAction,
  RolePermissionMatrix,
  ManagedUser,
  UserPermissionOverride,
  EffectivePermissionInfo,
} from '@/types/rbac';

export default function PermissionsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading Access Governance Matrix...</p>
        </div>
      }
    >
      <PermissionsContent />
    </Suspense>
  );
}

function PermissionsContent() {
  const searchParams = useSearchParams();
  const urlUserId = searchParams.get('userId');

  const [activeTab, setActiveTab] = useState<'ROLE_MATRIX' | 'USER_OVERRIDES'>(
    urlUserId ? 'USER_OVERRIDES' : 'ROLE_MATRIX'
  );

  // Data state
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('Managing Director');
  const [selectedUserId, setSelectedUserId] = useState<string>(urlUserId || '');
  const [matrix, setMatrix] = useState<RolePermissionMatrix | null>(null);
  const [searchModule, setSearchModule] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // User effective permissions state
  const [userEffective, setUserEffective] = useState<
    Record<string, Record<PermissionAction, EffectivePermissionInfo>> | null
  >(null);
  const [userOverridesList, setUserOverridesList] = useState<UserPermissionOverride[]>([]);

  // Temporary Access Modal State
  const [isTempModalOpen, setIsTempModalOpen] = useState(false);
  const [tempForm, setTempForm] = useState({
    module: 'Quotations' as ERPModule,
    action: 'approve' as PermissionAction,
    granted: true,
    isTemporary: true,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] + 'T23:59',
    reason: '',
  });

  useEffect(() => {
    async function loadInitial() {
      setIsLoading(true);
      try {
        const [rolesRes, matrixRes, usersRes] = await Promise.all([
          getRoles(),
          getRolePermissionMatrix(),
          getManagedUsers(),
        ]);
        setRoles(rolesRes.roles);
        setMatrix(matrixRes);
        setUsers(usersRes.users);

        if (rolesRes.roles.length > 0 && !rolesRes.roles.some((r) => r.role_name === selectedRole)) {
          setSelectedRole(rolesRes.roles[0].role_name);
        }

        if (urlUserId) {
          setSelectedUserId(urlUserId);
          setActiveTab('USER_OVERRIDES');
        } else if (usersRes.users.length > 0 && !selectedUserId) {
          setSelectedUserId(usersRes.users[0].id);
        }
      } catch (err: any) {
        showToast('error', err.message || 'Failed to load permission records');
      } finally {
        setIsLoading(false);
      }
    }
    loadInitial();
  }, [urlUserId]);

  // Load user effective permissions when selectedUserId changes
  useEffect(() => {
    if (!selectedUserId || activeTab !== 'USER_OVERRIDES') return;
    const targetUser = users.find((u) => u.id === selectedUserId);
    if (!targetUser) return;

    async function loadUserPerms() {
      try {
        const [effective, overrides] = await Promise.all([
          getUserEffectivePermissions(selectedUserId, targetUser!.role),
          getUserOverrides(selectedUserId),
        ]);
        setUserEffective(effective);
        setUserOverridesList(overrides);
      } catch (err: any) {
        showToast('error', err.message || 'Failed to load user permissions');
      }
    }
    loadUserPerms();
  }, [selectedUserId, activeTab, users]);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const currentRoleObj = roles.find((r) => r.role_name === selectedRole);
  const selectedUserObj = users.find((u) => u.id === selectedUserId);

  // Check if a specific module action is locked for security (Self-lockout defense)
  function isActionLocked(module: ERPModule, action: PermissionAction): boolean {
    if (
      (selectedRole === 'Managing Director' || selectedRole === 'Admin / BDM') &&
      (module === 'User Management' || module === 'Role & Permission Management') &&
      (action === 'view' || action === 'edit')
    ) {
      return true;
    }
    return false;
  }

  // Toggle single action on Role Matrix
  function handleToggle(module: ERPModule, action: PermissionAction) {
    if (!matrix || !matrix[selectedRole]) return;

    if (isActionLocked(module, action)) {
      showToast(
        'error',
        'Action blocked: User and Permission management permissions cannot be revoked from administrative roles.'
      );
      return;
    }

    const currentVal = Boolean(matrix[selectedRole]?.[module]?.[action]);
    const updated = {
      ...matrix,
      [selectedRole]: {
        ...matrix[selectedRole],
        [module]: {
          ...matrix[selectedRole][module],
          [action]: !currentVal,
        },
      },
    };

    setMatrix(updated);
    setHasUnsavedChanges(true);
  }

  // Quick action: Grant all actions for a row
  function handleToggleRowAll(module: ERPModule, grantAll: boolean) {
    if (!matrix || !matrix[selectedRole]) return;

    const rowActions: Record<PermissionAction, boolean> = {
      view: grantAll,
      create: grantAll,
      edit: grantAll,
      delete: grantAll,
      approve: grantAll,
      export: grantAll,
    };

    if (selectedRole === 'Managing Director' || selectedRole === 'Admin / BDM') {
      if (module === 'User Management' || module === 'Role & Permission Management') {
        rowActions.view = true;
        rowActions.edit = true;
      }
    }

    setMatrix({
      ...matrix,
      [selectedRole]: {
        ...matrix[selectedRole],
        [module]: rowActions,
      },
    });
    setHasUnsavedChanges(true);
  }

  // Quick action: Grant full access to entire role
  function handleGrantFullRoleAccess() {
    if (!matrix || !matrix[selectedRole]) return;

    const newPerms: any = {};
    for (const mod of ALL_ERP_MODULES) {
      newPerms[mod] = {
        view: true,
        create: true,
        edit: true,
        delete: true,
        approve: true,
        export: true,
      };
    }

    setMatrix({
      ...matrix,
      [selectedRole]: newPerms,
    });
    setHasUnsavedChanges(true);
    showToast('success', `Granted full unrestricted access across all modules for "${selectedRole}".`);
  }

  // Quick action: Set read only for entire role
  function handleSetReadOnly() {
    if (!matrix || !matrix[selectedRole]) return;

    const newPerms: any = {};
    for (const mod of ALL_ERP_MODULES) {
      newPerms[mod] = {
        view: true,
        create: false,
        edit: false,
        delete: false,
        approve: false,
        export: false,
      };
    }

    if (selectedRole === 'Managing Director' || selectedRole === 'Admin / BDM') {
      newPerms['User Management'].edit = true;
      newPerms['Role & Permission Management'].edit = true;
    }

    setMatrix({
      ...matrix,
      [selectedRole]: newPerms,
    });
    setHasUnsavedChanges(true);
    showToast('success', `Set read-only permissions across all modules for "${selectedRole}".`);
  }

  // Quick action: Reset role to initial system defaults
  function handleResetToDefaults() {
    if (!matrix) return;
    const defaultForRole = DEFAULT_ROLE_PERMISSIONS[selectedRole];
    if (defaultForRole) {
      setMatrix({
        ...matrix,
        [selectedRole]: JSON.parse(JSON.stringify(defaultForRole)),
      });
      setHasUnsavedChanges(true);
      showToast('success', `Restored system default permission matrix for "${selectedRole}".`);
    } else {
      const blank: any = {};
      for (const mod of ALL_ERP_MODULES) {
        blank[mod] = {
          view: mod === 'Dashboard',
          create: false,
          edit: false,
          delete: false,
          approve: false,
          export: false,
        };
      }
      setMatrix({
        ...matrix,
        [selectedRole]: blank,
      });
      setHasUnsavedChanges(true);
      showToast('success', `Reset custom role "${selectedRole}" to basic Dashboard view.`);
    }
  }

  // Save Role Matrix changes
  async function handleSaveMatrix() {
    if (!matrix || !matrix[selectedRole]) return;
    setIsSaving(true);
    try {
      const res = await updateFullRoleMatrix(selectedRole, matrix[selectedRole]);
      if (res.success) {
        setHasUnsavedChanges(false);
        showToast('success', `Permission matrix for "${selectedRole}" updated successfully.`);
      } else {
        showToast('error', res.error || 'Failed to save permission matrix');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Server action failed');
    } finally {
      setIsSaving(false);
    }
  }

  // Submit User Override or Temporary Access
  async function handleSaveOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || !selectedUserObj) return;

    if (!tempForm.reason || tempForm.reason.trim().length < 5) {
      showToast('error', 'A valid business justification (min 5 characters) is required.');
      return;
    }

    const res = await setUserPermissionOverride({
      userId: selectedUserId,
      userName: selectedUserObj.name,
      module: tempForm.module,
      action: tempForm.action,
      granted: tempForm.granted,
      reason: tempForm.reason.trim(),
      isTemporary: tempForm.isTemporary,
      startDate: tempForm.isTemporary ? tempForm.startDate : undefined,
      endDate: tempForm.isTemporary ? tempForm.endDate : undefined,
    });

    if (res.success) {
      showToast(
        'success',
        `Successfully saved ${tempForm.isTemporary ? 'temporary access' : 'individual override'} for ${selectedUserObj.name}.`
      );
      setIsTempModalOpen(false);
      setTempForm({
        module: 'Quotations',
        action: 'approve',
        granted: true,
        isTemporary: true,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] + 'T23:59',
        reason: '',
      });

      // Reload user permissions
      const [effective, overrides] = await Promise.all([
        getUserEffectivePermissions(selectedUserId, selectedUserObj.role),
        getUserOverrides(selectedUserId),
      ]);
      setUserEffective(effective);
      setUserOverridesList(overrides);
    } else {
      showToast('error', res.error || 'Failed to apply override');
    }
  }

  // Remove User Override
  async function handleRemoveOverride(overrideId: string) {
    if (!confirm('Are you sure you want to remove this individual override and restore default role inheritance?')) {
      return;
    }

    const res = await removeUserPermissionOverride(overrideId);
    if (res.success) {
      showToast('success', 'Override removed. Default role permissions restored.');
      if (selectedUserObj) {
        const [effective, overrides] = await Promise.all([
          getUserEffectivePermissions(selectedUserId, selectedUserObj.role),
          getUserOverrides(selectedUserId),
        ]);
        setUserEffective(effective);
        setUserOverridesList(overrides);
      }
    } else {
      showToast('error', res.error || 'Failed to remove override');
    }
  }

  // Filter modules
  const filteredModules = ALL_ERP_MODULES.filter((mod) =>
    mod.toLowerCase().includes(searchModule.toLowerCase().trim())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
            <KeyRound className="w-4 h-4" />
            <span>Dynamic RBAC & Access Control</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Role Matrix & User Overrides
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage base role permissions, individual additions/restrictions, and time-bounded temporary access with auto-expiry.
          </p>
        </div>

        {/* Global Toast Alert */}
        {toast && (
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold animate-in fade-in ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>

      {/* Navigation Sub-tabs */}
      <SettingsNav />

      {/* Mode Selector: Role Matrix vs Employee Overrides */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('ROLE_MATRIX')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'ROLE_MATRIX'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Role Permission Matrix</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('USER_OVERRIDES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'USER_OVERRIDES'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Individual Overrides & Temporary Access</span>
        </button>
      </div>

      {/* TAB 1: ROLE PERMISSION MATRIX */}
      {activeTab === 'ROLE_MATRIX' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Role Selection Bar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Select Role to Configure:
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                {roles.length} total roles defined in system
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {roles.map((role) => {
                const isSelected = selectedRole === role.role_name;
                return (
                  <button
                    key={role.id}
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        if (
                          confirm(
                            'You have unsaved matrix changes for the current role. Switch role without saving?'
                          )
                        ) {
                          setSelectedRole(role.role_name);
                          setHasUnsavedChanges(false);
                        }
                      } else {
                        setSelectedRole(role.role_name);
                      }
                    }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition duration-150 border ${
                      isSelected
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{role.role_name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        isSelected
                          ? 'bg-brand-700 text-brand-100'
                          : role.is_system
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {role.is_system ? 'System' : 'Custom'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Role Meta & Quick Actions Toolbar */}
            {currentRoleObj && (
              <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-900">{currentRoleObj.role_name}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600">
                      {currentRoleObj.user_count || 0} active users assigned
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500 italic text-[11px]">
                      {currentRoleObj.description}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleGrantFullRoleAccess}
                    title="Grant View, Create, Edit, Delete, Approve, Export for all modules"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 transition flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                    <span>Grant All</span>
                  </button>

                  <button
                    onClick={handleSetReadOnly}
                    title="Keep View enabled, clear all mutation actions"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 transition flex items-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>Read-Only</span>
                  </button>

                  <button
                    onClick={handleResetToDefaults}
                    title="Reset this role to default matrix definition"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 transition flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Reset Defaults</span>
                  </button>

                  <button
                    onClick={handleSaveMatrix}
                    disabled={isSaving || !hasUnsavedChanges}
                    className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 shadow-xs ${
                      hasUnsavedChanges
                        ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-600/30 ring-2 ring-brand-400/40'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Matrix *' : 'Saved'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Legend & Module Filter Bar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchModule}
                onChange={(e) => setSearchModule(e.target.value)}
                placeholder="Search module (e.g. Quotation)..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
              <span className="font-bold text-slate-800">Action Keys:</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> View (Read)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Create
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Edit
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Delete
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> Approve
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-500" /> Export
              </span>
            </div>
          </div>

          {/* Permission Matrix Table */}
          <div className="border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden text-xs">
            {isLoading || !matrix ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">
                  Loading granular access matrix...
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Zero-Scroll Table */}
                <div className="hidden md:block w-full">
                  <table className="w-full text-left border-collapse table-fixed">
                    <colgroup>
                      <col className="w-[30%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[16%]" />
                    </colgroup>
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-3">ERP Functional Module</th>
                        <th className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>View</span>
                          </div>
                        </th>
                        <th className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>Create</span>
                          </div>
                        </th>
                        <th className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span>Edit</span>
                          </div>
                        </th>
                        <th className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span>Delete</span>
                          </div>
                        </th>
                        <th className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            <span>Approve</span>
                          </div>
                        </th>
                        <th className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-slate-500" />
                            <span>Export</span>
                          </div>
                        </th>
                        <th className="py-3 px-3 text-right">Row Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredModules.map((moduleName) => {
                        const rolePerms = matrix[selectedRole]?.[moduleName] || {
                          view: false,
                          create: false,
                          edit: false,
                          delete: false,
                          approve: false,
                          export: false,
                        };

                        const allActiveInRow = ALL_PERMISSION_ACTIONS.every(
                          (act) => Boolean(rolePerms[act])
                        );

                        return (
                          <tr
                            key={moduleName}
                            className="hover:bg-slate-50/70 transition duration-100"
                          >
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs truncate">
                                  {moduleName}
                                </span>
                                {(moduleName === 'User Management' ||
                                  moduleName === 'Role & Permission Management') &&
                                  (selectedRole === 'Managing Director' ||
                                    selectedRole === 'Admin / BDM') && (
                                    <span
                                      title="System Protected Permission: Mandatory for Administrators"
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold shrink-0"
                                    >
                                      <Lock className="w-2.5 h-2.5" />
                                      <span>Protected</span>
                                    </span>
                                  )}
                              </div>
                            </td>

                            {ALL_PERMISSION_ACTIONS.map((action) => {
                              const isChecked = Boolean(rolePerms[action]);
                              const locked = isActionLocked(moduleName, action);

                              return (
                                <td key={action} className="py-3 px-2 text-center">
                                  <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => handleToggle(moduleName, action)}
                                    title={
                                      locked
                                        ? 'Mandatory permission for administrative role to prevent accidental lockout'
                                        : `Click to toggle ${action} access on ${moduleName}`
                                    }
                                    className={`w-6 h-6 rounded-lg border inline-flex items-center justify-center transition ${
                                      isChecked
                                        ? 'bg-brand-600 border-brand-700 text-white shadow-xs'
                                        : 'bg-white border-slate-300 text-transparent hover:border-slate-400'
                                    } ${
                                      locked
                                        ? 'opacity-80 cursor-not-allowed bg-slate-700 border-slate-800 text-white'
                                        : 'cursor-pointer'
                                    }`}
                                  >
                                    {isChecked && (
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    )}
                                  </button>
                                </td>
                              );
                            })}

                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleRowAll(moduleName, !allActiveInRow)
                                }
                                className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
                              >
                                {allActiveInRow ? 'Clear All' : 'Select All'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Permission Matrix Cards */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {filteredModules.map((moduleName) => {
                    const rolePerms = matrix[selectedRole]?.[moduleName] || {
                      view: false,
                      create: false,
                      edit: false,
                      delete: false,
                      approve: false,
                      export: false,
                    };

                    const allActiveInRow = ALL_PERMISSION_ACTIONS.every(
                      (act) => Boolean(rolePerms[act])
                    );

                    return (
                      <div key={moduleName} className="p-4 space-y-3 bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 text-sm">{moduleName}</span>
                          {(moduleName === 'User Management' ||
                            moduleName === 'Role & Permission Management') &&
                            (selectedRole === 'Managing Director' ||
                              selectedRole === 'Admin / BDM') && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold shrink-0">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Protected</span>
                              </span>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {ALL_PERMISSION_ACTIONS.map((action) => {
                            const isChecked = Boolean(rolePerms[action]);
                            const locked = isActionLocked(moduleName, action);

                            return (
                              <button
                                key={action}
                                type="button"
                                disabled={locked}
                                onClick={() => handleToggle(moduleName, action)}
                                className={`min-h-[44px] px-2 py-1.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition ${
                                  isChecked
                                    ? 'bg-brand-50 border-brand-300 text-brand-800'
                                    : 'bg-slate-50 border-slate-200 text-slate-500'
                                } ${locked ? 'opacity-70 cursor-not-allowed' : ''}`}
                              >
                                <span className="capitalize">{action}</span>
                                <span
                                  className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                                    isChecked
                                      ? 'bg-brand-600 text-white'
                                      : 'border border-slate-300 bg-white'
                                  }`}
                                >
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleRowAll(moduleName, !allActiveInRow)}
                          className="w-full py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                        >
                          {allActiveInRow ? 'Clear All Actions' : 'Select All Actions'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Bottom Sticky Action Bar if changes pending */}
          {hasUnsavedChanges && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  You have unsaved permission modifications for role &quot;{selectedRole}&quot;. Save before leaving this page.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsLoading(true);
                    getRolePermissionMatrix().then((res) => {
                      setMatrix(res);
                      setHasUnsavedChanges(false);
                      setIsLoading(false);
                      showToast('success', 'Changes discarded.');
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100/60 text-amber-800 text-xs font-semibold transition"
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveMatrix}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-sm transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving Changes...' : 'Save Permissions'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INDIVIDUAL USER OVERRIDES & TEMPORARY ACCESS */}
      {activeTab === 'USER_OVERRIDES' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* User Selector Header */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Select Employee to Inspect Access
                </span>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="mt-0.5 text-sm font-bold text-slate-900 border border-slate-200 rounded-xl px-3 py-1.5 outline-none bg-white focus:ring-2 focus:ring-brand-500"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.role} ({u.department || 'Operations'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedUserObj && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTempForm({
                      module: 'Quotations',
                      action: 'approve',
                      granted: true,
                      isTemporary: true,
                      startDate: new Date().toISOString().split('T')[0],
                      endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] + 'T23:59',
                      reason: '',
                    });
                    setIsTempModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                >
                  <Clock className="w-4 h-4" />
                  <span>Grant Temporary Access</span>
                </button>
              </div>
            )}
          </div>

          {/* User Meta Card & Active Overrides Summary */}
          {selectedUserObj && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Base Assigned Role
                </span>
                <div className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-brand-600" />
                  {selectedUserObj.role}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Account Status
                </span>
                <div className="text-base font-bold text-emerald-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {selectedUserObj.status} (Login: {selectedUserObj.can_login ? 'Yes' : 'No'})
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Active Overrides
                </span>
                <div className="text-base font-bold text-blue-600">
                  {userOverridesList.length} defined
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Department
                </span>
                <div className="text-base font-bold text-slate-700">
                  {selectedUserObj.department || 'Operations'}
                </div>
              </div>
            </div>
          )}

          {/* Legend for Badges */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="font-bold text-slate-800">Source Indicators:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium">
              Inherited From Role
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
              <PlusCircle className="w-3 h-3 text-emerald-600" />
              Extra Access (+)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-bold">
              <MinusCircle className="w-3 h-3 text-rose-600" />
              Restricted (-)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold">
              <Clock className="w-3 h-3 text-amber-600" />
              Temporary Access
            </span>
          </div>

          {/* Active Overrides Table (if any) */}
          {userOverridesList.length > 0 && (
            <div className="border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden text-xs">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex items-center justify-between">
                <span>Active Individual Overrides & Temporary Grants ({userOverridesList.length})</span>
              </div>
              {/* Desktop Zero-Scroll Overrides Table */}
              <div className="hidden md:block w-full">
                <table className="w-full text-left border-collapse table-fixed">
                  <colgroup>
                    <col className="w-[24%]" />
                    <col className="w-[20%]" />
                    <col className="w-[18%]" />
                    <col className="w-[22%]" />
                    <col className="w-[10%]" />
                    <col className="w-[6%]" />
                  </colgroup>
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Module & Action</th>
                      <th className="py-2.5 px-3">Type & Status</th>
                      <th className="py-2.5 px-3">Validity / Expiry</th>
                      <th className="py-2.5 px-3">Business Justification</th>
                      <th className="py-2.5 px-3">Granted By</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {userOverridesList.map((ovr) => {
                      const isExpired =
                        ovr.isTemporary && ovr.endDate && Date.now() > new Date(ovr.endDate).getTime();

                      return (
                        <tr key={ovr.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900">{ovr.module}</span>
                            <span className="text-slate-400 mx-1.5">/</span>
                            <span className="uppercase font-mono text-[11px] font-bold text-brand-600">
                              {ovr.action}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {ovr.isTemporary ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                                  isExpired
                                    ? 'bg-slate-100 text-slate-500 border-slate-200'
                                    : 'bg-amber-100 text-amber-800 border-amber-200'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                {isExpired ? 'Expired' : 'Temporary'}
                              </span>
                            ) : ovr.granted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                                <PlusCircle className="w-3 h-3 text-emerald-600" />
                                Extra (+)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-bold">
                                <MinusCircle className="w-3 h-3 text-rose-600" />
                                Restricted (-)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600 text-[11px]">
                            {ovr.isTemporary ? (
                              <div>
                                <span>Until: {ovr.endDate?.replace('T', ' ')}</span>
                                {isExpired && <span className="text-rose-600 font-bold block">(Expired)</span>}
                              </div>
                            ) : (
                              <span>Permanent Override</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-700 italic truncate">{ovr.reason}</td>
                          <td className="py-3 px-3 text-slate-500 text-[11px] truncate">{ovr.grantedBy}</td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveOverride(ovr.id)}
                              title="Remove Override (Restore Role Default)"
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Active Overrides Cards */}
              <div className="block md:hidden divide-y divide-slate-100">
                {userOverridesList.map((ovr) => {
                  const isExpired =
                    ovr.isTemporary && ovr.endDate && Date.now() > new Date(ovr.endDate).getTime();

                  return (
                    <div key={ovr.id} className="p-4 space-y-2 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <strong className="text-slate-900 block font-bold text-sm">{ovr.module}</strong>
                          <span className="uppercase font-mono text-[11px] font-bold text-brand-600">
                            Action: {ovr.action}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveOverride(ovr.id)}
                          title="Remove Override"
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {ovr.isTemporary ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                              isExpired
                                ? 'bg-slate-100 text-slate-500 border-slate-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {isExpired ? 'Expired' : 'Temporary'}
                          </span>
                        ) : ovr.granted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                            Extra (+)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-bold">
                            Restricted (-)
                          </span>
                        )}
                        <span className="text-slate-500 text-[11px]">
                          {ovr.isTemporary ? `Until: ${ovr.endDate?.replace('T', ' ')}` : 'Permanent'}
                        </span>
                      </div>

                      {ovr.reason && (
                        <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 italic">
                          &ldquo;{ovr.reason}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* User Effective Permissions Matrix */}
          <div className="border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden text-xs">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex items-center justify-between">
              <span>
                Effective Access Matrix for {selectedUserObj?.name} ({selectedUserObj?.role})
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                Calculated in real-time from Base Role + Individual Overrides
              </span>
            </div>

            {!userEffective ? (
              <div className="py-12 text-center text-slate-400">Loading user effective access...</div>
            ) : (
              <>
                {/* Desktop Zero-Scroll Effective Matrix */}
                <div className="hidden md:block w-full">
                  <table className="w-full text-left border-collapse table-fixed">
                    <colgroup>
                      <col className="w-[40%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">ERP Module</th>
                        <th className="py-2.5 px-2 text-center">View</th>
                        <th className="py-2.5 px-2 text-center">Create</th>
                        <th className="py-2.5 px-2 text-center">Edit</th>
                        <th className="py-2.5 px-2 text-center">Delete</th>
                        <th className="py-2.5 px-2 text-center">Approve</th>
                        <th className="py-2.5 px-2 text-center">Export</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ALL_ERP_MODULES.map((modName) => {
                        const modPerms = userEffective[modName];

                        return (
                          <tr key={modName} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-3 font-bold text-slate-900 truncate">{modName}</td>
                            {ALL_PERMISSION_ACTIONS.map((action) => {
                              const info = modPerms?.[action];
                              const isAllowed = Boolean(info?.allowed);

                              let badge = (
                                <span
                                  title="Inherited From Role"
                                  className={`w-5 h-5 rounded inline-flex items-center justify-center text-[10px] font-bold ${
                                    isAllowed ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-300'
                                  }`}
                                >
                                  {isAllowed ? '✓' : '—'}
                                </span>
                              );

                              if (info?.source === 'INDIVIDUAL_ADD') {
                                badge = (
                                  <span
                                    title={`Extra Access Granted: ${info.reason || ''}`}
                                    className="w-5 h-5 rounded inline-flex items-center justify-center text-[10px] font-bold bg-emerald-500 text-white shadow-xs"
                                  >
                                    +
                                  </span>
                                );
                              } else if (info?.source === 'INDIVIDUAL_RESTRICT') {
                                badge = (
                                  <span
                                    title={`Restricted Access: ${info.reason || ''}`}
                                    className="w-5 h-5 rounded inline-flex items-center justify-center text-[10px] font-bold bg-rose-500 text-white shadow-xs"
                                  >
                                    ✕
                                  </span>
                                );
                              } else if (info?.source === 'TEMPORARY_ADD') {
                                badge = (
                                  <span
                                    title={`Temporary Access (Expires: ${info.expiresAt}): ${info.reason || ''}`}
                                    className="w-5 h-5 rounded inline-flex items-center justify-center text-[10px] font-bold bg-amber-500 text-white shadow-xs"
                                  >
                                    ⏳
                                  </span>
                                );
                              } else if (info?.source === 'TEMPORARY_EXPIRED') {
                                badge = (
                                  <span
                                    title="Temporary Access Expired (Reverted to Role)"
                                    className="w-5 h-5 rounded inline-flex items-center justify-center text-[10px] font-bold bg-slate-400 text-white"
                                  >
                                    ⏱
                                  </span>
                                );
                              }

                              return (
                                <td key={action} className="py-2.5 px-2 text-center">
                                  {badge}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Effective Matrix Cards */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {ALL_ERP_MODULES.map((modName) => {
                    const modPerms = userEffective[modName];

                    return (
                      <div key={modName} className="p-3 bg-white space-y-2">
                        <strong className="block text-slate-900 font-bold text-xs">{modName}</strong>
                        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                          {ALL_PERMISSION_ACTIONS.map((action) => {
                            const info = modPerms?.[action];
                            const isAllowed = Boolean(info?.allowed);
                            return (
                              <div
                                key={action}
                                className={`p-1.5 rounded-lg border flex items-center justify-between ${
                                  isAllowed ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/50 border-slate-100 text-slate-400'
                                }`}
                              >
                                <span className="capitalize">{action}</span>
                                <span className="font-bold">{isAllowed ? '✓' : '—'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Grant Temporary Access / Individual Override */}
      {isTempModalOpen && selectedUserObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                <span>Configure Access Override for {selectedUserObj.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTempModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Module</label>
                  <select
                    value={tempForm.module}
                    onChange={(e) => setTempForm({ ...tempForm, module: e.target.value as ERPModule })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-800"
                  >
                    {ALL_ERP_MODULES.map((mod) => (
                      <option key={mod} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Action Permission</label>
                  <select
                    value={tempForm.action}
                    onChange={(e) => setTempForm({ ...tempForm, action: e.target.value as PermissionAction })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-800"
                  >
                    {ALL_PERMISSION_ACTIONS.map((act) => (
                      <option key={act} value={act}>
                        {act.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Override Type</label>
                  <select
                    value={tempForm.granted ? 'GRANT' : 'RESTRICT'}
                    onChange={(e) => setTempForm({ ...tempForm, granted: e.target.value === 'GRANT' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-800"
                  >
                    <option value="GRANT">Grant Extra Access (+)</option>
                    <option value="RESTRICT">Restrict Access (-)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duration</label>
                  <select
                    value={tempForm.isTemporary ? 'TEMP' : 'PERM'}
                    onChange={(e) => setTempForm({ ...tempForm, isTemporary: e.target.value === 'TEMP' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-800"
                  >
                    <option value="TEMP">Temporary (Auto-Expiring)</option>
                    <option value="PERM">Permanent Override</option>
                  </select>
                </div>
              </div>

              {tempForm.isTemporary && (
                <div className="grid grid-cols-2 gap-3 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                  <div>
                    <label className="block font-semibold text-amber-900 mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={tempForm.startDate}
                      onChange={(e) => setTempForm({ ...tempForm, startDate: e.target.value })}
                      className="w-full px-3 py-1.5 border border-amber-300 rounded-lg outline-none bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-amber-900 mb-1">End Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={tempForm.endDate}
                      onChange={(e) => setTempForm({ ...tempForm, endDate: e.target.value })}
                      className="w-full px-3 py-1.5 border border-amber-300 rounded-lg outline-none bg-white text-xs"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mandatory Business Justification / Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Covering for senior sales manager on medical leave until Friday..."
                  value={tempForm.reason}
                  onChange={(e) => setTempForm({ ...tempForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Logged in security audit trail. Minimum 5 characters required.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTempModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold shadow-sm"
                >
                  Confirm & Apply Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
