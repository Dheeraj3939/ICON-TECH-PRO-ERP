'use client';

import React, { useState } from 'react';
import {
  Reply,
  ReplyAll,
  Forward,
  Star,
  Archive,
  Trash2,
  MailCheck,
  Printer,
  Paperclip,
  Download,
  Eye,
  Send,
  MoreVertical,
  ChevronLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import type { MailMessage } from './mock-mail-data';

interface MailReadingPaneProps {
  message: MailMessage | null;
  onBackMobile?: () => void;
  onReply: (message: MailMessage) => void;
  onForward: (message: MailMessage) => void;
  onToggleStar: (messageId: string) => void;
  onArchive: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onMarkUnread: (messageId: string) => void;
  onSendQuickReply?: (replyText: string) => Promise<{ success: boolean; error?: string }>;
  onDownloadAttachment?: (attName: string) => Promise<void> | void;
}

export function MailReadingPane({
  message,
  onBackMobile,
  onReply,
  onForward,
  onToggleStar,
  onArchive,
  onDelete,
  onMarkUnread,
  onSendQuickReply,
  onDownloadAttachment,
}: MailReadingPaneProps) {
  const [quickReplyText, setQuickReplyText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  if (!message) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
          <Paperclip className="w-8 h-8 rotate-45" />
        </div>
        <h3 className="text-base font-semibold text-slate-700">No message selected</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
          Select an email from the message list on the left to read its full correspondence, view attachments, and draft replies.
        </p>
      </div>
    );
  }

  const handleSendQuickReply = async () => {
    if (!quickReplyText.trim()) return;
    if (onSendQuickReply) {
      const res = await onSendQuickReply(quickReplyText);
      if (res.success) {
        showToast('Quick reply sent successfully.');
        setQuickReplyText('');
      } else {
        showToast(res.error || 'Failed to send quick reply.');
      }
    } else {
      showToast('Preview mode — quick reply saved to preview queue (not sent externally).');
      setQuickReplyText('');
    }
  };

  const handleDownloadAttachment = async (attName: string) => {
    if (onDownloadAttachment) {
      await onDownloadAttachment(attName);
    } else {
      showToast(`Simulated download: "${attName}" saved to browser download buffer.`);
    }
  };

  const handlePreviewAttachment = (attName: string) => {
    showToast(`Viewing simulated attachment preview for: "${attName}"`);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-40 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-fadeIn border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Back button for mobile */}
          {onBackMobile && (
            <button
              type="button"
              onClick={onBackMobile}
              className="lg:hidden p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg mr-1"
              title="Back to list"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onReply(message)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reply</span>
          </button>

          <button
            type="button"
            onClick={() => onForward(message)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
            title="Forward"
          >
            <Forward className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Forward</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-300 mx-1" />

          <button
            type="button"
            onClick={() => onArchive(message.id)}
            className="p-1.5 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(message.id)}
            className="p-1.5 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-lg transition"
            title="Move to Trash"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onMarkUnread(message.id)}
            className="p-1.5 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition"
            title="Mark as unread"
          >
            <MailCheck className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleStar(message.id)}
            className={`p-1.5 rounded-lg transition ${
              message.isStarred
                ? 'text-amber-500 hover:bg-amber-50'
                : 'text-slate-400 hover:text-amber-500 hover:bg-slate-200'
            }`}
            title={message.isStarred ? 'Unstar' : 'Star message'}
          >
            <Star className={`w-4 h-4 ${message.isStarred ? 'fill-amber-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition hidden sm:inline-flex"
            title="Print message"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Email Body Viewport */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Subject & Category Tags */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-snug">
              {message.subject}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                message.provider === 'gmail'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {message.provider === 'gmail' ? 'Google Workspace' : 'Zoho Mail Enterprise'}
            </span>

            {message.tags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
              >
                <Tag className="w-2.5 h-2.5 text-slate-500" />
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Sender Details Card */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-start gap-3 min-w-0">
            {/* Avatar Initials */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 shadow-sm ${
                message.provider === 'gmail' ? 'bg-gradient-to-br from-rose-500 to-indigo-600' : 'bg-gradient-to-br from-emerald-600 to-teal-700'
              }`}
            >
              {getInitials(message.fromName)}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-slate-900 truncate">
                  {message.fromName}
                </span>
                <span className="text-xs text-slate-500 truncate font-mono">
                  &lt;{message.fromEmail}&gt;
                </span>
              </div>

              <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1">
                <span>to</span>
                <span className="font-medium text-slate-700">{message.toName}</span>
                <span className="text-slate-400 font-mono">&lt;{message.toEmail}&gt;</span>
                {message.cc && (
                  <>
                    <span className="text-slate-400 ml-1">• cc:</span>
                    <span className="text-slate-600 font-mono text-[11px]">{message.cc}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <span className="text-xs font-medium text-slate-500 flex items-center justify-end gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              {message.dateStr}
            </span>
            <div className="text-[11px] text-emerald-600 font-medium flex items-center justify-end gap-1 mt-0.5">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Verified TLS</span>
            </div>
          </div>
        </div>

        {/* Message Content Body */}
        <div className="text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-sans border-t border-slate-100 pt-4 px-1">
          {message.body}
        </div>

        {/* Attachments Box */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 mt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Paperclip className="w-4 h-4 text-slate-500" />
                <span>
                  {message.attachments.length} Attachment
                  {message.attachments.length > 1 ? 's' : ''}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Virus Scanned • Safe</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {message.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 shadow-sm hover:border-indigo-300 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0 uppercase">
                      {att.name.split('.').pop() || 'FILE'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate" title={att.name}>
                        {att.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">{att.size}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePreviewAttachment(att.name)}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 rounded transition"
                      title="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadAttachment(att.name)}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 rounded transition"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inline Quick Reply Box */}
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 mt-8">
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium mb-2">
            <span>Quick Reply to {message.fromName}</span>
            <span className="text-[11px] text-slate-400 font-mono">
              as {message.toEmail}
            </span>
          </div>

          <textarea
            value={quickReplyText}
            onChange={(e) => setQuickReplyText(e.target.value)}
            placeholder={`Type a quick response to ${message.fromName}...`}
            rows={3}
            className="w-full p-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none placeholder-slate-400"
          />

          <div className="flex items-center justify-between mt-2.5">
            <button
              type="button"
              onClick={() => onReply(message)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
            >
              Open Full Compose Window
            </button>

            <button
              type="button"
              onClick={handleSendQuickReply}
              disabled={!quickReplyText.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white transition active:scale-95 shadow-sm"
            >
              <Send className="w-3 h-3" />
              <span>Send Quick Reply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
