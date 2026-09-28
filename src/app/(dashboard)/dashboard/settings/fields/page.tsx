'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  CheckCircle2,
  AlertCircle,
  Hash,
  Calendar,
  Type,
  List,
  CheckSquare,
  Search,
  Filter,
  BarChart2,
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';
import {
  getCustomFields,
  addCustomField,
  toggleCustomFieldActive,
} from '@/lib/actions/custom-fields';
import type { CustomFieldDefinition } from '@/types/rbac';

const MODULES: CustomFieldDefinition['module'][] = [
  'Customers',
  'Enquiries',
  'Site Visits',
  'Quotations',
  'Sales Orders',
  'Purchases',
  'Invoices',
  'Service',
  'Employees',
];

const FIELD_TYPES: CustomFieldDefinition['field_type'][] = [
  'Text',
  'Number',
  'Date',
  'Dropdown',
  'Checkbox',
];

export default function CustomFieldRegistryPage() {
  const [selectedModule, setSelectedModule] =
    useState<CustomFieldDefinition['module']>('Customers');
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // New field form state
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] =
    useState<CustomFieldDefinition['field_type']>('Text');
  const [optionsStr, setOptionsStr] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [isSearchable, setIsSearchable] = useState(true);
  const [isFilterable, setIsFilterable] = useState(true);
  const [isReportable, setIsReportable] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadModuleFields = async (mod: CustomFieldDefinition['module']) => {
    setLoading(true);
    try {
      const list = await getCustomFields(mod);
      setFields(list);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to load custom fields' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModuleFields(selectedModule);
  }, [selectedModule]);

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim()) return;

    setIsSubmitting(true);
    setNotification(null);
    try {
      const options =
        fieldType === 'Dropdown' && optionsStr.trim()
          ? optionsStr.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined;

      const res = await addCustomField({
        module: selectedModule,
        field_label: fieldLabel.trim(),
        field_key: (fieldKey.trim() || undefined) as any,
        field_type: fieldType,
        options,
        is_required: isRequired,
        is_searchable: isSearchable,
        is_filterable: isFilterable,
        is_reportable: isReportable,
      });

      if (res.success) {
        setNotification({
          type: 'success',
          text: `Custom field "${fieldLabel}" registered for ${selectedModule}!`,
        });
        setFieldLabel('');
        setFieldKey('');
        setOptionsStr('');
        setIsRequired(false);
        setIsSearchable(true);
        setIsFilterable(true);
        setIsReportable(true);
        await loadModuleFields(selectedModule);
      } else {
        setNotification({ type: 'error', text: res.error || 'Failed to register field' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    const res = await toggleCustomFieldActive(id, !currentActive);
    if (res.success) {
      setNotification({
        type: 'success',
        text: `Field status updated successfully.`,
      });
      await loadModuleFields(selectedModule);
    } else {
      setNotification({ type: 'error', text: res.error || 'Failed to update field' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Custom Field Registry
          </h1>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            Schema Extensibility
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Dynamically extend business entity records across 9 ERP modules with custom attributes, indexing flags, and audit tracking
        </p>
      </div>

      <SettingsNav />

      {notification && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Module Tabs (9 Modules) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {MODULES.map((mod) => (
          <button
            key={mod}
            type="button"
            onClick={() => setSelectedModule(mod)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedModule === mod
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {mod}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table of Fields */}
        <div className="lg:col-span-2 border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-800">
                Custom Fields for: <span className="text-emerald-700">{selectedModule}</span> ({fields.length})
              </h3>
            </div>
          </div>

          {/* Desktop Zero-Scroll Table */}
          <div className="hidden md:block w-full">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <colgroup>
                <col className="w-[36%]" />
                <col className="w-[18%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Field Label & Key</th>
                  <th className="py-2.5 px-3 text-center">Type</th>
                  <th className="py-2.5 px-3 text-center">Flags</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fields.map((fld) => (
                  <tr key={fld.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 truncate">{fld.field_label}</div>
                      <div className="font-mono text-slate-500 text-[10px] truncate">{fld.field_key}</div>
                      {fld.options && fld.options.length > 0 && (
                        <span className="text-[10px] text-slate-400 font-normal truncate block mt-0.5">
                          Options: {fld.options.slice(0, 3).join(', ')}
                          {fld.options.length > 3 ? ` +${fld.options.length - 3} more` : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {fld.field_type === 'Number' && <Hash className="w-3 h-3 text-slate-500" />}
                        {fld.field_type === 'Date' && <Calendar className="w-3 h-3 text-slate-500" />}
                        {fld.field_type === 'Text' && <Type className="w-3 h-3 text-slate-500" />}
                        {fld.field_type === 'Dropdown' && <List className="w-3 h-3 text-slate-500" />}
                        {fld.field_type === 'Checkbox' && <CheckSquare className="w-3 h-3 text-slate-500" />}
                        <span>{fld.field_type}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {fld.is_required && (
                          <span title="Mandatory Field" className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            REQ
                          </span>
                        )}
                        {fld.is_searchable && (
                          <span title="Searchable" className="p-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            <Search className="w-3 h-3" />
                          </span>
                        )}
                        {fld.is_filterable && (
                          <span title="Filterable" className="p-1 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            <Filter className="w-3 h-3" />
                          </span>
                        )}
                        {fld.is_reportable && (
                          <span title="Reportable" className="p-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            <BarChart2 className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          fld.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}
                      >
                        {fld.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggle(fld.id, fld.is_active)}
                        className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                          fld.is_active
                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {fld.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Fields Cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {fields.map((fld) => (
              <div key={fld.id} className="p-4 space-y-2 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="text-slate-900 block font-bold text-sm">{fld.field_label}</strong>
                    <span className="text-[10px] font-mono text-slate-400">{fld.field_key}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      fld.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}
                  >
                    {fld.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                    Type: {fld.field_type}
                  </span>
                  {fld.is_required && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                      Required
                    </span>
                  )}
                  {fld.is_searchable && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                      Searchable
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleToggle(fld.id, fld.is_active)}
                  className={`w-full min-h-[44px] flex items-center justify-center rounded-xl font-bold text-xs ${
                    fld.is_active
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {fld.is_active ? 'Deactivate Field' : 'Activate Field'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add New Custom Field Form */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 h-fit">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Define Custom Field</h3>
              <p className="text-[11px] text-slate-500">Attach to {selectedModule}</p>
            </div>
          </div>

          <form onSubmit={handleAddField} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Field Label *</label>
              <input
                type="text"
                required
                value={fieldLabel}
                onChange={(e) => {
                  setFieldLabel(e.target.value);
                  if (!fieldKey || fieldKey === fieldLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_')) {
                    setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                  }
                }}
                placeholder="e.g. GeM Cart ID or Project Lead Time"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Field Key (API / DB identifier)</label>
              <input
                type="text"
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
                placeholder="e.g. gem_cart_id"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none font-mono text-[11px] focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Field Type</label>
              <select
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium focus:ring-2 focus:ring-emerald-500/20"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {fieldType === 'Dropdown' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Options (comma-separated)</label>
                <input
                  type="text"
                  value={optionsStr}
                  onChange={(e) => setOptionsStr(e.target.value)}
                  placeholder="Option 1, Option 2, Option 3"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_req"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="is_req" className="font-bold text-slate-700 select-none">
                  Make this field mandatory
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_search"
                  checked={isSearchable}
                  onChange={(e) => setIsSearchable(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_search" className="text-slate-600 select-none">
                  Enable in Global Search
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_filt"
                  checked={isFilterable}
                  onChange={(e) => setIsFilterable(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="is_filt" className="text-slate-600 select-none">
                  Enable in Table Filters
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_rep"
                  checked={isReportable}
                  onChange={(e) => setIsReportable(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="is_rep" className="text-slate-600 select-none">
                  Include in Business Reports & Exports
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !fieldLabel.trim()}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs disabled:opacity-50 mt-2"
            >
              {isSubmitting ? 'Registering...' : 'Register Custom Field'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
