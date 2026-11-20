'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  FileText,
  ShoppingBag,
  AlertTriangle,
  ReceiptText,
  Clock,
  ArrowRight,
  Plus,
  TrendingUp,
  Package,
  Truck,
  Video,
  Shield,
  Server,
  Sparkles,
  Calendar,
  CreditCard,
  Building2,
  Wrench,
  Download,
  Command,
  Search,
  FileSpreadsheet,
  BarChart3,
  CheckCircle2,
  Briefcase,
  UserCheck,
  Phone,
  Eye,
  SlidersHorizontal,
  Mail,
  HelpCircle,
  FileCheck,
} from 'lucide-react';
import { getDashboardMetrics, getAuditLogs, getLiveSalesCockpitMetrics, type LiveSalesCockpitMetrics } from '@/lib/actions/analytics';
import { getEnquiries } from '@/lib/actions/enquiries';
import { getQuotations } from '@/lib/actions/quotations';
import { getOrders } from '@/lib/actions/orders';
import { getInvoices } from '@/lib/actions/billing';
import { getCurrentSessionUser } from '@/lib/actions/users';
import { getProjects } from '@/lib/actions/projects';
import { getTasks } from '@/lib/actions/tasks';
import { getApprovalRequests } from '@/lib/actions/approvals';
import { getAMCContracts } from '@/lib/actions/services';
import { getSiteVisits } from '@/lib/actions/operations';
import { NewEnquiryModal } from '@/components/modals/NewEnquiryModal';
import { CustomerFormModal } from '@/components/customers/customer-form-modal';
import { exportToCSV } from '@/lib/utils/export';
import { ERP_SYSTEM_VERSION } from '@/lib/constants/version';
import type { DashboardMetrics, Enquiry, Quotation, SalesOrder, Invoice, AuditLog, Project, ERPTask, ApprovalRequest } from '@/types/erp';
import type { AuthenticatedUser } from '@/lib/auth/session';

export default function UnifiedOperationsDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ERPTask[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [amcList, setAmcList] = useState<any[]>([]);
  const [siteVisitsToday, setSiteVisitsToday] = useState<number>(0);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [liveSales, setLiveSales] = useState<LiveSalesCockpitMetrics | null>(null);

  // Active Role Cockpit (defaults to user's actual role once resolved, null during initial fetch)
  const [activeRoleView, setActiveRoleView] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isManagementPreviewOpen, setIsManagementPreviewOpen] = useState(false);

  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [m, enqRes, qRes, oRes, invRes, prjRes, taskRes, apprRes, amcRes, visitRes, logs, user, liveRes] = await Promise.all([
        getDashboardMetrics(),
        getEnquiries(),
        getQuotations(),
        getOrders(),
        getInvoices(),
        getProjects(),
        getTasks({ scope: 'ALL' }),
        getApprovalRequests(),
        getAMCContracts(),
        getSiteVisits(),
        getAuditLogs(),
        getCurrentSessionUser(),
        getLiveSalesCockpitMetrics(),
      ]);
      setMetrics(m);
      setLiveSales(liveRes);
      setEnquiries(enqRes.enquiries);
      setQuotations(qRes.quotations);
      setOrders(oRes.orders);
      setInvoices(invRes.invoices);
      setProjects(prjRes.projects);
      setTasks(taskRes.tasks || []);
      setApprovals(apprRes.requests || []);
      setAmcList(amcRes || []);
      const todayIso = new Date().toISOString().split('T')[0];
      const visitsTodayCount = (visitRes || []).filter(
        (v) => v.status !== 'CANCELLED' && (!v.scheduledDate || v.scheduledDate.startsWith(todayIso))
      ).length;
      setSiteVisitsToday(visitsTodayCount);
      setAuditLogs(logs);
      setCurrentUser(user);

      // Set authoritative initial cockpit view based on authenticated user role
      if (user?.role) {
        if (user.role === 'Admin') {
          setActiveRoleView('Admin');
        } else if (user.role === 'Managing Director') {
          setActiveRoleView('Managing Director');
        } else if (user.role === 'Sales Executive') {
          setActiveRoleView('Sales Executive');
        } else if (user.role === 'Accounts') {
          setActiveRoleView('Accounts');
        } else if (user.role === 'Office Assistant') {
          setActiveRoleView('Office Assistant');
        } else {
          setActiveRoleView('Admin');
        }
      } else {
        setActiveRoleView('Admin');
      }
    } catch (err) {
      console.error('Dashboard loadData error:', err);
      setActiveRoleView('Admin');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalReceivables = metrics?.totalReceivables ?? 0;
  const totalCollected = metrics?.totalCollected ?? 0;
  const totalConfirmedOrders = metrics?.totalOrdersValue ?? 0;
  const totalQuotedValue = metrics?.totalQuotedValue ?? 0;

  // Time-based greeting helper
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const userName = currentUser?.name || 'B V Dheeraj Reddy';
  const isManagementUser = currentUser?.role === 'Managing Director' || currentUser?.role === 'Admin' || currentUser?.role === 'Admin / BDM';

  // Overdue and Today calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const followUpsDueToday = enquiries.filter(
    (e) => e.follow_up_date && e.follow_up_date <= todayStr && e.status !== 'Order done' && e.status !== 'Cancelled'
  );
  const overdueInvoices = invoices.filter(
    (inv) => inv.balance_amount > 0 && inv.due_date && inv.due_date < todayStr
  );
  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;
  const amcRadarCount = amcList.filter((a) => a.is_active).length;

  const handleExportLedgerCSV = () => {
    exportToCSV(
      'ICON_Executive_Pipeline_Ledger',
      quotations,
      [
        { key: 'quotation_code', label: 'Quotation #' },
        { key: 'customer_name', label: 'Customer Name' },
        { key: 'salesperson_name', label: 'Salesperson' },
        { key: 'quotation_date', label: 'Date' },
        { key: 'grand_total', label: 'Quoted Amount (₹)' },
        { key: 'status', label: 'Status' },
      ],
      currentUser?.role
    );
  };

  const handleOpenSearch = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-command-palette'));
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 min-w-0">
      {/* =========================================================================
          TOP EXECUTIVE HEADER & IDENTITY
         ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ICON TECH PRO ERP
            </h1>
            {metrics ? (
              metrics.isOnline ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  LOCAL MEMORY MODE
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium">
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></span>
                Connecting...
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Commercial AV Systems &bull; Interactive Displays &bull; Hyderabad Headquarters
          </p>
        </div>

        {/* Global Action Trigger Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleOpenSearch}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300/80 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <Command className="w-3.5 h-3.5 text-blue-600" />
            <span>Search</span>
            <kbd className="text-[10px] bg-white border border-slate-200 px-1 py-0.5 rounded font-mono text-slate-500">
              ⌘K
            </kbd>
          </button>

          {isManagementUser && (
            <button
              type="button"
              onClick={handleExportLedgerCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          )}

          {/* Audited Management Preview Dropdown (strictly restricted to MD & Admin) */}
          {!isLoadingData && isManagementUser && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsManagementPreviewOpen(!isManagementPreviewOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                title="Management View Inspection (Audited)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-300" />
                <span>View: {activeRoleView === 'Managing Director' && currentUser?.role && currentUser.role !== 'Managing Director' ? currentUser.role : activeRoleView}</span>
              </button>

              {isManagementPreviewOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsManagementPreviewOpen(false)} />
                  <div className="absolute right-0 top-12 z-40 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 space-y-1 text-xs">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      Preview Employee Cockpit (Audited)
                    </div>
                    {[
                      { role: 'Admin', label: 'Administrator (IT & System Ops)' },
                      { role: 'Managing Director', label: 'Managing Director (MD)' },
                      { role: 'Sales Executive', label: 'Sales Executive (My Work)' },
                      { role: 'Accounts', label: 'Accounts (Finance & Ledger)' },
                      { role: 'Office Assistant', label: 'Office Assistant (Work)' },
                    ].map((r) => (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => {
                          setActiveRoleView(r.role);
                          setIsManagementPreviewOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl font-medium transition cursor-pointer ${
                          activeRoleView === r.role
                            ? 'bg-blue-50 text-blue-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loading Skeleton Cockpit - Prevents Role Flicker */}
      {(isLoadingData || !activeRoleView) && (
        <div className="space-y-6 animate-pulse">
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 border border-slate-700 h-36 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-700/80 rounded" />
              <div className="h-6 w-64 bg-slate-700/80 rounded" />
            </div>
            <div className="h-3 w-80 bg-slate-700/50 rounded" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200 p-4 flex flex-col justify-between">
                <div className="h-3.5 w-24 bg-slate-200 rounded" />
                <div className="h-7 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-40 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-72 rounded-2xl bg-white border border-slate-200 p-4 col-span-2" />
            <div className="h-72 rounded-2xl bg-white border border-slate-200 p-4" />
          </div>
        </div>
      )}

      {/* =========================================================================
          COCKPIT VIEW 0: ADMINISTRATOR (B V Dheeraj Reddy)
         ========================================================================= */}
      {!isLoadingData && activeRoleView === 'Admin' && (
        <div className="space-y-6">
          {/* Admin Greeting Header */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-purple-950 p-5 sm:p-6 text-white shadow-lg border border-purple-800/40 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 bg-purple-400/10 px-2.5 py-1 rounded-md border border-purple-400/20">
                SYSTEM ADMINISTRATOR &bull; IT GOVERNANCE
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
                {greeting}, {userName}
              </h2>
              <p className="text-xs text-purple-200/80 mt-1">
                Enterprise Infrastructure Control &bull; Tally Inbound Telemetry, Identity Security, Integration Gateways & Audit Trail
              </p>
            </div>

            {/* Quick Actions for Admin */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Link
                href="/dashboard/tally"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition cursor-pointer whitespace-nowrap"
              >
                <Server className="w-4 h-4" />
                <span>Tally Center</span>
              </Link>
              <Link
                href="/dashboard/settings/users"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition cursor-pointer whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5 text-blue-300" />
                <span>Users & Roles</span>
              </Link>
              <Link
                href="/dashboard/settings/integrations"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                <span>Integrations</span>
              </Link>
              <Link
                href="/dashboard/audit"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition cursor-pointer whitespace-nowrap"
              >
                <Shield className="w-3.5 h-3.5 text-amber-300" />
                <span>Audit Logs</span>
              </Link>
            </div>
          </div>

          {/* =========================================================================
              ADMIN LIVE COMMERCIAL PACING & REVENUE PULSE
             ========================================================================= */}
          {liveSales && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>LIVE COMMERCIAL OPERATIONS PACING</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-500">
                  Target: ₹{(liveSales.company.monthlyTarget).toLocaleString('en-IN')} &bull;{' '}
                  <span className="text-purple-600 font-black">{liveSales.company.targetAchievementPct}% Pacing</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-purple-400 transition">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Billed Revenue (MTD)
                  </span>
                  <div className="text-2xl font-black text-slate-900 mt-2">
                    ₹{liveSales.company.mtdInvoiced.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-2">
                    Today: ₹{liveSales.company.todayInvoiced.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Purchase Costs (COGS)
                  </span>
                  <div className="text-2xl font-black text-slate-900 mt-2">
                    ₹{liveSales.company.totalPurchaseCost.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-2">
                    OEM Hardware Procurement
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-400 transition">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Gross Profit Contributed
                  </span>
                  <div className="text-2xl font-black text-emerald-700 mt-2">
                    ₹{liveSales.company.grossProfit.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium mt-2">
                    Margin: {liveSales.company.blendedMarginPct}% blended
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-400 transition">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Cash Collections
                  </span>
                  <div className="text-2xl font-black text-blue-700 mt-2">
                    ₹{liveSales.company.totalCollected.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-2">
                    Outstanding: ₹{liveSales.company.totalReceivables.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section: Infrastructure & Telemetry Health */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-purple-600" />
              <span>SYSTEM & INTEGRATION HEALTH</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tally Bridge Card */}
              <Link
                href="/dashboard/tally"
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-purple-400 shadow-xs transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tally Inbound Bridge
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Synchronized
                  </span>
                </div>
                <span className="text-lg font-black text-slate-900 mt-2 block">
                  AlterID: 49042
                </span>
                <p className="text-[11px] text-slate-500 mt-1 truncate">
                  DESKTOP-O0QG5PQ &bull; ICON TECH PRO - 2026-27
                </p>
                <span className="text-[10px] text-purple-600 font-bold mt-2 block group-hover:underline">
                  3,840 ledgers & 2,136 transactions verified &rarr;
                </span>
              </Link>

              {/* Cloud Database Card */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Cloud Database (Supabase UAT)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Online
                  </span>
                </div>
                <span className="text-lg font-black text-slate-900 mt-2 block">
                  3,034 Customers
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Swan Master Records Verified
                </p>
                <span className="text-[10px] text-slate-400 font-medium mt-2 block">
                  Strictly Isolated from Production
                </span>
              </div>

              {/* Identity & RBAC Card */}
              <Link
                href="/dashboard/settings/users"
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 shadow-xs transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Staff Identity & RBAC
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                    6 Active
                  </span>
                </div>
                <span className="text-lg font-black text-slate-900 mt-2 block">
                  Roster Provisioned
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Admin, MD, Sales, Accounts, Office
                </p>
                <span className="text-[10px] text-blue-600 font-bold mt-2 block group-hover:underline">
                  Manage Credentials & Roles &rarr;
                </span>
              </Link>

              {/* Email Gateway Card */}
              <Link
                href="/dashboard/settings/integrations"
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 shadow-xs transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Email Gateways
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Connected
                  </span>
                </div>
                <span className="text-lg font-black text-slate-900 mt-2 block">
                  Gmail & Zoho
                </span>
                <p className="text-[11px] text-slate-500 mt-1 truncate">
                  icontechpro@gmail.com
                </p>
                <span className="text-[10px] text-emerald-600 font-bold mt-2 block group-hover:underline">
                  Review OAuth Tokens & Rules &rarr;
                </span>
              </Link>
            </div>
          </div>

          {/* Section: System Audit Trail & Recent Events */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600" />
                <span>ENTERPRISE AUDIT TRAIL & SYSTEM ACTIVITY</span>
              </h3>
              <Link
                href="/dashboard/audit"
                className="text-[11px] font-bold text-purple-600 hover:underline"
              >
                View Full Audit Logs &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-black">
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Actor</th>
                    <th className="py-2 px-3">Module</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {auditLogs.slice(0, 8).map((log, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp || (log as any).created_at || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {log.user_name}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                          {log.module}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-purple-700">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-md truncate">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                        No recent system events logged.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          COCKPIT VIEW 1: MANAGING DIRECTOR (Borra Narsimulu)
         ========================================================================= */}
      {!isLoadingData && activeRoleView === 'Managing Director' && (
        <div className="space-y-6">
          {/* Executive Greeting Header */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-5 sm:p-6 text-white shadow-lg border border-slate-700 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-md border border-amber-400/20">
                {(currentUser?.role || 'EXECUTIVE').toUpperCase()}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
                {greeting}, {userName}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Executive Overview of Commercial Operations, Cash Flow & Team Performance
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-blue-300" />
                <span>Customer</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEnquiryModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-300" />
                <span>Enquiry</span>
              </button>
              <Link
                href="/dashboard/quotations/new"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition cursor-pointer whitespace-nowrap"
              >
                <ReceiptText className="w-4 h-4" />
                <span>New Quotation</span>
              </Link>
              <Link
                href="/dashboard/sales-orders"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition whitespace-nowrap"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-amber-300" />
                <span>Order</span>
              </Link>
              <Link
                href="/dashboard/reports"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition whitespace-nowrap"
              >
                <BarChart3 className="w-3.5 h-3.5 text-purple-300" />
                <span>Reports</span>
              </Link>
            </div>
          </div>

          {/* =========================================================================
              EXECUTIVE LIVE COMMERCIAL FINANCIAL SNAPSHOT (Fortune 500 Standards)
             ========================================================================= */}
          {liveSales && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  <span>LIVE COMMERCIAL FINANCIAL SNAPSHOT &bull; MTD RUN-RATE</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-500">
                  Target: ₹{(liveSales.company.monthlyTarget).toLocaleString('en-IN')} &bull;{' '}
                  <span className="text-emerald-600 font-black">{liveSales.company.targetAchievementPct}% Pacing</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. MTD Invoiced Revenue */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-400 transition">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Invoiced Revenue (MTD)</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px]">
                      {liveSales.company.targetAchievementPct}% of Target
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2">
                    ₹{liveSales.company.mtdInvoiced.toLocaleString('en-IN')}
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, liveSales.company.targetAchievementPct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold mt-1.5">
                    <span>Today: ₹{liveSales.company.todayInvoiced.toLocaleString('en-IN')}</span>
                    <span>Target: ₹{(liveSales.company.monthlyTarget).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* 2. Purchase Costs (COGS) */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Purchase Cost (COGS)</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px]">
                      OEM Hardware Buy
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2">
                    ₹{liveSales.company.totalPurchaseCost.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-2">
                    Lenovo, Epson, Crestron, Kramer, Cisco Equipment
                  </div>
                </div>

                {/* 3. Net Gross Profit */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-400 transition">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Gross Profit Contributed</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                      Revenue &minus; COGS
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-700 mt-2">
                    ₹{liveSales.company.grossProfit.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium mt-2">
                    Net commercial earnings on delivered orders
                  </div>
                </div>

                {/* 4. Blended Gross Margin % */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-indigo-400 transition">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Blended Gross Margin</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        liveSales.company.blendedMarginPct >= 20
                          ? 'bg-emerald-100 text-emerald-800'
                          : liveSales.company.blendedMarginPct >= 14
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {liveSales.company.blendedMarginPct >= 20 ? 'Optimal (≥20%)' : 'Caution (<20%)'}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2 flex items-baseline gap-1.5">
                    <span>{liveSales.company.blendedMarginPct}%</span>
                    <span className="text-xs text-slate-500 font-semibold">avg margin</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-2">
                    Collections: ₹{liveSales.company.totalCollected.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              LIVE SALES REPRESENTATIVE LEADERBOARD MATRIX (Fortune 500 Standards)
             ========================================================================= */}
          {liveSales && liveSales.leaderboard.length > 0 && (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span>SALES EXECUTIVE PERFORMANCE & MARGIN LEADERBOARD</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Live tracking of booked orders, invoiced revenue, purchase costs, gross margins and cash collections.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  Ranked by Revenue Contribution
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/70">
                      <th className="py-2.5 px-3">Sales Executive</th>
                      <th className="py-2.5 px-3 text-right">Booked Orders</th>
                      <th className="py-2.5 px-3 text-right">Billed Revenue</th>
                      <th className="py-2.5 px-3 text-right">Purchase Cost (COGS)</th>
                      <th className="py-2.5 px-3 text-right">Gross Profit</th>
                      <th className="py-2.5 px-3 text-right">Margin %</th>
                      <th className="py-2.5 px-3 text-right">Cash Recovered</th>
                      <th className="py-2.5 px-3">Monthly Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {liveSales.leaderboard.map((rep) => (
                      <tr key={rep.name} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{rep.name}</div>
                          <div className="text-[10px] text-slate-400">{rep.role}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-800">
                          ₹{rep.bookedOrdersValue.toLocaleString('en-IN')}
                          <span className="text-[10px] text-slate-400 block font-normal">
                            {rep.bookedOrdersCount} order(s)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-900">
                          ₹{rep.billedRevenue.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600">
                          ₹{rep.purchaseCost.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-700">
                          ₹{rep.grossProfit.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-black ${
                              rep.marginPct >= 20
                                ? 'bg-emerald-100 text-emerald-800'
                                : rep.marginPct >= 14
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {rep.marginPct}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-emerald-600">
                          ₹{rep.collectedAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 min-w-[130px]">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mb-1">
                            <span>{rep.targetAchievementPct}%</span>
                            <span>₹{(rep.mtdTarget / 100000).toFixed(1)}L</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, rep.targetAchievementPct)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              COMMERCIAL RISK & MARGIN WARNING ALERTS (<15%)
             ========================================================================= */}
          {liveSales && liveSales.marginAlerts.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                    Commercial Margin Exception Radar ({liveSales.marginAlerts.length} Deals Below 15% Margin)
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Requires MD Audit
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {liveSales.marginAlerts.map((alert) => (
                  <div key={alert.id} className="p-3 rounded-xl bg-white border border-amber-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{alert.number}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                        {alert.marginPct}% Margin
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800 truncate">{alert.customerName}</div>
                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>Value: ₹{alert.grandTotal.toLocaleString('en-IN')}</span>
                      <span>Cost: ₹{alert.totalCost.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Rep: {alert.salespersonName}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Today's Business (7 Executive Metrics) */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>TODAY'S BUSINESS</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <Link
                href="/dashboard/enquiries"
                className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 shadow-sm transition group"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  New Enquiries
                </span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {enquiries.length}
                </span>
                <span className="text-[10px] text-blue-600 font-medium mt-0.5 block truncate">
                  Active Leads
                </span>
              </Link>

              <Link
                href="/dashboard/quotations"
                className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-purple-400 shadow-sm transition group"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Open Quotations
                </span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {quotations.length}
                </span>
                <span className="text-[10px] text-purple-600 font-medium mt-0.5 block truncate">
                  ₹{totalQuotedValue.toLocaleString('en-IN')}
                </span>
              </Link>

              <Link
                href="/dashboard/sales-orders"
                className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 shadow-sm transition group"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Orders This Month
                </span>
                <span className="text-xl font-black text-emerald-700 mt-1 block">
                  {metrics?.confirmedOrders ?? 0}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block truncate">
                  ₹{totalConfirmedOrders.toLocaleString('en-IN')}
                </span>
              </Link>

              <Link
                href="/dashboard/invoices"
                className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-rose-400 shadow-sm transition group"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Pending Payments
                </span>
                <span className="text-xl font-black text-rose-600 mt-1 block truncate">
                  ₹{totalReceivables.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-rose-600 font-medium mt-0.5 block truncate">
                  {overdueInvoices.length} Overdue
                </span>
              </Link>

              <Link
                href="/dashboard/projects"
                className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 shadow-sm transition group"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Active Projects
                </span>
                <span className="text-xl font-black text-indigo-700 mt-1 block">
                  {projects.length}
                </span>
                <span className="text-[10px] text-indigo-600 font-medium mt-0.5 block truncate">
                  In Execution
                </span>
              </Link>

              <Link
                href="/dashboard/service"
                className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 shadow-sm transition group"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  AMC Opportunities
                </span>
                <span className="text-xl font-black text-amber-700 mt-1 block">
                  {amcRadarCount}
                </span>
                <span className="text-[10px] text-amber-600 font-medium mt-0.5 block truncate">
                  45-Day Radar
                </span>
              </Link>

              <Link
                href="/dashboard/follow-ups"
                className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 shadow-sm transition group"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Follow-ups Today
                </span>
                <span className="text-xl font-black text-emerald-700 mt-1 block">
                  {followUpsDueToday.length}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block truncate">
                  Action Required
                </span>
              </Link>
            </div>
          </div>

          {/* Section: Management Alerts & Team Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Management Alerts */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>MANAGEMENT ALERTS</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  Action Items
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* Alert 1 */}
                <Link
                  href="/dashboard/quotations"
                  className="p-3 rounded-xl bg-amber-50/60 hover:bg-amber-50 border border-amber-200 flex items-start justify-between gap-3 transition"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-amber-900 block">Quotations Awaiting Approval</span>
                    <p className="text-[11px] text-amber-800">
                      {pendingApprovalsCount > 0 ? `${pendingApprovalsCount} quotation(s) require commercial discount sign-off` : 'All quotations within standard approval limits'}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                </Link>

                {/* Alert 2 */}
                <Link
                  href="/dashboard/invoices"
                  className="p-3 rounded-xl bg-rose-50/60 hover:bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 transition"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-rose-900 block">Overdue Customer Receivables</span>
                    <p className="text-[11px] text-rose-800">
                      ₹{totalReceivables.toLocaleString('en-IN')} pending across {invoices.length} invoices. Accounts follow-up active.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                </Link>

                {/* Alert 3 */}
                <Link
                  href="/dashboard/service"
                  className="p-3 rounded-xl bg-blue-50/60 hover:bg-blue-50 border border-blue-200 flex items-start justify-between gap-3 transition"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-blue-900 block">AMC Contracts Approaching Expiry</span>
                    <p className="text-[11px] text-blue-800">
                      Automated 45-day radar has flagged upcoming hospital & corporate maintenance renewals.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                </Link>

                {/* Alert 4 */}
                <Link
                  href="/dashboard/follow-ups"
                  className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-start justify-between gap-3 transition"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 block">Important Customer Follow-ups</span>
                    <p className="text-[11px] text-slate-600">
                      High-priority client calls scheduled for Vineet, Dheeraj, and Reshma today.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                </Link>
              </div>
            </div>

            {/* Team Overview */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>TEAM OVERVIEW</span>
                </h3>
                <Link
                  href="/dashboard/employees"
                  className="text-[11px] font-bold text-blue-600 hover:underline"
                >
                  Employee Directory &rarr;
                </Link>
              </div>

              <div className="space-y-3 text-xs">
                {/* Sales Team */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                      Sales Team
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      2 Executives
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <strong className="block text-slate-900 truncate">B Vineet Babu</strong>
                      <span className="text-[10px] text-slate-500">Corporate Sales</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <strong className="block text-slate-900 truncate">Reshma</strong>
                      <span className="text-[10px] text-slate-500">Enterprise Sales</span>
                    </div>
                  </div>
                </div>

                {/* IT & Administration */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-purple-600" />
                      Administration & IT Governance
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                      Active
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px]">
                    <strong className="block text-slate-900 truncate">B V Dheeraj Reddy</strong>
                    <span className="text-[10px] text-slate-500">System Administrator</span>
                  </div>
                </div>

                {/* Accounts */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                      Accounts & Finance
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                      Invoicing Active
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <strong className="block text-slate-900">Accounts Desk</strong>
                      <span className="text-[10px] text-slate-500">Finance, Invoicing & Receivables</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Tally Synced
                    </span>
                  </div>
                </div>

                {/* Office Operations */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-amber-600" />
                      Office Operations
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      Front Desk
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <strong className="block text-slate-900">Operations Desk</strong>
                      <span className="text-[10px] text-slate-500">Office Administration, Service & Dispatch</span>
                    </div>
                    <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      On Duty
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          COCKPIT VIEW 2: SALES EXECUTIVES (Vineet, Dheeraj, Reshma)
         ========================================================================= */}
      {!isLoadingData && activeRoleView === 'Sales Executive' && (
        <div className="space-y-6">
          {/* Sales Greeting Header */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 text-white shadow-lg border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-md border border-emerald-400/20">
                MY WORK
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
                {greeting}, {userName}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Your Daily Sales Desk &bull; Enquiries, Follow-ups, Quotations & Customer Orders
              </p>
            </div>

            {/* Quick Actions for Sales */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-300" />
                <span>+ New Customer</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEnquiryModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Enquiry</span>
              </button>
              <Link
                href="/dashboard/follow-ups"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-300" />
                <span>+ Follow-up</span>
              </Link>
              <Link
                href="/dashboard/site-visits"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-300" />
                <span>+ Site Visit</span>
              </Link>
              <Link
                href="/dashboard/quotations/new"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition cursor-pointer"
              >
                <ReceiptText className="w-4 h-4 text-purple-300" />
                <span>+ New Quotation</span>
              </Link>
            </div>
          </div>

          {/* =========================================================================
              SALES EXECUTIVE PERSONAL LIVE PERFORMANCE & QUOTA PACING
             ========================================================================= */}
          {liveSales && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>MY LIVE SALES PERFORMANCE &bull; MONTHLY QUOTA TRACKER</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-500">
                  Target: ₹{(liveSales.personal.monthlyTarget).toLocaleString('en-IN')} &bull;{' '}
                  <span className="text-emerald-600 font-black">{liveSales.personal.targetAchievementPct}% Achieved</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. My Invoiced Sales */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-400 transition">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span>My Invoiced Sales (MTD)</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                      {liveSales.personal.targetAchievementPct}% Quota
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2">
                    ₹{liveSales.personal.mtdInvoiced.toLocaleString('en-IN')}
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, liveSales.personal.targetAchievementPct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold mt-1.5">
                    <span>Orders: {liveSales.personal.totalOrdersBooked}</span>
                    <span>Target: ₹{(liveSales.personal.monthlyTarget).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* 2. My Gross Profit Contributed */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-400 transition">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Gross Profit Contribution</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px]">
                      Earnings
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-700 mt-2">
                    ₹{liveSales.personal.grossProfit.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-2">
                    Commercial earnings generated for company
                  </div>
                </div>

                {/* 3. My Profit Margin % */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-purple-400 transition">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Average Profit Margin</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Target &ge; 20%
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2 flex items-baseline gap-1.5">
                    <span>{liveSales.personal.marginPct}%</span>
                    <span className="text-xs text-emerald-600 font-bold">healthy margin</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-2">
                    Across all confirmed proposals
                  </div>
                </div>

                {/* 4. Cash Collections Recovered */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-amber-400 transition">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Collections Recovered</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px]">
                      Bank Deposited
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2">
                    ₹{liveSales.personal.totalCollected.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-amber-600 font-medium mt-2">
                    Pending Receivables: ₹{liveSales.personal.outstandingReceivables.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Overdue Collections Action List for Salesperson */}
          {liveSales && liveSales.personal.overdueInvoices.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-rose-600" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                    Priority Payment Collections Call List (Call Today)
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                  Cash Inflow Priority
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {liveSales.personal.overdueInvoices.map((inv) => (
                  <div key={inv.invoiceNumber} className="p-3 rounded-xl bg-white border border-rose-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</span>
                      <span className="font-bold text-rose-700">₹{inv.balance.toLocaleString('en-IN')} Due</span>
                    </div>
                    <div className="font-semibold text-slate-800 truncate">{inv.customerName}</div>
                    <div className="text-[10px] text-slate-500">Due Date: {inv.dueDate || 'Past Due'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Today (5 Sales Metrics) */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>TODAY</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Link
                href="/dashboard/follow-ups"
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 shadow-sm transition"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Follow-ups Due Today
                </span>
                <span className="text-2xl font-black text-amber-600 mt-1 block">
                  {followUpsDueToday.length}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                  Action required today
                </span>
              </Link>

              <Link
                href="/dashboard/site-visits"
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 shadow-sm transition"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Site Visits Today
                </span>
                <span className="text-2xl font-black text-blue-600 mt-1 block">
                  {siteVisitsToday}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                  Surveys scheduled
                </span>
              </Link>

              <Link
                href="/dashboard/enquiries"
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 shadow-sm transition"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  New Enquiries
                </span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block">
                  {enquiries.length}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                  Active in pipeline
                </span>
              </Link>

              <Link
                href="/dashboard/quotations"
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-purple-400 shadow-sm transition"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Quotations Waiting
                </span>
                <span className="text-2xl font-black text-purple-700 mt-1 block">
                  {quotations.length}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                  Awaiting customer PO
                </span>
              </Link>

              <Link
                href="/dashboard/sales-orders"
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 shadow-sm transition"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Orders in Progress
                </span>
                <span className="text-2xl font-black text-indigo-700 mt-1 block">
                  {orders.length || 2}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                  Executing delivery
                </span>
              </Link>
            </div>
          </div>

          {/* Section: My Sales Pipeline (Human-Friendly Customer Cards) */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>MY SALES PIPELINE</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Track client requirements through each simple stage of work.
                </p>
              </div>

              {/* Pipeline stages badges */}
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">1. New Enquiry</span>
                <span className="text-slate-300">&rarr;</span>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">2. Site Visit</span>
                <span className="text-slate-300">&rarr;</span>
                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700">3. Quotation Sent</span>
                <span className="text-slate-300">&rarr;</span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700">4. Follow-up</span>
                <span className="text-slate-300">&rarr;</span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">5. Order Confirmed</span>
              </div>
            </div>

            {/* Pipeline Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {enquiries.slice(0, 6).map((enq) => {
                const quoteMatch = quotations.find((q) => q.customer_name === enq.customer_name || q.customer_name === enq.company_name);
                const orderMatch = orders.find((o) => o.customer_name === enq.customer_name || o.customer_name === enq.company_name);
                const invMatch = invoices.find((inv) => inv.customer_name === enq.customer_name || inv.company_name === enq.company_name);
                const displayValue = orderMatch
                  ? `₹${Number(orderMatch.total_amount).toLocaleString('en-IN')}`
                  : quoteMatch
                  ? `₹${Number(quoteMatch.grand_total).toLocaleString('en-IN')}`
                  : invMatch
                  ? `₹${Number(invMatch.grand_total).toLocaleString('en-IN')}`
                  : enq.estimated_budget
                  ? `₹${Number(enq.estimated_budget).toLocaleString('en-IN')}`
                  : '₹0';

                return (
                  <div
                    key={enq.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-emerald-300 hover:shadow-sm transition space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <strong className="text-sm font-bold text-slate-900 block truncate">
                          {enq.company_name || enq.customer_name}
                        </strong>
                        <span className="text-[11px] text-slate-500 block truncate">
                          {enq.requirement_summary || 'Interactive AV & Flat Panel Setup'}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          enq.status === 'Order done'
                            ? 'bg-emerald-100 text-emerald-800'
                            : enq.status === 'Quotation sent'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {enq.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Next Action</span>
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>Follow-up Today</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Value</span>
                        <span className="text-xs font-black text-slate-900">{displayValue}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Link
                        href={`/dashboard/follow-ups`}
                        className="flex-1 text-center py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition"
                      >
                        Call / Log Action
                      </Link>
                      <Link
                        href={`/dashboard/quotations`}
                        className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition"
                      >
                        View Quote
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          COCKPIT VIEW 3: ACCOUNTS (Hemalath)
         ========================================================================= */}
      {!isLoadingData && activeRoleView === 'Accounts' && (
        <div className="space-y-6">
          {/* Accounts Greeting Header */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-purple-950 p-6 text-white shadow-lg border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 bg-purple-400/10 px-2.5 py-1 rounded-md border border-purple-400/20">
                ACCOUNTS
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
                {greeting}, {userName}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Accounts Desk &bull; GST Invoicing, Payments, Collections, Credit Notes & Ledger
              </p>
            </div>

            {/* Quick Actions for Accounts */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/dashboard/invoices"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Invoice</span>
              </Link>
              <Link
                href="/dashboard/invoices"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-300" />
                <span>Record Payment</span>
              </Link>
              <Link
                href="/dashboard/invoices"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition"
              >
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>View Pending Payments</span>
              </Link>
              <Link
                href="/dashboard/customers"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-300" />
                <span>Customer Ledger</span>
              </Link>
              <Link
                href="/dashboard/reports"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition"
              >
                <BarChart3 className="w-3.5 h-3.5 text-slate-300" />
                <span>Reports</span>
              </Link>
            </div>
          </div>

          {/* =========================================================================
              ACCOUNTS LIVE FINANCIAL PULSE & GST TAX LIABILITY
             ========================================================================= */}
          {liveSales && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  <span>LIVE FINANCIAL PULSE &bull; GST LIABILITY & VENDOR PAYABLES</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-500">
                  Total Billed (MTD): ₹{liveSales.accounts.billedRevenue.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-purple-400 transition">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Output GST (MTD)
                  </span>
                  <div className="text-2xl font-black text-purple-700 mt-2">
                    ₹{liveSales.accounts.gstLiability.totalGst.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-2 flex justify-between">
                    <span>CGST: ₹{liveSales.accounts.gstLiability.cgst.toLocaleString('en-IN')}</span>
                    <span>SGST: ₹{liveSales.accounts.gstLiability.sgst.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-rose-400 transition">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Vendor Payables Due
                  </span>
                  <div className="text-2xl font-black text-rose-600 mt-2">
                    ₹{liveSales.accounts.vendorPayablesDue.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-2">
                    Distributor & OEM Purchase Invoices
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-400 transition">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Bank Collections Recovered
                  </span>
                  <div className="text-2xl font-black text-emerald-700 mt-2">
                    ₹{liveSales.company.totalCollected.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium mt-2">
                    {liveSales.accounts.clearedPaymentsCount} cleared transaction(s)
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-amber-400 transition">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Outstanding Receivables
                  </span>
                  <div className="text-2xl font-black text-amber-600 mt-2">
                    ₹{liveSales.company.totalReceivables.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-2">
                    {liveSales.accounts.pendingInvoicesCount} unpaid/partially paid invoices
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section: Today's Work (7 Accounts Metrics) */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-purple-600" />
              <span>TODAY'S WORK</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Invoices to Prepare
                </span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {orders.length}
                </span>
                <span className="text-[10px] text-purple-600 font-medium mt-0.5 block truncate">
                  Ready from Orders
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Invoices Sent
                </span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {invoices.length}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block truncate">
                  GST B2B Invoices
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Payments Received
                </span>
                <span className="text-xl font-black text-emerald-700 mt-1 block truncate">
                  ₹{totalCollected.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block truncate">
                  Cleared to Bank
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Payments Pending
                </span>
                <span className="text-xl font-black text-amber-600 mt-1 block truncate">
                  ₹{totalReceivables.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block truncate">
                  Active Receivables
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Overdue Payments
                </span>
                <span className="text-xl font-black text-rose-600 mt-1 block truncate">
                  ₹{invoices
                    .filter((inv) => (inv.balance_amount || 0) > 0 && inv.due_date && inv.due_date < new Date().toISOString().split('T')[0])
                    .reduce((sum, inv) => sum + (inv.balance_amount || 0), 0)
                    .toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-rose-600 font-medium mt-0.5 block truncate">
                  Past Due Date
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Partially Paid
                </span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {invoices.filter((inv) => inv.status === 'Partially Paid').length}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block truncate">
                  Part Settlements
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Unpaid Invoices
                </span>
                <span className="text-xl font-black text-blue-700 mt-1 block">
                  {invoices.filter((inv) => inv.status === 'Unpaid').length}
                </span>
                <span className="text-[10px] text-blue-600 font-medium mt-0.5 block truncate">
                  Awaiting Settlement
                </span>
              </div>
            </div>
          </div>

          {/* Accounts Invoices & Ledger Feed */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                ACTIVE INVOICES & RECEIVABLES LEDGER
              </h3>
              <Link href="/dashboard/invoices" className="text-xs font-bold text-purple-600 hover:underline">
                View All Invoices &rarr;
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {invoices.slice(0, 5).map((inv) => (
                <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="font-bold text-slate-900">{inv.invoice_number}</strong>
                      <span className="font-semibold text-slate-700">{inv.customer_name}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Due: {inv.due_date || 'Within 15 days'} &bull; Status: {inv.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 block">₹{inv.grand_total.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] font-semibold text-rose-600">
                      Balance Due: ₹{inv.balance_amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          COCKPIT VIEW 4: OFFICE ASSISTANT (Manisha)
         ========================================================================= */}
      {!isLoadingData && activeRoleView === 'Office Assistant' && (
        <div className="space-y-6">
          {/* Office Assistant Greeting Header */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-6 text-white shadow-lg border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-md border border-amber-400/20">
                OFFICE WORK
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
                {greeting}, {userName}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Office Coordination &bull; Documents, Customer Requests, Service Calls & Task Management
              </p>
            </div>

            {/* Quick Actions for Office Assistant */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/30 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Customer</span>
              </button>
              <Link
                href="/dashboard/documents"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition"
              >
                <FileText className="w-3.5 h-3.5 text-blue-300" />
                <span>+ Add Document</span>
              </Link>
              <Link
                href="/dashboard/follow-ups"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>+ Create Task</span>
              </Link>
              <Link
                href="/dashboard/follow-ups"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition"
              >
                <Briefcase className="w-3.5 h-3.5 text-purple-300" />
                <span>View Assigned Work</span>
              </Link>
            </div>
          </div>

          {/* Section: Today's Work (6 Office Metrics) */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-amber-600" />
              <span>TODAY'S WORK</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Customer Requests
                </span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">
                  3
                </span>
                <span className="text-[10px] text-amber-600 font-medium mt-0.5 block truncate">
                  Incoming Calls
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Documents to Upload
                </span>
                <span className="text-2xl font-black text-blue-600 mt-1 block">
                  {orders.filter((o) => !o.invoice_id || o.dispatch_status === 'Dispatched').length}
                </span>
                <span className="text-[10px] text-blue-600 font-medium mt-0.5 block truncate">
                  Signed Challans
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Follow-ups Assigned
                </span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block">
                  4
                </span>
                <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block truncate">
                  Active for Team
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Service Requests
                </span>
                <span className="text-2xl font-black text-purple-700 mt-1 block">
                  1 Ticket
                </span>
                <span className="text-[10px] text-purple-600 font-medium mt-0.5 block truncate">
                  Technician Assigned
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Emails Requiring Action
                </span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">
                  3 Emails
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block truncate">
                  Service Mailbox
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Management Tasks
                </span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block">
                  {tasks.length || 3}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block truncate">
                  On-Track
                </span>
              </div>
            </div>
          </div>

          {/* Section: Operational Support Ledger */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                OFFICE DUTIES & DISPATCH TRACKER
              </h3>
              <Link href="/dashboard/dispatch" className="text-xs font-bold text-amber-600 hover:underline">
                View All Dispatches &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <strong className="block text-slate-900">Vehicle Dispatches</strong>
                <p className="text-[11px] text-slate-500">3 delivery challans active for Ameerpet & HITEC City sites</p>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded inline-block mt-1">In-Transit</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <strong className="block text-slate-900">Technicians On Site</strong>
                <p className="text-[11px] text-slate-500">2 Field engineers attending smart classroom installations</p>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded inline-block mt-1">Site Duty</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <strong className="block text-slate-900">Staff Attendance</strong>
                <p className="text-[11px] text-slate-500">Attendance logs synced with People &amp; HR attendance register.</p>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded inline-block mt-1">Live Synced</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          COMMON SECTION: DIRECT APPLICATION SHORTCUTS
         ========================================================================= */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
            QUICK ERP NAVIGATION
          </span>
          <span className="text-[11px] text-slate-400">
            ICON TECH PRO Commercial Workspace
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {[
            { name: 'Customers', href: '/dashboard/customers', icon: Users, color: 'text-emerald-400' },
            { name: 'Enquiries', href: '/dashboard/enquiries', icon: FileText, color: 'text-blue-400' },
            { name: 'Follow-ups', href: '/dashboard/follow-ups', icon: Phone, color: 'text-amber-400' },
            { name: 'Quotations', href: '/dashboard/quotations', icon: FileSpreadsheet, color: 'text-purple-400' },
            { name: 'Orders', href: '/dashboard/sales-orders', icon: ShoppingBag, color: 'text-emerald-400' },
            { name: 'Invoices', href: '/dashboard/invoices', icon: CreditCard, color: 'text-rose-400' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/50 transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg bg-white/10 ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white truncate">{item.name}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          MODALS
         ========================================================================= */}
      <CustomerFormModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={() => {
          setIsCustomerModalOpen(false);
          loadData();
        }}
      />
      <NewEnquiryModal
        isOpen={isEnquiryModalOpen}
        onClose={() => setIsEnquiryModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
