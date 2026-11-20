'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Calendar,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Settings,
  Users,
  ShieldCheck,
  FileText,
  RotateCw,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import {
  getAutomatedReportConfigs,
  getScheduledReportRuns,
  executeScheduledReportCycle,
  updateAutomatedReportConfig,
  sendTestExecutiveSummaryEmailToMD,
} from '@/lib/actions/scheduled-reports';
import {
  getEmailAutomationRules,
  getEmailQueue,
  processEmailQueue,
  retryQueueJob,
  updateEmailAutomationRule,
} from '@/lib/actions/email-automation';
import type {
  AutomatedReportConfig,
  ScheduledReportRunRecord,
  EmailAutomationRule,
  EmailQueueJob,
} from '@/types/email-automation';

export default function CentralEmailCenterPage() {
  const [activeTab, setActiveTab] = useState<
    | 'SCHEDULER'
    | 'CUSTOMER_AUTOMATION'
    | 'SUPPLIER_AUTOMATION'
    | 'QUEUE_MONITOR'
    | 'RUN_HISTORY'
    | 'RECIPIENTS_POLICY'
  >('SCHEDULER');

  const [configs, setConfigs] = useState<AutomatedReportConfig[]>([]);
  const [runs, setRuns] = useState<ScheduledReportRunRecord[]>([]);
  const [rules, setRules] = useState<EmailAutomationRule[]>([]);
  const [queue, setQueue] = useState<EmailQueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingCycle, setExecutingCycle] = useState(false);
  const [sendingMdEmail, setSendingMdEmail] = useState(false);
  const [emailAlert, setEmailAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSendTestMdSummary = async () => {
    setSendingMdEmail(true);
    setEmailAlert(null);
    try {
      const res = await sendTestExecutiveSummaryEmailToMD();
      if (res.success) {
        setEmailAlert({ type: 'success', message: res.message });
        loadAll();
      } else {
        setEmailAlert({ type: 'error', message: res.error || res.message });
      }
    } catch (err: any) {
      setEmailAlert({ type: 'error', message: err.message || 'Failed to dispatch MD summary email' });
    } finally {
      setSendingMdEmail(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfgs, rns, rls, q] = await Promise.all([
        getAutomatedReportConfigs().catch(() => []),
        getScheduledReportRuns().catch(() => []),
        getEmailAutomationRules().catch(() => []),
        getEmailQueue().catch(() => []),
      ]);
      setConfigs(cfgs);
      setRuns(rns);
      setRules(rls);
      setQueue(q);
    } catch (err) {
      console.error('Failed to load email center data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleToggleConfig = async (cfg: AutomatedReportConfig) => {
    const res = await updateAutomatedReportConfig(cfg.id, { is_active: !cfg.is_active });
    if (res.success) {
      setConfigs(configs.map((c) => (c.id === cfg.id ? { ...c, is_active: !c.is_active } : c)));
    }
  };

  const handleToggleRule = async (rule: EmailAutomationRule) => {
    const res = await updateEmailAutomationRule(rule.id, { is_active: !rule.is_active });
    if (res.success) {
      setRules(rules.map((r) => (r.id === rule.id ? { ...r, is_active: !rule.is_active } : r)));
    }
  };

  const handleTriggerCycleNow = async (freq: any) => {
    setExecutingCycle(true);
    try {
      const res = await executeScheduledReportCycle(freq);
      if (res.success) {
        alert(`Dispatched ${res.dispatchedRuns.length} automated management report(s) for ${freq} cycle.`);
        loadAll();
      } else {
        alert(res.error || 'Failed to dispatch cycle');
      }
    } catch (err: any) {
      alert(err.message || 'Cycle error');
    } finally {
      setExecutingCycle(false);
    }
  };

  const handleProcessQueueNow = async () => {
    setExecutingCycle(true);
    try {
      const res = await processEmailQueue();
      alert(`Queue Processed: ${res.sent} sent, ${res.failed} failed out of ${res.processed} pending.`);
      loadAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExecutingCycle(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    const res = await retryQueueJob(jobId);
    if (res.success) {
      alert('Job requeued and processed.');
      loadAll();
    } else {
      alert(res.error || 'Retry failed');
    }
  };

  const queuedCount = queue.filter((j) => j.status === 'QUEUED').length;
  const deadLetterCount = queue.filter((j) => j.status === 'DEAD_LETTER').length;
  const sentCount = runs.filter((r) => r.status === 'SENT').length + queue.filter((j) => j.status === 'SENT').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Mail className="w-6 h-6 text-brand-700" />
              Central Email & Automated Reporting Centre
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Locked RBAC Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Server-side scheduled executive reporting (Asia/Kolkata 12:00 AM midnight), customer/supplier automation triggers, and durable queue monitoring.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSendTestMdSummary}
            disabled={sendingMdEmail}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {sendingMdEmail ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating &amp; Sending to MD...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send Test Executive Summary Email to MD</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* MD Summary Dispatch Feedback Banner */}
      {emailAlert && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold transition animate-in fade-in-50 ${
            emailAlert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {emailAlert.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{emailAlert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setEmailAlert(null)}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Schedules</span>
          <div className="text-xl font-extrabold text-brand-900 mt-1">
            {configs.filter((c) => c.is_active).length} / {configs.length}
          </div>
          <span className="text-[10px] text-slate-400">Midnight 12:00 AM IST Cycles</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Automation Triggers</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            {rules.filter((r) => r.is_active).length} Rules Active
          </div>
          <span className="text-[10px] text-slate-400">Customer & Supplier Events</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Durable Email Queue</span>
          <div className="text-xl font-extrabold text-blue-700 mt-1">{queuedCount} Queued</div>
          <span className="text-[10px] text-slate-400">{sentCount} Dispatched Total</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Dead-Letter Queue</span>
          <div className={`text-xl font-extrabold mt-1 ${deadLetterCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {deadLetterCount} Failed
          </div>
          <span className="text-[10px] text-slate-400">Auditable Manual Resend Ready</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'SCHEDULER', label: 'Management Report Scheduler', icon: Calendar },
          { id: 'CUSTOMER_AUTOMATION', label: 'Customer Email Automation', icon: Users },
          { id: 'SUPPLIER_AUTOMATION', label: 'Supplier Email Automation', icon: Sliders },
          { id: 'QUEUE_MONITOR', label: `Durable Queue (${queuedCount})`, icon: Clock },
          { id: 'RUN_HISTORY', label: 'Report Execution History', icon: FileText },
          { id: 'RECIPIENTS_POLICY', label: 'Locked RBAC Policy', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2.5 font-bold rounded-t-xl transition whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-brand-800 text-brand-900 bg-brand-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: SCHEDULER */}
      {activeTab === 'SCHEDULER' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-brand-50/70 rounded-xl border border-brand-200 text-xs text-brand-900">
            <div>
              <p className="font-bold">Automated Management Reporting Protocol</p>
              <p className="text-[11px] text-brand-700 mt-0.5">
                All management reports execute automatically at 12:00 AM midnight (Asia/Kolkata). Output is formatted into both professional corporate PDF and multi-table Excel.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTriggerCycleNow('DAILY')}
                disabled={executingCycle}
                className="px-3 py-1.5 bg-brand-800 hover:bg-brand-900 text-white rounded-lg font-bold shadow-sm transition disabled:opacity-50"
              >
                Run Daily Cycle Now
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {configs.map((cfg) => (
              <div key={cfg.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase font-mono mb-1">
                      {cfg.frequency} &bull; 12:00 AM IST
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">{cfg.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{cfg.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleConfig(cfg)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                      cfg.is_active
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {cfg.is_active ? 'Active' : 'Paused'}
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                  <div>
                    <strong>Authorized Roles:</strong> {cfg.allowed_roles.join(', ')}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTriggerCycleNow(cfg.frequency)}
                    disabled={executingCycle}
                    className="text-brand-700 hover:text-brand-900 font-bold hover:underline"
                  >
                    Trigger Run &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: CUSTOMER_AUTOMATION */}
      {activeTab === 'CUSTOMER_AUTOMATION' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Customer Communication Event Rules</h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Pre-configured transactional email triggers dispatched during client milestones.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {rules
              .filter((r) => r.category === 'CUSTOMER')
              .map((rule) => (
                <div key={rule.id} className="p-4 hover:bg-slate-50/60 transition flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-brand-900">{rule.trigger_type}</span>
                      <span className="font-bold text-slate-800">&bull; {rule.name}</span>
                      {rule.requires_human_approval && (
                        <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          Human Review Enforced
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500">{rule.description}</p>
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-1">
                      <strong>Subject:</strong> {rule.subject_template}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleRule(rule)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 ${
                      rule.is_active
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {rule.is_active ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tab 3: SUPPLIER_AUTOMATION */}
      {activeTab === 'SUPPLIER_AUTOMATION' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Supplier & Distributor Sourcing Triggers</h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Automated RFQ, purchase order dispatch, revision, and logistics communication.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {rules
              .filter((r) => r.category === 'SUPPLIER')
              .map((rule) => (
                <div key={rule.id} className="p-4 hover:bg-slate-50/60 transition flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{rule.trigger_type}</span>
                      <span className="font-bold text-slate-800">&bull; {rule.name}</span>
                    </div>
                    <p className="text-slate-500">{rule.description}</p>
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-1">
                      <strong>Subject:</strong> {rule.subject_template}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleRule(rule)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 ${
                      rule.is_active
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {rule.is_active ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tab 4: QUEUE_MONITOR */}
      {activeTab === 'QUEUE_MONITOR' && (
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="font-bold text-slate-800">Durable Email Worker Status: Active</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pending jobs are retried with exponential backoff (5m, 10m, 20m). Dead-letter items can be manually inspected and re-queued.
              </p>
            </div>
            <button
              type="button"
              onClick={handleProcessQueueNow}
              disabled={executingCycle}
              className="px-3 py-1.5 bg-brand-800 hover:bg-brand-900 text-white rounded-lg font-bold shadow-sm transition disabled:opacity-50"
            >
              Process Queue Now
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-700">
                    <th className="py-2.5 px-3 font-bold">Job ID</th>
                    <th className="py-2.5 px-3 font-bold">Trigger</th>
                    <th className="py-2.5 px-3 font-bold">Recipient</th>
                    <th className="py-2.5 px-3 font-bold">Subject / Entity</th>
                    <th className="py-2.5 px-2 font-bold text-center">Retries</th>
                    <th className="py-2.5 px-2 font-bold text-center">Status</th>
                    <th className="py-2.5 px-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Queue is empty. No pending or failed jobs.
                      </td>
                    </tr>
                  ) : (
                    queue.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{j.id}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{j.trigger_type}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{j.recipient_name}</div>
                          <div className="text-[10px] text-slate-500">{j.recipient_email}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{j.subject}</div>
                          <div className="text-[10px] font-mono text-slate-400">Ref: {j.entity_number}</div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">{j.retry_count} / {j.max_retries}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              j.status === 'SENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : j.status === 'DEAD_LETTER'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {j.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {j.status === 'DEAD_LETTER' && (
                            <button
                              type="button"
                              onClick={() => handleRetryJob(j.id)}
                              className="text-brand-700 hover:text-brand-900 font-bold text-xs"
                            >
                              Resend
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: RUN_HISTORY */}
      {activeTab === 'RUN_HISTORY' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Scheduled Report Run Records</h3>
            <span className="text-[11px] text-slate-500">Idempotent Execution Audit</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-700">
                  <th className="py-2.5 px-3 font-bold">Run ID</th>
                  <th className="py-2.5 px-3 font-bold">Report Name</th>
                  <th className="py-2.5 px-3 font-bold">Frequency & Period</th>
                  <th className="py-2.5 px-3 font-bold">Recipient</th>
                  <th className="py-2.5 px-3 font-bold">Dispatched At</th>
                  <th className="py-2.5 px-2 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No report run history yet. Trigger a schedule cycle to generate audit records.
                    </td>
                  </tr>
                ) : (
                  runs.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{r.id}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{r.report_name}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-700">{r.frequency}</span>
                        <div className="text-[10px] text-slate-500">{r.period_label}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{r.recipient_role}</div>
                        <div className="text-[10px] text-slate-500">{r.recipient_email}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(r.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: RECIPIENTS_POLICY */}
      {activeTab === 'RECIPIENTS_POLICY' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 text-xs">
          <div className="flex items-center gap-2 text-brand-900 font-bold text-sm border-b border-slate-200 pb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            LOCKED REQUIREMENT: Server-Side Role-Based Distribution Policy
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <h4 className="font-bold text-slate-900 text-xs">Managing Director (MD)</h4>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                <li>Receives all company-wide information without exception.</li>
                <li>Consolidated gross profit margin %, revenue, and total purchases.</li>
                <li>Complete operational and management reports.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <h4 className="font-bold text-slate-900 text-xs">Accounts Department</h4>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                <li>Sales invoices, purchase orders, receipts, payments, and collections.</li>
                <li>Receivables aging ledger and overdue balances.</li>
                <li>GST liability calculations and bank reconciliation data.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <h4 className="font-bold text-slate-900 text-xs">System Administrator & IT Governance</h4>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                <li>System audit events, security health, Tally sync telemetry, and user access changes.</li>
                <li>Email queue health and server diagnostic notifications.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
              <h4 className="font-bold text-rose-900 text-xs">Sales Executives & Field Reps</h4>
              <ul className="list-disc pl-4 space-y-1 text-rose-800 text-[11px]">
                <li><strong>Strictly restricted:</strong> Receive ONLY their own assigned sales data.</li>
                <li>Can NEVER receive another salesperson's enquiries, quotations or performance.</li>
                <li>Can NEVER receive confidential Accounts data or purchase margins.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
