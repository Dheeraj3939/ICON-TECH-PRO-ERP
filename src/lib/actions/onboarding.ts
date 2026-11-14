'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { createEmployee } from '@/lib/actions/employees';
import { createManagedUser, getManagedUsers } from '@/lib/actions/users';
import { setUserPermissionOverride } from '@/lib/actions/permissions';
import type { Employee } from '@/types/hr';
import type { ManagedUser, ERPModule, PermissionAction } from '@/types/rbac';

export async function onboardEmployee(data: {
  full_name: string;
  login_email?: string;
  corporate_email?: string;
  phone: string;
  department: string;
  designation: string;
  joining_date?: string;
  role: string;
  notes?: string;
  individualOverrides?: {
    module: ERPModule;
    action: PermissionAction;
    granted: boolean;
    reason: string;
  }[];
}): Promise<{
  success: boolean;
  employee?: Employee;
  user?: ManagedUser;
  inviteLink?: string;
  error?: string;
}> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);

    const cleanName = data.full_name.trim();
    const cleanLoginEmail = (data.login_email || data.corporate_email || '').trim().toLowerCase();
    const cleanCorporateEmail = data.corporate_email?.trim().toLowerCase() || undefined;
    const cleanPhone = data.phone.trim();

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanName) return { success: false, error: 'Full Name is required.' };
    if (!EMAIL_REGEX.test(cleanLoginEmail)) {
      return { success: false, error: 'A valid email address is required for ERP Login Email.' };
    }
    if (cleanCorporateEmail && !EMAIL_REGEX.test(cleanCorporateEmail)) {
      return { success: false, error: 'Corporate email format is invalid.' };
    }
    if (!cleanPhone) return { success: false, error: 'Mobile phone number is required.' };

    // 1. Create HR Employee Record
    const empRes = await createEmployee({
      full_name: cleanName,
      corporate_email: cleanCorporateEmail || cleanLoginEmail,
      phone: cleanPhone,
      department: data.department || 'Commercial Sales',
      designation: data.designation || data.role,
      employment_type: 'Full Time',
      joining_date: data.joining_date || new Date().toISOString().split('T')[0],
      work_location_type: 'Office',
      notes: data.notes,
    });

    if (!empRes.success || !empRes.employee) {
      return { success: false, error: empRes.error || 'Failed to create HR employee record.' };
    }

    // 2. Create ERP User Account
    const userRes = await createManagedUser({
      name: cleanName,
      email: cleanLoginEmail,
      corporate_email: cleanCorporateEmail,
      phone: cleanPhone,
      role: data.role,
      department: data.department || 'Commercial Sales',
      designation: data.designation || data.role,
      notes: `Onboarded with Employee ID: ${empRes.employee.employee_id}. ${data.notes || ''}`,
    });

    if (!userRes.success || !userRes.data) {
      return {
        success: false,
        employee: empRes.employee,
        error: userRes.error || 'Employee created, but failed to provision ERP login account.',
      };
    }

    // 3. Apply any custom individual overrides specified during onboarding
    if (data.individualOverrides && data.individualOverrides.length > 0) {
      for (const ovr of data.individualOverrides) {
        await setUserPermissionOverride({
          userId: userRes.data.id,
          userName: cleanName,
          module: ovr.module,
          action: ovr.action,
          granted: ovr.granted,
          reason: ovr.reason || 'Assigned during initial employee onboarding wizard',
        });
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'EMPLOYEE_ONBOARDED',
      module: 'USER_MANAGEMENT',
      details: `Onboarded new employee ${cleanName} (${cleanLoginEmail}) with Employee ID ${empRes.employee.employee_id} and role '${data.role}'`,
    });

    revalidatePath('/dashboard/employees');
    revalidatePath('/dashboard/settings/users');
    revalidatePath('/dashboard/settings');

    return {
      success: true,
      employee: empRes.employee,
      user: userRes.data,
      inviteLink: userRes.inviteLink,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Onboarding failed' };
  }
}
