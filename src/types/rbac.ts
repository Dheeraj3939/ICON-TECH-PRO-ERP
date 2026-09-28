export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'export';

export type ERPModule =
  | 'Dashboard'
  | 'Enquiries / Leads'
  | 'Customers'
  | 'Site Visits'
  | 'Follow-ups'
  | 'Quotations'
  | 'Sales Orders'
  | 'Product Catalog'
  | 'Purchases'
  | 'Inventory & Serials'
  | 'Invoices & Billing'
  | 'Payments'
  | 'Dispatch & Challans'
  | 'Installations'
  | 'Reports'
  | 'User Management'
  | 'Role & Permission Management'
  | 'System Settings'
  | 'HR & Employees'
  | 'Attendance & Time'
  | 'Payroll & Compensation'
  | 'Demo Updates'
  | (string & {});

export const ALL_ERP_MODULES: ERPModule[] = [
  'Dashboard',
  'Enquiries / Leads',
  'Customers',
  'Site Visits',
  'Follow-ups',
  'Quotations',
  'Sales Orders',
  'Product Catalog',
  'Purchases',
  'Inventory & Serials',
  'Invoices & Billing',
  'Payments',
  'Dispatch & Challans',
  'Installations',
  'Reports',
  'User Management',
  'Role & Permission Management',
  'System Settings',
  'HR & Employees',
  'Attendance & Time',
  'Payroll & Compensation',
  'Demo Updates',
];

export const ALL_PERMISSION_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'export',
];

export type AccessLevel = 'FULL' | 'LIMITED' | 'NONE';

export type AccountLifecycleStatus =
  | 'ACTIVE'
  | 'INVITED'
  | 'PENDING'
  | 'SUSPENDED'
  | 'DEACTIVATED';

export interface ControlledModuleDefinition {
  key: string;
  name: ERPModule;
  label: string;
  category: 'CORE' | 'SALES' | 'PROCUREMENT' | 'INVENTORY' | 'SERVICE' | 'PEOPLE' | 'ANALYTICS' | 'ADMIN' | 'COMMUNICATION' | 'AI' | 'CUSTOM';
  route: string;
  iconName: string;
  description: string;
  defaultActions: PermissionAction[];
  isSystem: boolean;
  requiresSpecialAuthorization?: boolean;
  isControlledFutureModule?: boolean;
  createdAt: string;
}

export interface AppRole {
  id: string;
  role_name: string;
  description: string;
  is_system: boolean;
  user_count?: number;
  created_at: string;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: AccountLifecycleStatus | 'INACTIVE';
  can_login: boolean;
  department?: string;
  designation?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  last_login?: string;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  actor_name: string;
  action: string;
  module: string;
  affected_user?: string;
  old_value?: any;
  new_value?: any;
  details: string;
  ip_address?: string;
}

export type RolePermissionMatrix = Record<string, Record<string, Record<PermissionAction, boolean>>>;

export interface UserPermissionOverride {
  id: string;
  userId: string;
  module: ERPModule;
  action: PermissionAction;
  granted: boolean; // true = addition, false = restriction
  reason: string;
  grantedBy: string;
  grantedAt: string;
  startDate?: string;
  endDate?: string;
  isTemporary?: boolean;
}

export interface EffectivePermissionInfo {
  allowed: boolean;
  source: 'ROLE' | 'INDIVIDUAL_ADD' | 'INDIVIDUAL_RESTRICT' | 'TEMPORARY_ADD' | 'TEMPORARY_EXPIRED';
  reason?: string;
  overrideId?: string;
  expiresAt?: string;
}

export interface CustomFieldDefinition {
  id: string;
  module:
    | 'Customers'
    | 'Enquiries'
    | 'Site Visits'
    | 'Quotations'
    | 'Sales Orders'
    | 'Purchases'
    | 'Invoices'
    | 'Service'
    | 'Employees';
  field_key: string;
  field_label: string;
  field_type: 'Text' | 'Number' | 'Date' | 'Dropdown' | 'Checkbox';
  options?: string[]; // For Dropdown type
  is_required: boolean;
  is_active: boolean;
  is_searchable?: boolean;
  is_filterable?: boolean;
  is_reportable?: boolean;
  visible_to_roles?: string[];
  created_at: string;
}

export interface DropdownOptionConfig {
  id: string;
  category:
    | 'Enquiry Source'
    | 'Customer Industry'
    | 'Customer Type'
    | 'Payment Mode'
    | 'Project Room Type'
    | 'Department'
    | 'Designation'
    | 'Lead Source';
  label: string;
  value: string;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
}


