#!/usr/bin/env node
/**
 * ICON TECH PRO ERP V9.2 — UAT DATABASE & STORAGE RESTORATION UTILITY
 *
 * Restores database tables and storage bucket files from a verified backup
 * snapshot directory into the dedicated UAT project (ejjtudeegjedfwwqlnoy).
 * Strictly guards against production (xogynsnfzsvimwtvvhpx).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PROD_PROJECT_ID = 'xogynsnfzsvimwtvvhpx';
const EXPECTED_UAT_PROJECT_ID = 'ejjtudeegjedfwwqlnoy';

function loadUatEnv() {
  const envPath = path.join(rootDir, '.env.uat.local');
  if (!fs.existsSync(envPath)) throw new Error('Missing .env.uat.local file!');
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

export async function executeRestore(backupDir) {
  if (!backupDir || !fs.existsSync(backupDir)) {
    throw new Error(`Invalid backup directory provided: ${backupDir}`);
  }

  console.log('='.repeat(70));
  console.log('ICON TECH PRO ERP V9.2 — UAT RESTORATION EXECUTION');
  console.log('='.repeat(70));

  const env = loadUatEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    supabaseUrl.includes(PROD_PROJECT_ID) ||
    supabaseUrl.includes('xogynsnfzsvimwtvvhpx') ||
    supabaseUrl.includes('erp.icontechpro.in')
  ) {
    throw new Error(`CRITICAL SECURITY HALT: Target URL references production (${PROD_PROJECT_ID})!`);
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dbSnapshotPath = path.join(backupDir, 'database', 'database-snapshot.json');
  if (fs.existsSync(dbSnapshotPath)) {
    console.log('\n[1/2] Restoring Database Tables from Snapshot...');
    const dbData = JSON.parse(fs.readFileSync(dbSnapshotPath, 'utf8'));
    for (const [table, rows] of Object.entries(dbData)) {
      if (Array.isArray(rows) && rows.length > 0) {
        console.log(`  -> Restoring ${rows.length} rows to "${table}"...`);
        const { error } = await supabase.from(table).upsert(rows);
        if (error) {
          console.log(`  ✖ Failed restoring "${table}": ${error.message}`);
        } else {
          console.log(`  ✔ Restored "${table}" successfully.`);
        }
      }
    }
  }

  const storageDir = path.join(backupDir, 'storage');
  if (fs.existsSync(storageDir)) {
    console.log('\n[2/2] Restoring Storage Buckets...');
    const bucketFolders = fs.readdirSync(storageDir);
    for (const b of bucketFolders) {
      const bPath = path.join(storageDir, b);
      if (fs.statSync(bPath).isDirectory()) {
        const files = fs.readdirSync(bPath);
        for (const file of files) {
          const filePath = path.join(bPath, file);
          const buffer = fs.readFileSync(filePath);
          console.log(`  -> Uploading "${b}/${file}"...`);
          await supabase.storage.from(b).upload(file, buffer, { upsert: true });
        }
      }
    }
  }

  console.log('\nRestoration process completed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targetDir = process.argv[2];
  if (!targetDir) {
    console.error('Usage: node scripts/restore-uat-database-and-storage.mjs <backup-directory>');
    process.exit(1);
  }
  executeRestore(targetDir).catch(err => {
    console.error('Restore failed:', err);
    process.exit(1);
  });
}
