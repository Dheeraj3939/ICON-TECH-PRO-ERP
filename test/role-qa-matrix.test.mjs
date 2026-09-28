import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper: role simulation and permission check definitions
const ROLE_PERMISSIONS = {
  'Managing Director': {
    canViewCosts: true,
    canViewMargins: true,
    canApproveDiscounts: true,
    canAccessFinance: true,
    canAccessTally: true,
    canAccessAuditLogs: true,
    canManageUsers: true,
    allowedModules: [
      'DASHBOARD', 'CUSTOMERS', 'ENQUIRIES', 'QUOTATIONS', 'ORDERS',
      'PURCHASES', 'INVENTORY', 'DISPATCH', 'INSTALLATIONS', 'INVOICES',
      'PAYMENTS', 'REPORTS', 'COMMUNICATION', 'TALLY', 'AUDIT', 'SETTINGS'
    ],
  },
  'Admin / BDM': {
    canViewCosts: true,
    canViewMargins: true,
    canApproveDiscounts: true,
    canAccessFinance: true,
    canAccessTally: false,
    canAccessAuditLogs: true,
    canManageUsers: true,
    allowedModules: [
      'DASHBOARD', 'CUSTOMERS', 'ENQUIRIES', 'QUOTATIONS', 'ORDERS',
      'PURCHASES', 'INVENTORY', 'DISPATCH', 'INSTALLATIONS', 'INVOICES',
      'PAYMENTS', 'REPORTS', 'COMMUNICATION', 'SETTINGS'
    ],
  },
  'BDM': {
    canViewCosts: false,
    canViewMargins: true,
    canApproveDiscounts: true,
    canAccessFinance: false,
    canAccessTally: false,
    canAccessAuditLogs: false,
    canManageUsers: false,
    allowedModules: [
      'DASHBOARD', 'CUSTOMERS', 'ENQUIRIES', 'QUOTATIONS', 'ORDERS',
      'DISPATCH', 'INSTALLATIONS', 'REPORTS', 'COMMUNICATION'
    ],
  },
  'Sales Executive': {
    canViewCosts: false,
    canViewMargins: false,
    canApproveDiscounts: false,
    canAccessFinance: false,
    canAccessTally: false,
    canAccessAuditLogs: false,
    canManageUsers: false,
    allowedModules: [
      'DASHBOARD', 'CUSTOMERS', 'ENQUIRIES', 'QUOTATIONS', 'ORDERS',
      'DISPATCH', 'INSTALLATIONS', 'COMMUNICATION'
    ],
  },
  'Accounts': {
    canViewCosts: true,
    canViewMargins: true,
    canApproveDiscounts: false,
    canAccessFinance: true,
    canAccessTally: true,
    canAccessAuditLogs: true,
    canManageUsers: false,
    allowedModules: [
      'DASHBOARD', 'CUSTOMERS', 'INVOICES', 'PAYMENTS', 'PURCHASES',
      'TALLY', 'REPORTS', 'COMMUNICATION'
    ],
  },
  'Office Assistant': {
    canViewCosts: false,
    canViewMargins: false,
    canApproveDiscounts: false,
    canAccessFinance: false,
    canAccessTally: false,
    canAccessAuditLogs: false,
    canManageUsers: false,
    allowedModules: [
      'DASHBOARD', 'CUSTOMERS', 'ENQUIRIES', 'DISPATCH', 'INSTALLATIONS'
    ],
  },
};

// Helper: sanitize product purchase price based on role
function sanitizeProductForRole(product, role) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms || !perms.canViewCosts) {
    return {
      ...product,
      purchase_price: 0,
      margin_pct: 0,
      target_margin_pct: 0,
    };
  }
  return product;
}

// Helper: quotation send validation guard
function validateQuotationSend(quotation, channel) {
  if (!quotation.previewed_at) {
    return { allowed: false, error: 'Quotation PDF must be previewed before dispatch.' };
  }
  if (!quotation.approved_at || quotation.status !== 'Approved') {
    return { allowed: false, error: 'Quotation must be verified and approved before dispatch.' };
  }
  return { allowed: true, channel };
}

describe('Master Role QA Matrix — All 6 Roles (ALLOW and DENY Cases)', () => {
  const sampleProduct = {
    id: 'PROD-001',
    sku: 'PROJ-OPT-4K',
    name: 'Optoma 4K UHD High-Lumen Laser Projector',
    purchase_price: 95000,
    selling_price: 120000,
    margin_pct: 20.8,
  };

  it('Role 1: Managing Director (Narsimha Naidu) — Full Executive Access', () => {
    const md = ROLE_PERMISSIONS['Managing Director'];
    assert.equal(md.canViewCosts, true, 'MD must view purchase costs');
    assert.equal(md.canViewMargins, true, 'MD must view gross margins');
    assert.equal(md.canApproveDiscounts, true, 'MD must approve commercial discounts');
    assert.equal(md.canAccessFinance, true, 'MD must view financial ledgers');
    assert.equal(md.canAccessTally, true, 'MD must access Tally integration');
    assert.equal(md.canAccessAuditLogs, true, 'MD must view security audit logs');

    const sanitized = sanitizeProductForRole(sampleProduct, 'Managing Director');
    assert.equal(sanitized.purchase_price, 95000, 'MD sees real purchase price');
  });

  it('Role 2: Admin / BDM (Dheeraj) — Sales, Ops & User Management', () => {
    const admin = ROLE_PERMISSIONS['Admin / BDM'];
    assert.equal(admin.canViewCosts, true, 'Admin/BDM views purchase cost for operations');
    assert.equal(admin.canApproveDiscounts, true, 'Admin/BDM has discount approval authority');
    assert.equal(admin.canManageUsers, true, 'Admin/BDM can manage users & staff');
    assert.equal(admin.allowedModules.includes('SETTINGS'), true, 'Admin/BDM accesses settings');
    assert.equal(admin.canAccessTally, false, 'Admin/BDM denies direct Tally books modification');
  });

  it('Role 3: BDM (Vineet Babu) — Commercial Proposals without Raw Cost', () => {
    const bdm = ROLE_PERMISSIONS['BDM'];
    assert.equal(bdm.canViewCosts, false, 'BDM is DENIED raw purchase cost to protect vendor privacy');
    assert.equal(bdm.canViewMargins, true, 'BDM can view margin percentage');
    assert.equal(bdm.canApproveDiscounts, true, 'BDM can approve standard commercial discounts');
    assert.equal(bdm.canManageUsers, false, 'BDM is DENIED user administration');

    const sanitized = sanitizeProductForRole(sampleProduct, 'BDM');
    assert.equal(sanitized.purchase_price, 0, 'Purchase price is masked to 0 for BDM');
  });

  it('Role 4: Sales Executive (Reshma) — Strict Privacy & Cost Masking', () => {
    const sales = ROLE_PERMISSIONS['Sales Executive'];
    assert.equal(sales.canViewCosts, false, 'Sales Executive is strictly DENIED purchase costs');
    assert.equal(sales.canViewMargins, false, 'Sales Executive is strictly DENIED internal margins');
    assert.equal(sales.canApproveDiscounts, false, 'Sales Executive CANNOT approve discounts');
    assert.equal(sales.canAccessFinance, false, 'Sales Executive is DENIED finance ledgers');

    const sanitized = sanitizeProductForRole(sampleProduct, 'Sales Executive');
    assert.equal(sanitized.purchase_price, 0, 'Cost masked to 0 for Sales Executive');
    assert.equal(sanitized.margin_pct, 0, 'Margin masked to 0 for Sales Executive');
  });

  it('Role 5: Accounts (Hemalatha) — Financial Ledgers & Tally Reconciliation', () => {
    const accounts = ROLE_PERMISSIONS['Accounts'];
    assert.equal(accounts.canAccessFinance, true, 'Accounts has full access to finance ledgers');
    assert.equal(accounts.canAccessTally, true, 'Accounts accesses Tally Integration Center');
    assert.equal(accounts.canViewCosts, true, 'Accounts must verify supplier invoices & costs');
    assert.equal(accounts.canManageUsers, false, 'Accounts is DENIED user administration');
    assert.equal(accounts.canApproveDiscounts, false, 'Accounts CANNOT approve commercial discounts');
  });

  it('Role 6: Office Assistant (Manisha) — Permitted Operations Only', () => {
    const assistant = ROLE_PERMISSIONS['Office Assistant'];
    assert.equal(assistant.canViewCosts, false, 'Office Assistant is strictly DENIED purchase costs');
    assert.equal(assistant.canViewMargins, false, 'Office Assistant is strictly DENIED margin data');
    assert.equal(assistant.canAccessFinance, false, 'Office Assistant is DENIED finance ledgers');
    assert.equal(assistant.canAccessTally, false, 'Office Assistant is DENIED Tally center');
    assert.equal(assistant.canManageUsers, false, 'Office Assistant is DENIED user admin');
    assert.equal(assistant.allowedModules.includes('DISPATCH'), true, 'Office Assistant ALLOWED dispatch');
    assert.equal(assistant.allowedModules.includes('INSTALLATIONS'), true, 'Office Assistant ALLOWED installations');

    const sanitized = sanitizeProductForRole(sampleProduct, 'Office Assistant');
    assert.equal(sanitized.purchase_price, 0, 'Cost masked to 0 for Office Assistant');
  });
});

describe('Quotation Workflow & Mandatory Review Gate Invariants', () => {
  it('Blocks dispatch when quotation has NOT been previewed', () => {
    const unpreviewedQuote = {
      id: 'QT-101',
      status: 'Draft',
      previewed_at: undefined,
      approved_at: undefined,
    };
    const check = validateQuotationSend(unpreviewedQuote, 'EMAIL');
    assert.equal(check.allowed, false);
    assert.match(check.error, /previewed before dispatch/i);
  });

  it('Blocks dispatch when quotation is previewed but NOT verified/approved', () => {
    const previewedUnapprovedQuote = {
      id: 'QT-101',
      status: 'Draft',
      previewed_at: '2026-09-15T12:00:00Z',
      approved_at: undefined,
    };
    const check = validateQuotationSend(previewedUnapprovedQuote, 'EMAIL');
    assert.equal(check.allowed, false);
    assert.match(check.error, /verified and approved/i);
  });

  it('ALLOWS dispatch when quotation has both preview and approval recorded', () => {
    const approvedQuote = {
      id: 'QT-101',
      status: 'Approved',
      previewed_at: '2026-09-15T12:00:00Z',
      approved_at: '2026-09-15T12:05:00Z',
    };
    const emailCheck = validateQuotationSend(approvedQuote, 'EMAIL');
    assert.equal(emailCheck.allowed, true);
    assert.equal(emailCheck.channel, 'EMAIL');

    const whatsappCheck = validateQuotationSend(approvedQuote, 'WHATSAPP');
    assert.equal(whatsappCheck.allowed, true);
    assert.equal(whatsappCheck.channel, 'WHATSAPP');
  });
});
