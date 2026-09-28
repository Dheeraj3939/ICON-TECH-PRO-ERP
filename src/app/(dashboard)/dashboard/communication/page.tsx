'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Mail,
  Send,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  UserCheck,
  Shield,
  Smartphone,
  Info,
  ExternalLink,
} from 'lucide-react';
import {
  getOutboxMessages,
  queueOutboxMessage,
  retryOutboxMessage,
  processOutboxQueue,
  previewCommunication,
  getUserCommunicationIdentities,
} from '@/lib/actions/communication';
import { getGmailConnectionStatus } from '@/lib/actions/gmail';
import type {
  CommunicationOutboxItem,
  CommunicationChannel,
  CommunicationStatus,
  UserCommunicationIdentity,
} from '@/types/erp';
import type { GmailConnectionInfo } from '@/types/gmail';

export default function CommunicationCenterPage() {
  const [messages, setMessages] = useState<CommunicationOutboxItem[]>([]);
  const [identities, setIdentities] = useState<UserCommunicationIdentity[]>([]);
  const [gmailStatus, setGmailStatus] = useState<GmailConnectionInfo | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeChannel, setComposeChannel] = useState<CommunicationChannel>('WHATSAPP');
  const [recipient, setRecipient] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [senderIdentity, setSenderIdentity] = useState('');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [previewData, setPreviewData] = useState<{
    formattedRecipient: string;
    senderIdentity: string;
    renderedSubject: string;
    renderedBody: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [msgRes, idRes, gStatus] = await Promise.all([
        getOutboxMessages(),
        getUserCommunicationIdentities(),
        getGmailConnectionStatus().catch(() => null),
      ]);
      setMessages(msgRes.messages || []);
      setIdentities(idRes || []);
      if (gStatus) {
        setGmailStatus(gStatus);
      }
      if (idRes && idRes.length > 0 && !senderIdentity) {
        setSenderIdentity(idRes[0].user_name);
      }
    } catch (err) {
      console.error('Error loading communications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const recip = params.get('recipient');
      const chan = params.get('channel') as CommunicationChannel | null;
      const template = params.get('template');
      const invoiceId = params.get('invoice_id');
      const amount = params.get('amount');
      const subj = params.get('subject');
      const msg = params.get('message');

      if (recip || msg || template) {
        if (chan) setComposeChannel(chan);
        if (recip) {
          setRecipient(recip);
          setRecipientName(recip);
        }
        if (template === 'PAYMENT_REMINDER') {
          setComposeChannel('WHATSAPP');
          setSubject(`Payment Reminder: Invoice ${invoiceId || ''}`);
          setMessageBody(`Dear ${recip || 'Valued Customer'},\n\nThis is a polite reminder regarding the outstanding balance of ₹${amount ? Number(amount).toLocaleString('en-IN') : ''} against Tax Invoice ${invoiceId || ''}.\n\nKindly arrange for the payment release at your earliest convenience. Please let us know if you require any clarification or bank details.\n\nThank you,\nICON TECH PRO Accounts Team`);
          setIsComposeOpen(true);
        } else if (msg) {
          if (subj) setSubject(subj);
          setMessageBody(msg);
          setIsComposeOpen(true);
        }
      }
    }
  }, []);

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      await processOutboxQueue();
      await loadData();
    } catch (err) {
      console.error('Error processing queue:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleRetry = async (msgId: string) => {
    try {
      const res = await retryOutboxMessage(msgId);
      if (res.success) {
        await loadData();
      } else {
        alert(res.error || 'Retry failed');
      }
    } catch (err) {
      console.error('Error retrying message:', err);
    }
  };

  const handlePreview = async () => {
    setActionError(null);
    if (!recipient || !messageBody) {
      setActionError('Recipient and message body are required.');
      return;
    }
    try {
      const p = await previewCommunication({
        channel: composeChannel,
        recipient,
        recipient_name: recipientName,
        subject,
        message_body: messageBody,
        send_as_identity: senderIdentity,
      });
      setPreviewData(p);
    } catch (err) {
      setActionError((err as Error).message || 'Preview generation failed');
    }
  };

  const handleSend = async () => {
    setActionError(null);
    setSubmitting(true);
    try {
      const res = await queueOutboxMessage({
        channel: composeChannel,
        recipient,
        recipient_name: recipientName,
        subject: composeChannel === 'EMAIL' ? subject : undefined,
        message_body: messageBody,
        send_as_identity: senderIdentity,
      });

      if (res.success) {
        setIsComposeOpen(false);
        setRecipient('');
        setRecipientName('');
        setSubject('');
        setMessageBody('');
        setPreviewData(null);
        await loadData();
      } else {
        setActionError(res.error || 'Failed to queue message');
      }
    } catch (err) {
      setActionError((err as Error).message || 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = messages.filter((m) => {
    if (channelFilter !== 'ALL' && m.channel !== channelFilter) return false;
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchRecip = m.recipient.toLowerCase().includes(q) || (m.recipient_name && m.recipient_name.toLowerCase().includes(q));
      const matchSubject = m.subject && m.subject.toLowerCase().includes(q);
      const matchBody = m.message_body.toLowerCase().includes(q);
      const matchSender = m.send_as_identity && m.send_as_identity.toLowerCase().includes(q);
      return matchRecip || matchSubject || matchBody || matchSender;
    }
    return true;
  });

  const sentCount = messages.filter((m) => m.status === 'SENT' || m.status === 'DELIVERED').length;
  const queuedCount = messages.filter((m) => m.status === 'QUEUED' || m.status === 'SENDING').length;
  const failedCount = messages.filter((m) => m.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-indigo-600" />
            Communication Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Meta WhatsApp Business Cloud API &amp; Gmail REST API Outbox with Per-User Sender Identity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/communication/gmail"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 shadow-xs transition-colors"
          >
            <Mail className="w-4 h-4 text-indigo-600" />
            Open Gmail Mailbox
          </Link>
          <Link
            href="/dashboard/settings/integrations"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors"
          >
            <Mail className="w-4 h-4 text-red-500" />
            Gmail Settings
          </Link>
          <button
            onClick={handleProcessQueue}
            disabled={processing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
            Dispatch Queue
          </button>
          <button
            onClick={() => {
              setIsComposeOpen(true);
              setActionError(null);
              setPreviewData(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            <Send className="w-4 h-4" />
            Compose Message
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Messages</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{messages.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Dispatched / Sent</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{sentCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Queued / Sending</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{queuedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Delivery Failures</p>
          <p className="text-2xl font-bold text-rose-700 mt-1">{failedCount}</p>
        </div>
      </div>

      {/* Integration Gateways Advisory (WhatsApp & Gmail) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gmail OAuth Advisory Card */}
        <div
          className={`rounded-xl p-4 flex items-start gap-3 border ${
            gmailStatus?.connected
              ? gmailStatus.has_modify_scope
                ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <Mail
            className={`w-5 h-5 mt-0.5 shrink-0 ${
              gmailStatus?.connected
                ? gmailStatus.has_modify_scope
                  ? 'text-blue-600'
                  : 'text-amber-600'
                : 'text-slate-400'
            }`}
          />
          <div className="text-xs leading-relaxed flex-1">
            <div className="font-bold flex items-center justify-between">
              <span className="font-bold text-slate-900">
                {gmailStatus?.connected ? 'Gmail Mailbox Connected' : 'Google Gmail REST API'}
              </span>
              {gmailStatus?.connected ? (
                gmailStatus.has_modify_scope ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Mailbox Access Active
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" /> Upgrade Mailbox Access
                  </span>
                )
              ) : (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                  Not Connected
                </span>
              )}
            </div>
            <p className="mt-1 text-slate-600">
              {gmailStatus?.connected
                ? gmailStatus.has_modify_scope
                  ? 'Full mailbox access through Gmail REST API (gmail.modify). Synchronized with icontechpro@gmail.com for reading, sending, searching, and managing threads.'
                  : 'Connected with legacy send-only permissions (gmail.send). Upgrade to gmail.modify to unlock the full inbox, conversation threads, search, and attachments.'
                : 'Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local to enable real email dispatch and mailbox synchronization.'}
            </p>
            <div className="mt-3 flex items-center gap-3">
              {gmailStatus?.connected ? (
                <>
                  <Link
                    href="/dashboard/communication/gmail"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Open Gmail Mailbox →
                  </Link>
                  <Link
                    href="/dashboard/settings/integrations"
                    className="text-xs text-slate-500 hover:text-blue-700 underline font-medium"
                  >
                    {gmailStatus.needs_scope_upgrade ? 'Upgrade Scope in Settings' : 'Integration Settings'}
                  </Link>
                </>
              ) : (
                <Link
                  href="/dashboard/settings/integrations"
                  className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  Connect icontechpro@gmail.com in Settings →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Meta WhatsApp Integration Advisory Card */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-xs text-emerald-900 leading-relaxed">
            <div className="font-bold">Official Meta WhatsApp Business Cloud API:</div>
            <p className="mt-1 text-emerald-800">
              Communications conform to Meta Graph API specifications (templates, parameters, multi-language, and correlation IDs). No unverified browser automation or scraping is permitted.
            </p>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search recipient, sender, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            {['ALL', 'WHATSAPP', 'EMAIL', 'SYSTEM_NOTIFICATION'].map((ch) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  channelFilter === ch
                    ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ch === 'ALL' ? 'All Channels' : ch === 'WHATSAPP' ? 'WhatsApp' : ch === 'EMAIL' ? 'Email' : 'In-App'}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="SENT">Sent</option>
            <option value="QUEUED">Queued</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Outbox Zero-Scroll Register */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Desktop Zero-Scroll Table */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left border-collapse text-xs table-fixed">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[30%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3">Message & Channel</th>
                <th className="py-2.5 px-3">Recipient</th>
                <th className="py-2.5 px-3">Subject / Message</th>
                <th className="py-2.5 px-3">Status & Time</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Loading outbox messages...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No communication records found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-mono text-xs font-semibold text-slate-800 truncate">
                        {item.id}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {item.channel === 'WHATSAPP' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            <Smartphone className="w-3 h-3" />
                            WhatsApp
                          </span>
                        )}
                        {item.channel === 'EMAIL' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                            <Mail className="w-3 h-3" />
                            Email
                          </span>
                        )}
                        {item.channel === 'SYSTEM_NOTIFICATION' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">
                            <Info className="w-3 h-3" />
                            In-App
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 truncate">
                          {item.send_as_identity || item.sender_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900 truncate">{item.recipient_name || 'Customer'}</div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">{item.recipient}</div>
                    </td>
                    <td className="py-3 px-3">
                      {item.subject && <div className="font-semibold text-xs text-slate-800 truncate">{item.subject}</div>}
                      <div className="text-xs text-slate-500 truncate mt-0.5">{item.message_body}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1">
                        {item.status === 'SENT' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            Sent
                          </span>
                        )}
                        {item.status === 'QUEUED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 w-fit">
                            <Clock className="w-3 h-3" />
                            Queued
                          </span>
                        )}
                        {item.status === 'FAILED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200 w-fit">
                            <AlertTriangle className="w-3 h-3" />
                            Failed ({item.retry_count})
                          </span>
                        )}
                        <div className="text-[10px] text-slate-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {item.status === 'FAILED' && (
                        <button
                          onClick={() => handleRetry(item.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors"
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Communication Cards */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs">Loading outbox messages...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">No communication records found.</div>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className="p-4 space-y-2 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="font-mono text-xs text-slate-500 font-semibold">{item.id}</span>
                    <h4 className="font-bold text-slate-900 text-sm">{item.recipient_name || 'Customer'}</h4>
                    <span className="font-mono text-xs text-slate-400 block">{item.recipient}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {item.channel === 'WHATSAPP' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        WhatsApp
                      </span>
                    )}
                    {item.channel === 'EMAIL' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                        Email
                      </span>
                    )}
                    {item.channel === 'SYSTEM_NOTIFICATION' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">
                        In-App
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  {item.subject && <strong className="block text-slate-800">{item.subject}</strong>}
                  <p className="text-slate-600 line-clamp-2">{item.message_body}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    {item.status === 'SENT' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Sent
                      </span>
                    )}
                    {item.status === 'QUEUED' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Queued
                      </span>
                    )}
                    {item.status === 'FAILED' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                        Failed
                      </span>
                    )}
                    {item.status === 'FAILED' && (
                      <button
                        onClick={() => handleRetry(item.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Compose & Preview Drawer / Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                Compose & Dispatch Message
              </h3>
              <button
                onClick={() => setIsComposeOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {actionError && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {actionError}
                </div>
              )}

              {/* Channel Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Communication Channel</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setComposeChannel('WHATSAPP')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-2 ${
                      composeChannel === 'WHATSAPP'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    Meta WhatsApp API
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposeChannel('EMAIL')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-2 ${
                      composeChannel === 'EMAIL'
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    Corporate Email
                  </button>
                </div>
              </div>

              {/* Sender Identity (Send-As) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sender Identity (Send-As)
                </label>
                <select
                  value={senderIdentity}
                  onChange={(e) => setSenderIdentity(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                >
                  {identities.map((id) => (
                    <option key={id.id} value={id.user_name}>
                      {id.user_name} ({id.phone_identity_id || 'Direct'})
                    </option>
                  ))}
                  <option value="ICON Tech Sales Desk">ICON Tech Sales Desk</option>
                  <option value="ICON Billing & Accounts">ICON Billing & Accounts</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Sender identity is validated against employee Send-As permissions and audited.
                </p>
              </div>

              {/* Recipient Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Anand Rao"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {composeChannel === 'WHATSAPP' ? 'Phone Number (+91)' : 'Email Address'}
                  </label>
                  <input
                    type="text"
                    placeholder={composeChannel === 'WHATSAPP' ? '98480 12345' : 'procurement@client.com'}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Subject (if Email) */}
              {composeChannel === 'EMAIL' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Quotation QTN-26-0001 from ICON TECH PRO"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Message Body */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Message Body</label>
                <textarea
                  rows={4}
                  placeholder="Type official communication text here..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Preview Box */}
              {previewData && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    Delivery Confirmation Preview
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>
                      <span className="font-medium">Destination:</span> {previewData.formattedRecipient}
                    </div>
                    <div>
                      <span className="font-medium">From:</span> {previewData.senderIdentity}
                    </div>
                  </div>
                  {composeChannel === 'EMAIL' && (
                    <div className="text-slate-600">
                      <span className="font-medium">Subject:</span> {previewData.renderedSubject}
                    </div>
                  )}
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 whitespace-pre-wrap font-sans">
                    {previewData.renderedBody}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePreview}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
              >
                Preview Rendered Message
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={submitting || !recipient || !messageBody}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'Queueing...' : 'Confirm & Queue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
