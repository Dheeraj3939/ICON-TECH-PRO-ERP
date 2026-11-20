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
  const { data: rows } = await supabase
    .from('system_settings')
    .select('setting_key, setting_value');
  
  console.log('All settings keys:');
  for (const r of rows || []) {
    console.log(r.setting_key, typeof r.setting_value === 'object' ? Object.keys(r.setting_value) : r.setting_value);
  }
}

run().catch(console.error);
