'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MinusCircle,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Download,
  RotateCcw,
  Sparkles,
  Lock,
  Server,
  FileSpreadsheet,
  FileText,
  Search,
  LogIn,
  LogOut,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Filter,
  Save,
  MessageSquare,
  AlertCircle,
  ClipboardList,
  Zap,
} from 'lucide-react';
import { UAT_ROLES, UAT_TESTS } from '@/lib/uat/uat-test-definitions';
import { switchUATUserSession } from '@/app/uat/actions';
import { LEGITIMATE_UAT_USERS } from '@/lib/uat/uat-users';
import {
  UATRoleId,
  UATStatus,
  UATPriority,
  UATApproval,
  UATItemState,
  UATRoleReview,
  UATTestDefinition,
  UATAuditStorage,
} from '@/lib/uat/uat-types';
import { generateUATMarkdownReport } from '@/lib/uat/uat-report-generator';

const STORAGE_KEY = 'itp_uat_workflow_audit_v92';

interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface UATHubClientProps {
  currentUser: UserSession | null;
}

const STATUS_CONFIG: Record<
  UATStatus,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  NOT_TESTED: {
    label: 'NOT TESTED',
    bg: 'bg-slate-800/80',
    text: 'text-slate-400',
    border: 'border-slate-700',
    icon: MinusCircle,
  },
  PASS: {
    label: 'PASS',
    bg: 'bg-emerald-950/80',
    text: 'text-emerald-400',
    border: 'border-emerald-500/60',
    icon: CheckCircle2,
  },
  FAIL: {
    label: 'FAIL',
    bg: 'bg-rose-950/80',
    text: 'text-rose-400',
    border: 'border-rose-500/60',
    icon: XCircle,
  },
  NA: {
    label: 'N/A',
    bg: 'bg-slate-900',
    text: 'text-slate-500',
    border: 'border-slate-800',
    icon: HelpCircle,
  },
};

const PRIORITY_BADGES: Record<UATPriority, { label: string; color: string }> = {
  CRITICAL: { label: 'CRITICAL', color: 'bg-rose-500/20 text-rose-400 border-rose-500/40' },
  HIGH: { label: 'HIGH', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  MEDIUM: { label: 'MEDIUM', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  LOW: { label: 'LOW', color: 'bg-slate-500/20 text-slate-400 border-slate-500/40' },
};

export function UATHubClient({ currentUser }: UATHubClientProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<UATRoleId>('MD');
  const [itemsState, setItemsState] = useState<Record<string, UATItemState>>({});
  const [reviews, setReviews] = useState<Record<string, UATRoleReview>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [onlyIssuesFilter, setOnlyIssuesFilter] = useState(false);
  const [activeTab, setActiveTab] = useState<'audit' | 'report'>('audit');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [switchingUserEmail, setSwitchingUserEmail] = useState<string | null>(null);

  async function handleSwitchToRole(email: string) {
    setSwitchingUserEmail(email);
    try {
      const res = await switchUATUserSession(email);
      if (res.success) {
        window.location.href = '/dashboard';
      } else {
        alert(res.error || 'Failed to switch user');
        setSwitchingUserEmail(null);
      }
    } catch (err: any) {
      alert(err?.message || 'Error switching user session');
      setSwitchingUserEmail(null);
    }
  }

  // Initialize from LocalStorage or defaults
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: UATAuditStorage = JSON.parse(raw);
        setItemsState(parsed.items || {});
        setReviews(parsed.reviews || {});
        return;
      }
    } catch (e) {
      console.error('Error reading UAT audit storage:', e);
    }

    // Default initialization from verified test definitions
    const initialItems: Record<string, UATItemState> = {};
    UAT_TESTS.forEach((t) => {
      initialItems[t.id] = {
        status: t.defaultStatus || 'NOT_TESTED',
        actualResult: t.defaultActualResult || '',
        priority: t.defaultPriority,
        issue: '',
        suggestion: '',
        reviewerName: 'Pre-flight Validator',
        testedAt: new Date().toISOString(),
      };
    });
    setItemsState(initialItems);
  }, []);

  // Save to LocalStorage helper
  function persistData(newItems: Record<string, UATItemState>, newReviews: Record<string, UATRoleReview>) {
    try {
      const payload: UATAuditStorage = {
        version: '9.2',
        updatedAt: new Date().toISOString(),
        items: newItems,
        reviews: newReviews,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save UAT audit:', e);
    }
  }

  // Handle single item status change
  function handleStatusChange(testId: string, nextStatus: UATStatus) {
    const prev = itemsState[testId] || {
      status: 'NOT_TESTED',
      actualResult: '',
      priority: 'HIGH',
      issue: '',
      suggestion: '',
      reviewerName: currentUser?.name || 'Human Reviewer',
    };

    const updated = {
      ...itemsState,
      [testId]: {
        ...prev,
        status: nextStatus,
        reviewerName: currentUser?.name || prev.reviewerName || 'Human Reviewer',
        testedAt: new Date().toISOString(),
      },
    };
    setItemsState(updated);
    persistData(updated, reviews);
  }

  // Handle item text updates (actualResult, issue, suggestion)
  function handleItemFieldChange(testId: string, field: keyof UATItemState, val: string) {
    const prev = itemsState[testId] || {
      status: 'NOT_TESTED',
      actualResult: '',
      priority: 'HIGH',
      issue: '',
      suggestion: '',
      reviewerName: currentUser?.name || 'Human Reviewer',
    };

    const updated = {
      ...itemsState,
      [testId]: {
        ...prev,
        [field]: val,
        reviewerName: currentUser?.name || prev.reviewerName || 'Human Reviewer',
        testedAt: new Date().toISOString(),
      },
    };
    setItemsState(updated);
    persistData(updated, reviews);
  }

  // Handle Role Review Form updates
  function handleReviewFieldChange(roleId: UATRoleId, field: keyof UATRoleReview, val: any) {
    const prev = reviews[roleId] || {
      whatWorkedWell: '',
      whatIsDifficult: '',
      whatIsMissing: '',
      whatShouldBeChanged: '',
      securityConcern: '',
      calculationConcern: '',
      performanceConcern: '',
      dailyUseRecommendation: '',
      finalApprovalStatus: 'PENDING',
      signedByName: currentUser?.name || '',
      signedAt: new Date().toISOString(),
    };

    const updated = {
      ...reviews,
      [roleId]: {
        ...prev,
        [field]: val,
        signedByName: currentUser?.name || prev.signedByName,
        signedAt: new Date().toISOString(),
      },
    };
    setReviews(updated);
    persistData(itemsState, updated);
  }

  // Batch actions
  function handleMarkFilteredAsPass() {
    if (!confirm('Mark all currently filtered test items as PASS?')) return;
    const updated = { ...itemsState };
    filteredRoleTests.forEach((t) => {
      updated[t.id] = {
        ...(updated[t.id] || {}),
        status: 'PASS',
        actualResult: updated[t.id]?.actualResult || t.defaultActualResult || 'Verified functional during UAT pass',
        priority: updated[t.id]?.priority || t.defaultPriority,
        issue: updated[t.id]?.issue || '',
        suggestion: updated[t.id]?.suggestion || '',
        reviewerName: currentUser?.name || 'Human Reviewer',
        testedAt: new Date().toISOString(),
      };
    });
    setItemsState(updated);
    persistData(updated, reviews);
    showToast('Filtered items marked as PASS');
  }

  function handleResetFilteredToNotTested() {
    if (!confirm('Reset all currently filtered test items to NOT TESTED?')) return;
    const updated = { ...itemsState };
    filteredRoleTests.forEach((t) => {
      updated[t.id] = {
        ...(updated[t.id] || {}),
        status: 'NOT_TESTED',
        actualResult: '',
        priority: updated[t.id]?.priority || t.defaultPriority,
        issue: '',
        suggestion: '',
        reviewerName: currentUser?.name || 'Human Reviewer',
        testedAt: new Date().toISOString(),
      };
    });
    setItemsState(updated);
    persistData(updated, reviews);
    showToast('Filtered items reset to NOT TESTED');
  }

  function handleResetAllData() {
    if (!confirm('DANGER: Reset ALL UAT test items across all roles to NOT TESTED?')) return;
    const updated: Record<string, UATItemState> = {};
    UAT_TESTS.forEach((t) => {
      updated[t.id] = {
        status: 'NOT_TESTED',
        actualResult: '',
        priority: t.defaultPriority,
        issue: '',
        suggestion: '',
        reviewerName: '',
      };
    });
    setItemsState(updated);
    setReviews({});
    persistData(updated, {});
    showToast('All UAT data reset to initial blank state');
  }

  function showToast(msg: string) {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Active Role and Tests
  const activeRoleSummary = useMemo(() => {
    return UAT_ROLES.find((r) => r.roleId === selectedRoleId) || UAT_ROLES[0];
  }, [selectedRoleId]);

  const activeRoleTests = useMemo(() => {
    return UAT_TESTS.filter((t) => t.roleId === selectedRoleId);
  }, [selectedRoleId]);

  const availableModules = useMemo(() => {
    const set = new Set<string>();
    activeRoleTests.forEach((t) => set.add(t.module));
    return Array.from(set).sort();
  }, [activeRoleTests]);

  // Filtered Tests
  const filteredRoleTests = useMemo(() => {
    return activeRoleTests.filter((t) => {
      const state = itemsState[t.id];
      const st = state?.status || t.defaultStatus || 'NOT_TESTED';
      const prio = state?.priority || t.defaultPriority;

      if (moduleFilter !== 'ALL' && t.module !== moduleFilter) return false;
      if (statusFilter !== 'ALL' && st !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && prio !== priorityFilter) return false;
      if (onlyIssuesFilter && !state?.issue && !state?.suggestion && st !== 'FAIL') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          t.id.toLowerCase().includes(q) ||
          t.module.toLowerCase().includes(q) ||
          t.page.toLowerCase().includes(q) ||
          t.action.toLowerCase().includes(q) ||
          t.expectedResult.toLowerCase().includes(q) ||
          t.workflow.toLowerCase().includes(q) ||
          (state?.actualResult && state.actualResult.toLowerCase().includes(q)) ||
          (state?.issue && state.issue.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [activeRoleTests, itemsState, moduleFilter, statusFilter, priorityFilter, onlyIssuesFilter, searchQuery]);

  // Compute Metrics per Role
  const roleMetrics = useMemo(() => {
    const res: Record<
      UATRoleId,
      {
        total: number;
        passed: number;
        failed: number;
        notTested: number;
        na: number;
        completion: number;
        issues: number;
        critical: number;
        high: number;
      }
    > = {} as any;

    UAT_ROLES.forEach((r) => {
      const tests = UAT_TESTS.filter((t) => t.roleId === r.roleId);
      let passed = 0,
        failed = 0,
        notTested = 0,
        na = 0,
        issues = 0,
        critical = 0,
        high = 0;

      tests.forEach((t) => {
        const s = itemsState[t.id];
        const st = s?.status || t.defaultStatus || 'NOT_TESTED';
        const prio = s?.priority || t.defaultPriority;

        if (st === 'PASS') passed++;
        else if (st === 'FAIL') {
          failed++;
          if (prio === 'CRITICAL') critical++;
          if (prio === 'HIGH') high++;
        } else if (st === 'NA') na++;
        else notTested++;

        if (s?.issue || st === 'FAIL') issues++;
      });

      const completion = tests.length > 0 ? ((passed + na) / tests.length) * 100 : 0;
      res[r.roleId] = {
        total: tests.length,
        passed,
        failed,
        notTested,
        na,
        completion,
        issues,
        critical,
        high,
      };
    });

    return res;
  }, [itemsState]);

  // Global Metrics
  const globalMetrics = useMemo(() => {
    let total = UAT_TESTS.length;
    let passed = 0,
      failed = 0,
      notTested = 0,
      na = 0,
      issues = 0,
      critical = 0,
      high = 0;

    Object.values(roleMetrics).forEach((m) => {
      passed += m.passed;
      failed += m.failed;
      notTested += m.notTested;
      na += m.na;
      issues += m.issues;
      critical += m.critical;
      high += m.high;
    });

    const completion = total > 0 ? ((passed + na) / total) * 100 : 0;
    return { total, passed, failed, notTested, na, completion, issues, critical, high };
  }, [roleMetrics]);

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* TOP HEADER & CONTROL CENTER BADGES */}
      <header className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 text-xs font-black tracking-wider uppercase rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                FINAL HUMAN UAT CONTROL CENTER
              </span>
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PORT 3001 LIVE UAT
              </span>
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                PORT 3000 PROTECTED
              </span>
              <span className="px-3 py-1 text-xs font-mono rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                COMMIT 6bc3635
              </span>
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                RLS FULLY ENFORCED
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              ICON TECH PRO ERP V9.2 — Detailed Role Workflow Audit
            </h1>
            <p className="text-sm text-slate-400 max-w-4xl">
              Authentic role-by-role testing matrix validating real enterprise workflows, granular RBAC boundaries,
              document numbering, GST splits, and data integrity for each authorized employee.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {currentUser ? (
              <div className="bg-slate-800/80 border border-slate-700 px-4 py-2.5 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="text-xs text-slate-400">Current Session</div>
                  <div className="text-sm font-semibold text-white">{currentUser.name}</div>
                  <div className="text-xs font-mono text-blue-400">{currentUser.role}</div>
                </div>
                <Link
                  href="/uat/login"
                  className="ml-2 text-xs text-rose-400 hover:text-rose-300 font-medium underline flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" /> Switch
                </Link>
              </div>
            ) : (
              <Link
                href="/uat/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg transition"
              >
                <LogIn className="w-4 h-4" /> Sign In As Official Role
              </Link>
            )}

            <button
              onClick={() => {
                const md = generateUATMarkdownReport(itemsState, reviews);
                downloadFile(md, 'FINAL_ROLE_BY_ROLE_UAT_REPORT.md', 'text/markdown');
                showToast('Exported Markdown Report');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-sm font-semibold shadow transition"
            >
              <Download className="w-4 h-4 text-blue-400" /> Export Full Report (.md)
            </button>

            <button
              onClick={handleResetAllData}
              className="inline-flex items-center gap-2 px-3 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 rounded-xl text-sm font-medium transition"
              title="Reset all test statuses"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        </div>

        {/* GLOBAL SUMMARY PROGRESS COCKPIT */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-center">
            <div className="text-xs text-slate-400 font-medium">Total Tests</div>
            <div className="text-2xl font-black text-white">{globalMetrics.total}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-center">
            <div className="text-xs text-slate-400 font-medium">Passed</div>
            <div className="text-2xl font-black text-emerald-400">{globalMetrics.passed}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-center">
            <div className="text-xs text-slate-400 font-medium">Failed</div>
            <div className="text-2xl font-black text-rose-400">{globalMetrics.failed}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-center">
            <div className="text-xs text-slate-400 font-medium">Not Tested</div>
            <div className="text-2xl font-black text-slate-400">{globalMetrics.notTested}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-center">
            <div className="text-xs text-slate-400 font-medium">N/A</div>
            <div className="text-2xl font-black text-slate-400">{globalMetrics.na}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-center">
            <div className="text-xs text-slate-400 font-medium">Completion</div>
            <div className="text-2xl font-black text-blue-400">{globalMetrics.completion.toFixed(1)}%</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-center">
            <div className="text-xs text-slate-400 font-medium">Critical Issues</div>
            <div className={`text-2xl font-black ${globalMetrics.critical > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {globalMetrics.critical}
            </div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-center">
            <div className="text-xs text-slate-400 font-medium">High Issues</div>
            <div className={`text-2xl font-black ${globalMetrics.high > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {globalMetrics.high}
            </div>
          </div>
        </div>
      </header>

      {/* UAT TEST USER SESSION — PORT 3001 QUICK SWITCH BAR */}
      <section className="bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border border-blue-500/40 rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-400/40 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              UAT TEST USER SESSION — PORT 3001
            </span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Controlled Human Review Session
            </span>
          </div>
          <span className="text-xs text-slate-300">
            Click any team member below to instantly enter their ERP experience without a password.
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {LEGITIMATE_UAT_USERS.map((u) => {
            const isSwitching = switchingUserEmail === u.email;
            const isCurrent = currentUser?.email.toLowerCase() === u.email.toLowerCase();
            return (
              <button
                key={u.email}
                type="button"
                disabled={switchingUserEmail !== null}
                onClick={() => handleSwitchToRole(u.email)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-blue-600/25 border-blue-400 ring-2 ring-blue-500/40 shadow-md text-white'
                    : 'bg-slate-950/70 border-slate-800 hover:border-blue-500 hover:bg-slate-800/80 text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-bold text-xs truncate block text-white">{u.name}</span>
                    {isCurrent && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate">{u.role}</span>
                </div>
                <div className="mt-2.5 pt-1.5 border-t border-slate-800/60 text-[10px] font-semibold flex items-center justify-between">
                  {isSwitching ? (
                    <span className="text-blue-300 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Switching...
                    </span>
                  ) : isCurrent ? (
                    <span className="text-emerald-400 font-bold">Active User</span>
                  ) : (
                    <span className="text-blue-400 group-hover:underline">Launch ERP &rarr;</span>
                  )}
                  <span className="text-[9px] font-mono text-slate-500">1-Click</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 6 OFFICIAL USER / ROLE SELECTOR CARDS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Official Production Roles & Human UAT Profiles
          </h2>
          <span className="text-xs text-slate-400">Click a card to review that role&apos;s complete workflow checklist</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {UAT_ROLES.map((r) => {
            const m = roleMetrics[r.roleId];
            const isSelected = selectedRoleId === r.roleId;
            const rev = reviews[r.roleId];
            const approval = rev?.finalApprovalStatus || 'PENDING';

            return (
              <div
                key={r.roleId}
                onClick={() => setSelectedRoleId(r.roleId)}
                className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 relative ${
                  isSelected
                    ? 'bg-slate-900 border-blue-500 shadow-xl shadow-blue-500/10 ring-2 ring-blue-500/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                {/* Header Badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-md border ${r.badgeColor}`}>
                      {r.roleName}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1">{r.userName}</h3>
                    <div className="text-xs font-mono text-slate-400">{r.userEmail}</div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        approval === 'APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : approval === 'APPROVED_WITH_CHANGES'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : approval === 'NOT_APPROVED'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {approval}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 mb-4 line-clamp-2">{r.primaryFocus}</div>

                {/* Progress Bar */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Completion</span>
                    <span className="font-bold text-blue-400">{m.completion.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-300"
                      style={{ width: `${m.completion}%` }}
                    />
                  </div>
                </div>

                {/* Micro Stats */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs py-2 bg-slate-950/50 rounded-xl border border-slate-800/80 mb-4">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Total</div>
                    <div className="font-bold text-white">{m.total}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-400 uppercase font-semibold">Pass</div>
                    <div className="font-bold text-emerald-400">{m.passed}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-rose-400 uppercase font-semibold">Fail</div>
                    <div className="font-bold text-rose-400">{m.failed}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Pending</div>
                    <div className="font-bold text-slate-400">{m.notTested}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    View Checklist ({m.total}) <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSwitchToRole(r.userEmail);
                    }}
                    disabled={switchingUserEmail !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
                  >
                    {switchingUserEmail === r.userEmail ? (
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <LogIn className="w-3.5 h-3.5" />
                    )}
                    <span>Launch ERP</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SELECTED ROLE DETAILED AUDIT WORKFLOW SECTION */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-6">
        {/* Role Header Banner */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${activeRoleSummary.badgeColor}`}>
                {activeRoleSummary.roleName}
              </span>
              <h2 className="text-2xl font-extrabold text-white">{activeRoleSummary.userName}</h2>
              <span className="text-xs font-mono text-slate-400">({activeRoleSummary.userEmail})</span>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl">
              <strong className="text-slate-300">Department:</strong> {activeRoleSummary.department} &bull;{' '}
              <strong className="text-slate-300">Focus:</strong> {activeRoleSummary.primaryFocus}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSwitchToRole(activeRoleSummary.userEmail)}
              disabled={switchingUserEmail !== null}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
            >
              {switchingUserEmail === activeRoleSummary.userEmail ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-3.5 h-3.5" />
              )}
              <span>Launch ERP As {activeRoleSummary.userName.split(' ')[0]}</span>
            </button>

            <button
              onClick={handleMarkFilteredAsPass}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 rounded-xl text-xs font-semibold transition"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Mark Filtered PASS
            </button>

            <button
              onClick={handleResetFilteredToNotTested}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filtered
            </button>
          </div>
        </div>

        {/* SECURITY BOUNDARIES ALERT FOR ACTIVE ROLE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-950/30 border border-emerald-900/60 p-4 rounded-xl">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-4 h-4" /> Authorized Capabilities & Modules
            </div>
            <ul className="text-xs text-emerald-200/90 space-y-1 list-disc list-inside">
              {activeRoleSummary.permittedModules.map((p, idx) => (
                <li key={idx}>{p}</li>
              ))}
            </ul>
          </div>

          <div className="bg-rose-950/30 border border-rose-900/60 p-4 rounded-xl">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5 mb-2">
              <ShieldAlert className="w-4 h-4" /> Strict Security Boundaries & Prohibitions
            </div>
            <ul className="text-xs text-rose-200/90 space-y-1 list-disc list-inside">
              {activeRoleSummary.restrictedBoundaries.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* FILTER & SEARCH TOOLBAR */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
          <div className="flex flex-1 items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tests by ID, action, page, module, expected result..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-white text-xs w-full focus:outline-none placeholder:text-slate-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-xs text-slate-400 hover:text-white">
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Module Filter */}
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none"
            >
              <option value="ALL">All Modules ({activeRoleTests.length})</option>
              {availableModules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="NOT_TESTED">NOT TESTED</option>
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
              <option value="NA">N/A</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>

            {/* Only Issues Filter */}
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg">
              <input
                type="checkbox"
                checked={onlyIssuesFilter}
                onChange={(e) => setOnlyIssuesFilter(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-0"
              />
              <span>Issues / Bugs Only</span>
            </label>
          </div>
        </div>

        {/* RESULTS COUNT */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>
            Showing <strong className="text-white">{filteredRoleTests.length}</strong> of{' '}
            <strong className="text-white">{activeRoleTests.length}</strong> workflow tests
          </span>
          <span className="text-[11px] text-slate-500">
            Click status pills below to toggle verification results
          </span>
        </div>

        {/* GRANULAR TEST ITEMS LIST */}
        <div className="space-y-4">
          {filteredRoleTests.length === 0 ? (
            <div className="p-12 text-center bg-slate-950/40 border border-slate-800 rounded-xl text-slate-400 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-500" />
              <div className="text-sm font-semibold text-slate-300">No test cases match your filter criteria</div>
              <p className="text-xs">Try clearing search or filters to display all tests</p>
            </div>
          ) : (
            filteredRoleTests.map((test) => {
              const state = itemsState[test.id] || {
                status: test.defaultStatus || 'NOT_TESTED',
                actualResult: test.defaultActualResult || '',
                priority: test.defaultPriority,
                issue: '',
                suggestion: '',
                reviewerName: '',
              };
              const prioConfig = PRIORITY_BADGES[state.priority || test.defaultPriority];

              return (
                <div
                  key={test.id}
                  className={`bg-slate-950/70 border rounded-xl p-5 space-y-4 transition-all ${
                    state.status === 'FAIL'
                      ? 'border-rose-500/60 bg-rose-950/10'
                      : state.status === 'PASS'
                      ? 'border-emerald-500/40'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Test Item Top Row: ID, Badges, Route Link */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black px-2.5 py-1 rounded bg-slate-800 text-blue-400 border border-slate-700">
                        {test.id}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {test.module}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        {test.page}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${prioConfig.color}`}>
                        {prioConfig.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={test.routeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-mono underline"
                      >
                        {test.routeUrl} <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Workflow & Action Block */}
                  <div className="space-y-2">
                    <div className="text-xs text-slate-400">
                      <strong className="text-slate-200">Workflow:</strong> {test.workflow}
                    </div>

                    <div className="text-sm text-slate-100 font-medium">
                      <strong className="text-slate-400 font-normal">Action: </strong>
                      {test.action}
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-lg text-xs space-y-1">
                      <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        Expected Result:
                      </div>
                      <div className="text-slate-200">{test.expectedResult}</div>
                    </div>
                  </div>

                  {/* Status Selector Buttons */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-400 mr-2">Status:</span>
                      {(['NOT_TESTED', 'PASS', 'FAIL', 'NA'] as UATStatus[]).map((st) => {
                        const cfg = STATUS_CONFIG[st];
                        const isActive = state.status === st;
                        const Icon = cfg.icon;

                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleStatusChange(test.id, st)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition ${
                              isActive
                                ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-2 ring-white/10 shadow-md`
                                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="text-[11px] text-slate-500">
                      {state.testedAt && (
                        <span>
                          Updated: {new Date(state.testedAt).toLocaleDateString()} by{' '}
                          <strong className="text-slate-400">{state.reviewerName || 'Tester'}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actual Result & Issues Input Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Actual Result / Observation:
                      </label>
                      <input
                        type="text"
                        value={state.actualResult}
                        placeholder="Describe actual system behavior observed during test..."
                        onChange={(e) => handleItemFieldChange(test.id, 'actualResult', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-rose-400 mb-1">
                        Defect / Issue / Suggestion (If any):
                      </label>
                      <input
                        type="text"
                        value={state.issue}
                        placeholder="Log defect description, error message, or enhancement recommendation..."
                        onChange={(e) => handleItemFieldChange(test.id, 'issue', e.target.value)}
                        className={`w-full bg-slate-900 border rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none ${
                          state.status === 'FAIL' || state.issue
                            ? 'border-rose-500/80 focus:border-rose-400'
                            : 'border-slate-700/80 focus:border-blue-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* HUMAN REVIEW QUESTIONNAIRE & ROLE SIGN-OFF FORM */}
        <div className="mt-12 pt-8 border-t border-slate-800 space-y-6 bg-slate-950/80 p-6 rounded-2xl border border-slate-800/90">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-400" />
                Human Review Questionnaire & Final Role Sign-Off: {activeRoleSummary.roleName}
              </h3>
              <p className="text-xs text-slate-400">
                Official feedback questionnaire for {activeRoleSummary.userName} ({activeRoleSummary.userEmail}).
                Responses persist to the UAT register and export in the final audit document.
              </p>
            </div>

            <button
              onClick={() => {
                const md = generateUATMarkdownReport(itemsState, reviews);
                downloadFile(
                  md,
                  `${activeRoleSummary.roleId}_WORKFLOW_AUDIT_REPORT.md`,
                  'text/markdown'
                );
                showToast(`Exported ${activeRoleSummary.roleName} Audit Report`);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" /> Export Role Markdown
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                1. What worked well?
              </label>
              <textarea
                rows={3}
                value={reviews[activeRoleSummary.roleId]?.whatWorkedWell || ''}
                onChange={(e) =>
                  handleReviewFieldChange(activeRoleSummary.roleId, 'whatWorkedWell', e.target.value)
                }
                placeholder="Highlight ergonomic, fast, or well-executed parts of the workflow..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                2. What is difficult or clunky?
              </label>
              <textarea
                rows={3}
                value={reviews[activeRoleSummary.roleId]?.whatIsDifficult || ''}
                onChange={(e) =>
                  handleReviewFieldChange(activeRoleSummary.roleId, 'whatIsDifficult', e.target.value)
                }
                placeholder="Document friction points, slow actions, or confusing UI interactions..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                3. What is missing?
              </label>
              <textarea
                rows={3}
                value={reviews[activeRoleSummary.roleId]?.whatIsMissing || ''}
                onChange={(e) =>
                  handleReviewFieldChange(activeRoleSummary.roleId, 'whatIsMissing', e.target.value)
                }
                placeholder="Missing fields, filters, shortcuts, or business actions..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                4. What should be changed or tweaked?
              </label>
              <textarea
                rows={3}
                value={reviews[activeRoleSummary.roleId]?.whatShouldBeChanged || ''}
                onChange={(e) =>
                  handleReviewFieldChange(activeRoleSummary.roleId, 'whatShouldBeChanged', e.target.value)
                }
                placeholder="Recommended layout adjustments, label changes, or default behaviors..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-300 mb-1">
                5. Any security or authorization concern?
              </label>
              <textarea
                rows={2}
                value={reviews[activeRoleSummary.roleId]?.securityConcern || ''}
                onChange={(e) =>
                  handleReviewFieldChange(activeRoleSummary.roleId, 'securityConcern', e.target.value)
                }
                placeholder="Note any unauthorized page access, data leaks, or session anomalies..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1">
                6. Any calculation or tax rounding concern?
              </label>
              <textarea
                rows={2}
                value={reviews[activeRoleSummary.roleId]?.calculationConcern || ''}
                onChange={(e) =>
                  handleReviewFieldChange(activeRoleSummary.roleId, 'calculationConcern', e.target.value)
                }
                placeholder="Note any GST discrepancy, CGST/SGST split anomaly, or total variance..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                7. Would you use this ERP for daily work?
              </label>
              <div className="flex items-center gap-4 text-xs">
                {['YES', 'CONDITIONAL', 'NO'].map((opt) => (
                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`daily_${activeRoleSummary.roleId}`}
                      value={opt}
                      checked={reviews[activeRoleSummary.roleId]?.dailyUseRecommendation === opt}
                      onChange={(e) =>
                        handleReviewFieldChange(activeRoleSummary.roleId, 'dailyUseRecommendation', e.target.value)
                      }
                      className="text-blue-600 focus:ring-0"
                    />
                    <span className="text-white font-medium">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                8. Final Role Approval Gate:
              </label>
              <select
                value={reviews[activeRoleSummary.roleId]?.finalApprovalStatus || 'PENDING'}
                onChange={(e) =>
                  handleReviewFieldChange(activeRoleSummary.roleId, 'finalApprovalStatus', e.target.value)
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-blue-500"
              >
                <option value="PENDING">PENDING REVIEW</option>
                <option value="APPROVED">APPROVED (Full Sign-Off)</option>
                <option value="APPROVED_WITH_CHANGES">APPROVED WITH CHANGES</option>
                <option value="NOT_APPROVED">NOT APPROVED (Action Required)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                9. Reviewer Sign-Off Name:
              </label>
              <input
                type="text"
                value={reviews[activeRoleSummary.roleId]?.signedByName || currentUser?.name || ''}
                placeholder="Enter sign-off name..."
                onChange={(e) =>
                  handleReviewFieldChange(activeRoleSummary.roleId, 'signedByName', e.target.value)
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => showToast(`Saved Review & Sign-Off for ${activeRoleSummary.roleName}`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg transition"
            >
              <Save className="w-4 h-4" /> Save & Commit Role Audit
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
