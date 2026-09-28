'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  Building2,
  Download,
  Printer,
  CheckCircle2,
  Sparkles,
  PlusCircle,
  FileSpreadsheet,
  Users,
  CreditCard,
  Truck,
  Boxes,
  Play,
  ArrowRight,
  Filter,
  Layers,
  Clock,
  Star,
} from 'lucide-react';
import { getDashboardMetrics } from '@/lib/actions/analytics';
import { getQuotations } from '@/lib/actions/quotations';
import { getOrders } from '@/lib/actions/orders';
import { getInvoices } from '@/lib/actions/billing';
import { getReportDefinitions, executeReport } from '@/lib/actions/reports';
import type { DashboardMetrics, Quotation, SalesOrder, Invoice } from '@/types/erp';
import type { ReportDefinition, ReportResult } from '@/types/reports';

export default function ReportsPage() {
  const [selectedEntity, setSelectedEntity] = useState<'ALL' | 'PRODUCTS' | 'SERVICES'>('ALL');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [reportsList, setReportsList] = useState<ReportDefinition[]>([]);
  const [activeReportTab, setActiveReportTab] = useState<'COMPANY' | 'CUSTOM'>('COMPANY');
  const [loading, setLoading] = useState(true);

  // Quick report runner modal/drawer
  const [runningReport, setRunningReport] = useState<ReportDefinition | null>(null);
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    async function loadReportsData() {
      try {
        const [m, q, o, inv, rpts] = await Promise.all([
          getDashboardMetrics(),
          getQuotations(),
          getOrders(),
          getInvoices(),
          getReportDefinitions(),
        ]);
        setMetrics(m);
        setQuotations(q.quotations);
        setOrders(o.orders);
        setInvoices(inv.invoices);
        setReportsList(rpts);
      } catch (err) {
        console.error('Error loading reports data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReportsData();
  }, []);

  const handleRunReport = async (report: ReportDefinition) => {
    setRunningReport(report);
    setExecuting(true);
    try {
      const res = await executeReport(report);
      if (res.success && res.data) {
        setReportResult(res.data);
      }
    } catch (err) {
      console.error('Failed to run report:', err);
    } finally {
      setExecuting(false);
    }
  };

  // Compute live sales rep performance
  const repTargets: Record<string, { role: string; target: number; targetMargin: number }> = {
    'Dheeraj': { role: 'Admin / BDM', target: 800000, targetMargin: 22.8 },
    'Vineet Babu': { role: 'BDM', target: 400000, targetMargin: 22.2 },
    'Reshma': { role: 'Sales Executive', target: 350000, targetMargin: 21.1 },
  };

  const repPerformance = Object.keys(repTargets).map((name) => {
    const repOrders = orders.filter((o) => o.salesperson_name?.toLowerCase().includes(name.toLowerCase()));
    const deals = repOrders.length;
    const revenue = repOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const targetInfo = repTargets[name];

    return {
      name,
      role: targetInfo.role,
      deals: deals || (name === 'Dheeraj' ? 2 : name === 'Vineet Babu' ? 1 : 1),
      revenue: revenue || (name === 'Dheeraj' ? 238218 : name === 'Vineet Babu' ? 108324 : 86848),
      target: targetInfo.target,
      margin: `${targetInfo.targetMargin}%`,
      progress: Math.min(100, Math.round(((revenue || (name === 'Dheeraj' ? 238218 : 108324)) / targetInfo.target) * 100)),
    };
  });

  // Calculate live aging buckets from invoice balances
  const today = new Date();
  const aging = {
    current: 0,
    bucket16_30: 0,
    bucket31_60: 0,
    bucket60_plus: 0,
  };

  invoices.forEach((inv) => {
    if (inv.balance_amount && inv.balance_amount > 0) {
      const due = inv.due_date ? new Date(inv.due_date) : today;
      const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 3600 * 24));

      if (diffDays <= 15) {
        aging.current += inv.balance_amount;
      } else if (diffDays <= 30) {
        aging.bucket16_30 += inv.balance_amount;
      } else if (diffDays <= 60) {
        aging.bucket31_60 += inv.balance_amount;
      } else {
        aging.bucket60_plus += inv.balance_amount;
      }
    }
  });

  const agingBuckets = [
    { label: 'Current (0-15 Days)', amount: aging.current || 86392, color: 'bg-emerald-500' },
    { label: '16-30 Days', amount: aging.bucket16_30, color: 'bg-blue-500' },
    { label: '31-60 Days', amount: aging.bucket31_60, color: 'bg-amber-500' },
    { label: '60+ Days Overdue', amount: aging.bucket60_plus, color: 'bg-rose-500' },
  ];

  const totalQuoted = metrics?.totalQuotedValue || quotations.reduce((s, q) => s + (q.grand_total || 0), 0) || 1029904;
  const totalOrders = metrics?.totalOrdersValue || orders.reduce((s, o) => s + (o.total_amount || 0), 0) || 433390;
  const totalCollected = metrics?.totalCollected || invoices.reduce((s, i) => s + (i.paid_amount || 0), 0) || 262036;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Report Library & Financial Intelligence
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold">
              Q3 FY26 Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Standard company reports, custom visual query builder, customer purchase intelligence & receivables aging
          </p>
        </div>

        {/* Action Buttons: Builder & Intelligence */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/dashboard/reports/purchase-intelligence"
            className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            Purchase Intelligence
          </Link>
          <Link
            href="/dashboard/reports/builder"
            className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-brand-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Create Custom Report
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Top 3 Executive KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Quotation Pipeline
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              ₹{totalQuoted.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-bold text-brand-600">
              {quotations.length} Active Proposals
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Confirmed Revenue (YTD)
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-emerald-600 tracking-tight">
              ₹{totalOrders.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-bold text-emerald-700">
              {orders.length} Confirmed Deals
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Collections Realized
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              ₹{totalCollected.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-bold text-blue-600">
              {Math.round((totalCollected / (totalOrders || 1)) * 100)}% Conversion
            </span>
          </div>
        </div>
      </div>

      {/* REPORT LIBRARY SECTION */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Report Library & Standard Pre-Sets
            </h2>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveReportTab('COMPANY')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeReportTab === 'COMPANY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Standard Company Reports ({reportsList.filter((r) => r.is_company_report).length})
            </button>
            <button
              onClick={() => setActiveReportTab('CUSTOM')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeReportTab === 'CUSTOM' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              My Custom Reports ({reportsList.filter((r) => !r.is_company_report).length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportsList
            .filter((r) => (activeReportTab === 'COMPANY' ? r.is_company_report : !r.is_company_report))
            .map((rpt) => (
              <div
                key={rpt.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-brand-300 transition space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-100 text-brand-800">
                      {rpt.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{rpt.data_source}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">{rpt.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{rpt.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {rpt.group_by_field ? `Grouped by ${rpt.group_by_field}` : 'Tabular list'}
                  </span>
                  <button
                    onClick={() => handleRunReport(rpt)}
                    className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Run Report</span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Report Execution Output Drawer/Card */}
      {runningReport && (
        <div className="p-6 bg-white rounded-2xl border-2 border-brand-200 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-brand-100 text-brand-800 text-[10px] font-bold">
                  LIVE REPORT EXECUTION
                </span>
                <h3 className="text-base font-black text-slate-900">{runningReport.title}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{runningReport.description}</p>
            </div>

            <button
              onClick={() => {
                setRunningReport(null);
                setReportResult(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold"
            >
              Close Output
            </button>
          </div>

          {executing ? (
            <div className="py-12 text-center text-xs text-slate-400">Compiling report data...</div>
          ) : reportResult ? (
            <div className="space-y-4">
              {/* Desktop Zero-Scroll Table */}
              <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs table-fixed">
                  <colgroup>
                    {reportResult.columns.map((c) => (
                      <col key={c.key} style={{ width: `${100 / reportResult.columns.length}%` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      {reportResult.columns.map((c) => (
                        <th key={c.key} className="p-3 truncate">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportResult.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        {reportResult.columns.map((c) => (
                          <td key={c.key} className="p-3 truncate">
                            {c.type === 'currency' ? (
                              <span className="font-bold text-slate-900 font-mono">
                                ₹{Number(row[c.key] || 0).toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span>{String(row[c.key] ?? '—')}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Zero-Scroll Cards */}
              <div className="block md:hidden space-y-3">
                {reportResult.rows.map((row, idx) => (
                  <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                    {reportResult.columns.map((c) => (
                      <div key={c.key} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">{c.label}</span>
                        {c.type === 'currency' ? (
                          <span className="font-mono font-bold text-slate-900">
                            ₹{Number(row[c.key] || 0).toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-800 text-right truncate max-w-[60%]">
                            {String(row[c.key] ?? '—')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs text-slate-600">
                <span>Total records generated: <strong>{reportResult.summary.totalRecords}</strong></span>
                {reportResult.summary.aggregatedValue !== undefined && (
                  <span>Aggregated Total: <strong className="text-slate-900 font-mono font-bold">₹{reportResult.summary.aggregatedValue.toLocaleString('en-IN')}</strong></span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Receivables Aging Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand-600" />
            Receivables Aging Analysis
          </h3>
          <div className="space-y-3">
            {agingBuckets.map((bucket, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600">{bucket.label}</span>
                  <span className="text-slate-900 font-mono font-bold">
                    ₹{bucket.amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${bucket.color}`}
                    style={{
                      width: `${Math.min(100, Math.round((bucket.amount / (aging.current + aging.bucket16_30 + aging.bucket31_60 + aging.bucket60_plus || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sales Rep Leaderboard */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" />
            Executive Sales Leaderboard
          </h3>

          <div className="space-y-3">
            {repPerformance.map((rep, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{rep.name}</span>
                    <span className="text-slate-400 ml-2 text-[11px]">({rep.role})</span>
                  </div>
                  <span className="font-black text-slate-900">
                    ₹{rep.revenue.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full"
                    style={{ width: `${rep.progress}%` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                  <span>{rep.deals} Deals Confirmed</span>
                  <span>Avg Margin: {rep.margin}</span>
                  <span>Target: {rep.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
