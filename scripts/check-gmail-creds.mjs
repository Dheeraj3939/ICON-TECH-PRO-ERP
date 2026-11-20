import fs from 'node:fs';
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

async function run() {
  const { data: row } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'gmail_oauth_integration')
    .single();

  const val = row?.setting_value || {};
  console.log('Gmail OAuth setting:', {
    email: val.email,
    status: val.status,
    hasRefreshToken: Boolean(val.encrypted_refresh_token || val.refresh_token),
    hasAccessToken: Boolean(val.encrypted_access_token || val.access_token),
    connected_at: val.connected_at
  });
}

run().catch(console.error);
