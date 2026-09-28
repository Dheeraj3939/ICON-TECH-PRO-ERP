'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  Users,
  Shield,
  KeyRound,
  Sliders,
  Layers,
  Percent,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  UserPlus,
  Lock,
  Unlock,
  AlertTriangle,
  HelpCircle,
  Building2,
  FileCheck2,
  Activity,
  UserCheck,
  UserX,
  ShieldCheck,
  RefreshCw,
  Eye,
  Plus,
  Mail,
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';
import { getManagedUsers } from '@/lib/actions/users';
import {
  getRoles,
  getModuleAccessSummary,
  getEmployeeAccessSummary,
  getExpiringTemporaryAccess,
} from '@/lib/actions/permissions';
import { getApprovalRequests, processApprovalRequest } from '@/lib/actions/approvals';
import { getDropdownOptions } from '@/lib/actions/dropdowns';
import { getCustomFields } from '@/lib/actions/custom-fields';
import { getAuditLogs } from '@/lib/actions/analytics';
import { AddEmployeeModal } from '@/components/admin/AddEmployeeModal';
import { ALL_ERP_MODULES, type ERPModule, type PermissionAction, type AppRole, type ManagedUser } from '@/types/rbac';

export default function UnifiedSettingsOverviewPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [dropdownCount, setDropdownCount] = useState(0);
  const [fieldCount, setFieldCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [recentAudits, setRecentAudits] = useState<any[]>([]);
  const [expiringAccess, setExpiringAccess] = useState<any[]>([]);

  // Bidirectional Who Has Access State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<ERPModule>('Purchases');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [moduleAccess, setModuleAccess] = useState<{
    roles: { role_name: string; actions: PermissionAction[] }[];
    overrides: { userId: string; action: PermissionAction; granted: boolean; reason: string; isTemporary?: boolean; expiresAt?: string }[];
  } | null>(null);
  const [employeeAccess, setEmployeeAccess] = useState<any | null>(null);

  const [loading, setLoading] = useState(true);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [uRes, rRes, apprRes, ddList, fldList, auditLogs, expRes] = await Promise.all([
        getManagedUsers(),
        getRoles(),
        getApprovalRequests(),
        getDropdownOptions(),
        getCustomFields(),
        getAuditLogs(),
        getExpiringTemporaryAccess(7),
      ]);

      setUsers(uRes.users);
      setRoles(rRes.roles);
      setPendingApprovals(apprRes.requests.filter((a: any) => a.status === 'PENDING'));
      setDropdownCount(ddList.length);
      setFieldCount(fldList.length);
      setRecentAudits(auditLogs.slice(0, 5));
      setExpiringAccess(expRes.expiring);

      if (uRes.users.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(uRes.users[0].id);
        const empSummary = await getEmployeeAccessSummary(uRes.users[0].id, uRes.users[0].role);
        setEmployeeAccess(empSummary);
      }

      const accessSummary = await getModuleAccessSummary(selectedModule);
      setModuleAccess(accessSummary);
    } catch (err) {
      console.error('Failed to load administration overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleModuleChange = async (mod: ERPModule) => {
    setSelectedModule(mod);
    const summary = await getModuleAccessSummary(mod);
    setModuleAccess(summary);
  };

  const handleEmployeeChange = async (userId: string) => {
    setSelectedEmployeeId(userId);
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser) {
      const summary = await getEmployeeAccessSummary(targetUser.id, targetUser.role);
      setEmployeeAccess(summary);
    }
  };

  const handleQuickApproval = async (requestId: string, approved: boolean) => {
    const action = approved ? 'APPROVE' : 'REJECT';
    const res = await processApprovalRequest(
      requestId,
      action,
      approved ? 'Approved via Administration Center' : 'Rejected via Administration Center'
    );
    if (res.success) {
      setActionMessage(`Approval request #${requestId} ${approved ? 'approved' : 'rejected'}.`);
      setTimeout(() => setActionMessage(null), 4000);
      loadData();
    }
  };

  // Status metrics
  const activeEmployees = users.filter((u) => u.status === 'ACTIVE' && u.can_login).length;
  const pendingEmployees = users.filter((u) => u.status === 'PENDING' || u.status === 'INVITED').length;
  const suspendedEmployees = users.filter((u) => u.status === 'SUSPENDED' || u.status === 'DEACTIVATED' || !u.can_login).length;
  const permissionAuditCount = recentAudits.filter(
    (a) => a.action?.includes('PERMISSION') || a.action?.includes('OVERRIDE') || a.action?.includes('ROLE')
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Administration Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              Enterprise v9.2
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centralized business control for staff identities, roles & access, approval rules, dynamic custom fields, and governance
          </p>
        </div>

        {/* Primary Quick Action */}
        <button
          type="button"
          onClick={() => setIsAddEmployeeOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Add Employee</span>
        </button>
      </div>

      <SettingsNav />

      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* QUICK ACTIONS BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
          Administrative Quick Actions
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddEmployeeOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Add Employee</span>
          </button>
          <Link
            href="/dashboard/employees"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Manage Employees</span>
          </Link>
          <Link
            href="/dashboard/settings/roles"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span>Manage Roles</span>
          </Link>
          <Link
            href="/dashboard/settings/permissions"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
            <span>Manage Access</span>
          </Link>
          <Link
            href="/dashboard/settings/company"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Company Profile</span>
          </Link>
          <Link
            href="/dashboard/settings/document-settings"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Document Settings</span>
          </Link>
          <Link
            href="/dashboard/settings/integrations"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            <span>Integrations (Gmail)</span>
          </Link>
          <Link
            href="/dashboard/settings/discount-rules"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <Percent className="w-3.5 h-3.5 text-slate-500" />
            <span>Approval Rules</span>
          </Link>
          <Link
            href="/dashboard/settings/fields"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Custom Fields</span>
          </Link>
          <Link
            href="/dashboard/settings/dropdowns"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Dropdown Options</span>
          </Link>
          <Link
            href="/dashboard/settings/backup"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span>Backup &amp; Health</span>
          </Link>
          <Link
            href="/dashboard/settings/security"
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <Lock className="w-3.5 h-3.5 text-rose-600" />
            <span>Danger Zone</span>
          </Link>
          <Link
            href="/dashboard/audit"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
            <span>Audit Log</span>
          </Link>
        </div>
      </div>

      {/* ADMINISTRATIVE STATUS KPI DECK */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Staff</span>
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">{activeEmployees}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">Active & Logged In</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 mt-1">{pendingEmployees}</div>
          <span className="text-[10px] text-slate-500">Awaiting Setup</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suspended</span>
            <UserX className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-500 mt-1">{suspendedEmployees}</div>
          <span className="text-[10px] text-slate-400">History Preserved</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recent Changes</span>
            <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
          </div>
          <div className="text-xl font-black text-brand-700 mt-1">{permissionAuditCount}</div>
          <span className="text-[10px] text-slate-500">Permission Audits</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Reviews</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-purple-700 mt-1">{pendingApprovals.length}</div>
          <span className="text-[10px] text-slate-500">Discount Escalations</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Status</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-xl font-black text-emerald-700 mt-1">100%</div>
          <span className="text-[10px] text-emerald-600 font-semibold">Zero Warnings</span>
        </div>
      </div>

      {/* 9 ADMINISTRATIVE SECTIONS (CARD DIRECTORY) */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Administration Sections
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. EMPLOYEES */}
          <Link
            href="/dashboard/employees"
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-brand-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">1. Employees</h3>
            <p className="text-xs text-slate-500 mt-1">
              Staff directory, personal & corporate details, employee IDs, department assignments, and status.
            </p>
          </Link>

          {/* 2. ROLES & ACCESS */}
          <Link
            href="/dashboard/settings/roles"
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-brand-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">2. Roles & Access</h3>
            <p className="text-xs text-slate-500 mt-1">
              System & custom security roles, granular module permissions, individual additions, and temporary access.
            </p>
          </Link>

          {/* 3. APPROVAL RULES */}
          <Link
            href="/dashboard/settings/discount-rules"
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-brand-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Percent className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">3. Approval Rules</h3>
            <p className="text-xs text-slate-500 mt-1">
              Commercial discount thresholds, multi-tier escalation ladders (Sales &le; 5%, BDM &le; 10%, MD &gt; 10%).
            </p>
          </Link>

          {/* 4. CUSTOM FIELDS */}
          <Link
            href="/dashboard/settings/fields"
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-brand-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">4. Custom Fields</h3>
            <p className="text-xs text-slate-500 mt-1">
              Form extension fields for Customers, Quotations, Orders, and Service without database alterations.
            </p>
          </Link>

          {/* 5. DROPDOWN OPTIONS */}
          <Link
            href="/dashboard/settings/dropdowns"
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-brand-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                <Sliders className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">5. Dropdown Options</h3>
            <p className="text-xs text-slate-500 mt-1">
              Manage dropdowns for Enquiry Sources, Customer Industries, Payment Modes, and Room Types.
            </p>
          </Link>

          {/* 6. COMPANY SETTINGS */}
          <Link
            href="/dashboard/settings/company"
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-brand-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">6. Company Settings</h3>
            <p className="text-xs text-slate-500 mt-1">
              Legal entity, GSTIN, PAN, bank remittance accounts, and commercial terms.
            </p>
          </Link>

          {/* 7. DOCUMENT SETTINGS */}
          <Link
            href="/dashboard/settings/document-settings"
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-brand-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">7. Document Settings</h3>
            <p className="text-xs text-slate-500 mt-1">
              Collision-safe numbering prefixes (QTN, ORD, INV, DC, SRV) and print rules.
            </p>
          </Link>

          {/* 8. AUDIT LOG */}
          <Link
            href="/dashboard/audit"
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-brand-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">8. Audit Log</h3>
            <p className="text-xs text-slate-500 mt-1">
              Append-only immutable audit trail recording WHO, WHAT, WHEN, OLD VALUE, NEW VALUE, and REASON.
            </p>
          </Link>

          {/* 9. SYSTEM HEALTH & BACKUP */}
          <Link
            href="/dashboard/settings/backup"
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-brand-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Activity className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">9. Backup &amp; Health</h3>
            <p className="text-xs text-slate-500 mt-1">
              Frozen restore point verification, Supabase database health, and migration tracking.
            </p>
          </Link>

          {/* 10. SECURITY CONTROLS & DANGER ZONE */}
          <Link
            href="/dashboard/settings/security"
            className="p-5 rounded-2xl bg-white border border-rose-200/80 shadow-xs hover:border-rose-400 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">10. Security &amp; Danger Zone</h3>
            <p className="text-xs text-slate-500 mt-1">
              Force session invalidation, account locking, and emergency temporary access revocation.
            </p>
          </Link>
        </div>
      </div>

      {/* PROACTIVE WARNING: TEMPORARY ACCESS EXPIRING SOON */}
      {expiringAccess.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <strong className="text-amber-900 font-bold">
                PROACTIVE SECURITY ALERT: Temporary Access Expiring Soon ({expiringAccess.length} delegation{expiringAccess.length > 1 ? 's' : ''})
              </strong>
            </div>
            <Link
              href="/dashboard/settings/permissions"
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition shadow-2xs self-start sm:self-auto"
            >
              Review in Matrix
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {expiringAccess.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl border bg-white ${
                  item.isExpired ? 'border-rose-200 text-rose-900' : 'border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900">{item.userName}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      item.isExpired ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.isExpired ? 'EXPIRED' : `${item.daysRemaining}d remaining`}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600">
                  <span>Module: <strong>{item.module}</strong> ({item.action})</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 italic truncate">
                  Reason: &quot;{item.reason}&quot;
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Expires: {new Date(item.endDate).toLocaleDateString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WHO HAS ACCESS? BIDIRECTIONAL INSPECTOR */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Who Has Access? (Permission Inspector)</h3>
              <p className="text-xs text-slate-500">
                Bidirectional search: inspect by Module (who can access it) or by Employee (what they can access)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedModule}
              onChange={(e) => handleModuleChange(e.target.value as ERPModule)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {ALL_ERP_MODULES.map((m) => (
                <option key={m} value={m}>
                  Module: {m}
                </option>
              ))}
            </select>

            <select
              value={selectedEmployeeId}
              onChange={(e) => handleEmployeeChange(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  Employee: {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FORWARD LOOKUP: Who can access Module X? */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Roles Authorized for &quot;{selectedModule}&quot;</span>
              <span className="text-[11px] font-normal text-slate-400">
                {moduleAccess?.roles.length || 0} Roles
              </span>
            </h4>

            {moduleAccess && moduleAccess.roles.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {moduleAccess.roles.map((r, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between bg-slate-50/40">
                    <span className="font-bold text-slate-900">{r.role_name}</span>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {r.actions.map((act) => (
                        <span
                          key={act}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[10px] font-mono font-semibold"
                        >
                          {act}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border">
                No roles currently authorized for {selectedModule}.
              </div>
            )}

            {/* Individual Overrides for this module */}
            {moduleAccess && moduleAccess.overrides.length > 0 && (
              <div className="pt-2">
                <h5 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Individual Overrides &amp; Temporary Access
                </h5>
                <div className="space-y-1.5">
                  {moduleAccess.overrides.map((ov, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border text-xs flex items-center justify-between bg-white border-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        {ov.isTemporary ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            TEMPORARY ({ov.action})
                          </span>
                        ) : ov.granted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            + ADD ({ov.action})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            - RESTRICT ({ov.action})
                          </span>
                        )}
                        <span className="font-mono text-slate-700 text-[11px]">User: {ov.userId}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 italic max-w-xs truncate">
                        {ov.reason} {ov.expiresAt ? `(Expires: ${ov.expiresAt})` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* REVERSE LOOKUP: What can Employee Y access? */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Access Profile: {employeeAccess?.userId || 'Employee'}</span>
              <span className="text-[11px] font-normal text-slate-400">
                Role: {employeeAccess?.roleName}
              </span>
            </h4>

            {employeeAccess && employeeAccess.modules.length > 0 ? (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl text-xs">
                {employeeAccess.modules.map((m: any) => (
                  <div key={m.module} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <span className="font-bold text-slate-900 block">{m.module}</span>
                      {m.overrides.length > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {m.overrides.map((ov: any, oIdx: number) => (
                            <span
                              key={oIdx}
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                ov.source === 'TEMPORARY_ADD'
                                  ? 'bg-amber-100 text-amber-800'
                                  : ov.source === 'INDIVIDUAL_ADD'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {ov.source === 'TEMPORARY_ADD' ? 'TEMP' : ov.source === 'INDIVIDUAL_ADD' ? '+ADD' : '-RESTRICT'} ({ov.action})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          m.level === 'FULL'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : m.level === 'LIMITED'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {m.level === 'FULL' ? 'FULL ACCESS' : m.level === 'LIMITED' ? 'LIMITED ACCESS' : 'NO ACCESS'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border">
                Select an employee above to view their effective access profile.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADMINISTRATIVE ACTION QUEUE (APPROVALS) */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Administrative Action Queue</h3>
              <p className="text-xs text-slate-500">Pending operational and commercial discount approvals</p>
            </div>
          </div>

          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
            {pendingApprovals.length} Pending
          </span>
        </div>

        <div className="space-y-2.5 pt-1">
          {pendingApprovals.length > 0 ? (
            pendingApprovals.map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{req.approval_type}</span>
                  <span className="font-mono text-brand-700 text-[11px] font-bold">{req.entity_number}</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Requested by: <strong className="text-slate-800">{req.requested_by_name}</strong> • Value: {req.requested_value}
                </p>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => handleQuickApproval(req.id, false)}
                    className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold hover:bg-rose-100 transition text-[11px]"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickApproval(req.id, true)}
                    className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition text-[11px] shadow-2xs"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-xl text-xs text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
              <strong className="block text-slate-700 font-bold text-xs">All clear!</strong>
              <span>Zero pending administrative approvals in the queue.</span>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding Modal */}
      <AddEmployeeModal
        isOpen={isAddEmployeeOpen}
        onClose={() => setIsAddEmployeeOpen(false)}
        roles={roles}
        onSuccess={(msg) => {
          setActionMessage(msg);
          loadData();
        }}
      />
    </div>
  );
}
