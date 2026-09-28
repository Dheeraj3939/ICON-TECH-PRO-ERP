'use client';

import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { QuotationFormWorkspace } from '@/components/quotations/QuotationFormWorkspace';
import type { Quotation } from '@/types/erp';

interface NewQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialCustomer?: {
    id?: string;
    customer_code?: string;
    name: string;
    company?: string;
    phone: string;
    email?: string;
    address?: string;
    customer_type?: 'COMPANY' | 'INDIVIDUAL' | 'GOVERNMENT';
  };
  enquiryContext?: {
    enquiry_id?: string;
    enquiry_number?: string;
    product_category?: string;
    requirement_summary?: string;
    estimated_budget?: number;
    notes?: string;
    site_visit?: any;
  };
  editingQuotation?: Quotation | null;
}

export function NewQuotationModal({
  isOpen,
  onClose,
  onSuccess,
  initialCustomer,
  enquiryContext,
  editingQuotation,
}: NewQuotationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl my-4 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Top Bar */}
        <div className="px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-slate-700">
              {editingQuotation ? 'Edit Quotation' : 'New Quotation'}
            </span>
            <Link
              href={
                editingQuotation
                  ? `/dashboard/quotations/${editingQuotation.id}/edit`
                  : `/dashboard/quotations/new${
                      enquiryContext?.enquiry_id ? `?enquiry_id=${enquiryContext.enquiry_id}` : ''
                    }`
              }
              className="text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              <span>Open in Full-Page Workspace</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Visual 7-Step Workflow Navigation Banner */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
              7-Step Proposal Creation Workflow
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 text-xs font-bold text-center">
              <div className="p-2 rounded-xl bg-blue-600 text-white shadow-2xs">
                <span className="block text-[10px] font-mono opacity-80">STEP 1</span>
                <span>Customer</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                <span className="block text-[10px] font-mono text-slate-400">STEP 2</span>
                <span>Products & Scope</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                <span className="block text-[10px] font-mono text-slate-400">STEP 3</span>
                <span>Pricing & Margins</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                <span className="block text-[10px] font-mono text-slate-400">STEP 4</span>
                <span>GST Breakdown</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                <span className="block text-[10px] font-mono text-slate-400">STEP 5</span>
                <span>Terms & Presets</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                <span className="block text-[10px] font-mono text-slate-400">STEP 6</span>
                <span>Live Preview</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                <span className="block text-[10px] font-mono text-slate-400">STEP 7</span>
                <span>Save & Send</span>
              </div>
            </div>
          </div>

          <QuotationFormWorkspace
            initialCustomer={initialCustomer}
            enquiryContext={enquiryContext}
            editingQuotation={editingQuotation}
            isModal={true}
            onCloseModal={() => {
              if (onSuccess) onSuccess();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
