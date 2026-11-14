'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireAuth, requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';

export interface DiscountTierRule {
  role: string;
  limit: number;
  approver: string;
  description: string;
}

const DEFAULT_RULES: DiscountTierRule[] = [
  {
    role: 'Sales Executive',
    limit: 5.0,
    approver: 'BDM (Vineet Babu)',
    description:
      'Maximum self-approvable discount on line-items or quote header. Exceeding quotes route to BDM.',
  },
  {
    role: 'BDM',
    limit: 15.0,
    approver: 'Admin / BDM (Dheeraj)',
    description:
      'Maximum discount approvable by Senior BDM. Exceeding quotes route to Admin / BDM.',
  },
  {
    role: 'Admin / BDM',
    limit: 25.0,
    approver: 'Managing Director (Borra Narsimulu)',
    description:
      'Maximum discount approvable by Operations Head. Exceeding quotes route to Managing Director.',
  },
  {
    role: 'Managing Director',
    limit: 100.0,
    approver: 'None (Unrestricted Super Admin)',
    description:
      'Final commercial override authority. Quotes below cost or high discount require MD sign-off.',
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __ICON_DISCOUNT_RULES__: DiscountTierRule[] | undefined;
}

function getDiscountRulesStore(): DiscountTierRule[] {
  if (!globalThis.__ICON_DISCOUNT_RULES__) {
    globalThis.__ICON_DISCOUNT_RULES__ = DEFAULT_RULES.map((r) => ({ ...r }));
  }
  return globalThis.__ICON_DISCOUNT_RULES__;
}

export async function getDiscountRulesAction(): Promise<{
  success: boolean;
  rules: DiscountTierRule[];
}> {
  await requireAuth();

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const [{ data: rolesData }, { data: rulesData }] = await Promise.all([
        admin.from('roles').select('id, name'),
        admin.from('discount_approval_rules').select('*'),
      ]);

      if (rolesData && rulesData && rulesData.length > 0) {
        const roleById = new Map<string, string>(rolesData.map((r: any) => [r.id, r.name]));
        const hydrated = DEFAULT_RULES.map((def) => {
          const matchedRule = rulesData.find((row: any) => roleById.get(row.role_id) === def.role);
          if (!matchedRule) return { ...def };
          return {
            ...def,
            limit: Number(matchedRule.max_discount_percentage ?? def.limit),
          };
        });
        return { success: true, rules: hydrated };
      }
    } catch (err) {
      console.warn('Supabase discount_approval_rules fetch fallback:', err);
    }
  }

  return { success: true, rules: getDiscountRulesStore() };
}

export async function saveDiscountRulesAction(
  rules: DiscountTierRule[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

    const sanitized = rules.map((r) => ({
      ...r,
      limit: Math.max(0, Math.min(100, Number(r.limit) || 0)),
    }));

    globalThis.__ICON_DISCOUNT_RULES__ = sanitized;

    if (await isSupabaseAvailable()) {
      const admin = createAdminClient();
      const { data: rolesData, error: rolesErr } = await admin.from('roles').select('id, name');
      if (rolesErr) {
        return { success: false, error: rolesErr.message };
      }

      const roleIdByName = new Map<string, string>(
        (rolesData || []).map((r: any) => [r.name, r.id])
      );

      for (const rule of sanitized) {
        let roleId = roleIdByName.get(rule.role);
        if (!roleId) {
          const { data: insertedRole } = await admin
            .from('roles')
            .insert({ name: rule.role, description: rule.description })
            .select('id')
            .single();
          if (insertedRole?.id) {
            roleId = insertedRole.id;
            roleIdByName.set(rule.role, roleId as string);
          }
        }
        if (!roleId) continue;

        const escalationRoleName =
          rule.role === 'Sales Executive'
            ? 'BDM'
            : rule.role === 'BDM'
            ? 'Admin / BDM'
            : rule.role === 'Admin / BDM'
            ? 'Managing Director'
            : null;
        const approverRoleId = escalationRoleName ? roleIdByName.get(escalationRoleName) || null : null;

        const { error: upsertErr } = await admin
          .from('discount_approval_rules')
          .upsert(
            {
              role_id: roleId,
              max_discount_percentage: rule.limit,
              requires_approval_from_role_id: approverRoleId,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'role_id' }
          );

        if (upsertErr) {
          return { success: false, error: upsertErr.message };
        }
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_DISCOUNT_RULES',
      module: 'ADMIN_SETTINGS',
      details: `Updated discount approval limits: ${sanitized
        .map((r) => `${r.role}=${r.limit}%`)
        .join(', ')}`,
    });

    revalidatePath('/settings/discount-rules');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save discount approval rules' };
  }
}
