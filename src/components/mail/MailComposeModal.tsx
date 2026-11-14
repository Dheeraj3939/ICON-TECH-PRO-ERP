'use client';

import React, { useState } from 'react';
import {
  X,
  Minimize2,
  Maximize2,
  Paperclip,
  Send,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Bold,
  Italic,
  List,
  Link2,
} from 'lucide-react';
import type { MailProvider, MailAttachment } from './mock-mail-data';

interface MailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProvider: MailProvider;
  senderName: string;
  senderEmail: string;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  onSaveDraft?: (draft: { to: string; subject: string; body: string }) => void;
  onSend?: (emailData: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    attachments?: MailAttachment[];
  }) => Promise<{ success: boolean; error?: string }>;
}

export function MailComposeModal({
  isOpen,
  onClose,
  activeProvider,
  senderName,
  senderEmail,
  initialTo = '',
  initialSubject = '',
  initialBody = '',
  onSaveDraft,
  onSend,
}: MailComposeModalProps) {
  const [to, setTo] = useState(initialTo);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  const [sendNotice, setSendNotice] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddMockAttachment = () => {
    setSendError('Please attach files directly from the relevant Quotation, Proforma, or Invoice record.');
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleInsertQuotation = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const quoteRef = `\n\n[ERP Quotation Portal Link: ${origin}/dashboard/quotations]`;
    setBody((prev) => prev + quoteRef);
  };

  const handleSend = async () => {
    if (onSend) {
      setIsSending(true);
      setSendError(null);
      try {
        const res = await onSend({ to, cc, bcc, subject, body, attachments });
        if (res.success) {
          setSendNotice(
            `Email sent successfully via ${
              activeProvider === 'gmail' ? 'Google Workspace' : 'Zoho Mail'
            }.`
          );
          setTimeout(() => {
            setSendNotice(null);
            setIsSending(false);
            onClose();
          }, 1200);
        } else {
          setSendError(res.error || 'Failed to dispatch email.');
          setIsSending(false);
        }
      } catch (err: any) {
        setSendError(err.message || 'Error occurred while sending email.');
        setIsSending(false);
      }
    } else {
      // PREVIEW GUARD: Do not send real email in design preview mode
      setSendNotice(
        'Preview mode — email was not actually sent. Real Gmail/Zoho API dispatch is disabled during this design phase.'
      );
      setTimeout(() => {
        setSendNotice(null);
        onClose();
      }, 2500);
    }
  };

  const handleSaveDraft = () => {
    if (onSaveDraft) {
      onSaveDraft({ to, subject, body });
    }
    setSendNotice('Draft saved to local preview storage.');
    setTimeout(() => {
      setSendNotice(null);
      onClose();
    }, 1500);
  };

  return (
    <div
      className={`fixed z-50 transition-all duration-200 shadow-2xl rounded-t-xl sm:rounded-xl border border-slate-300 bg-white flex flex-col ${
        isMaximized
          ? 'inset-2 sm:inset-6'
          : isMinimized
          ? 'bottom-0 right-4 sm:right-8 w-80 h-12'
          : 'bottom-0 sm:bottom-6 right-0 sm:right-8 w-full sm:w-[620px] max-h-[92vh] sm:max-h-[640px]'
      }`}
    >
      {/* Compose Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white rounded-t-xl select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">New Message</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              activeProvider === 'gmail'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            via {activeProvider === 'gmail' ? 'Gmail Workspace' : 'Zoho Mail'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-300">
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:text-white hover:bg-slate-700 rounded transition"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 hover:text-white hover:bg-slate-700 rounded transition"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:text-white hover:bg-slate-700 rounded transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {sendNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 text-amber-900 text-xs font-medium animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>{sendNotice}</span>
        </div>
      )}

      {/* Collapsed view content */}
      {!isMinimized && (
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          {/* Sender Identity Indicator */}
          <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="truncate">
              <strong>From:</strong> {senderName} &lt;{senderEmail}&gt;
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {activeProvider === 'gmail' ? 'Google Workspace' : 'Zoho Mail Enterprise'}
            </span>
          </div>

          {/* Form Fields */}
          <div className="px-4 py-2 border-b border-slate-200 flex flex-col gap-2">
            {/* Recipient Input */}
            <div className="flex items-center text-xs">
              <span className="w-14 text-slate-500 font-medium">To:</span>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="client@swantech.in, purchase@infra-solutions.com"
                className="flex-1 outline-none text-slate-900 placeholder-slate-400 font-sans"
              />
              <div className="flex items-center gap-2 text-[11px] text-indigo-600 font-medium">
                {!showCc && (
                  <button type="button" onClick={() => setShowCc(true)} className="hover:underline">
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button type="button" onClick={() => setShowBcc(true)} className="hover:underline">
                    Bcc
                  </button>
                )}
              </div>
            </div>

            {/* Optional Cc */}
            {showCc && (
              <div className="flex items-center text-xs pt-1 border-t border-slate-100">
                <span className="w-14 text-slate-500 font-medium">Cc:</span>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="accounts@icontechpro.in"
                  className="flex-1 outline-none text-slate-900 placeholder-slate-400"
                />
              </div>
            )}

            {/* Optional Bcc */}
            {showBcc && (
              <div className="flex items-center text-xs pt-1 border-t border-slate-100">
                <span className="w-14 text-slate-500 font-medium">Bcc:</span>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="dheeraj@icontechpro.in"
                  className="flex-1 outline-none text-slate-900 placeholder-slate-400"
                />
              </div>
            )}

            {/* Subject Input */}
            <div className="flex items-center text-xs pt-1 border-t border-slate-100">
              <span className="w-14 text-slate-500 font-medium">Subject:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Quotation / Technical Proposal Ref..."
                className="flex-1 outline-none text-slate-900 font-medium placeholder-slate-400"
              />
            </div>
          </div>

          {/* Formatting Toolbar */}
          <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-slate-600 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBody((prev) => prev + '\n**Important:** ')}
                className="p-1 hover:bg-slate-200 rounded text-slate-700"
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setBody((prev) => prev + '\n*Note:* ')}
                className="p-1 hover:bg-slate-200 rounded text-slate-700"
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setBody((prev) => prev + '\n- Item 1\n- Item 2')}
                className="p-1 hover:bg-slate-200 rounded text-slate-700"
                title="Bullet List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-[1px] bg-slate-300 mx-1" />
              <button
                type="button"
                onClick={handleInsertQuotation}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition border border-indigo-200"
                title="Link an approved ERP quotation into email body"
              >
                <FileSpreadsheet className="w-3 h-3 text-indigo-600" />
                <span>Attach Quotation Ref</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddMockAttachment}
              className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium hover:bg-slate-200 px-2 py-1 rounded transition text-xs"
            >
              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
              <span>Attach File</span>
            </button>
          </div>

          {/* Attachments Pills List */}
          {attachments.length > 0 && (
            <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-200 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-white border border-slate-300 text-slate-800 shadow-sm"
                >
                  <Paperclip className="w-3 h-3 text-slate-400" />
                  <span className="font-medium max-w-[180px] truncate">{att.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({att.size})</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(idx)}
                    className="ml-1 text-slate-400 hover:text-rose-600"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Error Notice */}
          {sendError && (
            <div className="mx-4 mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-xs text-rose-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{sendError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSendError(null)}
                className="text-rose-400 hover:text-rose-700 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Message Body Textarea */}
          <div className="flex-1 p-4 min-h-[160px]">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email proposal, follow-up, or commercial message here..."
              className="w-full h-full resize-none outline-none text-slate-800 text-xs sm:text-sm leading-relaxed font-sans placeholder-slate-400"
            />
          </div>

          {/* Action Footer */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition active:scale-95"
              >
                <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-pulse' : ''}`} />
                <span>{isSending ? 'Sending...' : 'Send'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSending}
                className="px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:text-slate-400 rounded-lg transition"
              >
                Save Draft
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[11px] text-slate-400">
                {onSend ? 'Verified TLS • Encrypted Dispatch' : 'Safe Preview Mode • Real Dispatch Disabled'}
              </span>
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                title="Discard message"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
