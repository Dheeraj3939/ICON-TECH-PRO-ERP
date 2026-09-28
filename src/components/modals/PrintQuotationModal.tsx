'use client';

import React from 'react';
import { X, Printer, Download, FileText, CheckCircle2, Mail, MessageSquare, ShieldCheck } from 'lucide-react';
import type { Quotation } from '@/types/erp';
import { recordQuotationPreview, verifyAndApproveQuotation } from '@/lib/actions/quotations';
import { SendQuotationEmailModal } from '@/components/modals/SendQuotationEmailModal';
import { SendQuotationWhatsAppModal } from '@/components/modals/SendQuotationWhatsAppModal';

// Helper: Convert INR amount to words in Indian Numbering System
function numberToWordsINR(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only.';
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(val: number): string {
    let str = '';
    if (val > 99) {
      str += a[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
    }
    if (val > 19) {
      str += b[Math.floor(val / 10)] + (val % 10 ? '-' + a[val % 10] : '') + ' ';
    } else if (val > 0) {
      str += a[val] + ' ';
    }
    return str;
  }

  let words = '';
  let n = integerPart;
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundredAndRem = n;

  if (crore > 0) words += inWords(crore) + 'Crore, ';
  if (lakh > 0) words += inWords(lakh) + 'Lakh, ';
  if (thousand > 0) words += inWords(thousand) + 'Thousand, ';
  if (hundredAndRem > 0) words += inWords(hundredAndRem);

  words = words.trim().replace(/,\s*$/, '');
  let result = words ? 'INR ' + words + ' Rupees' : 'INR Zero Rupees';

  if (decimalPart > 0) {
    result += ' And ' + inWords(decimalPart).trim() + ' Paise';
  }

  return result + ' Only.';
}

interface PrintQuotationModalProps {
  quotation: Quotation | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PrintQuotationModal({ quotation, isOpen, onClose }: PrintQuotationModalProps) {
  const [quotationState, setQuotationState] = React.useState<Quotation | null>(quotation);
  const [isVerified, setIsVerified] = React.useState(false);
  const [isApproved, setIsApproved] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = React.useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = React.useState(false);
  const [showRevisions, setShowRevisions] = React.useState(false);

  React.useEffect(() => {
    setQuotationState(quotation);
    if (quotation) {
      const alreadyApproved = quotation.status === 'Approved' || quotation.status === 'Sent' || quotation.status === 'Accepted';
      setIsApproved(alreadyApproved);
      setIsVerified(alreadyApproved);
      // Auto-record PDF preview requirement
      recordQuotationPreview(quotation.id).catch(() => {});
    }
  }, [quotation, isOpen]);

  const handleVerifyAndApprove = async () => {
    if (!quotationState) return;
    setIsVerifying(true);
    try {
      const res = await verifyAndApproveQuotation(quotationState.id, { verified: true });
      if (res.success && res.quotation) {
        setQuotationState(res.quotation);
        setIsApproved(true);
      }
    } catch (err) {
      console.error('Approval failed:', err);
    } finally {
      setIsVerifying(false);
    }
  };
  // Listen for Escape key to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !quotation) return null;

  // Format date helper: "08 Sep 2026"
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '08 Sep 2026';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Calculate validity date or days
  const formatValidity = () => {
    if (quotation.valid_until) return formatDate(quotation.valid_until);
    if (quotation.quotation_date && quotation.validity_days) {
      try {
        const d = new Date(quotation.quotation_date);
        d.setDate(d.getDate() + quotation.validity_days);
        return formatDate(d.toISOString().split('T')[0]);
      } catch {
        return `${quotation.validity_days} Days`;
      }
    }
    return `${quotation.validity_days || 7} Days`;
  };

  const totalQty = quotation.items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
  const bank = quotation.bank_details || {
    bank_name: 'IDBI Bank',
    account_holder: 'ICON TECH PRO',
    account_number: '0426653800000161',
    ifsc_code: 'IBKL0000426',
    branch: 'BANDRI COMPLEX',
  };

  const terms = (quotation.terms_conditions && quotation.terms_conditions.length > 0)
    ? quotation.terms_conditions
    : [
        'Payment : 100% ADVANCE PAYMENT',
        'Taxes : GST 18% INCLUSIVE',
        'Delivery : IMMEDIATELY',
        'Warranty : AS PER COMPANY TERMS',
        'Validity : 7 Days',
        'TRANSPORTATION AND INSTALLATION CHARGES INCLUSIVE',
      ];

  const placeOfSupply = quotation.place_of_supply || '36-TELANGANA';
  const isTelangana = placeOfSupply.startsWith('36');
  const dispatchAddress = quotation.dispatch_from ||
    '7-1-62/A, FLAT NO-503, 5 TH FLOOR, AMEER ESTATE\nSANJEEVA REDDY NAGAR, SANJEEVA REDDY NAGAR\nHyderabad, TELANGANA, 500038';

  // Multi-Download handler: Save to PDF with exact clean filename ICON_TECH_PRO_Quotation_QT-2026-27-0048
  const handleDownloadPDF = () => {
    const sanitizedQuoteNum = (quotation.quotation_number || 'QTN').replace(/[\/\\]/g, '-');
    const docTitle = `ICON_TECH_PRO_Quotation_${sanitizedQuoteNum}`;
    const prev = document.title;
    document.title = docTitle;
    window.print();
    setTimeout(() => {
      document.title = prev;
    }, 2500);
  };

  // Download Offline Standalone HTML Proposal
  const handleDownloadOfflineHTML = () => {
    const cleanCompany = (quotation.company_name || quotation.customer_name || 'Customer')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const docElement = document.getElementById('printable-quotation-content');
    if (!docElement) return;

    // Clone element to convert relative images into embedded Base64 Data URLs for 100% offline independence
    const clone = docElement.cloneNode(true) as HTMLElement;
    const origImgs = docElement.querySelectorAll('img');
    const cloneImgs = clone.querySelectorAll('img');

    for (let i = 0; i < cloneImgs.length; i++) {
      const orig = origImgs[i];
      const target = cloneImgs[i];
      if (orig && orig.naturalWidth > 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = orig.naturalWidth;
          canvas.height = orig.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(orig, 0, 0);
            target.src = canvas.toDataURL('image/png');
          }
        } catch (e) {
          console.warn('Could not serialize image to dataURL', e);
        }
      }
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${quotation.quotation_number} - ${cleanCompany} - ICON TECH PRO</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f1f5f9; padding: 20px; color: #0f172a; margin: 0; }
    .doc-card { max-width: 896px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .print-btn-bar { max-width: 896px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center; }
    .btn { background: #2563eb; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; }
    .btn:hover { background: #1d4ed8; }
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
    <div style="font-weight: bold; font-size: 14px;">ICON TECH PRO Official Proposal &bull; ${quotation.quotation_number}</div>
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
    link.download = `${quotation.quotation_number}_${cleanCompany}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
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
          {/* Modal Controls (Sticky on scroll, Hidden in Print) */}
          <div className="sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm print:hidden gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                <span className="hidden sm:inline">Official Quotation &bull; </span>
                <span className="font-mono text-blue-700 font-black">{quotation.quotation_number}</span>
              </span>
              {(quotation.revision_number || 1) > 1 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                  Rev {quotation.revision_number}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowRevisions(!showRevisions)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition active:scale-95 cursor-pointer"
                title="View Revision History"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Revisions {quotation.versions && quotation.versions.length > 0 ? `(${quotation.versions.length})` : ''}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadOfflineHTML}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition active:scale-95 cursor-pointer"
                title="Download offline HTML proposal file"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Download Offline</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
                title="Save as PDF or Print"
              >
                <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Print / PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Close Preview (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Revision History Collapsible Drawer */}
          {showRevisions && (
            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs space-y-2 print:hidden">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-brand-600" />
                  Revision History & Snapshots
                </span>
                <span className="text-[11px] text-slate-500">Active: Rev {quotation.revision_number || 1}</span>
              </div>
              {(!quotation.versions || quotation.versions.length === 0) ? (
                <p className="text-slate-500 italic text-[11px]">This is the initial baseline version (Rev 1). No previous revisions archived.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {quotation.versions.map((ver, vIdx) => (
                    <div key={vIdx} className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{ver.display_number || `Rev ${ver.version_number}`}</div>
                        <div className="text-[11px] text-slate-500">
                          {ver.created_by_name || 'Sales'} &bull; {ver.created_at ? new Date(ver.created_at).toLocaleDateString('en-IN') : 'Archived'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-slate-900">₹{(ver.grand_total || 0).toLocaleString('en-IN')}</div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{ver.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Printable Quotation Document */}
          <div id="printable-quotation-content" className="p-4 sm:p-10 md:p-12 text-slate-900 bg-white font-sans text-[11px] leading-normal print:p-8 w-full max-w-full">
          
          {/* =========================================================================
              1. HEADER: OFFICIAL LOGO + COMPANY DETAILS (LEFT) & QUOTATION TITLE (RIGHT)
             ========================================================================= */}
          <div className="flex justify-between items-start pb-4">
            {/* Left: Official Vertical Logo Box + Contact Metadata */}
            <div className="flex items-start gap-4">
              <img
                src="/icon-box-logo.png"
                alt="ICON TECH PRO Logo"
                className="w-16 sm:w-20 h-auto object-contain shrink-0"
              />
              <div className="space-y-0.5 text-[10.5px]">
                <h1 className="text-base font-black tracking-wide text-slate-950 uppercase">
                  ICON TECH PRO
                </h1>
                <p className="font-bold text-slate-900">
                  GSTIN 36BTAPB1826R2ZJ
                </p>
                <p className="text-slate-700 leading-tight">
                  7-1-62/A, FLAT NO-503, 5 TH FLOOR, AMEER ESTATE<br />
                  SANJEEVA REDDY NAGAR, SANJEEVA REDDY NAGAR<br />
                  Hyderabad, TELANGANA, 500038
                </p>
                <p className="text-slate-700 pt-0.5">
                  Mobile +91 8099909918, 809999997
                </p>
                <p className="text-slate-700">
                  Email icontechpro@gmail.com
                </p>
                <p className="text-slate-700">
                  Website www.icontechpro.in
                </p>
              </div>
            </div>

            {/* Right: QUOTATION Title */}
            <div className="text-right">
              <h2 className="text-xl sm:text-2xl font-black text-blue-600 tracking-wider">
                Q U O T A T I O N
              </h2>
              <p className="text-[9.5px] font-bold tracking-widest text-slate-500 uppercase mt-0.5">
                ORIGINAL FOR RECIPIENT
              </p>
            </div>
          </div>

          {/* =========================================================================
              2. TWO-COLUMN ADDRESS & QUOTATION METADATA SECTION
             ========================================================================= */}
          <div className="grid grid-cols-12 gap-4 pt-4 pb-4">
            {/* Left: Bill To & Dispatch From (7 cols) */}
            <div className="col-span-7 space-y-4">
              {/* Bill To */}
              <div>
                <span className="font-bold text-slate-900 block text-[11px] mb-0.5">
                  Bill To:
                </span>
                <p className="font-bold text-slate-950">
                  {quotation.customer_name}
                </p>
                {quotation.company_name && (
                  <p className="font-semibold text-slate-900">
                    {quotation.company_name}
                  </p>
                )}
                {quotation.phone && (
                  <p className="text-slate-700">
                    Ph: {quotation.phone}
                  </p>
                )}
                <p className="text-slate-700 whitespace-pre-line leading-snug">
                  {quotation.address || 'Hyderabad City, TELANGANA'}
                </p>
              </div>

              {/* Dispatch From */}
              <div>
                <span className="font-bold text-slate-900 block text-[11px] mb-0.5">
                  Dispatch From:
                </span>
                <p className="font-bold text-slate-950">
                  ICON TECH PRO
                </p>
                <p className="text-slate-700 whitespace-pre-line leading-snug">
                  {dispatchAddress}
                </p>
              </div>
            </div>

            {/* Right: Quotation Details Key-Values (5 cols) */}
            <div className="col-span-5 text-right flex flex-col items-end justify-start space-y-1 text-[11px]">
              <div className="grid grid-cols-2 gap-x-2 text-right w-full max-w-[260px]">
                <span className="font-bold text-slate-900">Quotation #:</span>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="font-black text-slate-950 font-mono text-left">{quotation.quotation_number}</span>
                  {(quotation.revision_number || 1) > 1 && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      Rev {quotation.revision_number}
                    </span>
                  )}
                </div>

                <span className="font-bold text-slate-900">Quotation Date:</span>
                <span className="font-semibold text-slate-800 text-left">{formatDate(quotation.quotation_date)}</span>

                <span className="font-bold text-slate-900">Validity:</span>
                <span className="font-semibold text-slate-800 text-left">{formatValidity()}</span>

                <span className="font-bold text-slate-900">Place of Supply:</span>
                <span className="font-semibold text-slate-800 text-left">{placeOfSupply}</span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              3. ITEMS TABLE (ROYAL BLUE HEADER, MULTI-LINE SPECS)
             ========================================================================= */}
          <div className="mt-2 border-t border-slate-300 w-full">
            <table className="w-full table-fixed text-left border-collapse">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[42%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="bg-blue-600 text-white font-bold text-[10.5px]">
                  <th className="py-2 px-2.5 w-8 text-center">#</th>
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3 text-center">HSN/SAC</th>
                  <th className="py-2 px-3 text-right">Rate / Item</th>
                  <th className="py-2 px-3 text-center">Qty</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {quotation.quotation_format === 'DETAILED_PROJECT' && quotation.project_sections && quotation.project_sections.length > 0 ? (
                  quotation.project_sections.map((sec, sIdx) => (
                    <React.Fragment key={sec.section_id || sIdx}>
                      <tr className="bg-slate-100 font-black text-slate-800 text-[11px]">
                        <td colSpan={6} className="py-2 px-3 tracking-wide uppercase">
                          {sec.section_title}
                        </td>
                      </tr>
                      {sec.items.map((it, idx) => {
                        const lineGross = it.selling_price * it.quantity;
                        const taxable = lineGross - (it.discount_amount || 0);
                        const formattedRate = (it.selling_price || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });
                        const formattedQty = Number(it.quantity || 1).toFixed(3);
                        const formattedAmount = taxable.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });

                        return (
                          <tr key={idx} className="align-top">
                            <td className="py-2 px-2.5 text-center font-bold text-slate-700">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3">
                              <p className="font-bold text-slate-950 whitespace-pre-line leading-relaxed">
                                {it.product_name}
                              </p>
                            </td>
                            <td className="py-2 px-3 text-center text-slate-700">
                              {it.hsn_sac || '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-slate-900">
                              {formattedRate}
                            </td>
                            <td className="py-2 px-3 text-center font-medium text-slate-900">
                              {formattedQty}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-slate-950">
                              {formattedAmount}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 font-bold text-[10.5px] text-slate-700">
                        <td colSpan={5} className="py-1 px-3 text-right">
                          {sec.section_title} Subtotal:
                        </td>
                        <td className="py-1 px-3 text-right">
                          ₹{Number(sec.section_total || sec.section_subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))
                ) : (
                  quotation.items.map((it, idx) => {
                    const lineGross = it.selling_price * it.quantity;
                    const taxable = lineGross - (it.discount_amount || 0);
                    const formattedRate = (it.selling_price || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                    const formattedQty = Number(it.quantity || 1).toFixed(3);
                    const formattedAmount = taxable.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });

                    return (
                      <tr key={idx} className="align-top">
                        <td className="py-2.5 px-2.5 text-center font-bold text-slate-700">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-950 whitespace-pre-line leading-relaxed">
                            {it.product_name}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-700">
                          {it.hsn_sac || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                          {formattedRate}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-slate-900">
                          {formattedQty}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-950">
                          {formattedAmount}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* =========================================================================
              4. TOTALS & TAX BREAKDOWN (RIGHT-ALIGNED)
             ========================================================================= */}
          <div className="flex justify-end pt-3 pb-2">
            <div className="w-full max-w-xs sm:w-72 space-y-1 text-[11px] text-slate-800">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-700">Taxable Amount</span>
                <span className="font-semibold text-slate-900">
                  ₹{quotation.taxable_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {isTelangana ? (
                <>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-700">CGST 9.0%</span>
                    <span className="font-semibold text-slate-900">
                      ₹{(quotation.cgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-700">SGST 9.0%</span>
                    <span className="font-semibold text-slate-900">
                      ₹{(quotation.sgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">IGST 18.0%</span>
                  <span className="font-semibold text-slate-900">
                    ₹{(quotation.igst_amount || ((quotation.cgst_amount || 0) + (quotation.sgst_amount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1 border-t border-slate-300">
                <span className="text-sm font-black text-slate-950">Total</span>
                <span className="text-base font-black text-slate-950">
                  ₹{Math.round(quotation.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              5. SUMMARY STRIP (TOTAL ITEMS/QTY & WORDS) BOUNDED BY BLUE BARS
             ========================================================================= */}
          <div className="my-3 py-1.5 px-3 border-y-2 border-blue-600 flex flex-col sm:flex-row justify-between items-center text-[10.5px] font-bold text-slate-900 gap-2">
            <div>
              Total Items / Qty : {quotation.items.length} / {totalQty.toFixed(3)}
            </div>
            <div className="text-right">
              Total amount (in words): {numberToWordsINR(quotation.grand_total)}
            </div>
          </div>

          {/* =========================================================================
              6. BANK DETAILS & TERMS (LEFT) + OFFICIAL DIGITAL SIGNATURE (RIGHT)
             ========================================================================= */}
          <div className="grid grid-cols-12 gap-4 pt-2">
            {/* Left: Bank Details & Terms (8 cols) */}
            <div className="col-span-8 space-y-4">
              {/* Bank Details */}
              <div className="text-[10.5px]">
                <h4 className="font-bold text-slate-950 mb-0.5 underline">
                  Bank Details:
                </h4>
                <div className="grid grid-cols-[100px_1fr] gap-x-2 leading-tight">
                  <span className="text-slate-700 font-medium">Bank:</span>
                  <span className="font-bold text-slate-900">{bank.bank_name}</span>

                  <span className="text-slate-700 font-medium">Account Holder:</span>
                  <span className="font-bold text-slate-900">{bank.account_holder}</span>

                  <span className="text-slate-700 font-medium">Account #:</span>
                  <span className="font-bold text-slate-900 font-mono">{bank.account_number}</span>

                  <span className="text-slate-700 font-medium">IFSC Code:</span>
                  <span className="font-bold text-slate-900 font-mono">{bank.ifsc_code}</span>

                  <span className="text-slate-700 font-medium">Branch:</span>
                  <span className="font-bold text-slate-900">{bank.branch}</span>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="text-[10px]">
                <h4 className="font-bold text-slate-950 mb-1">
                  Terms and Conditions:
                </h4>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-800 leading-snug">
                  {terms.map((term, tIdx) => (
                    <li key={tIdx} className="font-medium">
                      {term.replace(/^[0-9]+\.\s*/, '')}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Right: For ICON TECH PRO + Official Digital Stamp Seal (4 cols) */}
            <div className="col-span-4 flex flex-col items-end justify-between pt-1">
              <div className="text-right w-full">
                <p className="font-bold text-slate-950 text-xs">
                  For ICON TECH PRO
                </p>
                
                {/* Official Stamp & Digital Signature Seal */}
                {(quotation.include_signature ?? true) && (
                  <div className="relative my-2 flex justify-end">
                    <img
                      src="/icon-stamp.png"
                      alt="ICON TECH PRO Authorized Digital Stamp & Signature"
                      className="w-32 sm:w-36 h-auto object-contain mix-blend-multiply"
                    />
                  </div>
                )}

                <p className="font-bold text-slate-900 text-[11px] mt-1">
                  Authorized Signatory
                </p>
              </div>
            </div>
          </div>

          {/* =========================================================================
              7. FOOTER: DIGITALLY SIGNED WATERMARK
             ========================================================================= */}
          <div className="pt-8 text-center text-[9.5px] text-slate-500 font-medium border-t border-slate-100 mt-6">
            Page 1 / 1 &bull; This is a digitally signed document.
          </div>

        </div>

        {/* Modal Bottom Actions (Hidden in Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-200 bg-slate-50 print:hidden">
          <div className="text-xs text-slate-600 font-medium">
            Official ICON TECH PRO Commercial Quotation &bull; Page 1 of 1
            {(quotation.revision_number || 1) > 1 && ` • Revision ${quotation.revision_number}`}
          </div>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              disabled={!isApproved}
              onClick={() => setIsEmailModalOpen(true)}
              title={isApproved ? "Send via Zoho Mail (Corporate SMTP)" : "Quotation must be verified & approved first"}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-sm transition cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Send Email</span>
            </button>

            <button
              type="button"
              disabled={!isApproved}
              onClick={() => setIsWhatsAppModalOpen(true)}
              title={isApproved ? "Send via WhatsApp Business (Meta Cloud API)" : "Quotation must be verified & approved first"}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-sm transition cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Send WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadOfflineHTML}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
              title="Download offline self-contained HTML file"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>HTML</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-sm transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>

  {/* Multi-Channel Dispatch Modals */}
  <SendQuotationEmailModal
    quotation={quotationState}
    isOpen={isEmailModalOpen}
    onClose={() => setIsEmailModalOpen(false)}
  />

  <SendQuotationWhatsAppModal
    quotation={quotationState}
    isOpen={isWhatsAppModalOpen}
    onClose={() => setIsWhatsAppModalOpen(false)}
  />
</>
);
}
