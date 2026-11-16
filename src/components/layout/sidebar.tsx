'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ERP_SYSTEM_VERSION } from '@/lib/constants/version';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  PhoneCall,
  FileSpreadsheet,
  ShoppingBag,
  Package,
  Truck,
  CreditCard,
  Wrench,
  BarChart3,
  Settings,
  Clock,
  Briefcase,
  ShieldCheck,
  FolderOpen,
  X,
  LogOut,
  Target,
  Layers,
  Landmark,
  CheckSquare,
  Warehouse,
} from 'lucide-react';
import { logout } from '@/app/(auth)/login/actions';
import type { UserRoleName } from '@/types/database';
import type { ERPModule } from '@/types/rbac';

interface SidebarProps {
  userRole?: UserRoleName;
  userEmail?: string;
  activeEntity: string;
  allowedModules?: string[];
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRoleName[];
  module?: ERPModule;
  tag?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'CORE',
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
        module: 'Dashboard',
      },
      {
        name: 'Customers',
        href: '/dashboard/customers',
        icon: Users,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
        module: 'Customers',
      },
      {
        name: 'Enquiries',
        href: '/dashboard/enquiries',
        icon: FileText,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant'],
        module: 'Enquiries / Leads',
      },
      {
        name: 'Follow-ups & Tasks',
        href: '/dashboard/follow-ups',
        icon: PhoneCall,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant'],
        module: 'Follow-ups',
      },
      {
        name: 'Site Visits',
        href: '/dashboard/site-visits',
        icon: Calendar,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant'],
        module: 'Site Visits',
      },
      {
        name: 'Approvals',
        href: '/dashboard/approvals',
        icon: CheckSquare,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Accounts'],
        module: 'Quotations',
      },
    ],
  },
  {
    title: 'SALES',
    items: [
      {
        name: 'Quotations',
        href: '/dashboard/quotations',
        icon: FileSpreadsheet,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
        module: 'Quotations',
      },
      {
        name: 'Proforma Invoices',
        href: '/dashboard/proforma-invoices',
        icon: FileSpreadsheet,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts'],
        module: 'Quotations',
        tag: 'PI',
      },
      {
        name: 'Sales Orders',
        href: '/dashboard/sales-orders',
        icon: ShoppingBag,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts'],
        module: 'Sales Orders',
      },
      {
        name: 'Prospect Intelligence',
        href: '/dashboard/ai/prospect-intelligence',
        icon: Target,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive'],
        module: 'Enquiries / Leads',
        tag: 'AI',
      },
    ],
  },
  {
    title: 'PURCHASE & FULFILMENT',
    items: [
      {
        name: 'Products & Catalog',
        href: '/dashboard/products',
        icon: Package,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
        module: 'Product Catalog',
      },
      {
        name: 'Purchase Orders',
        href: '/dashboard/purchases',
        icon: Truck,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'Accounts', 'BDM'],
        module: 'Purchases',
      },
      {
        name: 'Inventory & Serials',
        href: '/dashboard/inventory',
        icon: Warehouse,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Accounts', 'Office Assistant'],
        module: 'Purchases',
      },
      {
        name: 'Delivery Challans',
        href: '/dashboard/delivery-challans',
        icon: Truck,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
        module: 'Purchases',
        tag: 'Rule 55',
      },
      {
        name: 'Dispatch & Shipping',
        href: '/dashboard/dispatch',
        icon: Truck,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Office Assistant'],
        module: 'Sales Orders',
      },
    ],
  },
  {
    title: 'ACCOUNTS',
    items: [
      {
        name: 'Invoices & Billing',
        href: '/dashboard/invoices',
        icon: CreditCard,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'Accounts', 'BDM', 'Sales Executive'],
        module: 'Invoices & Billing',
      },
      {
        name: 'Tally Accounting',
        href: '/dashboard/tally',
        icon: Landmark,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'Accounts'],
        module: 'Invoices & Billing',
        tag: 'Tally 7.2',
      },
    ],
  },
  {
    title: 'PROJECTS & SERVICE',
    items: [
      {
        name: 'Projects',
        href: '/dashboard/projects',
        icon: Briefcase,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
        module: 'Projects',
      },
      {
        name: 'Installations',
        href: '/dashboard/installations',
        icon: Wrench,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant'],
        module: 'Projects',
      },
      {
        name: 'Service & AMC',
        href: '/dashboard/service',
        icon: ShieldCheck,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
        module: 'Service & AMC',
      },
      {
        name: 'Documents Vault',
        href: '/dashboard/documents',
        icon: FolderOpen,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
        module: 'Dashboard',
      },
    ],
  },
  {
    title: 'PEOPLE & HR',
    items: [
      {
        name: 'Employees',
        href: '/dashboard/employees',
        icon: Users,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
        module: 'HR & Employees',
      },
      {
        name: 'Attendance',
        href: '/dashboard/employees/attendance',
        icon: Clock,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
        module: 'Attendance & Time',
      },
      {
        name: 'Salary & Payroll',
        href: '/dashboard/employees/payroll',
        icon: CreditCard,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'Accounts'],
        module: 'Payroll & Compensation',
        tag: 'Confidential',
      },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      {
        name: 'Reports',
        href: '/dashboard/reports',
        icon: BarChart3,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'Accounts', 'BDM'],
        module: 'Reports',
      },
      {
        name: 'Report Builder',
        href: '/dashboard/reports/builder',
        icon: FileSpreadsheet,
        roles: ['Managing Director', 'Admin', 'Admin / BDM', 'Accounts', 'BDM'],
        module: 'Reports',
      },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      {
        name: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
        roles: ['Managing Director', 'Admin', 'Admin / BDM'],
        module: 'System Settings',
      },
      {
        name: 'Users & Permissions',
        href: '/dashboard/settings/users',
        icon: Users,
        roles: ['Managing Director', 'Admin', 'Admin / BDM'],
        module: 'User Management',
      },
      {
        name: 'Email Auth (Zoho & Gmail)',
        href: '/dashboard/settings/integrations',
        icon: Layers,
        roles: ['Managing Director', 'Admin', 'Admin / BDM'],
        module: 'System Settings',
        tag: 'Auth/Reset',
      },
    ],
  },
];

export function Sidebar({ userRole = 'Managing Director', userEmail, activeEntity, allowedModules }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setIsMobileOpen((prev) => !prev);
    const handleOpen = () => setIsMobileOpen(true);
    const handleClose = () => setIsMobileOpen(false);

    window.addEventListener('toggle-mobile-sidebar', handleToggle);
    window.addEventListener('open-mobile-sidebar', handleOpen);
    window.addEventListener('close-mobile-sidebar', handleClose);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('toggle-mobile-sidebar', handleToggle);
      window.removeEventListener('open-mobile-sidebar', handleOpen);
      window.removeEventListener('close-mobile-sidebar', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Auto-close drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed inset-y-0 left-0 z-50 lg:z-30 select-none transition-transform duration-300 ease-in-out',
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950/60">
          <Link
            href="/dashboard"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center gap-3 overflow-hidden group flex-1"
          >
            <img
              src="/icon-emblem.png"
              alt="ICON TECH PRO"
              className="w-9 h-9 object-contain rounded-xl shadow-md shrink-0 group-hover:scale-105 transition duration-200"
            />
            <div className="leading-tight overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-white block">
                  {ERP_SYSTEM_VERSION.company}
                </span>
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {ERP_SYSTEM_VERSION.versionLabel}
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 block">
                {ERP_SYSTEM_VERSION.environment}
              </span>
            </div>
          </Link>

          {/* Mobile Drawer Close Button */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Organization Pill */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <span className="text-slate-400 text-[11px] font-medium">Organization:</span>
            <span className="font-bold text-blue-300 text-[11px] truncate">
              ICON TECH PRO
            </span>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-2 pb-8 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) => {
              // Privacy & Security Gate: Reshma and Hemalath must never see the corporate shared Gmail link
              if (item.href === '/dashboard/communication/gmail' && userEmail) {
                const normEmail = userEmail.toLowerCase().trim();
                if (
                  normEmail === 'sales@icontechpro.in' ||
                  normEmail === 'reshma@icontechpro.in' ||
                  normEmail === 'accounts@icontechpro.in'
                ) {
                  return false;
                }
              }

              if (allowedModules && allowedModules.length > 0 && item.module) {
                return allowedModules.includes(item.module);
              }
              return item.roles.includes(userRole);
            });
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-1">
                <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {section.title}
                </div>

                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href === '/dashboard/customers' && (pathname === '/customers' || pathname.startsWith('/dashboard/customers/'))) ||
                    (item.href !== '/dashboard' &&
                      item.href !== '/dashboard/settings' &&
                      item.href !== '/dashboard/employees' &&
                      item.href !== '/dashboard/reports' &&
                      pathname.startsWith(`${item.href}/`));

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        'flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition duration-150',
                        isActive
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon
                          className={cn(
                            'w-4 h-4 flex-shrink-0',
                            isActive ? 'text-blue-400' : 'text-slate-500'
                          )}
                        />
                        <span className="truncate">{item.name}</span>
                      </div>

                      {item.tag && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                          {item.tag}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* User Role Badge & Prominent Logout Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2 shrink-0">
          <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="leading-tight overflow-hidden">
              <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">
                Active Role
              </span>
              <span className="text-xs font-bold text-slate-200 truncate block">
                {userRole === 'Admin / BDM' ? 'Admin' : userRole}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              try {
                await logout();
              } catch (e: any) {
                if (e?.message?.includes('NEXT_REDIRECT') || e?.digest?.includes('NEXT_REDIRECT')) {
                  window.location.href = '/login';
                }
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 hover:border-rose-700 transition cursor-pointer group shadow-xs"
            title="Terminate session and sign out securely"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400 group-hover:translate-x-0.5 transition" />
            <span>Sign Out / Invalidate Session</span>
          </button>
        </div>
      </aside>
    </>
  );
}
