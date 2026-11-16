'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Users,
  Package,
  Truck,
  ArrowRight,
  RefreshCw,
  FileText,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Receipt,
  CreditCard,
  Search,
  Filter,
} from 'lucide-react';
import {
  parseCSV,
  IMPORT_TEMPLATES,
  ImportTemplateConfig,
  isTallyBinaryFile,
  type ClassifiedImportRow,
  type DuplicateClassification,
} from '@/lib/utils/csv-parser';
import {
  bulkImportCustomers,
  bulkImportProducts,
  bulkImportSuppliers,
  bulkImportOpeningReceivables,
  bulkImportOpeningPayables,
  validateAndClassifyImportRows,
  type BulkImportResult,
  type ImportClassificationSummary,
} from '@/lib/actions/bulk-import';
import { getCurrentSessionUser } from '@/lib/actions/users';
import { canImportCSV } from '@/lib/permissions/registry';
import type { AuthenticatedUser } from '@/lib/auth/session';

export default function BulkImportPage() {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<string>('customers');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{
    headers: string[];
    rows: Record<string, string>[];
  } | null>(null);
  const [classificationSummary, setClassificationSummary] =
    useState<ImportClassificationSummary | null>(null);
  const [classifiedRows, setClassifiedRows] = useState<ClassifiedImportRow[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [filterClassification, setFilterClassification] = useState<string>('ALL');
  const [searchPreview, setSearchPreview] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCurrentSessionUser().then((user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });
  }, []);

  const activeTemplate: ImportTemplateConfig =
    IMPORT_TEMPLATES[selectedEntity] || IMPORT_TEMPLATES.customers;

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const headerRow = activeTemplate.headers.map((h) => `"${h.key}"`).join(',');
    const sampleRows = activeTemplate.sampleRows
      .map((row) =>
        activeTemplate.headers
          .map((h) => `"${(row[h.key] || '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\r\n');

    const csvContent = `${headerRow}\r\n${sampleRows}`;
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTemplate.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle File Selection with Binary Rejection & Duplicate Engine Pre-Check
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Strict rejection of raw Tally binary formats (.1800, .TSF, etc.)
    if (isTallyBinaryFile(selectedFile.name)) {
      setErrorMsg(
        'Proprietary Tally internal binary file detected (.1800 / .TSF). Direct import of internal binary files is strictly blocked to protect database integrity and prevent schema corruption. Please export your ledgers/vouchers from Tally to CSV/Excel format using the official templates provided.'
      );
      setFile(null);
      setParsedData(null);
      setClassificationSummary(null);
      setClassifiedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!selectedFile.name.endsWith('.csv')) {
      setErrorMsg('Please upload a valid .csv file format.');
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setImportResult(null);
    setUserConfirmed(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const result = parseCSV(text);

      if (result.rows.length === 0) {
        setErrorMsg('The uploaded CSV file contains no data rows.');
        setParsedData(null);
        setClassificationSummary(null);
        setClassifiedRows([]);
        return;
      }

      setParsedData(result);
      setIsValidating(true);

      try {
        const { summary, classifiedRows: classified } = await validateAndClassifyImportRows(
          selectedEntity,
          result.rows
        );
        setClassificationSummary(summary);
        setClassifiedRows(classified);
      } catch (err: any) {
        console.warn('Pre-import classification error:', err);
      } finally {
        setIsValidating(false);
      }
    };
    reader.readAsText(selectedFile);
  };

  // Execute Bulk Import
  const handleImport = async () => {
    if (!parsedData || parsedData.rows.length === 0 || !userConfirmed) return;

    setIsUploading(true);
    setErrorMsg(null);

    try {
      let res: BulkImportResult;
      if (selectedEntity === 'customers') {
        res = await bulkImportCustomers(parsedData.rows, skipDuplicates);
      } else if (selectedEntity === 'suppliers') {
        res = await bulkImportSuppliers(parsedData.rows, skipDuplicates);
      } else if (selectedEntity === 'opening_receivables') {
        res = await bulkImportOpeningReceivables(parsedData.rows);
      } else if (selectedEntity === 'opening_payables') {
        res = await bulkImportOpeningPayables(parsedData.rows);
      } else {
        res = await bulkImportProducts(parsedData.rows);
      }

      setImportResult(res);
      if (res.errorCount > 0 && res.successCount === 0) {
        setErrorMsg(`Failed to import records: ${res.errors[0]?.reason || 'Unknown error'}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during bulk import.');
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setParsedData(null);
    setClassificationSummary(null);
    setClassifiedRows([]);
    setImportResult(null);
    setErrorMsg(null);
    setUserConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (isAuthLoading) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
        <p className="text-xs font-semibold">Verifying import permissions...</p>
      </div>
    );
  }

  if (currentUser && !canImportCSV(currentUser.role)) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-rose-200 rounded-3xl shadow-sm text-center space-y-4">
        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Access Restricted</h2>
        <p className="text-sm text-slate-600">
          Your role (<span className="font-semibold text-slate-900">{currentUser.role}</span>) does not have authorization to perform bulk database imports. Only Managing Directors and System Administrators are permitted to import datasets into the master repository.
        </p>
        <div className="pt-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Filtered rows for review table
  const filteredRows = classifiedRows.filter((r) => {
    if (filterClassification !== 'ALL' && r.classification !== filterClassification) {
      return false;
    }
    if (searchPreview) {
      const q = searchPreview.toLowerCase();
      const match = Object.values(r.data).some((v) => v.toLowerCase().includes(q));
      if (!match && !r.reason.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Tally Migration & Enterprise Bulk Ingestion</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Data Migration & Import Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Standard CSV/Excel migration with 4-level duplicate detection (GSTIN, Phone, Email, Company Name), human verification review, and atomic document generation.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Download className="w-4 h-4 text-brand-600" />
          <span>Download {activeTemplate.name} Template (.CSV)</span>
        </button>
      </div>

      {/* Step 1: Select Target Entity */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Step 1: Choose Dataset / Ledger to Ingest
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {[
            {
              id: 'customers',
              name: 'Customer Master',
              desc: 'Corporate & Retail Clients with Auto ID',
              icon: Users,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
            },
            {
              id: 'suppliers',
              name: 'Supplier Master',
              desc: 'Vendors, GSTIN & Payment Terms',
              icon: Truck,
              color: 'text-amber-600',
              bg: 'bg-amber-50',
            },
            {
              id: 'opening_receivables',
              name: 'Customer Receivables',
              desc: 'Opening Balances & Overdue Bills',
              icon: Receipt,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
            },
            {
              id: 'opening_payables',
              name: 'Supplier Payables',
              desc: 'Vendor Dues & Pending Purchase Bills',
              icon: CreditCard,
              color: 'text-purple-600',
              bg: 'bg-purple-50',
            },
            {
              id: 'products',
              name: 'Product Catalog',
              desc: 'Equipment SKUs, HSN & Pricing',
              icon: Package,
              color: 'text-indigo-600',
              bg: 'bg-indigo-50',
            },
          ].map((ent) => {
            const Icon = ent.icon;
            const isSelected = selectedEntity === ent.id;
            return (
              <button
                key={ent.id}
                type="button"
                onClick={() => {
                  setSelectedEntity(ent.id);
                  resetUpload();
                }}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-brand-50/50 border-brand-500 ring-2 ring-brand-500/20 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-xl ${ent.bg} ${ent.color} w-fit mb-2`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-xs font-bold text-slate-900 block">{ent.name}</strong>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{ent.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Upload File Area */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Step 2: Upload CSV File
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center ${
            file
              ? 'border-brand-500 bg-brand-50/30'
              : 'border-slate-300 hover:border-brand-500 hover:bg-slate-50/50 bg-white'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.1800,.tsf"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
            <UploadCloud className="w-7 h-7" />
          </div>
          {file ? (
            <div>
              <p className="text-sm font-bold text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500 mt-1">
                {(file.size / 1024).toFixed(1)} KB &bull; {parsedData?.rows.length || 0} records detected
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resetUpload();
                }}
                className="mt-3 text-xs text-rose-600 font-bold hover:underline cursor-pointer"
              >
                Remove and select another file
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-bold text-slate-900">
                Click to browse or drag and drop your CSV file here
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports Tally CSV exports up to 50,000 rows &bull; Must match {activeTemplate.name} template
              </p>
              <p className="text-[11px] text-amber-600 font-semibold mt-2">
                Note: Raw Tally binary files (.1800 / .TSF) cannot be uploaded directly. Please export to standard CSV first.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step 3: Duplicate Detection Classification Breakdown */}
      {isValidating && (
        <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
          <span className="inline-block w-6 h-6 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-700">Running 4-Level Duplicate Detection Engine...</p>
          <p className="text-[11px] text-slate-400">Comparing GSTIN, Phone, Email, and Company Name against database...</p>
        </div>
      )}

      {classificationSummary && !isValidating && !importResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Step 3: 4-Level Duplicate &amp; Integrity Analysis
            </span>
            <span className="text-xs font-bold text-slate-700">
              Total Analyzed: {classificationSummary.total} rows
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                Verified New
              </span>
              <div className="text-2xl font-black mt-0.5">{classificationSummary.newCount}</div>
              <span className="text-[10px] text-emerald-600">Ready for clean import</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                Exact Duplicates
              </span>
              <div className="text-2xl font-black mt-0.5">{classificationSummary.exactDuplicateCount}</div>
              <span className="text-[10px] text-rose-600">Will be safely skipped</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                Possible Duplicates
              </span>
              <div className="text-2xl font-black mt-0.5">{classificationSummary.possibleDuplicateCount}</div>
              <span className="text-[10px] text-amber-600">Phone/Email/Name overlap</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                Review Required
              </span>
              <div className="text-2xl font-black mt-0.5">{classificationSummary.reviewRequiredCount}</div>
              <span className="text-[10px] text-purple-600">Ambiguous conflict</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Invalid Rows
              </span>
              <div className="text-2xl font-black mt-0.5">{classificationSummary.invalidCount}</div>
              <span className="text-[10px] text-slate-400">Missing required data</span>
            </div>
          </div>

          {/* Filtering and Search Toolbar */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchPreview}
                onChange={(e) => setSearchPreview(e.target.value)}
                placeholder="Search preview rows..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterClassification}
                onChange={(e) => setFilterClassification(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-xl outline-none bg-white text-xs font-semibold"
              >
                <option value="ALL">All Classifications ({classifiedRows.length})</option>
                <option value="NEW">New Only ({classificationSummary.newCount})</option>
                <option value="EXACT_DUPLICATE">Exact Duplicates ({classificationSummary.exactDuplicateCount})</option>
                <option value="POSSIBLE_DUPLICATE">Possible Duplicates ({classificationSummary.possibleDuplicateCount})</option>
                <option value="HUMAN_REVIEW_REQUIRED">Review Required ({classificationSummary.reviewRequiredCount})</option>
                <option value="INVALID">Invalid ({classificationSummary.invalidCount})</option>
              </select>
            </div>
          </div>

          {/* Review Table */}
          <div className="border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-32" />
                  <col className="w-48" />
                  <col className="w-36" />
                  <col className="w-auto" />
                </colgroup>
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                  <tr>
                    <th className="py-2 px-3 text-center">Row</th>
                    <th className="py-2 px-3">Classification</th>
                    <th className="py-2 px-3">Entity Name</th>
                    <th className="py-2 px-3">Phone / Contact</th>
                    <th className="py-2 px-3">Duplicate Detection Analysis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.slice(0, 25).map((row) => {
                    let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                    if (row.classification === 'NEW') {
                      badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    } else if (row.classification === 'EXACT_DUPLICATE') {
                      badgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
                    } else if (row.classification === 'POSSIBLE_DUPLICATE') {
                      badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                    } else if (row.classification === 'HUMAN_REVIEW_REQUIRED') {
                      badgeClass = 'bg-purple-50 text-purple-800 border-purple-200';
                    }

                    const entityName =
                      row.data.customer_name ||
                      row.data.company_name ||
                      row.data.supplier_name ||
                      row.data.name ||
                      '—';

                    return (
                      <tr key={row.rowIndex} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono">
                          {row.rowIndex}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${badgeClass}`}
                          >
                            {row.classification.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800 truncate">
                          {entityName}
                        </td>
                        <td className="py-2 px-3 text-slate-600 truncate">
                          {row.data.phone || row.data.contact_person || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px] truncate">
                          {row.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredRows.length > 25 && (
              <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
                Showing first 25 of {filteredRows.length} classified records.
              </div>
            )}
          </div>

          {/* Import Controls & Confirmation */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                />
                <span>Automatically exclude exact duplicates from import (Recommended)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-900">
                <input
                  type="checkbox"
                  checked={userConfirmed}
                  onChange={(e) => setUserConfirmed(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                />
                <span>I have reviewed the duplicate analysis and authorize importing valid records.</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={resetUpload}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleImport}
                disabled={isUploading || !userConfirmed}
                className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md shadow-brand-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing into Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Execute Import ({classificationSummary.newCount} New Records)
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {importResult && importResult.successCount > 0 && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold">
                Successfully Imported {importResult.successCount} Records to Supabase!
              </h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                All records have been committed with sequential codes and audit logging.
              </p>
            </div>
          </div>
          <Link
            href={
              selectedEntity === 'customers'
                ? '/customers'
                : selectedEntity === 'products'
                ? '/dashboard/products'
                : selectedEntity === 'suppliers'
                ? '/dashboard/purchases'
                : '/dashboard/invoices'
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition self-start sm:self-auto cursor-pointer"
          >
            <span>View Imported Records</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
