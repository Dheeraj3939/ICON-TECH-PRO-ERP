/**
 * ICON TECH PRO ERP V9.2 — Enterprise Central Audit Logging Engine
 * Tamper-evident, hash-chained ledger supporting 4 standard categories:
 * - EMPLOYEE_ACTIVITY
 * - BUSINESS_AUDIT (with before-and-after diffs)
 * - SECURITY_EVENT
 * - SYSTEM_EVENT
 * Includes SHA-256 cryptographic chaining, sensitive data redaction,
 * 5-year retention tagging, and legal hold controls.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  EnterpriseAuditRecord,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
  AuditRetentionCategory,
  AuditFieldDiff,
  AuditCheckpointRecord,
  AuditFilterParams,
} from '@/types/security';

export type { AuditCategory };
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_ENTERPRISE_AUDIT_LEDGER__: EnterpriseAuditRecord[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_AUDIT_CHECKPOINTS__: AuditCheckpointRecord[] | undefined;
}

const GENESIS_PREVIOUS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'confirmpassword',
  'token',
  'recovery_token',
  'mfa_secret',
  'secret',
  'backup_code',
  'backup_codes',
  'totp_code',
  'authorization',
  'cookie',
  'session_token',
  'hmac_secret',
  'api_key',
  'client_secret',
  'private_key',
  'supplier_cost',
  'purchase_price',
  'supplier_price',
  'internal_remarks',
  'engineer_remarks',
  'internal_margin',
  'aadhaar',
  'pan_number',
  'pan',
  'bank_account',
  'bank_account_number',
  'ifsc_code',
  'access_token',
  'refresh_token',
  'oauth_token',
  'password_hash',
  'salt',
]);

/**
 * Automatically recurses through an object and replaces sensitive fields with [REDACTED].
 */
export function redactSensitiveData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (SENSITIVE_FIELD_NAMES.has(lowerKey)) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = redactSensitiveData(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Computes structured diff between before and after snapshots.
 */
export function computeFieldDiff(
  oldObj: Record<string, any> | null | undefined,
  newObj: Record<string, any> | null | undefined
): AuditFieldDiff[] {
  if (!oldObj && !newObj) return [];
  const diffs: AuditFieldDiff[] = [];
  const keys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

  for (const key of keys) {
    const oldVal = oldObj ? oldObj[key] : undefined;
    const newVal = newObj ? newObj[key] : undefined;

    // Redact sensitive keys
    const lowerKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (SENSITIVE_FIELD_NAMES.has(lowerKey)) {
      if (oldVal !== newVal) {
        diffs.push({
          field: key,
          field_label: formatFieldLabel(key),
          old_value: '[REDACTED]',
          new_value: '[REDACTED]',
        });
      }
      continue;
    }

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({
        field: key,
        field_label: formatFieldLabel(key),
        old_value: oldVal === undefined ? null : oldVal,
        new_value: newVal === undefined ? null : newVal,
      });
    }
  }

  return diffs;
}

function formatFieldLabel(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Computes cryptographic SHA-256 hash chaining.
 */
export function computeRecordHash(
  previousHash: string,
  eventId: string,
  timestamp: string,
  category: string,
  action: string,
  employeeId: string,
  payload: any
): string {
  const content = `${previousHash}|${eventId}|${timestamp}|${category}|${action}|${employeeId}|${JSON.stringify(payload)}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Retrieve the active in-memory audit ledger.
 */
export function getEnterpriseLedgerStore(): EnterpriseAuditRecord[] {
  if (!globalThis.__ICON_ENTERPRISE_AUDIT_LEDGER__) {
    globalThis.__ICON_ENTERPRISE_AUDIT_LEDGER__ = [];
  }
  return globalThis.__ICON_ENTERPRISE_AUDIT_LEDGER__;
}

/**
 * Retrieve the in-memory checkpoints store.
 */
export function getAuditCheckpointsStore(): AuditCheckpointRecord[] {
  if (!globalThis.__ICON_AUDIT_CHECKPOINTS__) {
    globalThis.__ICON_AUDIT_CHECKPOINTS__ = [];
  }
  return globalThis.__ICON_AUDIT_CHECKPOINTS__;
}

const LOCK_DIR = process.env.ICON_LOCK_DIR || path.join(process.cwd(), '.icon_locks');
const DURABLE_STATE_DIR = process.env.ICON_DURABLE_STATE_DIR || path.join(process.cwd(), '.icon_durable_state');
const SHARED_LEDGER_FILE = process.env.AUDIT_SHARED_LEDGER_PATH || path.join(DURABLE_STATE_DIR, 'enterprise_audit_ledger.json');

/**
 * Cross-process distributed lock using atomic OS primitives.
 * Serializes writes across separate Node.js processes, workers, and application instances.
 */
export async function withDistributedLock<T>(
  lockName: string,
  operation: () => Promise<T>,
  options: { timeoutMs?: number; retryIntervalMs?: number; staleThresholdMs?: number } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15000;
  const retryIntervalMs = options.retryIntervalMs ?? 25;
  const staleThresholdMs = options.staleThresholdMs ?? 10000;

  if (!fs.existsSync(LOCK_DIR)) {
    try {
      fs.mkdirSync(LOCK_DIR, { recursive: true });
    } catch {}
  }

  const lockFile = path.join(LOCK_DIR, `${lockName}.lock`);
  const startTime = Date.now();
  let acquired = false;
  let fd: number | null = null;

  while (Date.now() - startTime < timeoutMs) {
    try {
      // 'wx' flag: open for writing, fails if file exists (atomic on POSIX and Windows)
      fd = fs.openSync(lockFile, 'wx');
      fs.writeSync(fd, `${process.pid}|${Date.now()}`);
      acquired = true;
      break;
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        try {
          const stats = fs.statSync(lockFile);
          if (Date.now() - stats.mtimeMs > staleThresholdMs) {
            try {
              fs.unlinkSync(lockFile);
            } catch {}
          }
        } catch {}
        const jitter = Math.floor(Math.random() * 20);
        await new Promise((resolve) => setTimeout(resolve, retryIntervalMs + jitter));
      } else {
        throw err;
      }
    }
  }

  if (!acquired) {
    throw new Error(`Timeout waiting for distributed lock '${lockName}' after ${timeoutMs}ms`);
  }

  try {
    return await operation();
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
    try {
      fs.unlinkSync(lockFile);
    } catch {}
  }
}

/**
 * Loads shared audit ledger from disk if present to synchronize across processes.
 */
export function loadSharedLedger(): EnterpriseAuditRecord[] {
  try {
    if (fs.existsSync(SHARED_LEDGER_FILE)) {
      const data = fs.readFileSync(SHARED_LEDGER_FILE, 'utf8');
      const records = JSON.parse(data) as EnterpriseAuditRecord[];
      if (Array.isArray(records)) {
        globalThis.__ICON_ENTERPRISE_AUDIT_LEDGER__ = records;
        return records;
      }
    }
  } catch {}
  return getEnterpriseLedgerStore();
}

/**
 * Persists shared audit ledger to disk atomically.
 */
export function saveSharedLedger(records: EnterpriseAuditRecord[]): void {
  try {
    if (!fs.existsSync(DURABLE_STATE_DIR)) {
      fs.mkdirSync(DURABLE_STATE_DIR, { recursive: true });
    }
    const tempFile = `${SHARED_LEDGER_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(records, null, 2), 'utf8');
    fs.renameSync(tempFile, SHARED_LEDGER_FILE);
  } catch {}
}

let auditWriteQueue: Promise<any> = Promise.resolve();

/**
 * Primary Enterprise Central Audit Logging Function.
 * Serializes writes to guarantee linear SHA-256 chaining and fork prevention under concurrent execution.
 * Coordinates across processes via OS-level atomic distributed locking and PostgreSQL advisory lock.
 */
export async function logEnterpriseAudit(params: {
  employeeId?: string;
  userName?: string;
  role?: string;
  category: AuditCategory;
  severity?: AuditSeverity;
  module: string;
  action: string;
  recordType?: string;
  recordId?: string;
  relatedContext?: string;
  previousValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  reason?: string;
  outcome?: AuditOutcome;
  correlationId?: string;
  sourceIp?: string;
  deviceBrowser?: string;
  retentionCategory?: AuditRetentionCategory;
  legalHold?: boolean;
  mandatory?: boolean;
}): Promise<EnterpriseAuditRecord> {
  const executeWrite = async (): Promise<EnterpriseAuditRecord> => {
    return await withDistributedLock('enterprise_audit_ledger', async () => {
      // Synchronize with shared durable ledger store across processes
      const store = loadSharedLedger();
      const now = new Date();
      const timestamp = now.toISOString();

      // Head hash of the chain: if store is empty, uses GENESIS_PREVIOUS_HASH
      const previousHash = store.length > 0 ? store[0].integrity_hash : GENESIS_PREVIOUS_HASH;

      const eventId = `AUD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const employeeId = params.employeeId || 'SYSTEM';
      const userName = params.userName || 'System Engine';
      const role = params.role || 'System';
      const severity = params.severity || (params.category === 'SECURITY_EVENT' ? 'SECURITY' : 'INFO');
      const outcome = params.outcome || 'SUCCESS';
      const recordType = params.recordType || params.module;
      const recordId = params.recordId || eventId;
      const retentionCategory: AuditRetentionCategory =
        params.retentionCategory ||
        (params.category === 'BUSINESS_AUDIT' ? 'COMMERCIAL' : params.category === 'SECURITY_EVENT' ? 'AUDIT' : 'SYSTEM');

      const cleanPrevious = params.previousValues ? redactSensitiveData(params.previousValues) : null;
      const cleanNew = params.newValues ? redactSensitiveData(params.newValues) : null;
      const diff = computeFieldDiff(cleanPrevious, cleanNew);

      const payloadForHash = {
        recordType,
        recordId,
        reason: params.reason || null,
        outcome,
        diff,
        previous: cleanPrevious,
        new: cleanNew,
      };

      const integrityHash = computeRecordHash(
        previousHash,
        eventId,
        timestamp,
        params.category,
        params.action,
        employeeId,
        payloadForHash
      );

      const record: EnterpriseAuditRecord = {
        event_id: eventId,
        timestamp,
        timezone: 'Asia/Kolkata (IST)',
        employee_id: employeeId,
        user_name: userName,
        role,
        category: params.category,
        severity,
        module: params.module,
        action: params.action,
        record_type: recordType,
        record_id: recordId,
        related_context: params.relatedContext,
        previous_values: cleanPrevious,
        new_values: cleanNew,
        diff,
        reason: params.reason,
        outcome,
        correlation_id: params.correlationId,
        source_ip: params.sourceIp || '127.0.0.1',
        device_browser: params.deviceBrowser || 'ERP Internal / Chrome 124',
        previous_hash: previousHash,
        integrity_hash: integrityHash,
        retention_category: retentionCategory,
        legal_hold: Boolean(params.legalHold),
      };

      // Prepend to in-memory and shared stores so newest is first in query, but preserve chain link
      store.unshift(record);
      globalThis.__ICON_ENTERPRISE_AUDIT_LEDGER__ = store;
      saveSharedLedger(store);

      // If Supabase is online, persist via authoritative atomic stored procedure with PostgreSQL advisory lock
      if (await isSupabaseAvailable()) {
        try {
          const admin = createAdminClient();
          const { data, error } = await admin.rpc('fn_insert_audit_entry_atomic', {
            p_event_id: record.event_id,
            p_timestamp: record.timestamp,
            p_timezone: record.timezone,
            p_employee_id: record.employee_id,
            p_user_name: record.user_name,
            p_role: record.role,
            p_category: record.category,
            p_severity: record.severity,
            p_module: record.module,
            p_action: record.action,
            p_record_type: record.record_type,
            p_record_id: record.record_id,
            p_related_context: record.related_context,
            p_previous_values: record.previous_values,
            p_new_values: record.new_values,
            p_diff: record.diff,
            p_reason: record.reason,
            p_outcome: record.outcome,
            p_correlation_id: record.correlation_id,
            p_source_ip: record.source_ip,
            p_device_browser: record.device_browser,
            p_retention_category: record.retention_category,
            p_legal_hold: record.legal_hold,
            p_integrity_hash: record.integrity_hash,
          });

          if (error) {
            if (params.mandatory && isProductionRuntime()) {
              throw new Error(`MANDATORY_AUDIT_PERSISTENCE_FAILURE: Authoritative audit persistence failed: ${error.message}`);
            }
            console.warn('Database atomic audit append returned error, stored in local durable ledger:', error.message);
          } else if (data) {
            // Synchronize returned record from database
            record.previous_hash = data.previous_hash || record.previous_hash;
            record.integrity_hash = data.integrity_hash || record.integrity_hash;
          }
        } catch (err) {
          if (params.mandatory && isProductionRuntime()) {
            throw new Error(`MANDATORY_AUDIT_PERSISTENCE_FAILURE: Authoritative audit persistence threw exception: ${err}`);
          }
          console.warn('Supabase enterprise_audit_ledger RPC failed, stored in durable ledger:', err);
        }
      }

      return record;
    });
  };

  const nextWrite = auditWriteQueue.then(executeWrite, executeWrite);
  auditWriteQueue = nextWrite;
  return nextWrite;
}

/**
 * Filtered query function for the Central Audit Centre.
 */
export async function queryEnterpriseAuditLedger(
  params?: AuditFilterParams
): Promise<{ records: EnterpriseAuditRecord[]; total: number; page: number; limit: number }> {
  const page = params?.page || 1;
  const limit = params?.limit || 50;

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      let query = admin
        .from('enterprise_audit_ledger')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false });

      if (params?.category && params.category !== 'ALL') query = query.eq('category', params.category);
      if (params?.module && params.module !== 'ALL') query = query.ilike('module', params.module);
      if (params?.severity && params.severity !== 'ALL') query = query.eq('severity', params.severity);
      if (params?.action) query = query.ilike('action', `%${params.action}%`);
      if (params?.employee_id) query = query.eq('employee_id', params.employee_id);
      if (params?.role) query = query.eq('role', params.role);
      if (params?.record_type) query = query.eq('record_type', params.record_type);
      if (params?.record_id) query = query.eq('record_id', params.record_id);
      if (params?.legal_hold_only) query = query.eq('legal_hold', true);
      if (params?.start_date) query = query.gte('timestamp', params.start_date);
      if (params?.end_date) query = query.lte('timestamp', params.end_date);
      if (params?.search) {
        const q = params.search.replace(/[,%()]/g, ' ').trim();
        if (q) {
          query = query.or(
            `user_name.ilike.%${q}%,action.ilike.%${q}%,module.ilike.%${q}%,record_id.ilike.%${q}%,reason.ilike.%${q}%`
          );
        }
      }

      const startIndex = (page - 1) * limit;
      const { data, error, count } = await query.range(startIndex, startIndex + limit - 1);
      if (!error && data) {
        return {
          records: data as EnterpriseAuditRecord[],
          total: count ?? data.length,
          page,
          limit,
        };
      }
    } catch (err) {
      console.warn('Supabase queryEnterpriseAuditLedger warning:', err);
    }
  }

  let records = [...getEnterpriseLedgerStore()];

  if (params?.category && params.category !== 'ALL') {
    records = records.filter((r) => r.category === params.category);
  }
  if (params?.module && params.module !== 'ALL') {
    const mod = params.module.toLowerCase();
    records = records.filter((r) => r.module.toLowerCase() === mod);
  }
  if (params?.severity && params.severity !== 'ALL') {
    records = records.filter((r) => r.severity === params.severity);
  }
  if (params?.action) {
    const act = params.action.toLowerCase();
    records = records.filter((r) => r.action.toLowerCase().includes(act));
  }
  if (params?.employee_id) {
    records = records.filter((r) => r.employee_id === params.employee_id);
  }
  if (params?.role) {
    records = records.filter((r) => r.role === params.role);
  }
  if (params?.record_type) {
    records = records.filter((r) => r.record_type === params.record_type);
  }
  if (params?.record_id) {
    records = records.filter((r) => r.record_id === params.record_id);
  }
  if (params?.legal_hold_only) {
    records = records.filter((r) => r.legal_hold);
  }
  if (params?.search) {
    const q = params.search.toLowerCase();
    records = records.filter(
      (r) =>
        r.user_name.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        r.module.toLowerCase().includes(q) ||
        r.record_id.toLowerCase().includes(q) ||
        (r.reason && r.reason.toLowerCase().includes(q)) ||
        (r.related_context && r.related_context.toLowerCase().includes(q))
    );
  }
  if (params?.start_date) {
    const start = new Date(params.start_date).getTime();
    records = records.filter((r) => new Date(r.timestamp).getTime() >= start);
  }
  if (params?.end_date) {
    const end = new Date(params.end_date).getTime();
    records = records.filter((r) => new Date(r.timestamp).getTime() <= end);
  }

  const total = records.length;
  const startIndex = (page - 1) * limit;
  const pagedRecords = records.slice(startIndex, startIndex + limit);

  return { records: pagedRecords, total, page, limit };
}

/**
 * Verify cryptographic hash chain integrity.
 * Traverses from oldest to newest and recalculates hashes.
 */
export function verifyAuditChainIntegrity(): {
  isValid: boolean;
  checkedCount: number;
  errors: string[];
  headHash: string;
  genesisHash: string;
} {
  const store = getEnterpriseLedgerStore();
  if (store.length === 0) {
    return {
      isValid: true,
      checkedCount: 0,
      errors: [],
      headHash: GENESIS_PREVIOUS_HASH,
      genesisHash: GENESIS_PREVIOUS_HASH,
    };
  }

  // Reverse store to verify from oldest (first recorded) to newest (head)
  const chronological = [...store].reverse();
  const errors: string[] = [];

  let expectedPreviousHash = GENESIS_PREVIOUS_HASH;

  for (let i = 0; i < chronological.length; i++) {
    const r = chronological[i];
    if (r.previous_hash !== expectedPreviousHash) {
      errors.push(
        `Chain break at index ${i} (Event: ${r.event_id}): previous_hash '${r.previous_hash}' does not match expected '${expectedPreviousHash}'`
      );
    }

    const payloadForHash = {
      recordType: r.record_type,
      recordId: r.record_id,
      reason: r.reason || null,
      outcome: r.outcome,
      diff: r.diff || [],
      previous: r.previous_values || null,
      new: r.new_values || null,
    };

    const recomputedHash = computeRecordHash(
      r.previous_hash,
      r.event_id,
      r.timestamp,
      r.category,
      r.action,
      r.employee_id,
      payloadForHash
    );

    if (recomputedHash !== r.integrity_hash) {
      errors.push(
        `Integrity violation at index ${i} (Event: ${r.event_id}): stored hash '${r.integrity_hash}' does not match recomputed '${recomputedHash}'`
      );
    }

    expectedPreviousHash = r.integrity_hash;
  }

  return {
    isValid: errors.length === 0,
    checkedCount: chronological.length,
    errors,
    headHash: chronological[chronological.length - 1].integrity_hash,
    genesisHash: chronological[0].previous_hash,
  };
}

/**
 * Create a signed integrity checkpoint.
 */
export async function createAuditCheckpoint(): Promise<AuditCheckpointRecord> {
  const integrity = verifyAuditChainIntegrity();
  if (!integrity.isValid) {
    throw new Error(`Cannot create checkpoint on corrupted audit chain: ${integrity.errors.join(', ')}`);
  }

  const checkpoints = getAuditCheckpointsStore();
  const blockHeight = checkpoints.length + 1;
  const timestamp = new Date().toISOString();
  const checkpointId = `CHK-${Date.now()}-${blockHeight}`;

  // Retrieve HMAC secret with key separation from database
  const secret = getCheckpointHmacSecret();
  const signedDigest = crypto
    .createHmac('sha256', secret)
    .update(`${checkpointId}|${blockHeight}|${integrity.headHash}|${timestamp}|${integrity.checkedCount}`)
    .digest('hex');

  const checkpoint: AuditCheckpointRecord = {
    checkpoint_id: checkpointId,
    block_height: blockHeight,
    head_hash: integrity.headHash,
    timestamp,
    event_count: integrity.checkedCount,
    signed_digest: signedDigest,
  };

  checkpoints.unshift(checkpoint);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      await admin.from('audit_integrity_checkpoints').insert([
        {
          checkpoint_id: checkpoint.checkpoint_id,
          block_height: checkpoint.block_height,
          head_hash: checkpoint.head_hash,
          timestamp: checkpoint.timestamp,
          event_count: checkpoint.event_count,
          signed_digest: checkpoint.signed_digest,
        },
      ]);
    } catch (err) {
      console.warn('Supabase audit_integrity_checkpoints insert failed:', err);
    }
  }

  return checkpoint;
}

/**
 * Determines whether the current execution runtime is production.
 * Invariant: If process.env.NODE_ENV is 'production', NEXT_PUBLIC_ERP_ENV CANNOT downgrade it.
 */
export function isProductionRuntime(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  const erpEnv = process.env.NEXT_PUBLIC_ERP_ENV?.trim().toUpperCase();
  if (erpEnv === 'PRODUCTION') {
    return true;
  }
  return false;
}

/**
 * Retrieve HMAC secret for checkpoint signing.
 * Strictly separates key custody from the database owner and enforces fail-closed production security:
 * 1. In production, AUDIT_CHECKPOINT_HMAC_SECRET is strictly mandatory (min 32 non-whitespace characters).
 * 2. Production never falls back to ERP_SESSION_SECRET or hardcoded test salts.
 * 3. Missing/invalid production configuration fails closed with a safe generic error.
 * 4. Fallback is permitted strictly in non-production runtimes for isolated automated testing.
 */
export function getCheckpointHmacSecret(): string {
  const isProd = isProductionRuntime();
  const dedicatedSecret = process.env.AUDIT_CHECKPOINT_HMAC_SECRET;

  if (isProd) {
    if (!dedicatedSecret || typeof dedicatedSecret !== 'string' || dedicatedSecret.trim().length < 32) {
      throw new Error(
        'SECURITY_CONFIGURATION_ERROR: Mandatory AUDIT_CHECKPOINT_HMAC_SECRET is missing or invalid in production runtime (minimum 32 non-whitespace characters required). Fallback keys and internal salts are strictly prohibited.'
      );
    }
    return dedicatedSecret.trim();
  }

  // Non-production: prioritize dedicated secret if valid
  if (dedicatedSecret && typeof dedicatedSecret === 'string' && dedicatedSecret.trim().length >= 32) {
    return dedicatedSecret.trim();
  }

  // Non-production fallback strictly for isolated test/development runtimes
  return dedicatedSecret?.trim() || process.env.ERP_SESSION_SECRET || 'icon_tech_pro_enterprise_salt_2026';
}

/**
 * Cryptographically verifies an audit checkpoint using HMAC-SHA256 and constant-time comparison.
 */
export function verifyAuditCheckpoint(
  checkpoint: AuditCheckpointRecord,
  secretOverride?: string
): { isValid: boolean; expectedDigest: string; providedDigest: string; reason?: string } {
  try {
    const secret = secretOverride || getCheckpointHmacSecret();
    const expectedDigest = crypto
      .createHmac('sha256', secret)
      .update(
        `${checkpoint.checkpoint_id}|${checkpoint.block_height}|${checkpoint.head_hash}|${checkpoint.timestamp}|${checkpoint.event_count}`
      )
      .digest('hex');

    const bufExpected = Buffer.from(expectedDigest, 'hex');
    const bufProvided = Buffer.from(checkpoint.signed_digest, 'hex');
    const isMatch =
      bufExpected.length === bufProvided.length && crypto.timingSafeEqual(bufExpected, bufProvided);

    return {
      isValid: isMatch,
      expectedDigest,
      providedDigest: checkpoint.signed_digest,
      reason: isMatch ? undefined : 'HMAC signature verification failed — digest mismatch or key mismatch',
    };
  } catch (err: any) {
    return {
      isValid: false,
      expectedDigest: '',
      providedDigest: checkpoint?.signed_digest || '',
      reason: err?.message || 'HMAC checkpoint verification failed closed due to configuration error',
    };
  }
}

/**
 * Traverses audit ledger records from genesis to head and detects any alteration of payload or hash chaining.
 */
export function detectRecordTampering(records: EnterpriseAuditRecord[]): {
  isTampered: boolean;
  violationType?: 'CONTENT_ALTERED' | 'CHAIN_FORK' | 'HASH_MISMATCH' | 'NONE';
  brokenIndex?: number;
  eventId?: string;
  details?: string;
} {
  if (!records || records.length === 0) {
    return { isTampered: false, violationType: 'NONE' };
  }
  const chronological = [...records].reverse();
  let expectedPrev = GENESIS_PREVIOUS_HASH;

  for (let i = 0; i < chronological.length; i++) {
    const r = chronological[i];
    if (r.previous_hash !== expectedPrev) {
      return {
        isTampered: true,
        violationType: 'CHAIN_FORK',
        brokenIndex: i,
        eventId: r.event_id,
        details: `Chain fork: record previous_hash '${r.previous_hash}' does not match expected previous '${expectedPrev}'`,
      };
    }

    const payloadForHash = {
      recordType: r.record_type,
      recordId: r.record_id,
      reason: r.reason || null,
      outcome: r.outcome,
      diff: r.diff || [],
      previous: r.previous_values || null,
      new: r.new_values || null,
    };

    const recomputed = computeRecordHash(
      r.previous_hash,
      r.event_id,
      r.timestamp,
      r.category,
      r.action,
      r.employee_id,
      payloadForHash
    );

    if (recomputed !== r.integrity_hash) {
      return {
        isTampered: true,
        violationType: 'CONTENT_ALTERED',
        brokenIndex: i,
        eventId: r.event_id,
        details: `Content altered: stored hash '${r.integrity_hash}' does not match recomputed '${recomputed}'`,
      };
    }

    expectedPrev = r.integrity_hash;
  }

  return { isTampered: false, violationType: 'NONE' };
}

/**
 * Detects backdated or inserted records violating temporal monotonicity.
 */
export function detectBackdatedRecord(records: EnterpriseAuditRecord[]): {
  isBackdated: boolean;
  index?: number;
  eventId?: string;
  details?: string;
} {
  const chronological = [...records].reverse();
  for (let i = 1; i < chronological.length; i++) {
    const prevTime = new Date(chronological[i - 1].timestamp).getTime();
    const currTime = new Date(chronological[i].timestamp).getTime();
    // Allow up to 1000ms clock skew across distributed systems
    if (currTime < prevTime - 1000) {
      return {
        isBackdated: true,
        index: i,
        eventId: chronological[i].event_id,
        details: `Backdated entry detected: event timestamp (${chronological[i].timestamp}) precedes previous event (${chronological[i - 1].timestamp})`,
      };
    }
  }
  return { isBackdated: false };
}

/**
 * Compares current ledger against a signed checkpoint to detect truncation or missing events.
 */
export function detectLedgerTruncation(
  records: EnterpriseAuditRecord[],
  checkpoint: AuditCheckpointRecord
): {
  isTruncated: boolean;
  missingEventsCount?: number;
  details?: string;
} {
  if (records.length < checkpoint.event_count) {
    return {
      isTruncated: true,
      missingEventsCount: checkpoint.event_count - records.length,
      details: `Ledger truncated: record count (${records.length}) is less than checkpoint count (${checkpoint.event_count})`,
    };
  }

  const chronological = [...records].reverse();
  const checkpointIndex = checkpoint.event_count - 1;
  const recordedHeadAtCheckpoint = chronological[checkpointIndex]?.integrity_hash;

  if (recordedHeadAtCheckpoint !== checkpoint.head_hash) {
    return {
      isTruncated: true,
      details: `Checkpoint head hash mismatch: expected '${checkpoint.head_hash}', got '${recordedHeadAtCheckpoint}'`,
    };
  }

  return { isTruncated: false };
}

/**
 * Toggle Legal Hold flag on an audit event to prevent any retention purge.
 */
export async function setAuditLegalHold(
  eventId: string,
  hold: boolean,
  reason: string,
  actor: { name: string; role: string }
): Promise<{ success: boolean; error?: string }> {
  if (!reason || reason.trim().length < 5) {
    return { success: false, error: 'A valid business reason (minimum 5 characters) is mandatory for legal hold changes.' };
  }

  const store = getEnterpriseLedgerStore();
  const record = store.find((r) => r.event_id === eventId);
  if (!record) {
    return { success: false, error: 'Audit event record not found.' };
  }

  record.legal_hold = hold;

  await logEnterpriseAudit({
    userName: actor.name,
    role: actor.role,
    category: 'SECURITY_EVENT',
    severity: 'SECURITY',
    module: 'AUDIT_CENTRE',
    action: hold ? 'LEGAL_HOLD_APPLIED' : 'LEGAL_HOLD_RELEASED',
    recordType: 'AUDIT_RECORD',
    recordId: eventId,
    reason,
    previousValues: { legal_hold: !hold },
    newValues: { legal_hold: hold },
  });

  return { success: true };
}
