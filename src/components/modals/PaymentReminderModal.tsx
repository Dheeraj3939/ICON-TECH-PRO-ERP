'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  MessageSquare,
  Mail,
  CheckCircle2,
  Copy,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { queueOutboxMessage } from '@/lib/actions/communication';
import type { Invoice } from '@/types/erp';

interface PaymentReminderModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PaymentReminderModal({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}: PaymentReminderModalProps) {
  const [channel, setChannel] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculateOverdueDays = (due: string, created: string) => {
    const ref = new Date(due || created).getTime();
    return Math.max(0, Math.floor((Date.now() - ref) / (1000 * 60 * 60 * 24)));
  };

  useEffect(() => {
    if (!invoice) return;

    const overdueDays = calculateOverdueDays(invoice.due_date, invoice.invoice_date);
    const targetName = invoice.company_name || invoice.customer_name || 'Valued Customer';
    const amountStr = `₹${Math.round(invoice.balance_amount || 0).toLocaleString('en-IN')}`;

    if (channel === 'WHATSAPP') {
      const ph = (invoice as any).phone || '9849012345';
      const clean = ph.replace(/\D/g, '').slice(-10);
      setRecipient(clean ? `+91 ${clean}` : '+91 98490 12345');
    } else {
      setRecipient((invoice as any).email || 'accounts@client.com');
    }

    const defaultMsg =
      `Dear ${targetName},\n\n` +
      `This is a friendly reminder regarding outstanding Tax Invoice #${invoice.invoice_number} dated ${invoice.invoice_date}.\n` +
      `Outstanding Balance: ${amountStr}\n` +
      `Overdue: ${overdueDays} days (Due Date: ${invoice.due_date || invoice.invoice_date})\n\n` +
      `Please arrange electronic payment (NEFT/RTGS/IMPS/UPI) to:\n` +
      `Beneficiary: ICON DIGITAL SOLUTIONS\n` +
      `Bank: HDFC Bank, SR Nagar Branch, Hyderabad\n` +
      `A/C No: 50200067891234 | IFSC: HDFC0000123\n` +
      `UPI ID: icontechpro@hdfcbank\n\n` +
      `Kindly share the transaction UTR once processed. If already paid, please disregard this notice.\n\n` +
      `Warm regards,\nAccounts & Finance Department\nICON DIGITAL SOLUTIONS (+91 80999 09921)`;

    setMessage(defaultMsg);
    setActionSuccess(null);
    setError(null);
    setCopied(false);
  }, [invoice, channel]);

  if (!isOpen || !invoice) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError(null);

    try {
      const res = await queueOutboxMessage({
        entity_type: 'invoices',
        entity_id: invoice.id || invoice.invoice_number,
        invoice_id: invoice.id,
        recipient: recipient.replace(/\s+/g, ''),
        recipient_name: invoice.company_name || invoice.customer_name,
        channel,
        send_as_identity:
          channel === 'WHATSAPP'
            ? 'ICON TECH PRO Accounts (+91 80999 09921)'
            : 'accounts@icontechpro.in',
        subject: `Payment Reminder - Tax Invoice #${invoice.invoice_number}`,
        message_body: message,
      });

      if (res.success) {
        setActionSuccess(`Reminder queued successfully via ${channel} Outbox!`);
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(res.error || 'Failed to dispatch reminder');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to send reminder');
    } finally {
      setIsSending(false);
    }
  };

  const cleanPhone = recipient.replace(/\D/g, '');
  const waWebUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Send Payment Reminder</h2>
              <p className="text-[11px] text-slate-500 font-mono">
                Invoice {invoice.invoice_number} • Balance: ₹{Math.round(invoice.balance_amount).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSend} className="p-6 space-y-4 text-xs">
          {actionSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Channel Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Dispatch Channel</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setChannel('WHATSAPP')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition ${
                  channel === 'WHATSAPP'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp Business</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('EMAIL')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition ${
                  channel === 'EMAIL'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Mail className="w-4 h-4 text-blue-600" />
                <span>Official Accounts Email</span>
              </button>
            </div>
          </div>

          {/* Recipient Field */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {channel === 'WHATSAPP' ? 'Recipient WhatsApp Number' : 'Recipient Email Address'}
            </label>
            <input
              type={channel === 'WHATSAPP' ? 'tel' : 'email'}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium"
            />
          </div>

          {/* Message Content Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">Reminder Message Content</label>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:text-brand-800 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
              </button>
            </div>
            <textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono text-[11px] text-slate-700 leading-relaxed resize-none"
            />
          </div>

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
            {channel === 'WHATSAPP' && (
              <a
                href={waWebUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in WhatsApp Web</span>
              </a>
            )}
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Queuing...' : `Queue via ${channel === 'WHATSAPP' ? 'WhatsApp' : 'Email'}`}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
