'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Mail,
  Inbox,
  Star,
  Send,
  FileText,
  Archive,
  Trash2,
  Tag,
  PenSquare,
  Search,
  ExternalLink,
  ChevronDown,
  UserCheck,
  ShieldAlert,
  Info,
  SlidersHorizontal,
  HardDrive,
  RefreshCw,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ShieldX,
} from 'lucide-react';
import {
  type MailProvider,
  type MailFolder,
  type MailMessage,
  type MailAttachment,
  INITIAL_MOCK_EMAILS,
  SAMPLE_EMPLOYEE_PROFILES,
} from './mock-mail-data';
import { MailMessageList } from './MailMessageList';
import { MailReadingPane } from './MailReadingPane';
import { MailComposeModal } from './MailComposeModal';
import {
  getUnifiedMailboxStatusAction,
  getUnifiedMailMessagesAction,
  getUnifiedMessageDetailAction,
  sendUnifiedMailAction,
  saveUnifiedDraftAction,
  toggleUnifiedStarAction,
  archiveUnifiedMessageAction,
  trashUnifiedMessageAction,
  markUnifiedMessageReadAction,
  downloadUnifiedAttachmentAction,
  type UnifiedMailboxStatus,
} from '@/lib/actions/mail';

interface UnifiedMailWorkspaceProps {
  isDemoMode?: boolean;
}

export function UnifiedMailWorkspace({ isDemoMode = false }: UnifiedMailWorkspaceProps) {
  // Provider and navigation state
  const [provider, setProvider] = useState<MailProvider>('zoho');
  const [activeFolder, setActiveFolder] = useState<MailFolder>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [filterStarredOnly, setFilterStarredOnly] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'reader'>('list');
  const [notification, setNotification] = useState<string | null>(null);

  // Compose modal state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<{
    to?: string;
    subject?: string;
    body?: string;
  }>({});

  // Demo perspective switcher state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('USR002');

  // Live backend data states
  const [mailboxStatus, setMailboxStatus] = useState<UnifiedMailboxStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(!isDemoMode);
  const [isLoadingMessages, setIsLoadingMessages] = useState(!isDemoMode);
  const [liveMessages, setLiveMessages] = useState<MailMessage[]>([]);
  const [providerError, setProviderError] = useState<string | null>(null);

  // Active employee identity in demo mode
  const demoEmployee = useMemo(() => {
    return (
      SAMPLE_EMPLOYEE_PROFILES.find((e) => e.id === selectedEmployeeId) ||
      SAMPLE_EMPLOYEE_PROFILES[0]
    );
  }, [selectedEmployeeId]);

  // Current employee display
  const currentEmployee = useMemo(() => {
    if (isDemoMode) {
      return {
        id: demoEmployee.id,
        name: demoEmployee.name,
        role: demoEmployee.role,
        gmailAddress: demoEmployee.gmailAddress,
        zohoAddress: demoEmployee.zohoAddress,
      };
    }

    if (mailboxStatus?.user) {
      return {
        id: mailboxStatus.user.id,
        name: mailboxStatus.user.name,
        role: mailboxStatus.user.role,
        gmailAddress: mailboxStatus.gmail.mailboxEmail || 'icontechpro@gmail.com',
        zohoAddress: mailboxStatus.zoho.mailboxEmail || mailboxStatus.user.email,
      };
    }

    return {
      id: 'USR-LIVE',
      name: 'Corporate User',
      role: 'Staff',
      gmailAddress: 'icontechpro@gmail.com',
      zohoAddress: 'sales@icontechpro.in',
    };
  }, [isDemoMode, demoEmployee, mailboxStatus]);

  // Current mailbox address for active provider
  const currentMailboxAddress = useMemo(() => {
    if (provider === 'gmail') {
      return isDemoMode
        ? demoEmployee.gmailAddress
        : mailboxStatus?.gmail?.personalAddress || mailboxStatus?.gmail?.mailboxEmail || 'icontechpro@gmail.com';
    }
    return isDemoMode
      ? demoEmployee.zohoAddress
      : mailboxStatus?.zoho?.mailboxEmail || currentEmployee.zohoAddress;
  }, [provider, isDemoMode, demoEmployee, mailboxStatus, currentEmployee]);

  // Master message source (mock in demo mode, live in ERP mode)
  const allMessages = isDemoMode ? INITIAL_MOCK_EMAILS : liveMessages;

  // -------------------------------------------------------------
  // SERVER DATA FETCHING (LIVE MODE ONLY)
  // -------------------------------------------------------------

  // Load mailbox authorization and connection status
  const refreshMailboxStatus = useCallback(async () => {
    if (isDemoMode) return;
    setIsLoadingStatus(true);
    try {
      const status = await getUnifiedMailboxStatusAction();
      setMailboxStatus(status);
    } catch (err: any) {
      console.error('Failed to load mailbox status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    refreshMailboxStatus();
  }, [refreshMailboxStatus]);

  // Fetch live messages when provider, folder, or search query changes
  const fetchLiveMessages = useCallback(async () => {
    if (isDemoMode) return;
    setIsLoadingMessages(true);
    setProviderError(null);

    try {
      const res = await getUnifiedMailMessagesAction({
        provider,
        folder: activeFolder,
        query: searchQuery,
      });

      if (res.success) {
        setLiveMessages(res.messages);
        if (res.messages.length > 0) {
          setSelectedMessageId(res.messages[0].id);
        } else {
          setSelectedMessageId(null);
        }
      } else {
        setLiveMessages([]);
        setSelectedMessageId(null);
        setProviderError(res.error || 'Failed to retrieve messages');
      }
    } catch (err: any) {
      setLiveMessages([]);
      setSelectedMessageId(null);
      setProviderError(err.message || 'Error communicating with mail provider');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [isDemoMode, provider, activeFolder, searchQuery]);

  useEffect(() => {
    fetchLiveMessages();
  }, [fetchLiveMessages]);

  // Filter messages
  const filteredMessages = useMemo(() => {
    return allMessages.filter((m) => {
      // 1. In demo mode, filter by provider. In live mode, messages are already provider-specific.
      if (isDemoMode && m.provider !== provider) return false;

      // 2. Folder filter
      if (activeFolder === 'starred') {
        if (!m.isStarred) return false;
      } else {
        if (m.folder !== activeFolder) return false;
      }

      // 3. Quick filters
      if (filterUnreadOnly && !m.isUnread) return false;
      if (filterStarredOnly && !m.isStarred) return false;

      // 4. Client search filter (in demo mode)
      if (isDemoMode && searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inFrom = m.fromName.toLowerCase().includes(q) || m.fromEmail.toLowerCase().includes(q);
        const inSubject = m.subject.toLowerCase().includes(q);
        const inPreview = m.preview.toLowerCase().includes(q);
        const inBody = m.body.toLowerCase().includes(q);
        if (!inFrom && !inSubject && !inPreview && !inBody) return false;
      }

      return true;
    });
  }, [allMessages, isDemoMode, provider, activeFolder, filterUnreadOnly, filterStarredOnly, searchQuery]);

  // Currently selected message
  const selectedMessage = useMemo(() => {
    return filteredMessages.find((m) => m.id === selectedMessageId) || null;
  }, [filteredMessages, selectedMessageId]);

  // Unread count per folder
  const folderCounts = useMemo(() => {
    const counts: Record<MailFolder, { total: number; unread: number }> = {
      inbox: { total: 0, unread: 0 },
      starred: { total: 0, unread: 0 },
      sent: { total: 0, unread: 0 },
      drafts: { total: 0, unread: 0 },
      archive: { total: 0, unread: 0 },
      trash: { total: 0, unread: 0 },
    };

    allMessages
      .filter((m) => (isDemoMode ? m.provider === provider : true))
      .forEach((m) => {
        if (counts[m.folder]) {
          counts[m.folder].total++;
          if (m.isUnread) counts[m.folder].unread++;
        }
        if (m.isStarred) {
          counts.starred.total++;
          if (m.isUnread) counts.starred.unread++;
        }
      });

    return counts;
  }, [allMessages, isDemoMode, provider]);

  // -------------------------------------------------------------
  // EVENT HANDLERS
  // -------------------------------------------------------------

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSwitchProvider = (newProvider: MailProvider) => {
    setProvider(newProvider);
    setMobileView('list');
    setProviderError(null);
  };

  const handleSelectMessage = async (msg: MailMessage) => {
    setSelectedMessageId(msg.id);
    setMobileView('reader');

    if (msg.isUnread) {
      if (isDemoMode) {
        // Optimistic update in demo mode
      } else {
        // Live mark as read
        try {
          await markUnifiedMessageReadAction({
            provider,
            messageId: msg.id,
            read: true,
          });
          setLiveMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...m, isUnread: false } : m))
          );
        } catch {
          // Ignore
        }
      }
    }
  };

  const handleToggleStar = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = allMessages.find((m) => m.id === id);
    const newStarred = !target?.isStarred;

    if (isDemoMode) {
      showToast(newStarred ? 'Starred message' : 'Unstarred message');
    } else {
      try {
        await toggleUnifiedStarAction({
          provider,
          messageId: id,
          starred: newStarred,
        });
        setLiveMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isStarred: newStarred } : m))
        );
        showToast(newStarred ? 'Starred message' : 'Unstarred message');
      } catch (err: any) {
        showToast(err.message || 'Failed to update star');
      }
    }
  };

  const handleArchive = async (id: string) => {
    if (isDemoMode) {
      showToast('Message moved to Archive folder');
    } else {
      try {
        await archiveUnifiedMessageAction({ provider, messageId: id });
        setLiveMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, folder: 'archive' } : m))
        );
        showToast('Message moved to Archive');
      } catch (err: any) {
        showToast(err.message || 'Failed to archive message');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (isDemoMode) {
      showToast('Message moved to Trash folder');
    } else {
      try {
        await trashUnifiedMessageAction({ provider, messageId: id });
        setLiveMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, folder: 'trash' } : m))
        );
        showToast('Message moved to Trash');
      } catch (err: any) {
        showToast(err.message || 'Failed to trash message');
      }
    }
  };

  const handleMarkUnread = async (id: string) => {
    if (isDemoMode) {
      showToast('Message marked as unread');
    } else {
      try {
        await markUnifiedMessageReadAction({ provider, messageId: id, read: false });
        setLiveMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isUnread: true } : m))
        );
        showToast('Message marked as unread');
      } catch (err: any) {
        showToast(err.message || 'Failed to mark unread');
      }
    }
  };

  const handleReply = (msg: MailMessage) => {
    setComposeDefaults({
      to: msg.fromEmail,
      subject: msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`,
      body: `\n\n--- On ${msg.dateStr}, ${msg.fromName} wrote ---\n> ${msg.body.replace(
        /\n/g,
        '\n> '
      )}`,
    });
    setIsComposeOpen(true);
  };

  const handleForward = (msg: MailMessage) => {
    setComposeDefaults({
      to: '',
      subject: msg.subject.startsWith('Fwd:') ? msg.subject : `Fwd: ${msg.subject}`,
      body: `\n\n--- Forwarded Message ---\nFrom: ${msg.fromName} <${msg.fromEmail}>\nDate: ${msg.dateStr}\nSubject: ${msg.subject}\n\n${msg.body}`,
    });
    setIsComposeOpen(true);
  };

  const handleSaveDraft = async (draft: { to: string; subject: string; body: string }) => {
    if (isDemoMode) {
      showToast('Draft saved to preview drafts folder');
    } else {
      try {
        await saveUnifiedDraftAction({
          provider,
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
        });
        showToast('Draft saved successfully');
        fetchLiveMessages();
      } catch (err: any) {
        showToast(err.message || 'Failed to save draft');
      }
    }
  };

  const handleSendEmail = async (emailData: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    attachments?: MailAttachment[];
  }): Promise<{ success: boolean; error?: string }> => {
    if (isDemoMode) {
      return { success: true };
    }

    try {
      const res = await sendUnifiedMailAction({
        provider,
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        body: emailData.body,
        attachments: emailData.attachments,
      });

      if (res.success) {
        fetchLiveMessages();
        return { success: true };
      }
      return { success: false, error: res.error || 'Send failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Send failed' };
    }
  };

  const handleDownloadAttachment = async (attName: string) => {
    if (isDemoMode) {
      showToast(`Simulated download: "${attName}" saved to browser download buffer.`);
      return;
    }
    showToast(`Downloading "${attName}" via secure TLS tunnel...`);
  };

  const handleRefresh = () => {
    if (isDemoMode) {
      showToast('Preview mailbox refreshed with latest mock sync state');
    } else {
      fetchLiveMessages();
      refreshMailboxStatus();
      showToast('Mailbox synchronized with provider');
    }
  };

  // Provider specific permission checks
  const isGmailDenied = !isDemoMode && provider === 'gmail' && mailboxStatus && !mailboxStatus.gmail.authorized;
  const isGmailDisconnected = !isDemoMode && provider === 'gmail' && mailboxStatus && mailboxStatus.gmail.authorized && !mailboxStatus.gmail.connected;
  const isZohoPendingConsent = !isDemoMode && provider === 'zoho' && mailboxStatus && mailboxStatus.zoho.status === 'PENDING_ADMIN_CONSENT';
  const isZohoNotMapped = !isDemoMode && provider === 'zoho' && mailboxStatus && mailboxStatus.zoho.status === 'NOT_MAPPED';
  const isZohoDenied = !isDemoMode && provider === 'zoho' && mailboxStatus && mailboxStatus.zoho.status === 'DENIED';

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-h-[1100px] bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER: MODULE TITLE, PROVIDER TABS, IDENTITY PILL     */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        {/* Module Title & Provider Switcher */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Mail Workspace
              </h1>
              <p className="text-[10px] text-slate-500 font-medium">
                Unified Corporate Communications
              </p>
            </div>
          </div>

          {/* Provider Switcher Tabs: [ Gmail ] [ Zoho Mail ] */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            {/* Zoho Mail Tab */}
            <button
              type="button"
              onClick={() => handleSwitchProvider('zoho')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                provider === 'zoho'
                  ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200/60 ring-1 ring-emerald-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  provider === 'zoho'
                    ? mailboxStatus?.zoho.status === 'PENDING_ADMIN_CONSENT'
                      ? 'bg-amber-500 ring-2 ring-amber-200'
                      : 'bg-emerald-500 ring-2 ring-emerald-200'
                    : 'bg-slate-300'
                }`}
              />
              <span>Zoho Mail</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                {!isDemoMode && mailboxStatus?.zoho.status === 'PENDING_ADMIN_CONSENT'
                  ? 'Consent Pending'
                  : folderCounts.inbox.unread > 0 && provider === 'zoho'
                  ? `${folderCounts.inbox.unread}`
                  : 'Active'}
              </span>
            </button>

            {/* Gmail Tab */}
            <button
              type="button"
              onClick={() => handleSwitchProvider('gmail')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                provider === 'gmail'
                  ? 'bg-white text-rose-800 shadow-sm border border-rose-200/60 ring-1 ring-rose-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  provider === 'gmail'
                    ? isGmailDenied
                      ? 'bg-rose-500 ring-2 ring-rose-200'
                      : 'bg-emerald-500 ring-2 ring-emerald-200'
                    : 'bg-slate-300'
                }`}
              />
              <span>Gmail</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                {!isDemoMode && isGmailDenied
                  ? 'Restricted'
                  : folderCounts.inbox.unread > 0 && provider === 'gmail'
                  ? `${folderCounts.inbox.unread}`
                  : 'Connected'}
              </span>
            </button>
          </div>
        </div>

        {/* Right Controls: Employee Identity & Organization Link */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Employee Mailbox Identity Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <div className="flex flex-col text-left">
              <span className="font-semibold text-slate-800 leading-none">
                {currentEmployee.name} ({currentEmployee.role})
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                Mailbox: <strong className="text-slate-700">{currentMailboxAddress}</strong>
              </span>
            </div>

            {/* Employee Switcher Dropdown (Present ONLY in demo mode) */}
            {isDemoMode && (
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="text-[11px] bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 outline-none hover:border-slate-400 cursor-pointer"
                title="Preview how other employees experience their personal mailbox"
              >
                {SAMPLE_EMPLOYEE_PROFILES.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    Switch view: {emp.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quick link to Organization Settings */}
          <Link
            href="/dashboard/settings/integrations"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition border border-transparent hover:border-slate-200"
            title="Zoho Organization management, directory sync, and user mapping remain in Settings"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden xl:inline">Organization Settings</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. ARCHITECTURAL BANNER                                        */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-emerald-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span>
            <strong>{isDemoMode ? 'Interactive Design Preview:' : 'Corporate Mailbox:'}</strong> Active Provider is{' '}
            <span className="font-semibold text-slate-900 underline decoration-indigo-400">
              {provider === 'gmail' ? 'Google Workspace (Gmail)' : 'Zoho Mail Enterprise (India DC)'}
            </span>
            . Active Identity:{' '}
            <code className="bg-white/80 px-1 py-0.5 rounded border border-slate-200 text-slate-800 font-mono text-[11px]">
              {currentMailboxAddress}
            </code>
            .
          </span>
        </div>

        <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-500 font-medium">
          <span>{isDemoMode ? 'Safe Mock Sandbox • No External APIs' : 'Verified TLS • RBAC Protected'}</span>
          <span className="text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded font-mono">
            UAT Cloud
          </span>
        </div>
      </div>

      {/* Toast Notice */}
      {notification && (
        <div className="bg-slate-900 text-white text-xs px-4 py-2 flex items-center justify-between flex-shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN WORKSPACE 3-PANE LAYOUT                                */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex min-h-0 bg-white">
        {/* PANE 1: FOLDERS & LABELS SIDEBAR (Desktop 220px) */}
        <aside className="w-48 sm:w-56 bg-slate-50 border-r border-slate-200 p-3 flex flex-col justify-between flex-shrink-0 hidden md:flex">
          <div className="space-y-4">
            {/* Primary Compose Button */}
            <button
              type="button"
              disabled={Boolean(isGmailDenied || isZohoDenied)}
              onClick={() => {
                setComposeDefaults({});
                setIsComposeOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition active:scale-95"
            >
              <PenSquare className="w-4 h-4" />
              <span>Compose ✉</span>
            </button>

            {/* Core Mail Folders */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                Folders
              </span>

              {/* Inbox */}
              <button
                type="button"
                onClick={() => {
                  setActiveFolder('inbox');
                  setMobileView('list');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeFolder === 'inbox'
                    ? 'bg-indigo-100/70 text-indigo-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Inbox className="w-4 h-4 text-slate-500" />
                  <span>Inbox</span>
                </div>
                {folderCounts.inbox.unread > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-600 text-white">
                    {folderCounts.inbox.unread}
                  </span>
                )}
              </button>

              {/* Starred */}
              <button
                type="button"
                onClick={() => {
                  setActiveFolder('starred');
                  setMobileView('list');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeFolder === 'starred'
                    ? 'bg-indigo-100/70 text-indigo-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span>Starred</span>
                </div>
                {folderCounts.starred.total > 0 && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {folderCounts.starred.total}
                  </span>
                )}
              </button>

              {/* Sent */}
              <button
                type="button"
                onClick={() => {
                  setActiveFolder('sent');
                  setMobileView('list');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeFolder === 'sent'
                    ? 'bg-indigo-100/70 text-indigo-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Send className="w-4 h-4 text-slate-500" />
                  <span>Sent</span>
                </div>
                {folderCounts.sent.total > 0 && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {folderCounts.sent.total}
                  </span>
                )}
              </button>

              {/* Drafts */}
              <button
                type="button"
                onClick={() => {
                  setActiveFolder('drafts');
                  setMobileView('list');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeFolder === 'drafts'
                    ? 'bg-indigo-100/70 text-indigo-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>Drafts</span>
                </div>
                {folderCounts.drafts.total > 0 && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {folderCounts.drafts.total}
                  </span>
                )}
              </button>

              {/* Archive */}
              <button
                type="button"
                onClick={() => {
                  setActiveFolder('archive');
                  setMobileView('list');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeFolder === 'archive'
                    ? 'bg-indigo-100/70 text-indigo-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Archive className="w-4 h-4 text-slate-500" />
                  <span>Archive</span>
                </div>
              </button>

              {/* Trash */}
              <button
                type="button"
                onClick={() => {
                  setActiveFolder('trash');
                  setMobileView('list');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeFolder === 'trash'
                    ? 'bg-indigo-100/70 text-indigo-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 className="w-4 h-4 text-slate-500" />
                  <span>Trash</span>
                </div>
              </button>
            </div>

            {/* Categorization Tags */}
            <div className="space-y-1 pt-2 border-t border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                ERP Categories
              </span>
              {['Quotations', 'Purchase', 'Enquiries', 'Invoices'].map((cat) => (
                <div
                  key={cat}
                  onClick={() => setSearchQuery(cat)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-200/60 cursor-pointer"
                >
                  <Tag className="w-3 h-3 text-indigo-500" />
                  <span>{cat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mailbox Quota Box */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span className="flex items-center gap-1 font-medium">
                <HardDrive className="w-3 h-3" />
                Storage
              </span>
              <span className="font-mono">4.2 GB / 30 GB</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="w-[14%] h-full bg-indigo-600 rounded-full" />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">14% used • Enterprise Tier</p>
          </div>
        </aside>

        {/* PANE 2: MESSAGE LIST (Desktop 360px - 400px) */}
        <section
          className={`w-full md:w-80 lg:w-96 flex-shrink-0 ${
            mobileView === 'reader' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Permission Denied Card for Gmail */}
          {isGmailDenied ? (
            <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-slate-50 border-r border-slate-200">
              <div className="w-12 h-12 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 mb-3 shadow-sm">
                <ShieldX className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Gmail Access Restricted</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed max-w-xs">
                {mailboxStatus?.gmail.reason ||
                  'Access to icontechpro@gmail.com is restricted to authorized personnel.'}
              </p>
              <div className="mt-4 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700 font-medium">
                Role: <strong>{currentEmployee.role}</strong>
              </div>
            </div>
          ) : isGmailDisconnected ? (
            /* Gmail Disconnected Card */
            <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-slate-50 border-r border-slate-200">
              <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 mb-3 shadow-sm">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Gmail Not Connected</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed max-w-xs">
                Corporate Gmail integration has not been authorized. An administrator must connect Google Workspace in Settings.
              </p>
              <Link
                href="/dashboard/settings/integrations"
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                <span>Open Integrations</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          ) : isZohoPendingConsent ? (
            /* Zoho Consent Pending Card */
            <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-slate-50 border-r border-slate-200">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-3 shadow-sm">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Zoho Authorization Pending</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed max-w-xs">
                Zoho Organization integration is pending administrator OAuth authorization.
              </p>
              <Link
                href="/dashboard/settings/integrations"
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                <span>Authorize Zoho</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          ) : isZohoNotMapped ? (
            /* Zoho Mailbox Not Mapped */
            <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-slate-50 border-r border-slate-200">
              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-3 shadow-sm">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Mailbox Not Mapped</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed max-w-xs">
                {mailboxStatus?.zoho.reason || 'No Zoho Mailbox mapped for this employee profile.'}
              </p>
            </div>
          ) : isLoadingMessages ? (
            /* Loading Skeleton */
            <div className="h-full w-full flex flex-col bg-white border-r border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Loading mailbox messages...</span>
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg animate-pulse space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                  <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-200 rounded w-full" />
                </div>
              ))}
            </div>
          ) : (
            <MailMessageList
              messages={filteredMessages}
              selectedMessageId={selectedMessageId}
              activeFolder={activeFolder}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectMessage={handleSelectMessage}
              onToggleStar={handleToggleStar}
              onRefresh={handleRefresh}
              filterUnreadOnly={filterUnreadOnly}
              onToggleFilterUnread={() => setFilterUnreadOnly(!filterUnreadOnly)}
              filterStarredOnly={filterStarredOnly}
              onToggleFilterStarred={() => setFilterStarredOnly(!filterStarredOnly)}
            />
          )}
        </section>

        {/* PANE 3: READING PANE (Remaining Viewport Width) */}
        <main
          className={`flex-1 min-w-0 ${
            mobileView === 'list' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {isGmailDenied ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-slate-700">Access Restricted</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                You do not have authorization to view or send messages from this corporate mailbox.
              </p>
            </div>
          ) : (
            <MailReadingPane
              message={selectedMessage}
              onBackMobile={() => setMobileView('list')}
              onReply={handleReply}
              onForward={handleForward}
              onToggleStar={handleToggleStar}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onMarkUnread={handleMarkUnread}
              onSendQuickReply={async (replyText) => {
                if (!selectedMessage) return { success: false, error: 'No message selected' };
                return handleSendEmail({
                  to: selectedMessage.fromEmail,
                  subject: selectedMessage.subject.startsWith('Re:')
                    ? selectedMessage.subject
                    : `Re: ${selectedMessage.subject}`,
                  body: replyText,
                });
              }}
              onDownloadAttachment={handleDownloadAttachment}
            />
          )}
        </main>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. INTERACTIVE COMPOSE MODAL DIALOG                           */}
      {/* ------------------------------------------------------------- */}
      <MailComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        activeProvider={provider}
        senderName={currentEmployee.name}
        senderEmail={currentMailboxAddress}
        initialTo={composeDefaults.to}
        initialSubject={composeDefaults.subject}
        initialBody={composeDefaults.body}
        onSaveDraft={handleSaveDraft}
        onSend={handleSendEmail}
      />
    </div>
  );
}
