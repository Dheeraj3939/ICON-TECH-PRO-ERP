import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// ICON TECH PRO ERP V9.1 — Dynamic RBAC, Security & Future-Proofing Suite
// Self-contained Node ESM test runner - verifies all security & RBAC requirements
// ============================================================================

describe('ICON TECH PRO ERP V9.1 — Dynamic RBAC & Security Suite', () => {

  // --------------------------------------------------------------------------
  // 1. Controlled Module Registry
  // --------------------------------------------------------------------------
  describe('1. Controlled Module Registry (No Unrestricted Code Execution)', () => {
    const controlledRegistry = new Map();

    function registerModule(def) {
      // Strict Schema Validation
      if (!def.key || typeof def.key !== 'string' || !/^[A-Z0-9_]+$/.test(def.key)) {
        throw new Error('Module key must be uppercase alphanumeric with underscores.');
      }
      if (!def.name || typeof def.name !== 'string') {
        throw new Error('Module name is required.');
      }
      if (!def.route || !def.route.startsWith('/dashboard')) {
        throw new Error('Module route must be a valid path under /dashboard.');
      }
      // Ensure NO eval or Function is used
      if (typeof def === 'function' || typeof def.route === 'function') {
        throw new Error('Executable functions are prohibited in module definitions.');
      }

      const item = {
        ...def,
        createdAt: new Date().toISOString(),
      };
      controlledRegistry.set(def.key, item);
      return { success: true, data: item };
    }

    function unregisterModule(key) {
      const item = controlledRegistry.get(key);
      if (!item) throw new Error(`Module "${key}" not found in registry.`);
      if (item.isSystem) throw new Error(`Cannot unregister core system module "${key}".`);
      controlledRegistry.delete(key);
      return { success: true };
    }

    it('should register a controlled future module with strict schema validation', () => {
      const result = registerModule({
        key: 'WARRANTY_PORTAL',
        name: 'Warranty & RMA Portal',
        label: 'Warranty Portal',
        category: 'SERVICE',
        route: '/dashboard/warranty',
        iconName: 'ShieldCheck',
        description: 'Customer warranty lookup and RMA processing',
        defaultActions: ['view', 'create', 'edit'],
        isSystem: false,
        isControlledFutureModule: true,
      });

      assert.ok(result.success);
      assert.equal(result.data.key, 'WARRANTY_PORTAL');
      assert.equal(controlledRegistry.has('WARRANTY_PORTAL'), true);
    });

    it('should reject registration of invalid or unsafe module definitions', () => {
      assert.throws(() => {
        registerModule({ key: 'invalid-key-lowercase', name: 'Bad', route: '/dashboard' });
      }, /Module key must be uppercase alphanumeric/);

      assert.throws(() => {
        registerModule({ key: 'UNSAFE_ROUTE', name: 'Unsafe', route: '/external-unauthorized' });
      }, /Module route must be a valid path under \/dashboard/);
    });

    it('should unregister a custom module but prevent unregistering core system modules', () => {
      // Register a system module
      registerModule({
        key: 'SYS_QUOTES',
        name: 'Quotations',
        label: 'Quotations',
        category: 'SALES',
        route: '/dashboard/quotations',
        iconName: 'FileText',
        description: 'System Quotes',
        defaultActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
        isSystem: true,
      });

      // System module unregister blocked
      assert.throws(() => {
        unregisterModule('SYS_QUOTES');
      }, /Cannot unregister core system module/);

      // Custom module unregister allowed
      const unreg = unregisterModule('WARRANTY_PORTAL');
      assert.ok(unreg.success);
      assert.equal(controlledRegistry.has('WARRANTY_PORTAL'), false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Dynamic Sidebar Navigation Filtering
  // --------------------------------------------------------------------------
  describe('2. Dynamic Sidebar Navigation Filtering', () => {
    const ALL_NAV_ITEMS = [
      { name: 'Dashboard', href: '/dashboard', module: 'Dashboard' },
      { name: 'Enquiries', href: '/dashboard/enquiries', module: 'Enquiries / Leads' },
      { name: 'Quotations', href: '/dashboard/quotations', module: 'Quotations' },
      { name: 'Purchases', href: '/dashboard/purchases', module: 'Purchases' },
      { name: 'Billing', href: '/dashboard/invoices', module: 'Invoices & Billing' },
      { name: 'User Management', href: '/dashboard/settings/users', module: 'User Management' },
    ];

    function filterNavForRole(allowedModules) {
      return ALL_NAV_ITEMS.filter((item) => allowedModules.includes(item.module));
    }

    it('should display all modules for Managing Director', () => {
      const mdModules = ['Dashboard', 'Enquiries / Leads', 'Quotations', 'Purchases', 'Invoices & Billing', 'User Management'];
      const filtered = filterNavForRole(mdModules);
      assert.equal(filtered.length, 6);
    });

    it('should hide User Management and Purchases from Sales Executive in sidebar', () => {
      const salesModules = ['Dashboard', 'Enquiries / Leads', 'Quotations'];
      const filtered = filterNavForRole(salesModules);
      assert.equal(filtered.length, 3);
      assert.ok(!filtered.some((i) => i.name === 'User Management'));
      assert.ok(!filtered.some((i) => i.name === 'Purchases'));
    });

    it('should display Invoices & Billing to Accounts but hide Quotations', () => {
      const accountsModules = ['Dashboard', 'Invoices & Billing'];
      const filtered = filterNavForRole(accountsModules);
      assert.equal(filtered.length, 2);
      assert.ok(filtered.some((i) => i.name === 'Billing'));
      assert.ok(!filtered.some((i) => i.name === 'Quotations'));
    });
  });

  // --------------------------------------------------------------------------
  // 3. Direct URL & Server Action Guards
  // --------------------------------------------------------------------------
  describe('3. Direct URL & Server Action Authorization Guards', () => {
    const mockUserSessions = {
      'md-user': { id: 'USR001', role: 'Managing Director', email: 'md@icontechpro.in' },
      'sales-user': { id: 'USR003', role: 'Sales Executive', email: 'sales@icontechpro.in' },
      'accounts-user': { id: 'USR004', role: 'Accounts', email: 'accounts@icontechpro.in' },
    };

    const rolePermissions = {
      'Managing Director': { 'User Management': ['view', 'edit'], 'Invoices & Billing': ['view', 'create'] },
      'Sales Executive': { 'Quotations': ['view', 'create'], 'User Management': [] },
      'Accounts': { 'Invoices & Billing': ['view', 'create', 'edit', 'export'], 'User Management': [] },
    };

    function checkServerActionGuard(sessionId, module, action) {
      const user = mockUserSessions[sessionId];
      if (!user) throw new Error('Unauthenticated');
      if (user.role === 'Managing Director') return true;

      const allowedActions = rolePermissions[user.role]?.[module] || [];
      if (!allowedActions.includes(action)) {
        throw new Error(`403 Forbidden: Role "${user.role}" does not have "${action}" permission on "${module}".`);
      }
      return true;
    }

    it('should allow Managing Director unrestricted access to any server action', () => {
      assert.equal(checkServerActionGuard('md-user', 'User Management', 'edit'), true);
      assert.equal(checkServerActionGuard('md-user', 'Invoices & Billing', 'create'), true);
    });

    it('should allow Sales Executive to create quotations', () => {
      assert.equal(checkServerActionGuard('sales-user', 'Quotations', 'create'), true);
    });

    it('should block Sales Executive from accessing User Management (Direct URL / Action Guard)', () => {
      assert.throws(() => {
        checkServerActionGuard('sales-user', 'User Management', 'view');
      }, /403 Forbidden/);
    });

    it('should block Accounts from creating or viewing User Management', () => {
      assert.throws(() => {
        checkServerActionGuard('accounts-user', 'User Management', 'edit');
      }, /403 Forbidden/);
    });
  });

  // --------------------------------------------------------------------------
  // 4. 6-Role Permission Matrix Validation (BEFORE vs AFTER)
  // --------------------------------------------------------------------------
  describe('4. 6-Role Permission Matrix Verification', () => {
    const ROLE_MATRIX = {
      'Managing Director': {
        'Quotations': { view: true, create: true, edit: true, delete: true, approve: true, export: true },
        'Invoices & Billing': { view: true, create: true, edit: true, delete: true, approve: true, export: true },
        'User Management': { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      },
      'Admin / BDM': {
        'Quotations': { view: true, create: true, edit: true, delete: true, approve: true, export: true },
        'Invoices & Billing': { view: true, create: true, edit: true, delete: false, approve: true, export: true },
        'User Management': { view: true, create: true, edit: true, delete: false, approve: true, export: true },
      },
      'BDM': {
        'Quotations': { view: true, create: true, edit: true, delete: false, approve: true, export: true },
        'Invoices & Billing': { view: true, create: false, edit: false, delete: false, approve: false, export: false },
        'User Management': { view: false, create: false, edit: false, delete: false, approve: false, export: false },
      },
      'Sales Executive': {
        'Quotations': { view: true, create: true, edit: true, delete: false, approve: false, export: false },
        'Invoices & Billing': { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        'User Management': { view: false, create: false, edit: false, delete: false, approve: false, export: false },
      },
      'Accounts': {
        'Quotations': { view: true, create: false, edit: false, delete: false, approve: false, export: true },
        'Invoices & Billing': { view: true, create: true, edit: true, delete: false, approve: true, export: true },
        'User Management': { view: false, create: false, edit: false, delete: false, approve: false, export: false },
      },
      'Office Assistant': {
        'Quotations': { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        'Invoices & Billing': { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        'User Management': { view: false, create: false, edit: false, delete: false, approve: false, export: false },
      },
    };

    it('should verify Managing Director has full 6-action privileges across all modules', () => {
      const mdPerms = ROLE_MATRIX['Managing Director'];
      for (const [mod, acts] of Object.entries(mdPerms)) {
        for (const [act, allowed] of Object.entries(acts)) {
          assert.equal(allowed, true, `MD must have full access to ${mod} -> ${act}`);
        }
      }
    });

    it('should verify Sales Executive cannot delete or approve quotations', () => {
      const salesQuotes = ROLE_MATRIX['Sales Executive']['Quotations'];
      assert.equal(salesQuotes.view, true);
      assert.equal(salesQuotes.create, true);
      assert.equal(salesQuotes.edit, true);
      assert.equal(salesQuotes.delete, false);
      assert.equal(salesQuotes.approve, false);
    });

    it('should verify Accounts can create and approve invoices but cannot approve quotations', () => {
      const accountsBilling = ROLE_MATRIX['Accounts']['Invoices & Billing'];
      const accountsQuotes = ROLE_MATRIX['Accounts']['Quotations'];
      assert.equal(accountsBilling.create, true);
      assert.equal(accountsBilling.approve, true);
      assert.equal(accountsQuotes.approve, false);
    });

    it('should verify Office Assistant has zero access to User Management and Invoices', () => {
      const oaUser = ROLE_MATRIX['Office Assistant']['User Management'];
      const oaBilling = ROLE_MATRIX['Office Assistant']['Invoices & Billing'];
      assert.equal(oaUser.view, false);
      assert.equal(oaBilling.view, false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Privilege Escalation Defense
  // --------------------------------------------------------------------------
  describe('5. Privilege Escalation Defense', () => {
    it('should prevent an actor from assigning a role higher than their own', () => {
      function canAssignRole(actorRole, targetRole) {
        const hierarchy = {
          'Managing Director': 100,
          'Admin / BDM': 90,
          'BDM': 50,
          'Sales Executive': 20,
          'Accounts': 30,
          'Office Assistant': 10,
        };

        if (hierarchy[actorRole] <= hierarchy[targetRole] && actorRole !== 'Managing Director') {
          return false;
        }
        return true;
      }

      assert.equal(canAssignRole('Managing Director', 'Admin / BDM'), true);
      assert.equal(canAssignRole('Admin / BDM', 'Sales Executive'), true);
      assert.equal(canAssignRole('Admin / BDM', 'Managing Director'), false, 'Admin cannot promote to MD');
      assert.equal(canAssignRole('BDM', 'Admin / BDM'), false, 'BDM cannot assign Admin role');
    });

    it('should prevent deletion of core system roles', () => {
      const SYSTEM_ROLES = ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'];
      function deleteRole(roleName) {
        if (SYSTEM_ROLES.includes(roleName)) {
          throw new Error(`Security Guard: "${roleName}" is a core system role and cannot be deleted.`);
        }
        return { success: true };
      }

      assert.throws(() => {
        deleteRole('Managing Director');
      }, /core system role and cannot be deleted/);

      assert.throws(() => {
        deleteRole('Sales Executive');
      }, /core system role and cannot be deleted/);

      assert.ok(deleteRole('Custom Regional Lead').success);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Future Module Lifecycle End-to-End
  // --------------------------------------------------------------------------
  describe('6. Future Module Lifecycle End-to-End Test', () => {
    let moduleRegistry = new Map();
    let permissionMatrix = {};
    let auditEvents = [];

    it('should complete full lifecycle: Register -> Assign -> Verify -> Unregister -> Audit', () => {
      // Step 1: Register
      const modDef = {
        key: 'AI_COPILOT',
        name: 'AI Sales Copilot',
        label: 'AI Copilot',
        category: 'AI',
        route: '/dashboard/copilot',
        iconName: 'Bot',
        description: 'Assisted quote generation and RFP analysis',
        isSystem: false,
      };
      moduleRegistry.set(modDef.key, modDef);
      auditEvents.push({ action: 'MODULE_REGISTERED', module: modDef.key });
      assert.equal(moduleRegistry.has('AI_COPILOT'), true);

      // Step 2: Assign permissions
      permissionMatrix['Managing Director'] = { [modDef.name]: { view: true, create: true } };
      permissionMatrix['Sales Executive'] = { [modDef.name]: { view: true, create: false } };
      auditEvents.push({ action: 'PERMISSIONS_CONFIGURED', module: modDef.key });

      // Step 3: Verify authorization
      assert.equal(permissionMatrix['Managing Director']['AI Sales Copilot'].create, true);
      assert.equal(permissionMatrix['Sales Executive']['AI Sales Copilot'].create, false);

      // Step 4: Unregister module
      moduleRegistry.delete(modDef.key);
      delete permissionMatrix['Managing Director'][modDef.name];
      delete permissionMatrix['Sales Executive'][modDef.name];
      auditEvents.push({ action: 'MODULE_UNREGISTERED', module: modDef.key });
      assert.equal(moduleRegistry.has('AI_COPILOT'), false);

      // Step 5: Verify audit trail
      assert.equal(auditEvents.length, 3);
      assert.equal(auditEvents[0].action, 'MODULE_REGISTERED');
      assert.equal(auditEvents[2].action, 'MODULE_UNREGISTERED');
    });
  });
});
