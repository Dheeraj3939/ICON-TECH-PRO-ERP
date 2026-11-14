import { redirect } from 'next/navigation';

export default function DashboardMailPage() {
  redirect('/dashboard/settings/integrations');
}
