import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth/session';
import { getDocuments } from '@/lib/actions/documents';
import { DocumentsClient } from './DocumentsClient';

export const metadata = {
  title: 'Document Center | ICON TECH PRO ERP',
};

export default async function DocumentsPage() {
  const authUser = await requireAuth();
  const initialDocs = await getDocuments();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-700/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Private Document Center</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
              Enterprise Vault
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Secure, role-governed document vault for ICON TECH PRO. Contracts, compliance certificates, technical drawings & commercial attachments.
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Document Vault...</div>}>
        <DocumentsClient initialDocs={initialDocs} currentUserRole={authUser.role} currentUserName={authUser.name} />
      </Suspense>
    </div>
  );
}
