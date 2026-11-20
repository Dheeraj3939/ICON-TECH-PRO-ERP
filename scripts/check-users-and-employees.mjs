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
  const { data: users, error: uErr } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, role_id, status, can_login, phone, department, designation');
  console.log('user_profiles in DB count:', users?.length, 'error:', uErr);
  console.table(users);

  const { data: roles } = await supabase.from('roles').select('id, role_name');
  console.log('Roles in DB:');
  console.table(roles);
}

run().catch(console.error);
