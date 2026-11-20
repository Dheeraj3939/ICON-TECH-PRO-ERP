import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.uat.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

function decryptToken(ciphertext, ivHex, tagHex, rawKey) {
  try {
    let key;
    if (/^[0-9a-fA-F]{64}$/.test(rawKey.trim())) {
      key = Buffer.from(rawKey.trim(), 'hex');
    } else {
      key = crypto.createHash('sha256').update(rawKey.trim()).digest();
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let dec = decipher.update(ciphertext, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (err) {
    return null;
  }
}

async function testKeys() {
  const { data: row } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'gmail_oauth_integration')
    .single();

  const val = row?.setting_value;
  if (!val) {
    console.log('No gmail row');
    return;
  }

  const res = decryptToken(val.encrypted_refresh_token, val.iv, val.tag, env.SESSION_SECRET);
  console.log('Decrypt with SESSION_SECRET:', res ? 'SUCCESS! ' + res.substring(0, 10) : 'FAILED');
}

testKeys().catch(console.error);
