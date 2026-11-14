import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { isUserAuthorizedForGmailMailbox } from '@/lib/actions/gmail';

export default async function GmailMailboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const isAuthorized = await isUserAuthorizedForGmailMailbox(user);
  if (!isAuthorized) {
    redirect('/dashboard?error=gmail_unauthorized');
  }

  return <>{children}</>;
}
