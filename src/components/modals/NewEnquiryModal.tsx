'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Calendar,
  MapPin,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  User,
  Building2,
  FileText,
  Clock,
  ExternalLink,
  PlusCircle,
  FileSpreadsheet,
  Search,
  Check,
  Landmark,
} from 'lucide-react';
import { PRODUCT_CATEGORIES, STAFF_MEMBERS } from '@/lib/constants/erp-data';
import { createEnquiry } from '@/lib/actions/enquiries';
import { getCustomers } from '@/lib/actions/customers';
import { getCurrentSessionUser } from '@/lib/actions/users';
import type { Customer, CustomerType } from '@/types/customer';

interface NewEnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialCustomer?: {
    id?: string;
    name: string;
    company?: string;
    phone?: string;
    email?: string;
    customer_type?: CustomerType;
  };
}

interface CreatedEnquirySummary {
  enquiry_number: string;
  customer_name: string;
  customer_code?: string;
  company_name?: string;
  product_category: string;
  estimated_budget: number;
  follow_up_date?: string;
  is_new_customer?: boolean;
}

export function NewEnquiryModal({ isOpen, onClose, onSuccess, initialCustomer }: NewEnquiryModalProps) {
  const router = useRouter();

  const [customerMode, setCustomerMode] = useState<'SEARCH' | 'MANUAL'>('SEARCH');
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [formData, setFormData] = useState({
    customer_name: initialCustomer?.name || '',
    company_name: initialCustomer?.company || '',
    customer_type: (initialCustomer?.customer_type || 'COMPANY') as CustomerType,
    phone: initialCustomer?.phone || '',
    email: initialCustomer?.email || '',
    source: 'Direct',
    salesperson_name: 'Dheeraj',
    product_category: 'Projector',
    requirement_summary: '',
    estimated_budget: 50000,
    follow_up_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    site_visit_required: false,
    site_address: '',
    room_type: '',
    measurements: '',
    assigned_technician: 'Nagaraju',
    tender_reference: '',
    gem_order_number: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<CreatedEnquirySummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load existing customers and session user on open
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    getCurrentSessionUser().then((user) => {
      if (user && isMounted && user.name) {
        setFormData((prev) => ({
          ...prev,
          salesperson_name: user.name,
        }));
      }
    }).catch(console.error);

    getCustomers().then(res => {
      if (isMounted && res && res.customers) {
        setExistingCustomers(res.customers);
        if (initialCustomer?.id) {
          const matched = res.customers.find(c => c.id === initialCustomer.id);
          if (matched) {
            setSelectedCustomer(matched);
            setCustomerMode('SEARCH');
          }
        }
      }
    }).catch(console.error);
    return () => { isMounted = false; };
  }, [isOpen, initialCustomer]);

  const matchedCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return [];
    const q = customerSearchQuery.toLowerCase().trim();
    return existingCustomers.filter(c =>
      (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
      (c.customer_code && c.customer_code.toLowerCase().includes(q)) ||
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [customerSearchQuery, existingCustomers]);

  const handleSelectExistingCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setFormData(prev => ({
      ...prev,
      customer_name: c.customer_name,
      company_name: c.company_name || '',
      customer_type: c.customer_type,
      phone: c.phone,
      email: c.email || '',
      site_address: c.billing_address || (c.city ? `${c.city}, ${c.state}` : ''),
    }));
    setCustomerSearchQuery('');
  };

  const handleClearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setFormData(prev => ({
      ...prev,
      customer_name: '',
      company_name: '',
      customer_type: 'COMPANY',
      phone: '',
      email: '',
      site_address: '',
    }));
  };

  if (!isOpen) return null;

  const handleResetForm = () => {
    setSelectedCustomer(null);
    setCustomerSearchQuery('');
    setCustomerMode('SEARCH');
    setFormData({
      customer_name: '',
      company_name: '',
      customer_type: 'COMPANY',
      phone: '',
      email: '',
      source: 'Direct',
      salesperson_name: 'Dheeraj',
      product_category: 'Projector',
      requirement_summary: '',
      estimated_budget: 50000,
      follow_up_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      site_visit_required: false,
      site_address: '',
      room_type: '',
      measurements: '',
      assigned_technician: 'Nagaraju',
      tender_reference: '',
      gem_order_number: '',
    });
    setCreatedSummary(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    if (createdSummary && onSuccess) {
      onSuccess();
    }
    handleResetForm();
    onClose();
  };

  const handleSubmit = async (e?: React.FormEvent, nextAction: 'SAVE' | 'SITE_VISIT' | 'QUOTE' = 'SAVE') => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const requiresSiteVisit = nextAction === 'SITE_VISIT' ? true : formData.site_visit_required;

    try {
      const res = await createEnquiry({
        customer_id: selectedCustomer ? selectedCustomer.id : 'CUST-NEW',
        customer_name: formData.customer_name.trim(),
        company_name: formData.company_name.trim() || undefined,
        customer_type: formData.customer_type,
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        source: formData.source,
        salesperson_name: formData.salesperson_name,
        product_category: formData.product_category,
        requirement_summary: formData.requirement_summary.trim(),
        estimated_budget: Number(formData.estimated_budget) || 0,
        status: 'Enquiry',
        follow_up_date: formData.follow_up_date,
        site_visit_required: requiresSiteVisit,
      });

      if (res.success && res.data) {
        if (onSuccess) onSuccess();

        if (nextAction === 'QUOTE') {
          handleClose();
          router.push(`/dashboard/quotations?enquiry_id=${res.data.id}&customer_id=${res.data.customer_id || ''}`);
          return;
        }

        if (nextAction === 'SITE_VISIT') {
          handleClose();
          router.push(`/dashboard/site-visits?enquiry_id=${res.data.id}&customer_name=${encodeURIComponent(formData.customer_name)}`);
          return;
        }

        setCreatedSummary({
          enquiry_number: res.data.enquiry_number,
          customer_name: res.data.customer_name,
          customer_code: res.customer_code,
          company_name: res.data.company_name,
          product_category: res.data.product_category,
          estimated_budget: res.data.estimated_budget,
          follow_up_date: res.data.follow_up_date,
          is_new_customer: res.is_new_customer,
        });
      } else {
        setErrorMessage(res.error || 'Failed to create enquiry. Please review required fields.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while saving enquiry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col my-auto overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/75">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {createdSummary ? 'Enquiry Successfully Registered' : 'Log New Enquiry / Lead'}
              </h2>
              <p className="text-xs text-slate-500">
                {createdSummary
                  ? 'Official presales enquiry created in the CRM pipeline'
                  : 'Capture customer requirements, auto-link or create customer, and schedule follow-up'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Success State vs Form State */}
        {createdSummary ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Success Hero Banner */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-emerald-950">
                  Enquiry {createdSummary.enquiry_number} Created Successfully
                </h3>
                <p className="text-xs text-emerald-800">
                  {createdSummary.is_new_customer
                    ? `New customer record auto-created and linked with Customer Code: ${createdSummary.customer_code || 'Assigned'}.`
                    : `Linked to existing customer dossier (${createdSummary.customer_code || 'Matched'}).`}
                </p>
              </div>
            </div>

            {/* Quick Summary Card */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Enquiry Number</span>
                <span className="font-mono font-bold text-brand-700 text-sm">{createdSummary.enquiry_number}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Customer / Account</span>
                <span className="font-bold text-slate-800 truncate block">
                  {createdSummary.company_name || createdSummary.customer_name}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Product Category</span>
                <span className="font-bold text-slate-800">{createdSummary.product_category}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Estimated Budget</span>
                <span className="font-black text-slate-900">₹{createdSummary.estimated_budget.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Target Follow-up</span>
                <span className="font-semibold text-slate-800">{createdSummary.follow_up_date || 'Within 48 Hours'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Pipeline Status</span>
                <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                  Active Presales
                </span>
              </div>
            </div>

            {/* Action Buttons Matrix */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Next Action Steps</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    router.push('/dashboard/enquiries');
                  }}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50/40 text-left transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-brand-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-brand-700">View In Enquiries</p>
                      <p className="text-[11px] text-slate-500">Track stage, presales notes & requirements</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    router.push('/dashboard/quotations');
                  }}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-left transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">Create Quotation</p>
                      <p className="text-[11px] text-slate-500">Build GST commercial proposal</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    router.push('/dashboard/follow-ups');
                  }}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 text-left transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-amber-700">Follow-up Schedule</p>
                      <p className="text-[11px] text-slate-500">View in presales follow-up queue</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    router.push('/dashboard/site-visits');
                  }}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 text-left transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-purple-700">Schedule Site Visit</p>
                      <p className="text-[11px] text-slate-500">Book measurement & technical survey</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Existing Customer Auto-Suggest Search or Linked Customer Badge */}
              {selectedCustomer ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          {selectedCustomer.customer_code}
                        </span>
                        <strong className="text-xs font-bold text-emerald-950">
                          {selectedCustomer.company_name || selectedCustomer.customer_name}
                        </strong>
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Contact: {selectedCustomer.contact_person || selectedCustomer.customer_name} &bull; {selectedCustomer.phone}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSelectedCustomer}
                    className="px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                  >
                    Change Customer
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-brand-600" />
                      <span>Search Registered Customer (Autofill)</span>
                    </label>
                    <span className="text-[11px] text-slate-400">Matches ID, Name, Company, Phone</span>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      placeholder="Type Customer ID (e.g. ICON260001), Company Name, or Phone..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                    {matchedCustomers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {matchedCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectExistingCustomer(c)}
                            className="w-full p-2.5 text-left hover:bg-brand-50/50 flex items-center justify-between transition group cursor-pointer"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {c.customer_code}
                                </span>
                                <strong className="text-xs font-bold text-slate-900 group-hover:text-brand-600">
                                  {c.company_name || c.customer_name}
                                </strong>
                              </div>
                              <span className="text-[11px] text-slate-500 block mt-0.5">
                                {c.contact_person ? `${c.contact_person} • ` : ''}{c.phone} {c.email ? `• ${c.email}` : ''}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-brand-600 group-hover:underline">Autofill &rarr;</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer / Contact Person *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="e.g. Swan Solutions & Services"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Classification</label>
                  <select
                    value={formData.customer_type}
                    onChange={(e) => setFormData({ ...formData, customer_type: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    <option value="COMPANY">Corporate / B2B Company</option>
                    <option value="INDIVIDUAL">Individual / Residential Project</option>
                    <option value="GOVERNMENT">Government / GeM / PSU Tender</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98490 12345"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@example.com"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              {/* Tender / GeM Compliance Fields for Government Accounts */}
              {formData.customer_type === 'GOVERNMENT' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 animate-in fade-in-50">
                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      GeM Portal / Tender Reference
                    </label>
                    <input
                      type="text"
                      value={formData.tender_reference}
                      onChange={(e) => setFormData({ ...formData, tender_reference: e.target.value })}
                      placeholder="e.g. GEM/2026/B/901248"
                      className="w-full px-3 py-2 text-xs bg-white border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      Department Bid Order Ref
                    </label>
                    <input
                      type="text"
                      value={formData.gem_order_number}
                      onChange={(e) => setFormData({ ...formData, gem_order_number: e.target.value })}
                      placeholder="e.g. TS-SECD-AV-PO-09"
                      className="w-full px-3 py-2 text-xs bg-white border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Enquiry Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    <option value="Direct">Direct Walk-in</option>
                    <option value="Website">Website Form</option>
                    <option value="Reference">Reference / Referral</option>
                    <option value="Phone">Inbound Phone Call</option>
                    <option value="Existing Customer">Existing Customer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Salesperson</label>
                  <select
                    value={formData.salesperson_name}
                    onChange={(e) => setFormData({ ...formData, salesperson_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    {STAFF_MEMBERS.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Category *</label>
                  <select
                    value={formData.product_category}
                    onChange={(e) => setFormData({ ...formData, product_category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Requirement Summary & Scope *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.requirement_summary}
                  onChange={(e) => setFormData({ ...formData, requirement_summary: e.target.value })}
                  placeholder="e.g. 75 inch 4K Interactive display panel for training room with wall mount, HDMI cabling, and stylus pens."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimated Budget (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.estimated_budget}
                    onChange={(e) => setFormData({ ...formData, estimated_budget: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Follow-up Target Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.follow_up_date}
                      onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Site Visit Switch */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-brand-600" />
                    <span className="text-xs font-bold text-slate-800">
                      On-Site Measurement & Survey Required?
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.site_visit_required}
                    onChange={(e) => setFormData({ ...formData, site_visit_required: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                  />
                </div>

                {formData.site_visit_required && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Site Address</label>
                      <input
                        type="text"
                        value={formData.site_address}
                        onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                        placeholder="e.g. Jubilee Hills Road 36, Hyderabad"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Room / Location Type</label>
                      <input
                        type="text"
                        value={formData.room_type}
                        onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                        placeholder="e.g. Boardroom / Home Cinema Room"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Action Bar */}
            <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-200 bg-slate-50/80">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(undefined, 'SAVE')}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                  title="Save lead in presales CRM pipeline"
                >
                  Save Lead
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(undefined, 'SITE_VISIT')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                  title="Save enquiry and immediately schedule site survey"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-700" />
                  <span>Save + Site Visit</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(undefined, 'QUOTE')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md shadow-brand-500/20 transition disabled:opacity-50 cursor-pointer"
                  title="Save enquiry and immediately build commercial quotation"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Save + Quote</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Footer for Success View */}
        {createdSummary && (
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50/80">
            <button
              type="button"
              onClick={handleResetForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Log Another Enquiry</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition shadow-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
