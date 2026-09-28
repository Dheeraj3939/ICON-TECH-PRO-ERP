'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Settings,
  Users,
  Shield,
  KeyRound,
  Sliders,
  Layers,
  Percent,
  ShieldAlert,
  Building2,
  FileCheck2,
  HardDrive,
  Lock,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function SettingsNav() {
  const pathname = usePathname();

  const tabs = [
    {
      name: 'Overview & Queue',
      href: '/dashboard/settings',
      icon: Settings,
    },
    {
      name: 'User Management',
      href: '/dashboard/settings/users',
      icon: Users,
    },
    {
      name: 'Role Management',
      href: '/dashboard/settings/roles',
      icon: Shield,
    },
    {
      name: 'Permission Matrix',
      href: '/dashboard/settings/permissions',
      icon: KeyRound,
    },
    {
      name: 'Company Settings',
      href: '/dashboard/settings/company',
      icon: Building2,
    },
    {
      name: 'Document Settings',
      href: '/dashboard/settings/document-settings',
      icon: FileCheck2,
    },
    {
      name: 'Integrations (Gmail)',
      href: '/dashboard/settings/integrations',
      icon: Mail,
    },
    {
      name: 'Custom Dropdowns',
      href: '/dashboard/settings/dropdowns',
      icon: Sliders,
    },
    {
      name: 'Custom Fields',
      href: '/dashboard/settings/fields',
      icon: Layers,
    },
    {
      name: 'Discount Rules',
      href: '/dashboard/settings/discount-rules',
      icon: Percent,
    },
    {
      name: 'Backup & Recovery',
      href: '/dashboard/settings/backup',
      icon: HardDrive,
    },
    {
      name: 'Security / Danger Zone',
      href: '/dashboard/settings/security',
      icon: Lock,
    },
    {
      name: 'Audit Trail',
      href: '/dashboard/audit',
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100/90 border border-slate-200 rounded-2xl mb-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition duration-150',
              isActive
                ? 'bg-white text-brand-700 shadow-xs border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            )}
          >
            <Icon
              className={cn(
                'w-4 h-4',
                isActive ? 'text-brand-600' : 'text-slate-400'
              )}
            />
            <span>{tab.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
