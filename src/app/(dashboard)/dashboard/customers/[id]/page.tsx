import { getCustomer360Data } from '@/lib/actions/customer360';
import { Customer360View } from '@/components/customers/Customer360View';
import Link from 'next/link';
import { ArrowLeft, Users, AlertCircle, Search } from 'lucide-react';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const decodedId = decodeURIComponent(resolvedParams.id);
  const res = await getCustomer360Data(decodedId);

  if (!res.success || !res.data) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 px-4 space-y-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/dashboard" className="hover:text-brand-600 transition font-medium">
            Dashboard
          </Link>
          <span className="text-slate-300">/</span>
          <Link href="/dashboard/customers" className="hover:text-brand-600 transition font-medium">
            Customers
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-bold text-slate-700">Account Not Found</span>
        </nav>

        <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h1 className="text-xl font-bold text-slate-900">Customer 360 Record Not Found</h1>
            <p className="text-xs text-slate-500">
              Could not locate an active Customer 360 record matching <code className="font-mono text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded font-bold">{decodedId}</code>.
            </p>
            {res.error && (
              <p className="text-[11px] text-rose-500 font-mono mt-1">
                Details: {res.error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard/customers"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-sm"
            >
              <Users className="w-4 h-4" />
              <span>Back to Customer Master</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation Trail */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/dashboard" className="hover:text-brand-600 transition font-medium">
          Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <Link href="/dashboard/customers" className="hover:text-brand-600 transition font-medium">
          Customers
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-bold text-slate-900 truncate max-w-xs">
          {res.data.customer.customer_name} ({res.data.customer.customer_code})
        </span>
      </nav>

      <Customer360View dossier={res.data} />
    </div>
  );
}
