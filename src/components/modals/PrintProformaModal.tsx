'use client';

import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Copy, ShieldCheck } from 'lucide-react';
import type { ProformaInvoice } from '@/types/proforma';
import { numberToWordsINR } from '@/lib/utils/inr-words';

interface PrintProformaModalProps {
  proforma: ProformaInvoice | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PrintProformaModal({ proforma, isOpen, onClose }: PrintProformaModalProps) {
  const [selectedCopy, setSelectedCopy] = useState<'BOTH' | 'ORIGINAL' | 'DUPLICATE'>('BOTH');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !proforma) return null;

  const handleDownloadPDF = () => {
    const cleanCustomer = (proforma.customer_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const docTitle = `${proforma.proforma_number.replace(/\//g, '_')}_${cleanCustomer}_Proforma`;
    const prev = document.title;
    document.title = docTitle;
    window.print();
    setTimeout(() => {
      document.title = prev;
    }, 2500);
  };

  const handleDownloadOfflineHTML = () => {
    const cleanCustomer = (proforma.customer_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const docElement = document.getElementById('printable-proforma-content');
    if (!docElement) return;

    const clone = docElement.cloneNode(true) as HTMLElement;
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${proforma.proforma_number} - ${cleanCustomer} - ICON TECH PRO</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f1f5f9; padding: 20px; color: #0f172a; margin: 0; }
    .doc-card { max-width: 896px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .print-btn-bar { max-width: 896px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center; }
    .btn { background: #1e3a8a; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; }
    .page-break { page-break-after: always; margin-bottom: 40px; }
    @media print {
      body { background: white !important; padding: 0 !important; }
      .print-btn-bar { display: none !important; }
      .doc-card { box-shadow: none !important; padding: 20px !important; max-width: none !important; }
    }
  </style>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body>
  <div class="print-btn-bar">
    <div style="font-weight: bold; font-size: 14px;">Proforma Invoice &bull; ${proforma.proforma_number}</div>
    <button class="btn" onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="doc-card">
    ${clone.innerHTML}
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${proforma.proforma_number.replace(/\//g, '_')}_${cleanCustomer}_Proforma.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderSingleCopy = (copyType: 'ORIGINAL – CUSTOMER COPY' | 'DUPLICATE – OFFICE COPY', isLast: boolean) => (
    <div className={`p-8 sm:p-10 text-slate-800 space-y-6 text-xs bg-white ${!isLast ? 'print:break-after-page border-b-4 border-dashed border-slate-300 pb-12 mb-12 print:border-none print:pb-0 print:mb-0' : ''}`}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-brand-800 pb-5">
        <div>
          <div className="mb-2">
            <img
              src="/logo-transparent.png"
              alt="ICON TECH PRO"
              className="h-14 w-auto object-contain"
              onError={(e) => {
                // Fallback to regular logo
                (e.currentTarget as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>
          <p className="text-[11px] text-slate-600 font-medium">
            Audio-Visual, IT Solutions, Security & Enterprise Systems
          </p>
          <p className="text-[11px] text-slate-500">
            Ameer Estate, SR Nagar, Hyderabad, Telangana - 500038
          </p>
          <p className="text-[11px] text-slate-700 font-semibold mt-1">
            Phones: +91 96182 40232 &bull; +91 98490 14959 &bull; Email: icontechpro@gmail.com &bull; Web: <a href="https://www.icontechpro.in" target="_blank" rel="noreferrer" className="text-brand-700 underline">www.icontechpro.in</a>
          </p>
          <p className="text-[11px] text-slate-700 font-semibold">
            GSTIN: 36AAACI9821L1Z4 &bull; State Code: 36
          </p>
        </div>

        <div className="text-right">
          <div className="inline-block px-3 py-1 bg-brand-900 text-white rounded font-bold text-xs tracking-wider mb-1.5 shadow-sm">
            PROFORMA INVOICE
          </div>
          <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block mb-1">
            NOT A TAX INVOICE
          </div>
          <div className="inline-block px-2.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-700 uppercase mb-2">
            {copyType}
          </div>
          <div className="space-y-0.5 text-slate-600 text-left sm:text-right">
            <p><strong className="text-slate-900">PI No:</strong> <span className="font-mono font-bold text-brand-900">{proforma.proforma_number}</span></p>
            <p><strong className="text-slate-900">Date:</strong> {proforma.proforma_date}</p>
            <p><strong className="text-slate-900">Valid Until:</strong> {proforma.due_date} ({proforma.validity_days} Days)</p>
            {proforma.quotation_number && (
              <p><strong className="text-slate-900">Quotation Ref:</strong> {proforma.quotation_number}</p>
            )}
            {proforma.order_number && (
              <p><strong className="text-slate-900">Order Ref:</strong> {proforma.order_number}</p>
            )}
          </div>
        </div>
      </div>

      {/* Customer / Billed To & Shipped To */}
      <div className="grid grid-cols-2 gap-4 p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Proforma Billed To:
          </span>
          <h3 className="font-bold text-slate-900 text-sm">
            {proforma.company_name || proforma.customer_name}
          </h3>
          {proforma.company_name && <p className="text-slate-700">Attn: {proforma.customer_name}</p>}
          <p className="text-slate-600 mt-0.5 whitespace-pre-line">{proforma.billing_address || 'Hyderabad, Telangana'}</p>
          <p className="text-slate-700 font-semibold mt-1">
            GSTIN: {proforma.gstin || 'Unregistered / B2C'}
          </p>
          <p className="text-slate-600">Place of Supply: {proforma.place_of_supply || '36 - Telangana'}</p>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Delivery / Consignee Address:
          </span>
          <h3 className="font-bold text-slate-900">
            {proforma.company_name || proforma.customer_name}
          </h3>
          <p className="text-slate-600 mt-0.5 whitespace-pre-line">{proforma.shipping_address || proforma.billing_address || 'Hyderabad, Telangana'}</p>
          <p className="text-slate-600 mt-1">Delivery Terms: {proforma.delivery_terms || 'Immediate Dispatch'}</p>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-brand-900 text-white text-[11px]">
              <th className="py-2.5 px-3 font-semibold">#</th>
              <th className="py-2.5 px-3 font-semibold">Product Description & Specification</th>
              <th className="py-2.5 px-2 font-semibold">HSN/SAC</th>
              <th className="py-2.5 px-2 font-semibold text-center">Qty</th>
              <th className="py-2.5 px-3 font-semibold text-right">Unit Rate</th>
              <th className="py-2.5 px-2 font-semibold text-right">Disc %</th>
              <th className="py-2.5 px-2 font-semibold text-center">GST</th>
              <th className="py-2.5 px-3 font-semibold text-right">Amount (INR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {proforma.items.map((it, idx) => (
              <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                <td className="py-2.5 px-3">
                  <div className="font-bold text-slate-900">
                    {it.brand_name && it.model_name
                      ? `${it.brand_name.toUpperCase()} – ${it.model_name.toUpperCase()}`
                      : it.description}
                  </div>
                  {it.brand_name && it.model_name && (
                    <div className="text-[11px] text-slate-600 mt-0.5">{it.description}</div>
                  )}
                </td>
                <td className="py-2.5 px-2 font-mono text-slate-600">{it.hsn_sac || '85285200'}</td>
                <td className="py-2.5 px-2 text-center font-bold text-slate-800">
                  {it.quantity} {it.unit || 'Nos.'}
                </td>
                <td className="py-2.5 px-3 text-right font-mono">₹{it.rate.toLocaleString('en-IN')}</td>
                <td className="py-2.5 px-2 text-right font-mono text-slate-500">{it.discount_pct || 0}%</td>
                <td className="py-2.5 px-2 text-center font-mono text-slate-600">{it.gst_rate}%</td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                  ₹{it.total_amount.toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tax & Grand Total Breakdown */}
      <div className="grid grid-cols-2 gap-4 items-start pt-1">
        <div className="space-y-3">
          <div className="p-3 bg-brand-50/50 rounded-lg border border-brand-200/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-900 block mb-1">
              Amount Chargeable in Words:
            </span>
            <p className="font-semibold text-slate-900 text-xs italic">
              {proforma.amount_in_words || numberToWordsINR(proforma.grand_total)}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Advance Remittance Bank Coordinates:
            </span>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-slate-700">
              <span><strong>Bank:</strong> {proforma.bank_details.bank_name}</span>
              <span><strong>Account:</strong> {proforma.bank_details.account_holder}</span>
              <span><strong>A/C No:</strong> <span className="font-mono font-bold text-brand-900">{proforma.bank_details.account_number}</span></span>
              <span><strong>IFSC:</strong> <span className="font-mono font-bold">{proforma.bank_details.ifsc_code}</span></span>
              <span className="col-span-2"><strong>Branch:</strong> {proforma.bank_details.branch}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal (Gross Line Value):</span>
            <span className="font-mono">₹{proforma.subtotal.toLocaleString('en-IN')}</span>
          </div>
          {proforma.total_discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Trade Discount:</span>
              <span className="font-mono">-₹{proforma.total_discount.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-700 font-semibold border-t border-slate-200 pt-1">
            <span>Taxable Value:</span>
            <span className="font-mono">₹{proforma.taxable_amount.toLocaleString('en-IN')}</span>
          </div>

          {proforma.cgst_amount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>CGST (Central Tax):</span>
              <span className="font-mono">₹{proforma.cgst_amount.toLocaleString('en-IN')}</span>
            </div>
          )}
          {proforma.sgst_amount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>SGST (State Tax):</span>
              <span className="font-mono">₹{proforma.sgst_amount.toLocaleString('en-IN')}</span>
            </div>
          )}
          {proforma.igst_amount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>IGST (Integrated Tax):</span>
              <span className="font-mono">₹{proforma.igst_amount.toLocaleString('en-IN')}</span>
            </div>
          )}

          <div className="flex justify-between text-sm font-bold text-brand-950 border-t-2 border-brand-900 pt-1.5 mt-1">
            <span>Proforma Total:</span>
            <span className="font-mono text-base">₹{proforma.grand_total.toLocaleString('en-IN')}</span>
          </div>

          <div className="flex justify-between text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 mt-2">
            <span>Advance Payable with Order:</span>
            <span className="font-mono">₹{proforma.advance_amount.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600 px-2 py-0.5">
            <span>Balance on Delivery:</span>
            <span className="font-mono">₹{proforma.balance_amount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="border-t border-slate-200 pt-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
          Terms & Conditions of Proforma:
        </h4>
        <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-slate-600">
          {(proforma.terms_conditions || []).map((term, i) => (
            <li key={i}>{term}</li>
          ))}
        </ul>
      </div>

      {/* Signatures */}
      <div className="flex justify-between items-end border-t border-slate-300 pt-6 mt-6">
        <div>
          <p className="text-[10px] text-slate-500">Prepared by: <strong>{proforma.created_by_name}</strong></p>
          <p className="text-[9px] text-slate-400">Computer Generated Document &bull; Validated Enterprise System</p>
        </div>
        <div className="text-center">
          <div className="h-12 border-b border-slate-400 w-48 mb-1"></div>
          <p className="text-[11px] font-bold text-slate-800">For ICON TECH PRO</p>
          <p className="text-[10px] text-slate-500">Authorised Signatory</p>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:static"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="min-h-full flex items-start justify-center py-2 sm:py-6 print:py-0 print:block"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden print:border-none print:shadow-none print:m-0 print:max-w-none print:rounded-none relative animate-in fade-in-50 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Controls Bar (Sticky on scroll, hidden on print) */}
          <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                Proforma Invoice &bull; <span className="font-mono text-brand-700">{proforma.proforma_number}</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                NOT A TAX INVOICE
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Copy selector */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCopy('BOTH')}
                  className={`px-2 py-1 rounded font-medium transition ${selectedCopy === 'BOTH' ? 'bg-white shadow text-brand-900 font-bold' : 'text-slate-600'}`}
                >
                  Both Copies
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCopy('ORIGINAL')}
                  className={`px-2 py-1 rounded font-medium transition ${selectedCopy === 'ORIGINAL' ? 'bg-white shadow text-brand-900 font-bold' : 'text-slate-600'}`}
                >
                  Customer Copy
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCopy('DUPLICATE')}
                  className={`px-2 py-1 rounded font-medium transition ${selectedCopy === 'DUPLICATE' ? 'bg-white shadow text-brand-900 font-bold' : 'text-slate-600'}`}
                >
                  Office Copy
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadOfflineHTML}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>HTML</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand-800 hover:bg-brand-900 rounded-xl shadow-sm transition active:scale-95"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Proforma Container */}
          <div id="printable-proforma-content">
            {(selectedCopy === 'BOTH' || selectedCopy === 'ORIGINAL') &&
              renderSingleCopy('ORIGINAL – CUSTOMER COPY', selectedCopy === 'ORIGINAL')}

            {(selectedCopy === 'BOTH' || selectedCopy === 'DUPLICATE') &&
              renderSingleCopy('DUPLICATE – OFFICE COPY', true)}
          </div>
        </div>
      </div>
    </div>
  );
}
