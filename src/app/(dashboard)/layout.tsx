import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { DemoPresentationBar } from '@/components/layout/DemoPresentationBar';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getUserEffectivePermissions } from '@/lib/actions/permissions';
import { DEMO_MODE_COOKIE_NAME } from '@/lib/constants/demo-mode';
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
  const userRole: UserRoleName = authUser.role;

  // Resolve dynamic effective permissions for sidebar visibility
  const effectivePerms = await getUserEffectivePermissions(authUser.id, authUser.role);
  const allowedModules = Object.entries(effectivePerms)
    .filter(([_, actMap]) => actMap.view?.allowed)
    .map(([modName]) => modName);

  // Check if Demo/Training Mode is explicitly activated (defaults to false in production)
  const cookieStore = await cookies();
  const isDemoMode = cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value === 'true';

  return (
    <div className="min-h-screen bg-slate-50 w-full overflow-x-hidden">
      {/* Dynamic Role-Aware Sidebar */}
      <Sidebar userRole={userRole} activeEntity="ICON_TECH_PRO" allowedModules={allowedModules} />

      {/* Main Container */}
      <div className="lg:pl-64 flex flex-col min-h-screen w-full min-w-0">
        {/* Top Header */}
        <Header
          userName={userName}
          userRole={userRole}
          activeEntity="ICON_TECH_PRO"
        />

        {/* Page Content Viewport */}
        <main className="flex-1 mt-16 p-3 sm:p-5 lg:p-8 w-full min-w-0">
          {isDemoMode && <DemoPresentationBar />}
          {children}
        </main>
      </div>
    </div>
  );
}
