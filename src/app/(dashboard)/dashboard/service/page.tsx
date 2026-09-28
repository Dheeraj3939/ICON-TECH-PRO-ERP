'use client';

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  ShieldCheck,
  ChevronDown,
  Laptop,
  Pencil,
  Bot,
  Sparkles,
  Send,
  RefreshCw,
  Check,
} from 'lucide-react';
import {
  getServiceTickets,
  getAMCContracts,
  createServiceTicket,
  getWarrantyClaims,
  renewAMCContract,
} from '@/lib/actions/services';
import {
  getAMCOpportunities,
  scanAndGenerateAMCOpportunities,
  approveAMCOutreach,
  sendAMCOutreach,
  convertAMCOpportunityToContract,
  getAMCIntelligenceStats,
} from '@/lib/actions/amc-intelligence';
import { getCustomers } from '@/lib/actions/customers';
import { getInstallations } from '@/lib/actions/operations';
import type { ServiceTicket, AMCContract, Installation, WarrantyClaim } from '@/types/erp';
import type { Customer } from '@/types/customer';
import type { AMCOpportunity, AMCIntelligenceSummary } from '@/types/amc';
import { EditServiceTicketModal, EditAMCModal, EditWarrantyClaimModal } from '@/components/modals/EditServiceModal';

export default function ServicePage() {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [amcs, setAmcs] = useState<AMCContract[]>([]);
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [opportunities, setOpportunities] = useState<AMCOpportunity[]>([]);
  const [amcStats, setAmcStats] = useState<AMCIntelligenceSummary | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tickets' | 'amc' | 'claims' | 'intelligence'>('tickets');
  const [isLogTicketOpen, setIsLogTicketOpen] = useState(false);

  const [editingTicket, setEditingTicket] = useState<ServiceTicket | null>(null);
  const [editingAmc, setEditingAmc] = useState<AMCContract | null>(null);
  const [editingClaim, setEditingClaim] = useState<WarrantyClaim | null>(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerAssets, setCustomerAssets] = useState<Array<{ product_name: string; sku?: string; quantity?: number }>>([]);

  const [newTicket, setNewTicket] = useState({
    customer_name: '',
    product_name: '',
    serial_number: '',
    complaint_description: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical',
    assigned_technician_name: 'Nagaraju',
  });

  const loadData = async () => {
    const [t, a, custRes, instList, clmList, opps, stats] = await Promise.all([
      getServiceTickets(),
      getAMCContracts(),
      getCustomers(),
      getInstallations(),
      getWarrantyClaims(),
      getAMCOpportunities(),
      getAMCIntelligenceStats(),
    ]);
    setTickets(t);
    setAmcs(a);
    setClaims(clmList);
    setOpportunities(opps);
    setAmcStats(stats);
    if (custRes && custRes.customers) {
      setCustomers(custRes.customers);
    }
    setInstallations(instList);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectCustomer = (c: Customer) => {
    const name = c.company_name || c.contact_person || 'Unknown Customer';
    setNewTicket((prev) => ({ ...prev, customer_name: name }));
    setCustomerSearch(name);
    setShowCustomerDropdown(false);

    // Look up installed equipment for this customer
    const matched = installations.filter(
      (i) =>
        (i.customer_name && i.customer_name.toLowerCase() === name.toLowerCase()) ||
        i.customer_id === c.id ||
        i.customer_id === c.customer_code
    );
    const assets = matched.flatMap((i) => i.installed_products || []);
    setCustomerAssets(assets);
    if (assets.length > 0) {
      setNewTicket((prev) => ({
        ...prev,
        customer_name: name,
        product_name: assets[0].product_name,
        serial_number: assets[0].sku || '',
      }));
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    await createServiceTicket(newTicket);
    setIsLogTicketOpen(false);
    loadData();
  };

  const handleRunAMCScan = async () => {
    setIsScanning(true);
    setActionMessage(null);
    try {
      const res = await scanAndGenerateAMCOpportunities();
      if (res.success) {
        setActionMessage(`Proactive 45-day scan complete: ${res.newOpportunitiesCreated} new renewal opportunities identified.`);
        await loadData();
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleApproveOutreach = async (oppId: string) => {
    const res = await approveAMCOutreach(oppId);
    if (res.success) {
      setActionMessage('Outreach message approved by authorized manager.');
      await loadData();
    }
  };

  const handleSendOutreach = async (oppId: string) => {
    const res = await sendAMCOutreach(oppId);
    if (res.success) {
      setActionMessage('Outreach message dispatched successfully via communication center.');
      await loadData();
    } else {
      setActionMessage(res.error || 'Failed to dispatch outreach');
    }
  };

  const handleConvertContract = async (oppId: string) => {
    const res = await convertAMCOpportunityToContract(oppId);
    if (res.success) {
      setActionMessage('Contract successfully renewed for an additional 12-month term!');
      await loadData();
    } else {
      setActionMessage(res.error || 'Failed to renew contract');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Service Tickets & AMC Maintenance
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold">
              ICON Service & AMC Division
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Customer complaint management, field technician assignments, and annual maintenance contract tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                activeTab === 'tickets' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Service Tickets ({tickets.length})
            </button>
            <button
              onClick={() => setActiveTab('amc')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                activeTab === 'amc' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              AMC Contracts ({amcs.length})
            </button>
            <button
              onClick={() => setActiveTab('claims')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                activeTab === 'claims' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Warranty Claims ({claims.length})
            </button>
            <button
              onClick={() => setActiveTab('intelligence')}
              className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'intelligence' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AMC Intelligence ({opportunities.length})</span>
            </button>
          </div>

          <button
            onClick={() => setIsLogTicketOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Log Ticket</span>
          </button>
        </div>
      </div>

      {/* AMC Expiration Renewal Alert */}
      {amcs.some((a) => a.end_date && new Date(a.end_date).getTime() - Date.now() < 30 * 24 * 3600 * 1000) && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>AMC Renewal Alert:</strong> One or more AMC contracts are expiring within the next 30 days. Review and issue renewal quotes.
          </span>
        </div>
      )}

      {activeTab === 'tickets' ? (
        /* Service Tickets Zero-Scroll Register */
        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
          {/* Desktop Zero-Scroll Table */}
          <div className="hidden md:block w-full">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[28%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Ticket # & Customer</th>
                  <th className="py-2.5 px-3">Product / Serial No</th>
                  <th className="py-2.5 px-3">Complaint & Resolution</th>
                  <th className="py-2.5 px-3 text-center">Tech & Priority</th>
                  <th className="py-2.5 px-3 text-right">Status & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-slate-900">{t.ticket_number}</div>
                      <div className="font-semibold text-slate-800 truncate text-[11px] mt-0.5">{t.customer_name}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800 truncate">{t.product_name || 'General AV Setup'}</div>
                      {t.serial_number && (
                        <span className="font-mono text-slate-400 text-[10px] block truncate">
                          S/N: {t.serial_number}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-600 leading-snug line-clamp-2">{t.complaint_description}</div>
                      {t.resolution_details && (
                        <div className="text-[11px] text-emerald-700 font-medium mt-1 truncate">
                          Resolved: {t.resolution_details}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="font-medium text-slate-700 truncate text-[11px]">
                        {t.assigned_technician_name || 'Unassigned'}
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border mt-1 ${
                          t.priority === 'Critical'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : t.priority === 'High'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            t.status === 'Resolved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : t.status === 'In Progress'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                          }`}
                        >
                          {t.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingTicket(t)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold transition text-[11px] border border-amber-200 shadow-2xs"
                          title="Edit Service Ticket"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Ticket Cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {tickets.map((t) => (
              <div key={t.id} className="p-4 space-y-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-xs text-brand-700">{t.ticket_number}</span>
                    <h4 className="font-bold text-slate-900 text-sm mt-0.5">{t.customer_name}</h4>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                      t.status === 'Resolved'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : t.status === 'In Progress'
                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                        : 'bg-amber-50 text-amber-700 border-amber-300'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="font-semibold text-slate-800">{t.product_name || 'General AV Setup'}</div>
                  {t.serial_number && (
                    <div className="font-mono text-slate-400 text-[10px] mt-0.5">S/N: {t.serial_number}</div>
                  )}
                  <p className="text-slate-600 mt-1.5 leading-relaxed">{t.complaint_description}</p>
                  {t.resolution_details && (
                    <div className="text-[11px] text-emerald-700 font-medium mt-1">
                      Resolved: {t.resolution_details}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="text-[11px]">Tech: <strong>{t.assigned_technician_name || 'Unassigned'}</strong></span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      t.priority === 'Critical'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : t.priority === 'High'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {t.priority}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingTicket(t)}
                  className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs"
                >
                  <Pencil className="w-4 h-4" />
                  <span>Edit Ticket</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'amc' ? (
        /* AMC Contracts Zero-Scroll Register */
        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
          {/* Desktop Zero-Scroll Table */}
          <div className="hidden md:block w-full">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[26%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Contract # & Customer</th>
                  <th className="py-2.5 px-3">Validity Period & Visits</th>
                  <th className="py-2.5 px-3 text-right">Contract Value</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {amcs.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-slate-900">{a.contract_number}</div>
                      <div className="font-semibold text-slate-800 truncate text-[11px] mt-0.5">{a.customer_name}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-700 font-medium">
                        {a.start_date} to {a.end_date}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{a.annual_visits_count} Visits / Year</div>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900 text-sm">
                      ₹{a.contract_value.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                        {a.renewal_status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingAmc(a)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold transition text-[11px] border border-amber-200 shadow-2xs"
                        title="Edit AMC Contract"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile AMC Cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {amcs.map((a) => (
              <div key={a.id} className="p-4 space-y-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-xs text-brand-700">{a.contract_number}</span>
                    <h4 className="font-bold text-slate-900 text-sm mt-0.5">{a.customer_name}</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200 shrink-0">
                    {a.renewal_status || 'ACTIVE'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Contract Value</span>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    ₹{a.contract_value.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Validity: <strong>{a.start_date} to {a.end_date}</strong></span>
                  <span className="font-bold">{a.annual_visits_count} Visits/Yr</span>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingAmc(a)}
                  className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs"
                >
                  <Pencil className="w-4 h-4" />
                  <span>Edit AMC Contract</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Warranty Claims Zero-Scroll Register */
        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
          {/* Desktop Zero-Scroll Table */}
          <div className="hidden md:block w-full">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[24%]" />
                <col className="w-[28%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Claim # & Customer</th>
                  <th className="py-2.5 px-3">Product & Serial No</th>
                  <th className="py-2.5 px-3">Issue Description</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {claims.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-slate-900">{c.claim_number}</div>
                      <div className="font-semibold text-slate-800 truncate text-[11px] mt-0.5">{c.customer_name}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800 truncate">{c.product_name || 'AV Equipment'}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                        <span className="font-mono text-slate-400">S/N: {c.serial_number}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">{c.claim_type}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-600 leading-snug line-clamp-2">{c.issue_description}</div>
                      {c.resolution_notes && (
                        <div className="text-[11px] text-emerald-700 font-medium mt-1 truncate">
                          Note: {c.resolution_notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          c.status === 'RESOLVED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : c.status === 'IN_REPAIR'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : c.status === 'APPROVED'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingClaim(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold transition text-[11px] border border-amber-200 shadow-2xs"
                        title="Edit Warranty Claim"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Claim Cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {claims.map((c) => (
              <div key={c.id} className="p-4 space-y-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-xs text-brand-700">{c.claim_number}</span>
                    <h4 className="font-bold text-slate-900 text-sm mt-0.5">{c.customer_name}</h4>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                      c.status === 'RESOLVED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : c.status === 'IN_REPAIR'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : c.status === 'APPROVED'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{c.product_name || 'AV Equipment'}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">{c.claim_type}</span>
                  </div>
                  <div className="font-mono text-slate-400 text-[10px] mt-0.5">S/N: {c.serial_number}</div>
                  <p className="text-slate-600 mt-1.5 leading-relaxed">{c.issue_description}</p>
                  {c.resolution_notes && (
                    <div className="text-[11px] text-emerald-700 font-medium mt-1">
                      Note: {c.resolution_notes}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setEditingClaim(c)}
                  className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs"
                >
                  <Pencil className="w-4 h-4" />
                  <span>Edit Claim</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AMC Intelligence & 45-Day Proactive Renewal Radar */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          {actionMessage && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{actionMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionMessage(null)}
                className="text-amber-700 hover:text-amber-900 font-bold ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Radar Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Active AMCs</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {amcStats?.totalActiveAMCs ?? amcs.filter((a) => a.is_active).length}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Under active maintenance</p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
                <span>Expiring in 45 Days</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-950 mt-2">
                {amcStats?.expiringIn45Days ?? 0}
              </div>
              <p className="text-[11px] text-amber-700 mt-1">Target for proactive outreach</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Pipeline Value</span>
                <Sparkles className="w-4 h-4 text-brand-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                ₹{(amcStats?.totalOpportunityPipelineValue ?? 0).toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Annual recurring renewal volume</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Conversion Tracking</span>
                <Bot className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {amcStats?.renewedCount ?? 0} Renewed
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {amcStats?.pendingApprovalCount ?? 0} Pending • {amcStats?.outreachSentCount ?? 0} Sent
              </p>
            </div>
          </div>

          {/* Scan Action Bar */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg border border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">45-Day Proactive Renewal Radar</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold border border-amber-400/30">
                  Autonomous Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Scans contract end dates, filters expiring accounts within the 45-day window, synthesizes draft communications, and queues them for human approval.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunAMCScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-md disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Contracts...' : 'Run Proactive 45-Day Scan'}</span>
            </button>
          </div>

          {/* Opportunity Cards List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Identified AMC Opportunities ({opportunities.length})
              </h2>
              <span className="text-xs text-slate-500">
                Governance Rule: Human approval required before dispatch
              </span>
            </div>

            {opportunities.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                <Bot className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="font-bold text-slate-700">No pending AMC opportunities in pipeline</p>
                <p className="mt-1">Click &ldquo;Run Proactive 45-Day Scan&rdquo; above to inspect all active contracts for upcoming expiries.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {opportunities.map((opp) => {
                  const isExpiringSoon = opp.days_until_expiry <= 45 && opp.days_until_expiry >= 0;
                  const isExpired = opp.days_until_expiry < 0;

                  return (
                    <div
                      key={opp.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-brand-700 px-2 py-0.5 rounded bg-brand-50 border border-brand-200">
                            {opp.opportunity_number}
                          </span>
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">
                              {opp.customer_name}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              Source Contract: {opp.source_contract_number || 'Direct Customer'} • Managed by {opp.responsible_employee_name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isExpired
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : isExpiringSoon
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isExpired
                              ? `Expired ${Math.abs(opp.days_until_expiry)}d ago`
                              : `Expires in ${opp.days_until_expiry} days`}
                          </span>

                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                              opp.status === 'RENEWED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : opp.status === 'OUTREACH_SENT'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : opp.status === 'OUTREACH_PENDING_APPROVAL'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {opp.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Opportunity Details & AI Draft */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="space-y-1">
                          <span className="text-slate-400 text-[10px] uppercase font-bold">Package & Value</span>
                          <p className="font-bold text-slate-800">
                            {opp.recommended_package} AMC
                          </p>
                          <p className="text-base font-black text-emerald-700">
                            ₹{Number(opp.target_annual_value || 0).toLocaleString('en-IN')}
                            <span className="text-[11px] font-normal text-slate-400"> / year</span>
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Channel: <strong className="text-slate-700">{opp.draft_channel}</strong>
                          </p>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                            <div className="flex items-center gap-1.5 text-slate-700 font-bold text-[11px] mb-1">
                              <Bot className="w-3.5 h-3.5 text-amber-600" />
                              <span>AI Opportunity Analysis</span>
                            </div>
                            <p className="text-slate-600 text-[11px] leading-relaxed">
                              {opp.ai_recommendation || 'Proactive renewal recommended to ensure uninterrupted service support and preventative maintenance coverage.'}
                            </p>
                          </div>

                          {opp.draft_message && (
                            <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 text-[11px]">
                              <span className="text-amber-800 font-bold block mb-1">Proposed Outreach Message:</span>
                              <p className="text-slate-700 italic font-sans leading-relaxed">
                                &ldquo;{opp.draft_message}&rdquo;
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Bar with Human Approval Gate */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="text-[11px] text-slate-400">
                          {opp.is_approved ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approved by {opp.approved_by_name || 'Authorized Manager'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Awaiting management review & approval
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!opp.is_approved && (
                            <button
                              type="button"
                              onClick={() => handleApproveOutreach(opp.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-2xs cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve Outreach Draft</span>
                            </button>
                          )}

                          {opp.is_approved && opp.status !== 'OUTREACH_SENT' && opp.status !== 'RENEWED' && (
                            <button
                              type="button"
                              onClick={() => handleSendOutreach(opp.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-2xs cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Dispatch Outreach via Outbox</span>
                            </button>
                          )}

                          {opp.status === 'OUTREACH_SENT' && (
                            <button
                              type="button"
                              onClick={() => handleConvertContract(opp.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-2xs cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Convert / Renew Contract (+12 Mo)</span>
                            </button>
                          )}

                          {opp.status === 'RENEWED' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Contract Renewed & Active</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Ticket Modal */}
      {isLogTicketOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-900">Log Customer Complaint Ticket</h2>
            <form onSubmit={handleCreateTicket} className="space-y-3">
              {/* Customer Autocomplete */}
              <div className="relative">
                <label className="block font-semibold mb-1">Customer / Client Name *</label>
                <input
                  type="text"
                  required
                  value={newTicket.customer_name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewTicket({ ...newTicket, customer_name: val });
                    setCustomerSearch(val);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Type to search customer or company..."
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                {showCustomerDropdown && (
                  <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 text-xs">
                    {customers
                      .filter((c) => {
                        const q = customerSearch.toLowerCase();
                        return (
                          (c.company_name && c.company_name.toLowerCase().includes(q)) ||
                          (c.contact_person && c.contact_person.toLowerCase().includes(q))
                        );
                      })
                      .slice(0, 8)
                      .map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          className="p-2 hover:bg-brand-50 cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <strong className="block text-slate-800">
                              {c.company_name || c.contact_person}
                            </strong>
                            <span className="text-[10px] text-slate-400">
                              {c.contact_person} • {c.phone}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {c.city || 'Hyderabad'}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Installed Assets Picker (if customer has installed equipment) */}
              {customerAssets.length > 0 && (
                <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-teal-800 font-bold text-[11px]">
                    <Laptop className="w-3.5 h-3.5 text-teal-600" />
                    <span>Customer Installed Equipment ({customerAssets.length} found)</span>
                  </div>
                  <select
                    onChange={(e) => {
                      const sel = customerAssets.find((a) => a.product_name === e.target.value);
                      if (sel) {
                        setNewTicket((prev) => ({
                          ...prev,
                          product_name: sel.product_name,
                          serial_number: sel.sku || prev.serial_number,
                        }));
                      }
                    }}
                    className="w-full px-2 py-1 border border-teal-200 rounded-lg bg-white text-xs outline-none"
                  >
                    <option value="">-- Quick-select installed equipment --</option>
                    {customerAssets.map((asset, idx) => (
                      <option key={idx} value={asset.product_name}>
                        {asset.product_name} {asset.sku ? `(${asset.sku})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">Equipment / Product Name</label>
                  <input
                    type="text"
                    value={newTicket.product_name}
                    onChange={(e) => setNewTicket({ ...newTicket, product_name: e.target.value })}
                    placeholder="e.g. 4K Laser Projector"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Serial Number / SKU</label>
                  <input
                    type="text"
                    value={newTicket.serial_number}
                    onChange={(e) => setNewTicket({ ...newTicket, serial_number: e.target.value })}
                    placeholder="e.g. EP-4K-980"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Priority</label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none bg-white"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Complaint Details *</label>
                <textarea
                  required
                  rows={3}
                  value={newTicket.complaint_description}
                  onChange={(e) => setNewTicket({ ...newTicket, complaint_description: e.target.value })}
                  placeholder="Describe the issue reported by the client..."
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsLogTicketOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Modals */}
      <EditServiceTicketModal
        isOpen={!!editingTicket}
        onClose={() => setEditingTicket(null)}
        ticket={editingTicket}
        onSuccess={loadData}
      />
      <EditAMCModal
        isOpen={!!editingAmc}
        onClose={() => setEditingAmc(null)}
        contract={editingAmc}
        onSuccess={loadData}
      />
      <EditWarrantyClaimModal
        isOpen={!!editingClaim}
        onClose={() => setEditingClaim(null)}
        claim={editingClaim}
        onSuccess={loadData}
      />
    </div>
  );
}
