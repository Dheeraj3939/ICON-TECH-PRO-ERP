export type BusinessEntityCode = 'ICON_TECH_PRO';

export type UserRoleName =
  | 'Managing Director'
  | 'Admin / BDM'
  | 'BDM'
  | 'Sales Executive'
  | 'Accounts'
  | 'Office Assistant';

export interface Organization {
  id: string;
  entity_code: BusinessEntityCode;
  legal_name: string;
  tagline: string | null;
  gstin: string;
  pan: string;
  state_code: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_branch: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  role_name: UserRoleName;
  description: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  description: string | null;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  role?: Role;
}

export interface DiscountApprovalRule {
  id: string;
  role_id: string;
  max_discount_percentage: number;
  requires_approval_from_role_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  role?: Role;
  approver_role?: Role | null;
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  performed_by: string | null;
  ip_address: string | null;
  created_at: string;
}
