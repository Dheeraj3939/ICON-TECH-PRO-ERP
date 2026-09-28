'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, Clock, User, CheckCircle2 } from 'lucide-react';
import { getAuditLogs } from '@/lib/actions/analytics';
import { SettingsNav } from '@/components/layout/SettingsNav';
import type { AuditLog } from '@/types/erp';

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');

  useEffect(() => {
    getAuditLogs().then(setLogs);
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesModule = moduleFilter === 'ALL' || log.module.toLowerCase() === moduleFilter.toLowerCase();
    const matchesSearch =
      search === '' ||
      log.user_name.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());
    return matchesModule && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Audit Trail Ledger
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold">
              Append-Only Immutability
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete compliance logging across customer creation, commercial quotations, confirmed orders, user administration, and access security
          </p>
        </div>
      </div>

      <SettingsNav />

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-700"
        >
          <option value="ALL">All Modules</option>
          <option value="USER_MANAGEMENT">User Management & Security</option>
          <option value="ROLE_MANAGEMENT">Role & Permissions</option>
          <option value="Leads">Leads & Enquiries</option>
          <option value="Quotations">Commercial Quotations</option>
          <option value="Orders">Confirmed Orders</option>
          <option value="Accounts">Accounts & Payments</option>
          <option value="Customers">Customer Master</option>
        </select>
      </div>

      {/* Audit Log Zero-Scroll Register */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden text-xs">
        {/* Desktop Zero-Scroll Table */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[56%]" />
            </colgroup>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3">Timestamp & User</th>
                <th className="py-2.5 px-3">Module & Action</th>
                <th className="py-2.5 px-3">Activity Log Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{log.user_name}</div>
                    <div className="text-slate-500 font-mono text-[11px] mt-0.5">{log.timestamp}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700 text-[10px]">
                      {log.module}
                    </span>
                    <div className="font-mono font-bold text-brand-700 text-[11px] mt-1">
                      {log.action}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-700 leading-relaxed break-words">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Audit Cards */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredLogs.map((log) => (
            <div key={log.id} className="p-4 space-y-2 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900 text-sm">{log.user_name}</span>
                  <div className="text-slate-400 font-mono text-[10px] mt-0.5">{log.timestamp}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700 text-[10px] shrink-0">
                  {log.module}
                </span>
              </div>
              <div className="font-mono font-bold text-brand-700 text-xs">
                {log.action}
              </div>
              <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed break-words">
                {log.details}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
