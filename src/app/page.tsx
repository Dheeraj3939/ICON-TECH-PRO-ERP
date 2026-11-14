import React from 'react';
import type { Metadata } from 'next';
import { PublicErpLanding } from '@/components/public/PublicErpLanding';
import { getAuthenticatedUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ICON TECH PRO ERP — Enterprise Operations Platform',
  description:
    'Business management platform for ICON TECH PRO covering customer management, enquiries, quotations, sales, procurement, invoicing, business communication, CRM integration and related business operations.',
};

export default async function HomePage() {
  const user = await getAuthenticatedUser();
  return <PublicErpLanding user={user} />;
}
