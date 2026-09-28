'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CreditCard,
  ShieldCheck,
  MapPin,
  Phone,
  Mail,
  Globe,
  User,
  Clock,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';
import { getCompanySettings, updateCompanySettings } from '@/lib/actions/company-settings';
import type { CompanySettings } from '@/types/company-settings';

export default function CompanySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [formData, setFormData] = useState<CompanySettings | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getCompanySettings();
        setFormData(data);
      } catch (err: any) {
        setNotification({
          type: 'error',
          message: err?.message || 'Failed to load company settings',
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
      const res = await updateCompanySettings({
        legal_name: formData.legal_name,
        trade_name: formData.trade_name,
        gstin: formData.gstin,
        pan: formData.pan,
        msme_number: formData.msme_number,
        cin_number: formData.cin_number,
        gst_state: formData.gst_state,
        registered_address: formData.registered_address,
        office_address: formData.office_address,
        phone: formData.phone,
        email: formData.email,
        website: formData.website,
        authorized_signatory: formData.authorized_signatory,
        commercial_defaults: formData.commercial_defaults,
        bank_details: formData.bank_details,
      });

      if (res.success && res.data) {
        setFormData(res.data);
        setNotification({
          type: 'success',
          message: 'Company settings, commercial defaults, and bank details successfully updated and audited.',
        });
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to update company settings.',
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
          Loading company and commercial configuration...
        </div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <SettingsNav />
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-rose-500">
          Failed to load company settings. Please refresh or verify permissions.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Company &amp; Commercial Settings
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
              ORG-ICON-01
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centralized profile for legal identity, GSTIN, banking, commercial terms, and print standards
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
        {/* SECTION 1: LEGAL & TRADE IDENTITY */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Legal Identity &amp; Tax Registrations</h2>
              <p className="text-[11px] text-slate-400">Master entity identifiers printed on Tax Invoices and Quotations</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Legal Company Name *</label>
              <input
                type="text"
                required
                value={formData.legal_name}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Trade / Display Name *</label>
              <input
                type="text"
                required
                value={formData.trade_name}
                onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">GSTIN (15 Digits) *</label>
              <input
                type="text"
                required
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">PAN (10 Digits) *</label>
              <input
                type="text"
                required
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">MSME / Udyam Number</label>
              <input
                type="text"
                value={formData.msme_number || ''}
                onChange={(e) => setFormData({ ...formData, msme_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-brand-500/20 outline-none"
                placeholder="UDYAM-TS-02-0012345"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">CIN / Registration No</label>
              <input
                type="text"
                value={formData.cin_number || ''}
                onChange={(e) => setFormData({ ...formData, cin_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-brand-500/20 outline-none"
                placeholder="U72900TG2026PTC123456"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">GST Registration State *</label>
              <input
                type="text"
                required
                value={formData.gst_state}
                onChange={(e) => setFormData({ ...formData, gst_state: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Authorized Signatory *</label>
              <input
                type="text"
                required
                value={formData.authorized_signatory}
                onChange={(e) => setFormData({ ...formData, authorized_signatory: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: ADDRESSES & CONTACT DETAILS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Registered Address &amp; Communication Channels</h2>
              <p className="text-[11px] text-slate-400">Headquarters location and official customer support contact points</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Registered Address (Official GST Place of Business) *</label>
              <textarea
                rows={2}
                required
                value={formData.registered_address}
                onChange={(e) => setFormData({ ...formData, registered_address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Corporate / Operations Office Address *</label>
              <textarea
                rows={2}
                required
                value={formData.office_address}
                onChange={(e) => setFormData({ ...formData, office_address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Official Support Phone *</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Official Corporate Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Website URL *</label>
              <input
                type="text"
                required
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: BANK DETAILS FOR PAYMENT COLLECTION */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Official Bank Accounts (NEFT / RTGS / UPI)</h2>
              <p className="text-[11px] text-slate-400">Printed on customer quotations and invoices for remittance</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Bank Name *</label>
              <input
                type="text"
                required
                value={formData.bank_details.bank_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bank_details: { ...formData.bank_details, bank_name: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Account Beneficiary Name *</label>
              <input
                type="text"
                required
                value={formData.bank_details.account_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bank_details: { ...formData.bank_details, account_name: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Account Number *</label>
              <input
                type="text"
                required
                value={formData.bank_details.account_number}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bank_details: { ...formData.bank_details, account_number: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">IFSC Code *</label>
              <input
                type="text"
                required
                value={formData.bank_details.ifsc_code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bank_details: { ...formData.bank_details, ifsc_code: e.target.value.toUpperCase() },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Branch Location *</label>
              <input
                type="text"
                required
                value={formData.bank_details.branch}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bank_details: { ...formData.bank_details, branch: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Official UPI ID / VPA</label>
              <input
                type="text"
                value={formData.bank_details.upi_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bank_details: { ...formData.bank_details, upi_id: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-brand-500/20 outline-none"
                placeholder="icontechpro@idbi"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: COMMERCIAL DEFAULTS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Standard Commercial Defaults</h2>
              <p className="text-[11px] text-slate-400">Pre-populated terms &amp; conditions on newly drafted quotations and orders</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Default GST Rate (%) *</label>
              <input
                type="number"
                min={0}
                max={28}
                required
                value={formData.commercial_defaults.default_gst_rate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    commercial_defaults: {
                      ...formData.commercial_defaults,
                      default_gst_rate: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Quotation Validity Period (Days) *</label>
              <input
                type="number"
                min={1}
                max={90}
                required
                value={formData.commercial_defaults.quotation_validity_days}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    commercial_defaults: {
                      ...formData.commercial_defaults,
                      quotation_validity_days: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-slate-700 font-semibold mb-1">Standard Payment Terms *</label>
              <input
                type="text"
                required
                value={formData.commercial_defaults.payment_terms}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    commercial_defaults: {
                      ...formData.commercial_defaults,
                      payment_terms: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Standard Warranty Terms *</label>
              <textarea
                rows={2}
                required
                value={formData.commercial_defaults.warranty_terms}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    commercial_defaults: {
                      ...formData.commercial_defaults,
                      warranty_terms: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Delivery &amp; Freight Terms *</label>
              <textarea
                rows={2}
                required
                value={formData.commercial_defaults.delivery_terms}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    commercial_defaults: {
                      ...formData.commercial_defaults,
                      delivery_terms: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* SAVE ACTION BAR */}
        <div className="flex items-center justify-between p-4 bg-slate-900 rounded-2xl text-white shadow-lg">
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs">
              Changes will be recorded with your administrator identity in the audit trail.
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Saving Configuration...' : 'Save Company Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
