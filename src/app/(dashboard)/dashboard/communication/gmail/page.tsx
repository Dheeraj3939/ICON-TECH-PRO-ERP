'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Inbox,
  Star,
  Send,
  FileText,
  Tag,
  Trash2,
  RefreshCw,
  Search,
  Plus,
  ArrowLeft,
  Archive,
  Mail,
  MailOpen,
  Paperclip,
  Reply,
  ReplyAll,
  Forward,
  MoreVertical,
  X,
  ExternalLink,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Download,
  Clock,
  ChevronRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  getGmailConnectionStatus,
  getGmailMailboxThreadsAction,
  getGmailThreadDetailAction,
  markGmailMessageReadAction,
  starGmailMessageAction,
  archiveGmailMessageAction,
  trashGmailMessageAction,
  untrashGmailMessageAction,
  sendGmailMailboxEmailAction,
  createGmailDraftAction,
  getGmailLabelsAction,
  checkGmailMailboxAccessAction,
} from '@/lib/actions/gmail';
import { getCurrentSessionUser } from '@/lib/actions/users';
import type {
  GmailFolder,
  GmailLabel,
  GmailThreadSummary,
  GmailThreadDetail,
  GmailMessageDetail,
  GmailConnectionInfo,
  GmailComposePayload,
} from '@/types/gmail';

export default function GmailMailboxPage() {
  const [connection, setConnection] = useState<GmailConnectionInfo | null>(null);
  const [loadingConn, setLoadingConn] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  const [activeFolder, setActiveFolder] = useState<GmailFolder>('INBOX');
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [threads, setThreads] = useState<GmailThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Selected Thread Detail State
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<GmailThreadDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Quick Inline Reply State
  const [replyMode, setReplyMode] = useState<'reply' | 'replyAll' | 'forward'>('reply');
  const [replyBody, setReplyBody] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<
    Array<{ filename: string; content: string; contentType: string; size: number }>
  >([]);
  const [composeSending, setComposeSending] = useState(false);
  const [composeSavingDraft, setComposeSavingDraft] = useState(false);
  const [composeNotice, setComposeNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Notification Banner
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // 1. Initial Connection Status & Labels
  const loadStatusAndLabels = useCallback(async () => {
    setLoadingConn(true);
    try {
      // Authoritative Mailbox Access Clearance (Section 4 & 23)
      const accessCheck = await checkGmailMailboxAccessAction().catch(() => ({ authorized: false, user: null }));
      if (accessCheck.user) {
        setCurrentUserRole(accessCheck.user.role);
      }
      if (!accessCheck.authorized) {
        setIsAccessDenied(true);
        setLoadingConn(false);
        return;
      }

      const conn = await getGmailConnectionStatus();
      setConnection(conn);

      if (conn.connected) {
        try {
          const lbls = await getGmailLabelsAction();
          setLabels(lbls);
        } catch (err: any) {
          console.warn('Could not load labels:', err.message);
        }
      }
    } catch (err: any) {
      console.error('Failed to load Gmail connection status:', err);
    } finally {
      setLoadingConn(false);
    }
  }, []);

  useEffect(() => {
    loadStatusAndLabels();
  }, [loadStatusAndLabels]);

  // 2. Load Threads for Current Folder / Search
  const loadThreads = useCallback(
    async (folder: GmailFolder, query = '') => {
      setLoadingThreads(true);
      setBanner(null);
      try {
        const res = await getGmailMailboxThreadsAction({
          folder,
          query: query.trim() || undefined,
          maxResults: 25,
        });
        setThreads(res.threads || []);
      } catch (err: any) {
        console.error('Failed to load threads:', err);
        setBanner({
          type: 'error',
          message: err.message || 'Failed to load mailbox messages. Please verify Gmail permissions.',
        });
      } finally {
        setLoadingThreads(false);
      }
    },
    []
  );

  useEffect(() => {
    if (connection?.connected) {
      loadThreads(activeFolder, activeSearch);
    }
  }, [connection?.connected, activeFolder, activeSearch, loadThreads]);

  // 3. Load Thread Detail
  const handleSelectThread = async (threadId: string) => {
    setSelectedThreadId(threadId);
    setLoadingDetail(true);
    setThreadDetail(null);
    setReplyBody('');
    setReplyError(null);
    try {
      const detail = await getGmailThreadDetailAction(threadId);
      setThreadDetail(detail);

      // Mark the latest message as read if unread
      const lastMsg = detail.messages[detail.messages.length - 1];
      if (lastMsg && lastMsg.isUnread) {
        await markGmailMessageReadAction(lastMsg.id, true).catch(() => {});
        // Update unread in local threads list
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, isUnread: false } : t))
        );
      }
    } catch (err: any) {
      setBanner({
        type: 'error',
        message: err.message || 'Failed to load email thread details.',
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  // 4. Thread Actions
  const handleToggleStar = async (msgId: string, currentStarred: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await starGmailMessageAction(msgId, !currentStarred);
      // Update in thread detail if open
      if (threadDetail) {
        setThreadDetail({
          ...threadDetail,
          messages: threadDetail.messages.map((m) =>
            m.id === msgId ? { ...m, isStarred: !currentStarred } : m
          ),
        });
      }
      // Update in threads list
      setThreads((prev) =>
        prev.map((t) => {
          if (t.messages.some((m) => m.id === msgId)) {
            return { ...t, isStarred: !currentStarred };
          }
          return t;
        })
      );
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to update star' });
    }
  };

  const handleArchiveThread = async (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await archiveGmailMessageAction(msgId);
      setBanner({ type: 'info', message: 'Conversation archived.' });
      if (selectedThreadId) {
        setSelectedThreadId(null);
        setThreadDetail(null);
      }
      loadThreads(activeFolder, activeSearch);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to archive' });
    }
  };

  const handleTrashThread = async (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Move this conversation to Trash?')) return;
    try {
      await trashGmailMessageAction(msgId);
      setBanner({ type: 'info', message: 'Conversation moved to Trash.' });
      if (selectedThreadId) {
        setSelectedThreadId(null);
        setThreadDetail(null);
      }
      loadThreads(activeFolder, activeSearch);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to move to trash' });
    }
  };

  // 5. Send Quick Reply / Forward
  const handleSendReply = async () => {
    if (!replyBody.trim()) {
      setReplyError('Please enter a response body.');
      return;
    }
    if (!threadDetail || threadDetail.messages.length === 0) return;

    const lastMsg = threadDetail.messages[threadDetail.messages.length - 1];
    setReplySending(true);
    setReplyError(null);

    try {
      let toRecipient = lastMsg.from;
      let ccList: string[] = [];

      if (replyMode === 'replyAll') {
        toRecipient = lastMsg.from;
        ccList = [...lastMsg.to, ...lastMsg.cc].filter(
          (addr) => !addr.includes('icontechpro@gmail.com') && addr !== lastMsg.from
        );
      } else if (replyMode === 'forward') {
        toRecipient = prompt('Enter recipient email for forward:') || '';
        if (!toRecipient) {
          setReplySending(false);
          return;
        }
      }

      const subjectPrefix = replyMode === 'forward' ? 'Fwd: ' : 'Re: ';
      const cleanSubject = lastMsg.subject.replace(/^(Re:\s*|Fwd:\s*)+/i, '');

      const payload: GmailComposePayload = {
        to: toRecipient,
        cc: ccList.length > 0 ? ccList : undefined,
        subject: `${subjectPrefix}${cleanSubject}`,
        body: replyBody,
        isHtml: false,
        threadId: threadDetail.id,
        inReplyTo: lastMsg.messageIdHeader,
        references: lastMsg.references
          ? `${lastMsg.references} ${lastMsg.messageIdHeader || ''}`.trim()
          : lastMsg.messageIdHeader,
      };

      const res = await sendGmailMailboxEmailAction(payload);
      if (res.success) {
        setReplyBody('');
        setBanner({ type: 'success', message: 'Reply sent successfully.' });
        // Reload conversation thread
        handleSelectThread(threadDetail.id);
      } else {
        setReplyError(res.error || 'Failed to send reply');
      }
    } catch (err: any) {
      setReplyError(err.message || 'Error dispatching reply');
    } finally {
      setReplySending(false);
    }
  };

  // 6. Send Compose Modal Email
  const handleSendCompose = async () => {
    if (!composeTo.trim()) {
      setComposeNotice({ type: 'error', message: 'Please specify at least one recipient.' });
      return;
    }
    if (!composeSubject.trim()) {
      setComposeNotice({ type: 'error', message: 'Please specify an email subject.' });
      return;
    }

    setComposeSending(true);
    setComposeNotice(null);

    try {
      const payload: GmailComposePayload = {
        to: composeTo.split(',').map((e) => e.trim()).filter(Boolean),
        cc: composeCc ? composeCc.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
        bcc: composeBcc ? composeBcc.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
        subject: composeSubject,
        body: composeBody,
        isHtml: false,
        attachments:
          composeAttachments.length > 0
            ? composeAttachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                contentType: a.contentType,
                encoding: 'base64' as const,
              }))
            : undefined,
      };

      const res = await sendGmailMailboxEmailAction(payload);
      if (res.success) {
        setIsComposeOpen(false);
        setComposeTo('');
        setComposeCc('');
        setComposeBcc('');
        setComposeSubject('');
        setComposeBody('');
        setComposeAttachments([]);
        setBanner({ type: 'success', message: 'Email dispatched successfully via Gmail.' });
        loadThreads(activeFolder, activeSearch);
      } else {
        setComposeNotice({ type: 'error', message: res.error || 'Failed to dispatch email.' });
      }
    } catch (err: any) {
      setComposeNotice({ type: 'error', message: err.message || 'Error dispatching email.' });
    } finally {
      setComposeSending(false);
    }
  };

  // 7. Save Draft from Compose
  const handleSaveDraft = async () => {
    if (!composeSubject.trim() && !composeBody.trim()) {
      setComposeNotice({ type: 'error', message: 'Cannot save an empty draft.' });
      return;
    }

    setComposeSavingDraft(true);
    setComposeNotice(null);

    try {
      const payload: GmailComposePayload = {
        to: composeTo ? composeTo.split(',').map((e) => e.trim()).filter(Boolean) : [],
        cc: composeCc ? composeCc.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
        bcc: composeBcc ? composeBcc.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
        subject: composeSubject || '(No Subject)',
        body: composeBody,
        isHtml: false,
      };

      await createGmailDraftAction(payload);
      setComposeNotice({ type: 'success', message: 'Draft saved to Gmail Drafts.' });
      if (activeFolder === 'DRAFTS') {
        loadThreads('DRAFTS');
      }
    } catch (err: any) {
      setComposeNotice({ type: 'error', message: err.message || 'Failed to save draft.' });
    } finally {
      setComposeSavingDraft(false);
    }
  };

  // 8. Handle Attachment File Selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        // Strip data URL scheme to get raw base64
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        setComposeAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            content: base64,
            contentType: file.type || 'application/octet-stream',
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Navigation Items Definition
  const folderItems: Array<{ id: GmailFolder; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'INBOX', label: 'Inbox', icon: Inbox },
    { id: 'STARRED', label: 'Starred', icon: Star },
    { id: 'SENT', label: 'Sent', icon: Send },
    { id: 'DRAFTS', label: 'Drafts', icon: FileText },
    { id: 'IMPORTANT', label: 'Important', icon: Tag },
    { id: 'TRASH', label: 'Trash', icon: Trash2 },
  ];

  if (loadingConn) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[400px] text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
        <div className="text-sm font-semibold">Connecting to Gmail API...</div>
      </div>
    );
  }

  // Executive Access Denied State (RBAC Guard)
  if (isAccessDenied) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6 mt-12">
        <div className="p-8 rounded-2xl bg-white border border-rose-200 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Corporate Mailbox Access Restricted (403)</h2>
            <p className="text-xs text-slate-500 mt-1">
              Your account ({currentUserRole || 'Staff'}) does not have clearance to view or manage corporate mailbox communications for icontechpro@gmail.com.
            </p>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
            In compliance with ICON TECH PRO ERP security governance, access to the shared corporate mailbox is strictly restricted to authorized personnel (<strong>Borra Narsimulu</strong>, <strong>B V Dheeraj Reddy</strong>, <strong>B Vineet Babu</strong>, and <strong>Manisha</strong>) or users with explicit administrator clearance.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard/communication"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Communication Center
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Not Connected or Scope Upgrade Needed State
  if (!connection?.connected || connection.needs_scope_upgrade) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/communication"
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gmail Mailbox Gateway</h1>
            <p className="text-sm text-slate-500">Corporate email dispatcher & mailbox manager for icontechpro@gmail.com</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900">
                {connection?.needs_scope_upgrade
                  ? 'Mailbox Scope Upgrade Required'
                  : 'Gmail Account Not Connected'}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {connection?.needs_scope_upgrade
                  ? 'Your Gmail integration is currently connected with send-only permissions (gmail.send). To read, search, and manage email threads in the ERP mailbox, please authorize mailbox access (gmail.modify).'
                  : 'To access the corporate mailbox inside the ERP, you must connect the authorized Google account (icontechpro@gmail.com) via OAuth 2.0.'}
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/settings/integrations"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-xs transition"
            >
              <ExternalLink className="w-4 h-4" />
              {connection?.needs_scope_upgrade ? 'Upgrade Mailbox Access in Settings' : 'Connect Gmail in Settings'}
            </Link>
            <Link
              href="/dashboard/communication"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition"
            >
              Back to Communication Center
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden bg-slate-50">
      {/* Top Bar Banner / Notices */}
      {banner && (
        <div
          className={`px-4 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
            banner.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : banner.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {banner.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            {banner.type === 'info' && <Shield className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Mailbox Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* ========================================================================= */}
        {/* LEFT SIDEBAR NAVIGATION                                                  */}
        {/* ========================================================================= */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 select-none">
          {/* Compose Button */}
          <div className="p-4 border-b border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsComposeOpen(true);
                setComposeNotice(null);
              }}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl shadow-xs transition duration-150"
            >
              <Plus className="w-4 h-4" />
              Compose Email
            </button>
          </div>

          {/* Folder List */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {folderItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeFolder === item.id && !activeSearch;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveFolder(item.id);
                    setActiveSearch('');
                    setSearchQuery('');
                    setSelectedThreadId(null);
                    setThreadDetail(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}

            {/* Labels Divider */}
            {labels.length > 0 && (
              <div className="pt-4 pb-1">
                <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Labels
                </div>
                <div className="mt-1 space-y-0.5">
                  {labels.slice(0, 8).map((label) => (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => {
                        setActiveSearch(`label:${label.name}`);
                        setSelectedThreadId(null);
                        setThreadDetail(null);
                      }}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100 truncate"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{label.name}</span>
                      </div>
                      {label.messagesUnread ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-full">
                          {label.messagesUnread}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </nav>

          {/* Account Footprint Box */}
          <div className="p-3 border-t border-slate-200 bg-slate-50/60">
            <div className="flex items-center justify-between">
              <div className="truncate">
                <div className="text-[11px] font-bold text-slate-800 truncate">icontechpro@gmail.com</div>
                <div className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium mt-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Gmail API Active
                </div>
              </div>
              <Link
                href="/dashboard/settings/integrations"
                title="Integrations Settings"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
              >
                <MoreVertical className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* MAIN THREAD LIST / CONTENT AREA                                          */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Top Search & Actions Bar */}
          <header className="h-14 px-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 bg-white">
            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search emails by sender, subject, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setActiveSearch(searchQuery);
                      setSelectedThreadId(null);
                      setThreadDetail(null);
                    }
                  }}
                  className="w-full pl-9 pr-8 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white border border-transparent focus:border-brand-500 rounded-xl text-xs text-slate-800 placeholder-slate-400 transition outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveSearch('');
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadThreads(activeFolder, activeSearch)}
                disabled={loadingThreads}
                title="Refresh Mailbox"
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingThreads ? 'animate-spin text-brand-600' : ''}`} />
              </button>
              <Link
                href="/dashboard/communication"
                title="Communication Log"
                className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
              >
                Communication Center
              </Link>
            </div>
          </header>

          {/* Body Section (Thread List OR Split View with Detail) */}
          <div className="flex-1 flex overflow-hidden">
            {/* Thread List Pane */}
            <div
              className={`${
                selectedThreadId ? 'hidden md:flex md:w-80 lg:w-96' : 'w-full'
              } border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto bg-white`}
            >
              {loadingThreads ? (
                <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-brand-600" />
                  <span>Loading conversations...</span>
                </div>
              ) : threads.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <MailOpen className="w-8 h-8 text-slate-300" />
                  <span className="font-semibold text-slate-600">No conversations in {activeFolder.toLowerCase()}</span>
                  <span className="text-[11px] text-slate-400">Your mailbox is all caught up.</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {threads.map((thread) => {
                    const isSelected = selectedThreadId === thread.id;
                    const latestMsg = thread.messages[thread.messages.length - 1];
                    const msgId = latestMsg?.id || thread.id;

                    return (
                      <div
                        key={thread.id}
                        onClick={() => handleSelectThread(thread.id)}
                        className={`p-3.5 cursor-pointer transition flex items-start gap-3 hover:bg-slate-50 ${
                          isSelected
                            ? 'bg-brand-50/70 border-l-4 border-brand-600'
                            : thread.isUnread
                            ? 'bg-white font-bold'
                            : 'bg-white text-slate-600'
                        }`}
                      >
                        {/* Star Button */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleStar(msgId, thread.isStarred, e)}
                          className="mt-0.5 text-slate-300 hover:text-amber-500 transition shrink-0"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              thread.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                            }`}
                          />
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-xs truncate ${
                                thread.isUnread ? 'font-black text-slate-900' : 'font-semibold text-slate-800'
                              }`}
                            >
                              {thread.participants.join(', ') || 'Unknown'}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(thread.lastMessageDate).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {thread.messageCount > 1 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                {thread.messageCount}
                              </span>
                            )}
                            <span
                              className={`text-xs truncate ${
                                thread.isUnread ? 'font-bold text-slate-900' : 'text-slate-700'
                              }`}
                            >
                              {latestMsg?.subject || '(No Subject)'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {thread.snippet}
                          </p>

                          {/* Badges */}
                          <div className="flex items-center gap-2 pt-0.5">
                            {thread.hasAttachments && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Paperclip className="w-3 h-3 text-slate-400" />
                              </span>
                            )}
                            {thread.isImportant && (
                              <Tag className="w-3 h-3 text-amber-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Conversation Viewer Pane */}
            {selectedThreadId ? (
              <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
                {loadingDetail ? (
                  <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2 m-auto">
                    <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
                    <span>Loading conversation history...</span>
                  </div>
                ) : threadDetail ? (
                  <div className="p-6 max-w-4xl mx-auto w-full space-y-4">
                    {/* Header Action Bar */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedThreadId(null);
                            setThreadDetail(null);
                          }}
                          className="md:hidden p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <h2 className="text-base font-black text-slate-900 tracking-tight">
                          {threadDetail.messages[0]?.subject || '(No Subject)'}
                        </h2>
                      </div>

                      {/* Thread Actions */}
                      <div className="flex items-center gap-1.5">
                        {threadDetail.messages.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleStar(
                                  threadDetail.messages[0].id,
                                  threadDetail.messages[0].isStarred
                                )
                              }
                              title="Star Thread"
                              className="p-2 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-white transition"
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  threadDetail.messages[0].isStarred
                                    ? 'fill-amber-400 text-amber-400'
                                    : ''
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchiveThread(threadDetail.messages[0].id)}
                              title="Archive Thread"
                              className="p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-white transition"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTrashThread(threadDetail.messages[0].id)}
                              title="Move to Trash"
                              className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-white transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Messages Stack */}
                    <div className="space-y-4">
                      {threadDetail.messages.map((message, index) => (
                        <div
                          key={message.id}
                          className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden"
                        >
                          {/* Message Header */}
                          <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center">
                                {message.from.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900">{message.from}</div>
                                <div className="text-[11px] text-slate-500">
                                  To: {message.to.join(', ')}
                                  {message.cc.length > 0 ? ` | Cc: ${message.cc.join(', ')}` : ''}
                                </div>
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium">
                              {message.dateFormatted}
                            </div>
                          </div>

                          {/* Message Body */}
                          <div className="p-5">
                            {message.bodyHtml ? (
                              <iframe
                                title={`Email content ${message.id}`}
                                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:13px;line-height:1.6;color:#1e293b;margin:0;padding:4px;word-break:break-word;}a{color:#2563eb;}img{max-width:100%;height:auto;}</style></head><body>${message.bodyHtml}</body></html>`}
                                sandbox="allow-popups allow-popups-to-escape-sandbox"
                                className="w-full min-h-[160px] border-none"
                                onLoad={(e) => {
                                  try {
                                    const iframe = e.target as HTMLIFrameElement;
                                    if (iframe.contentWindow?.document?.body) {
                                      iframe.style.height = `${iframe.contentWindow.document.body.scrollHeight + 30}px`;
                                    }
                                  } catch {
                                    // Cross-origin fallback height
                                  }
                                }}
                              />
                            ) : (
                              <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                                {message.bodyText || message.snippet}
                              </pre>
                            )}
                          </div>

                          {/* Attachments Section */}
                          {message.attachments.length > 0 && (
                            <div className="p-4 bg-slate-50 border-t border-slate-100">
                              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Paperclip className="w-3.5 h-3.5" />
                                Attachments ({message.attachments.length})
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {message.attachments.map((att) => (
                                  <a
                                    key={att.id}
                                    href={`/api/integrations/gmail/attachment?messageId=${message.id}&attachmentId=${att.attachmentId}&filename=${encodeURIComponent(
                                      att.filename
                                    )}&mimeType=${encodeURIComponent(att.mimeType)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={att.filename}
                                    className="p-2.5 bg-white rounded-xl border border-slate-200 hover:border-brand-500 hover:shadow-xs transition flex items-center justify-between text-xs group"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <FileText className="w-4 h-4 text-brand-600 shrink-0" />
                                      <span className="truncate font-semibold text-slate-800">
                                        {att.filename}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[10px] text-slate-400">
                                        {Math.round(att.size / 1024)} KB
                                      </span>
                                      <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 transition" />
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Quick Inline Reply Box */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReplyMode('reply')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              replyMode === 'reply'
                                ? 'bg-brand-50 text-brand-700'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <Reply className="w-3.5 h-3.5" /> Reply
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyMode('replyAll')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              replyMode === 'replyAll'
                                ? 'bg-brand-50 text-brand-700'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <ReplyAll className="w-3.5 h-3.5" /> Reply All
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyMode('forward')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              replyMode === 'forward'
                                ? 'bg-brand-50 text-brand-700'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <Forward className="w-3.5 h-3.5" /> Forward
                          </button>
                        </div>
                      </div>

                      {replyError && (
                        <div className="p-2.5 rounded-lg bg-rose-50 text-rose-800 text-xs font-medium">
                          {replyError}
                        </div>
                      )}

                      <textarea
                        rows={4}
                        placeholder={
                          replyMode === 'forward'
                            ? 'Add a forward comment...'
                            : `Write your response to ${threadDetail.messages[threadDetail.messages.length - 1]?.from}...`
                        }
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 leading-relaxed"
                      />

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          Sending as <strong>icontechpro@gmail.com</strong>
                        </span>
                        <button
                          type="button"
                          onClick={handleSendReply}
                          disabled={replySending || !replyBody.trim()}
                          className="inline-flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
                        >
                          {replySending ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              Send {replyMode === 'forward' ? 'Forward' : 'Reply'}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FLOATING COMPOSE MODAL                                                    */}
      {/* ========================================================================= */}
      {isComposeOpen && (
        <div className="fixed bottom-4 right-6 w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
            <span className="text-xs font-bold">New Message (icontechpro@gmail.com)</span>
            <button
              type="button"
              onClick={() => setIsComposeOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Fields */}
          <div className="p-4 space-y-2.5 max-h-[75vh] overflow-y-auto">
            {composeNotice && (
              <div
                className={`p-2.5 rounded-lg text-xs font-medium ${
                  composeNotice.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-rose-50 text-rose-800'
                }`}
              >
                {composeNotice.message}
              </div>
            )}

            {/* To Field */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <input
                type="text"
                placeholder="To: (comma-separated emails)"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0">
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="hover:text-slate-600"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    type="button"
                    onClick={() => setShowBcc(true)}
                    className="hover:text-slate-600"
                  >
                    Bcc
                  </button>
                )}
              </div>
            </div>

            {/* CC Field */}
            {showCc && (
              <div className="flex items-center border-b border-slate-100 pb-1.5">
                <input
                  type="text"
                  placeholder="Cc: (optional)"
                  value={composeCc}
                  onChange={(e) => setComposeCc(e.target.value)}
                  className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowCc(false);
                    setComposeCc('');
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* BCC Field */}
            {showBcc && (
              <div className="flex items-center border-b border-slate-100 pb-1.5">
                <input
                  type="text"
                  placeholder="Bcc: (optional)"
                  value={composeBcc}
                  onChange={(e) => setComposeBcc(e.target.value)}
                  className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowBcc(false);
                    setComposeBcc('');
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Subject */}
            <div className="border-b border-slate-100 pb-1.5">
              <input
                type="text"
                placeholder="Subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="w-full text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none"
              />
            </div>

            {/* Body */}
            <div>
              <textarea
                rows={8}
                placeholder="Type your message here..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none leading-relaxed resize-none"
              />
            </div>

            {/* Attachment Previews */}
            {composeAttachments.length > 0 && (
              <div className="p-2.5 bg-slate-50 rounded-xl space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Attachments ({composeAttachments.length})
                </div>
                <div className="space-y-1">
                  {composeAttachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-white p-1.5 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate text-slate-800">{att.filename}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          ({Math.round(att.size / 1024)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setComposeAttachments((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-slate-400 hover:text-rose-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Compose Footer Toolbar */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label
                title="Attach files"
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer transition"
              >
                <Paperclip className="w-4 h-4" />
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={composeSavingDraft || composeSending}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
              >
                {composeSavingDraft ? 'Saving Draft...' : 'Save Draft'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSendCompose}
                disabled={composeSending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
              >
                {composeSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Message
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
