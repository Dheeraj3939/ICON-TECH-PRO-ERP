'use client';

import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import { parseCSV, IMPORT_TEMPLATES, ImportTemplateConfig } from '@/lib/utils/csv-parser';
import {
  bulkImportCustomers,
  bulkImportProducts,
  bulkImportSuppliers,
  BulkImportResult,
} from '@/lib/actions/bulk-import';

export default function BulkImportPage() {
  const [selectedEntity, setSelectedEntity] = useState<string>('customers');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{
    headers: string[];
    rows: Record<string, string>[];
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTemplate: ImportTemplateConfig = IMPORT_TEMPLATES[selectedEntity];

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

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setErrorMsg('Please upload a valid .csv file format.');
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result = parseCSV(text);

      if (result.rows.length === 0) {
        setErrorMsg('The uploaded CSV file contains no data rows.');
        setParsedData(null);
      } else {
        setParsedData(result);
      }
    };
    reader.readAsText(selectedFile);
  };

  // Execute Bulk Import
  const handleImport = async () => {
    if (!parsedData || parsedData.rows.length === 0) return;

    setIsUploading(true);
    setErrorMsg(null);

    try {
      let res: BulkImportResult;
      if (selectedEntity === 'customers') {
        res = await bulkImportCustomers(parsedData.rows);
      } else if (selectedEntity === 'products') {
        res = await bulkImportProducts(parsedData.rows);
      } else {
        res = await bulkImportSuppliers(parsedData.rows);
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
    setImportResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Enterprise Data Migration & Bulk Ingestion</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Bulk Data Import Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Upload large datasets into Supabase PostgreSQL with auto sequence formatting, column validation, and instant preview.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 text-xs font-bold shadow-xs transition"
        >
          <Download className="w-4 h-4 text-brand-600" />
          <span>Download {activeTemplate.name} Template (.CSV)</span>
        </button>
      </div>

      {/* Step 1: Select Target Entity */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Step 1: Choose Dataset to Ingest
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              id: 'customers',
              name: 'Customer Master',
              desc: 'Corporate B2B & Individual B2C records with ICONYYXXXX IDs',
              icon: Users,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
            },
            {
              id: 'products',
              name: 'Product Catalog & Pricing',
              desc: 'SKUs, categories, purchase costs, selling prices & stock levels',
              icon: Package,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
            },
            {
              id: 'suppliers',
              name: 'Suppliers & Vendors',
              desc: 'Equipment distributors, GSTIN, payment terms & contacts',
              icon: Truck,
              color: 'text-amber-600',
              bg: 'bg-amber-50',
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
                className={`p-4 rounded-2xl border text-left transition flex items-start gap-3.5 ${
                  isSelected
                    ? 'bg-brand-50/50 border-brand-500 ring-2 ring-brand-500/20 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-xl ${ent.bg} ${ent.color} flex-shrink-0 mt-0.5`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <strong className="text-sm font-bold text-slate-900 block">{ent.name}</strong>
                  <p className="text-xs text-slate-500 mt-1">{ent.desc}</p>
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
            accept=".csv"
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
                className="mt-3 text-xs text-rose-600 font-bold hover:underline"
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
                Supports bulk files up to 50,000 rows &bull; Must match {activeTemplate.name} columns
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
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
                All records are now committed and queryable across all ERP modules.
              </p>
            </div>
          </div>
          <Link
            href={
              selectedEntity === 'customers'
                ? '/customers'
                : selectedEntity === 'products'
                ? '/dashboard/products'
                : '/dashboard/purchases'
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition self-start sm:self-auto"
          >
            <span>View Imported Records</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Step 3: Live Preview & Commit */}
      {parsedData && parsedData.rows.length > 0 && !importResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Step 3: Verification & Ingestion Preview
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {parsedData.rows.length} Records Ready for Commitment
              </h3>
            </div>
            <button
              onClick={handleImport}
              disabled={isUploading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-brand-500/20 transition"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Ingesting into Database...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Commit {parsedData.rows.length} Records to Database</span>
                </>
              )}
            </button>
          </div>

          {/* Table Preview */}
          <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
            {/* Desktop Zero-Scroll Table */}
            <div className="hidden md:block max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <colgroup>
                  <col className="w-10" />
                  {parsedData.headers.map((h) => (
                    <col key={h} style={{ width: `${100 / parsedData.headers.length}%` }} />
                  ))}
                </colgroup>
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    {parsedData.headers.map((h) => (
                      <th key={h} className="py-2.5 px-3 truncate">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedData.rows.slice(0, 15).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      {parsedData.headers.map((h) => (
                        <td key={h} className="py-2.5 px-3 text-slate-700 truncate">
                          {row[h] || <span className="text-slate-300 italic">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Zero-Scroll Cards */}
            <div className="block md:hidden max-h-96 overflow-y-auto space-y-3 p-3">
              {parsedData.rows.slice(0, 15).map((row, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                  <div className="font-bold text-slate-500 uppercase text-[10px] pb-1 border-b border-slate-200/60">
                    Record #{idx + 1}
                  </div>
                  {parsedData.headers.map((h) => (
                    <div key={h} className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium">{h}:</span>
                      <span className="text-slate-800 font-semibold text-right truncate max-w-[60%]">
                        {row[h] || <span className="text-slate-300 italic">—</span>}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {parsedData.rows.length > 15 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
                Showing first 15 of {parsedData.rows.length} records. All records will be imported upon confirmation.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
