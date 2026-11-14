'use client';

import React from 'react';
import {
  CreditCard,
  Layers,
  MapPin,
  Phone,
  Mail,
  Shield,
  FileText,
} from 'lucide-react';
import {
  DemoCustomer,
  DemoQuotationItem,
  DEMO_COMPANY_INFO,
  DEMO_BANK_DETAILS,
  DEFAULT_TERMS_CONDITIONS,
  numberToIndianWords,
  QuotationFormatKey,
} from './demo-data';

export interface CustomerDocumentProps {
  quotationNumber: string;
  quotationDate: string;
  validUntil: string;
  customer: DemoCustomer;
  format: QuotationFormatKey;
  sections: string[];
  items: DemoQuotationItem[];
  pricingMode: 'tax_exclusive' | 'tax_inclusive';
  salesperson: string;
  projectReference?: string;
  terms?: string[];
  clientNotes?: string;
  viewMode?: 'structured' | 'table';
}

export interface DocumentPageSection {
  title: string;
  items: DemoQuotationItem[];
  isContinuation?: boolean;
}

export interface CustomerDocumentPageData {
  pageNumber: number;
  totalPages: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  sections: DocumentPageSection[];
  showClosingBlocks: boolean;
}

// ============================================================
// CONTENT-DRIVEN PAGINATION ENGINE (A4 @ 96 DPI: 794px × 1123px)
// ============================================================
const A4_TOTAL_HEIGHT = 1123;
const PAGE_PADDING_VERTICAL = 80; // 40px top + 40px bottom
const PAGE_FOOTER_HEIGHT = 36;
const USABLE_PAGE_HEIGHT = A4_TOTAL_HEIGHT - PAGE_PADDING_VERTICAL - PAGE_FOOTER_HEIGHT; // ~1007px

// Page 1 Fixed Elements Overhead
// Letterhead (~135px) + Meta (~80px) + Parties (~130px) + Project Banner (~75px) + Gaps (~30px)
const PAGE_1_OVERHEAD = 135 + 80 + 130 + 75 + 30; // ~450px
const PAGE_1_USABLE_CONTENT = USABLE_PAGE_HEIGHT - PAGE_1_OVERHEAD; // ~557px

// Subsequent Pages Overhead (Running Header + Gap)
const SUBSEQUENT_PAGE_OVERHEAD = 45 + 15; // 60px
const SUBSEQUENT_PAGE_USABLE_CONTENT = USABLE_PAGE_HEIGHT - SUBSEQUENT_PAGE_OVERHEAD; // ~947px

// Closing Blocks (Totals + Bank Details + Terms + Signatures)
const CLOSING_BLOCKS_HEIGHT = 155 + 90 + 140 + 120 + 25; // ~530px

function estimateItemHeight(item: DemoQuotationItem, viewMode: 'structured' | 'table'): number {
  if (viewMode === 'table') {
    let h = 48;
    if (item.customer_description && item.customer_description.trim() !== '') h += 24;
    if (item.specifications && item.specifications.length > 0) h += 20;
    return h;
  }

  // Structured Proposal Card:
  let h = 75; // Brand, Model, Product Name, Warranty, padding & borders
  if (item.short_highlights && item.short_highlights.length > 0) {
    h += 26;
  }
  if (item.specifications && item.specifications.length > 0) {
    const specRows = Math.ceil(item.specifications.length / 3);
    h += 22 + specRows * 20;
  }
  if (item.customer_description && item.customer_description.trim() !== '') {
    const lines = Math.max(1, Math.ceil(item.customer_description.length / 75));
    h += 20 + lines * 18;
  }
  h += 44; // Commercial pricing line
  h += 14; // Margin-bottom
  return h;
}

export function paginateCustomerDocument(
  sections: string[],
  items: DemoQuotationItem[],
  viewMode: 'structured' | 'table' = 'structured',
  format?: QuotationFormatKey
): CustomerDocumentPageData[] {
  // If format is STANDARD, there is no Project Architecture banner on page 1 (+75px usable space)
  const isStandard = format === 'STANDARD';
  const page1Overhead = isStandard ? PAGE_1_OVERHEAD - 75 : PAGE_1_OVERHEAD;
  const page1UsableContent = USABLE_PAGE_HEIGHT - page1Overhead;

  // Group items by section
  const sectionGroups: { title: string; items: DemoQuotationItem[] }[] = [];
  const assignedIds = new Set<string>();

  sections.forEach((secTitle) => {
    const matching = items.filter((it) => it.section_id === secTitle);
    if (matching.length > 0) {
      sectionGroups.push({ title: secTitle, items: matching });
      matching.forEach((m) => assignedIds.add(m.id));
    }
  });

  const unassigned = items.filter((it) => !assignedIds.has(it.id));
  if (unassigned.length > 0) {
    sectionGroups.push({ title: 'ADDITIONAL PRODUCTS & SERVICES', items: unassigned });
  }

  // If no items exist, return a single page with closing blocks
  if (sectionGroups.length === 0) {
    return [
      {
        pageNumber: 1,
        totalPages: 1,
        isFirstPage: true,
        isLastPage: true,
        sections: [],
        showClosingBlocks: true,
      },
    ];
  }

  const pages: CustomerDocumentPageData[] = [];
  let currentPageNumber = 1;
  let currentRemaining = page1UsableContent;
  let currentSections: DocumentPageSection[] = [];

  for (const group of sectionGroups) {
    let currentSecItems: DemoQuotationItem[] = [];
    const sectionHeaderHeight = isStandard ? 0 : 34;

    for (const item of group.items) {
      const itemHeight = estimateItemHeight(item, viewMode);
      const isFirstItemInSec = currentSecItems.length === 0;
      const neededHeight = itemHeight + (isFirstItemInSec ? sectionHeaderHeight : 0);

      // Check if item fits in current page
      if (neededHeight > currentRemaining && (currentSections.length > 0 || currentSecItems.length > 0)) {
        // Push accumulated items in current section
        if (currentSecItems.length > 0) {
          currentSections.push({
            title: group.title,
            items: currentSecItems,
            isContinuation: false,
          });
          currentSecItems = [];
        }

        // Commit current page
        pages.push({
          pageNumber: currentPageNumber,
          totalPages: 0,
          isFirstPage: currentPageNumber === 1,
          isLastPage: false,
          sections: currentSections,
          showClosingBlocks: false,
        });

        // Start new page
        currentPageNumber++;
        currentSections = [];
        currentRemaining = SUBSEQUENT_PAGE_USABLE_CONTENT;
      }

      currentSecItems.push(item);
      currentRemaining -= itemHeight + (isFirstItemInSec ? sectionHeaderHeight : 0);
    }

    if (currentSecItems.length > 0) {
      currentSections.push({
        title: group.title,
        items: currentSecItems,
        isContinuation: false,
      });
    }
  }

  // Check if closing blocks fit on the current page
  if (currentRemaining >= CLOSING_BLOCKS_HEIGHT) {
    pages.push({
      pageNumber: currentPageNumber,
      totalPages: 0,
      isFirstPage: currentPageNumber === 1,
      isLastPage: true,
      sections: currentSections,
      showClosingBlocks: true,
    });
  } else {
    // Commit current page without closing blocks
    pages.push({
      pageNumber: currentPageNumber,
      totalPages: 0,
      isFirstPage: currentPageNumber === 1,
      isLastPage: false,
      sections: currentSections,
      showClosingBlocks: false,
    });

    // Start a dedicated final page for closing blocks
    currentPageNumber++;
    pages.push({
      pageNumber: currentPageNumber,
      totalPages: 0,
      isFirstPage: false,
      isLastPage: true,
      sections: [],
      showClosingBlocks: true,
    });
  }

  // Update totalPages count
  const total = pages.length;
  pages.forEach((p) => {
    p.totalPages = total;
  });

  return pages;
}

// ============================================================
// SINGLE CANONICAL CUSTOMER DOCUMENT RENDERER
// ============================================================
export function DemoCustomerDocument({
  quotationNumber,
  quotationDate,
  validUntil,
  customer,
  format,
  sections,
  items,
  pricingMode,
  salesperson,
  projectReference,
  terms = DEFAULT_TERMS_CONDITIONS,
  clientNotes,
  viewMode = 'structured',
}: CustomerDocumentProps) {
  // Commercial totals calculation
  const subtotal = items.reduce((acc, item) => {
    const rawTotal = item.quantity * item.unit_price;
    const discountAmount = item.discount || 0;
    return acc + Math.max(0, rawTotal - discountAmount);
  }, 0);

  const isIntraState = !customer.state || customer.state.toLowerCase().includes('telangana');
  const gstRate = 18;
  const totalTax = Math.round((subtotal * gstRate) / 100);
  const cgst = isIntraState ? Math.round(totalTax / 2) : 0;
  const sgst = isIntraState ? Math.round(totalTax / 2) : 0;
  const igst = !isIntraState ? totalTax : 0;
  const grandTotal = subtotal + totalTax;
  const amountInWords = numberToIndianWords(grandTotal);

  // Dynamic pagination calculation
  const pages = paginateCustomerDocument(sections, items, viewMode, format);

  return (
    <div
      id="quotation-print-area"
      className="customer-document-container flex flex-col items-center gap-8 print:gap-0 w-full"
    >
      {pages.map((page) => (
        <div
          key={`doc-page-${page.pageNumber}`}
          className="a4-page-sheet w-[794px] min-h-[1123px] max-w-full bg-white text-slate-900 shadow-2xl rounded-sm p-8 md:p-12 relative flex flex-col justify-between border border-slate-300 print:border-none print:shadow-none print:m-0 print:p-[12mm_15mm] box-border text-[13px] leading-relaxed font-sans"
          data-testid={`document-page-${page.pageNumber}`}
        >
          {/* Top Section of Page */}
          <div className="space-y-4">
            {/* PAGE 1: Full Official ICON TECH PRO Letterhead */}
            {page.isFirstPage ? (
              <>
                <div className="flex justify-between items-start pb-5 border-b-2 border-blue-950">
                  {/* Left: Company Details */}
                  <div className="space-y-1 max-w-md">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black tracking-tight text-blue-950 font-mono">
                        {DEMO_COMPANY_INFO.name}
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-950 text-white tracking-widest uppercase">
                        PRO ERP
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-blue-700 tracking-wider uppercase">
                      UNIFIED SOLUTIONS SPECIALIST
                    </p>
                    <p className="text-xs font-semibold text-slate-800">
                      {DEMO_COMPANY_INFO.legalName}
                    </p>
                    <p className="text-xs text-slate-600 leading-snug">
                      {DEMO_COMPANY_INFO.address}, {DEMO_COMPANY_INFO.city}, {DEMO_COMPANY_INFO.state} - {DEMO_COMPANY_INFO.pincode}
                    </p>
                    <div className="pt-0.5 text-xs text-slate-700 space-y-0.5">
                      <p>
                        <span className="font-semibold text-slate-800">Phone:</span> {DEMO_COMPANY_INFO.phone} | <span className="font-semibold text-slate-800">Email:</span> {DEMO_COMPANY_INFO.email}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">GSTIN:</span>{' '}
                        <span className="font-mono font-bold text-slate-950">{DEMO_COMPANY_INFO.gstin}</span> |{' '}
                        <span className="font-semibold text-slate-800">PAN:</span>{' '}
                        <span className="font-mono font-semibold text-slate-900">{DEMO_COMPANY_INFO.pan}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Quotation Title & Meta */}
                  <div className="text-right space-y-2">
                    <div>
                      <h1 className="text-2xl font-black text-blue-950 tracking-wider font-mono">
                        QUOTATION
                      </h1>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                        Official Commercial Proposal
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-700">
                      <p>
                        <span className="text-slate-500 font-medium">Quotation No:</span>{' '}
                        <span className="font-mono font-black text-slate-950 text-sm">{quotationNumber}</span>
                      </p>
                      <p>
                        <span className="text-slate-500 font-medium">Quotation Date:</span>{' '}
                        <span className="font-semibold text-slate-900">{quotationDate}</span>
                      </p>
                      <p>
                        <span className="text-slate-500 font-medium">Valid Until:</span>{' '}
                        <span className="font-semibold text-slate-900">{validUntil}</span>
                      </p>
                      {projectReference && (
                        <p>
                          <span className="text-slate-500 font-medium">Reference:</span>{' '}
                          <span className="font-semibold text-blue-900">{projectReference}</span>
                        </p>
                      )}
                      {salesperson && (
                        <p>
                          <span className="text-slate-500 font-medium">Prepared By:</span>{' '}
                          <span className="font-medium text-slate-800">{salesperson}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Two-Column Party Details: BILL TO vs DISPATCH / INSTALL AT */}
                <div className="grid grid-cols-2 gap-6 my-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                  {/* Column 1: BILL TO */}
                  <div className="space-y-1 text-xs">
                    <span className="text-[11px] font-black tracking-wider text-blue-950 uppercase block mb-1">
                      BILL TO
                    </span>
                    <p className="text-sm font-bold text-slate-950">
                      {customer.company_name || customer.customer_name}
                    </p>
                    {customer.contact_person && (
                      <p className="text-xs text-slate-800 font-semibold">
                        Attn: {customer.contact_person} {customer.designation ? `(${customer.designation})` : ''}
                      </p>
                    )}
                    <p className="text-xs text-slate-700 leading-snug">
                      {customer.billing_address}
                      {customer.city ? `, ${customer.city}` : ''}
                      {customer.state ? `, ${customer.state}` : ''}
                      {customer.pincode ? ` - ${customer.pincode}` : ''}
                    </p>
                    <div className="pt-1 space-y-0.5 text-xs text-slate-600">
                      {customer.phone && <p><span className="font-medium text-slate-700">Phone:</span> {customer.phone}</p>}
                      {customer.email && <p><span className="font-medium text-slate-700">Email:</span> {customer.email}</p>}
                      {customer.gstin && (
                        <p>
                          <span className="font-semibold text-slate-800">Client GSTIN:</span>{' '}
                          <span className="font-mono font-bold text-slate-950">{customer.gstin}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Column 2: DISPATCH / INSTALL AT */}
                  <div className="space-y-1 text-xs">
                    <span className="text-[11px] font-black tracking-wider text-blue-950 uppercase block mb-1">
                      DISPATCH / INSTALL AT
                    </span>
                    <p className="text-sm font-bold text-slate-950">
                      {customer.company_name || customer.customer_name} — Site
                    </p>
                    <p className="text-xs text-slate-800 font-semibold">
                      Site Contact: {customer.contact_person || 'Project Coordinator'}
                    </p>
                    <p className="text-xs text-slate-700 leading-snug">
                      {customer.billing_address}
                      {customer.city ? `, ${customer.city}` : ''}
                    </p>
                    <div className="pt-1 space-y-0.5 text-xs text-slate-600">
                      <p><span className="font-medium text-slate-700">State:</span> {customer.state || 'Telangana'}</p>
                      <p><span className="font-medium text-slate-700">Postal PIN:</span> {customer.pincode || '500034'}</p>
                      <p><span className="font-medium text-slate-700">Installation Mode:</span> Turnkey On-Site Deployment</p>
                    </div>
                  </div>
                </div>

                {/* PROJECT / SOLUTION ARCHITECTURE BANNER (Omitted for STANDARD Commercial format) */}
                {format !== 'STANDARD' && (
                  <div className="my-4 p-3.5 bg-blue-50/70 rounded-lg border border-blue-200 flex items-start justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-black text-blue-950 uppercase tracking-wider block">
                        PROJECT / SOLUTION ARCHITECTURE
                      </span>
                      <p className="text-sm font-bold text-blue-950">
                        {format.replace('_', ' ')} — {projectReference || 'Reference AV Integration'}
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed pt-0.5">
                        {clientNotes ||
                          'Comprehensive turnkey system engineering designed for professional reference performance, certified acoustic calibration, and warranty handover.'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-blue-800 bg-white px-2.5 py-1 rounded border border-blue-200 shrink-0 uppercase tracking-wide">
                      {format.replace('_', ' ')}
                    </span>
                  </div>
                )}
              </>
            ) : (
              /* SUBSEQUENT PAGES: Sleek Running Header */
              <div className="flex justify-between items-center pb-3 border-b-2 border-blue-950 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="font-black text-blue-950 font-mono tracking-tight text-sm">
                    {DEMO_COMPANY_INFO.name}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="font-semibold text-blue-800 uppercase tracking-wider text-[11px]">
                    UNIFIED SOLUTIONS SPECIALIST
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>
                    Quotation: <strong className="font-mono text-slate-900">{quotationNumber}</strong>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>Date: {quotationDate}</span>
                </div>
              </div>
            )}

            {/* PAGE LINE ITEMS: STRUCTURED PROPOSAL CARDS */}
            {viewMode === 'structured' && page.sections.length > 0 && (
              <div className="space-y-4" data-testid="preview-structured-container">
                {page.sections.map((group, gIdx) => (
                  <div key={`page-sec-${gIdx}`} className="space-y-2.5">
                    {/* Section Header */}
                    <div className="pb-1 border-b-2 border-blue-950 flex items-center justify-between">
                      <h3 className="text-xs font-black tracking-wider text-blue-950 uppercase flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-700 inline-block" />
                        {group.title}
                      </h3>
                      <span className="text-[11px] font-semibold text-slate-500 font-mono">
                        {group.items.length} {group.items.length === 1 ? 'Item' : 'Items'}
                      </span>
                    </div>

                    {/* Product Cards */}
                    <div className="space-y-3">
                      {group.items.map((item, iIdx) => {
                        const lineSubtotal = Math.max(
                          0,
                          item.quantity * item.unit_price - (item.discount || 0)
                        );
                        const hasHsn = item.hsn_sac && item.hsn_sac.trim() !== '';

                        return (
                          <div
                            key={item.id || `card-${iIdx}`}
                            className="border border-slate-200 rounded-lg p-3.5 bg-white shadow-xs space-y-2.5 break-inside-avoid"
                            data-testid="preview-item-row"
                          >
                            {/* Product Header & Highlights */}
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 border-b border-slate-100 pb-2">
                              <div>
                                <div className="flex items-baseline gap-2">
                                  <span className="text-sm font-bold text-slate-900 tracking-tight">
                                    {item.brand ? `${item.brand} ` : ''}
                                    {item.model ? `– ${item.model}` : ''}
                                  </span>
                                  {item.warranty && (
                                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      Warranty: {item.warranty}
                                    </span>
                                  )}
                                </div>
                                {item.product_name && (
                                  <p className="text-xs font-medium text-slate-700 mt-0.5">
                                    {item.product_name}
                                  </p>
                                )}
                              </div>

                              {/* Highlights */}
                              {item.short_highlights && item.short_highlights.length > 0 && (
                                <div
                                  className="text-xs text-slate-600 font-medium flex flex-wrap gap-x-2 gap-y-1 md:text-right"
                                  data-testid="preview-short-highlights"
                                >
                                  {item.short_highlights.map((hl, hIdx) => (
                                    <span key={hIdx} className="inline-flex items-center">
                                      {hIdx > 0 && <span className="text-slate-300 mr-2">|</span>}
                                      <span className="text-slate-700 font-medium">{hl}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Key Specifications Grid */}
                            {item.specifications && item.specifications.length > 0 && (
                              <div
                                className="bg-slate-50/90 p-2.5 rounded-md border border-slate-200"
                                data-testid="preview-specifications"
                              >
                                <span className="text-[10px] font-bold text-blue-950 uppercase tracking-wider block mb-1.5">
                                  KEY SPECIFICATIONS
                                </span>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-1 text-xs text-slate-700">
                                  {item.specifications.map((spec, sIdx) => (
                                    <div
                                      key={sIdx}
                                      className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-200/50"
                                    >
                                      <span className="text-slate-500 font-medium">{spec.key}:</span>
                                      <span className="font-semibold text-slate-900 text-right">{spec.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Mandatory Customer Description */}
                            {item.customer_description && (
                              <div className="space-y-1" data-testid="preview-customer-description">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  DESCRIPTION
                                </span>
                                <div className="p-2.5 bg-slate-50/60 rounded border-l-3 border-blue-600 text-xs text-slate-800 leading-relaxed font-normal">
                                  {item.customer_description}
                                </div>
                              </div>
                            )}

                            {/* Commercial Pricing Line */}
                            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200 bg-slate-50/60 px-3 py-1.5 rounded text-xs text-slate-700">
                              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                                <span>
                                  <strong className="text-slate-900">Qty:</strong> {item.quantity} {item.unit || 'Nos'}
                                </span>

                                {/* HSN/SAC strictly omitted when empty */}
                                {hasHsn && (
                                  <span data-testid="preview-hsn-cell">
                                    <strong className="text-slate-900">HSN/SAC:</strong>{' '}
                                    <span className="font-mono font-medium text-slate-800">{item.hsn_sac}</span>
                                  </span>
                                )}

                                <span>
                                  <strong className="text-slate-900">Unit Rate:</strong>{' '}
                                  <span className="font-mono font-medium">₹{item.unit_price.toLocaleString('en-IN')}</span>
                                </span>

                                {item.discount > 0 && (
                                  <span className="text-rose-700 font-medium">
                                    <strong>Discount:</strong>{' '}
                                    <span className="font-mono">-₹{item.discount.toLocaleString('en-IN')}</span>
                                  </span>
                                )}

                                <span>
                                  <strong className="text-slate-900">GST:</strong> {item.gst_rate || 18}%
                                </span>
                              </div>

                              <div className="text-right">
                                <span className="text-slate-500 font-medium text-xs">Amount: </span>
                                <span className="text-sm font-bold text-slate-950 font-mono">
                                  ₹{lineSubtotal.toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TABLE VIEW (Clean Traditional Commercial Table for STANDARD and tabular viewing) */}
            {viewMode === 'table' && page.sections.length > 0 && (
              <div className="my-2 overflow-x-auto">
                <table className="w-full text-left border-collapse" data-testid="preview-items-table">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-wider border-y-2 border-blue-950">
                      <th className="py-2.5 px-2.5 w-10 text-center">S.No</th>
                      <th className="py-2.5 px-3">Product / Description</th>
                      <th className="py-2.5 px-2.5 w-24 text-center">HSN/SAC</th>
                      <th className="py-2.5 px-2.5 w-14 text-center">Qty</th>
                      <th className="py-2.5 px-2.5 w-14 text-center">Unit</th>
                      <th className="py-2.5 px-3 w-24 text-right">Unit Rate (₹)</th>
                      <th className="py-2.5 px-2.5 w-24 text-right">Discount (₹)</th>
                      <th className="py-2.5 px-2.5 w-16 text-center">GST (%)</th>
                      <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let pageStartSNo = 0;
                      for (let p = 0; p < pages.indexOf(page); p++) {
                        pages[p].sections.forEach((sec) => {
                          pageStartSNo += sec.items.length;
                        });
                      }
                      let currentSNo = pageStartSNo;

                      return page.sections.map((group, gIdx) => (
                        <React.Fragment key={`tbl-sec-${gIdx}`}>
                          {/* Omit section header rows for STANDARD format */}
                          {format !== 'STANDARD' && (
                            <tr className="bg-blue-50/70 border-y border-blue-100">
                              <td colSpan={9} className="py-1.5 px-3">
                                <span className="text-[11px] font-black tracking-wider text-blue-950 uppercase flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-blue-700 inline-block" />
                                  {group.title}
                                </span>
                              </td>
                            </tr>
                          )}

                          {group.items.map((item, iIdx) => {
                            const lineSubtotal = Math.max(
                              0,
                              item.quantity * item.unit_price - (item.discount || 0)
                            );
                            const hasHsn = item.hsn_sac && item.hsn_sac.trim() !== '';
                            currentSNo++;

                            return (
                              <tr
                                key={item.id || `row-${iIdx}`}
                                className="border-b border-slate-200 hover:bg-slate-50/50 align-top text-xs"
                                data-testid="preview-item-row"
                              >
                                <td className="py-2.5 px-2.5 text-center font-mono text-slate-600 font-semibold">
                                  {currentSNo}
                                </td>
                                <td className="py-2.5 px-3 space-y-1">
                                  <div>
                                    <span className="font-bold text-slate-900 text-sm">
                                      {item.brand ? `${item.brand} ` : ''}
                                      {item.model ? `– ${item.model}` : ''}
                                    </span>
                                    {item.product_name && (
                                      <p className="text-xs text-slate-700 font-medium">
                                        {item.product_name}
                                      </p>
                                    )}
                                  </div>
                                  {item.specifications && item.specifications.length > 0 && (
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                                      {item.specifications.slice(0, 3).map((sp, spIdx) => (
                                        <span key={spIdx}>
                                          <span className="text-slate-400">{sp.key}:</span> {sp.value}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {item.customer_description && (
                                    <p className="text-xs text-slate-600 line-clamp-2 italic">
                                      {item.customer_description}
                                    </p>
                                  )}
                                </td>
                                <td className="py-2.5 px-2.5 text-center font-mono text-slate-700" data-testid="preview-hsn-cell">
                                  {hasHsn ? item.hsn_sac : ''}
                                </td>
                                <td className="py-2.5 px-2.5 text-center font-semibold text-slate-900">
                                  {item.quantity}
                                </td>
                                <td className="py-2.5 px-2.5 text-center text-slate-700 font-medium">
                                  {item.unit || 'Nos'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                                  ₹{item.unit_price.toLocaleString('en-IN')}
                                </td>
                                <td className="py-2.5 px-2.5 text-right font-mono text-slate-700">
                                  {item.discount > 0 ? `₹${item.discount.toLocaleString('en-IN')}` : '—'}
                                </td>
                                <td className="py-2.5 px-2.5 text-center font-mono text-slate-700">
                                  {item.gst_rate || 18}%
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-950">
                                  ₹{lineSubtotal.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {/* CLOSING BLOCKS: Commercial Totals, Bank Remittance, Terms, Signatures */}
            {page.showClosingBlocks && (
              <div className="space-y-4 pt-2 break-inside-avoid">
                {/* Commercial Totals */}
                <div className="flex justify-between items-start pt-3 border-t-2 border-slate-200">
                  {/* Amount in Words */}
                  <div className="max-w-md space-y-1.5">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">
                        Amount Chargeable (in words)
                      </span>
                      <p
                        className="text-xs font-bold text-slate-900 bg-slate-50 p-2 rounded border border-slate-200 mt-0.5 italic"
                        data-testid="preview-amount-in-words"
                      >
                        {amountInWords}
                      </p>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <p>
                        • Pricing Mode:{' '}
                        <span className="font-semibold text-slate-800">
                          {pricingMode === 'tax_exclusive'
                            ? 'Base Rates Exclusive of GST'
                            : 'Rates Inclusive of GST'}
                        </span>
                      </p>
                      <p>• GST Summary: Computed per Indian GST Tariff Schedule.</p>
                    </div>
                  </div>

                  {/* Financial Breakdown Table */}
                  <div className="w-72 bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-700">
                      <span>Subtotal (Base Value):</span>
                      <span className="font-mono font-semibold text-slate-900">
                        ₹{subtotal.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {isIntraState ? (
                      <>
                        <div className="flex justify-between text-xs text-slate-700">
                          <span>CGST (9%):</span>
                          <span className="font-mono text-slate-800">₹{cgst.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-700">
                          <span>SGST (9%):</span>
                          <span className="font-mono text-slate-800">₹{sgst.toLocaleString('en-IN')}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-xs text-slate-700">
                        <span>IGST (18%):</span>
                        <span className="font-mono text-slate-800">₹{igst.toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t-2 border-blue-950 flex justify-between items-baseline">
                      <span className="text-sm font-black text-blue-950 uppercase tracking-wider">
                        Grand Total:
                      </span>
                      <span
                        className="text-lg font-black text-blue-950 font-mono"
                        data-testid="preview-grand-total"
                      >
                        ₹{grandTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bank Details & Remittance Box */}
                <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 flex items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950 uppercase tracking-wider">
                      <CreditCard className="w-3.5 h-3.5 text-blue-700" />
                      Bank Remittance & Payment Details
                    </div>
                    <p className="text-xs text-slate-800">
                      <span className="font-medium text-slate-600">Bank:</span>{' '}
                      <span className="font-bold">{DEMO_BANK_DETAILS.bankName}</span> ({DEMO_BANK_DETAILS.branch})
                    </p>
                    <p className="text-xs text-slate-800">
                      <span className="font-medium text-slate-600">Account:</span>{' '}
                      <span className="font-semibold">{DEMO_BANK_DETAILS.accountName}</span>
                    </p>
                    <div className="flex items-center gap-4 text-xs font-mono pt-0.5">
                      <p>
                        <span className="font-sans font-medium text-slate-600">A/c No:</span>{' '}
                        <span className="font-bold text-slate-950">{DEMO_BANK_DETAILS.accountNumber}</span>
                      </p>
                      <p>
                        <span className="font-sans font-medium text-slate-600">IFSC:</span>{' '}
                        <span className="font-bold text-slate-950">{DEMO_BANK_DETAILS.ifscCode}</span>
                      </p>
                      <p>
                        <span className="font-sans font-medium text-slate-600">UPI:</span>{' '}
                        <span className="font-bold text-blue-900">{DEMO_BANK_DETAILS.upiId}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-slate-600 max-w-xs">
                    <p>
                      Please email remittance UTR to{' '}
                      <span className="text-blue-800 font-semibold">{DEMO_COMPANY_INFO.email}</span> for priority dispatch.
                    </p>
                  </div>
                </div>

                {/* Standard Terms & Conditions (7 items) */}
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-black text-blue-950 uppercase tracking-wider block mb-1">
                    Standard Commercial Terms & Conditions
                  </span>
                  <ol className="list-decimal list-inside space-y-0.5 text-xs text-slate-700 leading-relaxed">
                    {terms.map((term, tIdx) => (
                      <li key={tIdx} className="text-slate-700">
                        {term}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Signatures & Acceptance Footer */}
                <div className="pt-4 border-t border-slate-200 grid grid-cols-2 items-end">
                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-8">
                      Customer Acceptance Signature & Stamp:
                    </p>
                    <div className="w-48 border-b-2 border-slate-400" />
                    <p className="text-[11px] text-slate-500 mt-1">Date & Authorized Signatory</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold text-blue-950 mb-1">
                      For {DEMO_COMPANY_INFO.legalName}
                    </p>
                    <div className="h-8 flex items-center justify-end">
                      <span className="text-xs font-signature text-blue-900 italic pr-4 font-serif">
                        Authorized Signatory
                      </span>
                    </div>
                    <div className="w-48 border-b-2 border-slate-400 ml-auto" />
                    <p className="text-[11px] text-slate-700 font-semibold mt-1">Authorized Signatory</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PAGE FOOTER (Pinned to bottom of every A4 page) */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>ICON TECH PRO ERP V9.2 • Hyderabad, India • ISO 9001:2015</span>
            <span className="font-bold text-slate-700" data-testid={`page-number-${page.pageNumber}`}>
              Page {page.pageNumber} of {page.totalPages}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
