'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  Layers,
  Users,
  FileText,
  FileSpreadsheet,
  ShoppingBag,
  Truck,
  Wrench,
  ReceiptText,
  CreditCard,
  Headphones,
  TrendingUp,
  BarChart3,
  Server,
  Mail,
  MessageSquare,
  Calendar,
} from 'lucide-react';

const DEMO_TOUCHPOINTS = [
  { id: '1', label: '1. Dashboard', path: '/dashboard', icon: Layers, tag: 'KPIs' },
  { id: '2', label: '2. Customer 360', path: '/dashboard/customers/DEMO-ICON260099', icon: Users, tag: 'Swan Tech' },
  { id: '3', label: '3. Demo Enquiry', path: '/dashboard/enquiries', icon: FileText, tag: 'Presales' },
  { id: '4', label: '4. Quotations', path: '/dashboard/quotations', icon: FileSpreadsheet, tag: 'Proposal' },
  { id: '5', label: '5. PDF & Review Gate', path: '/dashboard/quotations', icon: Shield, tag: 'Review' },
  { id: '6', label: '6. Zoho Email Send', path: '/dashboard/communication', icon: Mail, tag: 'SMTP' },
  { id: '7', label: '7. WhatsApp Preview', path: '/dashboard/communication', icon: MessageSquare, tag: 'Meta API' },
  { id: '8', label: '8. Sales Order', path: '/dashboard/sales-orders', icon: ShoppingBag, tag: 'Execution' },
  { id: '9', label: '9. Distributor PO', path: '/dashboard/purchases', icon: Truck, tag: 'Procurement' },
  { id: '10', label: '10. Inbound GRN', path: '/dashboard/purchases', icon: Truck, tag: 'Receipt' },
  { id: '11', label: '11. Dispatch Challan', path: '/dashboard/dispatch', icon: Truck, tag: 'Logistics' },
  { id: '12', label: '12. Installation Job', path: '/dashboard/installations', icon: Wrench, tag: 'Site Handover' },
  { id: '13', label: '13. Tax Invoice', path: '/dashboard/invoices', icon: ReceiptText, tag: 'GST B2B' },
  { id: '14', label: '14. Payment Receipt', path: '/dashboard/invoices', icon: CreditCard, tag: 'Settlement' },
  { id: '15', label: '15. Warranty & AMC', path: '/dashboard/service', icon: Headphones, tag: 'Post-Sale' },
  { id: '16', label: '16. Purchase Intel', path: '/dashboard/reports/purchase-intelligence', icon: TrendingUp, tag: 'Cross-Sell' },
  { id: '17', label: '17. Report Builder', path: '/dashboard/reports/builder', icon: BarChart3, tag: 'BI Engine' },
  { id: '18', label: '18. Tally Integration', path: '/dashboard/tally', icon: Server, tag: 'TallyPrime 7' },
  { id: '19', label: '19. HR Employees', path: '/dashboard/employees', icon: Users, tag: 'Directory' },
  { id: '20', label: '20. Attendance Board', path: '/dashboard/employees/attendance', icon: Calendar, tag: 'Site Duty' },
  { id: '21', label: '21. Salary & Payroll', path: '/dashboard/employees/payroll', icon: CreditCard, tag: 'Compensation' },
  { id: '22', label: '22. Demo Updates', path: '/dashboard/demo-updates', icon: Sparkles, tag: "What's New" },
];

export function DemoPresentationBar() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-indigo-900/50 overflow-hidden">
      {/* Top Banner Bar */}
      <div className="px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div className="flex items-center gap-2 text-xs font-bold tracking-tight">
            <span className="text-amber-400 uppercase font-black">Live Demo Mode Active</span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-slate-300 font-medium">Canonical Chain: Swan Technologies (DEMO-ICON260099)</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition cursor-pointer"
          >
            <span>{isOpen ? 'Minimize Demo Dock' : 'Open Presenter Quick-Jump (22 Touchpoints)'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Navigation Grid */}
      {isOpen && (
        <div className="p-4 border-t border-indigo-900/40 bg-slate-950/60 backdrop-blur-sm animate-in fade-in-50 duration-150">
          <div className="text-[11px] font-semibold text-slate-400 mb-2.5 uppercase tracking-wider flex items-center justify-between">
            <span>Presenter Quick Navigation Dock &bull; Click to Jump to Any Stage in Live Demonstration</span>
            <span className="text-slate-500 font-normal">Authenticates through active session permissions</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {DEMO_TOUCHPOINTS.map((tp) => {
              const Icon = tp.icon;
              return (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => router.push(tp.path)}
                  className="flex flex-col items-start p-2.5 rounded-xl bg-slate-900/80 hover:bg-indigo-600/30 border border-slate-800 hover:border-indigo-500/50 text-left transition group cursor-pointer"
                >
                  <div className="w-full flex items-center justify-between mb-1.5">
                    <Icon className="w-4 h-4 text-indigo-400 group-hover:text-indigo-200 transition" />
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                      {tp.tag}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate w-full">
                    {tp.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
