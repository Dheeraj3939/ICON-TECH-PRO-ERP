import type { AppRole, ManagedUser, RolePermissionMatrix, ERPModule, PermissionAction } from '@/types/rbac';
import { ALL_ERP_MODULES, ALL_PERMISSION_ACTIONS } from '@/types/rbac';

export const INITIAL_ROLES: AppRole[] = [
  {
    id: 'ROLE_MD',
    role_name: 'Managing Director',
    description: 'Executive leadership with unrestricted commercial and administrative override authority.',
    is_system: true,
    user_count: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ROLE_ADMIN',
    role_name: 'Admin / BDM',
    description: 'System administrator and senior business development manager with full operational control.',
    is_system: true,
    user_count: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ROLE_BDM',
    role_name: 'BDM',
    description: 'Corporate business development manager handling enterprise accounts and Tier 2 approvals.',
    is_system: true,
    user_count: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ROLE_SALES',
    role_name: 'Sales Executive',
    description: 'Field sales executive managing client leads, product presentations, and initial quotations.',
    is_system: true,
    user_count: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ROLE_ACCOUNTS',
    role_name: 'Accounts',
    description: 'Finance manager managing tax invoicing, payment receipts, GST compliance, and reconciliations.',
    is_system: true,
    user_count: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ROLE_ASSISTANT',
    role_name: 'Office Assistant',
    description: 'Operations and service coordinator managing material dispatches, installations, and job cards.',
    is_system: true,
    user_count: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
];

export const INITIAL_MANAGED_USERS: ManagedUser[] = [
  {
    id: 'USR001',
    name: 'B V Dheeraj Reddy',
    email: 'dheeraj@icontechpro.in',
    phone: '+91 80999 09921',
    role: 'Admin / BDM',
    status: 'ACTIVE',
    can_login: true,
    department: 'Administration & Sales',
    designation: 'Sales Executive / Admin',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'USR002',
    name: 'Borra Narsimulu',
    email: 'icontechpro@gmail.com',
    phone: '+91 80999 09997',
    role: 'Managing Director',
    status: 'ACTIVE',
    can_login: true,
    department: 'Executive Management',
    designation: 'Managing Director',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'USR003',
    name: 'B Vineet Babu',
    email: 'vineet@icontechpro.in',
    phone: '+91 80999 09918',
    role: 'Sales Executive',
    status: 'ACTIVE',
    can_login: true,
    department: 'Corporate Sales',
    designation: 'Sales Executive',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'USR004',
    name: 'Reshma',
    email: 'sales@icontechpro.in',
    phone: '+91 7569909997',
    role: 'Sales Executive',
    status: 'ACTIVE',
    can_login: true,
    department: 'Sales',
    designation: 'Sales Executive',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'USR005',
    name: 'Hemalath',
    email: 'accounts@icontechpro.in',
    phone: '+91 8099909920',
    role: 'Accounts',
    status: 'ACTIVE',
    can_login: true,
    department: 'Finance & Accounts',
    designation: 'Accounts',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'USR006',
    name: 'Manisha',
    email: 'service01@icontechpro.in',
    phone: '+91 8099909914',
    role: 'Office Assistant',
    status: 'ACTIVE',
    can_login: true,
    department: 'Office Administration',
    designation: 'Office Assistant',
    created_at: '2026-01-01T00:00:00Z',
  },
];

// Helper to construct full matrix
function buildDefaultMatrix(): RolePermissionMatrix {
  const matrix: RolePermissionMatrix = {} as RolePermissionMatrix;

  for (const role of INITIAL_ROLES) {
    matrix[role.role_name] = {} as Record<ERPModule, Record<PermissionAction, boolean>>;
    for (const mod of ALL_ERP_MODULES) {
      matrix[role.role_name][mod] = {
        view: false,
        create: false,
        edit: false,
        delete: false,
        approve: false,
        export: false,
      };
    }
  }

  // 1. Managing Director has unrestricted full permissions
  for (const mod of ALL_ERP_MODULES) {
    for (const act of ALL_PERMISSION_ACTIONS) {
      matrix['Managing Director'][mod][act] = true;
    }
  }

  // 2. Admin / BDM has full permissions across all operational and admin modules
  for (const mod of ALL_ERP_MODULES) {
    for (const act of ALL_PERMISSION_ACTIONS) {
      matrix['Admin / BDM'][mod][act] = true;
    }
  }

  // 3. BDM
  const bdmModules: ERPModule[] = [
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
    'Dispatch & Challans',
    'Installations',
    'Reports',
  ];
  for (const mod of bdmModules) {
    matrix['BDM'][mod].view = true;
    matrix['BDM'][mod].create = true;
    matrix['BDM'][mod].edit = true;
    matrix['BDM'][mod].export = true;
  }
  matrix['BDM']['Quotations'].approve = true;
  matrix['BDM']['Sales Orders'].approve = true;

  // 4. Sales Executive
  const salesModules: ERPModule[] = [
    'Dashboard',
    'Enquiries / Leads',
    'Customers',
    'Site Visits',
    'Follow-ups',
    'Quotations',
    'Product Catalog',
    'Inventory & Serials',
    'Dispatch & Challans',
  ];
  for (const mod of salesModules) {
    matrix['Sales Executive'][mod].view = true;
    if (['Enquiries / Leads', 'Customers', 'Site Visits', 'Follow-ups', 'Quotations'].includes(mod)) {
      matrix['Sales Executive'][mod].create = true;
      matrix['Sales Executive'][mod].edit = true;
      matrix['Sales Executive'][mod].export = true;
    }
  }

  // 5. Accounts
  const accountsModules: ERPModule[] = [
    'Dashboard',
    'Customers',
    'Quotations',
    'Sales Orders',
    'Invoices & Billing',
    'Payments',
    'Purchases',
    'Product Catalog',
    'Inventory & Serials',
    'Reports',
  ];
  for (const mod of accountsModules) {
    matrix['Accounts'][mod].view = true;
    matrix['Accounts'][mod].export = true;
    if (['Invoices & Billing', 'Payments', 'Purchases'].includes(mod)) {
      matrix['Accounts'][mod].create = true;
      matrix['Accounts'][mod].edit = true;
      matrix['Accounts'][mod].approve = true;
    }
  }

  // 6. Office Assistant
  const assistantModules: ERPModule[] = [
    'Dashboard',
    'Enquiries / Leads',
    'Customers',
    'Site Visits',
    'Follow-ups',
    'Product Catalog',
    'Inventory & Serials',
    'Dispatch & Challans',
    'Installations',
  ];
  for (const mod of assistantModules) {
    matrix['Office Assistant'][mod].view = true;
    if (['Dispatch & Challans', 'Installations', 'Site Visits', 'Follow-ups', 'Enquiries / Leads'].includes(mod)) {
      matrix['Office Assistant'][mod].create = true;
      matrix['Office Assistant'][mod].edit = true;
    }
  }

  return matrix;
}

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMatrix = buildDefaultMatrix();
