import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Demo Quotation Workspace | ICON TECH PRO ERP',
  description: 'Interactive demo of the next-generation quotation workspace for ICON TECH PRO ERP V9.2',
};

export default function DemoQuotationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
      {children}
    </div>
  );
}
