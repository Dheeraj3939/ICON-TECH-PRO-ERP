import React from 'react';
import type { Metadata } from 'next';
import { PublicErpLanding } from '@/components/public/PublicErpLanding';
import { getAuthenticatedUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'About ICON TECH PRO ERP — Enterprise Operations Platform',
  description:
    'Overview of ICON TECH PRO ERP platform architecture, business operations, and enterprise integrations.',
};

export default async function AboutPage() {
  const user = await getAuthenticatedUser();
  return <PublicErpLanding user={user} />;
}
