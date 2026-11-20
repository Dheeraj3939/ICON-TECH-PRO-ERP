import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envText = fs.readFileSync('.env.uat.local', 'utf8');
const env = {};
envText.split(/\r?\n/).forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function cleanEnquiry() {
  const { data, error } = await supabase
    .from('enquiries')
    .delete()
    .ilike('enquiry_number', '%TEST%')
    .select('*');

  if (error) console.error('Error deleting test enquiry:', error);
  else console.log('Deleted test enquiries:', data);
}

cleanEnquiry();
