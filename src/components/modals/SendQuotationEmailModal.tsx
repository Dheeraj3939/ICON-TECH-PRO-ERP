'use client';

import React, { useState } from 'react';
import {
  X,
  Mail,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Eye,
  Send,
  Building2,
  User,
  FileCheck,
} from 'lucide-react';
import { recordQuotationSent } from '@/lib/actions/quotations';
import { queueOutboxMessage } from '@/lib/actions/communication';
import type { Quotation } from '@/types/erp';

interface SendQuotationEmailModalProps {
  quotation: Quotation | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SendQuotationEmailModal({
  quotation,
  isOpen,
  onClose,
  onSuccess,
}: SendQuotationEmailModalProps) {
  const [toEmail, setToEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (quotation) {
      setToEmail(quotation.email || 'purchase@customer.com');
      setCcEmail('accounts@icontechpro.in');
      setSubject(`Commercial Quotation ${quotation.quotation_number} — ICON TECH PRO`);
      setMessage(
`Dear ${quotation.customer_name || 'Sir/Madam'},

Thank you for giving ICON TECH PRO the opportunity to quote for your technology requirements.

Please find attached our official GST commercial quotation ${quotation.quotation_number} amounting to ₹${Math.round(quotation.grand_total).toLocaleString('en-IN')}/- (inclusive of applicable GST).

All items are backed by official OEM manufacturer warranty, serial tracking, and certified technical installation by ICON TECH PRO engineers.

Kindly review and sign back a copy of the proposal or issue your Purchase Order to initiate order execution.

Warm regards,
Dheeraj — Admin / BDM
ICON TECH PRO
Email: dheeraj@icontechpro.in | Phone: +91 80999 09921
Hyderabad, Telangana`);
      setSentSuccess(false);
      setErrorMessage(null);
    }
  }, [quotation]);

  if (!isOpen || !quotation) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setErrorMessage(null);

    try {
      // 1. Queue email in outbox
      const queueRes = await queueOutboxMessage({
        entity_type: 'quotations',
        entity_id: quotation.id || quotation.quotation_number,
        quotation_id: quotation.id,
        recipient: toEmail,
        recipient_name: quotation.customer_name,
        channel: 'EMAIL',
        send_as_identity: 'Dheeraj (dheeraj@icontechpro.in)',
        subject,
        message_body: message,
        attachment_url: `/documents/quotations/${quotation.quotation_number}.pdf`,
      });

      if (!queueRes.success) {
        throw new Error(queueRes.error || 'Failed to queue email in communication center');
      }

      // 2. Record quotation status update to 'Sent'
      const auditRes = await recordQuotationSent(quotation.id, {
        channel: 'EMAIL',
        recipient: toEmail,
        messageId: queueRes.data?.id,
      });

      if (!auditRes.success) {
        throw new Error(auditRes.error || 'Failed to update quotation dispatch status');
      }

      setSentSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col my-auto overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/75">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Send Quotation Email (Zoho Mail)</h2>
              <p className="text-xs text-slate-500">Corporate SMTP Dispatch &bull; Sender: dheeraj@icontechpro.in</p>
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
        {sentSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Quotation Email Queued Successfully</h3>
              <p className="text-xs text-slate-600">
                Dispatched to <span className="font-bold text-slate-800">{toEmail}</span> with attached official PDF.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-left space-y-1">
              <p><span className="font-semibold text-slate-700">Sender Identity:</span> Dheeraj (dheeraj@icontechpro.in)</p>
              <p><span className="font-semibold text-slate-700">Audit Status:</span> Sent recorded in Quotations register and Communication timeline</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm hover:bg-slate-800 transition"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  {errorMessage}
                </div>
              )}

              {/* From Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">From (Corporate Identity)</label>
                  <input
                    type="text"
                    readOnly
                    value="Dheeraj &lt;dheeraj@icontechpro.in&gt;"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 outline-none cursor-not-allowed font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">To (Customer Email) *</label>
                  <input
                    type="email"
                    required
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CC (Optional)</label>
                <input
                  type="text"
                  value={ccEmail}
                  onChange={(e) => setCcEmail(e.target.value)}
                  placeholder="accounts@icontechpro.in"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                />
              </div>

              {/* Attachment Preview Card */}
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                    <Paperclip className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">${quotation.quotation_number}_Proposal.pdf</p>
                    <p className="text-[11px] text-blue-700">Official A4 Commercial Proposal &bull; Digitally Signed</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-white border border-blue-200 text-blue-800 text-[10px] font-bold">
                  Verified PDF
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Message Body *</label>
                <textarea
                  required
                  rows={8}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-sans leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50/80">
              <span className="text-[11px] text-slate-500">
                Verified Proposal &bull; ₹{Math.round(quotation.grand_total).toLocaleString('en-IN')}
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? 'Dispatching...' : 'Send Quotation Email'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
