'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  X,
  PhoneCall,
  Calendar,
  Briefcase,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getEnquiries } from '@/lib/actions/enquiries';
import { getSiteVisits } from '@/lib/actions/operations';
import { getTasks } from '@/lib/actions/tasks';
import { getApprovalRequests } from '@/lib/actions/approvals';
import type { UserRoleName } from '@/types/database';

export interface WorkNotificationItem {
  id: string;
  type: 'FOLLOW_UP' | 'SITE_VISIT' | 'TASK' | 'APPROVAL';
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  href: string;
  timestamp: string;
}

const DISMISSED_SESSION_KEY = 'icon_work_notifications_dismissed';

export function WorkNotificationToaster({ userRole }: { userRole?: UserRoleName }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<WorkNotificationItem[]>([]);
  const [isMinimized, setIsMinimized] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const loadNotifications = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const dismissed: string[] = JSON.parse(
          typeof window !== 'undefined' ? sessionStorage.getItem(DISMISSED_SESSION_KEY) || '[]' : '[]'
        );

        const items: WorkNotificationItem[] = [];

        // 1. Follow-ups Due
        try {
          const { enquiries } = await getEnquiries();
          const dueEnquiries = enquiries.filter(
            (e) =>
              e.follow_up_date &&
              e.follow_up_date <= todayStr &&
              e.status !== 'Order done' &&
              e.status !== 'Cancelled'
          );

          dueEnquiries.slice(0, 2).forEach((e) => {
            const notifId = `fn-${e.id || e.enquiry_number}`;
            if (!dismissed.includes(notifId)) {
              items.push({
                id: notifId,
                type: 'FOLLOW_UP',
                title: 'Client Follow-Up Due',
                description: `${e.company_name || e.customer_name} — ${e.requirement_summary || 'Review status'}`,
                badge: e.follow_up_date === todayStr ? 'Today' : 'Overdue',
                badgeColor: e.follow_up_date === todayStr ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-rose-100 text-rose-800 border-rose-300',
                href: '/dashboard/follow-ups',
                timestamp: 'Presales Lead',
              });
            }
          });
        } catch {}

        // 2. Scheduled Site Surveys
        try {
          const visits = await getSiteVisits();
          const scheduledToday = visits.filter(
            (v) => v.status === 'SCHEDULED' && v.scheduledDate && v.scheduledDate <= todayStr
          );

          scheduledToday.slice(0, 2).forEach((v) => {
            const notifId = `sv-${v.id || v.visitNumber}`;
            if (!dismissed.includes(notifId)) {
              items.push({
                id: notifId,
                type: 'SITE_VISIT',
                title: 'Site Survey Scheduled',
                description: `${v.siteAddress} • Tech: ${v.assignedTechnician || 'Assigned'}`,
                badge: 'Site Visit',
                badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
                href: '/dashboard/site-visits',
                timestamp: 'Field Survey',
              });
            }
          });
        } catch {}

        // 3. Urgent / High Priority Tasks
        try {
          const taskRes = await getTasks({ scope: 'ALL' });
          const pendingTasks = (taskRes.tasks || []).filter(
            (t) => t.status !== 'Completed' && (t.priority === 'URGENT' || t.priority === 'HIGH')
          );

          pendingTasks.slice(0, 2).forEach((t) => {
            const notifId = `tsk-${t.id || t.task_number}`;
            if (!dismissed.includes(notifId)) {
              items.push({
                id: notifId,
                type: 'TASK',
                title: t.title,
                description: `Assigned: ${t.assigned_user_name || 'Staff'} • Due: ${t.due_date}`,
                badge: t.priority,
                badgeColor: t.priority === 'URGENT' ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-800 border-amber-300',
                href: '/dashboard/follow-ups',
                timestamp: 'Task Action',
              });
            }
          });
        } catch {}

        // 4. Quotation Approvals (for MD & Admin)
        if (userRole === 'Managing Director' || userRole === 'Admin / BDM') {
          try {
            const apprRes = await getApprovalRequests();
            const pendingApprs = (apprRes.requests || []).filter((a) => a.status === 'PENDING');

            pendingApprs.slice(0, 2).forEach((a) => {
              const notifId = `apr-${a.id || a.request_number}`;
              if (!dismissed.includes(notifId)) {
                items.push({
                  id: notifId,
                  type: 'APPROVAL',
                  title: 'Quotation Approval Awaiting',
                  description: `${a.approval_type} (${a.requested_value}%) on ${a.entity_number} by ${a.requested_by_name}`,
                  badge: 'Needs Review',
                  badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
                  href: '/dashboard/approvals',
                  timestamp: 'Executive Gate',
                });
              }
            });
          } catch {}
        }

        setNotifications(items.slice(0, 4));
      } catch (err) {
        console.error('WorkNotificationToaster load error:', err);
      }
    };

    loadNotifications();
  }, [userRole]);

  if (!mounted || notifications.length === 0) return null;

  const dismissNotification = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);

    try {
      const dismissed: string[] = JSON.parse(sessionStorage.getItem(DISMISSED_SESSION_KEY) || '[]');
      if (!dismissed.includes(id)) {
        dismissed.push(id);
        sessionStorage.setItem(DISMISSED_SESSION_KEY, JSON.stringify(dismissed));
      }
    } catch {}
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ids = notifications.map((n) => n.id);
    setNotifications([]);

    try {
      const dismissed: string[] = JSON.parse(sessionStorage.getItem(DISMISSED_SESSION_KEY) || '[]');
      const combined = Array.from(new Set([...dismissed, ...ids]));
      sessionStorage.setItem(DISMISSED_SESSION_KEY, JSON.stringify(combined));
    } catch {}
  };

  const getIcon = (type: WorkNotificationItem['type']) => {
    switch (type) {
      case 'FOLLOW_UP':
        return <PhoneCall className="w-4 h-4 text-amber-600 shrink-0" />;
      case 'SITE_VISIT':
        return <Calendar className="w-4 h-4 text-blue-600 shrink-0" />;
      case 'TASK':
        return <Briefcase className="w-4 h-4 text-rose-600 shrink-0" />;
      case 'APPROVAL':
        return <ShieldAlert className="w-4 h-4 text-purple-600 shrink-0" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600 shrink-0" />;
    }
  };

  return (
    <aside
      aria-label="Work notifications"
      className="fixed bottom-4 right-4 z-40 max-w-sm w-full pointer-events-none flex flex-col items-end"
    >
      <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-3.5 space-y-2.5 w-full transition-all duration-200">
        {/* Toaster Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-800">
              Active Work Queue ({notifications.length})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title={isMinimized ? 'Expand notifications' : 'Minimize notifications'}
            >
              {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100 transition cursor-pointer"
              title="Dismiss all notifications for this session"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Toaster Body */}
        {!isMinimized && (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-200">
            {notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  dismissNotification(item.id);
                  router.push(item.href);
                }}
                className="group relative p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/70 hover:bg-blue-50/40 transition duration-150 cursor-pointer flex items-start gap-2.5 shadow-2xs"
              >
                <div className="p-1.5 rounded-lg bg-white shadow-2xs mt-0.5 border border-slate-100">
                  {getIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {item.title}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-blue-600 font-medium mt-1 group-hover:translate-x-0.5 transition">
                    <span>View Record</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => dismissNotification(item.id, e)}
                  className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/50 transition cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
