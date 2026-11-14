'use client';

import React, { useState, useEffect } from 'react';
import { X, Printer, Download, ShieldCheck } from 'lucide-react';
import type { Invoice } from '@/types/erp';
import { numberToWordsINR } from '@/lib/utils/inr-words';

interface PrintInvoiceModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PrintInvoiceModal({ invoice, isOpen, onClose }: PrintInvoiceModalProps) {
  const [selectedCopy, setSelectedCopy] = useState<'BOTH' | 'ORIGINAL' | 'DUPLICATE'>('BOTH');

  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !invoice) return null;

  const handleDownloadPDF = () => {
    const cleanCustomer = (invoice.customer_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const docTitle = `${invoice.invoice_number.replace(/\//g, '_')}_${cleanCustomer}_Invoice`;
    const prev = document.title;
    document.title = docTitle;
    window.print();
    setTimeout(() => {
      document.title = prev;
    }, 2500);
  };

  const handleDownloadOfflineHTML = () => {
    const cleanCustomer = (invoice.customer_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const docElement = document.getElementById('printable-invoice-content');
    if (!docElement) return;

    const clone = docElement.cloneNode(true) as HTMLElement;
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${invoice.invoice_number} - ${cleanCustomer} - ICON TECH PRO</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f1f5f9; padding: 20px; color: #0f172a; margin: 0; }
    .doc-card { max-width: 896px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .print-btn-bar { max-width: 896px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center; }
    .btn { background: #2563eb; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; }
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
    <div style="font-weight: bold; font-size: 14px;">Tax Invoice &bull; ${invoice.invoice_number}</div>
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
    link.download = `${invoice.invoice_number.replace(/\//g, '_')}_${cleanCustomer}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderSingleCopy = (copyType: 'ORIGINAL – CUSTOMER COPY' | 'DUPLICATE – OFFICE COPY', isLast: boolean) => (
    <div className={`p-8 sm:p-10 text-slate-800 space-y-6 text-xs bg-white ${!isLast ? 'print:break-after-page border-b-4 border-dashed border-slate-300 pb-12 mb-12 print:border-none print:pb-0 print:mb-0' : ''}`}>
      {/* Header */}
      <div className="flex justify-between items-start border-b border-slate-300 pb-5">
        <div>
          <div className="mb-2">
            <img
              src="/logo-transparent.png"
              alt="ICON TECH PRO - Unified Solutions Specialist"
              className="h-14 w-auto object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Ameer Estate, SR Nagar, Hyderabad, Telangana - 500038
          </p>
          <p className="text-[11px] text-slate-500">
            Phones: +91 96182 40232 &bull; +91 98490 14959 &bull; Email: icontechpro@gmail.com &bull; Web: www.icontechpro.in
          </p>
          <p className="text-[11px] font-bold text-slate-800 mt-1">
            GSTIN: 36AAACI9821L1Z4 &bull; PAN: AAACI9821L &bull; State Code: 36
          </p>
        </div>

        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-slate-900 text-white rounded font-bold text-xs tracking-wider mb-1.5 shadow-sm">
            TAX INVOICE
          </span>
          <div className="inline-block px-2.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-700 uppercase mb-2 block">
            {copyType}
          </div>
          <div className="space-y-0.5 text-slate-600 text-left sm:text-right">
            <p><strong className="text-slate-900">Invoice No:</strong> <span className="font-mono font-bold text-brand-700">{invoice.invoice_number}</span></p>
            <p><strong className="text-slate-900">Invoice Date:</strong> {invoice.invoice_date}</p>
            <p><strong className="text-slate-900">Due Date:</strong> {invoice.due_date}</p>
            {invoice.order_number && (
              <p><strong className="text-slate-900">Order Ref:</strong> {invoice.order_number}</p>
            )}
          </div>
        </div>
      </div>

      {/* Billed To & Shipped To */}
      <div className="grid grid-cols-2 gap-4 p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Details of Receiver / Billed To:
          </span>
          <h3 className="font-bold text-slate-900 text-sm">
            {invoice.company_name || invoice.customer_name}
          </h3>
          {invoice.company_name && <p className="text-slate-700">Attn: {invoice.customer_name}</p>}
          <p className="text-slate-600 mt-0.5 whitespace-pre-line">{invoice.address || 'Hyderabad, Telangana'}</p>
          <p className="text-slate-700 font-semibold mt-1">
            GSTIN: {invoice.gstin || 'Unregistered / B2C'}
          </p>
          <p className="text-slate-600">State: Telangana (36)</p>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Details of Consignee / Shipped To:
          </span>
          <h3 className="font-bold text-slate-900">
            {invoice.company_name || invoice.customer_name}
          </h3>
          <p className="text-slate-600 mt-0.5 whitespace-pre-line">{invoice.address || 'Hyderabad, Telangana'}</p>
          <p className="text-slate-600 mt-1">Place of Supply: {invoice.place_of_supply || '36 - Telangana'}</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="border border-slate-300 rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[11px]">
            <tr>
              <th className="py-2.5 px-3 w-8 text-center">#</th>
              <th className="py-2.5 px-3">Description of Goods / Services</th>
              <th className="py-2.5 px-3 w-20 text-center">HSN/SAC</th>
              <th className="py-2.5 px-3 w-16 text-center">Qty</th>
              <th className="py-2.5 px-3 w-24 text-right">Rate</th>
              <th className="py-2.5 px-3 w-24 text-right">Taxable</th>
              <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoice.items.map((it, idx) => (
              <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                <td className="p-2.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                <td className="p-2.5 font-medium text-slate-900">{it.description}</td>
                <td className="p-2.5 text-center text-slate-600 font-mono">{it.hsn_code}</td>
                <td className="p-2.5 text-center font-bold text-slate-800">{it.quantity} {it.unit}</td>
                <td className="p-2.5 text-right font-mono">₹{it.rate.toLocaleString('en-IN')}</td>
                <td className="p-2.5 text-right font-mono">₹{(it.rate * it.quantity).toLocaleString('en-IN')}</td>
                <td className="p-2.5 text-right font-bold text-slate-900 font-mono">
                  ₹{it.total_amount.toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Amount in words & Totals */}
      <div className="grid grid-cols-2 gap-4 items-start">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Amount Chargeable in Words:
          </span>
          <p className="font-semibold text-slate-900 text-xs italic">
            {numberToWordsINR(invoice.grand_total)}
          </p>
        </div>

        <div className="space-y-1 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Taxable Amount:</span>
            <span className="font-semibold font-mono">₹{invoice.subtotal.toLocaleString('en-IN')}</span>
          </div>
          {invoice.cgst_amount > 0 ? (
            <>
              <div className="flex justify-between text-slate-600">
                <span>CGST (Central Tax):</span>
                <span className="font-mono">₹{invoice.cgst_amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST (State Tax):</span>
                <span className="font-mono">₹{invoice.sgst_amount.toLocaleString('en-IN')}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-slate-600">
              <span>IGST (Integrated Tax):</span>
              <span className="font-mono">₹{invoice.igst_amount.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="pt-1.5 border-t border-slate-300 flex justify-between font-bold text-slate-900 text-sm">
            <span>Invoice Total:</span>
            <span className="text-brand-700 font-mono">₹{invoice.grand_total.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-emerald-700 pt-1">
            <span>Amount Paid / Advance:</span>
            <span className="font-semibold font-mono">₹{invoice.paid_amount.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-rose-600 font-bold border-t border-slate-200 pt-1">
            <span>Balance Due:</span>
            <span className="font-mono">₹{invoice.balance_amount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Footer & Bank */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-300 text-[11px]">
        <div className="p-3 rounded bg-slate-50 border border-slate-200">
          <span className="font-bold block text-slate-900 mb-1">Company Bank Remittance Details</span>
          <span>Bank Name: <strong>IDBI Bank</strong></span><br />
          <span>A/C Holder: <strong>ICON TECH PRO</strong></span><br />
          <span>A/C No: <strong className="font-mono">0426653800000161</strong></span><br />
          <span>IFSC Code: <strong className="font-mono">IBKL0000426</strong></span><br />
          <span>Branch: Bandri Complex, SR Nagar, Hyderabad</span>
        </div>

        <div className="text-right flex flex-col justify-between">
          <p className="font-bold text-slate-900">For ICON TECH PRO</p>
          <div className="pt-8">
            <div className="h-6 border-b border-slate-300 w-36 ml-auto mb-1"></div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Authorized Signatory &bull; Hyderabad
            </p>
          </div>
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
          {/* Controls Bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm print:hidden">
            <span className="text-sm font-bold text-slate-900">
              GST Tax Invoice &bull; <span className="font-mono text-brand-700">{invoice.invoice_number}</span>
            </span>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Copy selector */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCopy('BOTH')}
                  className={`px-2 py-1 rounded font-medium transition ${selectedCopy === 'BOTH' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-600'}`}
                >
                  Both Copies
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCopy('ORIGINAL')}
                  className={`px-2 py-1 rounded font-medium transition ${selectedCopy === 'ORIGINAL' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-600'}`}
                >
                  Customer Copy
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCopy('DUPLICATE')}
                  className={`px-2 py-1 rounded font-medium transition ${selectedCopy === 'DUPLICATE' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-600'}`}
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
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition active:scale-95"
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

          {/* Printable Invoice Container */}
          <div id="printable-invoice-content">
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
