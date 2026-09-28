'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getCustomers } from '@/lib/actions/customers';
import { getInvoices } from '@/lib/actions/billing';
import { getSupplierInvoices } from '@/lib/actions/supplier-invoices';
import type { DataQualityIssue } from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_DATA_QUALITY_ISSUES__: DataQualityIssue[] | undefined;
}

const INITIAL_ISSUES: DataQualityIssue[] = [
  {
    id: 'DQI-001',
    category: 'MISSING_HSN',
    severity: 'MEDIUM',
    entity_type: 'PRODUCT',
    entity_id: 'PRD-CUSTOM-CABLE',
    entity_name: 'Custom High-Grade Audio Cable 50m',
    issue_description: 'Product record is missing mandatory 6-digit HSN/SAC code required for GST Rule 46.',
    resolution_action: 'Assigned default HSN 85444290 (Cabling & Connectors)',
    is_resolved: false,
    created_at: '2026-04-08T10:00:00.000Z',
  },
  {
    id: 'DQI-002',
    category: 'DUPLICATE_PHONE',
    severity: 'LOW',
    entity_type: 'CUSTOMER',
    entity_id: 'CUST0009',
    entity_name: 'Dr. Reddy Labs Facilities POC',
    issue_description: 'Contact phone number +91 98480 99881 matches an existing contact at Dr. Reddy Unit 2.',
    resolution_action: 'Verify if multiple site branches share the same corporate procurement head.',
    is_resolved: true,
    resolved_by: 'Admin / BDM',
    resolved_at: '2026-04-09T14:30:00.000Z',
    created_at: '2026-04-08T11:15:00.000Z',
  },
];

function getIssueStore(): DataQualityIssue[] {
  if (!globalThis.__ICON_DATA_QUALITY_ISSUES__) {
    globalThis.__ICON_DATA_QUALITY_ISSUES__ = [...INITIAL_ISSUES];
  }
  return globalThis.__ICON_DATA_QUALITY_ISSUES__;
}

/**
 * Scans ERP database for data hygiene and compliance anomalies.
 */
export async function scanDataQualityIssues(): Promise<{
  success: boolean;
  data?: {
    issues: DataQualityIssue[];
    summary: { total: number; critical: number; medium: number; resolved: number };
  };
  error?: string;
}> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const store = getIssueStore();
    const { customers } = await getCustomers();
    const { invoices } = await getInvoices();
    const supRes = await getSupplierInvoices();
    const supInvoices = supRes.invoices || [];

    // 1. Scan for duplicate GSTINs or Phone Numbers across Customers
    const gstinMap: Record<string, string[]> = {};
    const phoneMap: Record<string, string[]> = {};

    for (const c of customers) {
      if (c.gstin && c.gstin.trim().length >= 15) {
        const g = c.gstin.trim().toUpperCase();
        gstinMap[g] = gstinMap[g] || [];
        gstinMap[g].push(c.customer_name);
      }
      if (c.phone) {
        const p = c.phone.replace(/\D/g, '');
        if (p.length >= 10) {
          phoneMap[p] = phoneMap[p] || [];
          phoneMap[p].push(c.customer_name);
        }
      }
    }

    for (const [gstin, names] of Object.entries(gstinMap)) {
      if (names.length > 1) {
        const existing = store.find((i) => i.category === 'DUPLICATE_GSTIN' && i.issue_description.includes(gstin));
        if (!existing) {
          store.push({
            id: `DQI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            category: 'DUPLICATE_GSTIN',
            severity: 'HIGH',
            entity_type: 'CUSTOMER',
            entity_id: gstin,
            entity_name: names.join(' & '),
            issue_description: `Multiple customer accounts share identical GSTIN ${gstin} (${names.join(', ')}).`,
            resolution_action: 'Merge customer accounts or tag as multi-branch entities under single parent.',
            is_resolved: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // 2. Scan for missing HSN codes in invoices
    for (const inv of invoices) {
      const missingHsnItems = (inv.items || []).filter((it) => !it.hsn_code || it.hsn_code.trim() === '');
      if (missingHsnItems.length > 0) {
        const existing = store.find((i) => i.category === 'MISSING_HSN' && i.entity_id === inv.id);
        if (!existing) {
          store.push({
            id: `DQI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            category: 'MISSING_HSN',
            severity: 'HIGH',
            entity_type: 'INVOICE',
            entity_id: inv.id,
            entity_name: inv.invoice_number,
            issue_description: `Invoice ${inv.invoice_number} has ${missingHsnItems.length} item(s) without mandatory HSN code.`,
            resolution_action: 'Update invoice line items with established HSN code (e.g. 85286900).',
            is_resolved: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // 3. Scan for missing purchase cost on supplier invoices
    for (const sinv of supInvoices) {
      if (sinv.total_amount <= 0) {
        const existing = store.find((i) => i.category === 'MISSING_PURCHASE_COST' && i.entity_id === sinv.id);
        if (!existing) {
          store.push({
            id: `DQI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            category: 'MISSING_PURCHASE_COST',
            severity: 'CRITICAL',
            entity_type: 'SUPPLIER_INVOICE',
            entity_id: sinv.id,
            entity_name: sinv.invoice_number,
            issue_description: `Supplier invoice ${sinv.invoice_number} from ${sinv.supplier_name} has invalid zero total amount.`,
            resolution_action: 'Enter verified distributor invoice amount.',
            is_resolved: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    const summary = {
      total: store.length,
      critical: store.filter((i) => i.severity === 'CRITICAL' && !i.is_resolved).length,
      medium: store.filter((i) => i.severity === 'MEDIUM' && !i.is_resolved).length,
      resolved: store.filter((i) => i.is_resolved).length,
    };

    await logAuditEvent({
      userName: authUser.name,
      action: 'SCAN_DATA_QUALITY',
      module: 'DATA_QUALITY',
      details: `Completed data quality scan: ${summary.total} total issues, ${summary.critical} critical`,
    });

    return { success: true, data: { issues: store, summary } };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to scan data quality' };
  }
}

/**
 * Fetch data quality issues.
 */
export async function getDataQualityIssues(filters?: {
  severity?: string;
  is_resolved?: boolean;
}): Promise<{ success: boolean; data?: DataQualityIssue[]; error?: string }> {
  try {
    const store = getIssueStore();
    let filtered = [...store];

    if (filters?.severity) {
      filtered = filtered.filter((i) => i.severity === filters.severity);
    }
    if (filters?.is_resolved !== undefined) {
      filtered = filtered.filter((i) => i.is_resolved === filters.is_resolved);
    }

    return { success: true, data: filtered };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to get data quality issues' };
  }
}

/**
 * Resolve a data quality issue with audit logging.
 */
export async function resolveDataQualityIssue(
  id: string,
  resolutionAction: string
): Promise<{ success: boolean; data?: DataQualityIssue; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const store = getIssueStore();
    const issue = store.find((i) => i.id === id);

    if (!issue) {
      return { success: false, error: 'Data quality issue not found.' };
    }

    issue.is_resolved = true;
    issue.resolution_action = resolutionAction;
    issue.resolved_by = authUser.name;
    issue.resolved_at = new Date().toISOString();

    await logAuditEvent({
      userName: authUser.name,
      action: 'RESOLVE_DATA_QUALITY_ISSUE',
      module: 'DATA_QUALITY',
      details: `Resolved issue ${issue.id} (${issue.category}): ${resolutionAction}`,
    });

    return { success: true, data: issue };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to resolve data quality issue' };
  }
}
