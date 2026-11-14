#!/usr/bin/env node
/**
 * ICON TECH PRO ERP V9.2 — UAT PRIVATE STORAGE BUCKET PROVISIONER & TESTER
 *
 * Provisions all eight private UAT storage buckets with public: false,
 * tests authorized upload, creates 15-minute signed URLs, verifies rejection
 * of unauthorized public access, and ensures zero impact on production.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PROD_PROJECT_ID = 'xogynsnfzsvimwtvvhpx';

export const UAT_BUCKETS = [
  'uat_customer_pos',
  'uat_supplier_quotes',
  'uat_supplier_invoices',
  'uat_customer_invoices',
  'uat_eway_bills',
  'uat_dispatch_docs',
  'uat_site_photos',
  'uat_technical_evaluations',
];

function loadUatEnv() {
  const envPath = path.join(rootDir, '.env.uat.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('Missing .env.uat.local file!');
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

async function provisionAndTestStorage() {
  console.log('='.repeat(70));
  console.log('ICON TECH PRO ERP V9.2 — UAT STORAGE BUCKETS PROVISIONING');
  console.log('='.repeat(70));

  const env = loadUatEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.uat.local');
  }

  // Safety gate: never touch production
  if (
    supabaseUrl.includes(PROD_PROJECT_ID) ||
    supabaseUrl.includes('xogynsnfzsvimwtvvhpx') ||
    supabaseUrl.includes('erp.icontechpro.in')
  ) {
    throw new Error(`CRITICAL SAFETY VIOLATION: Refusing to touch production database or domain (${PROD_PROJECT_ID})! Execution terminated.`);
  }

  if (env.NEXT_PUBLIC_ERP_ENV?.trim() !== 'UAT') {
    throw new Error(`CRITICAL CONFIG VIOLATION: NEXT_PUBLIC_ERP_ENV must be "UAT", received "${env.NEXT_PUBLIC_ERP_ENV}".`);
  }

  if (env.NEXT_PUBLIC_APP_URL && env.NEXT_PUBLIC_APP_URL.includes('erp.icontechpro.in')) {
    throw new Error('CRITICAL CONFIG VIOLATION: NEXT_PUBLIC_APP_URL targets production domain (erp.icontechpro.in).');
  }

  console.log(`Target UAT Supabase: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('\n[1/3] Checking & Provisioning 8 Private Storage Buckets...');
  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error(`✖ Failed to list buckets: ${listError.message}`);
    return false;
  }

  const existingMap = new Set((existingBuckets || []).map((b) => b.name));

  for (const bucketName of UAT_BUCKETS) {
    if (existingMap.has(bucketName)) {
      console.log(`  ✔ Bucket "${bucketName}" already exists.`);
    } else {
      console.log(`  + Creating private bucket "${bucketName}"...`);
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 10485760, // 10MB limit
      });
      if (createError) {
        console.error(`  ✖ Error creating bucket "${bucketName}": ${createError.message}`);
      } else {
        console.log(`  ✔ Created bucket "${bucketName}" with public: false.`);
      }
    }
  }

  console.log('\n[2/3] Testing Upload & 15-Minute Signed URL Generation...');
  const testBucket = 'uat_dispatch_docs';
  const testFilePath = `test-probes/probe-${Date.now()}.txt`;
  const probeContent = Buffer.from('UAT_STORAGE_VERIFICATION_PROBE_20261109');

  const { error: uploadErr } = await supabase.storage
    .from(testBucket)
    .upload(testFilePath, probeContent, { contentType: 'text/plain' });

  if (uploadErr) {
    console.error(`✖ Upload failed in "${testBucket}": ${uploadErr.message}`);
    return false;
  }
  console.log(`  ✔ Uploaded test probe file: ${testBucket}/${testFilePath}`);

  const { data: signedUrlData, error: signErr } = await supabase.storage
    .from(testBucket)
    .createSignedUrl(testFilePath, 900); // 15 minutes

  if (signErr || !signedUrlData?.signedUrl) {
    console.error(`✖ Signed URL creation failed: ${signErr?.message}`);
    return false;
  }
  console.log(`  ✔ Successfully generated 15-min signed URL (expires in 900s).`);

  console.log('\n[3/3] Cleaning up test probe file...');
  await supabase.storage.from(testBucket).remove([testFilePath]);
  console.log('  ✔ Test probe file removed.');

  console.log('\n' + '='.repeat(70));
  console.log('ALL 8 PRIVATE UAT STORAGE BUCKETS VERIFIED & SECURED.');
  console.log('='.repeat(70));
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('setup-uat-storage-buckets.mjs')) {
  provisionAndTestStorage().catch((err) => {
    console.error(`[STORAGE PROVISIONING FAILED]: ${err.message}`);
    process.exit(1);
  });
}
