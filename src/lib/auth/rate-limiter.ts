/**
 * ICON TECH PRO ERP V9.2 — Enterprise In-Memory Rate Limiter
 * Provides anti-brute-force protection for login, password recovery, and token verification.
 */

interface RateLimitRecord {
  count: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __ICON_RATE_LIMITS__: Record<string, RateLimitRecord> | undefined;
}

function getRateLimitsStore(): Record<string, RateLimitRecord> {
  if (!globalThis.__ICON_RATE_LIMITS__) {
    globalThis.__ICON_RATE_LIMITS__ = {};
  }
  return globalThis.__ICON_RATE_LIMITS__;
}

export type RateLimitAction = 'login' | 'reset' | 'token_verify';

const LIMITS: Record<RateLimitAction, { maxAttempts: number; windowMs: number }> = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 failed attempts per 15 min
  reset: { maxAttempts: 3, windowMs: 15 * 60 * 1000 }, // 3 requests per 15 min
  token_verify: { maxAttempts: 10, windowMs: 15 * 60 * 1000 }, // 10 attempts per 15 min
};

/**
 * Check whether an action is currently rate-limited.
 */
export function checkRateLimit(
  action: RateLimitAction,
  identifier: string
): { allowed: boolean; remaining: number; retryAfterSeconds?: number } {
  if (!identifier) return { allowed: true, remaining: 1 };

  const store = getRateLimitsStore();
  const key = `${action}:${identifier.toLowerCase().trim()}`;
  const config = LIMITS[action];
  const now = Date.now();

  const record = store[key];
  if (!record) {
    return { allowed: true, remaining: config.maxAttempts };
  }

  // Window expired -> reset
  if (now - record.firstAttemptAt > config.windowMs) {
    delete store[key];
    return { allowed: true, remaining: config.maxAttempts };
  }

  if (record.count >= config.maxAttempts) {
    const retryAfterMs = config.windowMs - (now - record.firstAttemptAt);
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return { allowed: true, remaining: config.maxAttempts - record.count };
}

/**
 * Record a failed attempt or request event.
 */
export function recordRateLimitAttempt(
  action: RateLimitAction,
  identifier: string
): void {
  if (!identifier) return;

  const store = getRateLimitsStore();
  const key = `${action}:${identifier.toLowerCase().trim()}`;
  const config = LIMITS[action];
  const now = Date.now();

  const record = store[key];
  if (!record || now - record.firstAttemptAt > config.windowMs) {
    store[key] = { count: 1, firstAttemptAt: now, lastAttemptAt: now };
  } else {
    record.count += 1;
    record.lastAttemptAt = now;
  }
}

/**
 * Reset rate limit for an identifier upon successful operation (e.g. successful login).
 */
export function resetRateLimit(
  action: RateLimitAction,
  identifier: string
): void {
  if (!identifier) return;

  const store = getRateLimitsStore();
  const key = `${action}:${identifier.toLowerCase().trim()}`;
  delete store[key];
}
