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

async function test1_EmployeesAndUsers() {
  console.log('=== TEST 1: EMPLOYEE MASTER & USER PROFILES AUDIT ===\n');

  // 1. Fetch user_profiles
  const { data: profiles, error: pErr } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, role_id, phone, department, designation, status, can_login')
    .order('full_name');
  console.log(`1. User Profiles count: ${profiles?.length || 0} (error: ${pErr?.message || 'none'})`);
  console.table(profiles?.map(p => ({
    name: p.full_name,
    email: p.email,
    phone: p.phone,
    dept: p.department,
    desig: p.designation,
    login: p.can_login,
    status: p.status
  })));

  // 2. Fetch employees
  const { data: emps, error: eErr } = await supabase
    .from('employees')
    .select('employee_id, full_name, corporate_email, phone, department, designation, status, employment_type')
    .order('employee_id');
  console.log(`\n2. Employees Master count: ${emps?.length || 0} (error: ${eErr?.message || 'none'})`);
  console.table(emps);

  // 3. Verify cross-table parity
  const allEmpsLinked = emps?.every(e => profiles?.some(p => p.email.toLowerCase() === e.corporate_email.toLowerCase()));
  console.log(`\n3. Cross-table Parity: All ${emps?.length} employees have matching login profiles: ${allEmpsLinked ? 'PASS (100%)' : 'FAIL'}`);

  // 4. Verify MD Account specifically
  const mdEmp = emps?.find(e => e.corporate_email === 'icontechpro@gmail.com');
  const mdUser = profiles?.find(p => p.email === 'icontechpro@gmail.com');
  console.log(`4. MD Profile Check:`);
  console.log(`   - Employee: ${mdEmp ? `FOUND (ID: ${mdEmp.employee_id}, Name: ${mdEmp.full_name}, Status: ${mdEmp.status})` : 'MISSING'}`);
  console.log(`   - User Login: ${mdUser ? `FOUND (Name: ${mdUser.full_name}, Can Login: ${mdUser.can_login}, Status: ${mdUser.status})` : 'MISSING'}`);
}

test1_EmployeesAndUsers().catch(console.error);
