'use client';

import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Truck, ShieldCheck } from 'lucide-react';
import type { DeliveryChallan } from '@/types/delivery-challan';

interface PrintDeliveryChallanModalProps {
  challan: DeliveryChallan | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PrintDeliveryChallanModal({ challan, isOpen, onClose }: PrintDeliveryChallanModalProps) {
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

  if (!isOpen || !challan) return null;

  const handleDownloadPDF = () => {
    const cleanCustomer = (challan.customer_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const docTitle = `${challan.challan_number.replace(/\//g, '_')}_${cleanCustomer}_Challan`;
    const prev = document.title;
    document.title = docTitle;
    window.print();
    setTimeout(() => {
      document.title = prev;
    }, 2500);
  };

  const handleDownloadOfflineHTML = () => {
    const cleanCustomer = (challan.customer_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const docElement = document.getElementById('printable-challan-content');
    if (!docElement) return;

    const clone = docElement.cloneNode(true) as HTMLElement;
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${challan.challan_number} - ${cleanCustomer} - Delivery Challan - ICON TECH PRO</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f1f5f9; padding: 20px; color: #0f172a; margin: 0; }
    .doc-card { max-width: 896px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .print-btn-bar { max-width: 896px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center; }
    .btn { background: #0f172a; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; }
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
    <div style="font-weight: bold; font-size: 14px;">Delivery Challan &bull; ${challan.challan_number}</div>
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
    link.download = `${challan.challan_number.replace(/\//g, '_')}_${cleanCustomer}_Challan.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderSingleCopy = (copyType: 'ORIGINAL – CUSTOMER COPY' | 'DUPLICATE – OFFICE COPY', isLast: boolean) => (
    <div className={`p-8 sm:p-10 text-slate-800 space-y-6 text-xs bg-white ${!isLast ? 'print:break-after-page border-b-4 border-dashed border-slate-300 pb-12 mb-12 print:border-none print:pb-0 print:mb-0' : ''}`}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-800 pb-5">
        <div>
          <div className="mb-2">
            <img
              src="/logo-transparent.png"
              alt="ICON TECH PRO"
              className="h-14 w-auto object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>
          <p className="text-[11px] text-slate-600 font-medium">
            Audio-Visual, IT Solutions, Security & Enterprise Infrastructure
          </p>
          <p className="text-[11px] text-slate-500">
            Ameer Estate, SR Nagar, Hyderabad, Telangana - 500038
          </p>
          <p className="text-[11px] text-slate-700 font-semibold mt-1">
            Phones: +91 96182 40232 &bull; +91 98490 14959 &bull; Email: icontechpro@gmail.com &bull; Web: www.icontechpro.in
          </p>
          <p className="text-[11px] text-slate-700 font-semibold">
            GSTIN: 36AAACI9821L1Z4 &bull; State Code: 36
          </p>
        </div>

        <div className="text-right">
          <div className="inline-block px-3 py-1 bg-slate-900 text-white rounded font-bold text-xs tracking-wider mb-1.5 shadow-sm">
            DELIVERY CHALLAN
          </div>
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
            DELIVERY DISPATCH &bull; NOT A TAX INVOICE
          </div>
          <div className="inline-block px-2.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-700 uppercase mb-2">
            {copyType}
          </div>
          <div className="space-y-0.5 text-slate-600 text-left sm:text-right">
            <p><strong className="text-slate-900">Challan No:</strong> <span className="font-mono font-bold text-brand-900">{challan.challan_number}</span></p>
            <p><strong className="text-slate-900">Date:</strong> {challan.challan_date}</p>
            <p><strong className="text-slate-900">Purpose:</strong> <span className="font-semibold text-slate-800">{challan.purpose}</span></p>
            {challan.reference_number && (
              <p><strong className="text-slate-900">Ref {challan.reference_type || 'Doc'}:</strong> {challan.reference_number}</p>
            )}
          </div>
        </div>
      </div>

      {/* Customer & Consignee Dispatch Coordinates */}
      <div className="grid grid-cols-2 gap-4 p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Customer / Consignee:
          </span>
          <h3 className="font-bold text-slate-900 text-sm">
            {challan.company_name || challan.customer_name}
          </h3>
          {challan.company_name && <p className="text-slate-700">Attn: {challan.customer_name}</p>}
          <p className="text-slate-600 mt-0.5 whitespace-pre-line">{challan.customer_address}</p>
          <p className="text-slate-700 font-semibold mt-1">
            GSTIN: {challan.gstin || 'Unregistered / B2C'}
          </p>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Destination / Delivery Site:
          </span>
          <p className="text-slate-700 font-medium whitespace-pre-line">{challan.delivery_address || challan.customer_address}</p>
          <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-0.5 text-[11px] text-slate-600">
            <p><strong>Transporter:</strong> {challan.transporter_name || 'Direct Vehicle Dispatch'}</p>
            {challan.vehicle_number && <p><strong>Vehicle No:</strong> <span className="font-mono font-bold">{challan.vehicle_number}</span></p>}
            {challan.eway_bill_number && <p><strong>E-Way Bill:</strong> <span className="font-mono">{challan.eway_bill_number}</span></p>}
          </div>
        </div>
      </div>

      {/* Line Items Table with Serial Numbers */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px]">
              <th className="py-2.5 px-3 font-semibold">#</th>
              <th className="py-2.5 px-3 font-semibold">Product Description & Model</th>
              <th className="py-2.5 px-2 font-semibold">HSN/SAC</th>
              <th className="py-2.5 px-2 font-semibold text-center">Quantity</th>
              <th className="py-2.5 px-3 font-semibold">Serial Numbers / Unit Identification</th>
              <th className="py-2.5 px-3 font-semibold">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {challan.items.map((it, idx) => (
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
                <td className="py-2.5 px-2 text-center font-bold text-slate-900">
                  {it.quantity} {it.unit || 'Nos.'}
                </td>
                <td className="py-2.5 px-3">
                  {it.serial_numbers && it.serial_numbers.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {it.serial_numbers.map((sn, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px] text-slate-800"
                        >
                          {sn}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">N/A - Non-serialized</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-600">{it.remarks || 'Standard packaging'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Statutory Rules & Purpose Declaration */}
      <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 text-[10px] text-amber-900 space-y-1">
        <p className="font-bold uppercase tracking-wider">Statutory Goods Movement Declaration:</p>
        <p>
          1. This Delivery Challan is issued under Rule 55 of CGST Rules, 2017 for goods movement for reason:{' '}
          <strong>{challan.purpose}</strong>. It does not constitute a Tax Invoice.
        </p>
        <p>2. Goods received must be verified against serial numbers and physical packing at the time of delivery.</p>
      </div>

      {/* 3-Point Sign-Off & Physical Acknowledgement Grid */}
      <div className="grid grid-cols-3 gap-4 border-t border-slate-300 pt-6 mt-6">
        <div>
          <p className="text-[10px] text-slate-500 mb-8">Prepared & Verified By:</p>
          <p className="text-[11px] font-bold text-slate-800">{challan.prepared_by_name}</p>
          <p className="text-[10px] text-slate-500">Dispatch Executive, ICON TECH PRO</p>
        </div>

        <div className="text-center">
          <p className="text-[10px] text-slate-500 mb-8">Authorised Signatory:</p>
          <div className="h-6 border-b border-slate-300 w-36 mx-auto mb-1"></div>
          <p className="text-[11px] font-bold text-slate-800">{challan.authorized_by_name || 'Borra Narsimulu'}</p>
          <p className="text-[10px] text-slate-500">Managing Director / Authorized</p>
        </div>

        <div className="p-3 border border-slate-300 rounded-lg bg-slate-50/50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Receiver Acknowledgement:
          </p>
          <div className="h-10 border-b border-dashed border-slate-300 mb-1"></div>
          <p className="text-[10px] text-slate-600">Name: <strong>{challan.receiver_name || '____________________'}</strong></p>
          <p className="text-[10px] text-slate-600">Date & Phone: <strong>{challan.receiver_signature_date ? new Date(challan.receiver_signature_date).toLocaleDateString('en-GB') : '____________________'}</strong></p>
          <p className="text-[9px] text-slate-400 mt-1">Company Seal & Signature</p>
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                Delivery Challan &bull; <span className="font-mono text-brand-700">{challan.challan_number}</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                {challan.purpose}
              </span>
            </div>

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
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition active:scale-95"
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

          {/* Printable Container */}
          <div id="printable-challan-content">
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
