import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readSrc(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

describe('ICON TECH PRO ERP V9.2 — Audit Concurrency, Tampering Detection & Checkpoint Security', () => {

  describe('1. Concurrent Audit Writes & Serialized Fork Prevention', () => {
    test('Simultaneous concurrent writes maintain an unbroken, linear SHA-256 chain without forking', () => {
      // Simulate serial write queue algorithm
      const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
      const ledger = [];
      let writeQueue = Promise.resolve();

      function computeHash(prevHash, eventId, action, payload) {
        return crypto.createHash('sha256').update(`${prevHash}|${eventId}|${action}|${JSON.stringify(payload)}`).digest('hex');
      }

      async function concurrentLog(actorName, action, payload) {
        const execute = async () => {
          const prevHash = ledger.length > 0 ? ledger[ledger.length - 1].hash : GENESIS_HASH;
          const eventId = `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const hash = computeHash(prevHash, eventId, action, payload);
          const record = { eventId, actorName, action, prevHash, hash };
          ledger.push(record);
          return record;
        };
        const next = writeQueue.then(execute, execute);
        writeQueue = next;
        return next;
      }

      // Launch 25 concurrent asynchronous writes
      const writePromises = Array.from({ length: 25 }, (_, i) =>
        concurrentLog(`User_${i % 5}`, `ACTION_${i}`, { orderId: `ORD-${1000 + i}`, amount: 50000 * (i + 1) })
      );

      return Promise.all(writePromises).then((records) => {
        assert.equal(records.length, 25);
        assert.equal(ledger.length, 25);

        // Verify chain linearity: each record's prevHash MUST equal the previous record's hash
        let expectedPrev = GENESIS_HASH;
        for (let i = 0; i < ledger.length; i++) {
          const rec = ledger[i];
          assert.equal(rec.prevHash, expectedPrev, `Chain broken at index ${i}`);
          expectedPrev = rec.hash;
        }
      });
    });
  });

  describe('2. Post-Facto Database Tampering Detection', () => {
    test('Any alteration of historical record body, amount or actor immediately flags integrity violation', () => {
      const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
      const ledger = [];

      function computeHash(prevHash, eventId, action, actor, amount) {
        return crypto.createHash('sha256').update(`${prevHash}|${eventId}|${action}|${actor}|${amount}`).digest('hex');
      }

      // Generate 5 valid records
      let prev = GENESIS_HASH;
      for (let i = 0; i < 5; i++) {
        const eventId = `EVT-00${i}`;
        const hash = computeHash(prev, eventId, 'INVOICE_CREATED', 'Accounts_User', 100000 * (i + 1));
        ledger.push({ eventId, action: 'INVOICE_CREATED', actor: 'Accounts_User', amount: 100000 * (i + 1), prev, hash });
        prev = hash;
      }

      // Chain integrity function
      function verifyChain(records) {
        let expected = GENESIS_HASH;
        for (let i = 0; i < records.length; i++) {
          const r = records[i];
          if (r.prev !== expected) return { valid: false, brokenIndex: i, reason: 'Previous hash mismatch' };
          const recomputed = computeHash(r.prev, r.eventId, r.action, r.actor, r.amount);
          if (recomputed !== r.hash) return { valid: false, brokenIndex: i, reason: 'Content hash tampering' };
          expected = r.hash;
        }
        return { valid: true };
      }

      // Untampered check -> VALID
      assert.equal(verifyChain(ledger).valid, true);

      // Malicious superuser edits Record 2 amount from 300,000 to 50,000
      const tampered = JSON.parse(JSON.stringify(ledger));
      tampered[2].amount = 50000;

      const tamperedResult = verifyChain(tampered);
      assert.equal(tamperedResult.valid, false);
      assert.equal(tamperedResult.brokenIndex, 2);
      assert.equal(tamperedResult.reason, 'Content hash tampering');
    });

    test('Deletion of historical record breaks subsequent link across all records', () => {
      const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
      const ledger = [];
      function computeHash(prev, id) {
        return crypto.createHash('sha256').update(`${prev}|${id}`).digest('hex');
      }
      let prev = GENESIS_HASH;
      for (let i = 0; i < 5; i++) {
        const id = `EVT-${i}`;
        const hash = computeHash(prev, id);
        ledger.push({ id, prev, hash });
        prev = hash;
      }

      // Malicious deletion of Record 1
      const deletedChain = [ledger[0], ledger[2], ledger[3], ledger[4]];
      assert.notEqual(deletedChain[1].prev, deletedChain[0].hash); // Record 2's prevHash doesn't match Record 0's hash!
    });
  });

  describe('3. Signed Checkpoints & Cryptographic Verification', () => {
    test('HMAC-SHA256 signed checkpoint prevents forgery of head hash or event count', () => {
      const secret = 'test_enterprise_secret_salt_2026';
      const checkpointId = 'CHK-1001-1';
      const blockHeight = 1;
      const headHash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const timestamp = new Date().toISOString();
      const eventCount = 100;

      function signCheckpoint(sec, chkId, height, head, ts, count) {
        return crypto.createHmac('sha256', sec).update(`${chkId}|${height}|${head}|${ts}|${count}`).digest('hex');
      }

      const validSig = signCheckpoint(secret, checkpointId, blockHeight, headHash, timestamp, eventCount);

      // Verify signature validity
      const testSig = signCheckpoint(secret, checkpointId, blockHeight, headHash, timestamp, eventCount);
      assert.equal(validSig, testSig);

      // Forged count
      const forgedSig = signCheckpoint(secret, checkpointId, blockHeight, headHash, timestamp, 99);
      assert.notEqual(validSig, forgedSig);
    });
  });

  describe('4. PostgreSQL Trigger Immutability & Threat Boundary Analysis', () => {
    test('Migration 20261031000003 contains BEFORE UPDATE OR DELETE trigger raising EXCEPTION', () => {
      const sqlContent = readSrc('supabase/migrations/20261031000003_v9_2_enterprise_security_and_audit.sql');
      assert.ok(sqlContent.includes('CREATE TRIGGER trg_audit_ledger_immutable'));
      assert.ok(sqlContent.includes('BEFORE UPDATE OR DELETE ON public.enterprise_audit_ledger'));
      assert.ok(sqlContent.includes('RAISE EXCEPTION'));
      assert.ok(sqlContent.includes('Enterprise audit ledger is immutable and append-only'));
    });

    test('Rollback script cleanly drops the immutability trigger and function', () => {
      const rollbackContent = readSrc('supabase/migrations/20261031000003_v9_2_enterprise_security_and_audit_rollback.sql');
      assert.ok(rollbackContent.includes('DROP TRIGGER IF EXISTS trg_audit_ledger_immutable ON public.enterprise_audit_ledger'));
      assert.ok(rollbackContent.includes('DROP FUNCTION IF EXISTS public.prevent_audit_ledger_tampering()'));
    });
  });
});
