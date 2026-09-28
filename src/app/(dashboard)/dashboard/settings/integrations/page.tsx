'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Shield,
  Send,
  RefreshCw,
  LogOut,
  Info,
  Server,
  Paperclip,
  Clock,
  User,
  FileText,
  RotateCw,
  KeyRound,
  Globe,
  Briefcase,
  Layers,
  Play,
  Check,
  ChevronRight,
  X,
  Database,
  ListFilter,
  Activity,
} from 'lucide-react';
import { SettingsNav } from '@/components/layout/SettingsNav';
import {
  getGmailConnectionStatus,
  initiateGmailAuthorization,
  disconnectGmail,
} from '@/lib/actions/gmail';
import {
  getZohoConnectionStatus,
  initiateZohoAuthorization,
  disconnectZoho,
  testZohoApiConnectivityAction,
  syncZohoCrmAction,
  getZohoSyncHistoryAction,
} from '@/lib/actions/zoho';
import {
  sendIntegrationTestEmailAction,
  getRecentEmailLogsAction,
} from '@/lib/actions/email';
import type { GmailConnectionInfo } from '@/types/gmail';
import type {
  ZohoConnectionInfo,
  ZohoConnectivityTestResult,
  ZohoSyncResult,
  ZohoSyncHistoryItem,
  ZohoModuleType,
} from '@/types/zoho';
import type { EmailLogRecord, EmailSendResult } from '@/types/email-provider';

export default function IntegrationsSettingsPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingTestWithAttachment, setSendingTestWithAttachment] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<GmailConnectionInfo | null>(null);

  // Zoho CRM State
  const [zohoLoading, setZohoLoading] = useState(true);
  const [zohoConnecting, setZohoConnecting] = useState(false);
  const [zohoDisconnecting, setZohoDisconnecting] = useState(false);
  const [zohoInfo, setZohoInfo] = useState<ZohoConnectionInfo | null>(null);

  // Zoho CRM Extended State
  const [zohoTesting, setZohoTesting] = useState(false);
  const [zohoTestResult, setZohoTestResult] = useState<ZohoConnectivityTestResult | null>(null);
  const [zohoSyncing, setZohoSyncing] = useState(false);
  const [zohoSyncResult, setZohoSyncResult] = useState<ZohoSyncResult | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [syncHistory, setSyncHistory] = useState<ZohoSyncHistoryItem[]>([]);
  const [loadingSyncHistory, setLoadingSyncHistory] = useState(false);
  const [syncSelectedModules, setSyncSelectedModules] = useState<ZohoModuleType[]>([
    'Accounts',
    'Contacts',
    'Leads',
    'Deals',
  ]);
  const [syncDryRun, setSyncDryRun] = useState(false);

  const [testResult, setTestResult] = useState<EmailSendResult | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLogRecord[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const info = await getGmailConnectionStatus();
      setConnectionInfo(info);
    } catch (err: any) {
      console.error('Failed to load Gmail connection status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadZohoStatus = useCallback(async () => {
    setZohoLoading(true);
    try {
      const info = await getZohoConnectionStatus();
      setZohoInfo(info);
    } catch (err: any) {
      console.error('Failed to load Zoho connection status:', err);
    } finally {
      setZohoLoading(false);
    }
  }, []);

  const loadEmailLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const logs = await getRecentEmailLogsAction(15);
      setEmailLogs(logs);
    } catch (err: any) {
      console.error('Failed to load email logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadZohoStatus();
    loadEmailLogs();

    // Check URL parameters for OAuth redirects and errors
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'gmail_connected') {
      setBannerNotice({
        type: 'success',
        message: 'Gmail account (icontechpro@gmail.com) successfully authorized and connected via Google OAuth 2.0.',
      });
    } else if (success === 'zoho_connected') {
      setBannerNotice({
        type: 'success',
        message: 'Zoho CRM account successfully authorized and connected via OAuth 2.0 (Stage 1).',
      });
    } else if (error) {
      const errorMap: Record<string, string> = {
        placeholder_credentials: 'Template placeholder detected in .env.local. Please copy your actual Client ID and Client Secret from Google Cloud Console into .env.local.',
        missing_credentials: 'Both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured in .env.local to proceed.',
        missing_client_id: 'GOOGLE_CLIENT_ID is missing from .env.local. Please configure your Google OAuth Client ID.',
        missing_client_secret: 'GOOGLE_CLIENT_SECRET is missing from .env.local. Please configure your Google OAuth Client Secret.',
        google_oauth_access_denied: 'Google authorization was declined by user.',
        missing_authorization_code: 'OAuth provider did not return an authorization code. Please try connecting again.',
        missing_oauth_state: 'Security verification failed: OAuth state parameter was missing.',
        invalid_csrf_state: 'Security verification failed: OAuth state is invalid or expired (> 15 minutes). Please try connecting again.',
        server_oauth_credentials_missing: 'Server credentials missing in .env.local.',
        token_exchange_failed: 'Failed to exchange authorization code with OAuth provider.',
        missing_refresh_token_reconsent_required: 'Google did not issue a refresh token. Please click "Reconnect / Refresh Consent" to re-authorize with consent prompt.',
        callback_internal_error: 'An internal error occurred during the OAuth callback. Please inspect server logs.',
        unauthorized_role: 'Only Managing Director and Admin / BDM roles are authorized to manage integrations.',
        zoho_placeholder_credentials: 'Template placeholder detected in ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET in .env.local. Please configure valid Zoho credentials.',
        zoho_missing_client_id: 'ZOHO_CLIENT_ID is missing from .env.local.',
        zoho_missing_client_secret: 'ZOHO_CLIENT_SECRET is missing from .env.local.',
        zoho_oauth_access_denied: 'Zoho CRM authorization was declined by user.',
        zoho_token_exchange_failed: 'Failed to exchange authorization code with Zoho Accounts Server. Please check credentials in .env.local.',
        zoho_missing_refresh_token_reconsent_required: 'Zoho did not return a refresh token. Please click "Re-authorize with Consent" to obtain a refresh token.',
        zoho_callback_internal_error: 'An internal error occurred during the Zoho callback. Please check server logs.',
      };

      const friendlyMessage = errorMap[error] || `Integration authorization was not completed (${error}). Please check server credentials or re-attempt.`;
      setBannerNotice({
        type: 'error',
        message: friendlyMessage,
      });
    }
  }, [searchParams, loadStatus, loadZohoStatus, loadEmailLogs]);

  const handleConnect = async () => {
    setConnecting(true);
    setBannerNotice(null);
    try {
      const res = await initiateGmailAuthorization();
      if (res.success && res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
      } else {
        setBannerNotice({
          type: 'error',
          message: res.error || 'Failed to initiate Google authorization.',
        });
        setConnecting(false);
      }
    } catch (err: any) {
      setBannerNotice({
        type: 'error',
        message: err.message || 'Error redirecting to Google.',
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect icontechpro@gmail.com from the ERP?')) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await disconnectGmail();
      if (res.success) {
        setBannerNotice({
          type: 'info',
          message: 'Gmail integration has been disconnected. The refresh token has been purged.',
        });
        await loadStatus();
        setTestResult(null);
      } else {
        setBannerNotice({
          type: 'error',
          message: res.error || 'Failed to disconnect Gmail.',
        });
      }
    } catch (err: any) {
      setBannerNotice({
        type: 'error',
        message: err.message || 'Error disconnecting account.',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleZohoConnect = async (promptConsent = false) => {
    setZohoConnecting(true);
    setBannerNotice(null);
    try {
      const res = await initiateZohoAuthorization({ promptConsent });
      if (res.success && res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
      } else {
        setBannerNotice({
          type: 'error',
          message: res.error || 'Failed to initiate Zoho CRM authorization.',
        });
        setZohoConnecting(false);
      }
    } catch (err: any) {
      setBannerNotice({
        type: 'error',
        message: err.message || 'Error redirecting to Zoho.',
      });
      setZohoConnecting(false);
    }
  };

  const handleZohoDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Zoho CRM from the ERP?')) {
      return;
    }
    setZohoDisconnecting(true);
    try {
      const res = await disconnectZoho();
      if (res.success) {
        setBannerNotice({
          type: 'info',
          message: 'Zoho CRM integration has been disconnected. The refresh token has been purged.',
        });
        await loadZohoStatus();
      } else {
        setBannerNotice({
          type: 'error',
          message: res.error || 'Failed to disconnect Zoho CRM.',
        });
      }
    } catch (err: any) {
      setBannerNotice({
        type: 'error',
        message: err.message || 'Error disconnecting Zoho CRM.',
      });
    } finally {
      setZohoDisconnecting(false);
    }
  };

  const handleTestZohoConnection = async () => {
    setZohoTesting(true);
    setBannerNotice(null);
    try {
      const res = await testZohoApiConnectivityAction();
      setZohoTestResult(res);
      if (res.success) {
        setBannerNotice({
          type: 'success',
          message: res.message || 'Zoho CRM API connectivity verified successfully.',
        });
        await loadZohoStatus();
      } else {
        setBannerNotice({
          type: 'error',
          message: res.error || 'Failed to verify Zoho CRM API connectivity.',
        });
      }
    } catch (err: any) {
      setBannerNotice({
        type: 'error',
        message: err.message || 'An error occurred during connectivity testing.',
      });
    } finally {
      setZohoTesting(false);
    }
  };

  const handleOpenHistoryDrawer = async () => {
    setShowHistoryDrawer(true);
    setLoadingSyncHistory(true);
    try {
      const history = await getZohoSyncHistoryAction(15);
      setSyncHistory(history);
    } catch (err: any) {
      console.error('Failed to load Zoho sync history:', err);
    } finally {
      setLoadingSyncHistory(false);
    }
  };

  const handleRunZohoSync = async () => {
    setZohoSyncing(true);
    try {
      const res = await syncZohoCrmAction({
        modules: syncSelectedModules,
        dryRun: syncDryRun,
      });
      setZohoSyncResult(res);
      await loadZohoStatus();
      if (res.success) {
        setBannerNotice({
          type: 'success',
          message: res.message || 'Zoho CRM synchronization completed successfully.',
        });
      } else {
        setBannerNotice({
          type: 'error',
          message: res.error || 'Zoho CRM synchronization encountered errors.',
        });
      }
    } catch (err: any) {
      setBannerNotice({
        type: 'error',
        message: err.message || 'Failed to execute Zoho CRM synchronization.',
      });
    } finally {
      setZohoSyncing(false);
    }
  };

  const handleSendTestEmail = async (withAttachment = false) => {
    if (withAttachment) {
      setSendingTestWithAttachment(true);
    } else {
      setSendingTest(true);
    }
    setTestResult(null);

    try {
      const result = await sendIntegrationTestEmailAction({ withAttachment });
      setTestResult(result);
      if (result.success) {
        setBannerNotice({
          type: 'success',
          message: `Verification test email ${withAttachment ? 'with attachment ' : ''}dispatched successfully! Message ID: ${result.messageId}`,
        });
        await loadEmailLogs();
      } else {
        setBannerNotice({
          type: 'error',
          message: `Failed to dispatch test email: ${result.error}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Failed to send test email',
        provider: 'gmail',
      });
      setBannerNotice({
        type: 'error',
        message: err.message || 'Error sending test email.',
      });
    } finally {
      setSendingTest(false);
      setSendingTestWithAttachment(false);
    }
  };

  const isConnected = connectionInfo?.connected ?? false;
  const hasClientId = Boolean(connectionInfo?.configured_env?.has_client_id);
  const hasClientSecret = Boolean(connectionInfo?.configured_env?.has_client_secret);
  const isPlaceholder = Boolean(connectionInfo?.configured_env?.is_placeholder);
  const envReady = hasClientId && hasClientSecret && !isPlaceholder;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          External Integrations & API Gateways
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage Google Cloud OAuth 2.0 services, corporate email dispatchers, and external connectors.
        </p>
      </div>

      {/* Tabs */}
      <SettingsNav />

      {/* Banner Notice */}
      {bannerNotice && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-sm font-medium ${
            bannerNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : bannerNotice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {bannerNotice.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          {bannerNotice.type === 'error' && <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
          {bannerNotice.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
          <div className="flex-1">{bannerNotice.message}</div>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-xs opacity-60 hover:opacity-100 font-bold ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Gmail Integration Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Gmail Integration</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-medium">
                  Google Cloud OAuth 2.0
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Official corporate email dispatch gateway for quotations, tax invoices, and delivery challans.
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {loading ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking...
              </div>
            ) : isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                Not Connected
              </span>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-6">
          {/* Target Account & Parameters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Target Gmail Account
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-red-500" />
                {connectionInfo?.account_email || 'icontechpro@gmail.com'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Single authorized business sender</div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Google Cloud Project
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-brand-600" />
                icon-tech-pro-erp
              </div>
              <div className="text-[11px] text-slate-500 mt-1">ICON TECH PRO ERP</div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Approved OAuth Scope
              </div>
              <div className="text-xs font-mono font-semibold text-slate-700 mt-1 truncate">
                https://www.googleapis.com/auth/gmail.modify
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {connectionInfo?.needs_scope_upgrade ? (
                  <span className="text-amber-600 font-semibold">Send-Only active (Upgrade available)</span>
                ) : (
                  'Complete Mailbox Access & Dispatch'
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Authorized Redirect URI
              </div>
              <div className="text-xs font-mono font-semibold text-slate-700 mt-1 truncate">
                http://localhost:3000/api/integrations/gmail/callback
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                Redirect URIs section in Google Console
              </div>
            </div>
          </div>

          {/* Dedicated Google OAuth Credentials Status Panel */}
          <div className="p-5 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-brand-600" />
                Local / UAT OAuth Credentials Status (.env.local)
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                Secrets are strictly server-side and never exposed to the client
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* GOOGLE_CLIENT_ID Card */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Google OAuth Client ID
                  </div>
                  <div className="text-xs font-bold mt-1 flex items-center gap-1.5">
                    {hasClientId ? (
                      <span className="text-emerald-700 flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Client ID: Configured
                      </span>
                    ) : isPlaceholder ? (
                      <span className="text-amber-700 flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Client ID: Placeholder Detected
                      </span>
                    ) : (
                      <span className="text-rose-700 flex items-center gap-1.5 font-semibold">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Client ID: Missing
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                  GOOGLE_CLIENT_ID
                </span>
              </div>

              {/* GOOGLE_CLIENT_SECRET Card */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Google OAuth Client Secret
                  </div>
                  <div className="text-xs font-bold mt-1 flex items-center gap-1.5">
                    {hasClientSecret ? (
                      <span className="text-emerald-700 flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Client Secret: Configured (Protected)
                      </span>
                    ) : isPlaceholder ? (
                      <span className="text-amber-700 flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Client Secret: Placeholder Detected
                      </span>
                    ) : (
                      <span className="text-rose-700 flex items-center gap-1.5 font-semibold">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Client Secret: Missing
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                  GOOGLE_CLIENT_SECRET
                </span>
              </div>
            </div>

            {/* Instruction Tip */}
            {isPlaceholder ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-3 shadow-2xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <div className="font-bold text-sm text-amber-900">
                    Template Placeholder Detected in .env.local
                  </div>
                  <p className="leading-relaxed">
                    Your <code>.env.local</code> file still contains default template placeholder values (e.g. <code>your_client_id_here...</code>).
                  </p>
                  <p className="leading-relaxed font-medium">
                    1. Switch to your open browser tab: <strong>Clients – Google Auth Platform</strong>.<br />
                    2. Copy your actual <strong>Client ID</strong> and <strong>Client Secret</strong>.<br />
                    3. Paste them into <code>c:\ICON-TECH-PRO-ERP\.env.local</code> and save the file.<br />
                    4. Refresh this page to immediately enable the <strong>Connect Gmail</strong> button.
                  </p>
                </div>
              </div>
            ) : !envReady ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">Credentials Required to Enable Connect Gmail</div>
                  <p>
                    Please paste your Google OAuth <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> from your downloaded Google Cloud JSON into your local <code>.env.local</code> file.
                  </p>
                  <p className="text-[11px] text-amber-800">
                    Once saved in <code>.env.local</code>, click <strong>Refresh Status</strong> to verify and enable the <strong>Connect Gmail</strong> button.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Environment credentials verified.</strong> Both <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> are ready. Click <strong>Connect Gmail</strong> to authorize sending.
                </span>
              </div>
            )}
          </div>

          {/* Google Console Configuration Guidance */}
          <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80 text-xs space-y-2 text-blue-900">
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              Google Cloud Console Configuration Rule:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-white/80 p-2.5 rounded-lg border border-blue-200">
                <div className="font-bold text-[11px] text-blue-800">Authorized JavaScript Origins:</div>
                <div className="font-mono text-xs text-slate-800 mt-0.5 font-bold">http://localhost:3000</div>
                <div className="text-[10px] text-slate-500 mt-1">Must contain ONLY the origin without path.</div>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-blue-200">
                <div className="font-bold text-[11px] text-blue-800">Authorized Redirect URIs:</div>
                <div className="font-mono text-xs text-slate-800 mt-0.5 font-bold">http://localhost:3000/api/integrations/gmail/callback</div>
                <div className="text-[10px] text-slate-500 mt-1">Must contain the full callback path.</div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            {!isConnected ? (
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting || !envReady}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-xs transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                title={!envReady ? 'Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local to enable' : 'Connect Gmail account'}
              >
                {connecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Redirecting to Google...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Connect Gmail
                  </>
                )}
              </button>
            ) : (
              <>
                {/* Open Mailbox Button */}
                <Link
                  href="/dashboard/communication/gmail"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition duration-150"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Open Gmail Mailbox
                </Link>

                {/* Scope Upgrade Button (if currently send-only) */}
                {connectionInfo?.needs_scope_upgrade && (
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting || !envReady}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition duration-150 disabled:opacity-50"
                    title="Upgrade OAuth scope to enable mailbox reading and management"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Upgrade Mailbox Access
                  </button>
                )}

                {/* Standard Send Test Email */}
                <button
                  type="button"
                  onClick={() => handleSendTestEmail(false)}
                  disabled={sendingTest || sendingTestWithAttachment}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition duration-150 disabled:opacity-50"
                >
                  {sendingTest ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Sending Test Email...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Send Test Email
                    </>
                  )}
                </button>

                {/* Send Test Email with Attachment */}
                <button
                  type="button"
                  onClick={() => handleSendTestEmail(true)}
                  disabled={sendingTest || sendingTestWithAttachment}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition duration-150 disabled:opacity-50"
                >
                  {sendingTestWithAttachment ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Sending with Attachment...
                    </>
                  ) : (
                    <>
                      <Paperclip className="w-3.5 h-3.5" />
                      Send Test with Attachment
                    </>
                  )}
                </button>

                {/* Reconnect Button */}
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting || !envReady}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition duration-150 disabled:opacity-50 border border-slate-300"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Reconnect / Refresh Consent
                </button>

                {/* Disconnect Button */}
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-bold text-xs transition duration-150 disabled:opacity-50"
                >
                  {disconnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      Disconnect Gmail
                    </>
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                loadStatus();
                loadEmailLogs();
              }}
              disabled={loading || loadingLogs}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingLogs ? 'animate-spin' : ''}`} />
              Refresh Status
            </button>
          </div>

          {/* Test Email Details Box (Visible when connected) */}
          {isConnected && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-emerald-600" />
                UAT Verification Test Email Specification:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="font-semibold text-slate-700">From / To:</span> icontechpro@gmail.com
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Subject:</span> ICON TECH PRO ERP - Gmail Integration Test
                </div>
              </div>

              {testResult && (
                <div
                  className={`mt-2 p-3 rounded-lg border font-mono text-[11px] ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testResult.success ? (
                    <div>✓ Dispatched successfully! Message ID: {testResult.messageId}</div>
                  ) : (
                    <div>✗ Send failed: {testResult.error}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Connection Metadata (Visible when connected) */}
          {isConnected && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
              {connectionInfo?.connected_at && (
                <div>
                  <span className="font-semibold text-slate-700">Connected At:</span>{' '}
                  {new Date(connectionInfo.connected_at).toLocaleString()}
                </div>
              )}
              {connectionInfo?.connected_by && (
                <div>
                  <span className="font-semibold text-slate-700">Authorized By:</span>{' '}
                  {connectionInfo.connected_by}
                </div>
              )}
              <div className="flex items-center gap-1 text-emerald-700">
                <Shield className="w-3.5 h-3.5" /> AES-256-GCM Encrypted Token Storage Active
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zoho CRM Integration Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Zoho CRM Integration</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                  Zoho CRM v3 (Active)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Cloud CRM authorization gateway for customer accounts, contacts, and lead records.
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {zohoLoading ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking...
              </div>
            ) : zohoInfo?.connected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                Not Connected
              </span>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-6">
          {/* Target Parameters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Zoho CRM Account / Org
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5 truncate">
                <Briefcase className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="truncate">{zohoInfo?.org_name || zohoInfo?.account_identifier || 'ICON TECH PRO'}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Single tenant organization</div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Accounts Server (India DC)
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5 font-mono text-xs">
                <Server className="w-4 h-4 text-brand-600 shrink-0" />
                {zohoInfo?.configured_env?.accounts_url || 'https://accounts.zoho.in'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">ZOHO_ACCOUNTS_URL</div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                CRM API Endpoint
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5 font-mono text-xs">
                <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                {zohoInfo?.configured_env?.api_url || 'https://www.zohoapis.in'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">ZOHO_API_URL</div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Stage 1 Scopes
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5 text-xs truncate">
                <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">ZohoCRM.users.READ, ZohoCRM.org.READ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Minimum verification scope</div>
            </div>
          </div>

          {/* Environment Variables Verification Box */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Environment Configuration (.env.local)</span>
              {zohoInfo?.configured ? (
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ready
                </span>
              ) : (
                <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Action Required
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">ZOHO_CLIENT_ID</div>
                  <div className="text-[11px] text-slate-400 font-mono">OAuth 2.0 Web Application ID</div>
                </div>
                {zohoInfo?.configured_env?.has_client_id ? (
                  <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Configured
                  </span>
                ) : (
                  <span className="text-rose-700 font-bold text-[11px] flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded">
                    <XCircle className="w-3 h-3 text-rose-600" /> Missing
                  </span>
                )}
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">ZOHO_CLIENT_SECRET</div>
                  <div className="text-[11px] text-slate-400 font-mono">Server-side secret (isolated)</div>
                </div>
                {zohoInfo?.configured_env?.has_client_secret ? (
                  <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Configured
                  </span>
                ) : (
                  <span className="text-rose-700 font-bold text-[11px] flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded">
                    <XCircle className="w-3 h-3 text-rose-600" /> Missing
                  </span>
                )}
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between md:col-span-2">
                <div>
                  <div className="font-semibold text-slate-800">ZOHO_REDIRECT_URI</div>
                  <div className="text-[11px] text-slate-500 font-mono">{zohoInfo?.configured_env?.redirect_uri || 'http://localhost:3000/api/integrations/zoho/callback'}</div>
                </div>
                <span className="text-blue-700 font-bold text-[11px] bg-blue-50 px-2 py-0.5 rounded">
                  Authorized Callback
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!zohoInfo?.connected ? (
              <button
                type="button"
                onClick={() => handleZohoConnect(false)}
                disabled={zohoConnecting || !zohoInfo?.configured}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition duration-150 disabled:opacity-50"
              >
                {zohoConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Redirecting to Zoho...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Connect Zoho CRM
                  </>
                )}
              </button>
            ) : (
              <>
                {/* 1. Test Connection Button */}
                <button
                  type="button"
                  onClick={handleTestZohoConnection}
                  disabled={zohoTesting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition duration-150 disabled:opacity-50"
                  title="Test live read-only connectivity to Zoho CRM organization API"
                >
                  {zohoTesting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Probing Zoho CRM...
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5" />
                      Test Connection
                    </>
                  )}
                </button>

                {/* 2. Sync from Zoho CRM Button */}
                <button
                  type="button"
                  onClick={() => {
                    setZohoSyncResult(null);
                    setShowSyncModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition duration-150"
                  title="Synchronize Leads, Contacts, Accounts and Deals into ERP"
                >
                  <Database className="w-3.5 h-3.5" />
                  Sync from Zoho CRM
                </button>

                {/* 3. View Sync History Button */}
                <button
                  type="button"
                  onClick={handleOpenHistoryDrawer}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition duration-150 border border-slate-300"
                  title="View previous synchronization execution audit logs"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Sync History
                </button>

                {/* 4. Re-Authorize Button */}
                <button
                  type="button"
                  onClick={() => handleZohoConnect(true)}
                  disabled={zohoConnecting}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition duration-150 disabled:opacity-50 border border-slate-300"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Re-Authorize with Consent
                </button>

                {/* 5. Disconnect Button */}
                <button
                  type="button"
                  onClick={handleZohoDisconnect}
                  disabled={zohoDisconnecting}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-bold text-xs transition duration-150 disabled:opacity-50"
                >
                  {zohoDisconnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      Disconnect Zoho CRM
                    </>
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={loadZohoStatus}
              disabled={zohoLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${zohoLoading ? 'animate-spin' : ''}`} />
              Refresh Status
            </button>
          </div>

          {/* Live Connectivity Test Result Box (Visible when probe was executed) */}
          {zohoTestResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                zohoTestResult.success
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/70 border-rose-200 text-rose-900'
              }`}
            >
              <div className="font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  {zohoTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600" />
                  )}
                  Zoho CRM Live Probe Verification
                </span>
                {zohoTestResult.latencyMs !== undefined && (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/80 border border-emerald-300 text-emerald-800">
                    {zohoTestResult.latencyMs}ms latency
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed">
                {zohoTestResult.message || zohoTestResult.error}
              </p>
              {zohoTestResult.success && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2 bg-white/80 rounded border border-emerald-200">
                    <span className="font-sans text-slate-500 font-bold block text-[10px]">ORGANIZATION</span>
                    {zohoTestResult.orgName} (ID: {zohoTestResult.orgId || 'N/A'})
                  </div>
                  <div className="p-2 bg-white/80 rounded border border-emerald-200 truncate">
                    <span className="font-sans text-slate-500 font-bold block text-[10px]">AUTHORIZED USER</span>
                    <span className="truncate">{zohoTestResult.userEmail || 'N/A'}</span>
                  </div>
                  <div className="p-2 bg-white/80 rounded border border-emerald-200">
                    <span className="font-sans text-slate-500 font-bold block text-[10px]">API ENDPOINT</span>
                    {zohoTestResult.apiDomain || 'https://www.zohoapis.in'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Synchronization Summary Box */}
          {zohoInfo?.sync_summary?.last_sync_at && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-600" />
                <div>
                  <span className="font-bold text-slate-800">Last Synchronized: </span>
                  <span className="text-slate-600">
                    {new Date(zohoInfo.sync_summary.last_sync_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {zohoInfo.sync_summary.last_sync_status || 'SUCCESS'}
                </span>
                <button
                  type="button"
                  onClick={handleOpenHistoryDrawer}
                  className="text-xs text-brand-600 hover:text-brand-700 font-semibold underline flex items-center gap-1"
                >
                  View History ({zohoInfo.sync_summary.records_synced_total || 0} records synced)
                </button>
              </div>
            </div>
          )}

          {/* Connection Metadata (Visible when connected) */}
          {zohoInfo?.connected && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
              {zohoInfo?.connected_at && (
                <div>
                  <span className="font-semibold text-slate-700">Connected At:</span>{' '}
                  {new Date(zohoInfo.connected_at).toLocaleString()}
                </div>
              )}
              {zohoInfo?.last_verified_at && (
                <div>
                  <span className="font-semibold text-slate-700">Last Verified:</span>{' '}
                  {new Date(zohoInfo.last_verified_at).toLocaleString()}
                </div>
              )}
              {zohoInfo?.connected_by && (
                <div>
                  <span className="font-semibold text-slate-700">Authorized By:</span>{' '}
                  {zohoInfo.connected_by}
                </div>
              )}
              <div className="flex items-center gap-1 text-emerald-700">
                <Shield className="w-3.5 h-3.5" /> integration_credentials Single Source of Truth Active
              </div>
            </div>
          )}

          {/* Production Integration Governance Notice */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-700" />
              Production CRM Data Governance & Entity Integrity
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Controlled synchronization imports Leads, Contacts, Accounts, and Deals directly into ICON TECH PRO ERP as Customers and Enquiries with deterministic duplicate prevention. ERP remains the single authoritative master for quotations, pricing, orders, and GST invoices.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Email Activity Log Section */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Recent Email Activity Logs</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {emailLogs.length} dispatched
            </span>
          </div>
          <button
            type="button"
            onClick={loadEmailLogs}
            disabled={loadingLogs}
            className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
            Refresh Logs
          </button>
        </div>

        {emailLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No emails have been dispatched from this ERP session yet.
          </div>
        ) : (
          <>
            {/* Desktop Zero-Scroll Table */}
            <div className="hidden md:block">
              <table className="w-full text-xs text-left table-fixed">
                <colgroup>
                  <col className="w-[15%]" />
                  <col className="w-[20%]" />
                  <col className="w-[25%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Date / Time</th>
                    <th className="py-2.5 px-3">Recipient (To)</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">Entity</th>
                    <th className="py-2.5 px-3 text-center">Attach</th>
                    <th className="py-2.5 px-3">Sender</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-500 truncate">
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 truncate" title={log.to_email}>
                        {log.to_email}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 truncate" title={log.subject}>
                        {log.subject}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 truncate">
                        {log.quotation_id ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            <FileText className="w-3 h-3" /> Quotation
                          </span>
                        ) : log.invoice_id ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <FileText className="w-3 h-3" /> Invoice
                          </span>
                        ) : log.entity_type === 'test' ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            Verification Test
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {log.has_attachments ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <Paperclip className="w-3 h-3" />
                            {log.attachment_count}
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 truncate">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{log.sent_by_user_name || 'System'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {log.status === 'SENT' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            SENT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800" title={log.error_message}>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            FAILED
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Zero-Scroll Cards */}
            <div className="block md:hidden space-y-3 p-3">
              {emailLogs.map((log) => (
                <div key={log.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-900 text-xs truncate max-w-[70%]" title={log.to_email}>
                      {log.to_email}
                    </span>
                    {log.status === 'SENT' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        SENT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        FAILED
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-700 font-medium">
                    {log.subject}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/70">
                    <span>
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>By: {log.sent_by_user_name || 'System'}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Production Preparation Notice Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-900 flex items-center gap-2 text-sm">
          <Shield className="w-4 h-4 text-brand-600" />
          Production Preparation & Security Rotation Protocol
        </div>
        <p>
          The current configuration uses the UAT/local Google OAuth Client. Before deploying this integration to production, execute the following security rotation:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-slate-600">
          <li>Create or rotate a dedicated production Google OAuth Client Secret in Google Cloud Console.</li>
          <li>Register the permanent production HTTPS redirect URI (e.g. <code>https://&lt;domain&gt;/api/integrations/gmail/callback</code>).</li>
          <li>Remove <code>http://localhost:3000</code> from the production OAuth client&apos;s authorized URIs.</li>
          <li>Ensure <code>GMAIL_TOKEN_ENCRYPTION_KEY</code> is generated as a cryptographically strong 32-byte hexadecimal secret.</li>
          <li>Verify that only Managing Director and Admin / BDM roles can initiate or modify integration credentials.</li>
        </ul>
      </div>

      {/* Zoho CRM Controlled Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Synchronize Zoho CRM</h3>
                  <p className="text-[11px] text-slate-500">Inbound ingestion to ICON TECH PRO ERP</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!zohoSyncing) setShowSyncModal(false);
                }}
                disabled={zohoSyncing}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="text-slate-600 leading-relaxed">
                Select the Zoho CRM modules to synchronize. Records will be mapped to ERP Customers and Enquiries with deterministic duplicate prevention.
              </div>

              {/* Module Selection Checkboxes */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Modules to Synchronize:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Accounts', 'Contacts', 'Leads', 'Deals'] as ZohoModuleType[]).map((mod) => {
                    const isSelected = syncSelectedModules.includes(mod);
                    return (
                      <label
                        key={mod}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                          isSelected
                            ? 'bg-amber-50/60 border-amber-300 text-amber-950'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={zohoSyncing}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSyncSelectedModules([...syncSelectedModules, mod]);
                            } else {
                              setSyncSelectedModules(syncSelectedModules.filter((m) => m !== mod));
                            }
                          }}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>{mod}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Dry Run Toggle */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncDryRun}
                  disabled={zohoSyncing}
                  onChange={(e) => setSyncDryRun(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <span className="font-bold text-slate-900 block">Dry Run / Simulation Mode</span>
                  <span className="text-[11px] text-slate-500">
                    Probes records and evaluates duplicate matching without committing writes to the database.
                  </span>
                </div>
              </label>

              {/* Sync Results View (when finished) */}
              {zohoSyncResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2 ${
                    zohoSyncResult.success
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50/80 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>
                      {zohoSyncResult.success ? '✓ Synchronization Succeeded' : '✗ Synchronization Encountered Errors'}
                    </span>
                    <span className="font-mono text-[11px] font-normal">{zohoSyncResult.durationMs}ms</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-[11px] pt-1">
                    <div className="bg-white/80 p-1.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-sans">READ</span>
                      <strong>{zohoSyncResult.totalRead}</strong>
                    </div>
                    <div className="bg-white/80 p-1.5 rounded border border-emerald-200 text-emerald-700">
                      <span className="text-[10px] text-slate-500 block font-sans">CREATED</span>
                      <strong>{zohoSyncResult.totalCreated}</strong>
                    </div>
                    <div className="bg-white/80 p-1.5 rounded border border-blue-200 text-blue-700">
                      <span className="text-[10px] text-slate-500 block font-sans">UPDATED</span>
                      <strong>{zohoSyncResult.totalUpdated}</strong>
                    </div>
                    <div className="bg-white/80 p-1.5 rounded border border-slate-200 text-slate-600">
                      <span className="text-[10px] text-slate-500 block font-sans">SKIPPED</span>
                      <strong>{zohoSyncResult.totalSkipped}</strong>
                    </div>
                    <div className="bg-white/80 p-1.5 rounded border border-rose-200 text-rose-700">
                      <span className="text-[10px] text-slate-500 block font-sans">FAILED</span>
                      <strong>{zohoSyncResult.totalFailed}</strong>
                    </div>
                  </div>
                  {zohoSyncResult.message && (
                    <p className="text-[11px] text-slate-600 mt-1">{zohoSyncResult.message}</p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                disabled={zohoSyncing}
                className="px-4 py-2 rounded-xl text-slate-700 hover:bg-slate-200 text-xs font-semibold"
              >
                {zohoSyncResult ? 'Close' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleRunZohoSync}
                disabled={zohoSyncing || syncSelectedModules.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition duration-150 disabled:opacity-50"
              >
                {zohoSyncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Synchronizing...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    {syncDryRun ? 'Simulate Sync' : 'Execute Sync'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoho CRM Sync History Drawer / Modal */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Drawer Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Zoho CRM Sync Audit History</h3>
                  <p className="text-[11px] text-slate-500">Persistent execution logs from integration_sync_logs</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Table Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {loadingSyncHistory ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                  Loading synchronization logs...
                </div>
              ) : syncHistory.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No synchronization runs recorded yet.
                </div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="py-2 px-3">Date / Time</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-center">Read</th>
                      <th className="py-2 px-3 text-center">Created</th>
                      <th className="py-2 px-3 text-center">Updated</th>
                      <th className="py-2 px-3 text-center">Skipped</th>
                      <th className="py-2 px-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {syncHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {new Date(item.started_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-sans text-[11px] capitalize text-slate-700">
                            {item.sync_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'PARTIAL'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">{item.records_read}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-700">{item.records_created}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-blue-700">{item.records_updated}</td>
                        <td className="py-2.5 px-3 text-center text-slate-500">{item.records_skipped}</td>
                        <td className="py-2.5 px-3 text-slate-500">{item.duration_ms ? `${item.duration_ms}ms` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
