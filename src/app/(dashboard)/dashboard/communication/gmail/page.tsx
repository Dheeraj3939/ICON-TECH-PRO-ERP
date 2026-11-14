import { redirect } from 'next/navigation';

export default function GmailInboxRedirectPage() {
  redirect('/dashboard/settings/integrations');
}
