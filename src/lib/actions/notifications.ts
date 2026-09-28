'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type {
  EnterpriseNotification,
  NotificationCategory,
  NotificationPriority,
} from '@/types/notifications';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_NOTIFICATIONS__: EnterpriseNotification[] | undefined;
}

const SEED_NOTIFICATIONS: EnterpriseNotification[] = [
  {
    id: 'NOTIF-001',
    user_role: 'Managing Director',
    category: 'AMC_EXPIRY',
    title: 'AMC Contract Expiring in 33 Days',
    message: 'Sri Sai Hospitals & Diagnostic Center AMC (AMC260001) expires on 31-Oct-2026. Renewal opportunity AMC-OPP-26-0001 has been generated.',
    entity_type: 'amc_contracts',
    entity_id: 'AMC260001',
    action_url: '/dashboard/service',
    is_read: false,
    priority: 'HIGH',
    created_at: '2026-09-28T09:00:00Z',
  },
  {
    id: 'NOTIF-002',
    user_role: 'Admin / BDM',
    category: 'QUOTATION_APPROVAL',
    title: 'Discount Approval Required (18% Discount)',
    message: 'Quotation QTN-26-0042 for Cyient Technologies requires executive review. Requested margin is 13.5%.',
    entity_type: 'quotations',
    entity_id: 'QTN-26-0042',
    action_url: '/dashboard/quotations',
    is_read: false,
    priority: 'HIGH',
    created_at: '2026-09-28T08:30:00Z',
  },
  {
    id: 'NOTIF-003',
    user_role: 'Accounts',
    category: 'PAYMENT_RECEIVED',
    title: 'Payment Received ₹30,000 via NEFT',
    message: 'Payment allocated to Invoice INV260001 for T-Hub Foundation. Balance updated to ₹37,850.',
    entity_type: 'invoices',
    entity_id: 'INV260001',
    action_url: '/dashboard/invoices',
    is_read: true,
    priority: 'MEDIUM',
    created_at: '2026-09-27T16:00:00Z',
  },
  {
    id: 'NOTIF-004',
    user_role: 'Managing Director',
    category: 'DOCUMENT_EXPIRY',
    title: 'Distributor Pricing Matrix Expiring',
    message: 'BenQ Commercial Display Distribution Agreement & Price Matrix expires on 31-Dec-2026.',
    entity_type: 'documents',
    entity_id: 'DOC-26-0003',
    action_url: '/dashboard/documents',
    is_read: false,
    priority: 'MEDIUM',
    created_at: '2026-09-27T10:00:00Z',
  },
];

function getNotificationsStore(): EnterpriseNotification[] {
  if (!globalThis.__ICON_NOTIFICATIONS__) {
    globalThis.__ICON_NOTIFICATIONS__ = [...SEED_NOTIFICATIONS];
  }
  return globalThis.__ICON_NOTIFICATIONS__;
}

/**
 * Retrieve notifications applicable to the authenticated user.
 */
export async function getNotifications(unreadOnly = false): Promise<EnterpriseNotification[]> {
  const authUser = await requireAuth();
  const store = getNotificationsStore();
  let results: EnterpriseNotification[] = [];

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      let query = supabase.from('enterprise_notifications').select('*');

      if (authUser.role !== 'Managing Director' && authUser.role !== 'Admin / BDM') {
        query = query.or(`user_role.eq.${authUser.role},user_role.is.null,user_id.eq.${authUser.id}`);
      }

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(20);
      if (!error && data && data.length > 0) {
        results = data as EnterpriseNotification[];
      }
    } catch {
      // In-memory fallback
    }
  }

  if (results.length === 0) {
    results = store.filter((n) => {
      if (authUser.role === 'Managing Director' || authUser.role === 'Admin / BDM') return true;
      if (!n.user_role) return true;
      if (n.user_role === authUser.role) return true;
      if (n.user_id === authUser.id) return true;
      return false;
    });

    if (unreadOnly) {
      results = results.filter((n) => !n.is_read);
    }
  }

  return results;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  await requireAuth();
  const store = getNotificationsStore();
  const notif = store.find((n) => n.id === id);
  if (notif) {
    notif.is_read = true;
  }

  if (await isSupabaseAvailable()) {
    try {
      const supabase = await createClient();
      await supabase.from('enterprise_notifications').update({ is_read: true }).eq('id', id);
    } catch {
      // Ignore
    }
  }

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Mark all notifications as read for current user.
 */
export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
  const authUser = await requireAuth();
  const store = getNotificationsStore();

  store.forEach((n) => {
    if (authUser.role === 'Managing Director' || n.user_role === authUser.role) {
      n.is_read = true;
    }
  });

  if (await isSupabaseAvailable()) {
    try {
      const supabase = await createClient();
      await supabase.from('enterprise_notifications').update({ is_read: true }).neq('is_read', true);
    } catch {
      // Ignore
    }
  }

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Internal helper to create a notification with duplicate prevention.
 */
export async function createEnterpriseNotification(payload: {
  category: NotificationCategory;
  title: string;
  message: string;
  user_role?: string;
  user_id?: string;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  priority?: NotificationPriority;
}): Promise<EnterpriseNotification | null> {
  const store = getNotificationsStore();

  // Prevent duplicate unread notification for the same entity and category
  if (payload.entity_type && payload.entity_id) {
    const existing = store.find(
      (n) =>
        n.category === payload.category &&
        n.entity_type === payload.entity_type &&
        n.entity_id === payload.entity_id &&
        !n.is_read
    );
    if (existing) {
      return null;
    }
  }

  const newNotif: EnterpriseNotification = {
    id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    category: payload.category,
    title: payload.title,
    message: payload.message,
    user_role: payload.user_role,
    user_id: payload.user_id,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    action_url: payload.action_url,
    priority: payload.priority || 'MEDIUM',
    is_read: false,
    created_at: new Date().toISOString(),
  };

  store.unshift(newNotif);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      await admin.from('enterprise_notifications').insert({
        category: newNotif.category,
        title: newNotif.title,
        message: newNotif.message,
        user_role: newNotif.user_role,
        user_id: newNotif.user_id,
        entity_type: newNotif.entity_type,
        entity_id: newNotif.entity_id,
        action_url: newNotif.action_url,
        priority: newNotif.priority,
        is_read: false,
      });
    } catch {
      // Ignore
    }
  }

  return newNotif;
}
