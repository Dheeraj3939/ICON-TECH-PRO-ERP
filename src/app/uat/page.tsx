import { getAuthenticatedUser } from '@/lib/auth/session';
import { UATHubClient } from './UATHubClient';

export const metadata = {
  title: 'ICON TECH PRO ERP V9.2 — Final Human UAT Environment',
  description: 'Role-by-Role Human UAT Review Portal on Port 3001',
};

export default async function UATHubPage() {
  const authUser = await getAuthenticatedUser();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      <UATHubClient currentUser={authUser} />
    </div>
  );
}
