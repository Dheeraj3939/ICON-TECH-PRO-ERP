'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, FileCheck, AlertCircle } from 'lucide-react';
import { createProformaInvoice } from '@/lib/actions/proforma';
import { getCustomers } from '@/lib/actions/customers';
import type { Customer } from '@/types/customer';

interface NewProformaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (proforma: any) => void;
}

interface FormItem {
  description: string;
  model_name: string;
  brand_name: string;
  hsn_sac: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_pct: number;
  gst_rate: number;
}

export function NewProformaModal({ isOpen, onClose, onSuccess }: NewProformaModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('36 - Telangana');
  const [pricingMode, setPricingMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('EXCLUSIVE');
  const [validityDays, setValidityDays] = useState(15);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState('50% Advance with Order Confirmation, Balance on Delivery');
  const [deliveryTerms, setDeliveryTerms] = useState('Immediate dispatch from Hyderabad central hub');
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<FormItem[]>([
    {
      description: '',
      model_name: '',
      brand_name: '',
      hsn_sac: '85285200',
      quantity: 1,
      unit: 'Nos.',
      rate: 0,
      discount_pct: 0,
      gst_rate: 18,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getCustomers().then((res) => {
        if (res.customers) setCustomers(res.customers);
      }).catch(() => {});
    }
  }, [isOpen]);

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

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setCustomerName(found.customer_name);
      setCompanyName(found.company_name || '');
      setGstin(found.gstin || '');
      setBillingAddress(found.billing_address || `${found.city || 'Hyderabad'}, ${found.state || 'Telangana'}`);
      setShippingAddress(found.shipping_address || found.billing_address || `${found.city || 'Hyderabad'}, ${found.state || 'Telangana'}`);
      setPlaceOfSupply(found.state ? `${found.state_code || '36'} - ${found.state}` : '36 - Telangana');
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: '',
        model_name: '',
        brand_name: '',
        hsn_sac: '85285200',
        quantity: 1,
        unit: 'Nos.',
        rate: 0,
        discount_pct: 0,
        gst_rate: 18,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof FormItem, val: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  // Live Math calculations
  let subtotal = 0;
  let totalDiscount = 0;
  let gstTotal = 0;
  let taxableSum = 0;

  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.rate) || 0;
    const disc = Number(it.discount_pct) || 0;
    const gross = qty * rate;
    const discAmt = (gross * disc) / 100;
    const net = gross - discAmt;
    const gstRate = Number(it.gst_rate) || 18;

    subtotal += gross;
    totalDiscount += discAmt;

    if (pricingMode === 'INCLUSIVE') {
      const taxable = gstRate > 0 ? net / (1 + gstRate / 100) : net;
      const gstAmt = net - taxable;
      taxableSum += taxable;
      gstTotal += gstAmt;
    } else {
      const gstAmt = (net * gstRate) / 100;
      taxableSum += net;
      gstTotal += gstAmt;
    }
  }

  const grandTotal = pricingMode === 'INCLUSIVE'
    ? subtotal - totalDiscount
    : taxableSum + gstTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Customer name is required');
      return;
    }
    if (items.some((it) => !it.description.trim())) {
      setError('All line items must have a description');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createProformaInvoice({
        customer_id: selectedCustomerId || 'CUST-MANUAL',
        customer_name: customerName.trim(),
        company_name: companyName.trim() || undefined,
        gstin: gstin.trim() || undefined,
        billing_address: billingAddress.trim() || undefined,
        shipping_address: shippingAddress.trim() || undefined,
        place_of_supply: placeOfSupply,
        is_gst_inclusive: pricingMode === 'INCLUSIVE',
        pricing_mode: pricingMode,
        validity_days: validityDays,
        items: items.map((it) => ({
          description: it.description.trim(),
          model_name: it.model_name.trim() || undefined,
          brand_name: it.brand_name.trim() || undefined,
          hsn_sac: it.hsn_sac.trim() || '85285200',
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'Nos.',
          rate: Number(it.rate) || 0,
          discount_pct: Number(it.discount_pct) || 0,
          gst_rate: Number(it.gst_rate) || 18,
        })),
        advance_amount: Number(advanceAmount) || Math.round(grandTotal * 0.5),
        payment_terms: paymentTerms,
        delivery_terms: deliveryTerms,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      } else {
        setError(res.error || 'Failed to create proforma invoice');
      }
    } catch (err: any) {
      setError(err.message || 'Creation exception');
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in-50 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-brand-700" />
              Create Proforma Invoice
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate standalone commercial proforma with dynamic items &bull; <strong className="text-rose-600 font-semibold">Not a Tax Invoice</strong>
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Pricing Mode & Customer Header */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-800">GST Pricing Mode:</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="pricingMode"
                    value="EXCLUSIVE"
                    checked={pricingMode === 'EXCLUSIVE'}
                    onChange={() => setPricingMode('EXCLUSIVE')}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span>GST Exclusive (Tax added on top)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="pricingMode"
                    value="INCLUSIVE"
                    checked={pricingMode === 'INCLUSIVE'}
                    onChange={() => setPricingMode('INCLUSIVE')}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span>GST Inclusive (Tax included in unit price)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600">Validity:</span>
              <input
                type="number"
                min={1}
                max={90}
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value) || 15)}
                className="w-16 px-2 py-1 border border-slate-300 rounded text-center font-bold"
              />
              <span className="text-slate-500">Days</span>
            </div>
          </div>

          {/* Customer Selection / Entry */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Existing Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs"
              >
                <option value="">-- Manual Entry / Pick from Directory --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name} {c.company_name ? `(${c.company_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Attn Person / Lead Contact"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company / Institution</label>
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
              <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="e.g. 36AAACC1206M1ZV"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Place of Supply</label>
              <input
                type="text"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                placeholder="e.g. 36 - Telangana or 29 - Karnataka"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Dynamic Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mt-2">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 border-b border-slate-200">
              <span className="font-bold text-slate-800 text-xs">
                Line Items (Dynamic Products Supported &bull; No Catalog Lock)
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>

            <div className="p-3 space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg space-y-2 relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid grid-cols-4 gap-2 flex-1">
                      <div className="col-span-2">
                        <label className="block font-semibold text-[10px] text-slate-600 mb-0.5">Description *</label>
                        <input
                          type="text"
                          value={it.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          placeholder="Product Name & Core Specs"
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[10px] text-slate-600 mb-0.5">Brand</label>
                        <input
                          type="text"
                          value={it.brand_name}
                          onChange={(e) => handleItemChange(idx, 'brand_name', e.target.value)}
                          placeholder="e.g. BenQ"
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[10px] text-slate-600 mb-0.5">Model / SKU</label>
                        <input
                          type="text"
                          value={it.model_name}
                          onChange={(e) => handleItemChange(idx, 'model_name', e.target.value)}
                          placeholder="e.g. RM7503"
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                        />
                      </div>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition mt-3"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    <div>
                      <label className="block font-semibold text-[10px] text-slate-600 mb-0.5">HSN/SAC</label>
                      <input
                        type="text"
                        value={it.hsn_sac}
                        onChange={(e) => handleItemChange(idx, 'hsn_sac', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[10px] text-slate-600 mb-0.5">Qty</label>
                      <input
                        type="number"
                        min={0.1}
                        step="any"
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[10px] text-slate-600 mb-0.5">Unit</label>
                      <input
                        type="text"
                        value={it.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[10px] text-slate-600 mb-0.5">Unit Rate (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={it.rate}
                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right font-mono font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[10px] text-slate-600 mb-0.5">Disc %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={it.discount_pct}
                        onChange={(e) => handleItemChange(idx, 'discount_pct', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[10px] text-slate-600 mb-0.5">GST %</label>
                      <select
                        value={it.gst_rate}
                        onChange={(e) => handleItemChange(idx, 'gst_rate', Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white font-mono"
                      >
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                        <option value={12}>12%</option>
                        <option value={5}>5%</option>
                        <option value={0}>0%</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Advance Terms */}
          <div className="grid grid-cols-2 gap-4 items-start pt-2">
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Advance Amount Required (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(Number(e.target.value) || 0)}
                  placeholder={`e.g. ₹${Math.round(grandTotal * 0.5).toLocaleString('en-IN')}`}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-800 bg-emerald-50/50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery Terms</label>
                <input
                  type="text"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Gross Line Items Subtotal:</span>
                <span className="font-mono">₹{subtotal.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Trade Discount:</span>
                  <span className="font-mono">-₹{totalDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-700 font-semibold border-t border-slate-200 pt-1">
                <span>Taxable Amount:</span>
                <span className="font-mono">₹{taxableSum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Calculated GST Total:</span>
                <span className="font-mono">₹{gstTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-brand-950 border-t-2 border-brand-900 pt-1.5 mt-1">
                <span>Proforma Grand Total:</span>
                <span className="font-mono text-base">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 shrink-0">
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
              className="px-5 py-2 bg-brand-800 hover:bg-brand-900 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <FileCheck className="w-3.5 h-3.5" />
              {loading ? 'Creating...' : 'Issue Proforma Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
