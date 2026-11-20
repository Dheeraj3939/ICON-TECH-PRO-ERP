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

const EMPLOYEES = [
  {
    employee_id: 'EMP-0001',
    user_id: '9d35144b-ba02-41b6-a1c8-44f1da087482',
    full_name: 'Borra Narsimulu',
    gender: 'Male',
    date_of_birth: '1978-04-12',
    phone: '+91 80999 09997',
    personal_email: 'icontechpro@gmail.com',
    corporate_email: 'icontechpro@gmail.com',
    address: 'Plot 42, Jubilee Hills, Hyderabad, Telangana 500033',
    department: 'MD',
    designation: 'Managing Director',
    employment_type: 'Full Time',
    joining_date: '2003-01-02',
    work_location_type: 'Office',
    status: 'Active',
    probation_status: 'Confirmed',
    skills: ['Managing Director', 'Business Oversight', 'Management Approvals', 'Executive Reporting', 'Financial Visibility'],
    notes: 'Managing Director & Principal Executive Officer.'
  },
  {
    employee_id: 'EMP-0002',
    user_id: '8a4b7651-bc5f-4ffe-b5d4-c0507f673bc7',
    full_name: 'B V Dheeraj Reddy',
    gender: 'Male',
    date_of_birth: '1989-08-23',
    phone: '+91 98480 22346',
    personal_email: 'dheeraj@icontechpro.in',
    corporate_email: 'dheeraj@icontechpro.in',
    address: 'H.No 3-4-118, Madhapur, Hyderabad, Telangana 500081',
    department: 'IT & Administration',
    designation: 'System Administrator',
    employment_type: 'Full Time',
    joining_date: '2021-03-15',
    work_location_type: 'Office',
    status: 'Active',
    probation_status: 'Confirmed',
    skills: ['Administration', 'ERP Architecture', 'System Administration'],
    notes: 'System Administrator with BDM permissions.'
  },
  {
    employee_id: 'EMP-0003',
    user_id: 'c3916805-ccd4-48cb-b023-87db9a509b62',
    full_name: 'B Vineet Babu',
    gender: 'Male',
    date_of_birth: '1992-11-05',
    phone: '+91 98480 33455',
    personal_email: 'vineet@icontechpro.in',
    corporate_email: 'vineet@icontechpro.in',
    address: 'Flat 204, Cyber Heights, Gachibowli, Hyderabad, Telangana 500032',
    department: 'Sales',
    designation: 'Corporate Sales Executive',
    employment_type: 'Full Time',
    joining_date: '2022-06-01',
    work_location_type: 'Hybrid',
    status: 'Active',
    probation_status: 'Confirmed',
    skills: ['Lead Handling', 'Quotations', 'Sales Order Coordination'],
    notes: 'Corporate Sales Executive handling lead progression and client quotations.'
  },
  {
    employee_id: 'EMP-0004',
    user_id: '3dc9da4e-eed7-4b78-847f-22c060ce359d',
    full_name: 'Reshma',
    gender: 'Female',
    date_of_birth: '1996-02-18',
    phone: '+91 98480 44566',
    personal_email: 'sales@icontechpro.in',
    corporate_email: 'sales@icontechpro.in',
    address: 'Plot 88, Kondapur, Hyderabad, Telangana 500084',
    department: 'Sales',
    designation: 'Enterprise Sales Executive',
    employment_type: 'Full Time',
    joining_date: '2023-08-01',
    work_location_type: 'Field',
    status: 'Active',
    probation_status: 'Confirmed',
    skills: ['Field Sales', 'Client Engagement', 'Quotations'],
    notes: 'Enterprise Sales Executive.'
  },
  {
    employee_id: 'EMP-0005',
    user_id: '7fec0c54-c00e-47ea-8a8f-8ea68586f77e',
    full_name: 'Hemalatha',
    gender: 'Female',
    date_of_birth: '1987-07-30',
    phone: '+91 98480 55677',
    personal_email: 'accounts@icontechpro.in',
    corporate_email: 'accounts@icontechpro.in',
    address: 'Plot 12, Kukatpally, Hyderabad, Telangana 500072',
    department: 'Finance & Accounts',
    designation: 'Accounts & Billing Lead',
    employment_type: 'Full Time',
    joining_date: '2021-11-15',
    work_location_type: 'Office',
    status: 'Active',
    probation_status: 'Confirmed',
    skills: ['Accounts', 'GST Invoicing', 'Collections', 'Financial Audits'],
    notes: 'Finance and accounts lead.'
  },
  {
    employee_id: 'EMP-0006',
    user_id: '4ffffebe-e0ec-4ca0-8d70-e622dbecc631',
    full_name: 'Manisha',
    gender: 'Female',
    date_of_birth: '1998-05-14',
    phone: '+91 98480 66788',
    personal_email: 'service01@icontechpro.in',
    corporate_email: 'service01@icontechpro.in',
    address: 'Flat 302, Miyapur, Hyderabad, Telangana 500049',
    department: 'Operations',
    designation: 'Office Assistant & Dispatch Coordinator',
    employment_type: 'Full Time',
    joining_date: '2023-01-10',
    work_location_type: 'Office',
    status: 'Active',
    probation_status: 'Confirmed',
    skills: ['Office Administration', 'Service Coordination', 'Dispatch Logistics'],
    notes: 'Office Assistant & Dispatch Coordinator.'
  }
];

async function seedEmployees() {
  console.log('Seeding employees...');
  for (const emp of EMPLOYEES) {
    const { data, error } = await supabase.from('employees').upsert([emp], { onConflict: 'corporate_email' });
    if (error) console.error(`Error inserting ${emp.full_name}:`, error);
    else console.log(`✓ Inserted/Updated ${emp.employee_id}: ${emp.full_name}`);
  }
}

seedEmployees().catch(console.error);
