'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, ShieldCheck, ShoppingBag } from 'lucide-react';
import type { SalesOrder } from '@/types/erp';
import { updateSalesOrder } from '@/lib/actions/orders';

interface EditSalesOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SalesOrder | null;
  onSuccess: () => void;
}

export default function EditSalesOrderModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: EditSalesOrderModalProps) {
  const [formData, setFormData] = useState({
    customer_po_reference: '',
    expected_delivery: '',
    place_of_supply: '36 - Telangana',
    customer_billing_state: 'Telangana',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setFormData({
        customer_po_reference: (order as any).customer_po_reference || '',
        expected_delivery: (order as any).expected_delivery || '',
        place_of_supply: order.place_of_supply || '36 - Telangana',
        customer_billing_state: order.place_of_supply?.includes('Telangana') ? 'Telangana' : 'Andhra Pradesh',
        notes: (order as any).notes || '',
      });
      setErrorMessage(null);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await updateSalesOrder(order.id, {
        customer_po_reference: formData.customer_po_reference.trim(),
        expected_delivery: formData.expected_delivery,
        place_of_supply: formData.place_of_supply,
        customer_billing_state: formData.customer_billing_state,
        notes: formData.notes.trim(),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to update sales order');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Edit Sales Order Details</span>
              <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {order.order_number}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Client: <strong>{order.company_name || order.customer_name}</strong> &bull; Value: <strong>₹{Math.round(order.total_amount).toLocaleString('en-IN')}</strong>
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
              <label className="block font-semibold mb-1 text-slate-700">Customer PO Reference #</label>
              <input
                type="text"
                value={formData.customer_po_reference}
                onChange={(e) => setFormData({ ...formData, customer_po_reference: e.target.value })}
                placeholder="e.g. PO/2026/0912"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Expected Delivery Date</label>
              <input
                type="date"
                value={formData.expected_delivery}
                onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Place of Supply (GST)</label>
              <select
                value={formData.place_of_supply}
                onChange={(e) => setFormData({ ...formData, place_of_supply: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="36 - Telangana">36 - Telangana</option>
                <option value="37 - Andhra Pradesh">37 - Andhra Pradesh</option>
                <option value="29 - Karnataka">29 - Karnataka</option>
                <option value="27 - Maharashtra">27 - Maharashtra</option>
                <option value="33 - Tamil Nadu">33 - Tamil Nadu</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Customer State</label>
              <input
                type="text"
                value={formData.customer_billing_state}
                onChange={(e) => setFormData({ ...formData, customer_billing_state: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Order Delivery Notes / Special Instructions</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Call client security in advance; delivery only between 10am - 4pm"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Line items & commercial totals are protected. Dispatched or invoiced orders are locked.</span>
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
              <span>{submitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
