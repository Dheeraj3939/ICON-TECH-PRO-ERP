import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { IEmailProvider, EmailMessage, EmailSendResult } from '@/types/email-provider';
import { defaultZohoProvider, ZohoProvider } from './zoho-provider';
import { defaultGmailProvider, GmailProvider } from './gmail-provider';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';

export interface EmailDispatchAttempt {
  provider: string;
  timestamp: string;
  success: boolean;
  error?: string;
  statusCode?: number;
  qualifyingForFailover?: boolean;
}

export interface FailoverSendResult extends EmailSendResult {
  correlationId: string;
  primaryProvider: string;
  fallbackUsed: boolean;
  attempts: EmailDispatchAttempt[];
  duplicatePrevented?: boolean;
}

export interface ProviderHealthReport {
  primary: { name: string; configured: boolean; operational: boolean };
  fallback: { name: string; configured: boolean; operational: boolean };
  activeMode: 'PRIMARY_ZOHO' | 'FALLBACK_GMAIL' | 'ALL_UNAVAILABLE';
}

declare global {
  // eslint-disable-next-line no-var
  var __ICON_EMAIL_IDEMPOTENCY_STORE__: Map<string, {
    result: FailoverSendResult;
    sentAt: string;
    expiresAt: number;
  }> | undefined;
}

const DURABLE_STATE_DIR = process.env.ICON_DURABLE_STATE_DIR || path.join(process.cwd(), '.icon_durable_state');
const DURABLE_EMAIL_STORE_FILE =
  process.env.EMAIL_IDEMPOTENCY_STORE_PATH || path.join(DURABLE_STATE_DIR, 'email_idempotency.json');

/**
 * Loads durable email idempotency records from disk.
 * Survives application restarts and coordinates deduplication across Node worker processes.
 */
export function loadDurableEmailIdempotency(): Map<string, { result: FailoverSendResult; sentAt: string; expiresAt: number }> {
  const store = new Map<string, { result: FailoverSendResult; sentAt: string; expiresAt: number }>();
  try {
    if (fs.existsSync(DURABLE_EMAIL_STORE_FILE)) {
      const raw = fs.readFileSync(DURABLE_EMAIL_STORE_FILE, 'utf8');
      const data = JSON.parse(raw) as Record<string, { result: FailoverSendResult; sentAt: string; expiresAt: number }>;
      const now = Date.now();
      for (const [key, val] of Object.entries(data)) {
        if (val.expiresAt > now) {
          store.set(key, val);
        }
      }
    }
  } catch {}
  return store;
}

/**
 * Atomically saves an idempotency record to the durable disk store and in-memory cache.
 */
export function saveDurableEmailIdempotency(
  key: string,
  entry: { result: FailoverSendResult; sentAt: string; expiresAt: number }
): void {
  const store = getIdempotencyStore();
  store.set(key, entry);

  try {
    if (!fs.existsSync(DURABLE_STATE_DIR)) {
      fs.mkdirSync(DURABLE_STATE_DIR, { recursive: true });
    }
    const serializable: Record<string, { result: FailoverSendResult; sentAt: string; expiresAt: number }> = {};
    for (const [k, v] of store.entries()) {
      if (v.expiresAt > Date.now()) {
        serializable[k] = v;
      }
    }
    const tempFile = `${DURABLE_EMAIL_STORE_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(serializable, null, 2), 'utf8');
    fs.renameSync(tempFile, DURABLE_EMAIL_STORE_FILE);
  } catch {}
}

export function clearDurableEmailIdempotencyStore(): void {
  if (globalThis.__ICON_EMAIL_IDEMPOTENCY_STORE__) {
    globalThis.__ICON_EMAIL_IDEMPOTENCY_STORE__.clear();
  }
  try {
    if (fs.existsSync(DURABLE_EMAIL_STORE_FILE)) {
      fs.unlinkSync(DURABLE_EMAIL_STORE_FILE);
    }
  } catch {}
}

export function getIdempotencyStore() {
  if (!globalThis.__ICON_EMAIL_IDEMPOTENCY_STORE__) {
    globalThis.__ICON_EMAIL_IDEMPOTENCY_STORE__ = loadDurableEmailIdempotency();
  }
  return globalThis.__ICON_EMAIL_IDEMPOTENCY_STORE__;
}

/**
 * Enterprise Failover Email Provider for ICON TECH PRO ERP V9.2.
 * Primary: Zoho Mail Enterprise API
 * Fallback: Google Workspace / Gmail API
 * Implements controlled, non-blind failover, idempotency protection, and correlation tracking.
 */
export class FailoverEmailProvider implements IEmailProvider {
  readonly name = 'failover_zoho_gmail';
  private primary: IEmailProvider;
  private fallback: IEmailProvider;

  constructor(primary?: IEmailProvider, fallback?: IEmailProvider) {
    this.primary = primary || defaultZohoProvider;
    this.fallback = fallback || defaultGmailProvider;
  }

  /**
   * Determine if an error is a qualifying transport/system failure that warrants fallback.
   * Non-qualifying errors (e.g. malformed email address, invalid message content) must NOT fail over.
   */
  public isQualifyingFailure(errorMsg?: string, statusCode?: number): boolean {
    if (!errorMsg) return false;
    const msg = errorMsg.toLowerCase();

    // 1. Permanent content / recipient errors -> DO NOT FAILOVER
    if (
      msg.includes('invalid_recipient') ||
      msg.includes('malformed') ||
      msg.includes('syntax') ||
      msg.includes('no recipient') ||
      msg.includes('recipient rejected') ||
      msg.includes('empty subject') ||
      msg.includes('body missing')
    ) {
      return false;
    }

    // 2. Qualifying system/network/auth errors -> SAFE TO FAILOVER
    if (
      msg.includes('timeout') ||
      msg.includes('etimedout') ||
      msg.includes('esockettimedout') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('econnreset') ||
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('rate limit') ||
      msg.includes('429') ||
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes('service unavailable') ||
      msg.includes('auth') ||
      msg.includes('401') ||
      msg.includes('token') ||
      msg.includes('unauthorized') ||
      (statusCode !== undefined && (statusCode === 401 || statusCode === 429 || statusCode >= 500))
    ) {
      return true;
    }

    return true; // Default to qualifying for unexpected provider failures
  }

  /**
   * Generates a deterministic idempotency key for the message.
   */
  public generateIdempotencyKey(message: EmailMessage): string {
    const toStr = Array.isArray(message.to) ? message.to.slice().sort().join(',') : message.to;
    const entityKey = message.metadata?.entityId
      ? `${message.metadata.entityType || 'msg'}:${message.metadata.entityId}`
      : null;

    const contentHash = crypto
      .createHash('sha256')
      .update(`${toStr}|${message.subject}|${message.text || ''}|${message.html || ''}`)
      .digest('hex');

    return entityKey ? `${entityKey}:${contentHash.substring(0, 16)}` : contentHash;
  }

  async isConfigured(): Promise<boolean> {
    const pConf = await this.primary.isConfigured().catch(() => false);
    const fConf = await this.fallback.isConfigured().catch(() => false);
    return pConf || fConf;
  }

  /**
   * Health report of primary and fallback providers.
   */
  async getHealth(): Promise<ProviderHealthReport> {
    const pConf = await this.primary.isConfigured().catch(() => false);
    const fConf = await this.fallback.isConfigured().catch(() => false);

    let activeMode: ProviderHealthReport['activeMode'] = 'ALL_UNAVAILABLE';
    if (pConf) {
      activeMode = 'PRIMARY_ZOHO';
    } else if (fConf) {
      activeMode = 'FALLBACK_GMAIL';
    }

    return {
      primary: { name: this.primary.name, configured: pConf, operational: pConf },
      fallback: { name: this.fallback.name, configured: fConf, operational: fConf },
      activeMode,
    };
  }

  /**
   * Dispatches email with controlled primary Zoho -> fallback Gmail routing.
   * Prevents duplicates, records attempts, correlation ID and outcome.
   */
  async sendEmail(message: EmailMessage): Promise<FailoverSendResult> {
    const correlationId =
      (message.metadata as any)?.correlationId ||
      `corr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const idempotencyKey = this.generateIdempotencyKey(message);
    const store = getIdempotencyStore();

    // 1. Authoritative Database-Backed Idempotency Check
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data: dbEntry } = await admin
          .from('email_idempotency_records')
          .select('*')
          .eq('idempotency_key', idempotencyKey)
          .single();

        if (dbEntry) {
          if (dbEntry.status === 'SENT' && dbEntry.response_payload) {
            return {
              ...(dbEntry.response_payload as FailoverSendResult),
              duplicatePrevented: true,
            };
          }
          if (dbEntry.status === 'IN_FLIGHT') {
            const ageMs = Date.now() - new Date(dbEntry.created_at).getTime();
            if (ageMs < 120000) {
              return {
                success: false,
                provider: dbEntry.provider || this.primary.name,
                error: 'DISPATCH_IN_FLIGHT: Email dispatch already in progress by another worker.',
                correlationId: dbEntry.correlation_id,
                primaryProvider: dbEntry.primary_provider,
                fallbackUsed: dbEntry.fallback_used,
                attempts: [],
                duplicatePrevented: true,
              };
            }
          }
        } else {
          // Reserve the key atomically in PostgreSQL to lock concurrent requests
          await admin.from('email_idempotency_records').insert([
            {
              idempotency_key: idempotencyKey,
              correlation_id: correlationId,
              provider: this.primary.name,
              primary_provider: this.primary.name,
              status: 'IN_FLIGHT',
            },
          ]);
        }
      } catch {
        // Fall through to local durable check if DB table is initializing
      }
    }

    // 2. Local Durable Cache Check (Supplementary for offline and within-worker speed)
    const existing = store.get(idempotencyKey);
    if (existing && existing.expiresAt > Date.now() && existing.result.success) {
      return {
        ...existing.result,
        duplicatePrevented: true,
      };
    }

    const attempts: EmailDispatchAttempt[] = [];

    // 2. Primary Dispatch Attempt: Zoho Mail Enterprise
    let primaryResult: EmailSendResult;
    try {
      primaryResult = await this.primary.sendEmail(message);
    } catch (err: any) {
      primaryResult = {
        success: false,
        provider: this.primary.name,
        error: err.message || 'Primary provider dispatch exception',
      };
    }

    attempts.push({
      provider: this.primary.name,
      timestamp: new Date().toISOString(),
      success: primaryResult.success,
      error: primaryResult.error,
      qualifyingForFailover: primaryResult.success
        ? false
        : this.isQualifyingFailure(primaryResult.error),
    });

    // If Primary succeeded, record and return immediately
    if (primaryResult.success) {
      const finalResult: FailoverSendResult = {
        success: true,
        messageId: primaryResult.messageId || `zm_${Date.now()}`,
        threadId: primaryResult.threadId,
        provider: this.primary.name,
        sentAt: primaryResult.sentAt || new Date().toISOString(),
        correlationId,
        primaryProvider: this.primary.name,
        fallbackUsed: false,
        attempts,
      };

      saveDurableEmailIdempotency(idempotencyKey, {
        result: finalResult,
        sentAt: finalResult.sentAt!,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24-hour deduplication window
      });

      if (await isSupabaseAvailable()) {
        try {
          const admin = createAdminClient();
          await admin.from('email_idempotency_records').upsert([
            {
              idempotency_key: idempotencyKey,
              correlation_id: correlationId,
              provider: finalResult.provider,
              primary_provider: finalResult.primaryProvider,
              fallback_used: finalResult.fallbackUsed,
              message_id: finalResult.messageId,
              thread_id: finalResult.threadId,
              status: 'SENT',
              response_payload: finalResult,
              attempts: finalResult.attempts,
            },
          ]);
        } catch {}
      }

      return finalResult;
    }

    // 3. Evaluate if error qualifies for fallback
    const qualifies = this.isQualifyingFailure(primaryResult.error);
    if (!qualifies) {
      // Non-qualifying permanent error (e.g. malformed recipient) -> do not attempt fallback
      return {
        success: false,
        provider: this.primary.name,
        error: `PRIMARY_PERMANENT_ERROR: ${primaryResult.error} (Failover bypassed for non-qualifying error).`,
        correlationId,
        primaryProvider: this.primary.name,
        fallbackUsed: false,
        attempts,
      };
    }

    // 4. Controlled Failover to Fallback Provider: Google Workspace / Gmail
    let fallbackResult: EmailSendResult;
    try {
      fallbackResult = await this.fallback.sendEmail(message);
    } catch (fallbackErr: any) {
      fallbackResult = {
        success: false,
        provider: this.fallback.name,
        error: fallbackErr.message || 'Fallback provider dispatch exception',
      };
    }

    attempts.push({
      provider: this.fallback.name,
      timestamp: new Date().toISOString(),
      success: fallbackResult.success,
      error: fallbackResult.error,
    });

    if (fallbackResult.success) {
      const finalResult: FailoverSendResult = {
        success: true,
        messageId: fallbackResult.messageId || `gm_${Date.now()}`,
        threadId: fallbackResult.threadId,
        provider: this.fallback.name,
        sentAt: fallbackResult.sentAt || new Date().toISOString(),
        correlationId,
        primaryProvider: this.primary.name,
        fallbackUsed: true,
        attempts,
      };

      saveDurableEmailIdempotency(idempotencyKey, {
        result: finalResult,
        sentAt: finalResult.sentAt!,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });

      if (await isSupabaseAvailable()) {
        try {
          const admin = createAdminClient();
          await admin.from('email_idempotency_records').upsert([
            {
              idempotency_key: idempotencyKey,
              correlation_id: correlationId,
              provider: finalResult.provider,
              primary_provider: finalResult.primaryProvider,
              fallback_used: finalResult.fallbackUsed,
              message_id: finalResult.messageId,
              thread_id: finalResult.threadId,
              status: 'SENT',
              response_payload: finalResult,
              attempts: finalResult.attempts,
            },
          ]);
        } catch {}
      }

      return finalResult;
    }

    // Both Primary and Fallback failed
    return {
      success: false,
      provider: 'FAILOVER_EXHAUSTED',
      error: `All dispatch providers failed. Primary (${this.primary.name}): ${primaryResult.error}. Fallback (${this.fallback.name}): ${fallbackResult.error}.`,
      correlationId,
      primaryProvider: this.primary.name,
      fallbackUsed: true,
      attempts,
    };
  }
}

export const defaultFailoverEmailProvider = new FailoverEmailProvider();
