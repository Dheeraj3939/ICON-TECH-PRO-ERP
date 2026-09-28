'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ERP_SYSTEM_VERSION } from '@/lib/constants/version';
import {
  LayoutDashboard,
  Users,
  FileText,
  PhoneCall,
  FileSpreadsheet,
  ShoppingBag,
  Truck,
  Boxes,
  Send,
  CreditCard,
  CheckCircle2,
  Wrench,
  Repeat,
  Sparkles,
  Mail,
  MessageSquare,
  Bot,
  Mic,
  BarChart3,
  Bell,
  ShieldCheck,
  ClipboardList,
  ArrowRight,
  Play,
  Check,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface DemoSection {
  id: string;
  num: string;
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'READY' | 'PARTIALLY READY' | 'CONFIGURATION REQUIRED' | 'BLOCKED' | 'NOT IMPLEMENTED';
  badgeNote?: string;
  capabilities: string[];
}

const DEMO_SECTIONS: DemoSection[] = [
  {
    id: 'sec-01',
    num: '01',
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    status: 'READY',
    capabilities: ['Real-time KPI metrics', 'Role-tailored cards', 'Receivables radar', 'Live activity feed'],
  },
  {
    id: 'sec-02',
    num: '02',
    title: 'Customers',
    href: '/dashboard/customers',
    icon: Users,
    status: 'READY',
    capabilities: ['Company & Individual customer profiles', 'GSTIN validation (36 Telangana)', 'Salesperson mapping', 'Customer 360 history'],
  },
  {
    id: 'sec-03',
    num: '03',
    title: 'Enquiries',
    href: '/dashboard/enquiries',
    icon: FileText,
    status: 'READY',
    capabilities: ['Multi-stage lead progression', 'Automated sales rep auto-fill', 'Estimated value removed', 'Site visit scheduling'],
  },
  {
    id: 'sec-04',
    num: '04',
    title: 'Follow-ups',
    href: '/dashboard/follow-ups',
    icon: PhoneCall,
    status: 'READY',
    capabilities: ['Interactive date/time scheduler', 'Persistent chronological history', 'Overdue urgency alerts', 'Reschedule logging'],
  },
  {
    id: 'sec-05',
    num: '05',
    title: 'Quotations',
    href: '/dashboard/quotations',
    icon: FileSpreadsheet,
    status: 'READY',
    capabilities: ['Indian GST calculation', 'Discount approval rules', 'Automated PDF generator', 'Revision tracking'],
  },
  {
    id: 'sec-06',
    num: '06',
    title: 'Orders',
    href: '/dashboard/sales-orders',
    icon: ShoppingBag,
    status: 'READY',
    capabilities: ['Quotation-to-Order conversion', 'Backorder allocation', 'Procurement flag', 'Dispatch status'],
  },
  {
    id: 'sec-07',
    num: '07',
    title: 'Procurement',
    href: '/dashboard/purchases',
    icon: Truck,
    status: 'READY',
    capabilities: ['Distributor purchase orders', '3-way match validation', 'Purchase price variance alert', 'Raw cost role masking'],
  },
  {
    id: 'sec-08',
    num: '08',
    title: 'Inventory',
    href: '/dashboard/inventory',
    icon: Boxes,
    status: 'READY',
    capabilities: ['Office stock vs Drop-Ship segregation', 'Hardware serial tracking', 'Depot ledger balance', 'Reorder threshold alerts'],
  },
  {
    id: 'sec-09',
    num: '09',
    title: 'Dispatch',
    href: '/dashboard/dispatch',
    icon: Send,
    status: 'READY',
    capabilities: ['Delivery challan generator', 'Courier/direct tracking', 'Mandatory quote review gate', 'E-Way bill distance check'],
  },
  {
    id: 'sec-10',
    num: '10',
    title: 'Invoicing',
    href: '/dashboard/invoices',
    icon: FileText,
    status: 'READY',
    capabilities: ['Tax invoice issuance (Rule 46)', 'CGST/SGST vs IGST split', 'IRN SHA-256 hash', 'Printable commercial invoice'],
  },
  {
    id: 'sec-11',
    num: '11',
    title: 'Payments',
    href: '/dashboard/invoices',
    icon: CreditCard,
    status: 'READY',
    capabilities: ['Multi-invoice payment split', 'Customer unallocated advances', '0-30 to 90+ days aging buckets', 'Credit limit check'],
  },
  {
    id: 'sec-12',
    num: '12',
    title: 'Service',
    href: '/dashboard/service',
    icon: Wrench,
    status: 'READY',
    capabilities: ['Service ticket lifecycle', 'Field engineer assignment', 'Resolution time tracking', 'Job card sign-offs'],
  },
  {
    id: 'sec-13',
    num: '13',
    title: 'Rental',
    href: '/dashboard/rental',
    icon: Repeat,
    status: 'READY',
    capabilities: ['Rental asset registry', 'Rental date duration', 'Daily/monthly rental billing', 'Return condition audit'],
  },
  {
    id: 'sec-14',
    num: '14',
    title: 'AMC',
    href: '/dashboard/service',
    icon: Sparkles,
    status: 'READY',
    capabilities: ['Annual maintenance contracts', 'OEM serial expiration tracking', 'Automated renewal notifications', 'Contract renewal pipeline'],
  },
  {
    id: 'sec-15',
    num: '15',
    title: 'HR',
    href: '/dashboard/employees',
    icon: Users,
    status: 'READY',
    capabilities: ['Employee profiles & roles', 'Attendance & site duty logging', 'Salary & payroll ledger', 'Confidential salary masking'],
  },
  {
    id: 'sec-16',
    num: '16',
    title: 'Email',
    href: '/dashboard/communication',
    icon: Mail,
    status: 'CONFIGURATION REQUIRED',
    badgeNote: 'SMTP / SendGrid API Key Required',
    capabilities: ['Corporate identities (sales@, accounts@)', 'Quotation PDF email delivery', 'Communication history association', 'Outbox queue'],
  },
  {
    id: 'sec-17',
    num: '17',
    title: 'WhatsApp',
    href: '/dashboard/communication',
    icon: MessageSquare,
    status: 'CONFIGURATION REQUIRED',
    badgeNote: 'WhatsApp Business API Key Required',
    capabilities: ['Staff WhatsApp identities', 'Proposal delivery templates', 'Incoming message routing architecture', 'Dispatched logs'],
  },
  {
    id: 'sec-18',
    num: '18',
    title: 'AI Chat',
    href: '/dashboard/ai',
    icon: Bot,
    status: 'READY',
    capabilities: ['Live ERP database queries', 'Permission-gated cost masking', 'Draft email/WhatsApp generation', 'Multilingual parsing (EN/TE/HI)'],
  },
  {
    id: 'sec-19',
    num: '19',
    title: 'AI Agents',
    href: '/dashboard/ai/agents',
    icon: Bot,
    status: 'READY',
    capabilities: ['11 specialized business agents', 'Domain-specific system prompts', 'Role-restricted access control', 'Interactive session chat'],
  },
  {
    id: 'sec-20',
    num: '20',
    title: 'AI Voice',
    href: '/dashboard/ai/voice',
    icon: Mic,
    status: 'CONFIGURATION REQUIRED',
    badgeNote: 'SIP Telephony Credentials Required',
    capabilities: ['Speech turn simulation ready', 'Multilingual intent recognition', 'Caller phone customer lookup', 'Human handoff toggle'],
  },
  {
    id: 'sec-21',
    num: '21',
    title: 'Analytics',
    href: '/dashboard/reports',
    icon: BarChart3,
    status: 'READY',
    capabilities: ['Sales velocity graphs', 'Profitability analysis', 'Gross margin calculations', 'Category performance'],
  },
  {
    id: 'sec-22',
    num: '22',
    title: 'Reports',
    href: '/dashboard/reports/builder',
    icon: FileText,
    status: 'READY',
    capabilities: ['Daily/Weekly/Monthly/Annual builder', 'CSV & Excel export ready', 'Dynamic filter criteria', 'Multi-ledger consolidation'],
  },
  {
    id: 'sec-23',
    num: '23',
    title: 'Automation',
    href: '/dashboard/automated-briefings',
    icon: Sparkles,
    status: 'READY',
    capabilities: ['Automated Executive Briefing', 'Strict [FACT] / [CALCULATION] / [RECOMMENDATION] tagging', 'Multichannel delivery', 'Subscription preferences'],
  },
  {
    id: 'sec-24',
    num: '24',
    title: 'Notifications',
    href: '/dashboard',
    icon: Bell,
    status: 'READY',
    capabilities: ['Overdue follow-up alert', 'Quotation approval notifications', '3-way match variance alert', 'Role-filtered delivery'],
  },
  {
    id: 'sec-25',
    num: '25',
    title: 'Security / RBAC',
    href: '/dashboard/settings/users',
    icon: ShieldCheck,
    status: 'READY',
    capabilities: ['PBKDF2 SHA-512 authentication', 'HMAC-SHA256 signed sessions', 'Server-side route middleware', 'Strict commercial cost masking'],
  },
  {
    id: 'sec-26',
    num: '26',
    title: 'Audit Logs',
    href: '/dashboard/audit',
    icon: ClipboardList,
    status: 'READY',
    capabilities: ['Immutable ledger records', 'User identity attribution', 'Critical action tracking', 'Security exception logging'],
  },
];

const WORKFLOW_STEPS = [
  { step: 1, name: 'Customer', desc: 'Create or select corporate account (T-Hub Foundation with GSTIN)', link: '/dashboard/customers' },
  { step: 2, name: 'Enquiry', desc: 'Log commercial AV/IT enquiry without estimated value', link: '/dashboard/enquiries' },
  { step: 3, name: 'Follow-up', desc: 'Schedule follow-up date and log notes in timeline', link: '/dashboard/follow-ups' },
  { step: 4, name: 'Quotation', desc: 'Configure products, compute GST & margins, evaluate discount rules', link: '/dashboard/quotations' },
  { step: 5, name: 'Order Confirm', desc: 'Convert approved quote to confirmed Sales Order', link: '/dashboard/sales-orders' },
  { step: 6, name: 'Procurement', desc: 'Issue distributor PO to Shree Prime for required hardware', link: '/dashboard/purchases' },
  { step: 7, name: 'Inventory', desc: 'Verify physical office receipt or direct drop-ship allocation', link: '/dashboard/inventory' },
  { step: 8, name: 'Invoice', desc: 'Generate GST Tax Invoice with IRN hash and payment terms', link: '/dashboard/invoices' },
  { step: 9, name: 'Dispatch', desc: 'Issue delivery challan after mandatory quotation preview review', link: '/dashboard/dispatch' },
  { step: 10, name: 'Payment', desc: 'Record receipt and allocate across invoice balances', link: '/dashboard/invoices' },
  { step: 11, name: 'Service / AMC', desc: 'Schedule boardroom installation and record warranty expiration', link: '/dashboard/service' },
  { step: 12, name: 'Communication', desc: 'Review outgoing email and WhatsApp messages in Outbox', link: '/dashboard/communication' },
  { step: 13, name: 'Reporting', desc: 'Inspect realized sales, gross margins, and receivables aging', link: '/dashboard/reports' },
  { step: 14, name: 'AI Analysis', desc: 'Query AI Copilot for today\'s executive briefing and pipeline status', link: '/dashboard/ai' },
];

export default function DemoCenterPage() {
  const [activeStep, setActiveStep] = useState(1);

  const readyCount = DEMO_SECTIONS.filter((s) => s.status === 'READY').length;
  const configCount = DEMO_SECTIONS.filter((s) => s.status === 'CONFIGURATION REQUIRED').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 border border-brand-800/40 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 font-mono tracking-wider">
              {ERP_SYSTEM_VERSION.brandWithVersion}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              DEMO READY
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Comprehensive ERP Demo Center
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Centralized presentation portal mapping all 26 ERP subsystems, live business workflows, 
            and the end-to-end commercial customer journey.
          </p>
        </div>

        {/* Readiness Metric Badges */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700 text-center min-w-[100px]">
            <div className="text-2xl font-black text-emerald-400 font-mono">{readyCount} / 26</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Ready to Demo</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700 text-center min-w-[100px]">
            <div className="text-2xl font-black text-amber-400 font-mono">{configCount}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Config Required</div>
          </div>
        </div>
      </div>

      {/* End-to-End Demo Scenario Runner */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-brand-400 fill-brand-400" />
              <h2 className="text-base font-black text-white">
                Live End-to-End Commercial Workflow Scenario
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Follow this verified 14-step presentation path to demonstrate complete commercial data coherence
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-3 py-1 rounded-xl border border-brand-500/20">
            Step {activeStep} of 14
          </span>
        </div>

        {/* Step Progress Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {WORKFLOW_STEPS.map((s) => (
            <button
              key={s.step}
              onClick={() => setActiveStep(s.step)}
              className={`p-2.5 rounded-xl border text-left transition ${
                activeStep === s.step
                  ? 'bg-brand-600 text-white border-brand-400 shadow-md scale-102'
                  : s.step < activeStep
                  ? 'bg-slate-800 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <div className="text-[9px] font-mono font-bold opacity-70">STEP {s.step}</div>
              <div className="text-xs font-bold truncate mt-0.5">{s.name}</div>
            </button>
          ))}
        </div>

        {/* Active Step Showcase Card */}
        {WORKFLOW_STEPS[activeStep - 1] && (
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">
                Step {activeStep}: {WORKFLOW_STEPS[activeStep - 1].name}
              </div>
              <p className="text-sm font-semibold text-white">
                {WORKFLOW_STEPS[activeStep - 1].desc}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={WORKFLOW_STEPS[activeStep - 1].link}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-md"
              >
                <span>Open in ERP</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              {activeStep < 14 && (
                <button
                  onClick={() => setActiveStep((p) => Math.min(14, p + 1))}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Complete 26-Section Matrix */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-white tracking-tight">
            Complete 26 Subsystem Readiness Matrix
          </h2>
          <span className="text-xs text-slate-400">All 26 functional sections documented</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DEMO_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isReady = sec.status === 'READY';
            return (
              <div
                key={sec.id}
                className="flex flex-col justify-between p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition duration-150 shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono font-black text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                        {sec.num}
                      </span>
                      <h3 className="text-sm font-bold text-white">{sec.title}</h3>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                        isReady
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                      }`}
                    >
                      {sec.status}
                    </span>
                  </div>

                  {sec.badgeNote && (
                    <div className="text-[10px] text-amber-300/90 font-medium flex items-center gap-1 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{sec.badgeNote}</span>
                    </div>
                  )}

                  <div className="space-y-1 text-[11px] text-slate-300 pt-1">
                    {sec.capabilities.map((cap, cIdx) => (
                      <div key={cIdx} className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-brand-400 shrink-0" />
                        <span className="truncate">{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800 flex justify-end">
                  <Link
                    href={sec.href}
                    className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 group"
                  >
                    <span>Launch Module</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
