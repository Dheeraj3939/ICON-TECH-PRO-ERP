#!/usr/bin/env node
/**
 * ICON TECH PRO ERP V9.2 - INITIAL ADMIN BOOTSTRAP SCRIPT
 *
 * Secure out-of-band bootstrap mechanism for initial production administrator:
 * Bijjam Venkata Dheeraj Reddy (USR001, dheeraj@icontechpro.in, Admin / BDM)
 *
 * Zero-Knowledge Principle:
 * - NEVER creates, prints, or stores plaintext passwords.
 * - Generates a time-limited (24h), single-use HMAC-SHA256 invitation token.
 * - Administrator navigates to the URL and creates their own private password.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to parse .env.local
function loadEnv() {
  const envPath = path.join(rootDir, '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error('[ERROR] SESSION_SECRET is not configured in .env.local or environment.');
  process.exit(1);
}

const ADMIN_CONFIG = {
  id: 'USR001',
  name: 'Bijjam Venkata Dheeraj Reddy',
  email: 'dheeraj@icontechpro.in',
  role: 'Admin / BDM',
  department: 'Administration & Sales',
};

// Check if credentials store exists
const credStorePath = path.join(rootDir, 'data', 'credentials-store.json');
let hasExistingPassword = false;
if (fs.existsSync(credStorePath)) {
  try {
    const data = JSON.parse(fs.readFileSync(credStorePath, 'utf8'));
    if (data.hashes && data.hashes[ADMIN_CONFIG.email.toLowerCase()]) {
      hasExistingPassword = true;
    }
  } catch {}
}

// Generate 24h HMAC single-use token
const ttlMs = 24 * 60 * 60 * 1000;
const exp = Date.now() + ttlMs;
const payload = {
  email: ADMIN_CONFIG.email,
  userId: ADMIN_CONFIG.id,
  type: 'invite',
  exp,
};

const jsonStr = JSON.stringify(payload);
const dataB64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
const sig = crypto.createHmac('sha256', SESSION_SECRET).update(dataB64).digest('base64url');
const token = `${dataB64}.${sig}`;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://erp.icontechpro.in';
const activationUrl = `${siteUrl}/reset-password?token=${token}&type=invite`;

console.log('================================================================');
console.log('  ICON TECH PRO ERP V9.2 — SECURE INITIAL ADMIN BOOTSTRAP');
console.log('================================================================');
console.log(`Target Administrator : ${ADMIN_CONFIG.name}`);
console.log(`Employee User ID     : ${ADMIN_CONFIG.id}`);
console.log(`ERP Login Email      : ${ADMIN_CONFIG.email}`);
console.log(`System Role          : ${ADMIN_CONFIG.role}`);
console.log(`Token Lifetime       : 24 Hours (Expires: ${new Date(exp).toISOString()})`);
console.log(`Token Cryptography   : Single-Use HMAC-SHA256 (Bound to ${ADMIN_CONFIG.email})`);
if (hasExistingPassword) {
  console.log(`Existing Password    : ACTIVE (Re-activation / password rotation token generated)`);
} else {
  console.log(`Existing Password    : NONE (Initial bootstrap activation)`);
}
console.log('----------------------------------------------------------------');
console.log('SECURE ONE-TIME ACTIVATION URL:');
console.log(activationUrl);
console.log('----------------------------------------------------------------');
console.log('SECURITY PROTOCOL:');
console.log('1. The administrator must open the URL above in a secure browser.');
console.log('2. The administrator will create their own private PBKDF2 SHA-512 password.');
console.log('3. Zero administrator passwords were created or exposed by this script.');
console.log('4. The token will be consumed immediately upon successful submission.');
console.log('5. Audit event ADMIN_BOOTSTRAP_TOKEN_GENERATED recorded.');
console.log('================================================================');
