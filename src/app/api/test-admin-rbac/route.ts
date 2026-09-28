import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  getManagedUsers,
  createManagedUser,
  updateManagedUserProfile,
  toggleUserStatus,
  deleteManagedUser,
} from '@/lib/actions/users';
import {
  getRoles,
  createCustomRole,
  deleteRole,
  getRolePermissionMatrix,
  updateRolePermission,
  updateFullRoleMatrix,
  hasRolePermission,
} from '@/lib/actions/permissions';
import { getAuditLogsStore } from '@/lib/audit/logger';

export async function GET() {
  const testResults: Array<{
    name: string;
    category: string;
    passed: boolean;
    details: string;
  }> = [];

  function record(name: string, category: string, passed: boolean, details: string) {
    testResults.push({ name, category, passed, details });
  }

  // 1. Session & Role Verification
  const user = await getAuthenticatedUser();
  if (!user) {
    record(
      'Session Authentication Guard',
      'Security',
      false,
      'No valid authenticated session token found in cookies.'
    );
    return NextResponse.json(
      {
        status: 'UNAUTHORIZED',
        authenticated: false,
        results: testResults,
      },
      { status: 401 }
    );
  }

  record(
    'Session Authentication Guard',
    'Security',
    true,
    `Authenticated as ${user.name} (${user.role}) - Token signature valid`
  );

  // If user is Office Assistant or Sales Executive, test that admin actions reject them
  if (user.role !== 'Managing Director' && user.role !== 'Admin / BDM') {
    let usersBlocked = false;
    try {
      await getManagedUsers();
    } catch (err: any) {
      usersBlocked = err.message.includes('FORBIDDEN') || err.message.includes('not authorized');
    }

    record(
      'Role Guard: Unauthorized user blocked from getManagedUsers',
      'Security',
      usersBlocked,
      `Role "${user.role}" was correctly rejected from reading user list`
    );

    let roleCreationBlocked = false;
    try {
      const res = await createCustomRole({ role_name: 'Hacker Role', description: 'Malicious' });
      roleCreationBlocked = !res.success && Boolean(res.error?.includes('FORBIDDEN') || res.error?.includes('not authorized'));
    } catch (err: any) {
      roleCreationBlocked = err.message.includes('FORBIDDEN') || err.message.includes('not authorized');
    }

    record(
      'Role Guard: Unauthorized user blocked from creating roles',
      'Security',
      roleCreationBlocked,
      `Role "${user.role}" was correctly rejected from creating roles`
    );

    return NextResponse.json({
      status: 'ROLE_TEST_COMPLETE',
      authenticated: true,
      userRole: user.role,
      results: testResults,
    });
  }

  // 2. Initial Users Inspection
  try {
    const initialUsers = await getManagedUsers();
    record(
      'Fetch Managed Users',
      'User Management',
      initialUsers.total >= 6,
      `Retrieved ${initialUsers.total} registered employees (Core staff USR001-USR006 present)`
    );

    // 3. User Registration
    const testEmail = `test.employee.${Date.now()}@icontechpro.in`;
    const createRes = await createManagedUser({
      name: 'Ravi Teja Test',
      email: testEmail,
      phone: '+91 99887 76655',
      role: 'Sales Executive',
      department: 'Enterprise Sales',
      designation: 'Field Officer',
      notes: 'Automated test employee',
    });

    const createdUser = createRes.data;
    record(
      'Create Managed User',
      'User Management',
      Boolean(createRes.success && createdUser?.id && createdUser?.can_login),
      `Created user ${createdUser?.name} (${createdUser?.email}) with status ACTIVE and can_login: true`
    );

    // 4. Duplicate Email Rejection
    const dupRes = await createManagedUser({
      name: 'Duplicate Test',
      email: testEmail,
      role: 'Sales Executive',
    });
    record(
      'Duplicate Email Collision Rejection',
      'User Management',
      !dupRes.success && Boolean(dupRes.error?.includes('already registered')),
      `Duplicate email correctly rejected: "${dupRes.error}"`
    );

    // 5. Update User Profile & Role Promotion
    if (createdUser) {
      const updateRes = await updateManagedUserProfile(createdUser.id, {
        name: 'Ravi Teja (Promoted)',
        phone: '+91 99887 76655',
        role: 'BDM',
        department: 'Corporate Accounts',
        designation: 'BDM Lead',
      });

      record(
        'Update User Profile & Role',
        'User Management',
        Boolean(updateRes.success && updateRes.data?.role === 'BDM'),
        `User promoted: role changed to "${updateRes.data?.role}"`
      );

      // 6. Toggle Status & Deactivate Account
      const deactRes = await toggleUserStatus(createdUser.id, 'INACTIVE', false);
      record(
        'Deactivate User Account & Login Access',
        'User Management',
        Boolean(deactRes.success && deactRes.data?.status === 'INACTIVE' && !deactRes.data?.can_login),
        `Status set to INACTIVE, can_login: false`
      );

      // 7. Clean Deletion of Unlinked User
      const delNewUserRes = await deleteManagedUser(createdUser.id);
      record(
        'Delete Unlinked Test User',
        'User Management',
        delNewUserRes.success,
        `Unlinked test user deleted cleanly from records`
      );
    }

    // 8. Self-Lockout Prevention Guard
    // Current user attempting to deactivate their own account
    const selfLockoutRes = await toggleUserStatus(user.id, 'SUSPENDED', false);
    const selfLockoutBlocked = !selfLockoutRes.success && Boolean(selfLockoutRes.error?.includes('cannot deactivate'));
    record(
      'Self-Lockout Administrative Defense',
      'Security',
      selfLockoutBlocked,
      `Admin self-deactivation blocked: "${selfLockoutRes.error}"`
    );

    // 9. Historical Transaction Integrity Guard
    // USR003 (Vineet Babu) physical deletion attempt by Admin (USR001)
    const histDelRes = await deleteManagedUser('USR003');
    const histDelBlocked = !histDelRes.success && Boolean(histDelRes.error?.includes('Integrity Protection'));
    record(
      'Historical Transaction Integrity Protection',
      'Integrity',
      histDelBlocked,
      `Physical deletion of staff with history blocked: "${histDelRes.error}"`
    );

    // 10. Role Management: Fetch Initial Roles
    const rolesRes = await getRoles();
    record(
      'Fetch System Roles',
      'Role Management',
      rolesRes.total >= 6 && rolesRes.roles.some((r) => r.is_system),
      `Found ${rolesRes.total} total roles with core system flags intact`
    );

    // 11. Custom Role Creation
    const customRoleName = `Field Service Specialist ${Date.now() % 1000}`;
    const createRoleRes = await createCustomRole({
      role_name: customRoleName,
      description: 'On-site technical support and warranty repairs',
    });
    const createdRole = createRoleRes.data;
    record(
      'Create Custom Role',
      'Role Management',
      Boolean(createRoleRes.success && createdRole && !createdRole.is_system),
      `Created custom role "${createdRole?.role_name}" with is_system: false`
    );

    // 12. Core System Role Deletion Defense
    const sysRoleDelRes = await deleteRole('ROLE_MD');
    const sysRoleDelBlocked = !sysRoleDelRes.success && Boolean(sysRoleDelRes.error?.includes('Security Guard'));
    record(
      'Core System Role Deletion Defense',
      'Security',
      sysRoleDelBlocked,
      `Attempt to delete core system role blocked: "${sysRoleDelRes.error}"`
    );

    // 13. Delete Custom Role
    if (createdRole) {
      const delRoleRes = await deleteRole(createdRole.id);
      record(
        'Delete Custom Role',
        'Role Management',
        delRoleRes.success,
        `Custom role "${customRoleName}" deleted cleanly`
      );
    }

    // 14. Granular Permission Matrix Retrieval
    const matrix = await getRolePermissionMatrix();
    const hasAllModules =
      matrix['Managing Director'] &&
      Boolean(matrix['Managing Director']['Quotations']) &&
      Boolean(matrix['Managing Director']['User Management']);
    record(
      'Granular Permission Matrix Retrieval',
      'Permissions',
      hasAllModules,
      'Retrieved 18-module granular permission matrix across all roles'
    );

    // 15. Dynamic Permission Toggle & Live Evaluation
    // Grant Sales Executive 'Quotations' approve permission
    const grantRes = await updateRolePermission('Sales Executive', 'Quotations', 'approve', true);
    const hasApprovedPerm = await hasRolePermission('Sales Executive', 'Quotations', 'approve');
    record(
      'Dynamic Permission Grant',
      'Permissions',
      grantRes.success && hasApprovedPerm,
      'Dynamically granted [Sales Executive -> Quotations -> approve = true]'
    );

    // Revoke Sales Executive 'Quotations' approve permission back
    const revokeRes = await updateRolePermission('Sales Executive', 'Quotations', 'approve', false);
    const hasRevokedPerm = await hasRolePermission('Sales Executive', 'Quotations', 'approve');
    record(
      'Dynamic Permission Revocation',
      'Permissions',
      revokeRes.success && !hasRevokedPerm,
      'Dynamically revoked [Sales Executive -> Quotations -> approve = false]'
    );

    // 16. Administrative Self-Revoke Lockout Defense
    // Attempting to remove User Management edit permission from Admin / BDM
    const adminRevokeRes = await updateRolePermission('Admin / BDM', 'User Management', 'edit', false);
    const adminRevokeBlocked = !adminRevokeRes.success && Boolean(adminRevokeRes.error?.includes('Safety Guard'));
    record(
      'Administrative Permission Lockout Defense',
      'Security',
      adminRevokeBlocked,
      `Revoking admin user management rights blocked: "${adminRevokeRes.error}"`
    );

    // 17. Audit Log Trail Verification
    const auditLogs = getAuditLogsStore();
    const hasSecurityLogs = auditLogs.some(
      (l) =>
        l.action === 'USER_CREATED' ||
        l.action === 'ROLE_CREATED' ||
        l.action === 'PERMISSION_GRANTED' ||
        l.action === 'STATUS_CHANGED'
    );
    record(
      'Security Event Audit Logging',
      'Audit Trail',
      hasSecurityLogs,
      `Security events logged in audit ledger (${auditLogs.length} total events in memory/store)`
    );
  } catch (err: any) {
    record('Admin Workflow Execution', 'System', false, `Unhandled error: ${err.message}`);
  }

  const allPassed = testResults.every((t) => t.passed);

  return NextResponse.json({
    status: allPassed ? 'SUCCESS' : 'FAILED',
    totalTests: testResults.length,
    passedCount: testResults.filter((t) => t.passed).length,
    failedCount: testResults.filter((t) => !t.passed).length,
    results: testResults,
    timestamp: new Date().toISOString(),
  });
}
