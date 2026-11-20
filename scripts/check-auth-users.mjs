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

async function checkAuthUsers() {
  const { data, error } = await supabase.auth.admin.listUsers();
  console.log('Auth users count:', data?.users?.length, 'error:', error);
  console.table(data?.users?.map(u => ({ id: u.id, email: u.email })));
}

checkAuthUsers().catch(console.error);
