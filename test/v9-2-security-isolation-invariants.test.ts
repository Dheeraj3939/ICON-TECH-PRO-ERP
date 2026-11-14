import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('V9.2 Security Isolation Invariants Verification', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('INVARIANT 1: src/lib/supabase/server.ts createClient() throws if publishable/anon key is missing even if service role key exists', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalPubKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const originalSecret = process.env.SUPABASE_SECRET_KEY;
    const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      // Set Supabase URL and service-role keys, but REMOVE publishable and anon keys
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://njylssodwvaonbeebvjq.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_key_do_not_use';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_service_role_test_key_do_not_use';

      // Dynamically import or invoke createClient
      const { createClient } = await import('@/lib/supabase/server');

      // Calling createClient must throw an error complaining about missing publishable/anon key
      await assert.rejects(
        async () => {
          await createClient();
        },
        (err: Error) => {
          assert.match(
            err.message,
            /Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \/ NEXT_PUBLIC_SUPABASE_ANON_KEY/,
            'createClient() must fail closed without anon/publishable key and NEVER fall back to service role key'
          );
          return true;
        }
      );
    } finally {
      // Restore env
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (originalPubKey) process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalPubKey;
      else delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (originalAnonKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
      else delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (originalSecret) process.env.SUPABASE_SECRET_KEY = originalSecret;
      else delete process.env.SUPABASE_SECRET_KEY;
      if (originalServiceRole) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  it('INVARIANT 2: src/lib/supabase/server.ts source code contains zero references to secret or service-role keys', () => {
    const serverClientSource = fs.readFileSync(
      path.join(rootDir, 'src', 'lib', 'supabase', 'server.ts'),
      'utf8'
    );

    // Verify there are no functional references to SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY
    // Only comments explaining why they are barred are allowed.
    const nonCommentLines = serverClientSource
      .split('\n')
      .map(line => line.trim())
      .filter(line => !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'));

    const codeBody = nonCommentLines.join('\n');
    assert.strictEqual(
      codeBody.includes('SUPABASE_SECRET_KEY'),
      false,
      'server.ts must not reference SUPABASE_SECRET_KEY in code'
    );
    assert.strictEqual(
      codeBody.includes('SUPABASE_SERVICE_ROLE_KEY'),
      false,
      'server.ts must not reference SUPABASE_SERVICE_ROLE_KEY in code'
    );
    assert.match(codeBody, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    assert.match(codeBody, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('INVARIANT 3: src/lib/supabase/admin.ts createAdminClient() blocks execution if invoked in browser environment', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');

    // Simulate browser window global
    (globalThis as any).window = {};

    try {
      assert.throws(
        () => {
          createAdminClient();
        },
        (err: Error) => {
          assert.match(
            err.message,
            /FATAL SECURITY VIOLATION: SUPABASE_SERVICE_ROLE_KEY attempted to be invoked in browser\/client environment!/
          );
          return true;
        }
      );
    } finally {
      delete (globalThis as any).window;
    }
  });

  it('INVARIANT 4: src/lib/integrations/gmail-token.ts does NOT contain "use server" directive', () => {
    const tokenSource = fs.readFileSync(
      path.join(rootDir, 'src', 'lib', 'integrations', 'gmail-token.ts'),
      'utf8'
    );

    const nonCommentLines = tokenSource
      .split('\n')
      .map(line => line.trim())
      .filter(line => !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'));

    const hasUseServer = nonCommentLines.some(
      line => line === "'use server';" || line === "'use server'" || line === '"use server";' || line === '"use server"'
    );

    assert.strictEqual(
      hasUseServer,
      false,
      "gmail-token.ts must NOT contain 'use server' directive (must never be exposed as Server Actions)"
    );
  });

  it('INVARIANT 5: src/lib/actions/gmail.ts does NOT export token decryption or retrieval functions', () => {
    const actionsSource = fs.readFileSync(
      path.join(rootDir, 'src', 'lib', 'actions', 'gmail.ts'),
      'utf8'
    );

    const exportedLines = actionsSource
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('export '));

    for (const line of exportedLines) {
      assert.strictEqual(
        line.includes('getFreshAccessToken'),
        false,
        `Forbidden export in gmail.ts: ${line}`
      );
      assert.strictEqual(
        line.includes('saveGmailOAuthTokens'),
        false,
        `Forbidden export in gmail.ts: ${line}`
      );
      assert.strictEqual(
        line.includes('decryptToken'),
        false,
        `Forbidden export in gmail.ts: ${line}`
      );
      assert.strictEqual(
        line.includes('encryptToken'),
        false,
        `Forbidden export in gmail.ts: ${line}`
      );
    }
  });

  it('INVARIANT 6: User-facing public status getGmailConnectionStatus() never exposes secret tokens', async () => {
    const { getGmailConnectionStatus } = await import('@/lib/actions/gmail');
    const status = await getGmailConnectionStatus();

    // Verify properties on status
    assert.ok(typeof status.connected === 'boolean');
    assert.ok(typeof status.status === 'string');
    assert.strictEqual((status as any).accessToken, undefined);
    assert.strictEqual((status as any).refreshToken, undefined);
    assert.strictEqual((status as any).encrypted_access_token, undefined);
    assert.strictEqual((status as any).encrypted_refresh_token, undefined);
    assert.strictEqual((status as any).clientSecret, undefined);
  });

  it('INVARIANT 7: Attachment API route (/api/integrations/gmail/attachment) enforces executive RBAC and streams data directly', () => {
    const attachmentRouteSource = fs.readFileSync(
      path.join(rootDir, 'src', 'app', 'api', 'integrations', 'gmail', 'attachment', 'route.ts'),
      'utf8'
    );

    // Verify it requires Executive access
    assert.match(attachmentRouteSource, /Managing Director/);
    assert.match(attachmentRouteSource, /Admin \/ BDM/);
    assert.match(attachmentRouteSource, /status:\s*403/);
    assert.match(attachmentRouteSource, /Content-Disposition/);
    // Verify it doesn't return any token json
    assert.strictEqual(
      attachmentRouteSource.includes('accessToken:'),
      false,
      'Attachment route must not return tokens'
    );
  });
});
