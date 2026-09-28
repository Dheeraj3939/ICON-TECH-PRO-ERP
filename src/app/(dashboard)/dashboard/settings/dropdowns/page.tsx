'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Plus,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Lock,
  Tag,
  ListFilter,
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';
import {
  getDropdownOptions,
  addDropdownOption,
  toggleDropdownOptionActive,
} from '@/lib/actions/dropdowns';
import type { DropdownOptionConfig } from '@/types/rbac';

const CATEGORIES: DropdownOptionConfig['category'][] = [
  'Enquiry Source',
  'Customer Industry',
  'Customer Type',
  'Payment Mode',
  'Project Room Type',
  'Department',
  'Designation',
  'Lead Source',
];

export default function CustomDropdownManagerPage() {
  const [selectedCategory, setSelectedCategory] =
    useState<DropdownOptionConfig['category']>('Enquiry Source');
  const [options, setOptions] = useState<DropdownOptionConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // New option form state
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadCategoryOptions = async (cat: DropdownOptionConfig['category']) => {
    setLoading(true);
    try {
      const list = await getDropdownOptions(cat);
      setOptions(list);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to load options' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategoryOptions(selectedCategory);
  }, [selectedCategory]);

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    setIsSubmitting(true);
    setNotification(null);
    try {
      const res = await addDropdownOption({
        category: selectedCategory,
        label: newLabel.trim(),
        value: newValue.trim() || undefined,
      });

      if (res.success) {
        setNotification({
          type: 'success',
          text: `Added "${newLabel}" to ${selectedCategory} dropdown successfully!`,
        });
        setNewLabel('');
        setNewValue('');
        await loadCategoryOptions(selectedCategory);
      } else {
        setNotification({ type: 'error', text: res.error || 'Failed to add option' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    const res = await toggleDropdownOptionActive(id, !currentActive);
    if (res.success) {
      setNotification({
        type: 'success',
        text: `Option status updated successfully.`,
      });
      await loadCategoryOptions(selectedCategory);
    } else {
      setNotification({ type: 'error', text: res.error || 'Failed to update option' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Custom Dropdown Manager
          </h1>
          <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold">
            Dynamic Taxonomy
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Customize system selection menus across modules with zero code changes or database migrations
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

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedCategory === cat
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table of Options */}
        <div className="lg:col-span-2 border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold text-slate-800">
                Options for: <span className="text-purple-700">{selectedCategory}</span> ({options.length})
              </h3>
            </div>
          </div>

          {/* Desktop Zero-Scroll Table */}
          <div className="hidden md:block w-full">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <colgroup>
                <col className="w-[42%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Display Label & Internal Value</th>
                  <th className="py-2.5 px-3 text-center">Type</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {options.map((opt) => (
                  <tr key={opt.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{opt.label}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">{opt.value}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {opt.is_system ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>System</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <Tag className="w-3 h-3 text-purple-500" />
                          <span>Custom</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          opt.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}
                      >
                        {opt.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {opt.is_system ? (
                        <span className="text-[10px] text-slate-400 italic">Protected</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggle(opt.id, opt.is_active)}
                          className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                            opt.is_active
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {opt.is_active ? 'Disable' : 'Enable'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Options Cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {options.map((opt) => (
              <div key={opt.id} className="p-3 bg-white space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="text-slate-900 block font-bold text-xs">{opt.label}</strong>
                    <span className="text-[10px] font-mono text-slate-400">{opt.value}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {opt.is_system ? (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">System</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-bold">Custom</span>
                    )}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        opt.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {opt.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>
                {!opt.is_system && (
                  <button
                    type="button"
                    onClick={() => handleToggle(opt.id, opt.is_active)}
                    className={`w-full min-h-[44px] flex items-center justify-center rounded-xl font-bold text-xs ${
                      opt.is_active
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {opt.is_active ? 'Disable Option' : 'Enable Option'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add New Option Form */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 h-fit">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Add New Option</h3>
              <p className="text-[11px] text-slate-500">Add to {selectedCategory}</p>
            </div>
          </div>

          <form onSubmit={handleAddOption} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Option Display Label *</label>
              <input
                type="text"
                required
                value={newLabel}
                onChange={(e) => {
                  setNewLabel(e.target.value);
                  if (!newValue || newValue === newLabel.replace(/\s+/g, '_').toUpperCase()) {
                    setNewValue(e.target.value.replace(/\s+/g, '_').toUpperCase());
                  }
                }}
                placeholder="e.g. Smart City Command Center"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Code / Stored Value</label>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="e.g. SMART_CITY_COMMAND"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none font-mono text-[11px] focus:ring-2 focus:ring-purple-500/20"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Value stored in database / quotation line items
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !newLabel.trim()}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add to Dropdown'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
