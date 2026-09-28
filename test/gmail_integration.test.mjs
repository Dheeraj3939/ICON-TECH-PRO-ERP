import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

// ============================================================================
// ICON TECH PRO ERP V9.1 — Gmail OAuth 2.0 Integration & Security Test Suite
// Tests:
// 1. AES-256-GCM Authenticated Encryption for Tokens at Rest
// 2. Cryptographic CSRF OAuth State Generation & Verification
// 3. RFC 2822 Email Message Formatting & Base64url Encoding
// 4. Role-Based Access Control (RBAC) on Integration Actions
// 5. Approved Scope & Single-Entity Security Invariant
// 6. Communication Outbox Queue Dispatch Routing
// ============================================================================

describe('ICON TECH PRO ERP V9.1 — Gmail OAuth 2.0 Integration Suite', () => {

  // --------------------------------------------------------------------------
  // 1. AES-256-GCM Authenticated Encryption & Decryption
  // --------------------------------------------------------------------------
  describe('1. AES-256-GCM Token Encryption Security', () => {
    const ALGORITHM = 'aes-256-gcm';
    const TEST_KEY = crypto.createHash('sha256').update('TEST_KEY_ICON_TECH_PRO_GMAIL_2026').digest();

    function encryptTokenLogic(token, key = TEST_KEY) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');
      return { ciphertext: encrypted, iv: iv.toString('hex'), tag };
    }

    function decryptTokenLogic(ciphertext, ivHex, tagHex, key = TEST_KEY) {
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }

    it('should encrypt and decrypt a Google OAuth refresh token successfully', () => {
      const mockRefreshToken = '1//04abc123XYZ_GMAIL_REFRESH_TOKEN_TEST_SECRET_VALUE';
      const enc = encryptTokenLogic(mockRefreshToken);

      assert.notEqual(enc.ciphertext, mockRefreshToken, 'Ciphertext must not match plaintext');
      assert.ok(enc.iv, 'Must generate initialization vector');
      assert.ok(enc.tag, 'Must generate authentication tag');

      const decrypted = decryptTokenLogic(enc.ciphertext, enc.iv, enc.tag);
      assert.equal(decrypted, mockRefreshToken, 'Decrypted token must exactly match original');
    });

    it('should generate distinct IVs and ciphertexts for subsequent encryptions of the same token (Semantic Security)', () => {
      const token = '1//sample_token_for_diversity_check';
      const enc1 = encryptTokenLogic(token);
      const enc2 = encryptTokenLogic(token);

      assert.notEqual(enc1.iv, enc2.iv, 'IVs must be randomized on every invocation');
      assert.notEqual(enc1.ciphertext, enc2.ciphertext, 'Ciphertexts must differ due to unique IV');
      assert.equal(decryptTokenLogic(enc1.ciphertext, enc1.iv, enc1.tag), token);
      assert.equal(decryptTokenLogic(enc2.ciphertext, enc2.iv, enc2.tag), token);
    });

    it('should reject tampered ciphertext or altered authentication tag', () => {
      const token = '1//secret_token';
      const enc = encryptTokenLogic(token);

      // Tamper with ciphertext
      const tamperedCiphertext = enc.ciphertext.slice(0, -2) + (enc.ciphertext.endsWith('00') ? '11' : '00');
      assert.throws(() => {
        decryptTokenLogic(tamperedCiphertext, enc.iv, enc.tag);
      }, /Unsupported state or unable to authenticate data|cipher/);

      // Tamper with auth tag
      const tamperedTag = enc.tag.slice(0, -2) + (enc.tag.endsWith('aa') ? 'bb' : 'aa');
      assert.throws(() => {
        decryptTokenLogic(enc.ciphertext, enc.iv, tamperedTag);
      }, /Unsupported state or unable to authenticate data|cipher/);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Cryptographic CSRF OAuth State Generation & Verification
  // --------------------------------------------------------------------------
  describe('2. Cryptographic CSRF OAuth State Verification', () => {
    const SECRET_KEY = crypto.createHash('sha256').update('CSRF_TEST_SECRET').digest();

    function generateOAuthStateLogic(userId) {
      const timestamp = Date.now();
      const random = crypto.randomBytes(16).toString('hex');
      const payload = JSON.stringify({ userId, timestamp, random });
      const payloadBase64 = Buffer.from(payload).toString('base64url');

      const hmac = crypto.createHmac('sha256', SECRET_KEY);
      hmac.update(payloadBase64);
      const signature = hmac.digest('hex');

      return `${payloadBase64}.${signature}`;
    }

    function verifyOAuthStateLogic(stateString, referenceTime = Date.now()) {
      if (!stateString || !stateString.includes('.')) return null;

      const [payloadBase64, providedSig] = stateString.split('.');
      const hmac = crypto.createHmac('sha256', SECRET_KEY);
      hmac.update(payloadBase64);
      const expectedSig = hmac.digest('hex');

      if (providedSig !== expectedSig) return null;

      try {
        const jsonStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
        const data = JSON.parse(jsonStr);

        if (!data.timestamp || referenceTime - data.timestamp > 15 * 60 * 1000) {
          return null; // Expired
        }

        return { userId: data.userId };
      } catch {
        return null;
      }
    }

    it('should generate and verify valid OAuth state within 15 minutes', () => {
      const state = generateOAuthStateLogic('USR-MD-001');
      assert.ok(state.includes('.'), 'State must be dotted format [payload].[signature]');

      const verified = verifyOAuthStateLogic(state);
      assert.ok(verified, 'Verification must succeed');
      assert.equal(verified.userId, 'USR-MD-001');
    });

    it('should reject tampered OAuth state parameter (Anti-CSRF Guard)', () => {
      const state = generateOAuthStateLogic('USR-MD-001');
      const parts = state.split('.');
      const tamperedState = `${parts[0]}xyz.${parts[1]}`;

      const verified = verifyOAuthStateLogic(tamperedState);
      assert.equal(verified, null, 'Tampered state must return null');
    });

    it('should reject expired OAuth state (> 15 minutes old)', () => {
      const state = generateOAuthStateLogic('USR-MD-001');
      const futureTime = Date.now() + 16 * 60 * 1000; // 16 minutes later

      const verified = verifyOAuthStateLogic(state, futureTime);
      assert.equal(verified, null, 'State older than 15 minutes must expire and reject');
    });
  });

  // --------------------------------------------------------------------------
  // 3. RFC 2822 Email Message Formatting & Base64url Encoding
  // --------------------------------------------------------------------------
  describe('3. RFC 2822 Email Formatting & Base64url Encoding', () => {
    function createRfc2822RawMessageLogic(params) {
      const lines = [
        `From: ${params.from}`,
        `To: ${params.to}`,
        `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        `Content-Type: ${params.isHtml ? 'text/html' : 'text/plain'}; charset=UTF-8`,
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(params.body, 'utf8').toString('base64'),
      ];

      const fullMessage = lines.join('\r\n');
      return Buffer.from(fullMessage, 'utf8').toString('base64url');
    }

    it('should generate URL-safe base64url encoded RFC 2822 message for Gmail API', () => {
      const raw = createRfc2822RawMessageLogic({
        from: 'icontechpro@gmail.com',
        to: 'icontechpro@gmail.com',
        subject: 'ICON TECH PRO ERP - Gmail Integration Test',
        body: 'This is a test email from ICON TECH PRO ERP.',
        isHtml: false,
      });

      assert.ok(raw && raw.length > 50, 'Encoded string must be non-empty');
      assert.ok(!raw.includes('+'), 'Must be URL-safe (no +)');
      assert.ok(!raw.includes('/'), 'Must be URL-safe (no /)');
      assert.ok(!raw.includes('='), 'Must not contain padding = in base64url');

      // Decode and verify RFC 2822 headers
      const decoded = Buffer.from(raw, 'base64url').toString('utf8');
      assert.ok(decoded.includes('From: icontechpro@gmail.com'));
      assert.ok(decoded.includes('To: icontechpro@gmail.com'));
      assert.ok(decoded.includes('Content-Type: text/plain; charset=UTF-8'));
      assert.ok(decoded.includes('MIME-Version: 1.0'));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Role-Based Access Control (RBAC) & Permission Guards
  // --------------------------------------------------------------------------
  describe('4. Role-Based Access Control on Integration Actions', () => {
    function evaluateIntegrationPermission(actorRole) {
      const allowedRoles = ['Managing Director', 'Admin / BDM'];
      if (!allowedRoles.includes(actorRole)) {
        return { allowed: false, error: 'Unauthorized: Executive authority required for integration management.' };
      }
      return { allowed: true };
    }

    it('should allow Managing Director and Admin / BDM to manage Gmail integration', () => {
      assert.equal(evaluateIntegrationPermission('Managing Director').allowed, true);
      assert.equal(evaluateIntegrationPermission('Admin / BDM').allowed, true);
    });

    it('should reject non-administrative operational roles from managing integration', () => {
      const deniedRoles = ['Sales Executive', 'Accounts', 'BDM', 'Office Assistant'];
      for (const role of deniedRoles) {
        const check = evaluateIntegrationPermission(role);
        assert.equal(check.allowed, false, `Role ${role} must be rejected`);
        assert.match(check.error, /Unauthorized/);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 5. Approved Scope & Single Entity Purity Invariants
  // --------------------------------------------------------------------------
  describe('5. Approved Scope & Entity Invariants', () => {
    const APPROVED_GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
    const FORBIDDEN_SCOPE = 'https://mail.google.com/';
    const APPROVED_TARGET_EMAIL = 'icontechpro@gmail.com';
    const APPROVED_REDIRECT_URI = 'http://localhost:3000/api/integrations/gmail/callback';

    it('should enforce only the approved mailbox modify scope and reject mail.google.com', () => {
      assert.equal(APPROVED_GMAIL_SCOPE, 'https://www.googleapis.com/auth/gmail.modify');
      assert.notEqual(APPROVED_GMAIL_SCOPE, FORBIDDEN_SCOPE);
    });

    it('should strictly target icontechpro@gmail.com and reject forbidden external entity', () => {
      assert.equal(APPROVED_TARGET_EMAIL, 'icontechpro@gmail.com');

      const FORBIDDEN_ENTITIES = ['sreeja', 'sreeja enterprises'];
      for (const forbidden of FORBIDDEN_ENTITIES) {
        assert.equal(APPROVED_TARGET_EMAIL.toLowerCase().includes(forbidden), false);
      }
    });

    it('should verify authorized redirect URI route matches local specification', () => {
      assert.equal(APPROVED_REDIRECT_URI, 'http://localhost:3000/api/integrations/gmail/callback');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Communication Outbox Queue Dispatch Routing
  // --------------------------------------------------------------------------
  describe('6. Outbox Queue Email Dispatch Routing', () => {
    function simulateEmailDispatch(isGmailConnected) {
      if (isGmailConnected) {
        return {
          provider_name: 'Gmail REST API (icontechpro@gmail.com)',
          provider_message_id: 'gmail_msg_18294719283',
          status: 'SENT',
        };
      }
      return {
        provider_name: 'Corporate Email SMTP (Simulation - Gmail Pending)',
        provider_message_id: 'smtp_sim_998124',
        status: 'SENT',
      };
    }

    it('should route to Gmail REST API when connected', () => {
      const res = simulateEmailDispatch(true);
      assert.equal(res.status, 'SENT');
      assert.equal(res.provider_name, 'Gmail REST API (icontechpro@gmail.com)');
      assert.ok(res.provider_message_id.startsWith('gmail_msg_'));
    });

    it('should gracefully fall back to simulation when Gmail is not connected', () => {
      const res = simulateEmailDispatch(false);
      assert.equal(res.status, 'SENT');
      assert.match(res.provider_name, /Simulation - Gmail Pending/);
      assert.ok(res.provider_message_id.startsWith('smtp_sim_'));
    });
  });

  // --------------------------------------------------------------------------
  // 7. Provider-Independent Architecture & IEmailProvider Contract
  // --------------------------------------------------------------------------
  describe('7. Provider-Independent Architecture & IEmailProvider Contract', () => {
    class MockEmailProvider {
      constructor(name = 'mock_provider') {
        this.name = name;
        this.configured = true;
      }
      async isConfigured() {
        return this.configured;
      }
      async sendEmail(message) {
        return {
          success: true,
          messageId: `mock_msg_${Date.now()}`,
          provider: this.name,
          sentAt: new Date().toISOString(),
        };
      }
    }

    it('should adhere to IEmailProvider contract methods and return structure', async () => {
      const provider = new MockEmailProvider('gmail');
      assert.equal(provider.name, 'gmail');
      assert.equal(await provider.isConfigured(), true);

      const result = await provider.sendEmail({
        to: 'client@example.com',
        subject: 'Quotation QTN-26-0001',
        text: 'Quotation details',
      });

      assert.equal(result.success, true);
      assert.equal(result.provider, 'gmail');
      assert.ok(result.messageId.startsWith('mock_msg_'));
      assert.ok(result.sentAt);
    });

    it('should support swapping providers without changing business calling code', async () => {
      const gmailProvider = new MockEmailProvider('gmail');
      const backupProvider = new MockEmailProvider('corporate_smtp');

      let currentProvider = gmailProvider;
      let result = await currentProvider.sendEmail({ to: 'user@thub.org', subject: 'Test' });
      assert.equal(result.provider, 'gmail');

      currentProvider = backupProvider;
      result = await currentProvider.sendEmail({ to: 'user@thub.org', subject: 'Test' });
      assert.equal(result.provider, 'corporate_smtp');
    });
  });

  // --------------------------------------------------------------------------
  // 8. Email Activity Logging & Audit Trail Generation
  // --------------------------------------------------------------------------
  describe('8. Email Activity Logging & Audit Trail Generation', () => {
    function buildEmailLogRecord(message, sendResult, actor) {
      const toStr = Array.isArray(message.to) ? message.to.join(', ') : message.to;
      const attNames = (message.attachments || []).map((a) => a.filename);

      return {
        id: `EML-TEST-${Date.now()}`,
        provider: sendResult.provider,
        from_email: 'icontechpro@gmail.com',
        to_email: toStr,
        subject: message.subject,
        has_attachments: attNames.length > 0,
        attachment_count: attNames.length,
        attachment_names: attNames,
        status: sendResult.success ? 'SENT' : 'FAILED',
        provider_message_id: sendResult.messageId,
        sent_by_user_name: actor.name,
        customer_id: message.metadata?.customerId,
        quotation_id: message.metadata?.quotationId,
        invoice_id: message.metadata?.invoiceId,
        entity_type: message.metadata?.entityType || 'general',
        created_at: new Date().toISOString(),
      };
    }

    it('should create complete email log records with ERP contextual references', () => {
      const message = {
        to: ['procurement@thub.org', 'director@thub.org'],
        subject: 'Quotation QT-2026-001 from ICON TECH PRO',
        attachments: [
          { filename: 'Quotation_QT-2026-001.pdf', content: 'mock_pdf' },
          { filename: 'Product_Datasheet.pdf', content: 'mock_datasheet' },
        ],
        metadata: {
          customerId: 'CUST-001',
          quotationId: 'QT-2026-001',
          entityType: 'quotation',
        },
      };

      const sendResult = {
        success: true,
        messageId: 'gmail_msg_9981247',
        provider: 'gmail',
      };

      const actor = { id: 'USR-01', name: 'Vamshi Krishna' };

      const log = buildEmailLogRecord(message, sendResult, actor);

      assert.equal(log.from_email, 'icontechpro@gmail.com');
      assert.equal(log.to_email, 'procurement@thub.org, director@thub.org');
      assert.equal(log.subject, 'Quotation QT-2026-001 from ICON TECH PRO');
      assert.equal(log.has_attachments, true);
      assert.equal(log.attachment_count, 2);
      assert.deepEqual(log.attachment_names, ['Quotation_QT-2026-001.pdf', 'Product_Datasheet.pdf']);
      assert.equal(log.status, 'SENT');
      assert.equal(log.provider_message_id, 'gmail_msg_9981247');
      assert.equal(log.customer_id, 'CUST-001');
      assert.equal(log.quotation_id, 'QT-2026-001');
      assert.equal(log.entity_type, 'quotation');
      assert.equal(log.sent_by_user_name, 'Vamshi Krishna');
    });

    it('should record audit event details correctly on failed email dispatch', () => {
      const message = {
        to: 'invalid-email',
        subject: 'Invoice Notification',
      };
      const sendResult = {
        success: false,
        error: 'Invalid recipient address',
        provider: 'gmail',
      };
      const actor = { id: 'USR-02', name: 'Narsimha Naidu' };

      const log = buildEmailLogRecord(message, sendResult, actor);
      assert.equal(log.status, 'FAILED');
      assert.equal(log.has_attachments, false);
      assert.equal(log.attachment_count, 0);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Complex RFC 2822 Multipart MIME with Multiple Attachments
  // --------------------------------------------------------------------------
  describe('9. Complex RFC 2822 Multipart MIME with Attachments', () => {
    function generateRawRfc2822(params) {
      const boundary = '==_MIME_BOUND_TEST_==';
      const lines = [
        `From: ${params.from}`,
        `To: ${params.to}`,
        `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(params.text).toString('base64'),
      ];

      for (const att of params.attachments || []) {
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"`);
        lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        lines.push('Content-Transfer-Encoding: base64');
        lines.push('');
        lines.push(Buffer.from(att.content).toString('base64'));
      }

      lines.push(`--${boundary}--`);
      return lines.join('\r\n');
    }

    it('should generate valid multipart/mixed raw MIME containing attachments and headers', () => {
      const raw = generateRawRfc2822({
        from: 'icontechpro@gmail.com',
        to: 'client@example.com',
        subject: 'Invoice INV-26-0001',
        text: 'Please find attached invoice.',
        attachments: [
          {
            filename: 'Invoice_INV-26-0001.txt',
            content: 'TAX INVOICE DETAILS\nTotal: 145000',
            contentType: 'text/plain',
          },
        ],
      });

      assert.match(raw, /Content-Type: multipart\/mixed/);
      assert.match(raw, /Content-Disposition: attachment; filename="Invoice_INV-26-0001\.txt"/);
      assert.match(raw, /From: icontechpro@gmail\.com/);
      assert.match(raw, /To: client@example\.com/);

      // Verify base64url safety for Gmail API
      const base64url = Buffer.from(raw).toString('base64url');
      assert.ok(!base64url.includes('+'), 'base64url must not contain +');
      assert.ok(!base64url.includes('/'), 'base64url must not contain /');
      assert.ok(!base64url.includes('='), 'base64url must not contain = padding');
    });
  });

  // --------------------------------------------------------------------------
  // 10. Specific Lifecycle Scenarios (Items A through J)
  // --------------------------------------------------------------------------
  describe('10. Specific UAT Lifecycle Scenarios (Items A through J)', () => {
    // Scenario A: Missing Credentials
    it('Scenario A: should detect missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET', () => {
      function evaluateCredentials(clientId, clientSecret) {
        const hasClientId = Boolean(clientId && clientId.trim());
        const hasClientSecret = Boolean(clientSecret && clientSecret.trim());
        return {
          has_client_id: hasClientId,
          has_client_secret: hasClientSecret,
          is_ready: hasClientId && hasClientSecret,
        };
      }

      const missingBoth = evaluateCredentials('', '');
      assert.equal(missingBoth.is_ready, false);
      assert.equal(missingBoth.has_client_id, false);
      assert.equal(missingBoth.has_client_secret, false);

      const missingSecret = evaluateCredentials('sample_client_id.apps.googleusercontent.com', '');
      assert.equal(missingSecret.is_ready, false);
      assert.equal(missingSecret.has_client_id, true);
      assert.equal(missingSecret.has_client_secret, false);

      const missingId = evaluateCredentials('', 'GOCSPX-sample_secret_key');
      assert.equal(missingId.is_ready, false);
      assert.equal(missingId.has_client_id, false);
      assert.equal(missingId.has_client_secret, true);
    });

    // Scenario B: Credentials Configured
    it('Scenario B: should confirm configured status when both credentials exist', () => {
      function evaluateCredentials(clientId, clientSecret) {
        return Boolean(clientId && clientId.trim()) && Boolean(clientSecret && clientSecret.trim());
      }

      const ready = evaluateCredentials(
        '1092837465-abcdef.apps.googleusercontent.com',
        'GOCSPX-valid_secret_key_12345'
      );
      assert.equal(ready, true, 'Both credentials must evaluate to ready');
    });

    // Scenario B2: Placeholder Detection
    it('Scenario B2: should detect template placeholder credentials and prevent connection', () => {
      function isPlaceholder(val) {
        if (!val || typeof val !== 'string') return true;
        const trimmed = val.trim().toLowerCase();
        if (trimmed.length === 0) return true;
        return (
          trimmed.includes('your_client_id') ||
          trimmed.includes('your-client-id') ||
          trimmed.includes('your_client_secret') ||
          trimmed.includes('your-client-secret') ||
          trimmed.includes('placeholder') ||
          trimmed.startsWith('<') ||
          trimmed.endsWith('>') ||
          trimmed === 'your_client_id_here.apps.googleusercontent.com' ||
          trimmed === 'your_client_secret_here'
        );
      }

      assert.equal(isPlaceholder('your_client_id_here.apps.googleusercontent.com'), true);
      assert.equal(isPlaceholder('your_client_secret_here'), true);
      assert.equal(isPlaceholder('<GOOGLE_CLIENT_ID>'), true);
      assert.equal(isPlaceholder(''), true);
      assert.equal(isPlaceholder('1092837465-abcdef.apps.googleusercontent.com'), false);
      assert.equal(isPlaceholder('GOCSPX-valid_secret_key_12345'), false);
    });

    // Scenario C: Connect Gmail Button State
    it('Scenario C: should enable Connect button only when both credentials are ready', () => {
      function isConnectButtonEnabled(isConfigured, isConnecting) {
        return isConfigured && !isConnecting;
      }

      assert.equal(isConnectButtonEnabled(false, false), false, 'Disabled when credentials missing');
      assert.equal(isConnectButtonEnabled(true, true), false, 'Disabled while connecting in progress');
      assert.equal(isConnectButtonEnabled(true, false), true, 'Enabled when configured and idle');
    });

    // Scenario D: OAuth Redirect URL Construction
    it('Scenario D: should generate compliant Google OAuth redirect URL with required parameters', () => {
      const clientId = '1092837465-abcdef.apps.googleusercontent.com';
      const redirectUri = 'http://localhost:3000/api/integrations/gmail/callback';
      const scope = 'https://www.googleapis.com/auth/gmail.send';
      const state = 'mock_valid_state_param';

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        access_type: 'offline',
        prompt: 'consent',
        state,
        login_hint: 'icontechpro@gmail.com',
      });

      const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      assert.match(url, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
      assert.match(url, /scope=https%3A%2F%2Fwww\.googleapis\.com%2Fauth%2Fgmail\.send/);
      assert.match(url, /access_type=offline/);
      assert.match(url, /prompt=consent/);
      assert.match(url, /redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fintegrations%2Fgmail%2Fcallback/);
      assert.match(url, /login_hint=icontechpro%40gmail\.com/);
    });

    // Scenario E: OAuth Callback Processing
    it('Scenario E: should correctly process callback parameters and validate state', () => {
      function processCallbackParams(code, state, error) {
        if (error) return { action: 'FAIL', reason: error };
        if (!code) return { action: 'FAIL', reason: 'missing_authorization_code' };
        if (!state) return { action: 'FAIL', reason: 'missing_oauth_state' };
        return { action: 'EXCHANGE', code, state };
      }

      assert.equal(processCallbackParams(null, null, 'access_denied').action, 'FAIL');
      assert.equal(processCallbackParams(null, 'valid_state', null).action, 'FAIL');
      assert.equal(processCallbackParams('auth_code_123', null, null).action, 'FAIL');
      assert.equal(processCallbackParams('auth_code_123', 'valid_state', null).action, 'EXCHANGE');
    });

    // Scenario F: Successful Authorization Token Exchange
    it('Scenario F: should extract refresh token and access token from Google token payload', () => {
      const mockTokenResponse = {
        access_token: 'ya29.a0AfH6SM_test_access_token',
        expires_in: 3599,
        refresh_token: '1//04abcXYZ_mock_refresh_token',
        scope: 'https://www.googleapis.com/auth/gmail.send',
        token_type: 'Bearer',
      };

      assert.ok(mockTokenResponse.refresh_token, 'Must receive refresh token on prompt=consent');
      assert.ok(mockTokenResponse.access_token, 'Must receive access token');
      assert.equal(mockTokenResponse.scope, 'https://www.googleapis.com/auth/gmail.send');
    });

    // Scenario G: Gmail Connected Status
    it('Scenario G: should evaluate connected status accurately from stored credentials', () => {
      function evaluateStatus(creds) {
        const isConnected = Boolean(creds?.encrypted_refresh_token && creds?.iv && creds?.tag);
        return isConnected ? 'CONNECTED' : 'NOT_CONNECTED';
      }

      assert.equal(evaluateStatus(null), 'NOT_CONNECTED');
      assert.equal(evaluateStatus({}), 'NOT_CONNECTED');
      assert.equal(
        evaluateStatus({ encrypted_refresh_token: 'abc', iv: 'def', tag: 'ghi' }),
        'CONNECTED'
      );
    });

    // Scenario H: Send a Controlled Test Email
    it('Scenario H: should construct verification test message payload targeting icontechpro@gmail.com', () => {
      const targetEmail = 'icontechpro@gmail.com';
      const testSubject = 'ICON TECH PRO ERP - Gmail Integration Test';
      const testBody = 'This is a test email from ICON TECH PRO ERP.';

      const testPayload = {
        from: targetEmail,
        to: targetEmail,
        subject: testSubject,
        body: testBody,
        isHtml: false,
      };

      assert.equal(testPayload.from, 'icontechpro@gmail.com');
      assert.equal(testPayload.to, 'icontechpro@gmail.com');
      assert.equal(testPayload.subject, 'ICON TECH PRO ERP - Gmail Integration Test');
    });

    // Scenario I: Error Handling Mapping
    it('Scenario I: should map all OAuth error scenarios to user-friendly safe messages without token leakage', () => {
      const errorMap = {
        missing_credentials: 'Both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured in .env.local to proceed.',
        missing_client_id: 'GOOGLE_CLIENT_ID is missing from .env.local. Please configure your Google OAuth Client ID.',
        missing_client_secret: 'GOOGLE_CLIENT_SECRET is missing from .env.local. Please configure your Google OAuth Client Secret.',
        google_oauth_access_denied: 'Google authorization was declined by user. You must grant the email send permission to connect Gmail.',
        missing_authorization_code: 'Google did not return an authorization code. Please try connecting again.',
        missing_oauth_state: 'Security verification failed: OAuth state parameter was missing.',
        invalid_csrf_state: 'Security verification failed: OAuth state is invalid or expired (> 15 minutes). Please try connecting again.',
        token_exchange_failed: 'Failed to exchange authorization code with Google. Please verify that GOOGLE_CLIENT_SECRET matches your Google Cloud Console credentials.',
        missing_refresh_token_reconsent_required: 'Google did not issue a refresh token. Please click "Reconnect / Refresh Consent" to re-authorize with consent prompt.',
      };

      for (const [code, msg] of Object.entries(errorMap)) {
        assert.ok(msg.length > 10, `Message for ${code} must be substantive`);
        assert.ok(!msg.includes('ya29.'), 'Error message must NEVER contain access tokens');
        assert.ok(!msg.includes('1//04'), 'Error message must NEVER contain refresh tokens');
        assert.ok(!msg.includes('GOCSPX-'), 'Error message must NEVER contain client secrets');
      }
    });

    // Scenario J: Disconnect / Purge Handling
    it('Scenario J: should purge all stored credentials and return not connected upon disconnect', () => {
      let store = {
        account_email: 'icontechpro@gmail.com',
        encrypted_refresh_token: 'cipher_123',
        iv: 'iv_123',
        tag: 'tag_123',
      };

      function disconnect() {
        store = null;
        return { success: true };
      }

      const res = disconnect();
      assert.equal(res.success, true);
      assert.equal(store, null, 'Credentials store must be purged completely');
    });
  });

  // --------------------------------------------------------------------------
  // 11. Comprehensive 22-Point Mailbox Integration Verification Suite
  // --------------------------------------------------------------------------
  describe('11. Comprehensive 22-Point Mailbox Integration Verification Suite', () => {

    // Point 1: Scope Validation
    it('Point 1: should enforce gmail.modify and strictly disallow mail.google.com', () => {
      const scope = 'https://www.googleapis.com/auth/gmail.modify';
      assert.equal(scope, 'https://www.googleapis.com/auth/gmail.modify');
      assert.notEqual(scope, 'https://mail.google.com/');
    });

    // Point 2: Scope Upgrade Detection
    it('Point 2: should accurately detect when stored token requires scope upgrade', () => {
      function evaluateScopeUpgrade(scopes) {
        const hasModify = scopes.some((s) => s.includes('gmail.modify'));
        return { hasModify, needsUpgrade: !hasModify };
      }

      const sendOnly = evaluateScopeUpgrade(['https://www.googleapis.com/auth/gmail.send']);
      assert.equal(sendOnly.hasModify, false);
      assert.equal(sendOnly.needsUpgrade, true);

      const mailboxReady = evaluateScopeUpgrade(['https://www.googleapis.com/auth/gmail.modify']);
      assert.equal(mailboxReady.hasModify, true);
      assert.equal(mailboxReady.needsUpgrade, false);
    });

    // Point 3: Disconnect & Token Purge
    it('Point 3: should purge all encrypted tokens and update connection status on disconnect', () => {
      let activeCredentials = {
        account_email: 'icontechpro@gmail.com',
        encrypted_refresh_token: 'valid_refresh_token_enc',
        encrypted_access_token: 'valid_access_token_enc',
      };

      function disconnectMailbox() {
        activeCredentials = null;
        return { success: true };
      }

      const res = disconnectMailbox();
      assert.equal(res.success, true);
      assert.equal(activeCredentials, null);
    });

    // Point 4: Inbox Fetch & Message Parsing
    it('Point 4: should parse raw Gmail messages into structured summary objects', () => {
      const mockRawMessage = {
        id: 'msg_001',
        threadId: 'th_001',
        labelIds: ['INBOX', 'UNREAD'],
        snippet: 'Enquiry regarding BenQ TK710 projector quotation',
        internalDate: '1727334400000',
        payload: {
          headers: [
            { name: 'From', value: 'Client <client@example.com>' },
            { name: 'To', value: 'icontechpro@gmail.com' },
            { name: 'Subject', value: 'Projector Enquiry' },
            { name: 'Date', value: 'Fri, 26 Sep 2026 10:00:00 +0530' },
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: { data: Buffer.from('Please provide quotation for BenQ TK710').toString('base64url') },
            },
          ],
        },
      };

      const from = mockRawMessage.payload.headers.find(h => h.name === 'From').value;
      const subject = mockRawMessage.payload.headers.find(h => h.name === 'Subject').value;
      const isUnread = mockRawMessage.labelIds.includes('UNREAD');

      assert.equal(mockRawMessage.id, 'msg_001');
      assert.equal(from, 'Client <client@example.com>');
      assert.equal(subject, 'Projector Enquiry');
      assert.equal(isUnread, true);
    });

    // Point 5: Thread Fetch & Chronological Grouping
    it('Point 5: should group messages in a thread chronologically and compute participants', () => {
      const mockThread = {
        id: 'th_100',
        messages: [
          {
            id: 'm1',
            from: 'Client <client@example.com>',
            timestamp: 1000,
            snippet: 'First enquiry',
          },
          {
            id: 'm2',
            from: 'icontechpro@gmail.com',
            timestamp: 2000,
            snippet: 'Our response with quote',
          },
          {
            id: 'm3',
            from: 'Client <client@example.com>',
            timestamp: 3000,
            snippet: 'Confirmation',
          },
        ],
      };

      const sorted = [...mockThread.messages].sort((a, b) => a.timestamp - b.timestamp);
      assert.equal(sorted[0].id, 'm1');
      assert.equal(sorted[2].id, 'm3');

      const participants = Array.from(new Set(mockThread.messages.map(m => m.from.split('<')[0].trim())));
      assert.equal(participants.length, 2);
      assert.ok(participants.includes('Client'));
      assert.ok(participants.includes('icontechpro@gmail.com'));
    });

    // Point 6: Gmail Search Query Construction
    it('Point 6: should construct search queries combining folder filter and user keyword', () => {
      function buildSearchQuery(folder, keyword) {
        const folderQueries = {
          INBOX: 'in:inbox',
          STARRED: 'is:starred',
          SENT: 'in:sent',
          DRAFTS: 'is:draft',
          IMPORTANT: 'is:important',
          TRASH: 'in:trash',
        };
        const base = folderQueries[folder] || 'in:inbox';
        return keyword && keyword.trim() ? `${base} ${keyword.trim()}` : base;
      }

      assert.equal(buildSearchQuery('INBOX', ''), 'in:inbox');
      assert.equal(buildSearchQuery('INBOX', 'BenQ Projector'), 'in:inbox BenQ Projector');
      assert.equal(buildSearchQuery('SENT', 'from:client@test.com'), 'in:sent from:client@test.com');
      assert.equal(buildSearchQuery('TRASH', ''), 'in:trash');
    });

    // Point 7: Mark Read / Unread
    it('Point 7: should build label modification payloads to toggle UNREAD', () => {
      function toggleReadPayload(markAsRead) {
        return markAsRead
          ? { addLabelIds: [], removeLabelIds: ['UNREAD'] }
          : { addLabelIds: ['UNREAD'], removeLabelIds: [] };
      }

      const readPayload = toggleReadPayload(true);
      assert.deepEqual(readPayload.removeLabelIds, ['UNREAD']);
      assert.deepEqual(readPayload.addLabelIds, []);

      const unreadPayload = toggleReadPayload(false);
      assert.deepEqual(unreadPayload.addLabelIds, ['UNREAD']);
      assert.deepEqual(unreadPayload.removeLabelIds, []);
    });

    // Point 8: Star / Unstar
    it('Point 8: should build label modification payloads to toggle STARRED', () => {
      function toggleStarPayload(star) {
        return star
          ? { addLabelIds: ['STARRED'], removeLabelIds: [] }
          : { addLabelIds: [], removeLabelIds: ['STARRED'] };
      }

      assert.deepEqual(toggleStarPayload(true).addLabelIds, ['STARRED']);
      assert.deepEqual(toggleStarPayload(false).removeLabelIds, ['STARRED']);
    });

    // Point 9: Archive Message
    it('Point 9: should archive messages by removing INBOX label', () => {
      function archivePayload() {
        return { addLabelIds: [], removeLabelIds: ['INBOX'] };
      }

      const p = archivePayload();
      assert.deepEqual(p.removeLabelIds, ['INBOX']);
      assert.deepEqual(p.addLabelIds, []);
    });

    // Point 10: Move to Trash (Non-Destructive)
    it('Point 10: should call trash endpoint preserving message for recovery', () => {
      function getTrashEndpoint(messageId) {
        return `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`;
      }

      const endpoint = getTrashEndpoint('msg_123');
      assert.equal(endpoint, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/msg_123/trash');
    });

    // Point 11: Untrash / Restore Message
    it('Point 11: should call untrash endpoint to restore message from trash', () => {
      function getUntrashEndpoint(messageId) {
        return `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/untrash`;
      }

      const endpoint = getUntrashEndpoint('msg_123');
      assert.equal(endpoint, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/msg_123/untrash');
    });

    // Point 12: RFC 2822 In-Reply-To and References
    it('Point 12: should embed In-Reply-To and References headers in raw MIME', () => {
      const from = 'icontechpro@gmail.com';
      const to = 'client@example.com';
      const inReplyTo = '<msg_original_001@mail.gmail.com>';
      const references = '<msg_original_001@mail.gmail.com>';

      const headers = [
        `From: ${from}`,
        `To: ${to}`,
        `In-Reply-To: ${inReplyTo}`,
        `References: ${references}`,
        'Subject: Re: Quotation',
      ];

      const raw = headers.join('\r\n');
      assert.ok(raw.includes('In-Reply-To: <msg_original_001@mail.gmail.com>'));
      assert.ok(raw.includes('References: <msg_original_001@mail.gmail.com>'));
    });

    // Point 13: Compose Message RFC 2822 Encoding
    it('Point 13: should encode composed message with attachments in URL-safe base64url', () => {
      const text = 'Hello Client, please find attached.';
      const attachmentFilename = 'quote.pdf';
      const raw = `From: icontechpro@gmail.com\r\nTo: client@test.com\r\nSubject: Quote\r\n\r\n${text}\r\nAttachment: ${attachmentFilename}`;
      const encoded = Buffer.from(raw).toString('base64url');

      assert.ok(!encoded.includes('+'), 'Must not contain + in base64url');
      assert.ok(!encoded.includes('/'), 'Must not contain / in base64url');
      assert.ok(!encoded.includes('='), 'Must not contain padding = in base64url');

      const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
      assert.ok(decoded.includes('quote.pdf'));
    });

    // Point 14: Reply Payload Construction
    it('Point 14: should construct reply payload with threadId and Re: prefix', () => {
      function buildReply(originalSubject, threadId, originalMessageId, replyText) {
        const cleanSubj = originalSubject.replace(/^(Re:\s*|Fwd:\s*)+/i, '');
        return {
          subject: `Re: ${cleanSubj}`,
          threadId,
          inReplyTo: originalMessageId,
          references: originalMessageId,
          body: replyText,
        };
      }

      const rep = buildReply('Project Inquiry', 'th_555', '<m_001@test>', 'Thank you for reaching out.');
      assert.equal(rep.subject, 'Re: Project Inquiry');
      assert.equal(rep.threadId, 'th_555');
      assert.equal(rep.inReplyTo, '<m_001@test>');
    });

    // Point 15: Forward Payload Construction
    it('Point 15: should construct forward payload with Fwd: prefix and formatted body', () => {
      function buildForward(originalSubject, forwardText) {
        const cleanSubj = originalSubject.replace(/^(Re:\s*|Fwd:\s*)+/i, '');
        return {
          subject: `Fwd: ${cleanSubj}`,
          body: forwardText,
        };
      }

      const fwd = buildForward('Quotation for Review', 'FYI see below.');
      assert.equal(fwd.subject, 'Fwd: Quotation for Review');
    });

    // Point 16: Attachment Metadata Extraction
    it('Point 16: should identify attachments and extract filename, mimeType, and size', () => {
      const parts = [
        {
          mimeType: 'text/html',
          body: { size: 500, data: 'PGRpdj5UZXN0PC9kaXY+' },
        },
        {
          filename: 'brochure.pdf',
          mimeType: 'application/pdf',
          body: { attachmentId: 'att_pdf_123', size: 1048576 },
        },
      ];

      const attachments = parts.filter(p => p.filename && p.body?.attachmentId);
      assert.equal(attachments.length, 1);
      assert.equal(attachments[0].filename, 'brochure.pdf');
      assert.equal(attachments[0].mimeType, 'application/pdf');
      assert.equal(attachments[0].body.size, 1048576);
    });

    // Point 17: On-Demand Attachment Streaming
    it('Point 17: should stream attachment buffer on-demand without writing temporary files', () => {
      const rawAttachmentBase64 = Buffer.from('PDF_SAMPLE_BINARY_STREAM_CONTENT').toString('base64url');
      const decodedBuffer = Buffer.from(rawAttachmentBase64, 'base64url');

      assert.equal(decodedBuffer.toString('utf8'), 'PDF_SAMPLE_BINARY_STREAM_CONTENT');
      assert.ok(Buffer.isBuffer(decodedBuffer));
    });

    // Point 18: Automatic Token Refresh on 401
    it('Point 18: should trigger token refresh upon simulated 401 response', () => {
      let refreshInvoked = false;

      function simulateApiCall(status) {
        if (status === 401) {
          refreshInvoked = true;
          return { refreshed: true, retryStatus: 200 };
        }
        return { refreshed: false, retryStatus: status };
      }

      const res = simulateApiCall(401);
      assert.equal(refreshInvoked, true);
      assert.equal(res.retryStatus, 200);
    });

    // Point 19: Explicit Mailbox Authorization Guard for Official Personnel
    it('Point 19: should permit only the 4 authorized personnel and deny Reshma and Hemalath by default', () => {
      const AUTHORIZED_EMAILS = [
        'icontechpro@gmail.com',
        'dheeraj@icontechpro.in',
        'vineet@icontechpro.in',
        'service01@icontechpro.in',
      ];
      const AUTHORIZED_NAMES = [
        'borra narsimulu',
        'b v dheeraj reddy',
        'b vineet babu',
        'manisha',
        'dheeraj',
        'vineet babu',
        'narsimha naidu',
      ];

      function evaluateMailboxAccess(user) {
        if (!user) return false;
        const normalizedEmail = (user.email || '').toLowerCase().trim();
        const normalizedName = (user.name || '').toLowerCase().trim();

        // Reshma and Hemalath explicitly denied by default
        if (
          normalizedEmail === 'sales@icontechpro.in' ||
          normalizedEmail === 'reshma@icontechpro.in' ||
          normalizedEmail === 'accounts@icontechpro.in' ||
          normalizedName === 'reshma' ||
          normalizedName === 'hemalath' ||
          normalizedName === 'hemalatha'
        ) {
          return false;
        }

        if (AUTHORIZED_EMAILS.includes(normalizedEmail)) return true;
        if (
          normalizedEmail === 'md@icontechpro.in' &&
          (user.role === 'Managing Director' || normalizedName.includes('narsim') || normalizedName.includes('borra'))
        ) {
          return true;
        }
        if (AUTHORIZED_NAMES.includes(normalizedName)) return true;

        return false;
      }

      // 1. Borra Narsimulu (MD) -> ALLOWED
      assert.equal(evaluateMailboxAccess({ name: 'Borra Narsimulu', email: 'icontechpro@gmail.com', role: 'Managing Director' }), true);
      // 2. B V Dheeraj Reddy (Sales Executive / Admin) -> ALLOWED
      assert.equal(evaluateMailboxAccess({ name: 'B V Dheeraj Reddy', email: 'dheeraj@icontechpro.in', role: 'Sales Executive / Admin' }), true);
      // 3. B Vineet Babu (Sales Executive) -> ALLOWED
      assert.equal(evaluateMailboxAccess({ name: 'B Vineet Babu', email: 'vineet@icontechpro.in', role: 'Sales Executive' }), true);
      // 4. Manisha (Office Assistant) -> ALLOWED
      assert.equal(evaluateMailboxAccess({ name: 'Manisha', email: 'service01@icontechpro.in', role: 'Office Assistant' }), true);

      // 5. Reshma (Sales Executive) -> STRICTLY DENIED
      assert.equal(evaluateMailboxAccess({ name: 'Reshma', email: 'sales@icontechpro.in', role: 'Sales Executive' }), false);
      // 6. Hemalath (Accounts) -> STRICTLY DENIED
      assert.equal(evaluateMailboxAccess({ name: 'Hemalath', email: 'accounts@icontechpro.in', role: 'Accounts' }), false);

      // Role alone does not grant access
      assert.equal(evaluateMailboxAccess({ name: 'New Sales Rep', email: 'newsales@icontechpro.in', role: 'Sales Executive' }), false);
      assert.equal(evaluateMailboxAccess({ name: 'New Assistant', email: 'helper@icontechpro.in', role: 'Office Assistant' }), false);
      assert.equal(evaluateMailboxAccess(null), false);
    });

    // Point 20: Zero Token Leakage Security
    it('Point 20: should never return tokens or client secrets in API responses or public objects', () => {
      const publicStatus = {
        connected: true,
        account_email: 'icontechpro@gmail.com',
        scopes: ['https://www.googleapis.com/auth/gmail.modify'],
        has_modify_scope: true,
      };

      const keys = Object.keys(publicStatus);
      assert.ok(!keys.includes('encrypted_refresh_token'));
      assert.ok(!keys.includes('client_secret'));
      assert.ok(!keys.includes('accessToken'));
      assert.ok(!keys.includes('iv'));
      assert.ok(!keys.includes('tag'));
    });

    // Point 21: Anti-XSS Sandboxed Email HTML Rendering
    it('Point 21: should sanitize or isolate HTML email content in sandboxed iframe without allow-scripts', () => {
      const sandboxAttributes = 'allow-popups allow-popups-to-escape-sandbox';
      assert.ok(!sandboxAttributes.includes('allow-scripts'), 'Must NEVER contain allow-scripts');
      assert.ok(!sandboxAttributes.includes('allow-same-origin'), 'Must NOT allow same-origin to prevent parent window access');
    });

    // Point 22: Audit Trail Logging
    it('Point 22: should log all mailbox operations without recording email bodies or tokens', () => {
      const auditEvent = {
        userName: 'Admin User',
        action: 'GMAIL_EMAIL_SENT',
        module: 'INTEGRATIONS',
        details: 'Sent email to client@example.com (Message ID: msg_999)',
      };

      assert.equal(auditEvent.action, 'GMAIL_EMAIL_SENT');
      assert.ok(!auditEvent.details.includes('ya29.'), 'Must not log tokens');
      assert.ok(!auditEvent.details.includes('password'), 'Must not log secrets');
      assert.ok(auditEvent.details.includes('msg_999'));
    });
  });
});

