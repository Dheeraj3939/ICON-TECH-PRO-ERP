'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileCheck2,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Printer,
  ShieldCheck,
  Hash,
  ArrowLeft,
  Info,
  Lock,
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';
import { getDocumentSettings, updateDocumentSettings } from '@/lib/actions/document-settings';
import type { DocumentSettings } from '@/types/company-settings';

export default function DocumentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [formData, setFormData] = useState<DocumentSettings | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getDocumentSettings();
        setFormData(data);
      } catch (err: any) {
        setNotification({
          type: 'error',
          message: err?.message || 'Failed to load document settings',
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    setSubmitting(true);
    setNotification(null);

    try {
      const res = await updateDocumentSettings({
        prefixes: formData.prefixes,
        standard_terms: formData.standard_terms,
        print_settings: formData.print_settings,
      });

      if (res.success && res.data) {
        setFormData(res.data);
        setNotification({
          type: 'success',
          message: 'Document prefixes, print settings, and standard terms updated successfully.',
        });
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to update document settings.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'An unexpected error occurred.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <SettingsNav />
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
          Loading document numbering and print configuration...
        </div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <SettingsNav />
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-rose-500">
          Failed to load document settings. Please refresh or check authorization.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Document Settings &amp; Numbering
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold">
              FY 2026-2027 Standards
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure transaction sequence prefixes, standard terms &amp; conditions, and GST Rule 46 print options
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/settings"
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Settings Overview</span>
          </Link>
        </div>
      </div>

      <SettingsNav />

      {/* Safety Notice Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs flex items-start gap-3">
        <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-bold text-amber-900 block">Sequence &amp; Historical Immutability Guardrail</strong>
          <p className="text-[11px] text-amber-800">
            Updating document prefixes affects <strong>only future generated records</strong>. All historical quotations, sales orders, tax invoices, delivery challans, and service tickets retain their exact issued document numbers without collision. Sequence counters remain monotonic and protected.
          </p>
        </div>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* SECTION 1: PREFIX NUMBERING */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Document Numbering Prefixes</h2>
              <p className="text-[11px] text-slate-400">
                Formula: [Entity]/[Financial Year]/[Prefix][0001] — e.g. ICON/26-27/QT-0001
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Quotation Prefix *</label>
              <input
                type="text"
                required
                value={formData.prefixes.quotation}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    prefixes: { ...formData.prefixes, quotation: e.target.value.toUpperCase() },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Example: ICON/26-27/{formData.prefixes.quotation}0001</span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Sales Order Prefix *</label>
              <input
                type="text"
                required
                value={formData.prefixes.sales_order}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    prefixes: { ...formData.prefixes, sales_order: e.target.value.toUpperCase() },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Example: ICON/26-27/{formData.prefixes.sales_order}0001</span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Tax Invoice Prefix *</label>
              <input
                type="text"
                required
                value={formData.prefixes.invoice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    prefixes: { ...formData.prefixes, invoice: e.target.value.toUpperCase() },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Example: ICON/26-27/{formData.prefixes.invoice}0001</span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Delivery Challan Prefix *</label>
              <input
                type="text"
                required
                value={formData.prefixes.delivery_challan}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    prefixes: { ...formData.prefixes, delivery_challan: e.target.value.toUpperCase() },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Example: ICON/26-27/{formData.prefixes.delivery_challan}0001</span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Purchase Order Prefix *</label>
              <input
                type="text"
                required
                value={formData.prefixes.purchase_order}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    prefixes: { ...formData.prefixes, purchase_order: e.target.value.toUpperCase() },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Example: ICON/26-27/{formData.prefixes.purchase_order}0001</span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Enquiry Prefix *</label>
              <input
                type="text"
                required
                value={formData.prefixes.enquiry}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    prefixes: { ...formData.prefixes, enquiry: e.target.value.toUpperCase() },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Example: ICON/26-27/{formData.prefixes.enquiry}0001</span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Service Ticket Prefix *</label>
              <input
                type="text"
                required
                value={formData.prefixes.service}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    prefixes: { ...formData.prefixes, service: e.target.value.toUpperCase() },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Example: ICON/26-27/{formData.prefixes.service}0001</span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Customer Code Prefix *</label>
              <input
                type="text"
                required
                value={formData.prefixes.customer}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    prefixes: { ...formData.prefixes, customer: e.target.value.toUpperCase() },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Example: {formData.prefixes.customer}260001</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: STANDARDIZED TERMS & CONDITIONS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Standard Terms &amp; Conditions</h2>
              <p className="text-[11px] text-slate-400">Default clauses inserted onto official Quotation &amp; Invoice printouts</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Quotation Terms &amp; Conditions *</label>
              <textarea
                rows={4}
                required
                value={formData.standard_terms.quotation_terms}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    standard_terms: { ...formData.standard_terms, quotation_terms: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Tax Invoice Terms &amp; Conditions *</label>
              <textarea
                rows={4}
                required
                value={formData.standard_terms.invoice_terms}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    standard_terms: { ...formData.standard_terms, invoice_terms: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Standard Payment Remittance Instructions *</label>
              <textarea
                rows={2}
                required
                value={formData.standard_terms.payment_instructions}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    standard_terms: { ...formData.standard_terms, payment_instructions: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: PRINT & BRANDING CONTROLS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Print Layout &amp; Header/Footer Toggles</h2>
              <p className="text-[11px] text-slate-400">Control visual elements rendered on physical and PDF printouts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={formData.print_settings.show_header_logo}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    print_settings: {
                      ...formData.print_settings,
                      show_header_logo: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <div>
                <span className="font-semibold text-slate-900 block">Print Brand Header Logo</span>
                <span className="text-[10px] text-slate-500">Include official logo on page 1 header</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={formData.print_settings.show_bank_details}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    print_settings: {
                      ...formData.print_settings,
                      show_bank_details: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <div>
                <span className="font-semibold text-slate-900 block">Print Bank Account Table</span>
                <span className="text-[10px] text-slate-500">Include NEFT/RTGS details in footer</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={formData.print_settings.show_authorized_stamp}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    print_settings: {
                      ...formData.print_settings,
                      show_authorized_stamp: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <div>
                <span className="font-semibold text-slate-900 block">Authorized Signatory Box</span>
                <span className="text-[10px] text-slate-500">Print official signature and seal section</span>
              </div>
            </label>

            <div className="sm:col-span-3">
              <label className="block text-slate-700 font-semibold mb-1">Standard Document Footer Disclaimer</label>
              <input
                type="text"
                value={formData.print_settings.footer_disclaimer}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    print_settings: {
                      ...formData.print_settings,
                      footer_disclaimer: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>
          </div>
        </div>

        {/* SAVE ACTION BAR */}
        <div className="flex items-center justify-between p-4 bg-slate-900 rounded-2xl text-white shadow-lg">
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs">
              Sequence safety guaranteed. Changes will be audited under your administrator account.
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Saving Document Settings...' : 'Save Document Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
