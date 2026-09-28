'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Database,
  CheckCircle2,
  Table,
  Sliders,
  BarChart3,
  Save,
  Play,
  RotateCcw,
} from 'lucide-react';
import { executeReport, createCustomReport } from '@/lib/actions/reports';
import type {
  ReportDataSource,
  ReportCalculation,
  ReportDefinition,
  ReportResult,
} from '@/types/reports';

const DATA_SOURCE_FIELDS: Record<ReportDataSource, Array<{ key: string; label: string; defaultSelected?: boolean }>> = {
  SALES_ORDERS: [
    { key: 'order_number', label: 'Order Number', defaultSelected: true },
    { key: 'customer_name', label: 'Customer Name', defaultSelected: true },
    { key: 'salesperson_name', label: 'Sales Rep', defaultSelected: true },
    { key: 'total_amount', label: 'Total Amount', defaultSelected: true },
    { key: 'status', label: 'Status', defaultSelected: true },
    { key: 'material_status', label: 'Material Readiness', defaultSelected: true },
    { key: 'order_date', label: 'Order Date', defaultSelected: true },
  ],
  QUOTATIONS: [
    { key: 'quotation_number', label: 'Quote Number', defaultSelected: true },
    { key: 'customer_name', label: 'Customer Name', defaultSelected: true },
    { key: 'salesperson_name', label: 'Sales Rep', defaultSelected: true },
    { key: 'grand_total', label: 'Grand Total', defaultSelected: true },
    { key: 'status', label: 'Status', defaultSelected: true },
    { key: 'version_tag', label: 'Version Tag', defaultSelected: true },
  ],
  INVOICES: [
    { key: 'invoice_number', label: 'Invoice Number', defaultSelected: true },
    { key: 'customer_name', label: 'Customer Name', defaultSelected: true },
    { key: 'grand_total', label: 'Grand Total', defaultSelected: true },
    { key: 'paid_amount', label: 'Amount Paid', defaultSelected: true },
    { key: 'balance_amount', label: 'Balance Due', defaultSelected: true },
    { key: 'status', label: 'Status', defaultSelected: true },
    { key: 'due_date', label: 'Due Date', defaultSelected: true },
  ],
  PURCHASE_ORDERS: [
    { key: 'po_number', label: 'PO Number', defaultSelected: true },
    { key: 'supplier_name', label: 'Distributor/Supplier', defaultSelected: true },
    { key: 'delivery_type', label: 'Delivery Type', defaultSelected: true },
    { key: 'total_amount', label: 'Total Amount', defaultSelected: true },
    { key: 'status', label: 'Status', defaultSelected: true },
  ],
  SERIALS: [
    { key: 'serial_number', label: 'Serial Number', defaultSelected: true },
    { key: 'product_name', label: 'Product Name', defaultSelected: true },
    { key: 'warranty_provider', label: 'Warranty Source', defaultSelected: true },
    { key: 'warranty_end_date', label: 'Warranty Expiry', defaultSelected: true },
    { key: 'status', label: 'Status', defaultSelected: true },
  ],
  INVENTORY: [
    { key: 'name', label: 'Product Name', defaultSelected: true },
    { key: 'sku', label: 'SKU Code', defaultSelected: true },
    { key: 'brand_name', label: 'Brand', defaultSelected: true },
    { key: 'category_name', label: 'Category', defaultSelected: true },
    { key: 'current_stock', label: 'Office Stock', defaultSelected: true },
    { key: 'selling_price', label: 'Selling Price', defaultSelected: true },
  ],
  CUSTOMERS: [
    { key: 'customer_code', label: 'Customer Code', defaultSelected: true },
    { key: 'customer_name', label: 'Customer Name', defaultSelected: true },
    { key: 'phone', label: 'Phone', defaultSelected: true },
    { key: 'city', label: 'City', defaultSelected: true },
    { key: 'credit_limit', label: 'Credit Limit', defaultSelected: true },
    { key: 'status', label: 'Status', defaultSelected: true },
  ],
  SERVICE: [
    { key: 'contract_number', label: 'AMC Contract #', defaultSelected: true },
    { key: 'customer_name', label: 'Customer Name', defaultSelected: true },
    { key: 'contract_value', label: 'Contract Value', defaultSelected: true },
    { key: 'annual_visits_count', label: 'Visits Count', defaultSelected: true },
    { key: 'end_date', label: 'Renewal Date', defaultSelected: true },
  ],
};

export function ReportBuilder() {
  const router = useRouter();

  // Builder configuration states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dataSource, setDataSource] = useState<ReportDataSource>('SALES_ORDERS');
  const [selectedFields, setSelectedFields] = useState<string[]>(
    DATA_SOURCE_FIELDS['SALES_ORDERS'].map((f) => f.key)
  );
  const [groupByField, setGroupByField] = useState<string>('');
  const [calculation, setCalculation] = useState<ReportCalculation>('SUM');
  const [calculationField, setCalculationField] = useState<string>('total_amount');

  // Preview state
  const [previewResult, setPreviewResult] = useState<ReportResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // When data source changes, reset selected fields
  useEffect(() => {
    const fields = DATA_SOURCE_FIELDS[dataSource] || [];
    setSelectedFields(fields.map((f) => f.key));
    setGroupByField('');
    if (dataSource === 'INVOICES') {
      setCalculationField('balance_amount');
    } else if (dataSource === 'QUOTATIONS') {
      setCalculationField('grand_total');
    } else if (dataSource === 'SALES_ORDERS' || dataSource === 'PURCHASE_ORDERS') {
      setCalculationField('total_amount');
    } else {
      setCalculationField('');
    }
  }, [dataSource]);

  // Execute preview
  const handleRunPreview = async () => {
    setLoadingPreview(true);
    try {
      const draftDef: ReportDefinition = {
        id: 'PREVIEW',
        title: title || 'Custom Report Preview',
        description: description || '',
        data_source: dataSource,
        category: 'CUSTOM',
        selected_fields: selectedFields,
        group_by_field: groupByField || undefined,
        calculation: groupByField ? calculation : undefined,
        calculation_field: groupByField ? calculationField : undefined,
        is_company_report: false,
        created_by: 'User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const res = await executeReport(draftDef);
      if (res.success && res.data) {
        setPreviewResult(res.data);
      }
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSaveReport = async () => {
    if (!title.trim()) {
      alert('Please enter a report title');
      return;
    }

    setSaving(true);
    try {
      const res = await createCustomReport({
        title,
        description,
        data_source: dataSource,
        category: 'CUSTOM',
        selected_fields: selectedFields,
        group_by_field: groupByField || undefined,
        calculation: groupByField ? calculation : undefined,
        calculation_field: groupByField ? calculationField : undefined,
        is_company_report: false,
        created_by: '',
      });

      if (res.success) {
        setSavedSuccess(true);
        setTimeout(() => {
          router.push('/dashboard/reports');
        }, 1200);
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleField = (key: string) => {
    if (selectedFields.includes(key)) {
      if (selectedFields.length > 1) {
        setSelectedFields(selectedFields.filter((f) => f !== key));
      }
    } else {
      setSelectedFields([...selectedFields, key]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/reports"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-600" />
              Custom Report Builder
            </h1>
            <p className="text-xs text-slate-500">
              Visual parameter generator with mathematical aggregations and server-side RBAC protection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunPreview}
            disabled={loadingPreview}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {loadingPreview ? 'Calculating...' : 'Preview Report'}
          </button>

          <button
            onClick={handleSaveReport}
            disabled={saving || !title.trim()}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-brand-500/20 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : savedSuccess ? 'Saved to Library!' : 'Save to Library'}
          </button>
        </div>
      </div>

      {/* 2-Column Builder Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration Controls */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-brand-600" />
              1. Report Details
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Report Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 Orders by Sales Representative"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-brand-500 transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Description / Notes</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Explain the purpose of this report..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-brand-500 transition"
              />
            </div>
          </div>

          {/* Data Source Selection */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-brand-600" />
              2. Data Source
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'SALES_ORDERS', label: 'Sales Orders' },
                { id: 'QUOTATIONS', label: 'Quotations' },
                { id: 'INVOICES', label: 'Tax Invoices' },
                { id: 'PURCHASE_ORDERS', label: 'Purchase Orders' },
                { id: 'SERIALS', label: 'Serial Assets' },
                { id: 'INVENTORY', label: 'Office Stock' },
                { id: 'CUSTOMERS', label: 'Customers' },
                { id: 'SERVICE', label: 'AMC Contracts' },
              ].map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => setDataSource(ds.id as ReportDataSource)}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                    dataSource === ds.id
                      ? 'bg-brand-50 border-brand-300 text-brand-700 shadow-xs'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {ds.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fields Selection */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Table className="w-4 h-4 text-brand-600" />
              3. Columns & Fields
            </h3>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {(DATA_SOURCE_FIELDS[dataSource] || []).map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 text-xs font-medium text-slate-700 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f.key)}
                    onChange={() => toggleField(f.key)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>{f.label}</span>
                  <span className="text-[10px] font-mono text-slate-400 ml-auto">{f.key}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Aggregations & Grouping */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-brand-600" />
              4. Grouping & Math
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Group By Column</label>
              <select
                value={groupByField}
                onChange={(e) => setGroupByField(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="">No Grouping (Flat Table)</option>
                {(DATA_SOURCE_FIELDS[dataSource] || []).map((f) => (
                  <option key={f.key} value={f.key}>
                    Group by: {f.label}
                  </option>
                ))}
              </select>
            </div>

            {groupByField && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Aggregation</label>
                  <select
                    value={calculation}
                    onChange={(e) => setCalculation(e.target.value as ReportCalculation)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="SUM">SUM</option>
                    <option value="AVERAGE">AVERAGE</option>
                    <option value="COUNT">COUNT</option>
                    <option value="MAX">MAX</option>
                    <option value="MIN">MIN</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Target Field</label>
                  <input
                    type="text"
                    value={calculationField}
                    onChange={(e) => setCalculationField(e.target.value)}
                    placeholder="e.g. total_amount"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Data Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {title || 'Report Output Preview'}
                </h3>
                <p className="text-xs text-slate-400">
                  {description || 'Click "Preview Report" above to compile data.'}
                </p>
              </div>

              {previewResult && (
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Records</span>
                  <span className="text-sm font-black text-slate-900">
                    {previewResult.summary.totalRecords}
                  </span>
                </div>
              )}
            </div>

            {loadingPreview ? (
              <div className="py-20 text-center text-xs font-medium text-slate-400">
                Executing report query engine...
              </div>
            ) : previewResult ? (
              <div className="space-y-4">
                {/* Desktop Zero-Scroll Table */}
                <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs table-fixed">
                    <colgroup>
                      {previewResult.columns.map((col) => (
                        <col key={col.key} style={{ width: `${100 / previewResult.columns.length}%` }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        {previewResult.columns.map((col) => (
                          <th key={col.key} className="p-3 truncate">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewResult.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          {previewResult.columns.map((col) => (
                            <td key={col.key} className="p-3 truncate">
                              {col.type === 'currency' ? (
                                <span className="font-bold text-slate-900 font-mono">
                                  ₹{Number(row[col.key] || 0).toLocaleString('en-IN')}
                                </span>
                              ) : (
                                <span>{String(row[col.key] ?? '—')}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Zero-Scroll Cards */}
                <div className="block md:hidden space-y-3">
                  {previewResult.rows.map((row, idx) => (
                    <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                      {previewResult.columns.map((col) => (
                        <div key={col.key} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">{col.label}</span>
                          {col.type === 'currency' ? (
                            <span className="font-mono font-bold text-slate-900">
                              ₹{Number(row[col.key] || 0).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-800 text-right truncate max-w-[60%]">
                              {String(row[col.key] ?? '—')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                Configure data source and click "Preview Report" to inspect output.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
