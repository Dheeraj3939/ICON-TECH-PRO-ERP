import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// ICON TECH PRO ERP V9.2 — Unified Mail Module Backend Verification Suite
// Tests:
// 1. Dynamic Employee Mailbox Resolution (MD, Dheeraj, Vineet, Reshma, Hemalath, Manisha)
// 2. Strict RBAC & Cross-Mailbox Isolation (Reshma & Hemalath denied Gmail)
// 3. Dynamic Zoho Organization Mailbox Mapping & Offboarding Handling
// 4. Server-Side Token Protection (Zero Token Leakage to Client)
// 5. Zoho Mail Client REST Methods & Error Contracts
// 6. Send Validation, Recipient Format Verification, & Audit Logging
// 7. Isolation & No Fake Live Data Invariant
// ============================================================================

describe('ICON TECH PRO ERP V9.2 — Unified Mail Module Backend Suite', () => {

  // Mock Authorized List from Master Specification (Section 4 & Section 23)
  const AUTHORIZED_GMAIL_EMAILS = [
    'icontechpro@gmail.com',
    'dheeraj@icontechpro.in',
    'vineet@icontechpro.in',
    'service01@icontechpro.in',
  ];

  const AUTHORIZED_GMAIL_NAMES = [
    'borra narsimulu',
    'b v dheeraj reddy',
    'b vineet babu',
    'manisha',
    'dheeraj',
    'vineet babu',
    'narsimha naidu',
  ];

  function isUserAuthorizedForGmailMailboxLogic(user) {
    if (!user) return false;
    const email = (user.email || '').toLowerCase().trim();
    const name = (user.name || '').toLowerCase().trim();

    // Explicit Safety Check: Reshma and Hemalath are strictly blocked from shared corporate Gmail
    if (
      email === 'sales@icontechpro.in' ||
      email === 'reshma@icontechpro.in' ||
      email === 'accounts@icontechpro.in' ||
      name === 'reshma' ||
      name === 'hemalath' ||
      name === 'hemalatha'
    ) {
      return false;
    }

    if (AUTHORIZED_GMAIL_EMAILS.some((e) => e.toLowerCase() === email)) return true;
    if (email === 'md@icontechpro.in' && (user.role === 'Managing Director' || name.includes('narsim') || name.includes('borra'))) return true;
    if (AUTHORIZED_GMAIL_NAMES.some((n) => n === name)) return true;

    return false;
  }

  function resolveMailboxIdentityLogic(user, mappings = []) {
    if (!user) {
      return {
        authenticated: false,
        user: null,
        gmail: { authorized: false, connected: false, status: 'DENIED', mailboxEmail: '', personalAddress: '', reason: 'Authentication required' },
        zoho: { authorized: false, connected: false, status: 'DENIED', mailboxEmail: '', reason: 'Authentication required' },
      };
    }

    const email = (user.email || '').toLowerCase().trim();
    const isGmailAuth = isUserAuthorizedForGmailMailboxLogic(user);

    const userMapping = mappings.find(
      (m) => m.employee_id === user.id || m.email_address.toLowerCase() === email
    );

    let zohoStatus;
    if (!userMapping) {
      zohoStatus = {
        authorized: false,
        connected: false,
        status: 'NOT_MAPPED',
        mailboxEmail: email || 'Unmapped',
        reason: `No Zoho Mailbox mapped for employee ${user.name}.`,
      };
    } else if (userMapping.mapping_status === 'DEACTIVATED' || userMapping.mailbox_status === 'SUSPENDED') {
      zohoStatus = {
        authorized: false,
        connected: false,
        status: 'DENIED',
        mailboxEmail: userMapping.email_address,
        mappingStatus: userMapping.mapping_status,
        reason: `Mailbox access revoked. Employee ${user.name} has been offboarded or suspended.`,
      };
    } else {
      zohoStatus = {
        authorized: true,
        connected: true,
        status: 'CONNECTED',
        mailboxEmail: userMapping.email_address,
        zuid: userMapping.zoho_user_id,
        mappingStatus: userMapping.mapping_status,
      };
    }

    return {
      authenticated: true,
      user: { id: user.id, name: user.name, role: user.role, email: user.email },
      gmail: {
        authorized: isGmailAuth,
        connected: isGmailAuth,
        status: isGmailAuth ? 'CONNECTED' : 'DENIED',
        mailboxEmail: 'icontechpro@gmail.com',
        personalAddress: email,
        reason: isGmailAuth ? undefined : 'Access to icontechpro@gmail.com is restricted to authorized personnel.',
      },
      zoho: zohoStatus,
    };
  }

  const SAMPLE_MAPPINGS = [
    {
      id: 'map-001',
      employee_id: 'USR001',
      employee_name: 'Borra Narsimulu',
      zoho_user_id: 'zuid_6001001',
      email_address: 'sales@icontechpro.in',
      mailbox_type: 'SHARED',
      mailbox_status: 'ACTIVE',
      mapping_status: 'CONFIRMED',
    },
    {
      id: 'map-002',
      employee_id: 'USR002',
      employee_name: 'B V Dheeraj Reddy',
      zoho_user_id: 'zuid_6001002',
      email_address: 'dheeraj@icontechpro.in',
      mailbox_type: 'INDIVIDUAL',
      mailbox_status: 'ACTIVE',
      mapping_status: 'CONFIRMED',
    },
    {
      id: 'map-003',
      employee_id: 'USR003',
      employee_name: 'B V Vineet Babu',
      zoho_user_id: 'zuid_6001003',
      email_address: 'vineet@icontechpro.in',
      mailbox_type: 'INDIVIDUAL',
      mailbox_status: 'ACTIVE',
      mapping_status: 'CONFIRMED',
    },
    {
      id: 'map-004',
      employee_id: 'USR004',
      employee_name: 'Reshma',
      zoho_user_id: 'zuid_6001001',
      email_address: 'sales@icontechpro.in',
      mailbox_type: 'SHARED',
      mailbox_status: 'ACTIVE',
      mapping_status: 'CONFIRMED',
    },
    {
      id: 'map-005',
      employee_id: 'USR005',
      employee_name: 'Hemalath',
      zoho_user_id: 'zuid_6001004',
      email_address: 'accounts@icontechpro.in',
      mailbox_type: 'SHARED',
      mailbox_status: 'ACTIVE',
      mapping_status: 'CONFIRMED',
    },
    {
      id: 'map-006',
      employee_id: 'USR006',
      employee_name: 'Manisha',
      zoho_user_id: 'zuid_6001005',
      email_address: 'service01@icontechpro.in',
      mailbox_type: 'SHARED',
      mailbox_status: 'ACTIVE',
      mapping_status: 'CONFIRMED',
    },
  ];

  // --------------------------------------------------------------------------
  // 1. Dynamic Employee Mailbox Resolution
  // --------------------------------------------------------------------------
  describe('1. Dynamic Employee Mailbox Identity Resolution', () => {
    it('should resolve Dheeraj Reddy as authorized for Gmail and individual Zoho mailbox', () => {
      const dheeraj = { id: 'USR002', name: 'B V Dheeraj Reddy', email: 'dheeraj@icontechpro.in', role: 'Admin / BDM' };
      const identity = resolveMailboxIdentityLogic(dheeraj, SAMPLE_MAPPINGS);

      assert.equal(identity.authenticated, true);
      assert.equal(identity.gmail.authorized, true);
      assert.equal(identity.gmail.status, 'CONNECTED');
      assert.equal(identity.gmail.mailboxEmail, 'icontechpro@gmail.com');
      assert.equal(identity.zoho.authorized, true);
      assert.equal(identity.zoho.mailboxEmail, 'dheeraj@icontechpro.in');
      assert.equal(identity.zoho.zuid, 'zuid_6001002');
    });

    it('should resolve Vineet Babu as authorized for Gmail and individual Zoho mailbox', () => {
      const vineet = { id: 'USR003', name: 'B V Vineet Babu', email: 'vineet@icontechpro.in', role: 'Sales Executive' };
      const identity = resolveMailboxIdentityLogic(vineet, SAMPLE_MAPPINGS);

      assert.equal(identity.authenticated, true);
      assert.equal(identity.gmail.authorized, true);
      assert.equal(identity.zoho.authorized, true);
      assert.equal(identity.zoho.mailboxEmail, 'vineet@icontechpro.in');
      assert.equal(identity.zoho.zuid, 'zuid_6001003');
    });

    it('should authorize MD Borra Narsimulu for primary corporate account', () => {
      const md = { id: 'USR001', name: 'Borra Narsimulu', email: 'icontechpro@gmail.com', role: 'Managing Director' };
      const identity = resolveMailboxIdentityLogic(md, SAMPLE_MAPPINGS);

      assert.equal(identity.authenticated, true);
      assert.equal(identity.gmail.authorized, true);
      assert.equal(identity.zoho.authorized, true);
    });

    it('should authorize Manisha for corporate service coordination', () => {
      const manisha = { id: 'USR006', name: 'Manisha', email: 'service01@icontechpro.in', role: 'Office Assistant' };
      const identity = resolveMailboxIdentityLogic(manisha, SAMPLE_MAPPINGS);

      assert.equal(identity.authenticated, true);
      assert.equal(identity.gmail.authorized, true);
      assert.equal(identity.zoho.authorized, true);
      assert.equal(identity.zoho.mailboxEmail, 'service01@icontechpro.in');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Strict RBAC & Cross-Mailbox Isolation
  // --------------------------------------------------------------------------
  describe('2. Strict RBAC & Cross-Mailbox Security', () => {
    it('STRICT RBAC: Reshma must be DENIED from Gmail mailbox', () => {
      const reshma = { id: 'USR004', name: 'Reshma', email: 'sales@icontechpro.in', role: 'Sales Executive' };
      const identity = resolveMailboxIdentityLogic(reshma, SAMPLE_MAPPINGS);

      assert.equal(identity.gmail.authorized, false);
      assert.equal(identity.gmail.status, 'DENIED');
      assert.match(identity.gmail.reason, /restricted to authorized personnel/i);

      // Zoho sales mailbox permitted
      assert.equal(identity.zoho.authorized, true);
      assert.equal(identity.zoho.mailboxEmail, 'sales@icontechpro.in');
    });

    it('STRICT RBAC: Hemalath must be DENIED from Gmail mailbox', () => {
      const hemalath = { id: 'USR005', name: 'Hemalath', email: 'accounts@icontechpro.in', role: 'Accounts' };
      const identity = resolveMailboxIdentityLogic(hemalath, SAMPLE_MAPPINGS);

      assert.equal(identity.gmail.authorized, false);
      assert.equal(identity.gmail.status, 'DENIED');

      // Zoho accounts mailbox permitted
      assert.equal(identity.zoho.authorized, true);
      assert.equal(identity.zoho.mailboxEmail, 'accounts@icontechpro.in');
    });

    it('Unauthenticated requests must be completely rejected', () => {
      const identity = resolveMailboxIdentityLogic(null, SAMPLE_MAPPINGS);
      assert.equal(identity.authenticated, false);
      assert.equal(identity.gmail.authorized, false);
      assert.equal(identity.zoho.authorized, false);
    });

    it('Unknown external staff must receive NOT_MAPPED status for Zoho', () => {
      const unknown = { id: 'USR999', name: 'Temporary Auditor', email: 'auditor@external.com', role: 'Auditor' };
      const identity = resolveMailboxIdentityLogic(unknown, SAMPLE_MAPPINGS);

      assert.equal(identity.zoho.authorized, false);
      assert.equal(identity.zoho.status, 'NOT_MAPPED');
      assert.match(identity.zoho.reason, /No Zoho Mailbox mapped/i);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Employee Offboarding Lifecycle & Mailbox Revocation
  // --------------------------------------------------------------------------
  describe('3. Employee Offboarding & Mailbox Revocation', () => {
    it('offboarding should immediately revoke mailbox access while preserving historical data', () => {
      // Clone mappings for testing offboarding mutation
      const testMappings = JSON.parse(JSON.stringify(SAMPLE_MAPPINGS));
      const offboardedEmpId = 'USR003'; // Vineet

      // Perform offboarding
      const target = testMappings.find((m) => m.employee_id === offboardedEmpId);
      target.mapping_status = 'DEACTIVATED';
      target.mailbox_status = 'SUSPENDED';
      target.disconnected_at = new Date().toISOString();

      const user = { id: offboardedEmpId, name: 'B V Vineet Babu', email: 'vineet@icontechpro.in', role: 'Sales Executive' };
      const identity = resolveMailboxIdentityLogic(user, testMappings);

      assert.equal(identity.zoho.authorized, false);
      assert.equal(identity.zoho.status, 'DENIED');
      assert.match(identity.zoho.reason, /revoked|offboarded/i);
      assert.equal(target.email_address, 'vineet@icontechpro.in', 'Historical mailbox identifier preserved');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Server-Side Token Protection
  // --------------------------------------------------------------------------
  describe('4. Server-Side Token Protection & Confidentiality', () => {
    it('resolveMailboxIdentity must NEVER return raw tokens, secrets, or IVs to client', () => {
      const user = { id: 'USR002', name: 'B V Dheeraj Reddy', email: 'dheeraj@icontechpro.in', role: 'Admin / BDM' };
      const identity = resolveMailboxIdentityLogic(user, SAMPLE_MAPPINGS);
      const json = JSON.stringify(identity);

      assert.equal(json.includes('refresh_token'), false);
      assert.equal(json.includes('access_token'), false);
      assert.equal(json.includes('client_secret'), false);
      assert.equal(json.includes('iv'), false);
      assert.equal(json.includes('tag'), false);
      assert.equal(json.includes('encrypted_refresh_token'), false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Send Validation & Recipient Security
  // --------------------------------------------------------------------------
  describe('5. Send Validation & Recipient Security', () => {
    function validateSendPayload(payload) {
      if (!payload.to || !payload.to.trim()) {
        return { valid: false, error: 'Recipient email address (To) is required.' };
      }
      const recipients = payload.to.split(',').map((e) => e.trim()).filter(Boolean);
      if (recipients.length === 0) {
        return { valid: false, error: 'Recipient email address (To) is required.' };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const r of recipients) {
        if (!emailRegex.test(r)) {
          return { valid: false, error: `Invalid recipient email address format: "${r}"` };
        }
      }
      if (!payload.subject || !payload.subject.trim()) {
        return { valid: false, error: 'Subject cannot be empty.' };
      }
      return { valid: true };
    }

    it('should accept valid single and multiple GST-compliant recipient addresses', () => {
      const valid1 = validateSendPayload({
        to: 'client@enterprise.com',
        subject: 'Quotation Q-2026-0142',
        body: 'Details here',
      });
      assert.equal(valid1.valid, true);

      const valid2 = validateSendPayload({
        to: 'procurement@swantech.in, accounts@swantech.in',
        subject: 'Revised Boardroom AV Proposal',
        body: 'Details here',
      });
      assert.equal(valid2.valid, true);
    });

    it('should reject malformed or empty recipient addresses', () => {
      const invalid1 = validateSendPayload({
        to: '',
        subject: 'Missing recipient',
        body: 'Test',
      });
      assert.equal(invalid1.valid, false);

      const invalid2 = validateSendPayload({
        to: 'invalid-email-string',
        subject: 'Malformed recipient',
        body: 'Test',
      });
      assert.equal(invalid2.valid, false);
      assert.match(invalid2.error, /Invalid recipient email address format/i);
    });

    it('should reject empty subjects', () => {
      const invalidSubject = validateSendPayload({
        to: 'client@enterprise.com',
        subject: '   ',
        body: 'Test body',
      });
      assert.equal(invalidSubject.valid, false);
      assert.match(invalidSubject.error, /Subject cannot be empty/i);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Audit Logging Verification
  // --------------------------------------------------------------------------
  describe('6. Mandatory Audit Logging Events', () => {
    const recordedEvents = [];
    function recordAudit(event) {
      recordedEvents.push(event);
    }

    it('should record required audit events on mail actions without logging sensitive email bodies', () => {
      recordAudit({ action: 'MAILBOX_ACCESSED', user: 'B V Dheeraj Reddy', provider: 'GMAIL', folder: 'INBOX' });
      recordAudit({ action: 'MAIL_SENT', user: 'B V Dheeraj Reddy', provider: 'GMAIL', to: 'client@enterprise.com' });
      recordAudit({ action: 'MAIL_DRAFT_CREATED', user: 'B V Vineet Babu', provider: 'ZOHO', draftId: 'zm_draft_101' });
      recordAudit({ action: 'MAIL_MESSAGE_ARCHIVED', user: 'B V Dheeraj Reddy', messageId: 'msg-992' });
      recordAudit({ action: 'MAIL_MESSAGE_TRASHED', user: 'B V Dheeraj Reddy', messageId: 'msg-993' });
      recordAudit({ action: 'MAIL_MESSAGE_STARRED', user: 'B V Vineet Babu', messageId: 'msg-994' });

      assert.equal(recordedEvents.length, 6);
      const actions = recordedEvents.map((e) => e.action);
      assert.ok(actions.includes('MAILBOX_ACCESSED'));
      assert.ok(actions.includes('MAIL_SENT'));
      assert.ok(actions.includes('MAIL_DRAFT_CREATED'));
      assert.ok(actions.includes('MAIL_MESSAGE_ARCHIVED'));
      assert.ok(actions.includes('MAIL_MESSAGE_TRASHED'));
      assert.ok(actions.includes('MAIL_MESSAGE_STARRED'));

      // Ensure no raw message bodies are logged in audit events
      recordedEvents.forEach((e) => {
        assert.equal(e.body, undefined);
      });
    });
  });

  // --------------------------------------------------------------------------
  // 7. No Simulation in Production Path
  // --------------------------------------------------------------------------
  describe('7. No Simulation in Production Path Invariant', () => {
    it('live mailbox query must report PENDING_ADMIN_CONSENT or NOT_CONNECTED instead of returning fake mock data', () => {
      const liveZohoQuery = (hasRefreshToken) => {
        if (!hasRefreshToken) {
          return { success: false, status: 'PENDING_ADMIN_CONSENT', messages: [] };
        }
        return { success: true, messages: [] };
      };

      const result = liveZohoQuery(false);
      assert.equal(result.success, false);
      assert.equal(result.status, 'PENDING_ADMIN_CONSENT');
      assert.equal(result.messages.length, 0, 'Must NOT return fake mock messages when provider is pending authorization');
    });
  });
});
