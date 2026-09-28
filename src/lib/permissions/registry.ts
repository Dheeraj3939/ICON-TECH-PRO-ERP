import type { ControlledModuleDefinition, ERPModule, PermissionAction } from '@/types/rbac';
import { ALL_PERMISSION_ACTIONS } from '@/types/rbac';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_CONTROLLED_MODULES__: ControlledModuleDefinition[] | undefined;
}

export const SYSTEM_CONTROLLED_MODULES: ControlledModuleDefinition[] = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    label: 'Executive Dashboard',
    category: 'CORE',
    route: '/dashboard',
    iconName: 'LayoutDashboard',
    description: 'Executive overview, key performance metrics, and operational summaries.',
    defaultActions: ['view'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'customers',
    name: 'Customers',
    label: 'Customer Master & 360',
    category: 'CORE',
    route: '/dashboard/customers',
    iconName: 'Users',
    description: 'Corporate client database, Customer 360 dossiers, and credit limits.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'enquiries',
    name: 'Enquiries / Leads',
    label: 'Enquiries & Leads',
    category: 'CORE',
    route: '/dashboard/enquiries',
    iconName: 'FileText',
    description: 'Inbound sales leads, AV project requirements, and lead tracking.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'follow-ups',
    name: 'Follow-ups',
    label: 'Client Follow-ups',
    category: 'CORE',
    route: '/dashboard/follow-ups',
    iconName: 'PhoneCall',
    description: 'Scheduled touchpoints, client calls, and meeting logs.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'site-visits',
    name: 'Site Visits',
    label: 'Site Surveys & Feasibility',
    category: 'CORE',
    route: '/dashboard/site-visits',
    iconName: 'Calendar',
    description: 'Physical site surveys, measurement logs, and acoustic feasibility.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'projects',
    name: 'Projects',
    label: 'Integrated AV Projects',
    category: 'CORE',
    route: '/dashboard/projects',
    iconName: 'Briefcase',
    description: 'Turnkey AV integration projects, milestones, and deliverables.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'quotations',
    name: 'Quotations',
    label: 'Commercial Quotations',
    category: 'SALES',
    route: '/dashboard/quotations',
    iconName: 'FileSpreadsheet',
    description: 'Formal AV proposals, pricing calculations, revisions, and approval workflows.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'sales-orders',
    name: 'Sales Orders',
    label: 'Confirmed Sales Orders',
    category: 'SALES',
    route: '/dashboard/sales-orders',
    iconName: 'ShoppingBag',
    description: 'Customer purchase orders, confirmed project orders, and order tracking.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'invoices',
    name: 'Invoices & Billing',
    label: 'GST Invoicing & Billing',
    category: 'SALES',
    route: '/dashboard/invoices',
    iconName: 'CreditCard',
    description: 'GST tax invoices, advance billing, credit notes, and E-Way bills.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'purchases',
    name: 'Purchases',
    label: 'Procurement & Vendor POs',
    category: 'PROCUREMENT',
    route: '/dashboard/purchases',
    iconName: 'Truck',
    description: 'Order-driven distributor procurement, purchase orders, and supplier invoice verification.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    isSystem: true,
    requiresSpecialAuthorization: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'products',
    name: 'Product Catalog',
    label: 'Equipment & Product Catalog',
    category: 'INVENTORY',
    route: '/dashboard/products',
    iconName: 'Package',
    description: 'AV hardware specifications, OEM brand database, HSN codes, and MSRP lists.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'inventory',
    name: 'Inventory & Serials',
    label: 'Warehouse & Serial Tracking',
    category: 'INVENTORY',
    route: '/dashboard/inventory',
    iconName: 'Boxes',
    description: 'Warehouse locations, serial number ledgers, and transit stock.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'dispatch',
    name: 'Dispatch & Challans',
    label: 'Dispatch & Delivery Challans',
    category: 'INVENTORY',
    route: '/dashboard/dispatch',
    iconName: 'Send',
    description: 'Material gate passes, delivery challans, and site receipt acknowledgments.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'service',
    name: 'Service & AMC',
    label: 'Service & AMC Contracts',
    category: 'SERVICE',
    route: '/dashboard/service',
    iconName: 'Wrench',
    description: 'Annual Maintenance Contracts, breakdown service tickets, and job cards.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'rental',
    name: 'Equipment Rental',
    label: 'AV Equipment Rental',
    category: 'SERVICE',
    route: '/dashboard/rental',
    iconName: 'Repeat',
    description: 'Temporary event rentals, staging gear, and rental agreements.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'installations',
    name: 'Installations',
    label: 'Installation & Commissioning',
    category: 'SERVICE',
    route: '/dashboard/installations',
    iconName: 'Sparkles',
    description: 'Site engineer deployment, handover sign-offs, and commissioning notes.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'employees',
    name: 'HR & Employees',
    label: 'Staff Directory & HR',
    category: 'PEOPLE',
    route: '/dashboard/employees',
    iconName: 'Users',
    description: 'Employee directory, profiles, onboarding, and emergency contacts.',
    defaultActions: ['view', 'create', 'edit', 'delete', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'attendance',
    name: 'Attendance & Time',
    label: 'Attendance & Site Duty',
    category: 'PEOPLE',
    route: '/dashboard/employees/attendance',
    iconName: 'Clock',
    description: 'Office check-in, site duty tracking, and attendance logs.',
    defaultActions: ['view', 'create', 'edit', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'payroll',
    name: 'Payroll & Compensation',
    label: 'Salary & Compensation',
    category: 'PEOPLE',
    route: '/dashboard/employees/payroll',
    iconName: 'CreditCard',
    description: 'Confidential staff compensation, payslip generation, and tax deductions.',
    defaultActions: ['view', 'create', 'edit', 'export'],
    isSystem: true,
    requiresSpecialAuthorization: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'reports',
    name: 'Reports',
    label: 'Reports & Analytics',
    category: 'ANALYTICS',
    route: '/dashboard/reports',
    iconName: 'BarChart3',
    description: 'Sales performance, financial margins, inventory aging, and executive analytics.',
    defaultActions: ['view', 'export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'settings-users',
    name: 'User Management',
    label: 'Employee User Management',
    category: 'ADMIN',
    route: '/dashboard/settings/users',
    iconName: 'Users',
    description: 'ERP user account provisioning, lifecycle status, and login access.',
    defaultActions: ['view', 'create', 'edit', 'delete'],
    isSystem: true,
    requiresSpecialAuthorization: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'settings-roles',
    name: 'Role & Permission Management',
    label: 'Role & Access Control',
    category: 'ADMIN',
    route: '/dashboard/settings/roles',
    iconName: 'Shield',
    description: 'Role permission matrices, custom role templates, and access rights.',
    defaultActions: ['view', 'create', 'edit', 'delete'],
    isSystem: true,
    requiresSpecialAuthorization: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    key: 'settings-core',
    name: 'System Settings',
    label: 'Administration Center',
    category: 'ADMIN',
    route: '/dashboard/settings',
    iconName: 'Settings',
    description: 'Centralized administration, custom taxonomy, dropdowns, and governance.',
    defaultActions: ['view', 'edit'],
    isSystem: true,
    requiresSpecialAuthorization: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

function getControlledStore(): ControlledModuleDefinition[] {
  if (!globalThis.__ICON_CONTROLLED_MODULES__) {
    globalThis.__ICON_CONTROLLED_MODULES__ = [...SYSTEM_CONTROLLED_MODULES];
  }
  return globalThis.__ICON_CONTROLLED_MODULES__;
}

export function getControlledModules(): ControlledModuleDefinition[] {
  return [...getControlledStore()];
}

export function getControlledModuleByKey(key: string): ControlledModuleDefinition | undefined {
  const store = getControlledStore();
  return store.find((m) => m.key.toLowerCase() === key.toLowerCase() || m.name.toLowerCase() === key.toLowerCase());
}

export function getControlledModuleByName(name: ERPModule): ControlledModuleDefinition | undefined {
  const store = getControlledStore();
  return store.find((m) => m.name.toLowerCase() === name.toLowerCase());
}

/**
 * Register a controlled future module into the ERP registry.
 * Validates strictly: no arbitrary execution, unique key, structured metadata.
 */
export function registerControlledModule(
  payload: Omit<ControlledModuleDefinition, 'isSystem' | 'createdAt'>
): { success: boolean; data?: ControlledModuleDefinition; error?: string } {
  const store = getControlledStore();

  const cleanKey = payload.key.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!cleanKey || cleanKey.length < 2 || cleanKey.length > 50) {
    return { success: false, error: 'Module key must be 2 to 50 alphanumeric/hyphen characters.' };
  }

  if (store.some((m) => m.key.toLowerCase() === cleanKey || m.name.toLowerCase() === payload.name.toLowerCase())) {
    return { success: false, error: `Module "${cleanKey}" or "${payload.name}" already exists in the registry.` };
  }

  const newModule: ControlledModuleDefinition = {
    key: cleanKey,
    name: payload.name,
    label: payload.label.trim(),
    category: payload.category || 'CUSTOM',
    route: payload.route.startsWith('/') ? payload.route : `/${payload.route}`,
    iconName: payload.iconName || 'Package',
    description: payload.description.trim(),
    defaultActions: payload.defaultActions && payload.defaultActions.length > 0 ? payload.defaultActions : [...ALL_PERMISSION_ACTIONS],
    isSystem: false,
    requiresSpecialAuthorization: Boolean(payload.requiresSpecialAuthorization),
    isControlledFutureModule: true,
    createdAt: new Date().toISOString(),
  };

  store.push(newModule);
  return { success: true, data: newModule };
}

/**
 * Unregister a controlled custom/future module.
 * System modules cannot be unregistered.
 */
export function unregisterControlledModule(key: string): { success: boolean; error?: string } {
  const store = getControlledStore();
  const idx = store.findIndex((m) => m.key.toLowerCase() === key.toLowerCase() || m.name.toLowerCase() === key.toLowerCase());
  if (idx === -1) {
    return { success: false, error: `Module "${key}" not found in registry.` };
  }

  const target = store[idx];
  if (target.isSystem) {
    return { success: false, error: `Cannot unregister system module "${target.name}".` };
  }

  store.splice(idx, 1);
  return { success: true };
}
