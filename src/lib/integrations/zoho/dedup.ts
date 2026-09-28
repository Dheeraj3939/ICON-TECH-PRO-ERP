import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail, normalizePhone } from '@/lib/integrations/zoho/mapper';
import type { Customer } from '@/types/customer';
import type { ZohoModuleType } from '@/types/zoho';

export interface DedupMatchResult {
  matched: boolean;
  matchType: 'EXTERNAL_ID' | 'EMAIL' | 'PHONE' | 'COMPANY_NAME' | 'AMBIGUOUS_COMPANY' | 'NONE';
  requiresHumanReview?: boolean;
  candidateMatches?: Array<{ id: string; customer_code?: string; company_name?: string; customer_name?: string }>;
  reviewReason?: string;
  existingCustomerId?: string;
  existingCustomerCode?: string;
  existingRecord?: Partial<Customer>;
}

declare global {
  // eslint-disable-next-line no-var
  var __ICON_CUSTOMERS__: Customer[] | undefined;
}

function getLocalCustomers(): Customer[] {
  return globalThis.__ICON_CUSTOMERS__ || [];
}

/**
 * Deterministic duplicate detection for Zoho records against ERP Customers.
 * Evaluation Hierarchy:
 *   1. External ID in integration_entity_mappings (provider = 'zoho_crm')
 *   2. Normalized Email match (case-insensitive, trimmed)
 *   3. Normalized Phone match (standard 10-digit mobile)
 *   4. Exact Company Name match (for companies)
 */
export async function findDuplicateCustomer(params: {
  externalModule: ZohoModuleType;
  externalId: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  customerName?: string | null;
}): Promise<DedupMatchResult> {
  const normEmail = normalizeEmail(params.email);
  const normPhone = normalizePhone(params.phone);
  const normCompany = params.companyName?.trim().toLowerCase();

  const isOnline = await isSupabaseAvailable();

  // 1. Rank 1: Check existing External ID in integration_entity_mappings
  if (isOnline) {
    try {
      const admin = createAdminClient();
      const { data: mapping } = await admin
        .from('integration_entity_mappings')
        .select('erp_id')
        .eq('provider', 'zoho_crm')
        .eq('external_module', params.externalModule)
        .eq('external_id', params.externalId)
        .maybeSingle();

      if (mapping?.erp_id) {
        return {
          matched: true,
          matchType: 'EXTERNAL_ID',
          existingCustomerId: mapping.erp_id,
        };
      }
    } catch {
      // Continue to subsequent checks if database lookup fails
    }
  }

  // 2. Rank 2: Normalized Email match
  if (normEmail) {
    if (isOnline) {
      try {
        const admin = createAdminClient();
        const { data: cust } = await admin
          .from('customers')
          .select('id, customer_code, customer_name, email, phone')
          .ilike('email', normEmail)
          .maybeSingle();

        if (cust) {
          return {
            matched: true,
            matchType: 'EMAIL',
            existingCustomerId: cust.id,
            existingCustomerCode: cust.customer_code,
            existingRecord: cust,
          };
        }
      } catch {
        // Fallback to local store
      }
    }

    const localMatch = getLocalCustomers().find(
      (c) => normalizeEmail(c.email) === normEmail
    );
    if (localMatch) {
      return {
        matched: true,
        matchType: 'EMAIL',
        existingCustomerId: localMatch.id,
        existingCustomerCode: localMatch.customer_code,
        existingRecord: localMatch,
      };
    }
  }

  // 3. Rank 3: Normalized Phone match
  if (normPhone && normPhone.length >= 10) {
    if (isOnline) {
      try {
        const admin = createAdminClient();
        const { data: cust } = await admin
          .from('customers')
          .select('id, customer_code, customer_name, email, phone')
          .or(`phone.ilike.%${normPhone}%,alternate_phone.ilike.%${normPhone}%`)
          .maybeSingle();

        if (cust) {
          return {
            matched: true,
            matchType: 'PHONE',
            existingCustomerId: cust.id,
            existingCustomerCode: cust.customer_code,
            existingRecord: cust,
          };
        }
      } catch {
        // Fallback to local store
      }
    }

    const localMatch = getLocalCustomers().find((c) => {
      const p1 = normalizePhone(c.phone);
      const p2 = normalizePhone(c.alternate_phone);
      return p1 === normPhone || p2 === normPhone;
    });

    if (localMatch) {
      return {
        matched: true,
        matchType: 'PHONE',
        existingCustomerId: localMatch.id,
        existingCustomerCode: localMatch.customer_code,
        existingRecord: localMatch,
      };
    }
  }

  // 4. Rank 4: Company name ONLY as candidate match (strict ambiguity check)
  if (normCompany && normCompany.length > 2 && normCompany !== 'individual') {
    let companyMatches: any[] = [];
    if (isOnline) {
      try {
        const admin = createAdminClient();
        const { data: custs } = await admin
          .from('customers')
          .select('id, customer_code, customer_name, company_name, email, phone')
          .ilike('company_name', normCompany)
          .limit(10);

        if (custs && custs.length > 0) {
          companyMatches = custs;
        }
      } catch {
        // Fallback to local store
      }
    }

    if (companyMatches.length === 0) {
      const localMatches = getLocalCustomers().filter(
        (c) => c.company_name && c.company_name.trim().toLowerCase() === normCompany
      );
      companyMatches = localMatches;
    }

    // MANDATORY RULE: NEVER automatically merge records using Company Name alone when more than one possible match exists.
    // Ambiguous matches must be placed into a human-review queue.
    if (companyMatches.length > 1) {
      return {
        matched: false,
        matchType: 'AMBIGUOUS_COMPANY',
        requiresHumanReview: true,
        candidateMatches: companyMatches.map((c) => ({
          id: c.id,
          customer_code: c.customer_code,
          company_name: c.company_name,
          customer_name: c.customer_name,
        })),
        reviewReason: `Ambiguous match: Found ${companyMatches.length} customer records with company name "${params.companyName}". Automatic merge prohibited; routed to human-review queue.`,
      };
    }

    if (companyMatches.length === 1) {
      const singleMatch = companyMatches[0];
      return {
        matched: true,
        matchType: 'COMPANY_NAME',
        requiresHumanReview: false,
        existingCustomerId: singleMatch.id,
        existingCustomerCode: singleMatch.customer_code,
        existingRecord: singleMatch,
      };
    }
  }

  return {
    matched: false,
    matchType: 'NONE',
  };
}
