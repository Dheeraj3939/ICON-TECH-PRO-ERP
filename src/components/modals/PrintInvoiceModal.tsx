'use client';

import React from 'react';
import { X, Printer, Download, ShieldCheck } from 'lucide-react';
import type { Invoice } from '@/types/erp';

interface PrintInvoiceModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PrintInvoiceModal({ invoice, isOpen, onClose }: PrintInvoiceModalProps) {
  // Listen for Escape key
  React.useEffect(() => {
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
    const docTitle = `${invoice.invoice_number}_${cleanCustomer}`;
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
    link.download = `${invoice.invoice_number}_${cleanCustomer}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
          {/* Controls (Sticky on scroll, hidden during print) */}
          <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm print:hidden">
            <span className="text-sm font-bold text-slate-900">
              GST Tax Invoice &bull; <span className="font-mono text-brand-700">{invoice.invoice_number}</span>
            </span>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleDownloadOfflineHTML}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition active:scale-95"
                title="Download offline HTML invoice file"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Offline HTML</span>
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
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

        {/* Printable Tax Invoice Document */}
        <div id="printable-invoice-content" className="p-8 sm:p-10 text-slate-800 space-y-6 text-xs bg-white">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-300 pb-5">
            <div>
              <div className="mb-2">
                <img
                  src="/logo-transparent.png"
                  alt="ICON TECH PRO - Unified Solutions Specialist"
                  className="h-14 w-auto object-contain"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Ameer Estate, SR Nagar, Hyderabad, Telangana - 500038
              </p>
              <p className="text-[11px] text-slate-500">
                Phone: +91 98490 00001 &bull; Email: billing@icontechpro.in
              </p>
              <p className="text-[11px] font-bold text-slate-800 mt-1">
                GSTIN: 36AAACI9821L1Z4 &bull; PAN: AAACI9821L &bull; State Code: 36
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-900 border border-slate-300 rounded font-bold text-sm tracking-wider mb-2">
                TAX INVOICE
              </span>
              <div className="space-y-0.5 text-slate-600">
                <p><strong className="text-slate-900">Invoice No:</strong> {invoice.invoice_number}</p>
                <p><strong className="text-slate-900">Invoice Date:</strong> {invoice.invoice_date}</p>
                <p><strong className="text-slate-900">Due Date:</strong> {invoice.due_date}</p>
                {invoice.order_number && (
                  <p><strong className="text-slate-900">Order Ref:</strong> {invoice.order_number}</p>
                )}
              </div>
            </div>
          </div>

          {/* Billed To */}
          <div className="grid grid-cols-2 gap-4 p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Details of Receiver / Billed To:
              </span>
              <h3 className="font-bold text-slate-900 text-sm">
                {invoice.company_name || invoice.customer_name}
              </h3>
              {invoice.company_name && <p className="text-slate-700">Attn: {invoice.customer_name}</p>}
              <p className="text-slate-600 mt-0.5">{invoice.address || 'Hyderabad, Telangana'}</p>
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
              <p className="text-slate-600 mt-0.5">{invoice.address || 'Hyderabad, Telangana'}</p>
              <p className="text-slate-600 mt-1">State: Telangana (36)</p>
              <p className="text-slate-500 mt-1">Place of Supply: Hyderabad</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th className="py-2 px-3 w-8 text-center">#</th>
                  <th className="py-2 px-3">Description of Goods / Services</th>
                  <th className="py-2 px-3 w-20 text-center">HSN/SAC</th>
                  <th className="py-2 px-3 w-16 text-center">Qty</th>
                  <th className="py-2 px-3 w-24 text-right">Rate</th>
                  <th className="py-2 px-3 w-24 text-right">Taxable</th>
                  <th className="py-2 px-3 w-28 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                    <td className="p-2 font-medium text-slate-900">{it.description}</td>
                    <td className="p-2 text-center text-slate-600">{it.hsn_code}</td>
                    <td className="p-2 text-center">{it.quantity} {it.unit}</td>
                    <td className="p-2 text-right">₹{it.rate.toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right">₹{(it.rate * it.quantity).toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right font-bold text-slate-900">
                      ₹{it.total_amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Balance */}
          <div className="flex justify-end">
            <div className="w-72 space-y-1 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount:</span>
                <span className="font-semibold">₹{invoice.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST @ 9%:</span>
                <span>₹{(invoice.gst_amount / 2).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST @ 9%:</span>
                <span>₹{(invoice.gst_amount / 2).toLocaleString('en-IN')}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-300 flex justify-between font-bold text-slate-900 text-sm">
                <span>Invoice Total:</span>
                <span className="text-brand-700">₹{invoice.grand_total.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-emerald-600 pt-1">
                <span>Amount Paid / Advance:</span>
                <span className="font-semibold">₹{invoice.paid_amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-bold border-t border-slate-200 pt-1">
                <span>Balance Due:</span>
                <span>₹{invoice.balance_amount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Footer & Bank */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-300 text-[11px]">
            <div className="p-3 rounded bg-slate-50 border border-slate-200">
              <span className="font-bold block text-slate-900 mb-1">Company Bank Details</span>
              <span>Bank Name: <strong>HDFC Bank Ltd</strong></span><br />
              <span>A/C No: <strong>50200088192019</strong> (Current)</span><br />
              <span>IFSC Code: <strong>HDFC0000045</strong></span><br />
              <span>Branch: SR Nagar, Hyderabad</span>
            </div>

            <div className="text-right flex flex-col justify-between">
              <p className="font-bold text-slate-900">For ICON TECH PRO</p>
              <div className="pt-8">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Authorized Signatory &bull; Hyderabad
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar (Hidden during print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-200 bg-slate-50 print:hidden">
          <div className="text-xs text-slate-600 font-medium">
            Official Tax Invoice &bull; {invoice.invoice_number}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-sm transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md transition active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Print Tax Invoice
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
);
}
