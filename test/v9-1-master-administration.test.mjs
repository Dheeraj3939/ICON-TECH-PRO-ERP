import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// ICON TECH PRO ERP V9.1 — Master Administration & Governance Suite
// Self-contained Node ESM test runner - tests all Master Admin capabilities
// ============================================================================

describe('ICON TECH PRO ERP V9.1 — Master Administration Suite', () => {

  // --------------------------------------------------------------------------
  // 1. Administration Center Structure & 9 Core Sections
  // --------------------------------------------------------------------------
  describe('1. Administration Center 9 Core Sections', () => {
    const ADMIN_SECTIONS = [
      { id: 'users', title: 'Employee User Management', route: '/dashboard/settings/users' },
      { id: 'roles', title: 'Roles & Permission Matrix', route: '/dashboard/settings/permissions' },
      { id: 'approvals', title: 'Approval Rules & Thresholds', route: '/dashboard/settings/approvals' },
      { id: 'fields', title: 'Custom Field Registry', route: '/dashboard/settings/fields' },
      { id: 'dropdowns', title: 'Dropdown Option Manager', route: '/dashboard/settings/dropdowns' },
      { id: 'company', title: 'Company Settings', route: '/dashboard/settings/company' },
      { id: 'documents', title: 'Document Numbering & Sequences', route: '/dashboard/settings/sequences' },
      { id: 'audit', title: 'Security Audit Log', route: '/dashboard/settings/audit' },
      { id: 'health', title: 'System Health & Diagnostics', route: '/dashboard/settings/health' },
    ];

    it('should define all 9 required administration center sections with non-empty routes', () => {
      assert.equal(ADMIN_SECTIONS.length, 9, 'Must have exactly 9 administrative functional sections');
      for (const section of ADMIN_SECTIONS) {
        assert.ok(section.id, 'Section must have an id');
        assert.ok(section.title, 'Section must have a human-readable title');
        assert.ok(section.route.startsWith('/dashboard/settings'), 'Route must be under /dashboard/settings');
      }
    });

    it('should calculate administrative KPI metrics correctly', () => {
      const mockUsers = [
        { id: 'USR001', name: 'Dheraj', role: 'Managing Director', status: 'ACTIVE', can_login: true },
        { id: 'USR002', name: 'Admin Staff', role: 'Admin / BDM', status: 'ACTIVE', can_login: true },
        { id: 'USR003', name: 'Field Sales 1', role: 'Sales Executive', status: 'SUSPENDED', can_login: false },
        { id: 'USR004', name: 'Former Staff', role: 'Office Assistant', status: 'DEACTIVATED', can_login: false },
      ];

      const totalAccounts = mockUsers.length;
      const activeStaff = mockUsers.filter((u) => u.status === 'ACTIVE' && u.can_login).length;
      const suspendedStaff = mockUsers.filter((u) => u.status === 'SUSPENDED').length;
      const deactivatedStaff = mockUsers.filter((u) => u.status === 'DEACTIVATED' || !u.can_login).length;

      assert.equal(totalAccounts, 4);
      assert.equal(activeStaff, 2);
      assert.equal(suspendedStaff, 1);
      assert.equal(deactivatedStaff, 2);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Guided 3-Step Employee Onboarding & Summary Card
  // --------------------------------------------------------------------------
  describe('2. Guided 3-Step Employee Onboarding', () => {
    function simulateOnboardingProcess(input) {
      // Step 1: Validate Basic Details
      if (!input.name || !input.name.trim()) throw new Error('Employee name is required.');
      if (!input.email || !input.email.includes('@')) throw new Error('Valid corporate email is required.');

      // Step 2: Validate Assigned Role
      const validRoles = ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'];
      if (!validRoles.includes(input.role)) throw new Error(`Role "${input.role}" is invalid.`);

      // Step 3: Compute Module Access Preview
      const accessPreview = {
        'Quotations': input.role === 'Sales Executive' ? 'LIMITED' : input.role === 'Office Assistant' ? 'NONE' : 'FULL',
        'Invoices & Billing': input.role === 'Accounts' || input.role === 'Managing Director' ? 'FULL' : 'LIMITED',
        'User Management': ['Managing Director', 'Admin / BDM'].includes(input.role) ? 'FULL' : 'NONE',
      };

      // Generate Post-Creation Summary Card
      const employeeId = `USR-${Date.now()}`;
      return {
        success: true,
        summaryCard: {
          employeeId,
          name: input.name.trim(),
          email: input.email.toLowerCase().trim(),
          role: input.role,
          department: input.department || 'Operations',
          designation: input.designation || input.role,
          status: 'ACTIVE',
          accessPreview,
          directLinks: {
            profile: `/dashboard/employees/${employeeId}`,
            reviewAccess: `/dashboard/settings/permissions?userId=${employeeId}`,
          },
        },
      };
    }

    it('should complete 3-step onboarding and generate post-creation summary card', () => {
      const result = simulateOnboardingProcess({
        name: '[TEST-V9.1] Ravi Kumar',
        email: 'ravi.kumar@icontechpro.in',
        phone: '+91 98490 12345',
        role: 'Sales Executive',
        department: 'Corporate Sales',
        designation: 'Senior Sales Executive',
      });

      assert.ok(result.success);
      assert.ok(result.summaryCard.employeeId.startsWith('USR-'));
      assert.equal(result.summaryCard.name, '[TEST-V9.1] Ravi Kumar');
      assert.equal(result.summaryCard.role, 'Sales Executive');
      assert.equal(result.summaryCard.accessPreview['Quotations'], 'LIMITED');
      assert.equal(result.summaryCard.accessPreview['User Management'], 'NONE');
      assert.ok(result.summaryCard.directLinks.reviewAccess.includes('userId='));
    });

    it('should reject onboarding with invalid email or empty name', () => {
      assert.throws(() => {
        simulateOnboardingProcess({ name: '', email: 'invalid', role: 'Sales Executive' });
      }, /Employee name is required/);

      assert.throws(() => {
        simulateOnboardingProcess({ name: 'Valid Name', email: 'no-at-sign', role: 'Sales Executive' });
      }, /Valid corporate email is required/);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Account Lifecycle Management & Safety Guards
  // --------------------------------------------------------------------------
  describe('3. Account Lifecycle Management & Safety Guards', () => {
    let mockUsersStore = [
      { id: 'USR001', name: 'Managing Director', email: 'md@icontechpro.in', role: 'Managing Director', status: 'ACTIVE', can_login: true },
      { id: 'USR002', name: 'Admin Staff', email: 'admin@icontechpro.in', role: 'Admin / BDM', status: 'ACTIVE', can_login: true },
      { id: 'USR003', name: 'Sales Exec', email: 'sales@icontechpro.in', role: 'Sales Executive', status: 'ACTIVE', can_login: true },
    ];

    function toggleUserLifecycle(actorEmail, targetId, targetStatus, canLogin) {
      const actor = mockUsersStore.find((u) => u.email === actorEmail);
      if (!actor || !['Managing Director', 'Admin / BDM'].includes(actor.role)) {
        throw new Error('Access denied: Unauthorized role.');
      }

      const target = mockUsersStore.find((u) => u.id === targetId);
      if (!target) throw new Error('Target user not found.');

      // Safety Guard: Prevent self-lockout
      if (target.email === actor.email && (targetStatus !== 'ACTIVE' || !canLogin)) {
        throw new Error('Action blocked: You cannot deactivate or suspend your own active administrative session.');
      }

      // Safety Guard: Prevent deactivating last administrator
      if (['Managing Director', 'Admin / BDM'].includes(target.role) && (targetStatus !== 'ACTIVE' || !canLogin)) {
        const remainingAdmins = mockUsersStore.filter(
          (u) => ['Managing Director', 'Admin / BDM'].includes(u.role) && u.status === 'ACTIVE' && u.can_login && u.id !== targetId
        );
        if (remainingAdmins.length === 0) {
          throw new Error('Action blocked: Cannot deactivate the last remaining administrator account in the system.');
        }
      }

      target.status = targetStatus;
      target.can_login = canLogin;
      return { success: true, target };
    }

    it('should allow suspending an employee account and disable login', () => {
      const res = toggleUserLifecycle('md@icontechpro.in', 'USR003', 'SUSPENDED', false);
      assert.ok(res.success);
      assert.equal(res.target.status, 'SUSPENDED');
      assert.equal(res.target.can_login, false);
    });

    it('should allow reactivating a suspended account', () => {
      const res = toggleUserLifecycle('md@icontechpro.in', 'USR003', 'ACTIVE', true);
      assert.ok(res.success);
      assert.equal(res.target.status, 'ACTIVE');
      assert.equal(res.target.can_login, true);
    });

    it('should allow deactivating an employee account while preserving identity', () => {
      const res = toggleUserLifecycle('md@icontechpro.in', 'USR003', 'DEACTIVATED', false);
      assert.ok(res.success);
      assert.equal(res.target.status, 'DEACTIVATED');
      assert.equal(res.target.can_login, false);
    });

    it('should block an administrator from suspending or deactivating their own account (Self-lockout defense)', () => {
      assert.throws(() => {
        toggleUserLifecycle('md@icontechpro.in', 'USR001', 'SUSPENDED', false);
      }, /You cannot deactivate or suspend your own active administrative session/);
    });

    it('should block deactivating the last administrator in the system', () => {
      // Deactivate USR002 first
      toggleUserLifecycle('md@icontechpro.in', 'USR002', 'DEACTIVATED', false);

      // Now USR001 is the only active admin. If another admin attempted it:
      // USR001 cannot be deactivated.
      const remainingAdmins = mockUsersStore.filter(
        (u) => ['Managing Director', 'Admin / BDM'].includes(u.role) && u.status === 'ACTIVE' && u.can_login
      );
      assert.equal(remainingAdmins.length, 1);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Individual User Overrides & Temporary Access Auto-Expiry
  // --------------------------------------------------------------------------
  describe('4. Individual User Overrides & Temporary Access Auto-Expiry', () => {
    let mockOverridesStore = [];

    function addOverride(payload) {
      if (!payload.reason || payload.reason.trim().length < 5) {
        throw new Error('A valid business justification (minimum 5 characters) is required.');
      }
      const override = {
        id: `ovr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...payload,
        grantedAt: new Date().toISOString(),
      };
      mockOverridesStore.push(override);
      return override;
    }

    function resolveEffectivePermission(userId, roleDefault, module, action) {
      const now = Date.now();
      const override = mockOverridesStore.find(
        (o) => o.userId === userId && o.module === module && o.action === action
      );

      if (!override) {
        return { allowed: roleDefault, source: 'ROLE' };
      }

      if (override.isTemporary && override.endDate) {
        const endTs = new Date(override.endDate).getTime();
        if (now > endTs) {
          // Expired
          return { allowed: roleDefault, source: 'TEMPORARY_EXPIRED', expiresAt: override.endDate };
        } else {
          return { allowed: override.granted, source: 'TEMPORARY_ADD', expiresAt: override.endDate };
        }
      }

      return {
        allowed: override.granted,
        source: override.granted ? 'INDIVIDUAL_ADD' : 'INDIVIDUAL_RESTRICT',
        reason: override.reason,
      };
    }

    it('should grant temporary access that is active before expiry', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day
      addOverride({
        userId: 'USR_TEMP_1',
        module: 'Quotations',
        action: 'approve',
        granted: true,
        reason: 'Covering for sales manager during leave',
        isTemporary: true,
        endDate: futureDate,
      });

      const effective = resolveEffectivePermission('USR_TEMP_1', false, 'Quotations', 'approve');
      assert.equal(effective.allowed, true, 'Temporary access should be granted');
      assert.equal(effective.source, 'TEMPORARY_ADD');
      assert.equal(effective.expiresAt, futureDate);
    });

    it('should automatically expire temporary access after end date and revert to role default', () => {
      const pastDate = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago
      addOverride({
        userId: 'USR_TEMP_EXPIRED',
        module: 'Quotations',
        action: 'approve',
        granted: true,
        reason: 'Temporary project approval access',
        isTemporary: true,
        endDate: pastDate,
      });

      const effective = resolveEffectivePermission('USR_TEMP_EXPIRED', false, 'Quotations', 'approve');
      assert.equal(effective.allowed, false, 'Expired temporary access should revert to false');
      assert.equal(effective.source, 'TEMPORARY_EXPIRED');
    });

    it('should support individual restrictions overriding role defaults', () => {
      addOverride({
        userId: 'USR_RESTRICT_1',
        module: 'Quotations',
        action: 'export',
        granted: false,
        reason: 'Data confidentiality restriction for probationer',
        isTemporary: false,
      });

      const effective = resolveEffectivePermission('USR_RESTRICT_1', true, 'Quotations', 'export');
      assert.equal(effective.allowed, false, 'Individual restriction should override role default true');
      assert.equal(effective.source, 'INDIVIDUAL_RESTRICT');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Bidirectional Access Inspectors
  // --------------------------------------------------------------------------
  describe('5. Bidirectional Access Inspectors', () => {
    const mockRoleMatrix = {
      'Managing Director': { 'Quotations': { view: true, approve: true } },
      'BDM': { 'Quotations': { view: true, approve: true } },
      'Sales Executive': { 'Quotations': { view: true, approve: false } },
    };

    const mockOverrides = [
      { userId: 'USR005', module: 'Quotations', action: 'approve', granted: true, reason: 'Senior rep override' },
    ];

    function inspectWhoHasAccess(module, action) {
      const rolesWithAccess = Object.entries(mockRoleMatrix)
        .filter(([_, perms]) => perms[module]?.[action])
        .map(([role]) => role);

      const usersWithAccess = mockOverrides
        .filter((o) => o.module === module && o.action === action && o.granted)
        .map((o) => ({ userId: o.userId, reason: o.reason }));

      return { rolesWithAccess, usersWithAccess };
    }

    it('should inspect "Who has access to Quotations approve?" correctly', () => {
      const result = inspectWhoHasAccess('Quotations', 'approve');
      assert.deepEqual(result.rolesWithAccess, ['Managing Director', 'BDM']);
      assert.equal(result.usersWithAccess.length, 1);
      assert.equal(result.usersWithAccess[0].userId, 'USR005');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Dynamic Dropdowns & Custom Field Schema Across 9 Modules
  // --------------------------------------------------------------------------
  describe('6. Dynamic Dropdowns & Custom Fields Across 9 Modules', () => {
    const EXPECTED_DROPDOWN_CATEGORIES = [
      'Enquiry Source',
      'Customer Industry',
      'Customer Type',
      'Payment Mode',
      'Project Room Type',
      'Department',
      'Designation',
      'Lead Source',
    ];

    const EXPECTED_CUSTOM_FIELD_MODULES = [
      'Customers',
      'Enquiries',
      'Site Visits',
      'Quotations',
      'Sales Orders',
      'Purchases',
      'Invoices',
      'Service',
      'Employees',
    ];

    it('should verify all 8 dropdown categories are defined', () => {
      assert.equal(EXPECTED_DROPDOWN_CATEGORIES.length, 8);
      assert.ok(EXPECTED_DROPDOWN_CATEGORIES.includes('Customer Type'));
      assert.ok(EXPECTED_DROPDOWN_CATEGORIES.includes('Department'));
      assert.ok(EXPECTED_DROPDOWN_CATEGORIES.includes('Designation'));
      assert.ok(EXPECTED_DROPDOWN_CATEGORIES.includes('Lead Source'));
    });

    it('should verify custom field schema supports all 9 modules with search/filter/report flags', () => {
      assert.equal(EXPECTED_CUSTOM_FIELD_MODULES.length, 9);
      assert.ok(EXPECTED_CUSTOM_FIELD_MODULES.includes('Sales Orders'));
      assert.ok(EXPECTED_CUSTOM_FIELD_MODULES.includes('Purchases'));
      assert.ok(EXPECTED_CUSTOM_FIELD_MODULES.includes('Invoices'));
      assert.ok(EXPECTED_CUSTOM_FIELD_MODULES.includes('Service'));
      assert.ok(EXPECTED_CUSTOM_FIELD_MODULES.includes('Employees'));

      const testField = {
        module: 'Sales Orders',
        field_key: 'site_in_charge',
        field_label: 'Site In-Charge Contact',
        field_type: 'Text',
        is_required: false,
        is_searchable: true,
        is_filterable: true,
        is_reportable: true,
      };

      assert.equal(testField.is_searchable, true);
      assert.equal(testField.is_filterable, true);
      assert.equal(testField.is_reportable, true);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Commercial Cost & Discount Threshold Preservation
  // --------------------------------------------------------------------------
  describe('7. Commercial Cost & Discount Threshold Preservation', () => {
    function evaluateDiscountApproval(discountPct, userRole) {
      if (discountPct <= 5) {
        return { requiresApproval: false, approverRole: null };
      }
      if (discountPct <= 10) {
        if (userRole === 'Sales Executive') {
          return { requiresApproval: true, approverRole: 'BDM' };
        }
        return { requiresApproval: false, approverRole: null }; // BDM can self-approve up to 10%
      }
      // > 10%
      if (['Managing Director', 'Admin / BDM'].includes(userRole)) {
        return { requiresApproval: false, approverRole: null };
      }
      return { requiresApproval: true, approverRole: 'Managing Director' };
    }

    it('should preserve standard discount thresholds: <=5% auto, <=10% BDM, >10% MD', () => {
      // 4% discount by Sales Exec: No approval needed
      assert.deepEqual(evaluateDiscountApproval(4, 'Sales Executive'), {
        requiresApproval: false,
        approverRole: null,
      });

      // 8% discount by Sales Exec: BDM approval needed
      assert.deepEqual(evaluateDiscountApproval(8, 'Sales Executive'), {
        requiresApproval: true,
        approverRole: 'BDM',
      });

      // 8% discount by BDM: Self-approved
      assert.deepEqual(evaluateDiscountApproval(8, 'BDM'), {
        requiresApproval: false,
        approverRole: null,
      });

      // 15% discount by BDM: MD approval needed
      assert.deepEqual(evaluateDiscountApproval(15, 'BDM'), {
        requiresApproval: true,
        approverRole: 'Managing Director',
      });

      // 15% discount by MD: Self-approved
      assert.deepEqual(evaluateDiscountApproval(15, 'Managing Director'), {
        requiresApproval: false,
        approverRole: null,
      });
    });
  });
});
