import { notFound } from 'next/navigation';
import { getCustomer360Data } from '@/lib/actions/customer360';
import { Customer360View } from '@/components/customers/Customer360View';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const res = await getCustomer360Data(resolvedParams.id);

  if (!res.success || !res.data) {
    notFound();
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
