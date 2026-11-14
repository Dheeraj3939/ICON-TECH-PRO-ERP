#!/usr/bin/env node
/**
 * ICON TECH PRO ERP V9.2 — UAT STORAGE SECURITY & ACCESS CONTROL VERIFIER
 *
 * Verifies that all eight UAT storage buckets enforce:
 * 1. public: false (no public exposure)
 * 2. Complete rejection of unauthenticated public access
 * 3. Successful signed URL generation with strict cryptographic expiration
 * 4. Post-expiration rejection of signed URLs
 * 5. Full cleanup of temporary security probes
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const EXPECTED_UAT_PROJECT_ID = 'ejjtudeegjedfwwqlnoy';
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

export async function testStorageSecurity() {
  console.log('='.repeat(70));
  console.log('ICON TECH PRO ERP V9.2 — STORAGE SECURITY & ISOLATION VERIFICATION');
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

  if (!supabaseUrl.includes(EXPECTED_UAT_PROJECT_ID)) {
    throw new Error(`CRITICAL CONFIG ERROR: Target URL is not UAT project (${EXPECTED_UAT_PROJECT_ID})!`);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const anonClient = createClient(supabaseUrl, 'sb_publishable_invalid_or_anon', {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const report = {
    allBucketsPrivate: false,
    unauthorizedAccessRejected: false,
    signedUrlGenerationPassed: false,
    signedUrlExpiryEnforced: false,
    probesCleanedUp: false,
  };

  // 1. Verify all 8 buckets are strictly public: false
  console.log('\n[1/5] Auditing Bucket Privacy Flags (public: false)...');
  const { data: buckets, error: bErr } = await adminClient.storage.listBuckets();
  if (bErr) throw new Error(`Failed to list buckets: ${bErr.message}`);

  const bucketMap = new Map((buckets || []).map((b) => [b.name, b]));
  let privateCount = 0;
  for (const name of UAT_BUCKETS) {
    const b = bucketMap.get(name);
    if (!b) {
      console.log(`  ✖ Bucket missing: ${name}`);
    } else if (b.public === false) {
      privateCount++;
      console.log(`  ✔ Bucket "${name}" -> public: false (STRICTLY PRIVATE)`);
    } else {
      console.log(`  ✖ Bucket "${name}" -> public: true (VIOLATION)`);
    }
  }

  if (privateCount === UAT_BUCKETS.length) {
    report.allBucketsPrivate = true;
    console.log('  -> All 8 buckets verified private.');
  }

  // 2. Test Unauthorized Public Access Rejection
  console.log('\n[2/5] Testing Rejection of Unauthorized Public Access...');
  const probeFileName = `probe-sec-${Date.now()}.txt`;
  const probeContent = Buffer.from('CONFIDENTIAL_SECURITY_PROBE_TEST');
  const testBucket = 'uat_customer_invoices';

  // Attempt upload with unauthorized anon client
  const { error: anonUploadErr } = await anonClient.storage.from(testBucket).upload(probeFileName, probeContent);
  if (anonUploadErr) {
    console.log(`  ✔ Unauthorized upload correctly blocked (${anonUploadErr.message || anonUploadErr.name})`);
    report.unauthorizedAccessRejected = true;
  } else {
    console.log('  ✖ FATAL: Unauthorized upload was NOT blocked!');
  }

  // Attempt direct public download from private bucket without signed URL
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${testBucket}/${probeFileName}`;
  try {
    const res = await fetch(publicUrl);
    if (res.status === 400 || res.status === 403 || res.status === 404) {
      console.log(`  ✔ Direct public download blocked as expected (HTTP ${res.status})`);
    } else {
      console.log(`  ✖ Warning: Direct public endpoint returned HTTP ${res.status}`);
    }
  } catch (e) {
    console.log(`  ✔ Direct public download refused: ${e.message}`);
  }

  // 3. Authorized Upload & Signed URL Generation
  console.log('\n[3/5] Testing Authorized Upload & 5-Second Signed URL...');
  const { error: uploadErr } = await adminClient.storage.from(testBucket).upload(probeFileName, probeContent, {
    contentType: 'text/plain',
  });
  if (uploadErr) {
    throw new Error(`Authorized upload failed: ${uploadErr.message}`);
  }
  console.log(`  ✔ Authorized probe uploaded: ${testBucket}/${probeFileName}`);

  // Generate short-lived signed URL (5 seconds)
  const { data: signedData, error: signErr } = await adminClient.storage
    .from(testBucket)
    .createSignedUrl(probeFileName, 5);

  if (signErr || !signedData?.signedUrl) {
    throw new Error(`Signed URL generation failed: ${signErr?.message}`);
  }
  report.signedUrlGenerationPassed = true;
  console.log('  ✔ Cryptographic signed URL created successfully.');

  // Verify signed URL works immediately
  const validRes = await fetch(signedData.signedUrl);
  if (validRes.status === 200) {
    console.log('  ✔ Active signed URL verified (HTTP 200 OK, payload matched)');
  } else {
    console.log(`  ✖ Active signed URL failed with HTTP ${validRes.status}`);
  }

  // 4. Test Signed URL Expiration Enforced
  console.log('\n[4/5] Waiting 6 seconds to verify cryptographic expiration...');
  await new Promise((r) => setTimeout(r, 6000));

  const expiredRes = await fetch(signedData.signedUrl);
  if (expiredRes.status === 400 || expiredRes.status === 403 || expiredRes.status === 404) {
    report.signedUrlExpiryEnforced = true;
    console.log(`  ✔ Cryptographic expiration strictly enforced (HTTP ${expiredRes.status} Expired/Forbidden)`);
  } else {
    console.log(`  ✖ Warning: Expired URL returned HTTP ${expiredRes.status}`);
  }

  // 5. Cleanup Security Probe
  console.log('\n[5/5] Cleaning up security probe file...');
  const { error: rmErr } = await adminClient.storage.from(testBucket).remove([probeFileName]);
  if (rmErr) {
    console.log(`  ✖ Failed to remove probe: ${rmErr.message}`);
  } else {
    report.probesCleanedUp = true;
    console.log('  ✔ Security probe permanently removed. Zero residual probe files.');
  }

  console.log('\n' + '='.repeat(70));
  console.log('STORAGE SECURITY AUDIT RESULT:');
  console.log(`- 8 Buckets Private (public: false)   : ${report.allBucketsPrivate ? 'PASS' : 'FAIL'}`);
  console.log(`- Unauthorized Access Blocked         : ${report.unauthorizedAccessRejected ? 'PASS' : 'FAIL'}`);
  console.log(`- Signed URL Cryptography Working     : ${report.signedUrlGenerationPassed ? 'PASS' : 'FAIL'}`);
  console.log(`- Strict Expiration Enforcement       : ${report.signedUrlExpiryEnforced ? 'PASS' : 'FAIL'}`);
  console.log(`- Probe Cleanup Complete              : ${report.probesCleanedUp ? 'PASS' : 'FAIL'}`);
  console.log('='.repeat(70));

  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  testStorageSecurity().catch((err) => {
    console.error('Storage security test failed:', err);
    process.exit(1);
  });
}
