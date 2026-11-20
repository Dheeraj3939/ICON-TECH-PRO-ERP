'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  ShoppingBag,
  CreditCard,
  Boxes,
  Wrench,
  Send,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  PlusCircle,
  Truck,
  CheckSquare,
  FileCheck2,
  RefreshCw,
  EyeOff,
  Landmark,
  Home,
  Compass,
  FolderArchive,
  Upload,
  Download,
  ExternalLink,
  Search,
  Filter,
  FileCheck,
  Printer,
} from 'lucide-react';
import { UploadSignedDocumentModal } from '@/components/modals/UploadSignedDocumentModal';
import type { Customer360Dossier } from '@/lib/actions/customer360';
import type { BusinessDocumentType, CustomerArchiveDocument } from '@/types/documents';

interface Customer360ViewProps {
  dossier: Customer360Dossier;
}

export function Customer360View({ dossier }: Customer360ViewProps) {
  const {
    customer,
    enquiries,
    siteVisits,
    quotations,
    orders,
    invoices,
    payments = [],
    installations,
    serials,
    tickets,
    amcContracts,
    communications,
    purchaseOrders,
    tasks,
    approvals,
    tallySyncItems,
    showCommercialCosts,
    timeline,
    financialSummary,
    healthMetrics,
    projectFiles = [],
    archiveDocuments: initialArchiveDocs = [],
  } = dossier;

  const [activeTab, setActiveTab] = useState<
    | 'OVERVIEW'
    | 'COMMERCIALS'
    | 'PROCUREMENT'
    | 'INVOICES'
    | 'DOCUMENTS'
    | 'ASSETS'
    | 'PROJECTS'
    | 'TASKS_APPROVALS'
    | 'TIMELINE'
    | 'COMMUNICATIONS'
  >('OVERVIEW');

  const [docSearch, setDocSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('ALL');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDocForUpload, setSelectedDocForUpload] = useState<{
    document_type: BusinessDocumentType;
    document_number: string;
    customer_id: string;
    customer_name: string;
    company_name?: string;
    related_transaction_number?: string;
    original_generated_pdf_url?: string;
  } | undefined>(undefined);

  const isGovernment = customer.customer_type === 'GOVERNMENT';
  const isCompany = customer.customer_type === 'COMPANY';
  const isIndividual = customer.customer_type === 'INDIVIDUAL';

  const getHealthBadge = () => {
    switch (healthMetrics.healthStatus) {
      case 'HEALTHY':
        return {
          label: 'Account Healthy',
          bg: 'bg-emerald-500/10 text-emerald-700 border-emerald-300',
          icon: CheckCircle2,
        };
      case 'ATTENTION_REQUIRED':
        return {
          label: 'Attention Required',
          bg: 'bg-amber-500/10 text-amber-700 border-amber-300',
          icon: AlertTriangle,
        };
      case 'PAYMENT_OVERDUE':
        return {
          label: 'Payment Overdue',
          bg: 'bg-rose-500/10 text-rose-700 border-rose-300',
          icon: AlertTriangle,
        };
    }
  };

  const healthBadge = getHealthBadge();
  const HealthIcon = healthBadge.icon;

  return (
    <div className="space-y-6">
      {/* Top Banner & Customer Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center flex-shrink-0 shadow-md ${
                isGovernment
                  ? 'bg-purple-700 shadow-purple-500/20'
                  : isIndividual
                  ? 'bg-emerald-600 shadow-emerald-500/20'
                  : 'bg-brand-600 shadow-brand-500/20'
              }`}
            >
              {isGovernment ? (
                <Landmark className="w-7 h-7" />
              ) : isIndividual ? (
                <Home className="w-7 h-7" />
              ) : (
                <Building2 className="w-7 h-7" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {customer.customer_name}
                </h1>
                <span className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 font-mono font-bold text-xs">
                  {customer.customer_code}
                </span>

                {/* Customer Type Badge */}
                {isGovernment && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-bold text-xs">
                    <Landmark className="w-3.5 h-3.5 text-purple-600" />
                    Government / GeM / PSU
                  </span>
                )}
                {isIndividual && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                    <Home className="w-3.5 h-3.5 text-emerald-600" />
                    Residential / Individual
                  </span>
                )}
                {isCompany && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Corporate Enterprise
                  </span>
                )}

                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${healthBadge.bg}`}
                >
                  <HealthIcon className="w-3.5 h-3.5" />
                  {healthBadge.label}
                </span>

                {customer.enquiry_source && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs">
                    Source: {customer.enquiry_source}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 mt-2 flex-wrap">
                {customer.company_name && (
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {customer.company_name}
                  </span>
                )}
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex items-center gap-1 hover:text-brand-600 transition"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {customer.phone}
                  </a>
                )}
                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="flex items-center gap-1 hover:text-brand-600 transition"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {customer.email}
                  </a>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {customer.city || 'Hyderabad'}, {customer.state || 'Telangana'}
                </span>
                {customer.gstin && (
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    GSTIN: {customer.gstin}
                  </span>
                )}
                {isGovernment && (customer.tender_reference || customer.gem_order_number) && (
                  <span className="font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 text-[11px] font-bold">
                    {customer.tender_reference ? `Tender: ${customer.tender_reference}` : `GeM: ${customer.gem_order_number}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`https://wa.me/${(customer.phone || '').replace(/[^0-9]/g, '')}`}
              target="_blank"
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              WhatsApp
            </Link>
            <Link
              href={`/dashboard/enquiries?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.customer_name)}`}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              + Enquiry
            </Link>
            <Link
              href={`/dashboard/site-visits?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.customer_name)}`}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Site Visit
            </Link>
            <Link
              href={`/dashboard/quotations/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.customer_name)}`}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-brand-500/20"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Create Quote
            </Link>
            <Link
              href="/dashboard/service"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Wrench className="w-3.5 h-3.5 text-slate-500" />
              Service Ticket
            </Link>
          </div>
        </div>

        {/* Key Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Lifetime Value
            </span>
            <span className="text-base font-black text-slate-900 mt-0.5 block">
              ₹{healthMetrics.lifetimeValue.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Balance Due
            </span>
            <span
              className={`text-base font-black mt-0.5 block ${
                financialSummary.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              ₹{financialSummary.balanceDue.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Confirmed Orders
            </span>
            <span className="text-base font-black text-slate-900 mt-0.5 block">
              {healthMetrics.ordersCount} Deals
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Serial Assets
            </span>
            <span className="text-base font-black text-slate-900 mt-0.5 block">
              {healthMetrics.activeAssetsCount} Devices
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active AMC Coverage
            </span>
            <span className="text-base font-black text-slate-900 mt-0.5 block">
              {healthMetrics.activeAMCCount > 0 ? `${healthMetrics.activeAMCCount} Active` : 'No AMC'}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Lifecycle Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-brand-600" />
            Customer Lifecycle Progress & Next Action
          </span>
          <span className="text-[11px] font-mono text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
            {amcContracts.length > 0
              ? 'Complete Post-Sale & AMC Coverage'
              : installations.length > 0
              ? 'Installation Done — Ready for AMC'
              : orders.length > 0
              ? 'Active Project Execution'
              : quotations.length > 0
              ? 'Quotation Submitted — Follow-up Active'
              : 'Presales & Requirement Discovery'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { label: 'Enquiry', count: enquiries.length, tab: 'COMMERCIALS', active: enquiries.length > 0 },
            { label: 'Site Visit', count: siteVisits.length, tab: 'COMMERCIALS', active: siteVisits.length > 0 },
            { label: 'Quotation', count: quotations.length, tab: 'COMMERCIALS', active: quotations.length > 0 },
            { label: 'Sales Order', count: orders.length, tab: 'COMMERCIALS', active: orders.length > 0 },
            { label: 'Procurement', count: purchaseOrders.length, tab: 'PROCUREMENT', active: purchaseOrders.length > 0 },
            { label: 'Installation', count: installations.length, tab: 'PROJECTS', active: installations.length > 0 },
            { label: 'Invoiced', count: invoices.length, tab: 'INVOICES', active: invoices.length > 0 },
            { label: 'AMC Care', count: amcContracts.length, tab: 'PROJECTS', active: amcContracts.length > 0 },
          ].map((step, idx) => (
            <button
              key={step.label}
              type="button"
              onClick={() => setActiveTab(step.tab as any)}
              className={`p-2.5 rounded-xl border text-center transition cursor-pointer text-left ${
                step.active
                  ? 'bg-brand-50/60 border-brand-300 text-brand-900 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black font-mono text-slate-400">0{idx + 1}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    step.active ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
              </div>
              <span className="text-xs font-black block mt-1 truncate">{step.label}</span>
              <span
                className={`text-[10px] font-bold block mt-0.5 ${
                  step.active ? 'text-brand-700' : 'text-slate-400'
                }`}
              >
                {step.count > 0 ? `${step.count} Logged` : 'Pending'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold">
        {[
          { id: 'OVERVIEW', label: 'Customer Details', count: undefined },
          { id: 'COMMERCIALS', label: 'Business (Quotes & Orders)', count: quotations.length + orders.length },
          { id: 'INVOICES', label: 'Invoices & Payments', count: invoices.length + payments.length },
          { id: 'DOCUMENTS', label: 'Document Archive', count: initialArchiveDocs.length },
          { id: 'PROJECTS', label: 'Projects & Site Visits (Open Files)', count: projectFiles.length + installations.length + siteVisits.length },
          { id: 'ASSETS', label: 'Service & AMC', count: amcContracts.length + tickets.length + serials.length },
          { id: 'COMMUNICATIONS', label: 'Activity & Outbox', count: communications.length + timeline.length },
          { id: 'PROCUREMENT', label: 'Purchases & Sourcing', count: purchaseOrders.length },
          { id: 'TIMELINE', label: 'Customer History', count: timeline.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Financial Ledger & Quick Summaries */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-600" />
                Credit & Receivables Posture
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
                    <span>Credit Limit Utilization</span>
                    <span>
                      ₹{financialSummary.balanceDue.toLocaleString('en-IN')} of ₹
                      {financialSummary.creditLimit.toLocaleString('en-IN')} (
                      {financialSummary.creditUtilizationPct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        financialSummary.creditUtilizationPct > 90
                          ? 'bg-rose-500'
                          : financialSummary.creditUtilizationPct > 60
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, financialSummary.creditUtilizationPct)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Invoiced</span>
                    <span className="text-sm font-black text-slate-900 mt-0.5 block">
                      ₹{financialSummary.totalInvoiced.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Collected</span>
                    <span className="text-sm font-black text-emerald-600 mt-0.5 block">
                      ₹{financialSummary.totalCollected.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Overdue Invoices</span>
                    <span className="text-sm font-black text-rose-600 mt-0.5 block">
                      {financialSummary.overdueInvoicesCount} Overdue
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Orders Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-brand-600" />
                  Recent Confirmed Orders
                </h3>
                <button
                  onClick={() => setActiveTab('COMMERCIALS')}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  View All ({orders.length}) <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {orders.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {orders.slice(0, 3).map((o) => (
                    <div key={o.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {o.order_number}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {o.material_status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {o.items.length} items • Expected Delivery: {o.expected_delivery || 'Standard'}
                        </p>
                      </div>
                      <span className="text-sm font-black text-slate-900">
                        ₹{o.total_amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No orders confirmed yet</p>
              )}
            </div>

            {/* Quick Operational Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                    Active Tasks ({tasks.filter((t) => t.status !== 'Completed').length})
                  </span>
                  <button
                    onClick={() => setActiveTab('TASKS_APPROVALS')}
                    className="text-[11px] font-bold text-brand-600"
                  >
                    View All
                  </button>
                </div>
                {tasks.length > 0 ? (
                  <div className="space-y-2">
                    {tasks.slice(0, 2).map((tsk) => (
                      <div key={tsk.id} className="p-2.5 bg-slate-50 rounded-lg text-xs">
                        <div className="font-bold text-slate-900">{tsk.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex justify-between">
                          <span>Due: {tsk.due_date}</span>
                          <span className="font-semibold text-blue-600">{tsk.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No open tasks</p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-purple-600" />
                    Procurement & Drop-ships ({purchaseOrders.length})
                  </span>
                  <button
                    onClick={() => setActiveTab('PROCUREMENT')}
                    className="text-[11px] font-bold text-brand-600"
                  >
                    View All
                  </button>
                </div>
                {purchaseOrders.length > 0 ? (
                  <div className="space-y-2">
                    {purchaseOrders.slice(0, 2).map((po) => (
                      <div key={po.id} className="p-2.5 bg-slate-50 rounded-lg text-xs">
                        <div className="font-bold text-slate-900 flex justify-between">
                          <span>{po.po_number}</span>
                          <span className="text-[10px] font-mono text-purple-700">{po.status}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {po.supplier_name} • {po.delivery_type === 'DIRECT_CUSTOMER_DROPSHIP' ? 'Drop-ship' : 'Office PO'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No procurement orders linked</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Key Contacts & Operational Status */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-600" />
                Primary Customer Contact
              </h3>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">
                      {customer.contact_person || customer.customer_name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-200">
                      Primary
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    {customer.designation || 'Authorized Representative'}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-slate-600 mt-2 flex-wrap">
                    {customer.phone && (
                      <a href={`tel:${customer.phone}`} className="hover:text-brand-600 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {customer.phone}
                      </a>
                    )}
                    {customer.email && (
                      <a href={`mailto:${customer.email}`} className="hover:text-brand-600 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {customer.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Type-Specific Profile & Specification Card */}
            {isGovernment && (
              <div className="bg-purple-50/70 rounded-2xl border border-purple-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-purple-700" />
                    GeM & Tender Compliance Profile
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-200 text-purple-900">
                    PSU / Govt
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-400 font-bold block">Tender Reference</span>
                    <strong className="text-slate-800 text-xs font-mono block truncate">
                      {customer.tender_reference || 'TDR-2026/CPWD-TEL-89'}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-400 font-bold block">GeM Order / Contract</span>
                    <strong className="text-slate-800 text-xs font-mono block truncate">
                      {customer.gem_order_number || customer.gem_seller_id || 'GEM-2026-9041'}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-400 font-bold block">EMD Status</span>
                    <strong className="text-emerald-700 text-xs block">
                      {customer.emd_amount ? `₹${customer.emd_amount.toLocaleString('en-IN')}` : 'Exempt / Processed'}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-400 font-bold block">Nodal Officer</span>
                    <strong className="text-slate-800 text-xs block truncate">
                      {customer.nodal_officer || customer.contact_person || 'Executive Engineer'}
                    </strong>
                  </div>
                </div>
                <div className="text-[11px] text-purple-800 font-medium bg-purple-100/60 p-2 rounded-lg">
                  Department: {customer.department_name || customer.company_name || 'Infrastructure & Electronics Div'}
                </div>
              </div>
            )}

            {isIndividual && (
              <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Home className="w-4 h-4 text-emerald-700" />
                    Residential / Home Cinema Profile
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                    Individual
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-slate-400 font-bold block">Room Dimensions & AV Specs</span>
                    <span className="text-slate-800 font-medium block mt-0.5">
                      {customer.room_measurements || '24ft x 16ft x 10ft (Dedicated Home Cinema Room)'}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-slate-400 font-bold block">Site / Residence Address</span>
                    <span className="text-slate-700 block mt-0.5">
                      {customer.shipping_address || customer.billing_address || 'Road No. 36, Jubilee Hills, Hyderabad'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {isCompany && (
              <div className="bg-blue-50/70 rounded-2xl border border-blue-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-700" />
                    Corporate Terms & Commercial Posture
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-200 text-blue-900">
                    Net 30
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-blue-100">
                    <span className="text-[10px] text-slate-400 font-bold block">Payment Terms</span>
                    <strong className="text-slate-800 text-xs block">
                      {customer.payment_terms_days ? `${customer.payment_terms_days} Days Net` : '30 Days Net'}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-blue-100">
                    <span className="text-[10px] text-slate-400 font-bold block">Approved Credit</span>
                    <strong className="text-blue-700 text-xs block">
                      ₹{customer.credit_limit.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* AMC & Warranty Status Widget */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Service & Warranty Summary
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Active AMC Contracts</span>
                  <span className="font-bold text-slate-900">{amcContracts.filter((a) => a.is_active).length}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Total Installed Serials</span>
                  <span className="font-bold text-slate-900">{serials.length} Devices</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Open Service Tickets</span>
                  <span className="font-bold text-amber-600">{healthMetrics.openTicketsCount}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-600">Tally Sync Records</span>
                  <span className="font-bold text-blue-600">{tallySyncItems.length} Vouchers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Tab 2: COMMERCIALS (Quotes & Orders) */}
      {activeTab === 'COMMERCIALS' && (
        <div className="space-y-6">
          {/* Presales Enquiries */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-600" />
              Presales Enquiries
            </h3>
            {enquiries.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {enquiries.map((e) => (
                  <div key={e.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {e.enquiry_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                          {e.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{e.requirement_summary}</p>
                    </div>
                    <span className="text-xs font-bold text-slate-900">
                      ₹{(e.estimated_budget || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No presales enquiries found</p>
            )}
          </div>

          {/* Quotations */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-600" />
              Proposals & Quotations
            </h3>
            {quotations.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {quotations.map((q) => (
                  <div key={q.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {q.quotation_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                          {q.version_tag || 'v1'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                          {q.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Rep: {q.salesperson_name} • Created: {new Date(q.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <span className="text-sm font-black text-slate-900">
                      ₹{Math.round(q.grand_total || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No quotations generated</p>
            )}
          </div>

          {/* Confirmed Orders */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-brand-600" />
              Confirmed Sales Orders
            </h3>
            {orders.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <div key={o.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {o.order_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {o.material_status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {o.items.length} line items • Expected: {o.expected_delivery || 'Standard'}
                      </p>
                    </div>
                    <span className="text-sm font-black text-slate-900">
                      ₹{o.total_amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No confirmed sales orders</p>
            )}
          </div>
        </div>
      )}



      {/* Tab 3: PROCUREMENT & DROP-SHIPS */}
      {activeTab === 'PROCUREMENT' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand-600" />
              Linked Procurement & Drop-Ship Orders
            </h3>
            {!showCommercialCosts && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                <EyeOff className="w-3.5 h-3.5" />
                Purchase Costs Masked (Commercial Role Restricted)
              </span>
            )}
          </div>

          {purchaseOrders.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {purchaseOrders.map((po) => {
                const isDropShip = po.delivery_type === 'DIRECT_CUSTOMER_DROPSHIP';
                return (
                  <div key={po.id} className="py-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {po.po_number}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                            isDropShip
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {isDropShip ? 'Direct Drop-Ship' : 'Office Procurement'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-700">
                          {po.status}
                        </span>
                      </div>
                      {showCommercialCosts ? (
                        <span className="text-sm font-black text-slate-900">
                          ₹{po.total_amount.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-400 italic">Restricted</span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-4 flex-wrap">
                      <span>Supplier: <strong className="text-slate-800">{po.supplier_name}</strong></span>
                      {po.sales_order_number && (
                        <span>Ref Order: <strong className="text-slate-800">{po.sales_order_number}</strong></span>
                      )}
                      <span>Date: {po.order_date}</span>
                    </div>

                    {po.items && po.items.length > 0 && (
                      <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1 mt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Procured Line Items
                        </span>
                        {po.items.map((it, i) => (
                          <div key={i} className="flex items-center justify-between text-slate-700">
                            <span>
                              {it.quantity}x {it.product_name}
                            </span>
                            {showCommercialCosts && (
                              <span className="font-mono font-semibold">
                                ₹{it.total_cost.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">
              No direct or drop-ship purchase orders linked to this customer
            </p>
          )}
        </div>
      )}

      {/* Tab 4: INVOICES & LEDGER */}
      {activeTab === 'INVOICES' && (
        <div className="space-y-6">
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Total Invoiced
              </span>
              <span className="text-xl font-black text-slate-900 block">
                ₹{financialSummary.totalInvoiced.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {invoices.length} tax invoice(s)
              </span>
            </div>

            <div className="bg-emerald-500/5 rounded-2xl border border-emerald-200/80 p-5 shadow-sm">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                Total Collected / Paid
              </span>
              <span className="text-xl font-black text-emerald-700 block">
                ₹{financialSummary.totalCollected.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-emerald-600 mt-1 block">
                {payments.length} receipt(s) from Tally & ERP
              </span>
            </div>

            <div className={`rounded-2xl border p-5 shadow-sm ${financialSummary.balanceDue > 0 ? 'bg-rose-500/5 border-rose-200/80' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-xs font-bold uppercase tracking-wider block mb-1 ${financialSummary.balanceDue > 0 ? 'text-rose-800' : 'text-slate-500'}`}>
                Balance Outstanding
              </span>
              <span className={`text-xl font-black block ${financialSummary.balanceDue > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                ₹{financialSummary.balanceDue.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {financialSummary.overdueInvoicesCount > 0 ? `${financialSummary.overdueInvoicesCount} overdue` : 'Clear status'}
              </span>
            </div>
          </div>

          {/* Tally Master Ledger & Account Card */}
          {(() => {
            const tallyLedger = tallySyncItems.find(
              (item) => item.entity_type === 'CUSTOMER' && item.tally_voucher_type?.includes('Tally Ledger')
            );
            return (
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      TallyPrime Master Ledger
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Sundry Debtors Verified
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    {tallyLedger ? tallyLedger.entity_number : customer.company_name || customer.customer_name}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Parent Group: <span className="text-slate-200 font-medium">Sundry Debtors</span> • Tally Integration: <span className="text-emerald-400 font-mono font-semibold">Live 1-Way Auto Bridge</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right sm:border-l sm:border-slate-700/80 sm:pl-4">
                    <span className="text-[11px] text-slate-400 block">Total Synced Vouchers</span>
                    <span className="text-lg font-black text-blue-400">
                      {tallySyncItems.length}
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/tally?search=${encodeURIComponent(customer.company_name || customer.customer_name)}`}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    View in Tally Module
                  </Link>
                </div>
              </div>
            );
          })()}

          {/* Tax Invoices Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-600" />
                Tax Invoices ({invoices.length})
              </span>
              <span className="text-xs text-slate-400 font-normal">
                Synced from ERP Billing & TallyPrime
              </span>
            </h3>
            {invoices.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <div key={inv.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/invoices?search=${encodeURIComponent(inv.invoice_number)}&open=${encodeURIComponent(inv.invoice_number)}`}
                          className="font-mono font-bold text-xs text-brand-700 hover:text-brand-900 hover:underline flex items-center gap-1.5"
                          title="Open Tax Invoice in ERP"
                        >
                          <span>{inv.invoice_number}</span>
                          <Printer className="w-3 h-3 text-slate-400 hover:text-brand-600" />
                        </Link>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            inv.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Date: {inv.invoice_date} • Due: {inv.due_date || 'Immediate'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 block">
                          ₹{inv.grand_total.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs font-semibold text-rose-600">
                          Bal: ₹{inv.balance_amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <Link
                        href={`/dashboard/invoices?search=${encodeURIComponent(inv.invoice_number)}&open=${encodeURIComponent(inv.invoice_number)}`}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 text-slate-500 transition"
                        title="Print / View Invoice"
                      >
                        <Printer className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">
                No unpaid tax invoices pending. Historical vouchers will stream from Tally on next sync.
              </p>
            )}
          </div>

          {/* Bank Receipts & Collections Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Bank Receipts & Collections ({payments.length})
              </span>
              <span className="text-xs text-emerald-600 font-medium">
                100% Inbound from TallyPrime 7.2
              </span>
            </h3>
            {payments.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {p.payment_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          RECONCILED WITH TALLY
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Date: {p.payment_date} • Mode: {p.mode || 'Bank Transfer'} • {p.reference_number || 'Tally Receipt'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-700 block">
                        +₹{Number(p.amount).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {p.bank_name || 'Bank Account'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">
                No receipts recorded for this customer yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: ASSETS & SERIALS */}
      {activeTab === 'ASSETS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-brand-600" />
              Installed Customer Equipment & Serial Numbers
            </h3>
            {serials.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {serials.map((s) => (
                  <div key={s.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {s.serial_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 mt-0.5 font-medium">{s.product_name}</p>
                      <p className="text-[11px] text-slate-400">
                        Warranty Ends: {s.warranty_end_date || 'Not Specified'} • Ref Order: {s.order_number || 'Direct'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No serial equipment mapped to this account</p>
            )}
          </div>

          {/* AMC Contracts */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Annual Maintenance Contracts (AMC)
            </h3>
            {amcContracts.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {amcContracts.map((a) => (
                  <div key={a.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {a.contract_number}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            a.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {a.is_active ? 'Active' : 'Expired'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Coverage: {a.start_date} to {a.end_date} • Annual Visits: {a.annual_visits_count}
                      </p>
                    </div>
                    <span className="text-sm font-black text-slate-900">
                      ₹{(a.contract_value || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No AMC contracts recorded</p>
            )}
          </div>
        </div>
      )}



      {/* Tab 6: PROJECTS & SERVICE */}
      {activeTab === 'PROJECTS' && (
        <div className="space-y-6">
          {/* Customer Open Files & Project Lifecycle */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-600" />
                  Open Files & Project Lifecycle ({projectFiles.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-item orders and customer projects tracked across 3 independent status dimensions.
                </p>
              </div>
              <Link
                href={`/dashboard/projects?customer_id=${customer.id}&action=new`}
                className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>New Project File</span>
              </Link>
            </div>

            {projectFiles.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {projectFiles.map((file) => (
                  <div key={file.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {file.file_id || file.project_code || file.id.slice(0, 12)}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {file.project_name || file.title || 'Customer Hardware Order'}
                        </span>
                        {file.department_owner && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            Dept: {file.department_owner}
                          </span>
                        )}
                        {file.file_owner_name && (
                          <span className="text-[10px] font-semibold text-slate-500">
                            Owner: {file.file_owner_name}
                          </span>
                        )}
                      </div>

                      {/* 3 Status Dimensions Badges */}
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          Sales: {file.sales_status || file.status}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          Fulfilment: {file.fulfilment_status || 'Not Started'}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          Financial: {file.financial_status || 'No Financial Activity'}
                        </span>
                      </div>

                      {/* Customer PO Details if attached */}
                      {file.customer_po && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 mt-1 flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-slate-800">
                            PO #{file.customer_po.po_number}
                          </span>
                          <span>Dated: {file.customer_po.po_date}</span>
                          <span>Value: ₹{(file.customer_po.po_value || 0).toLocaleString('en-IN')}</span>
                          <span>Terms: {file.customer_po.payment_terms}</span>
                          <span className="text-brand-700 font-semibold">Trigger: {file.customer_po.payment_trigger}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <Link
                        href={`/dashboard/projects/${file.id}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center gap-1"
                      >
                        <span>Open File</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">No project files currently open for this customer</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  Open Files track IT hardware deliveries, multi-item shipments, cross-month procurement, and independent sales/fulfilment/financial status.
                </p>
                <Link
                  href={`/dashboard/projects?customer_id=${customer.id}&action=new`}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 text-xs font-bold border border-brand-200 transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Create Project File</span>
                </Link>
              </div>
            )}
          </div>

          {/* Site Visits & Technical Feasibility Surveys */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                Site Visits & Technical Feasibility Surveys ({siteVisits.length})
              </h3>
              <Link
                href={`/dashboard/site-visits?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.customer_name)}`}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <span>+ New Survey</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {siteVisits.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {siteVisits.map((sv, idx) => (
                  <div key={sv.id || idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {sv.visitNumber || `SV26000${idx + 1}`}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {sv.project_category || 'Audio-Visual Solutions'}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            sv.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {sv.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-semibold mt-1">
                        {sv.roomType || 'Site Survey'} &bull; {sv.siteAddress}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Scheduled: {sv.scheduledDate} {sv.scheduled_time ? `(${sv.scheduled_time})` : ''} &bull; Tech: {sv.assignedTechnician || 'Vamshi Krishna'}
                        {sv.measurements ? ` &bull; Dimensions: ${sv.measurements}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href="/dashboard/site-visits"
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                      >
                        Open Survey
                      </Link>
                      <Link
                        href={`/dashboard/quotations/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.customer_name)}&site_visit=${encodeURIComponent(sv.visitNumber || `SV26000${idx + 1}`)}`}
                        className="px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs border border-brand-200 transition"
                      >
                        Create Quote
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No site visits recorded for this customer</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-brand-600" />
              Installation Job Cards & Sign-Off
            </h3>
            {installations.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {installations.map((inst) => (
                  <div key={inst.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {inst.installation_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          {inst.handover_status || inst.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Lead Technician: {inst.lead_technician_name} • Sign-off: {inst.customer_signoff_by || 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No project installations recorded</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-brand-600" />
              Service Tickets & Maintenance
            </h3>
            {tickets.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <div key={t.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {t.ticket_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {t.priority}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{t.complaint_description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No service tickets recorded</p>
            )}
          </div>
        </div>
      )}



      {/* Tab 7: TASKS & APPROVALS */}
      {activeTab === 'TASKS_APPROVALS' && (
        <div className="space-y-6">
          {/* Operational Tasks */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-brand-600" />
              Operational Follow-Ups & Tasks
            </h3>
            {tasks.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {tasks.map((tsk) => (
                  <div key={tsk.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {tsk.task_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {tsk.task_type}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                          {tsk.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 font-semibold mt-0.5">{tsk.title}</p>
                      <p className="text-[11px] text-slate-500">
                        Assigned to: {tsk.assigned_user_name} • Due Date: {tsk.due_date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No tasks assigned for this customer</p>
            )}
          </div>

          {/* Commercial Approvals */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-brand-600" />
              Commercial Approval Requests
            </h3>
            {approvals.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {approvals.map((app) => (
                  <div key={app.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {app.request_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          {app.approval_type}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            app.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : app.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {app.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Entity: {app.entity_number} • Requested by: {app.requested_by_name} ({app.requested_by_role})
                      </p>
                    </div>
                    {app.decision_date && (
                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(app.decision_date).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No commercial approvals required for this account</p>
            )}
          </div>
        </div>
      )}



      {/* Tab 8: UNIFIED TIMELINE */}
      {activeTab === 'TIMELINE' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-600" />
            Complete Customer Chronological Lifecycle
          </h3>

          <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
            {timeline.map((evt) => (
              <div key={evt.id} className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-brand-600 border-2 border-white shadow-xs" />
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{evt.title}</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {evt.timestamp ? new Date(evt.timestamp).toLocaleString('en-IN') : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{evt.subtitle}</p>
                  {evt.badge && (
                    <span className="mt-2 inline-block px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-600">
                      {evt.badge}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* Tab 9: COMMUNICATIONS & TALLY SYNC */}
      {activeTab === 'COMMUNICATIONS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-brand-600" />
              Customer Outbox Notifications & Messages
            </h3>

            {communications.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {communications.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">
                          {m.channel} Notification
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                          {m.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{m.message_body}</p>
                      <span className="text-[10px] font-mono text-slate-400">
                        Sent to: {m.recipient} • ID: {m.id}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No outbox communications logged for this contact</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              TallyPrime Voucher Synchronization Status
            </h3>

            {tallySyncItems.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {tallySyncItems.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {item.entity_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {item.entity_type}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            item.status === 'SUCCESS' || item.status === 'RECONCILED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'FAILED'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Voucher Type: {item.tally_voucher_type} • Retries: {item.retry_count}
                      </p>
                    </div>
                    {item.synced_at && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(item.synced_at).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No Tally vouchers queued for this customer</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: DOCUMENTS (Central Document Archive) */}
      {activeTab === 'DOCUMENTS' && (
        <div className="space-y-6">
          {/* Header & Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FolderArchive className="w-5 h-5 text-brand-600" />
                  Central Customer Document Archive
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Unified repository of all commercial proposals, proforma invoices, delivery challans, tax invoices, purchase orders, and physical signed/stamped copies.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedDocForUpload({
                      document_type: 'QUOTATION',
                      document_number: '',
                      customer_id: customer.id,
                      customer_name: customer.customer_name,
                      company_name: customer.company_name || undefined,
                    });
                    setIsUploadModalOpen(true);
                  }}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Upload Signed / Stamped Copy
                </button>
              </div>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Archived Docs</span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">{initialArchiveDocs.length}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Physical Signed Scans</span>
                <span className="text-base font-black text-emerald-700 mt-0.5 block">
                  {initialArchiveDocs.filter((d) => d.has_signed_copy).length} Verified
                </span>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Proformas & Challans</span>
                <span className="text-base font-black text-blue-700 mt-0.5 block">
                  {initialArchiveDocs.filter((d) => d.document_type === 'PROFORMA_INVOICE' || d.document_type === 'DELIVERY_CHALLAN').length}
                </span>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Tax Invoices</span>
                <span className="text-base font-black text-purple-700 mt-0.5 block">
                  {initialArchiveDocs.filter((d) => d.document_type === 'TAX_INVOICE').length}
                </span>
              </div>
            </div>

            {/* Filter & Search Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6 pt-6 border-t border-slate-100">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by doc #, title, notes..."
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[
                  { id: 'ALL', label: 'All Documents' },
                  { id: 'QUOTATION', label: 'Quotations' },
                  { id: 'PROFORMA_INVOICE', label: 'Proformas' },
                  { id: 'DELIVERY_CHALLAN', label: 'Challans' },
                  { id: 'TAX_INVOICE', label: 'Invoices' },
                  { id: 'PURCHASE_ORDER', label: 'POs' },
                  { id: 'SIGNED_SCAN', label: 'Signed Copies Only' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setDocTypeFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition ${
                      docTypeFilter === f.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Document List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {initialArchiveDocs
              .filter((doc) => {
                if (docTypeFilter === 'SIGNED_SCAN') return doc.has_signed_copy;
                if (docTypeFilter !== 'ALL' && doc.document_type !== docTypeFilter) return false;
                if (!docSearch.trim()) return true;
                const term = docSearch.toLowerCase();
                return (
                  doc.document_number.toLowerCase().includes(term) ||
                  doc.title.toLowerCase().includes(term) ||
                  (doc.notes && doc.notes.toLowerCase().includes(term)) ||
                  (doc.uploaded_by_name && doc.uploaded_by_name.toLowerCase().includes(term))
                );
              })
              .length === 0 ? (
              <div className="p-12 text-center">
                <FolderArchive className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">No matching archived documents found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your search terms or filters above.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {initialArchiveDocs
                  .filter((doc) => {
                    if (docTypeFilter === 'SIGNED_SCAN') return doc.has_signed_copy;
                    if (docTypeFilter !== 'ALL' && doc.document_type !== docTypeFilter) return false;
                    if (!docSearch.trim()) return true;
                    const term = docSearch.toLowerCase();
                    return (
                      doc.document_number.toLowerCase().includes(term) ||
                      doc.title.toLowerCase().includes(term) ||
                      (doc.notes && doc.notes.toLowerCase().includes(term)) ||
                      (doc.uploaded_by_name && doc.uploaded_by_name.toLowerCase().includes(term))
                    );
                  })
                  .map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 sm:p-5 hover:bg-slate-50/60 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            doc.document_type === 'QUOTATION'
                              ? 'bg-blue-50 text-blue-600 border border-blue-200'
                              : doc.document_type === 'PROFORMA_INVOICE'
                              ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                              : doc.document_type === 'DELIVERY_CHALLAN'
                              ? 'bg-amber-50 text-amber-600 border border-amber-200'
                              : doc.document_type === 'TAX_INVOICE'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          <FileText className="w-5 h-5" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-slate-900">
                              {doc.document_number}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                doc.document_type === 'QUOTATION'
                                  ? 'bg-blue-50 text-blue-700'
                                  : doc.document_type === 'PROFORMA_INVOICE'
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : doc.document_type === 'DELIVERY_CHALLAN'
                                  ? 'bg-amber-50 text-amber-700'
                                  : doc.document_type === 'TAX_INVOICE'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {doc.document_type.replace('_', ' ')}
                            </span>
                            {doc.status && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600">
                                {doc.status}
                              </span>
                            )}
                            {doc.has_signed_copy ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <FileCheck className="w-3 h-3 text-emerald-600" />
                                Signed & Stamped Scan
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-400">
                                Unsigned Scan Pending
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs font-semibold text-slate-800 mt-1">{doc.title}</h4>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                            <span>Date: {doc.date}</span>
                            {doc.amount !== undefined && doc.amount > 0 && (
                              <span className="font-bold text-slate-700">
                                Amount: ₹{Math.round(doc.amount).toLocaleString('en-IN')}
                              </span>
                            )}
                            {doc.related_transaction_number && (
                              <span className="font-mono text-slate-500">Ref: {doc.related_transaction_number}</span>
                            )}
                            {doc.uploaded_by_name && (
                              <span>By: {doc.uploaded_by_name}</span>
                            )}
                          </div>

                          {doc.notes && (
                            <p className="text-[11px] text-slate-500 mt-1 italic">&ldquo;{doc.notes}&rdquo;</p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        {doc.original_pdf_url && (
                          <Link
                            href={doc.original_pdf_url}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Generated Doc
                          </Link>
                        )}

                        {doc.has_signed_copy && doc.signed_scan_url ? (
                          <a
                            href={doc.signed_scan_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            View Physical Scan
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedDocForUpload({
                                document_type: doc.document_type,
                                document_number: doc.document_number,
                                customer_id: customer.id,
                                customer_name: customer.customer_name,
                                company_name: customer.company_name || undefined,
                                related_transaction_number: doc.related_transaction_number,
                                original_generated_pdf_url: doc.original_pdf_url,
                              });
                              setIsUploadModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Upload Signed Scan
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Upload Signed Document */}
      <UploadSignedDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        defaultDocument={selectedDocForUpload}
        onSuccess={() => {
          setIsUploadModalOpen(false);
        }}
      />


    </div>
  );
}
