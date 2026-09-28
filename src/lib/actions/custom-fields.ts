'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import type { CustomFieldDefinition } from '@/types/rbac';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_CUSTOM_FIELDS__: CustomFieldDefinition[] | undefined;
}

const INITIAL_CUSTOM_FIELDS: CustomFieldDefinition[] = [
  {
    id: 'cf-cust-1',
    module: 'Customers',
    field_key: 'industry_vertical',
    field_label: 'Industry Vertical',
    field_type: 'Dropdown',
    options: ['Education', 'Healthcare', 'Corporate IT', 'Government', 'Hospitality', 'Residential Luxury'],
    is_required: false,
    is_active: true,
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'cf-cust-2',
    module: 'Customers',
    field_key: 'architect_consultant',
    field_label: 'Architect / MEP Consultant Name',
    field_type: 'Text',
    is_required: false,
    is_active: true,
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'cf-enq-1',
    module: 'Enquiries',
    field_key: 'target_completion_date',
    field_label: 'Project Target Go-Live Date',
    field_type: 'Date',
    is_required: false,
    is_active: true,
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'cf-quote-1',
    module: 'Quotations',
    field_key: 'tender_closing_date',
    field_label: 'Tender Submission Deadline',
    field_type: 'Date',
    is_required: false,
    is_active: true,
    is_searchable: true,
    is_filterable: true,
    is_reportable: true,
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'cf-so-1',
    module: 'Sales Orders',
    field_key: 'project_site_contact',
    field_label: 'Site Project In-Charge Name & Phone',
    field_type: 'Text',
    is_required: false,
    is_active: true,
    is_searchable: true,
    is_filterable: false,
    is_reportable: true,
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'cf-po-1',
    module: 'Purchases',
    field_key: 'oem_tracking_ref',
    field_label: 'OEM Dispatch / Tracking Reference',
    field_type: 'Text',
    is_required: false,
    is_active: true,
    is_searchable: true,
    is_filterable: true,
    is_reportable: true,
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'cf-inv-1',
    module: 'Invoices',
    field_key: 'e_way_bill_number',
    field_label: 'E-Way Bill Number',
    field_type: 'Text',
    is_required: false,
    is_active: true,
    is_searchable: true,
    is_filterable: true,
    is_reportable: true,
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'cf-svc-1',
    module: 'Service',
    field_key: 'amc_contract_type',
    field_label: 'AMC Contract Tier',
    field_type: 'Dropdown',
    options: ['Comprehensive', 'Non-Comprehensive', 'On-Call Basis', 'Labor Only'],
    is_required: false,
    is_active: true,
    is_searchable: true,
    is_filterable: true,
    is_reportable: true,
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'cf-emp-1',
    module: 'Employees',
    field_key: 'emergency_contact_phone',
    field_label: 'Emergency Contact Number',
    field_type: 'Text',
    is_required: false,
    is_active: true,
    is_searchable: false,
    is_filterable: false,
    is_reportable: false,
    created_at: '2026-04-01T00:00:00.000Z',
  },
];

function getFieldsStore(): CustomFieldDefinition[] {
  if (!globalThis.__ICON_CUSTOM_FIELDS__) {
    globalThis.__ICON_CUSTOM_FIELDS__ = [...INITIAL_CUSTOM_FIELDS];
  }
  return globalThis.__ICON_CUSTOM_FIELDS__;
}

export async function getCustomFields(module?: CustomFieldDefinition['module']): Promise<CustomFieldDefinition[]> {
  const store = getFieldsStore();
  if (module) {
    return store.filter((f) => f.module === module);
  }
  return [...store];
}

export async function getActiveCustomFields(module: CustomFieldDefinition['module']): Promise<CustomFieldDefinition[]> {
  const store = getFieldsStore();
  return store.filter((f) => f.module === module && f.is_active);
}

export async function addCustomField(payload: {
  module: CustomFieldDefinition['module'];
  field_key: string;
  field_label: string;
  field_type: CustomFieldDefinition['field_type'];
  options?: string[];
  is_required?: boolean;
  is_searchable?: boolean;
  is_filterable?: boolean;
  is_reportable?: boolean;
}): Promise<{ success: boolean; data?: CustomFieldDefinition; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getFieldsStore();

    // Sanitization & Security Validation
    const cleanKey = payload.field_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const cleanLabel = payload.field_label.trim();

    if (!cleanKey || cleanKey.length < 2 || cleanKey.length > 40) {
      return { success: false, error: 'Field key must be between 2 and 40 alphanumeric characters.' };
    }

    if (['__proto__', 'constructor', 'prototype', 'id', 'status', 'created_at'].includes(cleanKey)) {
      return { success: false, error: 'Reserved field key name cannot be used.' };
    }

    if (!cleanLabel) {
      return { success: false, error: 'Field label cannot be empty.' };
    }

    const existing = store.find((f) => f.module === payload.module && f.field_key === cleanKey);
    if (existing) {
      return { success: false, error: `A field with key "${cleanKey}" already exists in ${payload.module}.` };
    }

    const newField: CustomFieldDefinition = {
      id: `cf-${Date.now()}`,
      module: payload.module,
      field_key: cleanKey,
      field_label: cleanLabel,
      field_type: payload.field_type,
      options: payload.field_type === 'Dropdown' ? (payload.options || []).map((o) => o.trim()).filter(Boolean) : undefined,
      is_required: Boolean(payload.is_required),
      is_searchable: payload.is_searchable ?? true,
      is_filterable: payload.is_filterable ?? true,
      is_reportable: payload.is_reportable ?? true,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    store.push(newField);

    await logAuditEvent({
      userName: actor.name,
      action: 'CUSTOM_FIELD_CREATED',
      module: 'SYSTEM_SETTINGS',
      details: `Registered custom field "${cleanLabel}" (${cleanKey}) for module "${payload.module}"`,
    });

    revalidatePath('/dashboard/settings/fields');
    return { success: true, data: newField };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to add custom field' };
  }
}

export async function toggleCustomFieldActive(
  fieldId: string,
  isActive: boolean
): Promise<{ success: boolean; data?: CustomFieldDefinition; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getFieldsStore();
    const field = store.find((f) => f.id === fieldId);
    if (!field) {
      return { success: false, error: 'Custom field definition not found.' };
    }

    field.is_active = isActive;

    await logAuditEvent({
      userName: actor.name,
      action: isActive ? 'CUSTOM_FIELD_ACTIVATED' : 'CUSTOM_FIELD_DEACTIVATED',
      module: 'SYSTEM_SETTINGS',
      details: `${isActive ? 'Activated' : 'Deactivated'} custom field "${field.field_label}" in "${field.module}"`,
    });

    revalidatePath('/dashboard/settings/fields');
    return { success: true, data: field };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to toggle custom field' };
  }
}
