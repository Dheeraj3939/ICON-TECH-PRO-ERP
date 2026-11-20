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
  const { data: notifs, error } = await supabase
    .from('enterprise_notifications')
    .select('*');
  console.log('enterprise_notifications count:', notifs?.length, 'error:', error);
  if (notifs && notifs.length > 0) {
    console.table(notifs);
  }
}

run().catch(console.error);
