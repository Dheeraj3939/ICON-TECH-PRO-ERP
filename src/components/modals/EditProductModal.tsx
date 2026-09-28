'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Product } from '@/types/erp';
import { updateProduct } from '@/lib/actions/products';

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  categories: string[];
  canViewCost?: boolean;
  onSuccess: () => void;
}

export default function EditProductModal({
  isOpen,
  onClose,
  product,
  categories,
  canViewCost = false,
  onSuccess,
}: EditProductModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    brand_name: '',
    model_name: '',
    category_name: '',
    unit: 'Nos.',
    hsn_sac: '',
    gst_rate: 18,
    purchase_price: 0,
    selling_price: 0,
    mrp: 0,
    target_margin_pct: 20,
    reorder_level: 2,
    is_active: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        brand_name: product.brand_name || '',
        model_name: product.model_name || '',
        category_name: product.category_name || (categories[0] || 'Projector'),
        unit: product.unit || 'Nos.',
        hsn_sac: product.hsn_sac || '',
        gst_rate: product.gst_rate ?? 18,
        purchase_price: product.purchase_price ?? 0,
        selling_price: product.selling_price ?? 0,
        mrp: product.mrp ?? 0,
        target_margin_pct: product.target_margin_pct ?? 20,
        reorder_level: product.reorder_level ?? 2,
        is_active: product.is_active ?? true,
      });
      setErrorMessage(null);
    }
  }, [product, categories]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await updateProduct(product.id, {
        name: formData.name.trim(),
        brand_name: formData.brand_name.trim(),
        model_name: formData.model_name.trim(),
        category_name: formData.category_name,
        unit: formData.unit,
        hsn_sac: formData.hsn_sac.trim(),
        gst_rate: Number(formData.gst_rate),
        ...(canViewCost ? { purchase_price: Number(formData.purchase_price) } : {}),
        selling_price: Number(formData.selling_price),
        mrp: Number(formData.mrp),
        target_margin_pct: Number(formData.target_margin_pct),
        reorder_level: Number(formData.reorder_level),
        is_active: formData.is_active,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to update product');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Edit Catalog Product</span>
              <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {product.sku}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Master catalog correction & specifications maintenance
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">SKU Code (Protected)</label>
              <input
                type="text"
                disabled
                value={product.sku}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 font-mono font-bold cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Category *</label>
              <select
                value={formData.category_name}
                onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none bg-white font-medium"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Product Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Brand Name</label>
              <input
                type="text"
                value={formData.brand_name}
                onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Model Name / Number</label>
              <input
                type="text"
                value={formData.model_name}
                onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">HSN / SAC</label>
              <input
                type="text"
                value={formData.hsn_sac}
                onChange={(e) => setFormData({ ...formData, hsn_sac: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">GST Rate (%)</label>
              <select
                value={formData.gst_rate}
                onChange={(e) => setFormData({ ...formData, gst_rate: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none bg-white font-medium"
              >
                <option value={0}>0% (Exempt)</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18% (Standard)</option>
                <option value={28}>28%</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Unit of Measure</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {canViewCost && (
              <div>
                <label className="block font-semibold mb-1 text-slate-700">Purchase Cost (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                />
              </div>
            )}
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Selling Price (₹) *</label>
              <input
                type="number"
                min={0}
                required
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">MRP (₹)</label>
              <input
                type="number"
                min={0}
                value={formData.mrp}
                onChange={(e) => setFormData({ ...formData, mrp: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Target Margin (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={formData.target_margin_pct}
                onChange={(e) => setFormData({ ...formData, target_margin_pct: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Reorder Level (Qty)</label>
              <input
                type="number"
                min={0}
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
              />
            </div>
          </div>

          {/* Protected Stock Note */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between text-[11px] text-amber-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Current Stock: <strong>{product.current_stock} {product.unit}</strong> (Strictly managed via verified GRN / delivery logs)</span>
            </div>
            <label className="flex items-center gap-1.5 font-bold cursor-pointer text-slate-800">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Active</span>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
