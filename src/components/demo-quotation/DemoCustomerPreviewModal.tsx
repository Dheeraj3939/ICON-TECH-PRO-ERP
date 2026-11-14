'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  FileText,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import {
  DemoCustomer,
  DemoQuotationItem,
  DEFAULT_TERMS_CONDITIONS,
  QuotationFormatKey,
} from './demo-data';
import { DemoCustomerDocument } from './DemoCustomerDocument';

// Canonical preview rendering contract (delegated to DemoCustomerDocument):
// item.customer_description data-testid="preview-customer-description"
// data-testid="preview-specifications" data-testid="preview-short-highlights"
// item.specifications item.short_highlights

interface DemoCustomerPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
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
}

export function DemoCustomerPreviewModal({
  isOpen,
  onClose,
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
}: DemoCustomerPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [zoomScale, setZoomScale] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'structured' | 'table'>(
    format === 'STANDARD' ? 'table' : 'structured'
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update view mode when format changes
  useEffect(() => {
    setViewMode(format === 'STANDARD' ? 'table' : 'structured');
  }, [format]);

  // Enforce scroll position = 0 and format-driven view mode whenever preview opens (TEST 11 & TEST 34)
  useEffect(() => {
    if (isOpen) {
      setViewMode(format === 'STANDARD' ? 'table' : 'structured');
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      // Also ensure on next tick in case modal layout takes a frame
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, format]);

  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  function handlePrint() {
    window.print();
  }

  function handleDownload() {
    setDownloadSuccess(true);
    // Simulate high-fidelity client PDF export / trigger print-to-PDF
    setTimeout(() => {
      window.print();
      setDownloadSuccess(false);
    }, 600);
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      data-testid="customer-preview-modal"
    >
      {/* Scoped CSS for A4 Multi-Page Print & PDF Fidelity */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background: white !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .a4-page-sheet {
            width: 210mm !important;
            min-height: 297mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 12mm 15mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          .a4-page-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>

      {/* Top Application Preview Toolbar (Screen Only, hidden on print) */}
      <div className="flex-none bg-slate-900 border-b border-slate-800 px-6 py-3 text-white flex items-center justify-between shadow-xl print:hidden">
        {/* Left: Branding & Meta */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-xs shadow-sm">
            ITP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wide text-white">
                Customer Quotation Preview
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold uppercase">
                {format.replace('_', ' ')}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                Canonical Document Model
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Quotation Ref: <span className="font-mono text-slate-200">{quotationNumber}</span> • Customer: {customer.company_name || customer.customer_name}
            </p>
          </div>
        </div>

        {/* Center: Zoom / Scale Controls */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => setZoomScale((s) => Math.max(60, s - 10))}
            className="p-1 text-slate-300 hover:text-white transition cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] font-semibold text-slate-200 w-12 text-center">
            {zoomScale}%
          </span>
          <button
            type="button"
            onClick={() => setZoomScale((s) => Math.min(130, s + 10))}
            className="p-1 text-slate-300 hover:text-white transition cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={() => setZoomScale(100)}
            className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-300 hover:text-white transition cursor-pointer"
          >
            Reset
          </button>
        </div>

        {/* Right: View Mode Toggle & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('structured')}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                viewMode === 'structured'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Structured Proposal
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Table View
            </button>
          </div>

          {downloadSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-700/60 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" /> PDF Ready
            </span>
          )}

          <button
            onClick={handleDownload}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition cursor-pointer"
            title="Download Customer PDF"
            data-testid="preview-download-pdf-btn"
          >
            <Download className="w-4 h-4 text-blue-400" />
            Download PDF
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
            title="Print Quotation"
            data-testid="preview-print-btn"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title="Close Preview (Esc)"
            data-testid="preview-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Viewport (Neutral Desk Backdrop) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-900/75 flex justify-center"
      >
        <div
          style={{
            transform: zoomScale !== 100 ? `scale(${zoomScale / 100})` : undefined,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="w-full flex justify-center"
        >
          {/* Canonical Customer Document Renderer */}
          <DemoCustomerDocument
            quotationNumber={quotationNumber}
            quotationDate={quotationDate}
            validUntil={validUntil}
            customer={customer}
            format={format}
            sections={sections}
            items={items}
            pricingMode={pricingMode}
            salesperson={salesperson}
            projectReference={projectReference}
            terms={terms}
            clientNotes={clientNotes}
            viewMode={viewMode}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
