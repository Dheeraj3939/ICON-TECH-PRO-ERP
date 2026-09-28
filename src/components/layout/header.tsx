'use client';

import { useState } from 'react';
import Link from 'next/link';
import { logout, quickLoginAsRole } from '@/app/(auth)/login/actions';
import {
  LogOut,
  User,
  MapPin,
  Search,
  ChevronDown,
  Users,
  Wifi,
  Check,
  Copy,
  Bell,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  CreditCard,
  ExternalLink,
  Menu,
} from 'lucide-react';
import type { BusinessEntityCode, UserRoleName } from '@/types/database';
import { CommandPalette } from '@/components/search/CommandPalette';

const TEAM_MEMBERS = [
  {
    name: 'Borra Narsimulu',
    role: 'Managing Director' as UserRoleName,
    desc: 'Executive & Approvals Authority',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    name: 'B V Dheeraj Reddy',
    role: 'Admin / BDM' as UserRoleName,
    desc: 'Sales Executive / Admin & System Administration',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    name: 'B Vineet Babu',
    role: 'Sales Executive' as UserRoleName,
    desc: 'Lead Handling & Corporate Sales',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    name: 'Reshma',
    role: 'Sales Executive' as UserRoleName,
    desc: 'Customer Communication & Sales',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    name: 'Hemalath',
    role: 'Accounts' as UserRoleName,
    desc: 'Finance, Invoicing & Accounts',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  },
  {
    name: 'Manisha',
    role: 'Office Assistant' as UserRoleName,
    desc: 'Office Administration & Service Coordination',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
  },
];

interface HeaderProps {
  userName?: string;
  userRole?: UserRoleName;
  activeEntity?: BusinessEntityCode;
  onEntityChange?: (entity: BusinessEntityCode) => void;
}

export function Header({
  userName = 'Borra Narsimulu',
  userRole = 'Managing Director',
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'ALL' | 'URGENT' | 'TODAY' | 'NEW' | 'DONE'>('ALL');

  const handleSwitchRole = async (name: string, role: string) => {
    setIsSwitching(name);
    await quickLoginAsRole(name, role);
  };

  const handleCopyLanLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText('http://192.168.1.108:3000');
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const notifications = [
    {
      id: 'n1',
      category: 'URGENT',
      color: 'bg-rose-500',
      icon: AlertCircle,
      title: 'Quotation follow-up due today',
      desc: 'Cyient Technologies (₹2,10,000) proposal awaiting purchase order confirmation.',
      time: 'Today, 10:00 AM',
      href: '/dashboard/follow-ups',
    },
    {
      id: 'n2',
      category: 'URGENT',
      color: 'bg-rose-500',
      icon: CreditCard,
      title: 'Payment overdue past 30 days',
      desc: 'Invoice INV-26-0042 balance ₹86,400 due from corporate client.',
      time: 'Overdue by 3 days',
      href: '/dashboard/invoices',
    },
    {
      id: 'n3',
      category: 'TODAY',
      color: 'bg-amber-500',
      icon: Calendar,
      title: 'Site survey scheduled for 2:30 PM',
      desc: 'HITEC City Smart Classroom survey assigned to field engineering team.',
      time: 'Today, 2:30 PM',
      href: '/dashboard/site-visits',
    },
    {
      id: 'n4',
      category: 'NEW',
      color: 'bg-blue-500',
      icon: FileSpreadsheet,
      title: 'New customer enquiry assigned',
      desc: 'Interactive Displays & Smart Boards requirement logged from T-Hub Foundation.',
      time: 'Today, 9:15 AM',
      href: '/dashboard/enquiries',
    },
    {
      id: 'n5',
      category: 'NEW',
      color: 'bg-blue-500',
      icon: Clock,
      title: 'AMC contract expires in 45 days',
      desc: 'Sri Sai Hospitals maintenance contract reaches renewal window on 31-Oct-2026.',
      time: 'Renewal Radar Active',
      href: '/dashboard/service',
    },
    {
      id: 'n6',
      category: 'DONE',
      color: 'bg-emerald-500',
      icon: CheckCircle2,
      title: 'Payment received: ₹1,25,000',
      desc: 'RTGS clearance recorded for Invoice INV260001. Customer ledger updated.',
      time: 'Yesterday',
      href: '/dashboard/invoices',
    },
  ];

  const filteredNotifs = notifications.filter((n) => {
    if (notifFilter === 'ALL') return true;
    return n.category === notifFilter;
  });

  return (
    <>
      <CommandPalette />
      <header className="h-16 bg-white border-b border-slate-200 fixed top-0 right-0 left-0 lg:left-64 z-20 px-3 sm:px-6 flex items-center justify-between">
        {/* Left: Hamburger menu + Brand Logo + Location */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Hamburger Drawer Trigger */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'));
              }
            }}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 transition cursor-pointer"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl border border-slate-200/80 bg-white shadow-xs">
            <img
              src="/logo-transparent.png"
              alt="ICON TECH PRO - Unified Solutions Specialist"
              className="h-6 sm:h-7 w-auto object-contain"
            />
          </div>

          {/* Location Badge */}
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>Hyderabad, Telangana (State 36)</span>
          </div>

          {/* Wi-Fi LAN Access Pill */}
          <button
            type="button"
            onClick={handleCopyLanLink}
            title="Click to copy Wi-Fi access link for team"
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-medium transition"
          >
            <Wifi className="w-3 h-3 text-emerald-600" />
            <span className="font-mono font-bold">192.168.1.108:3000</span>
            {copiedLink ? (
              <Check className="w-3 h-3 text-emerald-700" />
            ) : (
              <Copy className="w-2.5 h-2.5 text-emerald-600 opacity-60" />
            )}
          </button>
        </div>

        {/* Center: Global Search Trigger with exact placeholder requested */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-command-palette'));
              }
            }}
            className="hidden xl:flex items-center justify-between w-80 2xl:w-96 px-3.5 py-1.5 bg-slate-100/90 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs text-slate-500 hover:text-slate-800 transition group cursor-pointer"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition shrink-0" />
              <span className="font-medium truncate">Search customer, enquiry, quotation, order or invoice...</span>
            </div>
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono font-semibold text-slate-500 shadow-2xs shrink-0 ml-2">
              ⌘K
            </kbd>
          </button>

          {/* Compact search trigger for tablet & mobile */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-command-palette'));
              }
            }}
            className="xl:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/80 transition cursor-pointer"
            title="Search (⌘K)"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Notifications & Active Member Profile */}
        <div className="relative flex items-center gap-1.5 sm:gap-3">
          {/* Notification Center Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsNotifOpen((prev) => !prev);
                setIsMenuOpen(false);
              }}
              title="Notifications & Action Alerts"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/80 transition relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
            </button>

            {/* Notification Center Dropdown */}
            {isNotifOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsNotifOpen(false)} />
                <div className="absolute right-0 top-12 z-40 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Work Notifications
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      6 Updates
                    </span>
                  </div>

                  {/* Filter Categories */}
                  <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 text-[11px] font-bold">
                    {[
                      { id: 'ALL', label: 'All' },
                      { id: 'URGENT', label: '🔴 Urgent' },
                      { id: 'TODAY', label: '🟠 Due Today' },
                      { id: 'NEW', label: '🔵 New' },
                      { id: 'DONE', label: '🟢 Completed' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setNotifFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                          notifFilter === tab.id
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Notification Items List */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1">
                    {filteredNotifs.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setIsNotifOpen(false)}
                          className="p-3 hover:bg-slate-50 flex items-start gap-3 transition rounded-xl block group"
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.color}`} />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 block">
                              {item.title}
                            </span>
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                              {item.desc}
                            </p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {item.time}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Active Profile Dropdown Trigger */}
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen((prev) => !prev);
              setIsNotifOpen(false);
            }}
            className="flex items-center gap-2 sm:gap-2.5 px-2 sm:pl-3 sm:pr-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-xs font-bold text-slate-900 truncate max-w-[110px] md:max-w-[140px]">
                {userName}
              </div>
              <div className="text-[10px] font-medium text-slate-500 truncate max-w-[110px]">
                {userRole}
              </div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Sign Out Action */}
          <form action={logout}>
            <button
              type="submit"
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition duration-150"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>

          {/* Team Switcher Floating Popover */}
          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 top-14 z-40 w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="p-3.5 bg-slate-900 text-white border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        6 Team Member Profiles
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      Live Testing
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Select any profile to test specific role permissions & discount thresholds.
                  </p>
                </div>

                {/* Team list */}
                <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
                  {TEAM_MEMBERS.map((member) => {
                    const isActive = userName === member.name;
                    return (
                      <button
                        key={member.name}
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          handleSwitchRole(member.name, member.role);
                        }}
                        disabled={isSwitching !== null}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition ${
                          isActive
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {member.name}
                            </span>
                            {isActive && (
                              <span className="w-2 h-2 rounded-full bg-blue-600" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">
                            {member.desc}
                          </p>
                          <span className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded border ${member.badge}`}>
                            {member.role}
                          </span>
                        </div>

                        {isActive ? (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                            Active
                          </span>
                        ) : isSwitching === member.name ? (
                          <span className="w-3.5 h-3.5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                        ) : (
                          <span className="text-[10px] text-slate-400 hover:text-blue-600 font-medium">
                            Switch &rarr;
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Local Wi-Fi Sharing Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Wi-Fi URL:</span>
                    <span className="font-mono font-bold text-slate-900">192.168.1.108:3000</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLanLink}
                    className="text-[10.5px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>
    </>
  );
}
