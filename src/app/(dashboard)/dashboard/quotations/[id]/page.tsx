'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Printer,
  Edit3,
  ShoppingBag,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Mail,
  MessageSquare,
  ShieldCheck,
  CreditCard,
  Layers,
  Phone,
  MapPin,
} from 'lucide-react';
import { getQuotationById, convertQuotationToOrder } from '@/lib/actions/quotations';
import { createProformaFromQuotation } from '@/lib/actions/proforma';
import { INITIAL_QUOTATIONS } from '@/lib/constants/erp-data';
import { PrintQuotationModal } from '@/components/modals/PrintQuotationModal';
import type { Quotation } from '@/types/erp';

function QuotationViewContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const initialPreview = searchParams?.get('preview') === 'true';

  const [quotation, setQuotation] = useState<Quotation | null>(() => {
    if (!id) return null;
    return INITIAL_QUOTATIONS.find((q) => q.id === id || q.quotation_number === id) || null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!id) return true;
    const found = INITIAL_QUOTATIONS.find((q) => q.id === id || q.quotation_number === id);
    return !found;
  });
  const [isPreviewOpen, setIsPreviewOpen] = useState(initialPreview);
  const [isConverting, setIsConverting] = useState(false);
  const [isCreatingProforma, setIsCreatingProforma] = useState(false);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    getQuotationById(id)
      .then((quote) => {
        if (isMounted) {
          setQuotation(quote);
          setLoading(false);
          if (initialPreview) {
            setIsPreviewOpen(true);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load quotation:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, initialPreview]);

  const handleConvert = async () => {
    if (!quotation) return;
    setIsConverting(true);
    try {
      const res = await convertQuotationToOrder(quotation.id);
      if (res.success && res.order) {
        router.push(`/dashboard/sales-orders`);
      } else {
        alert(res.error || 'Failed to convert quotation to order.');
      }
    } catch (err: any) {
      alert(err.message || 'Error converting to order.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleCreateProforma = async () => {
    if (!quotation) return;
    setIsCreatingProforma(true);
    try {
      const res = await createProformaFromQuotation(quotation.id);
      if (res.success && res.data) {
        router.push(`/dashboard/proforma-invoices`);
      } else {
        alert(res.error || 'Failed to create proforma invoice.');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating proforma invoice.');
    } finally {
      setIsCreatingProforma(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 font-medium">
        Loading quotation details...
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Quotation Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested quotation could not be located in the system.
        </p>
        <Link
          href="/dashboard/quotations"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Quotations Register</span>
        </Link>
      </div>
    );
  }

  const isTelangana = (quotation.place_of_supply || '36-TELANGANA').startsWith('36');

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 py-2">
      {/* Top Header Console */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/quotations"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition mr-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quotations</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-mono font-black text-slate-900 text-sm">
              {quotation.quotation_number}
            </span>
            {(quotation.revision_number || 1) > 1 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Rev {quotation.revision_number}
              </span>
            )}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                quotation.status === 'Accepted' || quotation.status === 'Approved'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : quotation.status === 'Sent'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {quotation.status}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Created on {quotation.quotation_date} &bull; Sales Rep: {quotation.salesperson_name || 'Staff'} &bull; Validity: {quotation.validity_days || 7} Days
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>PREVIEW / PRINT</span>
          </button>

          <Link
            href={`/dashboard/quotations/${quotation.id}/edit`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-amber-600" />
            <span>EDIT QUOTATION</span>
          </Link>

          <button
            type="button"
            disabled={isCreatingProforma}
            onClick={handleCreateProforma}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>{isCreatingProforma ? 'Creating Proforma...' : 'Create Proforma'}</span>
          </button>

          {quotation.status !== 'Accepted' && (
            <button
              type="button"
              disabled={isConverting}
              onClick={handleConvert}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{isConverting ? 'Converting...' : 'Convert to Order'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid: Customer & Commercials */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Customer Information (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Customer & Proposal Metadata
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Account / Company</span>
              <span className="font-bold text-slate-900 text-sm">{quotation.company_name || quotation.customer_name}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Contact Person</span>
              <span className="font-semibold text-slate-800">{quotation.customer_name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Phone / Mobile</span>
              <span className="font-mono font-semibold text-slate-800">{quotation.phone || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Email Address</span>
              <span className="text-slate-800">{quotation.email || 'N/A'}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Billing / Site Address</span>
              <span className="text-slate-700">{quotation.address || 'Hyderabad, TELANGANA'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Place of Supply</span>
              <span className="font-bold text-blue-700">{quotation.place_of_supply || '36-TELANGANA'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Quotation Format</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 text-[10px]">
                {quotation.quotation_format || 'STANDARD'}
              </span>
            </div>
          </div>
        </div>

        {/* Commercial Financial Summary (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Financial Summary
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal ({quotation.items?.length || 0} items):</span>
              <span className="font-mono font-bold text-slate-900">
                ₹{Math.round(quotation.subtotal || 0).toLocaleString('en-IN')}
              </span>
            </div>

            {(quotation.total_discount || 0) > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Total Discount:</span>
                <span className="font-mono font-bold">
                  -₹{Math.round(quotation.total_discount).toLocaleString('en-IN')}
                </span>
              </div>
            )}

            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-700">
              <span>Taxable Base Value:</span>
              <span className="font-mono font-bold text-slate-900">
                ₹{Math.round(quotation.taxable_amount || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="space-y-1 pt-1 text-[11px] text-slate-500">
              {isTelangana ? (
                <>
                  <div className="flex justify-between">
                    <span>CGST (9%):</span>
                    <span className="font-mono">₹{Math.round(quotation.cgst_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST (9%):</span>
                    <span className="font-mono">₹{Math.round(quotation.sgst_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span>IGST (18%):</span>
                  <span className="font-mono">₹{Math.round(quotation.igst_amount || 0).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            <div className="border-t-2 border-slate-900 pt-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                Grand Total (Incl. GST)
              </span>
              <span className="text-2xl font-black text-slate-950 font-mono tracking-tight block mt-0.5">
                ₹{Math.round(quotation.grand_total || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Products & Services Line Items Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Scope of Supply & Services ({quotation.items?.length || 0} Lines)
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Product / Service & Technical Specifications</th>
                <th className="py-2.5 px-3 w-24">HSN/SAC</th>
                <th className="py-2.5 px-3 text-center w-24">Qty / Unit</th>
                <th className="py-2.5 px-3 text-right w-32">Unit Price</th>
                <th className="py-2.5 px-3 text-center w-20">GST %</th>
                <th className="py-2.5 px-3 text-right w-36">Line Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(quotation.items || []).map((it, idx) => (
                <tr key={it.id || idx} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-3 align-top text-center font-mono text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3 align-top space-y-1">
                    <div className="font-bold text-slate-900">
                      {it.product_name}
                    </div>
                    {it.section_id && (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {it.section_id}
                      </span>
                    )}
                    {it.specs && (
                      <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100">
                        {it.specs}
                      </div>
                    )}
                    {it.description && (
                      <p className="text-[11px] text-slate-600">
                        {it.description}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3 align-top font-mono text-slate-500">
                    {it.hsn_sac || '8471'}
                  </td>
                  <td className="py-3 px-3 align-top text-center font-mono font-bold text-slate-800">
                    {it.quantity} {it.unit || 'Nos.'}
                  </td>
                  <td className="py-3 px-3 align-top text-right font-mono text-slate-800">
                    ₹{Number(it.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 align-top text-center font-mono text-slate-600">
                    {it.gst_rate ?? 18}%
                  </td>
                  <td className="py-3 px-3 align-top text-right font-mono font-black text-slate-900">
                    ₹{Number(it.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terms & Conditions & Remittance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            Commercial Terms & Presets
          </h3>
          <div className="space-y-1.5 text-xs text-slate-700">
            <div><strong>Payment Terms:</strong> {quotation.payment_terms || '100% Advance Payment'}</div>
            <div><strong>Delivery Timeline:</strong> {quotation.delivery_terms || 'Immediately / 2-3 Working Days'}</div>
            <div><strong>Quotation Validity:</strong> {quotation.validity_days || 7} Days</div>
          </div>
          {quotation.terms_conditions && quotation.terms_conditions.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Proposal Clauses</span>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600">
                {quotation.terms_conditions.map((term, tIdx) => (
                  <li key={tIdx}>{term}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            Bank Remittance Details
          </h3>
          <div className="text-xs text-slate-700 space-y-1">
            <div><strong>Bank Name:</strong> {quotation.bank_details?.bank_name || 'IDBI Bank'}</div>
            <div><strong>Account Name:</strong> {quotation.bank_details?.account_holder || 'ICON TECH PRO'}</div>
            <div><strong>Account Number:</strong> {quotation.bank_details?.account_number || '0426653800000161'}</div>
            <div><strong>IFSC Code:</strong> {quotation.bank_details?.ifsc_code || 'IBKL0000426'}</div>
            <div><strong>Branch:</strong> {quotation.bank_details?.branch || 'BANDRI COMPLEX'}</div>
          </div>
        </div>
      </div>

      {/* Customer Preview Modal */}
      <PrintQuotationModal
        quotation={quotation}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
}

export default function QuotationViewPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-500 font-medium">Loading proposal view...</div>}>
      <QuotationViewContent />
    </Suspense>
  );
}
