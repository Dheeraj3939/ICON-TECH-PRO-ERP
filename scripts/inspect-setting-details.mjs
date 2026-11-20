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

async function inspectSetting() {
  const { data } = await supabase.from('system_settings').select('*').eq('setting_key', 'gmail_oauth_integration').single();
  const v = data?.setting_value;
  console.log({
    hasIv: Boolean(v?.iv),
    ivLen: v?.iv?.length,
    hasTag: Boolean(v?.tag),
    tagLen: v?.tag?.length,
    encRefreshLen: v?.encrypted_refresh_token?.length,
    hasRefreshTokenPlain: Boolean(v?.refresh_token),
    hasAccessTokenPlain: Boolean(v?.access_token),
  });
}
inspectSetting().catch(console.error);
