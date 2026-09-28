'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QuotationFormWorkspace } from '@/components/quotations/QuotationFormWorkspace';
import { getQuotationById } from '@/lib/actions/quotations';
import type { Quotation } from '@/types/erp';

export default function EditQuotationPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    getQuotationById(id)
      .then((quote) => {
        if (isMounted) {
          setQuotation(quote);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load quotation for edit:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        Loading quotation details...
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-sm font-bold text-slate-800">Quotation not found</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard/quotations')}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
        >
          Return to Quotations
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-2">
      <QuotationFormWorkspace editingQuotation={quotation} />
    </div>
  );
}
