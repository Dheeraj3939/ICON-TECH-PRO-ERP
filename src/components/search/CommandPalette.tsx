'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  ArrowRight,
  Building2,
  Users,
  Package,
  FileSpreadsheet,
  ShoppingBag,
  CreditCard,
  FileText,
  Calendar,
  PhoneCall,
  Boxes,
  Truck,
  Send,
  Sparkles,
  Wrench,
  Repeat,
  BarChart3,
  Settings,
  ShieldCheck,
  LayoutDashboard,
  UploadCloud,
  CheckCircle2,
  Loader2,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { globalSearch, type SearchResultItem } from '@/lib/actions/search';

interface ModuleItem {
  id: string;
  category: 'Module';
  title: string;
  subtitle: string;
  badge?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MODULE_ITEMS: ModuleItem[] = [
  {
    id: 'mod-1',
    category: 'Module',
    title: 'Executive Dashboard & Operations Hub',
    subtitle: 'High-level business KPIs, pipeline breakdown, workforce status & cash flow',
    href: '/dashboard',
    icon: LayoutDashboard,
    badge: 'Core',
  },
  {
    id: 'mod-2',
    category: 'Module',
    title: 'Customer Master & 360',
    subtitle: 'B2B & B2C records with annual sequence engine & unified Customer 360',
    href: '/customers',
    icon: Users,
    badge: 'Master Data',
  },
  {
    id: 'mod-3',
    category: 'Module',
    title: 'Quotations & CPQ Generator',
    subtitle: 'GST-compliant proposal generator with revision history v1/v2 & margin control',
    href: '/dashboard/quotations',
    icon: FileSpreadsheet,
    badge: 'Sales',
  },
  {
    id: 'mod-4',
    category: 'Module',
    title: 'Confirmed Sales Orders',
    subtitle: 'Stock allocation, split reservation & multi-distributor procurement',
    href: '/dashboard/sales-orders',
    icon: ShoppingBag,
    badge: 'Sales',
  },
  {
    id: 'mod-5',
    category: 'Module',
    title: 'Procurement & Purchases',
    subtitle: 'Distributor POs, drop-ship tracking & Office Goods Receipt Notes (GRN)',
    href: '/dashboard/purchases',
    icon: Truck,
    badge: 'Procurement',
  },
  {
    id: 'mod-6',
    category: 'Module',
    title: 'Product Catalog & Suppliers',
    subtitle: 'AV, CCTV, Displays & Networking with protected commercial margins',
    href: '/dashboard/products',
    icon: Package,
    badge: 'Catalog',
  },
  {
    id: 'mod-7',
    category: 'Module',
    title: 'Inventory & Serial Tracking',
    subtitle: 'Physical office stock ledger, serial asset lifecycle & OEM/Distributor warranty',
    href: '/dashboard/inventory',
    icon: Boxes,
    badge: 'Operations',
  },
  {
    id: 'mod-8',
    category: 'Module',
    title: 'Invoices & Indian GST Billing',
    subtitle: 'Rule 46 tax invoices, intrastate CGST+SGST, interstate IGST & payments',
    href: '/dashboard/invoices',
    icon: CreditCard,
    badge: 'Finance',
  },
  {
    id: 'mod-9',
    category: 'Module',
    title: 'Project Installations & Job Cards',
    subtitle: 'Engineering checklists, sign-offs & digital customer acceptance',
    href: '/dashboard/installations',
    icon: Sparkles,
    badge: 'Projects',
  },
  {
    id: 'mod-10',
    category: 'Module',
    title: 'Service Tickets & AMC Contracts',
    subtitle: 'Maintenance SLAs, service tickets & annual maintenance contract renewals',
    href: '/dashboard/service',
    icon: Wrench,
    badge: 'Services',
  },
  {
    id: 'mod-11',
    category: 'Module',
    title: 'Customer Purchase Intelligence & Reports',
    subtitle: 'Cross-product gap analysis, opportunity finder & custom report builder',
    href: '/dashboard/reports',
    icon: BarChart3,
    badge: 'Intelligence',
  },
  {
    id: 'mod-12',
    category: 'Module',
    title: 'Employees & Attendance',
    subtitle: 'Employee directory, attendance, site duty & HR records',
    href: '/dashboard/employees',
    icon: Users,
    badge: 'HR & People',
  },
];

const SEARCH_TIPS = [
  { text: '"T-Hub orders"', label: 'Filter orders by customer' },
  { text: '"Cyient payments"', label: 'View billing & pending balance' },
  { text: '"quotations this month"', label: 'View active commercial proposals' },
  { text: '"overdue invoices"', label: 'Receivables past credit period' },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [interpretedIntent, setInterpretedIntent] = useState<string | null>(null);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcut listener (Cmd+K / Ctrl+K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    function handleCustomOpen() {
      setIsOpen(true);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleCustomOpen);
    };
  }, []);

  // Autofocus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setInterpretedIntent(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced server search execution
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = query.trim();

    if (!trimmed) {
      // Show modules when search input is empty
      const mods: SearchResultItem[] = MODULE_ITEMS.map((m) => ({
        id: m.id,
        category: 'Module',
        title: m.title,
        subtitle: m.subtitle,
        badge: m.badge,
        href: m.href,
      }));
      setResults(mods);
      setInterpretedIntent(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await globalSearch(trimmed, activeCategory);
        setResults(res.results);
        setInterpretedIntent(res.interpretedIntent || null);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, activeCategory]);

  // Keyboard navigation within results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const handleSelect = (item: SearchResultItem) => {
    setIsOpen(false);
    router.push(item.href);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Customer':
        return Users;
      case 'Sales Order':
        return ShoppingBag;
      case 'Quotation':
        return FileSpreadsheet;
      case 'Invoice':
        return CreditCard;
      case 'Product':
        return Package;
      case 'Serial':
        return Boxes;
      case 'Purchase Order':
        return Truck;
      case 'Installation':
        return Sparkles;
      case 'Service':
      case 'AMC':
        return Wrench;
      case 'Intelligence':
        return BarChart3;
      default:
        return LayoutDashboard;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-16 p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[82vh] animate-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Top Search Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50/70">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-brand-600 flex-shrink-0 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-brand-600 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, enquiry, quotation, order or invoice..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-800 placeholder-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded bg-slate-200/80 text-[10px] font-mono text-slate-600 font-semibold">
            ESC
          </kbd>
        </div>

        {/* Category Pill Filters */}
        <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          {[
            { id: 'ALL', label: 'All Results' },
            { id: 'Customer', label: 'Customers' },
            { id: 'Sales Order', label: 'Orders' },
            { id: 'Quotation', label: 'Quotations' },
            { id: 'Invoice', label: 'Invoices' },
            { id: 'Product', label: 'Products' },
            { id: 'Serial', label: 'Serials' },
            { id: 'Purchase Order', label: 'Procurement' },
            { id: 'Service', label: 'Services' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setSelectedIndex(0);
              }}
              className={
                'px-3 py-1 rounded-lg transition whitespace-nowrap ' +
                (activeCategory === cat.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70')
              }
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Natural Language Intent Recognized Pill Banner */}
        {interpretedIntent && (
          <div className="px-4 py-2 bg-brand-50 border-b border-brand-100 flex items-center justify-between text-xs text-brand-900">
            <div className="flex items-center gap-2 font-medium">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>{interpretedIntent}</span>
            </div>
            <span className="text-[10px] font-bold bg-brand-200/70 px-2 py-0.5 rounded text-brand-800">
              Natural Language Match
            </span>
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100">
          {results.length > 0 ? (
            results.map((item, idx) => {
              const IconComponent = getCategoryIcon(item.category);
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={
                    'px-3 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition text-left ' +
                    (isSelected
                      ? 'bg-brand-50/80 border border-brand-200 text-brand-950 shadow-2xs'
                      : 'hover:bg-slate-50 border border-transparent')
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={
                        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ' +
                        (isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600')
                      }
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold truncate text-slate-900">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <ArrowRight
                    className={
                      'w-4 h-4 flex-shrink-0 transition ' +
                      (isSelected ? 'text-brand-600 translate-x-0.5' : 'text-slate-300')
                    }
                  />
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400">
              <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-slate-600">
                No matching records found for "{query}"
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Try searching by Customer Name, Order Number, Phone, GSTIN, or SKU
              </p>
            </div>
          )}
        </div>

        {/* Bottom Helper Footer & Natural Query Tips */}
        {!query && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600 whitespace-nowrap">Try:</span>
            {SEARCH_TIPS.map((tip, i) => (
              <button
                key={i}
                onClick={() => setQuery(tip.text.replace(/"/g, ''))}
                className="px-2 py-0.5 rounded bg-white hover:bg-slate-200/70 border border-slate-200 text-slate-700 font-mono text-[10px] whitespace-nowrap transition cursor-pointer"
              >
                {tip.text}
              </button>
            ))}
          </div>
        )}

        <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 font-semibold">↑</kbd>{' '}
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 font-semibold">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 font-semibold">↵</kbd> to select
            </span>
          </div>
          <span>ICON TECH PRO Universal Search</span>
        </div>
      </div>
    </div>
  );
}
