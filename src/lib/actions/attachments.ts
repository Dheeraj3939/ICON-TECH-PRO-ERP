'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import type { RecordAttachment } from '@/types/erp';

// Shared in-memory store across requests in this Node process
declare global {
  // eslint-disable-next-line no-var
  var __ICON_RECORD_ATTACHMENTS__: RecordAttachment[] | undefined;
}

function getStore(): RecordAttachment[] {
  if (!globalThis.__ICON_RECORD_ATTACHMENTS__) {
    globalThis.__ICON_RECORD_ATTACHMENTS__ = [];
  }
  return globalThis.__ICON_RECORD_ATTACHMENTS__;
}

/**
 * Universal document / photo attachment creator.
 * Supports Quotations, POs, Invoices, Site Visits, Projects, Customer Confirmation, etc.
 */
export async function uploadAttachment(payload: {
  entity_type: string;
  entity_id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  uploaded_by_role?: string;
}): Promise<{ success: boolean; data?: RecordAttachment; error?: string }> {
  try {
    const authUser = await getAuthenticatedUser();
    const uploadedBy = authUser?.name || 'System';
    const uploadedByRole = payload.uploaded_by_role || authUser?.role || 'Sales Executive';

    const attachment: RecordAttachment = {
      id: `ATT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      file_name: payload.file_name,
      file_url: payload.file_url,
      file_size: payload.file_size || 0,
      file_type: payload.file_type || 'application/octet-stream',
      uploaded_by: uploadedBy,
      uploaded_by_role: uploadedByRole,
      created_at: new Date().toISOString(),
    };

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data, error } = await admin
          .from('record_attachments')
          .insert([
            {
              entity_type: payload.entity_type,
              entity_id: payload.entity_id,
              file_name: payload.file_name,
              file_url: payload.file_url,
              file_size: payload.file_size || 0,
              file_type: payload.file_type || 'application/octet-stream',
              uploaded_by: uploadedBy,
              uploaded_by_role: uploadedByRole,
            },
          ])
          .select()
          .single();

        if (!error && data) {
          attachment.id = data.id;
        }
      } catch (dbErr) {
        console.warn('Supabase record_attachments insert failed, using store:', dbErr);
      }
    }

    const store = getStore();
    store.unshift(attachment);

    await logAuditEvent({
      userName: uploadedBy,
      action: 'UPLOAD_ATTACHMENT',
      module: 'ATTACHMENTS',
      details: `Attached ${payload.file_name} to ${payload.entity_type}:${payload.entity_id}`,
    });

    return { success: true, data: attachment };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Failed to upload attachment',
    };
  }
}

/**
 * Get all attachments for a specific entity record.
 */
export async function getAttachments(
  entity_type: string,
  entity_id: string
): Promise<RecordAttachment[]> {
  const store = getStore();

  if (await isSupabaseAvailable()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('record_attachments')
        .select('*')
        .eq('entity_type', entity_type)
        .eq('entity_id', entity_id)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as RecordAttachment[];
      }
    } catch (err) {
      console.warn('Supabase getAttachments fallback:', err);
    }
  }

  return store.filter(
    (att) => att.entity_type === entity_type && att.entity_id === entity_id
  );
}

/**
 * Delete an attachment by ID.
 */
export async function deleteAttachment(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await getAuthenticatedUser();
    const store = getStore();
    const idx = store.findIndex((att) => att.id === id);
    if (idx !== -1) {
      store.splice(idx, 1);
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('record_attachments').delete().eq('id', id);
      } catch (dbErr) {
        console.warn('Supabase deleteAttachment fallback:', dbErr);
      }
    }

    await logAuditEvent({
      userName: authUser?.name || 'System',
      action: 'DELETE_ATTACHMENT',
      module: 'ATTACHMENTS',
      details: `Deleted attachment ${id}`,
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Failed to delete attachment',
    };
  }
}
