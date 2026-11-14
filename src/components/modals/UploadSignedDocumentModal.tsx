'use client';

import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadSignedDocument } from '@/lib/actions/signed-documents';
import type { BusinessDocumentType } from '@/types/documents';

interface UploadSignedDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultDocument?: {
    document_type: BusinessDocumentType;
    document_number: string;
    customer_id: string;
    customer_name: string;
    company_name?: string;
    related_transaction_id?: string;
    related_transaction_number?: string;
    original_generated_pdf_url?: string;
  };
}

export function UploadSignedDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  defaultDocument,
}: UploadSignedDocumentModalProps) {
  const [docType, setDocType] = useState<BusinessDocumentType>(defaultDocument?.document_type || 'QUOTATION');
  const [docNumber, setDocNumber] = useState(defaultDocument?.document_number || '');
  const [customerId, setCustomerId] = useState(defaultDocument?.customer_id || '');
  const [customerName, setCustomerName] = useState(defaultDocument?.customer_name || '');
  const [companyName, setCompanyName] = useState(defaultDocument?.company_name || '');
  const [relatedTx, setRelatedTx] = useState(defaultDocument?.related_transaction_number || '');
  const [signerName, setSignerName] = useState('');
  const [signerDesignation, setSignerDesignation] = useState('');
  const [hasStamp, setHasStamp] = useState(true);
  const [signedDate, setSignedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (defaultDocument) {
      setDocType(defaultDocument.document_type);
      setDocNumber(defaultDocument.document_number);
      setCustomerId(defaultDocument.customer_id);
      setCustomerName(defaultDocument.customer_name);
      setCompanyName(defaultDocument.company_name || '');
      setRelatedTx(defaultDocument.related_transaction_number || '');
    }
  }, [defaultDocument]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 15 * 1024 * 1024) {
      setError('File size exceeds 15 MB limit');
      return;
    }

    setFileName(selected.name);
    setFileSize(selected.size);
    setFile(selected);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.readAsDataURL(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNumber.trim()) {
      setError('Document Number is required');
      return;
    }
    if (!customerName.trim()) {
      setError('Customer Name is required');
      return;
    }
    if (!file && !fileBase64) {
      setError('Please select the scanned physical signed document file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await uploadSignedDocument({
        document_type: docType,
        document_number: docNumber.trim(),
        customer_id: customerId || 'CUST-GEN-001',
        customer_name: customerName.trim(),
        company_name: companyName.trim() || undefined,
        related_transaction_number: relatedTx.trim() || undefined,
        original_generated_pdf_url: defaultDocument?.original_generated_pdf_url,
        signed_scan_file_url: fileBase64 || `/docs/signed/${fileName}`,
        signed_scan_file_name: fileName || 'signed_document_scan.pdf',
        file_size_bytes: fileSize,
        mime_type: file?.type || 'application/pdf',
        signed_date: signedDate,
        signer_name: signerName.trim() || undefined,
        signer_designation: signerDesignation.trim() || undefined,
        has_company_stamp: hasStamp,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1200);
      } else {
        setError(res.error || 'Failed to archive signed document');
      }
    } catch (err: any) {
      setError(err.message || 'Upload exception');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm overflow-y-auto p-4 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in-50 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand-700" />
              Upload Signed & Stamped Document
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Securely archive physically executed copy without overwriting generated PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Signed document successfully archived and linked!</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Document Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
              >
                <option value="QUOTATION">Quotation / Proposal</option>
                <option value="PROFORMA_INVOICE">Proforma Invoice</option>
                <option value="DELIVERY_CHALLAN">Delivery Challan (Acknowledged POD)</option>
                <option value="TAX_INVOICE">GST Tax Invoice</option>
                <option value="PURCHASE_ORDER">Purchase Order</option>
                <option value="CONTRACT">Contract / Agreement / SLA</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Document Number</label>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="e.g. ITP/PI/2026-27/0001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Contact / Dept"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company / Organization</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Cyient Limited"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Date Signed</label>
              <input
                type="date"
                value={signedDate}
                onChange={(e) => setSignedDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Signatory Name</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Signer Full Name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Designation</label>
              <input
                type="text"
                value={signerDesignation}
                onChange={(e) => setSignerDesignation(e.target.value)}
                placeholder="e.g. Director / In-charge"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="hasStamp"
              checked={hasStamp}
              onChange={(e) => setHasStamp(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
            />
            <label htmlFor="hasStamp" className="text-xs font-semibold text-slate-800 cursor-pointer">
              Includes Verified Official Company Seal / Physical Stamp
            </label>
          </div>

          {/* File Upload Box */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Select Signed Scanned File (PDF, PNG, JPG &bull; Max 15 MB)
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center justify-center space-y-1">
                <FileText className="w-8 h-8 text-brand-600" />
                {fileName ? (
                  <span className="font-semibold text-brand-900 text-xs">
                    {fileName} ({(fileSize / 1024).toFixed(1)} KB)
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-slate-700 text-xs">
                      Click to choose file or drag & drop here
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Scanned customer signature & stamp document
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Archival Notes / Remarks</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received counter-signed copy via courier with security inward stamp."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              {loading ? 'Archiving...' : 'Archive Signed Copy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
