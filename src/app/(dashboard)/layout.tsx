import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { DemoPresentationBar } from '@/components/layout/DemoPresentationBar';
import { WorkNotificationToaster } from '@/components/notifications/WorkNotificationToaster';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getUserEffectivePermissions } from '@/lib/actions/permissions';
import { DEMO_MODE_COOKIE_NAME } from '@/lib/constants/demo-mode';
import { UATReviewBanner } from '@/components/uat/UATReviewBanner';
import { MfaGracePeriodBanner } from '@/components/security/MfaGracePeriodBanner';
import { evaluateMfaPolicy } from '@/lib/security/mfa-service';
import type { UserRoleName } from '@/types/database';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative server-side identity verification
  const authUser = await getAuthenticatedUser();

  if (!authUser) {
    redirect('/login');
  }

  const userName = authUser.name;
  // Canonical Administrator resolution: strictly remove legacy BDM conflation
  const userRole: UserRoleName =
    authUser.role === 'Admin / BDM' || authUser.email === 'dheeraj@icontechpro.in'
      ? 'Admin'
      : (authUser.role as UserRoleName);

  // Resolve dynamic effective permissions for sidebar visibility
  const effectivePerms = await getUserEffectivePermissions(authUser.id, authUser.role);
  const allowedModules = Object.entries(effectivePerms)
    .filter(([_, actMap]) => actMap.view?.allowed)
    .map(([modName]) => modName);

  // Check if Demo/Training Mode is explicitly activated (defaults to false in production)
  const cookieStore = await cookies();
  const isDemoMode = cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value === 'true';
  const isUatEnvironment = process.env.NEXT_PUBLIC_ERP_ENV?.trim().toUpperCase() === 'UAT';

  // Corporate MFA Policy (Immediate for MD/Admin/Accounts; 14-day grace period for Sales/Field)
  const mfaPolicy = evaluateMfaPolicy({
    id: authUser.id,
    email: authUser.email,
    role: userRole,
  });

  return (
    <div className="min-h-screen bg-slate-50 w-full overflow-x-hidden">
      {/* Dynamic Role-Aware Sidebar */}
      <Sidebar userRole={userRole} userEmail={authUser.email} activeEntity="ICON_TECH_PRO" allowedModules={allowedModules} />

      {/* Main Container */}
      <div className="lg:pl-64 flex flex-col min-h-screen w-full min-w-0">
        {/* Sticky Top Header Stack (UAT Review Banner + Navigation Header) */}
        <div className="sticky top-0 z-30 flex flex-col w-full shadow-xs">
          {isUatEnvironment && <UATReviewBanner user={authUser} />}
          <Header
            userName={userName}
            userRole={userRole}
            activeEntity="ICON_TECH_PRO"
          />
        </div>

        {/* Corporate MFA Enforcement & Grace Period Banner */}
        <div className="w-full">
          <MfaGracePeriodBanner policy={mfaPolicy} />
        </div>

        {/* Page Content Viewport */}
        <main className="flex-1 p-3 sm:p-5 lg:p-8 w-full min-w-0">
          {isDemoMode && <DemoPresentationBar />}
          {children}
        </main>

        {/* Global Real-Time Work Notification Toaster */}
        <WorkNotificationToaster userRole={userRole} />
      </div>
    </div>
  );
}
