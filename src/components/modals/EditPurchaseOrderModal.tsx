'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, ShieldCheck, Truck, Building2 } from 'lucide-react';
import type { PurchaseOrder, DeliveryType } from '@/types/erp';
import { updatePurchaseOrder } from '@/lib/actions/procurement';

interface EditPurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrder | null;
  onSuccess: () => void;
}

export default function EditPurchaseOrderModal({
  isOpen,
  onClose,
  po,
  onSuccess,
}: EditPurchaseOrderModalProps) {
  const [formData, setFormData] = useState({
    expected_delivery: '',
    supplier_contact: '',
    delivery_type: 'OFFICE_RECEIPT' as DeliveryType,
    consignee_name: '',
    consignee_address: '',
    consignee_contact: '',
    consignee_phone: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (po) {
      setFormData({
        expected_delivery: po.expected_delivery || '',
        supplier_contact: po.supplier_contact || '',
        delivery_type: po.delivery_type || 'OFFICE_RECEIPT',
        consignee_name: po.consignee_name || '',
        consignee_address: po.consignee_address || '',
        consignee_contact: po.consignee_contact || '',
        consignee_phone: po.consignee_phone || '',
      });
      setErrorMessage(null);
    }
  }, [po]);

  if (!isOpen || !po) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await updatePurchaseOrder(po.id, {
        expected_delivery: formData.expected_delivery,
        supplier_contact: formData.supplier_contact.trim(),
        delivery_type: formData.delivery_type,
        consignee_name: formData.consignee_name.trim(),
        consignee_address: formData.consignee_address.trim(),
        consignee_contact: formData.consignee_contact.trim(),
        consignee_phone: formData.consignee_phone.trim(),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to update purchase order');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const isDropShip = formData.delivery_type === 'DIRECT_CUSTOMER_DROPSHIP';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Edit Purchase Order</span>
              <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {po.po_number}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Supplier: <strong>{po.supplier_name}</strong> &bull; Total: <strong>₹{Math.round(po.total_amount).toLocaleString('en-IN')}</strong>
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
              <label className="block font-semibold mb-1 text-slate-700">Expected Delivery Date</label>
              <input
                type="date"
                value={formData.expected_delivery}
                onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Supplier Contact / Rep</label>
              <input
                type="text"
                value={formData.supplier_contact}
                onChange={(e) => setFormData({ ...formData, supplier_contact: e.target.value })}
                placeholder="e.g. Rahul Sharma (+91 98765...)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Delivery Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, delivery_type: 'OFFICE_RECEIPT' })}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                  !isDropShip
                    ? 'border-brand-500 bg-brand-50/50 text-brand-900 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Building2 className="w-4 h-4 text-brand-600 shrink-0" />
                <div>
                  <div className="text-xs">Office Warehouse</div>
                  <div className="text-[10px] text-slate-400 font-normal">Receive into office inventory</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, delivery_type: 'DIRECT_CUSTOMER_DROPSHIP' })}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                  isDropShip
                    ? 'border-purple-500 bg-purple-50/50 text-purple-900 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Truck className="w-4 h-4 text-purple-600 shrink-0" />
                <div>
                  <div className="text-xs">Direct Drop-Ship</div>
                  <div className="text-[10px] text-slate-400 font-normal">Deliver straight to client site</div>
                </div>
              </button>
            </div>
          </div>

          {isDropShip && (
            <div className="p-3.5 bg-purple-50/40 border border-purple-200 rounded-xl space-y-3">
              <div className="text-xs font-bold text-purple-900">Drop-Ship Consignee Details</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">Consignee Name</label>
                  <input
                    type="text"
                    value={formData.consignee_name}
                    onChange={(e) => setFormData({ ...formData, consignee_name: e.target.value })}
                    placeholder="Client or Site In-Charge"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">Consignee Phone</label>
                  <input
                    type="text"
                    value={formData.consignee_phone}
                    onChange={(e) => setFormData({ ...formData, consignee_phone: e.target.value })}
                    placeholder="+91 ..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none bg-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-slate-700">Drop-Ship Delivery Address</label>
                <input
                  type="text"
                  value={formData.consignee_address}
                  onChange={(e) => setFormData({ ...formData, consignee_address: e.target.value })}
                  placeholder="Complete delivery address with pincode"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                />
              </div>
            </div>
          )}

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>PO items & commercial pricing are locked. Use GRN to receive items.</span>
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
