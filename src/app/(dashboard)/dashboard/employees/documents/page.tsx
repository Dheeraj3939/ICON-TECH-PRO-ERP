import React from 'react';
import Link from 'next/link';
import {
  FileText,
  Briefcase,
  Shield,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getEmployeeDocuments, getOfferLetters } from '@/lib/actions/hr-documents';
import { getEmployees } from '@/lib/actions/employees';
import { DocumentsClient } from './DocumentsClient';

export const metadata = {
  title: 'Documents & Offer Letters | ICON TECH PRO ERP',
};

export default async function DocumentsPage() {
  const authUser = await getAuthenticatedUser();
  const userRole = authUser?.role || 'Managing Director';

  const documents = await getEmployeeDocuments();
  const offerLetters = await getOfferLetters();
  const { employees } = await getEmployees();

  const canManageOffers = ['Managing Director', 'Admin / BDM'].includes(userRole);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
            <Briefcase className="w-4 h-4" />
            <span>Document Repository & Lifecycle</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Employee Documents & Offer Letters
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Multi-tier sensitive document repository and formal employment offer letter drafting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/employees"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Employee Directory</span>
          </Link>
        </div>
      </div>

      <DocumentsClient
        initialDocuments={documents}
        initialOffers={offerLetters}
        employees={employees}
        userRole={userRole}
        canManageOffers={canManageOffers}
      />
    </div>
  );
}
