import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf8');
const lines = envContent.split(/\r?\n/);
let url = '', key = '';
for (const line of lines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SECRET_KEY=')) key = line.split('=')[1].trim();
}

if (!url || !key) {
  console.error('Supabase URL or Secret Key missing from .env.local');
  process.exit(1);
}

const admin = createClient(url, key);

const KNOWN_TABLES = [
  'user_profiles',
  'roles',
  'role_permissions',
  'managed_user_credentials',
  'consumed_action_tokens',
  'customers',
  'customer_contacts',
  'enquiries',
  'quotations',
  'quotation_items',
  'quotation_versions',
  'sales_orders',
  'sales_order_items',
  'invoices',
  'invoice_items',
  'payments',
  'suppliers',
  'purchase_orders',
  'purchase_order_items',
  'products',
  'product_specs',
  'spec_intelligence_records',
  'product_intelligence_library',
  'inventory_items',
  'inventory_transactions',
  'communications',
  'email_logs',
  'audit_logs',
  'system_settings',
  'integration_credentials',
  'zoho_organization_settings',
  'zoho_user_mappings',
  'zoho_sync_history',
  'company_settings',
  'document_settings',
  'discount_rules',
  'attendance_records',
  'payroll_records',
  'site_visits',
  'follow_ups',
  'projects',
  'demo_center_assets',
  'tally_ledger_mappings',
  'employees'
];

async function runInventory() {
  console.log('============================================================');
  console.log('ICON TECH PRO ERP V9.2 — PRODUCTION DATABASE INVENTORY');
  console.log('============================================================\n');

  const results = {};
  const activeTables = [];

  for (const table of KNOWN_TABLES) {
    try {
      const { data, error } = await admin.from(table).select('*');
      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
          // Table does not exist in schema
        } else {
          console.log(`[!] ${table}: Query error - ${error.message}`);
        }
      } else {
        const count = data ? data.length : 0;
        results[table] = { count, rows: data };
        activeTables.push({ table, count });
        console.log(`[TABLE] ${table.padEnd(32)}: ${count} rows`);
      }
    } catch (err) {
      console.log(`[!] ${table}: Exception - ${err.message}`);
    }
  }

  // Backup snapshot to disk
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const snapDir = path.join('backups', `pre-cleanup-db-snapshot-${ts}`);
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });

  const snapshotFile = path.join(snapDir, 'database-snapshot.json');
  fs.writeFileSync(snapshotFile, JSON.stringify(results, null, 2), 'utf8');

  console.log('\n============================================================');
  console.log(`PRE-CLEANUP SNAPSHOT ARCHIVED TO:`);
  console.log(`  ${snapshotFile}`);
  console.log(`Total Tables Discovered: ${activeTables.length}`);
  console.log('============================================================\n');

  return { activeTables, results, snapshotFile };
}

runInventory().catch(console.error);
