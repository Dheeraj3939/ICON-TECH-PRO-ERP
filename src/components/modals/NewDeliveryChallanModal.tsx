'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Truck, AlertCircle } from 'lucide-react';
import { createDeliveryChallan } from '@/lib/actions/delivery-challans';
import { getCustomers } from '@/lib/actions/customers';
import type { Customer } from '@/types/customer';
import type { DeliveryChallanPurpose } from '@/types/delivery-challan';

interface NewDeliveryChallanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (challan: any) => void;
}

interface ChallanFormItem {
  description: string;
  model_name: string;
  brand_name: string;
  hsn_sac: string;
  quantity: number;
  unit: string;
  serial_numbers_text: string;
  remarks: string;
}

export function NewDeliveryChallanModal({ isOpen, onClose, onSuccess }: NewDeliveryChallanModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [purpose, setPurpose] = useState<DeliveryChallanPurpose>('Supply against Order');
  const [referenceType, setReferenceType] = useState<'QUOTATION' | 'SALES_ORDER' | 'TAX_INVOICE' | 'DIRECT'>('SALES_ORDER');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transporterName, setTransporterName] = useState('Direct Dedicated Van Dispatch');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [ewayBillNumber, setEwayBillNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<ChallanFormItem[]>([
    {
      description: '',
      model_name: '',
      brand_name: '',
      hsn_sac: '85285200',
      quantity: 1,
      unit: 'Nos.',
      serial_numbers_text: '',
      remarks: '',
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
      const addr = found.billing_address || `${found.city || 'Hyderabad'}, ${found.state || 'Telangana'}`;
      const shipAddr = found.shipping_address || addr;
      setCustomerAddress(addr);
      setDeliveryAddress(shipAddr);
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
        serial_numbers_text: '',
        remarks: '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof ChallanFormItem, val: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Customer name is required');
      return;
    }
    if (!customerAddress.trim()) {
      setError('Customer address is required');
      return;
    }
    if (items.some((it) => !it.description.trim())) {
      setError('All line items must have a description');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createDeliveryChallan({
        customer_id: selectedCustomerId || 'CUST-MANUAL',
        customer_name: customerName.trim(),
        company_name: companyName.trim() || undefined,
        gstin: gstin.trim() || undefined,
        customer_address: customerAddress.trim(),
        delivery_address: deliveryAddress.trim() || customerAddress.trim(),
        purpose,
        reference_type: referenceType,
        reference_number: referenceNumber.trim() || undefined,
        transporter_name: transporterName.trim() || undefined,
        vehicle_number: vehicleNumber.trim() || undefined,
        lr_number: lrNumber.trim() || undefined,
        eway_bill_number: ewayBillNumber.trim() || undefined,
        items: items.map((it) => ({
          description: it.description.trim(),
          model_name: it.model_name.trim() || undefined,
          brand_name: it.brand_name.trim() || undefined,
          hsn_sac: it.hsn_sac.trim() || '85285200',
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'Nos.',
          serial_numbers: it.serial_numbers_text
            ? it.serial_numbers_text.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
          remarks: it.remarks.trim() || undefined,
        })),
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      } else {
        setError(res.error || 'Failed to generate delivery challan');
      }
    } catch (err: any) {
      setError(err.message || 'Challan creation exception');
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
              <Truck className="w-4 h-4 text-slate-800" />
              Generate Delivery Challan
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Goods movement dispatch note under Rule 55 &bull; <strong className="text-amber-700 font-semibold">Not a Tax Invoice</strong>
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

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Movement Purpose & Reference */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Movement Purpose *</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-800"
              >
                <option value="Supply against Order">Supply against Order</option>
                <option value="Demo / Testing">Demo / Testing</option>
                <option value="Job Work / Repair">Job Work / Repair</option>
                <option value="Exhibition / Display">Exhibition / Display</option>
                <option value="Site Installation">Site Installation</option>
                <option value="Replacement / Warranty">Replacement / Warranty</option>
                <option value="Other">Other Movement</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reference Document Type</label>
              <select
                value={referenceType}
                onChange={(e) => setReferenceType(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs"
              >
                <option value="SALES_ORDER">Sales Order</option>
                <option value="QUOTATION">Quotation</option>
                <option value="TAX_INVOICE">Tax Invoice</option>
                <option value="DIRECT">Direct Movement (No Order)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reference Number</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. ICON/26-27/ORD-0001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          {/* Customer Selection */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs"
              >
                <option value="">-- Pick from Directory or Enter Below --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name} {c.company_name ? `(${c.company_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer / Consignee Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Receiver Name / Lead Contact"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Registered Address *</label>
              <textarea
                rows={2}
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Customer principal place of business"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Destination / Delivery Site *</label>
              <textarea
                rows={2}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Exact site installation / unloading address"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                required
              />
            </div>
          </div>

          {/* Logistics & Transporter Details */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Transporter / Delivery Mode</label>
              <input
                type="text"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="e.g. Direct Dedicated Van"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vehicle Number</label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="e.g. TS 09 UB 4521"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">E-Way Bill Number (If &gt; ₹50,000)</label>
              <input
                type="text"
                value={ewayBillNumber}
                onChange={(e) => setEwayBillNumber(e.target.value)}
                placeholder="e.g. 241098231920"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          {/* Dynamic Challan Line Items */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mt-2">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 border-b border-slate-200">
              <span className="font-bold text-slate-800 text-xs">
                Dispatched Items & Serial Numbers (No Product Master Lock)
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition"
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

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block font-semibold text-[10px] text-slate-600 mb-0.5">Quantity *</label>
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
                    <div className="col-span-2">
                      <label className="block font-semibold text-[10px] text-slate-600 mb-0.5">
                        Serial Numbers (Comma-separated)
                      </label>
                      <input
                        type="text"
                        value={it.serial_numbers_text}
                        onChange={(e) => handleItemChange(idx, 'serial_numbers_text', e.target.value)}
                        placeholder="e.g. BNQ-75-99214, BNQ-75-99215"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Dispatch Notes / Remarks</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Direct site handover to facility engineer. Installation accessories included."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
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
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5" />
              {loading ? 'Generating...' : 'Issue Delivery Challan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
