'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Building,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Users,
  Layers,
  Sparkles,
} from 'lucide-react';
import { getUserAccessGovernance, saveUserAccessGovernance } from '@/lib/actions/users';
import { ALL_ERP_MODULES } from '@/types/rbac';
import type { ManagedUser, ERPModule } from '@/types/rbac';

interface ManageAccessModalProps {
  user: ManagedUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MODULE_CATEGORIES: {
  category: string;
  description: string;
  modules: { name: ERPModule; label: string; desc: string }[];
}[] = [
  {
    category: 'CORE OPERATIONS',
    description: 'Everyday lead tracking, customer accounts and customer visits',
    modules: [
      { name: 'Dashboard', label: 'Executive & Role Dashboard', desc: 'Main cockpit with sales & operational widgets' },
      { name: 'Customers', label: 'Customer 360 & Profiles', desc: 'Customer directory, GSTIN, contacts and ledger' },
      { name: 'Enquiries / Leads', label: 'Enquiries & Lead Desk', desc: 'Lead pipeline, tender tracking and status stages' },
      { name: 'Follow-ups', label: 'Follow-ups & Tasks', desc: 'Daily calling queues and scheduled task reminders' },
      { name: 'Site Visits', label: 'Site Surveys & Visits', desc: 'On-site technical surveys and AV site logs' },
    ],
  },
  {
    category: 'COMMERCIAL SALES',
    description: 'Commercial proposals, sales orders, and prospect intelligence',
    modules: [
      { name: 'Quotations', label: 'Quotations & Proforma Invoices', desc: 'Official proposals, pricing, BOM line items and revisioning' },
      { name: 'Sales Orders', label: 'Sales Orders & Bookings', desc: 'Confirmed customer purchase orders and order processing' },
      { name: 'Product Catalog', label: 'Products & Price Book', desc: 'AV equipment catalog, specifications and selling rates' },
    ],
  },
  {
    category: 'PROCUREMENT & FULFILMENT',
    description: 'Vendor purchasing, inventory stocks, and material shipping',
    modules: [
      { name: 'Purchases', label: 'Purchase Orders & Vendor Buy', desc: 'Distributor POs, vendor purchase pricing and tracking' },
      { name: 'Inventory & Serials', label: 'Inventory & Serial Numbers', desc: 'Warehouse stock balances and serialized equipment tracking' },
      { name: 'Dispatch & Challans', label: 'Delivery Challans & Dispatch', desc: 'GST Rule 55 Delivery Challans and courier dispatches' },
    ],
  },
  {
    category: 'FINANCE & BILLING',
    description: 'Invoicing, receipts, Tally integration, and GST compliance',
    modules: [
      { name: 'Invoices & Billing', label: 'GST Tax Invoicing & Billing', desc: 'Commercial invoices, receivables aging and payment receipts' },
      { name: 'Payments', label: 'Collections & Bank Receipts', desc: 'Payment recording, reconciliation and credit tracking' },
    ],
  },
  {
    category: 'PROJECTS & SERVICE',
    description: 'Engineering deployment, installation sign-offs, and AMC',
    modules: [
      { name: 'Projects', label: 'Commercial AV Projects', desc: 'Installation project management and milestones' },
      { name: 'Installations', label: 'Engineering Installations', desc: 'Field engineer job cards and completion sign-offs' },
      { name: 'Demo Updates', label: 'Service & AMC Maintenance', desc: 'Annual maintenance contracts and equipment repairs' },
    ],
  },
  {
    category: 'HUMAN RESOURCES & ADMINISTRATION',
    description: 'Internal employee records, payroll, reports and access control',
    modules: [
      { name: 'HR & Employees', label: 'Employee Directory', desc: 'Staff directory and organization hierarchy' },
      { name: 'Attendance & Time', label: 'Attendance & Leave Tracking', desc: 'Daily check-in logs and leave approvals' },
      { name: 'Payroll & Compensation', label: 'Salary & Payroll (Confidential)', desc: 'Monthly payslips and salary compensation' },
      { name: 'Reports', label: 'Executive Analytics & Scheduled Reports', desc: 'Business intelligence and automated daily sales flashes' },
      { name: 'User Management', label: 'User Management & Access Control', desc: 'Employee login accounts and system permissions' },
      { name: 'System Settings', label: 'System Settings & Audit Logs', desc: 'Company details, Tally sync and audit logs' },
    ],
  },
];

export function ManageAccessModal({ user, isOpen, onClose, onSuccess }: ManageAccessModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [enabledModules, setEnabledModules] = useState<ERPModule[]>([]);
  const [commercialSettings, setCommercialSettings] = useState({
    canViewPurchaseCosts: false,
    canViewMargins: true,
    salesScope: 'OWN_ONLY' as 'OWN_ONLY' | 'ALL_COMPANY',
    canApproveDiscounts: false,
    canExportData: true,
  });
  const [justification, setJustification] = useState('');

  useEffect(() => {
    if (!isOpen || !user) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getUserAccessGovernance(user!.id);
        setEnabledModules(res.enabledModules);
        setCommercialSettings(res.commercialPermissions);
        setJustification('');
      } catch (err: any) {
        setError(err.message || 'Failed to load user permissions');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleToggleModule = (modName: ERPModule) => {
    setEnabledModules((prev) =>
      prev.includes(modName) ? prev.filter((m) => m !== modName) : [...prev, modName]
    );
  };

  const handleSelectAll = () => {
    setEnabledModules([...ALL_ERP_MODULES]);
  };

  const handleDeselectAll = () => {
    // Keep Dashboard by default
    setEnabledModules(['Dashboard']);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await saveUserAccessGovernance({
        userId: user.id,
        enabledModules,
        commercialPermissions: commercialSettings,
        reason: justification.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || 'Failed to save access settings');
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Access & Permission Governance
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Grant, restrict and configure what <strong>{user.name}</strong> ({user.email}) can see and do.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Loading user access configuration...</p>
            </div>
          ) : (
            <>
              {/* SECTION 1: Commercial & Financial Privacy Toggles */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Sensitive Financial & Commercial Visibility Toggles
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">
                    Fortune-500 Commercial Governance Rules
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Toggle 1: Vendor Purchase Cost */}
                  <label className="flex items-start gap-3 p-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={commercialSettings.canViewPurchaseCosts}
                      onChange={(e) =>
                        setCommercialSettings({ ...commercialSettings, canViewPurchaseCosts: e.target.checked })
                      }
                      className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block">
                        View Vendor Purchase Prices (COGS)
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {commercialSettings.canViewPurchaseCosts
                          ? 'Can see OEM equipment buy-rates and supplier PO costs.'
                          : 'Hidden: Purchase prices masked (₹ ••••••) for confidentiality.'}
                      </span>
                    </div>
                  </label>

                  {/* Toggle 2: Profit Margins */}
                  <label className="flex items-start gap-3 p-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={commercialSettings.canViewMargins}
                      onChange={(e) =>
                        setCommercialSettings({ ...commercialSettings, canViewMargins: e.target.checked })
                      }
                      className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block">
                        View Profit Margin % & Gross Profit
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Displays gross profit contribution (₹) and margin percentage on proposals.
                      </span>
                    </div>
                  </label>

                  {/* Toggle 3: Data Scope */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5 md:col-span-2">
                    <span className="text-xs font-bold text-slate-900 block">
                      Sales & Lead Data Scope
                    </span>
                    <div className="flex items-center gap-4 text-xs font-medium">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="salesScope"
                          value="OWN_ONLY"
                          checked={commercialSettings.salesScope === 'OWN_ONLY'}
                          onChange={() => setCommercialSettings({ ...commercialSettings, salesScope: 'OWN_ONLY' })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span>Own Assigned Records Only (Strict Privacy)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="salesScope"
                          value="ALL_COMPANY"
                          checked={commercialSettings.salesScope === 'ALL_COMPANY'}
                          onChange={() => setCommercialSettings({ ...commercialSettings, salesScope: 'ALL_COMPANY' })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span>Entire Company Records (Global Visibility)</span>
                      </label>
                    </div>
                  </div>

                  {/* Toggle 4: Approve Discounts */}
                  <label className="flex items-start gap-3 p-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={commercialSettings.canApproveDiscounts}
                      onChange={(e) =>
                        setCommercialSettings({ ...commercialSettings, canApproveDiscounts: e.target.checked })
                      }
                      className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block">
                        Special Discount Approval Authority
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Allows user to approve quotations exceeding standard discount limits.
                      </span>
                    </div>
                  </label>

                  {/* Toggle 5: Export Data */}
                  <label className="flex items-start gap-3 p-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={commercialSettings.canExportData}
                      onChange={(e) =>
                        setCommercialSettings({ ...commercialSettings, canExportData: e.target.checked })
                      }
                      className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block">
                        Export Data to CSV / Excel
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Allows downloading customer records, orders, or price books.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* SECTION 2: Module Access Checklist */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span>ERP Module Access Checklist ({enabledModules.length} Active)</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Unchecked modules will be automatically hidden from the user&apos;s sidebar and blocked from direct URL access.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="space-y-5">
                  {MODULE_CATEGORIES.map((cat) => (
                    <div key={cat.category} className="space-y-2">
                      <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 px-1">
                        {cat.category}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {cat.modules.map((m) => {
                          const isChecked = enabledModules.includes(m.name);
                          return (
                            <div
                              key={m.name}
                              onClick={() => handleToggleModule(m.name)}
                              className={`p-3 rounded-xl border text-left cursor-pointer transition select-none flex items-start gap-2.5 ${
                                isChecked
                                  ? 'bg-blue-50/50 border-blue-300 shadow-2xs'
                                  : 'bg-slate-50 border-slate-200 hover:border-slate-300 opacity-60'
                              }`}
                            >
                              <div className="mt-0.5 text-blue-600 shrink-0">
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className={`text-xs font-bold block ${isChecked ? 'text-slate-900' : 'text-slate-600'}`}>
                                  {m.label}
                                </span>
                                <span className="text-[10px] text-slate-500 block line-clamp-2 mt-0.5">
                                  {m.desc}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Justification input */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-700 block">
                  Admin Audit Justification (Optional)
                </label>
                <input
                  type="text"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="e.g. Promoted to Senior Sales / Granted quotation & order visibility"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 border border-slate-300 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Access...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Save & Apply Access</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
