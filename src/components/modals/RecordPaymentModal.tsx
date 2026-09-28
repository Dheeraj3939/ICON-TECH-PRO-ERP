'use client';

import React, { useState } from 'react';
import { X, CreditCard, Sparkles } from 'lucide-react';
import { recordPayment } from '@/lib/actions/billing';
import type { Invoice, PaymentMode } from '@/types/erp';

interface RecordPaymentModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultRecordedBy?: string;
}

export function RecordPaymentModal({
  invoice,
  isOpen,
  onClose,
  onSuccess,
  defaultRecordedBy,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState<number>(invoice?.balance_amount || 0);
  const [mode, setMode] = useState<PaymentMode>('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [notes, setNotes] = useState('');
  const [recordedBy, setRecordedBy] = useState(defaultRecordedBy || 'Finance & Accounts Team');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state if invoice changes
  React.useEffect(() => {
    if (invoice) {
      setAmount(invoice.balance_amount);
    }
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    setIsSubmitting(true);
    try {
      await recordPayment({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_name: invoice.customer_name,
        company_name: invoice.company_name,
        amount: Number(amount),
        mode,
        reference_number: referenceNumber,
        bank_name: bankName,
        payment_date: new Date().toISOString().split('T')[0],
        notes,
        recorded_by_name: recordedBy,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Record Customer Payment</h2>
              <p className="text-xs text-slate-500">Invoice: {invoice.invoice_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Invoice Summary Pill */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
            <div>
              <span className="text-slate-500 block">Customer:</span>
              <strong className="text-slate-800 text-sm">
                {invoice.company_name || invoice.customer_name}
              </strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Current Balance:</span>
              <strong className="text-rose-600 text-sm">
                ₹{invoice.balance_amount.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Amount Received (₹) *
            </label>
            <input
              type="number"
              required
              min="1"
              max={invoice.balance_amount}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Mode *</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
              >
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="UPI">UPI Transfer</option>
                <option value="Cheque">Bank Cheque</option>
                <option value="Cash">Cash Receipt</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                UTR / Reference No *
              </label>
              <input
                type="text"
                required
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. HDFCN26090481239"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Receiving Bank</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC Bank Ltd"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recorded By</label>
              <input
                type="text"
                value={recordedBy}
                onChange={(e) => setRecordedBy(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes / Narration</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 50% advance booking payment received."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Recording...' : 'Record Payment & Update Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
