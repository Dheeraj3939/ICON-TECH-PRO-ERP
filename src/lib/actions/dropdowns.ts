'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import type { DropdownOptionConfig } from '@/types/rbac';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_DROPDOWN_OPTIONS__: DropdownOptionConfig[] | undefined;
}

const INITIAL_DROPDOWN_OPTIONS: DropdownOptionConfig[] = [
  // Enquiry Source
  { id: 'opt-src-1', category: 'Enquiry Source', label: 'Walk-in', value: 'Walk-in', is_active: true, is_system: true, sort_order: 1 },
  { id: 'opt-src-2', category: 'Enquiry Source', label: 'Referral', value: 'Referral', is_active: true, is_system: true, sort_order: 2 },
  { id: 'opt-src-3', category: 'Enquiry Source', label: 'Website', value: 'Website', is_active: true, is_system: true, sort_order: 3 },
  { id: 'opt-src-4', category: 'Enquiry Source', label: 'Cold Call', value: 'Cold Call', is_active: true, is_system: true, sort_order: 4 },
  { id: 'opt-src-5', category: 'Enquiry Source', label: 'Architect / Interior Consultant', value: 'Architect', is_active: true, is_system: true, sort_order: 5 },
  { id: 'opt-src-6', category: 'Enquiry Source', label: 'Existing Customer Repeat', value: 'Existing Customer', is_active: true, is_system: true, sort_order: 6 },
  { id: 'opt-src-7', category: 'Enquiry Source', label: 'Government Tender / GeM', value: 'Government Tender', is_active: true, is_system: false, sort_order: 7 },
  { id: 'opt-src-8', category: 'Enquiry Source', label: 'OEM / Distributor Lead', value: 'Distributor Lead', is_active: true, is_system: false, sort_order: 8 },

  // Customer Industry
  { id: 'opt-ind-1', category: 'Customer Industry', label: 'Education & Universities', value: 'Education', is_active: true, is_system: true, sort_order: 1 },
  { id: 'opt-ind-2', category: 'Customer Industry', label: 'Healthcare & Hospitals', value: 'Healthcare', is_active: true, is_system: true, sort_order: 2 },
  { id: 'opt-ind-3', category: 'Customer Industry', label: 'Corporate & Enterprise IT', value: 'Corporate', is_active: true, is_system: true, sort_order: 3 },
  { id: 'opt-ind-4', category: 'Customer Industry', label: 'Government, PSUs & Defense', value: 'Government', is_active: true, is_system: true, sort_order: 4 },
  { id: 'opt-ind-5', category: 'Customer Industry', label: 'Luxury Residential & Villas', value: 'Residential', is_active: true, is_system: true, sort_order: 5 },
  { id: 'opt-ind-6', category: 'Customer Industry', label: 'Hospitality, Clubs & Auditoriums', value: 'Hospitality', is_active: true, is_system: false, sort_order: 6 },

  // Payment Mode
  { id: 'opt-pay-1', category: 'Payment Mode', label: 'NEFT / RTGS Bank Transfer', value: 'NEFT_RTGS', is_active: true, is_system: true, sort_order: 1 },
  { id: 'opt-pay-2', category: 'Payment Mode', label: 'Cheque / Demand Draft', value: 'CHEQUE', is_active: true, is_system: true, sort_order: 2 },
  { id: 'opt-pay-3', category: 'Payment Mode', label: 'UPI / Instant QR', value: 'UPI', is_active: true, is_system: true, sort_order: 3 },
  { id: 'opt-pay-4', category: 'Payment Mode', label: 'Credit / Debit Card', value: 'CARD', is_active: true, is_system: false, sort_order: 4 },
  { id: 'opt-pay-5', category: 'Payment Mode', label: 'Letter of Credit (LC) / Bank Guarantee', value: 'LC_BG', is_active: true, is_system: false, sort_order: 5 },

  // Project Room Type
  { id: 'opt-rm-1', category: 'Project Room Type', label: 'Executive Boardroom', value: 'Boardroom', is_active: true, is_system: true, sort_order: 1 },
  { id: 'opt-rm-2', category: 'Project Room Type', label: 'Smart Classroom / Training Room', value: 'Smart Classroom', is_active: true, is_system: true, sort_order: 2 },
  { id: 'opt-rm-3', category: 'Project Room Type', label: 'Dolby Atmos Home Cinema', value: 'Home Cinema', is_active: true, is_system: true, sort_order: 3 },
  { id: 'opt-rm-4', category: 'Project Room Type', label: 'Auditorium / Convention Hall', value: 'Auditorium', is_active: true, is_system: true, sort_order: 4 },
  { id: 'opt-rm-5', category: 'Project Room Type', label: 'CCTV Command & Control Center', value: 'Control Room', is_active: true, is_system: false, sort_order: 5 },

  // Customer Type
  { id: 'opt-ct-1', category: 'Customer Type', label: 'B2B Enterprise', value: 'B2B_Enterprise', is_active: true, is_system: true, sort_order: 1 },
  { id: 'opt-ct-2', category: 'Customer Type', label: 'Government / PSU', value: 'Govt_PSU', is_active: true, is_system: true, sort_order: 2 },
  { id: 'opt-ct-3', category: 'Customer Type', label: 'Educational Institution', value: 'Education', is_active: true, is_system: true, sort_order: 3 },
  { id: 'opt-ct-4', category: 'Customer Type', label: 'Retail / Individual', value: 'Retail', is_active: true, is_system: false, sort_order: 4 },
  { id: 'opt-ct-5', category: 'Customer Type', label: 'System Integrator / Partner', value: 'Partner', is_active: true, is_system: false, sort_order: 5 },

  // Department
  { id: 'opt-dept-1', category: 'Department', label: 'Executive Management', value: 'Executive Management', is_active: true, is_system: true, sort_order: 1 },
  { id: 'opt-dept-2', category: 'Department', label: 'Business Development & Sales', value: 'Sales', is_active: true, is_system: true, sort_order: 2 },
  { id: 'opt-dept-3', category: 'Department', label: 'Finance & Accounts', value: 'Accounts', is_active: true, is_system: true, sort_order: 3 },
  { id: 'opt-dept-4', category: 'Department', label: 'Procurement & Supply Chain', value: 'Procurement', is_active: true, is_system: true, sort_order: 4 },
  { id: 'opt-dept-5', category: 'Department', label: 'Projects & Engineering', value: 'Engineering', is_active: true, is_system: true, sort_order: 5 },
  { id: 'opt-dept-6', category: 'Department', label: 'Field Operations & Logistics', value: 'Operations', is_active: true, is_system: false, sort_order: 6 },
  { id: 'opt-dept-7', category: 'Department', label: 'Administration & Support', value: 'Administration', is_active: true, is_system: false, sort_order: 7 },

  // Designation
  { id: 'opt-desig-1', category: 'Designation', label: 'Managing Director', value: 'Managing Director', is_active: true, is_system: true, sort_order: 1 },
  { id: 'opt-desig-2', category: 'Designation', label: 'Business Development Manager', value: 'Business Development Manager', is_active: true, is_system: true, sort_order: 2 },
  { id: 'opt-desig-3', category: 'Designation', label: 'Senior Sales Executive', value: 'Sales Executive', is_active: true, is_system: true, sort_order: 3 },
  { id: 'opt-desig-4', category: 'Designation', label: 'Accountant', value: 'Accountant', is_active: true, is_system: true, sort_order: 4 },
  { id: 'opt-desig-5', category: 'Designation', label: 'Field Service Engineer', value: 'Service Engineer', is_active: true, is_system: false, sort_order: 5 },
  { id: 'opt-desig-6', category: 'Designation', label: 'Office Assistant', value: 'Office Assistant', is_active: true, is_system: false, sort_order: 6 },

  // Lead Source
  { id: 'opt-ls-1', category: 'Lead Source', label: 'Direct Referral', value: 'Referral', is_active: true, is_system: true, sort_order: 1 },
  { id: 'opt-ls-2', category: 'Lead Source', label: 'Digital Marketing & Social', value: 'Digital Marketing', is_active: true, is_system: true, sort_order: 2 },
  { id: 'opt-ls-3', category: 'Lead Source', label: 'Industry Exhibition / Expo', value: 'Exhibition', is_active: true, is_system: true, sort_order: 3 },
  { id: 'opt-ls-4', category: 'Lead Source', label: 'Architect Network', value: 'Architect', is_active: true, is_system: false, sort_order: 4 },
  { id: 'opt-ls-5', category: 'Lead Source', label: 'Govt Tender Portal', value: 'Tender Portal', is_active: true, is_system: false, sort_order: 5 },
  { id: 'opt-ls-6', category: 'Lead Source', label: 'Inbound Phone / Email', value: 'Inbound', is_active: true, is_system: false, sort_order: 6 },
];

function getDropdownStore(): DropdownOptionConfig[] {
  if (!globalThis.__ICON_DROPDOWN_OPTIONS__) {
    globalThis.__ICON_DROPDOWN_OPTIONS__ = [...INITIAL_DROPDOWN_OPTIONS];
  }
  return globalThis.__ICON_DROPDOWN_OPTIONS__;
}

export async function getDropdownOptions(category?: DropdownOptionConfig['category']): Promise<DropdownOptionConfig[]> {
  const store = getDropdownStore();
  if (category) {
    return store.filter((o) => o.category === category);
  }
  return [...store];
}

export async function getActiveDropdownOptions(category: DropdownOptionConfig['category']): Promise<DropdownOptionConfig[]> {
  const store = getDropdownStore();
  return store
    .filter((o) => o.category === category && o.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function addDropdownOption(payload: {
  category: DropdownOptionConfig['category'];
  label: string;
  value?: string;
}): Promise<{ success: boolean; data?: DropdownOptionConfig; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getDropdownStore();

    const label = payload.label.trim();
    if (!label) {
      return { success: false, error: 'Option label cannot be empty.' };
    }

    const value = (payload.value || label).trim();
    const existing = store.find((o) => o.category === payload.category && o.value.toLowerCase() === value.toLowerCase());
    if (existing) {
      if (!existing.is_active) {
        existing.is_active = true;
        revalidatePath('/dashboard/settings/dropdowns');
        return { success: true, data: existing };
      }
      return { success: false, error: `Option "${label}" already exists in ${payload.category}.` };
    }

    const maxSort = store
      .filter((o) => o.category === payload.category)
      .reduce((max, o) => Math.max(max, o.sort_order), 0);

    const newOption: DropdownOptionConfig = {
      id: `opt-${Date.now()}`,
      category: payload.category,
      label,
      value,
      is_active: true,
      is_system: false,
      sort_order: maxSort + 1,
    };

    store.push(newOption);

    await logAuditEvent({
      userName: actor.name,
      action: 'DROPDOWN_OPTION_ADDED',
      module: 'SYSTEM_SETTINGS',
      details: `Added new option "${label}" under category "${payload.category}"`,
    });

    revalidatePath('/dashboard/settings/dropdowns');
    return { success: true, data: newOption };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to add option' };
  }
}

export async function toggleDropdownOptionActive(
  optionId: string,
  isActive: boolean
): Promise<{ success: boolean; data?: DropdownOptionConfig; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getDropdownStore();
    const opt = store.find((o) => o.id === optionId);
    if (!opt) {
      return { success: false, error: 'Dropdown option not found.' };
    }

    opt.is_active = isActive;

    await logAuditEvent({
      userName: actor.name,
      action: isActive ? 'DROPDOWN_OPTION_ACTIVATED' : 'DROPDOWN_OPTION_DEACTIVATED',
      module: 'SYSTEM_SETTINGS',
      details: `${isActive ? 'Activated' : 'Deactivated'} option "${opt.label}" in "${opt.category}"`,
    });

    revalidatePath('/dashboard/settings/dropdowns');
    return { success: true, data: opt };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to toggle option' };
  }
}
