import type {
  AuditLog,
  Dispatch,
  Enquiry,
  EquipmentRental,
  Invoice,
  Payment,
  Product,
  Quotation,
  SalesOrder,
  ServiceTicket,
  Supplier,
  UserStaff,
} from '@/types/erp';
import type { Customer } from '@/types/customer';

// UAT-only fallback data. All values are synthetic and use non-routable emails.
export const STAFF_MEMBERS: UserStaff[] = [
  {
    id: 'UAT-USER-SALES-001',
    name: 'UAT Test Sales User 001',
    email: 'sales001@example.invalid',
    role: 'Sales Executive',
    phone: '0000000000',
    canViewCosts: false,
    canApprove: false,
    canManageUsers: false,
    canManageAccounts: false,
  },
  {
    id: 'UAT-USER-BDM-001',
    name: 'Synthetic BDM Lead (UAT)',
    email: 'bdm-uat@example.invalid',
    role: 'BDM',
    phone: '0000000000',
    canViewCosts: true,
    canApprove: true,
    canManageUsers: false,
    canManageAccounts: false,
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'UAT-CUSTOMER-001',
    customer_code: 'UAT-C001',
    customer_type: 'COMPANY',
    customer_name: 'UAT Demo Customer 001',
    company_name: 'UAT Demo Customer 001',
    contact_person: 'UAT Contact 001',
    designation: 'Test Contact',
    phone: '0000000000',
    alternate_phone: null,
    email: 'customer001@example.invalid',
    billing_address: 'UAT / TEST ONLY',
    shipping_address: 'UAT / TEST ONLY',
    city: 'Test City',
    state: 'Test State',
    state_code: '00',
    pincode: '000000',
    gstin: null,
    pan: null,
    credit_limit: 0,
    enquiry_source: 'UAT TEST',
    salesperson_id: null,
    status: 'ACTIVE',
    notes: 'Synthetic UAT-only fallback record.',
    created_by: null,
    updated_by: null,
    created_at: '2026-09-30T00:00:00.000Z',
    updated_at: '2026-09-30T00:00:00.000Z',
  },
];

export const DISCOUNT_APPROVAL_RULES: any[] = [];
export const PRODUCT_CATEGORIES = [
  { id: 'UAT-CAT-IT', name: 'UAT Test IT', description: 'Synthetic UAT category', is_active: true },
  { id: 'UAT-CAT-AV', name: 'UAT Test AV', description: 'Synthetic UAT category', is_active: true },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'UAT-PRODUCT-LAPTOP-001',
    sku: 'UAT-LAPTOP-001',
    name: 'UAT Test Laptop',
    category_id: 'UAT-CAT-IT',
    category_name: 'UAT Test IT',
    brand_name: 'UAT TEST',
    model_name: 'UAT-LAPTOP-001',
    description: 'Synthetic UAT-only product.',
    unit: 'Nos.',
    hsn_sac: 'UAT-TEST',
    gst_rate: 18,
    purchase_price: 0,
    selling_price: 0,
    mrp: 0,
    target_margin_pct: 0,
    current_stock: 0,
    reorder_level: 0,
    is_serialized: false,
    is_service: false,
    is_active: true,
    created_at: '2026-09-30T00:00:00.000Z',
  },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'UAT-SUPPLIER-001',
    supplier_code: 'UAT-S001',
    supplier_name: 'UAT Demo Supplier',
    contact_person: 'UAT Supplier Contact',
    phone: '0000000000',
    email: 'supplier001@example.invalid',
    address: 'UAT / TEST ONLY',
    city: 'Test City',
    state: 'Test State',
    gstin: null,
    pan: null,
    is_active: true,
  } as unknown as Supplier,
];

export const INITIAL_ENQUIRIES: Enquiry[] = [];
export const INITIAL_QUOTATIONS: Quotation[] = [];
export const INITIAL_ORDERS: SalesOrder[] = [];
export const INITIAL_INVOICES: Invoice[] = [];
export const INITIAL_PAYMENTS: Payment[] = [];
export const INITIAL_DISPATCHES: Dispatch[] = [];
export const INITIAL_SERVICE_TICKETS: ServiceTicket[] = [];
export const INITIAL_RENTALS: EquipmentRental[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
export const SOLUTION_BUNDLES: any[] = [];
