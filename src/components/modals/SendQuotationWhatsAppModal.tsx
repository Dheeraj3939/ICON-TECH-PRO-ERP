'use client';

import React, { useState } from 'react';
import {
  X,
  Send,
  MessageSquare,
  FileCheck,
  Smartphone,
  ShieldAlert,
  CheckCircle2,
  Code2,
} from 'lucide-react';
import { recordQuotationSent } from '@/lib/actions/quotations';
import { queueOutboxMessage } from '@/lib/actions/communication';
import type { Quotation } from '@/types/erp';

interface SendQuotationWhatsAppModalProps {
  quotation: Quotation | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SendQuotationWhatsAppModal({
  quotation,
  isOpen,
  onClose,
  onSuccess,
}: SendQuotationWhatsAppModalProps) {
  const [phone, setPhone] = useState('');
  const [template, setTemplate] = useState('commercial_quotation_v1');
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [showPayload, setShowPayload] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (quotation) {
      let raw = quotation.phone || '9849012345';
      const clean = raw.replace(/\D/g, '').slice(-10);
      setPhone(clean ? `+91 ${clean}` : '+91 98490 12345');
      setSentSuccess(false);
      setErrorMessage(null);
    }
  }, [quotation]);

  if (!isOpen || !quotation) return null;

  // Exact Meta Cloud API Payload structure
  const metaCloudApiPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone.replace(/\D/g, ''),
    type: 'template',
    template: {
      name: template,
      language: { code: 'en' },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'document',
              document: {
                link: `https://portal.icontechpro.in/docs/quotations/${quotation.quotation_number}.pdf`,
                filename: `${quotation.quotation_number}_Proposal.pdf`,
              },
            },
          ],
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: quotation.customer_name },
            { type: 'text', text: quotation.quotation_number },
            { type: 'text', text: `₹${Math.round(quotation.grand_total).toLocaleString('en-IN')}` },
            { type: 'text', text: '7 Days' },
          ],
        },
      ],
    },
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setErrorMessage(null);

    try {
      // 1. Queue in outbox
      const queueRes = await queueOutboxMessage({
        entity_type: 'quotations',
        entity_id: quotation.id || quotation.quotation_number,
        quotation_id: quotation.id,
        recipient: phone,
        recipient_name: quotation.customer_name,
        channel: 'WHATSAPP',
        send_as_identity: 'ICON TECH PRO Business (+91 80999 09921)',
        subject: `WhatsApp Quotation ${quotation.quotation_number}`,
        template_id: template,
        template_data: {
          customer_name: quotation.customer_name,
          quote_number: quotation.quotation_number,
          grand_total: `₹${Math.round(quotation.grand_total).toLocaleString('en-IN')}`,
          validity: '7 Days',
        },
        message_body: `Hello ${quotation.customer_name}, please find attached commercial quotation ${quotation.quotation_number} for ₹${Math.round(quotation.grand_total).toLocaleString('en-IN')}/- from ICON TECH PRO.`,
        attachment_url: `/documents/quotations/${quotation.quotation_number}.pdf`,
      });

      if (!queueRes.success) {
        throw new Error(queueRes.error || 'Failed to queue WhatsApp message');
      }

      // 2. Record quotation status update
      const auditRes = await recordQuotationSent(quotation.id, {
        channel: 'WHATSAPP',
        recipient: phone,
        messageId: queueRes.data?.id,
      });

      if (!auditRes.success) {
        throw new Error(auditRes.error || 'Failed to update quotation status');
      }

      setSentSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to queue WhatsApp message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col my-auto overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-emerald-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Send Quotation WhatsApp</h2>
              <p className="text-xs text-slate-500">Official Meta Cloud API Architecture &bull; Business Phone: 8099909921</p>
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
              <h3 className="text-base font-bold text-slate-900">WhatsApp Payload Queued</h3>
              <p className="text-xs text-slate-600">
                Logged to communication outbox for <span className="font-bold text-slate-800">{phone}</span>.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-left space-y-1">
              <p><span className="font-semibold text-slate-700">Business Phone:</span> +91 80999 09921</p>
              <p><span className="font-semibold text-slate-700">Meta Template:</span> {template}</p>
              <p><span className="font-semibold text-slate-700">Status:</span> QUEUED in Communication Outbox with PDF Document payload</p>
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
              {/* Integration Status Notice */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Integration Architecture: Meta WhatsApp Cloud API</p>
                  <p className="text-[11px] text-amber-800">
                    Live Meta access token pending configuration. In accordance with zero-fake rules, this action safely queues the real payload to the ERP communication outbox in Demonstration Mode.
                  </p>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business Identity</label>
                  <input
                    type="text"
                    readOnly
                    value="+91 80999 09921 (ICON TECH PRO)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recipient Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pre-approved Meta Template</label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
                >
                  <option value="commercial_quotation_v1">commercial_quotation_v1 (Proposal with PDF Header)</option>
                  <option value="presales_followup_v1">presales_followup_v1 (Follow-up Reminder)</option>
                </select>
              </div>

              {/* Message Preview Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Message Preview (Rendered)</p>
                <div className="p-3 rounded-lg bg-white border border-slate-200 text-slate-800 space-y-2 leading-relaxed shadow-2xs">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold border-b border-slate-100 pb-2">
                    <FileCheck className="w-4 h-4" />
                    <span>Attached: {quotation.quotation_number}_Proposal.pdf</span>
                  </div>
                  <p>Hello <strong>{quotation.customer_name}</strong>,</p>
                  <p>
                    Please find attached commercial quotation <strong>{quotation.quotation_number}</strong> for <strong>₹{Math.round(quotation.grand_total).toLocaleString('en-IN')}/-</strong> from ICON TECH PRO.
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Includes official manufacturer warranty and certified installation by ICON TECH PRO engineers.
                  </p>
                </div>
              </div>

              {/* Toggle Meta JSON Payload */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowPayload(!showPayload)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-emerald-700 font-semibold transition"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showPayload ? 'Hide' : 'View'} Meta Cloud API JSON Payload</span>
                </button>
                {showPayload && (
                  <pre className="mt-2 p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[10.5px] whitespace-pre-wrap break-all leading-tight">
                    {JSON.stringify(metaCloudApiPayload, null, 2)}
                  </pre>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50/80">
              <span className="text-[11px] text-slate-500">
                To: {phone} &bull; ₹{Math.round(quotation.grand_total).toLocaleString('en-IN')}
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
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? 'Queueing...' : 'Queue WhatsApp Proposal'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
