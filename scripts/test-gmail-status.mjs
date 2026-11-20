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

// Also read .env.local if present
if (fs.existsSync('.env.local')) {
  const localLines = fs.readFileSync('.env.local', 'utf8').split('\n');
  for (const line of localLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (!env[trimmed.slice(0, eq).trim()]) {
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

for (const [k, v] of Object.entries(env)) {
  process.env[k] = v;
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function testGmailStatus() {
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .eq('setting_key', 'gmail_oauth_integration')
    .single();

  console.log('System settings gmail row:', data ? 'FOUND' : 'NOT FOUND', error);
  if (data?.setting_value) {
    console.log('Keys in setting_value:', Object.keys(data.setting_value));
    console.log('Account email:', data.setting_value.account_email);
    console.log('Connected by:', data.setting_value.connected_by_name);
    console.log('Access token expires at:', data.setting_value.access_token_expires_at);
  }
}

testGmailStatus().catch(console.error);
