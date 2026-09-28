/**
 * Circuit breaker to detect Supabase availability and prevent 14-second DNS timeouts
 * when running offline, on local LAN, or when Supabase project is unreachable.
 */

let cachedAvailability: boolean | null = null;
let lastCheckTime = 0;
let pendingHealthCheck: Promise<boolean> | null = null;

const ONLINE_CACHE_TTL_MS = 20000; // Keep online status for 20s
const OFFLINE_CACHE_TTL_MS = 2000;  // Retry offline status after 2s (avoid locking in offline on transient delay)

export async function isSupabaseAvailable(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes('placeholder') || url.includes('example.com')) {
    return false;
  }

  const now = Date.now();
  const ttl = cachedAvailability === true ? ONLINE_CACHE_TTL_MS : OFFLINE_CACHE_TTL_MS;
  if (cachedAvailability !== null && now - lastCheckTime < ttl) {
    return cachedAvailability;
  }

  // Deduplicate concurrent in-flight probes
  if (pendingHealthCheck) {
    return pendingHealthCheck;
  }

  pendingHealthCheck = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5000ms resilient WAN timeout

      const apikey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SECRET_KEY ||
        '';

      // Probe GoTrue /auth/v1/health first (official health endpoint, returns 200 OK without DB privileges)
      let res = await fetch(`${url}/auth/v1/health`, {
        method: 'GET',
        headers: { apikey },
        signal: controller.signal,
      }).catch(() => null);

      // Fallback probe to /rest/v1/ if auth health endpoint is not available
      if (!res) {
        res = await fetch(`${url}/rest/v1/`, {
          method: 'HEAD',
          headers: { apikey },
          signal: controller.signal,
        }).catch(() => null);
      }

      clearTimeout(timeoutId);
      cachedAvailability = !!(res && res.status >= 200 && res.status < 500);
    } catch {
      cachedAvailability = false;
    } finally {
      lastCheckTime = Date.now();
      pendingHealthCheck = null;
    }

    return cachedAvailability;
  })();

  return pendingHealthCheck;
}

export interface DatabaseHealthStatus {
  isOnline: boolean;
  dbStatus: 'CONNECTED' | 'DATABASE_UNAVAILABLE';
  statusText: 'LIVE / CONNECTED' | 'OFFLINE / DATABASE UNAVAILABLE';
  checkedAt: string;
}

export async function getDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const isOnline = await isSupabaseAvailable();
  return {
    isOnline,
    dbStatus: isOnline ? 'CONNECTED' : 'DATABASE_UNAVAILABLE',
    statusText: isOnline ? 'LIVE / CONNECTED' : 'OFFLINE / DATABASE UNAVAILABLE',
    checkedAt: new Date().toISOString(),
  };
}
