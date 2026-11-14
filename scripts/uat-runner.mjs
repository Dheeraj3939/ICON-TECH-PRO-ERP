#!/usr/bin/env node
/**
 * ICON TECH PRO ERP V9.2 — UAT RUNNER & ENVIRONMENT ENFORCER
 *
 * Guarantees that UAT commands (build:uat, start:uat, dev:uat) strictly
 * enforce UAT environment variables (NEXT_PUBLIC_ERP_ENV=UAT, UAT_MODE=true)
 * and load .env.uat.local values with override precedence over any conflicting
 * variables inherited from the parent shell or system environment.
 *
 * Stage 1B.2: Fail-Closed Validation & Anti-Bleed Guarantees:
 * 1. Halts execution if .env.uat.local is missing, unreadable, or malformed.
 * 2. Enforces presence of mandatory UAT keys (URL, ERP_ENV, credentials).
 * 3. Enforces that NEXT_PUBLIC_SUPABASE_URL points strictly to UAT project (njylssodwvaonbeebvjq)
 *    and forbids the production project ID (xogynsnfzsvimwtvvhpx).
 * 4. Cleanses parent shell variables to prevent inherited production credentials
 *    from silently bleeding into missing UAT configurations.
 * 5. Sanitizes error output to ensure zero secrets or tokens are ever logged.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const UAT_PROJECT_ID = 'ejjtudeegjedfwwqlnoy';
export const PROD_PROJECT_ID = 'xogynsnfzsvimwtvvhpx';
export const EXACT_UAT_SUPABASE_HOSTNAME = `${UAT_PROJECT_ID}.supabase.co`;
export const EXACT_PROD_SUPABASE_HOSTNAME = `${PROD_PROJECT_ID}.supabase.co`;

export const CORE_REQUIRED_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_ERP_ENV',
];

export const CREDENTIAL_REQUIRED_KEYS = [
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'NEXT_PUBLIC_APP_URL',
];

/**
 * Explicit allowlist of host operating system and Node.js runtime variables
 * permitted to be passed from parent shell into UAT child execution.
 * All arbitrary parent shell secrets and non-system variables are strictly excluded.
 */
export const SYSTEM_ENV_ALLOWLIST = new Set([
  // Core OS & Path fundamentals
  'PATH',
  'Path',
  'PATHEXT',
  'SHELL',
  'COMSPEC',
  'ComSpec',
  'OS',
  'OSTYPE',

  // Windows System & User Profile
  'SYSTEMROOT',
  'SystemRoot',
  'SYSTEMDRIVE',
  'SystemDrive',
  'WINDIR',
  'windir',
  'TEMP',
  'TMP',
  'TMPDIR',
  'APPDATA',
  'LOCALAPPDATA',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'HOME',
  'USERNAME',
  'USER',
  'PROGRAMFILES',
  'ProgramFiles',
  'PROGRAMFILES(X86)',
  'ProgramFiles(x86)',
  'PROGRAMW6432',
  'ProgramData',
  'PROGRAMDATA',
  'PUBLIC',
  'ALLUSERSPROFILE',
  'COMMONPROGRAMFILES',
  'CommonProgramFiles',
  'COMMONPROGRAMFILES(X86)',
  'CommonProgramFiles(x86)',
  'COMPUTERNAME',
  'NUMBER_OF_PROCESSORS',
  'PROCESSOR_ARCHITECTURE',
  'PROCESSOR_IDENTIFIER',
  'PROCESSOR_LEVEL',
  'PROCESSOR_REVISION',

  // Terminal & Output
  'TERM',
  'COLORTERM',
  'TERM_PROGRAM',
  'TERM_PROGRAM_VERSION',
  'FORCE_COLOR',
  'CI',

  // Node.js Runtime Identity (Strictly excludes NODE_OPTIONS and NODE_PATH to prevent arbitrary code execution)
  'NODE_ENV',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
]);

/**
 * Sanitizes URLs for error logs to ensure no credentials or tokens are printed.
 */
export function sanitizeDisplayUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '[malformed-url]';
  }
}

/**
 * Parses raw .env content into a key-value dictionary with support for:
 * - Comments (#) and empty lines
 * - Inline comments after unquoted values
 * - Single and double quoted values with multiline support
 * - Syntax error detection for malformed entries
 * @param {string} content
 * @returns {Record<string, string>}
 */
export function parseEnvContent(content) {
  if (typeof content !== 'string') {
    throw new Error('[UAT CONFIG PARSER ERROR] Environment content must be a string.');
  }

  const result = {};
  const lines = content.split(/\r?\n/);
  let currentKey = null;
  let currentValue = null;
  let inQuote = null; // '"' or "'"

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // If continuation of a multiline quote
    if (inQuote) {
      const closingIdx = rawLine.indexOf(inQuote);
      if (closingIdx !== -1) {
        currentValue += '\n' + rawLine.slice(0, closingIdx);
        const remainder = rawLine.slice(closingIdx + 1).trim();
        if (remainder && !remainder.startsWith('#')) {
          throw new Error(`[UAT CONFIG PARSER ERROR] Malformed .env line ${i + 1}: unexpected trailing content after quote: "${remainder}"`);
        }
        result[currentKey] = currentValue;
        currentKey = null;
        currentValue = null;
        inQuote = null;
      } else {
        currentValue += '\n' + rawLine;
      }
      continue;
    }

    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) {
      throw new Error(`[UAT CONFIG PARSER ERROR] Malformed .env line ${i + 1}: missing '=' in "${trimmed}"`);
    }

    const key = trimmed.slice(0, eqIdx).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`[UAT CONFIG PARSER ERROR] Malformed .env line ${i + 1}: invalid variable name "${key}"`);
    }

    let val = trimmed.slice(eqIdx + 1).trim();

    // Check if value is quoted
    if (val.startsWith('"') || val.startsWith("'")) {
      const quoteChar = val[0];
      const endQuoteIdx = val.indexOf(quoteChar, 1);
      if (endQuoteIdx !== -1) {
        // Closed on the same line
        const parsedVal = val.slice(1, endQuoteIdx);
        const remainder = val.slice(endQuoteIdx + 1).trim();
        if (remainder && !remainder.startsWith('#')) {
          throw new Error(`[UAT CONFIG PARSER ERROR] Malformed .env line ${i + 1}: unexpected trailing content after quote: "${remainder}"`);
        }
        result[key] = parsedVal;
      } else {
        // Multiline quoted value starts
        currentKey = key;
        currentValue = val.slice(1);
        inQuote = quoteChar;
      }
    } else {
      // Unquoted value: strip inline comments (e.g. "foo # comment")
      val = val.replace(/\s+#.*$/, '').trim();
      result[key] = val;
    }
  }

  if (inQuote) {
    throw new Error(`[UAT CONFIG PARSER ERROR] Malformed .env: unclosed quote for key "${currentKey}"`);
  }

  return result;
}

/**
 * Validates that an environment dictionary satisfies strict UAT security constraints:
 * - Presence of core required keys
 * - NEXT_PUBLIC_SUPABASE_URL points strictly to UAT project ID (njylssodwvaonbeebvjq)
 * - NEXT_PUBLIC_SUPABASE_URL forbids production project ID (xogynsnfzsvimwtvvhpx)
 * - NEXT_PUBLIC_ERP_ENV is strictly 'UAT'
 * - When credentials are required, verifies non-empty keys and prevents production app URLs
 * @param {Record<string, string | undefined>} env
 * @param {{ requireCredentials?: boolean; context?: string }} [options]
 * @returns {boolean}
 */
export function validateUatEnv(env, options = {}) {
  const { requireCredentials = true, context = 'environment' } = options;

  if (!env || typeof env !== 'object') {
    throw new Error(`[UAT FATAL CONFIG ERROR] Invalid ${context}: expected key-value map.`);
  }

  // 1. Verify Core Keys
  for (const key of CORE_REQUIRED_KEYS) {
    const val = env[key];
    if (typeof val !== 'string' || !val.trim()) {
      throw new Error(`[UAT FATAL CONFIG ERROR] Missing required configuration key in ${context}: "${key}".`);
    }
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.trim();

  // 2. Validate URL Syntax & Protocol
  let parsed;
  try {
    parsed = new URL(supabaseUrl);
  } catch (err) {
    throw new Error(`[UAT FATAL CONFIG ERROR] NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${err.message}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(
      `[UAT FATAL CONFIG ERROR] NEXT_PUBLIC_SUPABASE_URL must use HTTPS protocol, received "${parsed.protocol}". Insecure HTTP is strictly prohibited for UAT database connections.`
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Reject Production Host
  if (hostname === EXACT_PROD_SUPABASE_HOSTNAME || hostname.includes(PROD_PROJECT_ID)) {
    throw new Error(
      `[UAT FATAL CONFIG ERROR] NEXT_PUBLIC_SUPABASE_URL targets the PRODUCTION Supabase project (${PROD_PROJECT_ID}) / host (${EXACT_PROD_SUPABASE_HOSTNAME})! ` +
      `UAT execution is strictly prohibited against the production database.`
    );
  }

  // 4. Exact Authorized UAT Hostname Match (Prevents Hostname Spoofing)
  if (hostname !== EXACT_UAT_SUPABASE_HOSTNAME) {
    throw new Error(
      `[UAT FATAL CONFIG ERROR] NEXT_PUBLIC_SUPABASE_URL does not target the authorized UAT Supabase project (${UAT_PROJECT_ID}) / ` +
      `hostname "${parsed.hostname}" does not match the exact authorized UAT Supabase host "${EXACT_UAT_SUPABASE_HOSTNAME}". ` +
      `Hostname spoofing, subdomains, or unauthorized hosts are strictly blocked.`
    );
  }

  // 5. Port & Credential Hygiene
  if (parsed.port && parsed.port !== '443') {
    throw new Error(
      `[UAT FATAL CONFIG ERROR] NEXT_PUBLIC_SUPABASE_URL specifies unexpected non-standard port "${parsed.port}". Standard HTTPS port 443 is required.`
    );
  }

  if (parsed.username || parsed.password) {
    throw new Error('[UAT FATAL CONFIG ERROR] NEXT_PUBLIC_SUPABASE_URL must not contain embedded basic auth credentials.');
  }

  // 6. Verify ERP Environment Flag
  const erpEnv = env.NEXT_PUBLIC_ERP_ENV?.trim();
  if (erpEnv !== 'UAT') {
    throw new Error(`[UAT FATAL CONFIG ERROR] NEXT_PUBLIC_ERP_ENV must be "UAT", received: "${erpEnv}".`);
  }

  // 7. Verify Credentials if required
  if (requireCredentials) {
    for (const key of CREDENTIAL_REQUIRED_KEYS) {
      const val = env[key];
      if (typeof val !== 'string' || !val.trim()) {
        throw new Error(`[UAT FATAL CONFIG ERROR] Missing required credential key in ${context}: "${key}".`);
      }
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL.trim();
    if (appUrl.includes('erp.icontechpro.in')) {
      throw new Error(
        `[UAT FATAL CONFIG ERROR] NEXT_PUBLIC_APP_URL targets production domain (erp.icontechpro.in). ` +
        `UAT must target localhost:3001 or a dedicated UAT host.`
      );
    }
  }

  return true;
}

/**
 * Resolves the UAT environment by:
 * 1. Reading and strictly parsing .env.uat.local (or customEnvContent)
 * 2. Fail-closed validation on the file environment directly
 * 3. Constructing child environment from parentEnv using ONLY SYSTEM_ENV_ALLOWLIST
 *    (preventing arbitrary parent shell secrets/integrations from leaking)
 * 4. Merging allowlisted system environment with validated UAT file values
 * 5. Pinning immutable UAT identity flags
 * 6. Mirroring alias keys (ANON_KEY, SERVICE_ROLE_KEY) to guarantee UAT credentials
 * 7. Final defense-in-depth validation on the resolved environment
 * @param {Record<string, string | undefined>} [parentEnv]
 * @param {string | null} [customEnvContent]
 * @param {{ envPath?: string; requireCredentials?: boolean; extraAllowedKeys?: Set<string> }} [options]
 * @returns {Record<string, string>}
 */
export function resolveUatEnv(parentEnv = process.env, customEnvContent = null, options = {}) {
  let fileEnv = {};
  if (customEnvContent !== null) {
    fileEnv = parseEnvContent(customEnvContent);
  } else {
    const uatEnvPath = options.envPath || path.join(rootDir, '.env.uat.local');
    if (!fs.existsSync(uatEnvPath)) {
      throw new Error(`[UAT FATAL CONFIG ERROR] UAT environment file not found at: ${uatEnvPath}`);
    }
    const rawContent = fs.readFileSync(uatEnvPath, 'utf8');
    fileEnv = parseEnvContent(rawContent);
  }

  if (Object.keys(fileEnv).length === 0) {
    throw new Error('[UAT FATAL CONFIG ERROR] UAT environment file is empty or contains no valid keys.');
  }

  // Determine credential requirement (default true if customEnvContent is null)
  const requireCredentials = options.requireCredentials ?? (customEnvContent === null);

  // Validate the file environment itself BEFORE touching parentEnv
  validateUatEnv(fileEnv, { requireCredentials, context: 'file configuration (.env.uat.local)' });

  // 3. Construct child environment using ONLY allowlisted system variables from parentEnv.
  //    Arbitrary parent shell variables, production tokens, and unallowlisted secrets are excluded.
  const childEnv = {};
  for (const [key, value] of Object.entries(parentEnv || {})) {
    if (
      value !== undefined &&
      (SYSTEM_ENV_ALLOWLIST.has(key) || options.extraAllowedKeys?.has(key))
    ) {
      childEnv[key] = value;
    }
  }

  // 4. Overlay validated UAT values from fileEnv onto the allowlisted child environment
  for (const [key, value] of Object.entries(fileEnv)) {
    if (value !== undefined) {
      childEnv[key] = value;
    }
  }

  // 5. Forcefully pin immutable UAT identity flags
  childEnv.NEXT_PUBLIC_ERP_ENV = 'UAT';
  childEnv.ERP_ENV = 'UAT';
  childEnv.UAT_MODE = 'true';

  // 6. Synchronize alias keys directly from UAT file credentials
  if (fileEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !childEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    childEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = fileEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  }
  if (fileEnv.SUPABASE_SECRET_KEY && !childEnv.SUPABASE_SERVICE_ROLE_KEY) {
    childEnv.SUPABASE_SERVICE_ROLE_KEY = fileEnv.SUPABASE_SECRET_KEY;
  }

  // 7. Final defense-in-depth validation on the resolved child environment
  validateUatEnv(childEnv, { requireCredentials, context: 'resolved UAT child environment' });

  return childEnv;
}

/**
 * CLI Entrypoint: Validates UAT configuration and spawns Next.js CLI with forced UAT environment.
 */
export function runUatCli() {
  let forcedEnv;
  try {
    forcedEnv = resolveUatEnv(process.env);
  } catch (err) {
    console.error(`\x1b[31m[UAT FATAL CONFIG ERROR]\x1b[0m ${err.message}`);
    process.exit(1);
    return;
  }

  const nextBin = path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  const args = process.argv.slice(2);

  const child = spawn(process.execPath, [nextBin, ...args], {
    cwd: rootDir,
    env: forcedEnv,
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    console.error(`\x1b[31m[UAT PROCESS ERROR]\x1b[0m Failed to spawn Next.js process: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
}

// Execute when invoked directly from CLI
const isDirectCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectCli) {
  runUatCli();
}

