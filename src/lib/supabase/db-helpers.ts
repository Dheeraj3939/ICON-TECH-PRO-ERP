import type { SupabaseClient } from '@supabase/supabase-js';

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

export function sanitizeUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

/**
 * Safely finds a row in Supabase by UUID `id` when `idOrCode` is a valid UUID,
 * or by `codeColumn` (e.g. customer_code, enquiry_number, order_number, invoice_number) otherwise.
 * Prevents PostgreSQL 22P02 invalid input syntax errors for type uuid when using `.or('id.eq...')`.
 */
export async function findByIdOrCode<T = any>(
  admin: SupabaseClient,
  table: string,
  idOrCode: string,
  codeColumn: string,
  select = '*'
): Promise<T | null> {
  const key = idOrCode?.trim();
  if (!key) return null;

  if (isUuid(key)) {
    const { data } = await admin
      .from(table)
      .select(select)
      .eq('id', key)
      .maybeSingle();
    if (data) return data as T;
  }

  const { data } = await admin
    .from(table)
    .select(select)
    .eq(codeColumn, key)
    .maybeSingle();

  return (data as T) || null;
}

/**
 * Escapes PostgREST filter special characters in search strings.
 */
export function sanitizeSearchTerm(term?: string | null): string {
  if (!term) return '';
  return term.replace(/[,%()]/g, ' ').trim();
}
