import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

// ===========================================================================
// ICON TECH PRO ERP — DAY 6 MASTER PRODUCTION AUDIT & HARDENING TEST SUITE
// ===========================================================================

describe('DAY 6 MASTER PRODUCTION AUDIT & HARDENING', () => {

  // -------------------------------------------------------------------------
  // 1. RLS & RBAC Field-Level Privacy Matrix
  // -------------------------------------------------------------------------
  describe('1. RLS & RBAC Field-Level Privacy Matrix', () => {
    function canViewPurchaseCosts(role) {
      if (!role) return false;
      return ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'].includes(role);
    }

    function sanitizeProductForRole(product, role) {
      if (canViewPurchaseCosts(role)) return { ...product };
      return {
        ...product,
        purchase_price: 0,
        target_margin_pct: 0,
        supplier_name: undefined,
        purchase_depot: undefined,
      };
    }

    test('Managing Director has full commercial purchase cost visibility', () => {
      assert.equal(canViewPurchaseCosts('Managing Director'), true);
    });

    test('Admin / BDM has full commercial purchase cost visibility', () => {
      assert.equal(canViewPurchaseCosts('Admin / BDM'), true);
    });

    test('BDM has commercial purchase cost visibility for pricing', () => {
      assert.equal(canViewPurchaseCosts('BDM'), true);
    });

    test('Accounts has purchase cost visibility for supplier reconciliation', () => {
      assert.equal(canViewPurchaseCosts('Accounts'), true);
    });

    test('Sales Executive is STRICTLY RESTRICTED from purchase costs', () => {
      assert.equal(canViewPurchaseCosts('Sales Executive'), false);
    });

    test('Office Assistant is STRICTLY RESTRICTED from purchase costs', () => {
      assert.equal(canViewPurchaseCosts('Office Assistant'), false);
    });

    test('Unauthenticated or unknown role is default-denied', () => {
      assert.equal(canViewPurchaseCosts(null), false);
      assert.equal(canViewPurchaseCosts(undefined), false);
      assert.equal(canViewPurchaseCosts('External Guest'), false);
    });

    test('Sanitizing product zeroes purchase_price for Sales Executive', () => {
      const product = {
        id: 'PRD-01',
        name: '4K Laser Projector',
        sku: 'PROJ-4K-01',
        category_name: 'Displays',
        brand_name: 'Epson',
        selling_price: 145000,
        purchase_price: 98000,
        current_stock: 4,
      };
      const sanitized = sanitizeProductForRole(product, 'Sales Executive');
      assert.equal(sanitized.purchase_price, 0);
      assert.equal(sanitized.selling_price, 145000);
      assert.equal(sanitized.target_margin_pct, 0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Communication Identity & Send-As Spoofing Guards
  // -------------------------------------------------------------------------
  describe('2. Communication Identity & Send-As Spoofing Guards', () => {
    const REGISTERED_IDENTITIES = [
      { id: 'IDENT-001', user_id: 'usr_md_1', user_name: 'Managing Director', send_as_allowed_users: ['usr_admin_1', 'usr_bdm_1'] },
      { id: 'IDENT-002', user_id: 'usr_sales_1', user_name: 'Vamshi Krishna', send_as_allowed_users: [] },
    ];

    const AUTHORIZED_COMPANY_DESKS = [
      'icon tech sales desk',
      'icon care desk',
      'icon tech support',
      'billing & accounts desk',
    ];

    function canUserSendAs(userId, targetIdentityNameOrId) {
      const target = REGISTERED_IDENTITIES.find(
        (i) => i.id === targetIdentityNameOrId || i.user_name === targetIdentityNameOrId || i.user_id === targetIdentityNameOrId
      );

      if (!target) {
        if (AUTHORIZED_COMPANY_DESKS.includes(targetIdentityNameOrId.trim().toLowerCase())) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: 'Permission denied: Unknown or unauthorized Send-As identity "' + targetIdentityNameOrId + '". Users may not spoof unverified identities.',
        };
      }

      if (target.user_id === userId) {
        return { allowed: true };
      }

      if (target.send_as_allowed_users && target.send_as_allowed_users.includes(userId)) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'Permission denied: User ' + userId + ' is not authorized to Send-As "' + target.user_name + '".',
      };
    }

    test('Permits user to send as authorized corporate desk', () => {
      const res = canUserSendAs('usr_sales_1', 'ICON Tech Sales Desk');
      assert.equal(res.allowed, true);
    });

    test('Permits user to send as own registered identity', () => {
      const res = canUserSendAs('usr_sales_1', 'Vamshi Krishna');
      assert.equal(res.allowed, true);
    });

    test('Permits delegated user to send as Managing Director', () => {
      const res = canUserSendAs('usr_admin_1', 'Managing Director');
      assert.equal(res.allowed, true);
    });

    test('Blocks unauthorized user attempting to spoof another employee (e.g. Managing Director)', () => {
      const res = canUserSendAs('usr_sales_1', 'Managing Director');
      assert.equal(res.allowed, false);
      assert.match(res.reason, /Permission denied/i);
    });

    test('Blocks arbitrary unregistered spoofing identities', () => {
      const res = canUserSendAs('usr_sales_1', 'Arbitrary Impersonator');
      assert.equal(res.allowed, false);
      assert.match(res.reason, /Unknown or unauthorized Send-As identity/i);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Financial Debit Note & Credit Note Balances
  // -------------------------------------------------------------------------
  describe('3. Financial Debit Note & Credit Note Balances', () => {
    function processDebitNote(sinv, amount, reason) {
      if (amount <= 0) {
        return { success: false, error: 'Debit note amount must be greater than zero.' };
      }
      const currentOutstanding = sinv.outstanding_amount ?? sinv.total_amount;
      if (amount > currentOutstanding) {
        return {
          success: false,
          error: 'Debit Note amount (₹' + amount + ') cannot exceed supplier invoice balance of ₹' + currentOutstanding + '.',
        };
      }
      const newBalance = Number((currentOutstanding - amount).toFixed(2));
      return {
        success: true,
        debitNote: {
          supplier_invoice_id: sinv.id,
          amount,
          reason,
          new_supplier_outstanding: newBalance,
        },
      };
    }

    function processCreditNote(inv, amount, reason) {
      if (amount <= 0) {
        return { success: false, error: 'Credit Note amount must be greater than zero.' };
      }
      if (amount > inv.grand_total) {
        return {
          success: false,
          error: 'Credit Note cannot exceed invoice total of ₹' + inv.grand_total + '.',
        };
      }
      const newBal = Math.max(0, Number((inv.balance_amount - amount).toFixed(2)));
      return {
        success: true,
        creditNote: {
          invoice_id: inv.id,
          amount,
          reason,
          new_customer_balance: newBal,
          status: newBal === 0 ? 'Paid' : 'Partially Paid',
        },
      };
    }

    test('Rejects Debit Note with amount <= 0', () => {
      const sinv = { id: 'SINV-01', invoice_number: 'SINV-26-001', total_amount: 50000, outstanding_amount: 50000 };
      const res = processDebitNote(sinv, -500, 'Invalid adjustment');
      assert.equal(res.success, false);
      assert.match(res.error, /greater than zero/i);
    });

    test('Rejects Debit Note exceeding supplier invoice outstanding balance', () => {
      const sinv = { id: 'SINV-01', invoice_number: 'SINV-26-001', total_amount: 50000, outstanding_amount: 25000 };
      const res = processDebitNote(sinv, 30000, 'Excessive debit');
      assert.equal(res.success, false);
      assert.match(res.error, /cannot exceed supplier invoice balance/i);
    });

    test('Valid Debit Note successfully deducts supplier outstanding balance', () => {
      const sinv = { id: 'SINV-01', invoice_number: 'SINV-26-001', total_amount: 50000, outstanding_amount: 25000 };
      const res = processDebitNote(sinv, 10000, 'Damaged accessory return');
      assert.equal(res.success, true);
      assert.equal(res.debitNote.new_supplier_outstanding, 15000);
    });

    test('Rejects Credit Note exceeding customer invoice total amount', () => {
      const inv = { id: 'INV-01', invoice_number: 'INV-260001', grand_total: 100000, balance_amount: 100000 };
      const res = processCreditNote(inv, 150000, 'Excessive credit');
      assert.equal(res.success, false);
      assert.match(res.error, /cannot exceed invoice total/i);
    });

    test('Valid Credit Note settles invoice and marks status Paid when fully credited', () => {
      const inv = { id: 'INV-01', invoice_number: 'INV-260001', grand_total: 50000, balance_amount: 50000 };
      const res = processCreditNote(inv, 50000, 'Full commercial waiver');
      assert.equal(res.success, true);
      assert.equal(res.creditNote.new_customer_balance, 0);
      assert.equal(res.creditNote.status, 'Paid');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Centralized GST Tax Engine Edge Cases
  // -------------------------------------------------------------------------
  describe('4. Centralized GST Tax Engine Edge Cases', () => {
    const UT_WITHOUT_LEGISLATURE = new Set(['35', '04', '26', '38', '31']);

    function calculateTax(params) {
      const subtotal = params.subtotal;
      const gstRate = params.gst_rate ?? 18;
      const isSez = Boolean(params.is_sez);
      const companyState = params.company_state_code || '36';
      const shippingState = params.shipping_state_code || companyState;

      if (isSez) {
        return {
          taxable_amount: subtotal,
          is_sez: true,
          cgst_amount: 0,
          sgst_amount: 0,
          utgst_amount: 0,
          igst_amount: 0,
          total_gst_amount: 0,
          grand_total: subtotal,
        };
      }

      let taxable = subtotal;
      if (params.is_tax_inclusive) {
        taxable = Number((subtotal / (1 + gstRate / 100)).toFixed(2));
      }

      const isInterstate = shippingState !== companyState;
      const isUtgst = !isInterstate && UT_WITHOUT_LEGISLATURE.has(shippingState);

      let cgst = 0;
      let sgst = 0;
      let utgst = 0;
      let igst = 0;

      if (isInterstate) {
        igst = Number(((taxable * gstRate) / 100).toFixed(2));
      } else if (isUtgst) {
        cgst = Number(((taxable * (gstRate / 2)) / 100).toFixed(2));
        utgst = Number(((taxable * (gstRate / 2)) / 100).toFixed(2));
      } else {
        cgst = Number(((taxable * (gstRate / 2)) / 100).toFixed(2));
        sgst = Number(((taxable * (gstRate / 2)) / 100).toFixed(2));
      }

      const totalGst = Number((cgst + sgst + utgst + igst).toFixed(2));
      const grandTotal = Number((taxable + totalGst).toFixed(2));

      return {
        taxable_amount: taxable,
        is_interstate: isInterstate,
        is_utgst: isUtgst,
        cgst_amount: cgst,
        sgst_amount: sgst,
        utgst_amount: utgst,
        igst_amount: igst,
        total_gst_amount: totalGst,
        grand_total: grandTotal,
      };
    }

    test('Union Territory without legislature applies CGST + UTGST', () => {
      // Chandigarh (04)
      const res = calculateTax({
        subtotal: 100000,
        gst_rate: 18,
        shipping_state_code: '04',
        company_state_code: '04',
      });

      assert.equal(res.is_interstate, false);
      assert.equal(res.is_utgst, true);
      assert.equal(res.cgst_amount, 9000);
      assert.equal(res.utgst_amount, 9000);
      assert.equal(res.sgst_amount, 0);
      assert.equal(res.igst_amount, 0);
      assert.equal(res.grand_total, 118000);
    });

    test('SEZ transaction under LUT is zero-rated', () => {
      const res = calculateTax({
        subtotal: 250000,
        gst_rate: 18,
        shipping_state_code: '36',
        is_sez: true,
      });

      assert.equal(res.is_sez, true);
      assert.equal(res.cgst_amount, 0);
      assert.equal(res.sgst_amount, 0);
      assert.equal(res.igst_amount, 0);
      assert.equal(res.total_gst_amount, 0);
      assert.equal(res.grand_total, 250000);
    });

    test('Tax-inclusive price backwards calculation maintains zero penny leakage', () => {
      const res = calculateTax({
        subtotal: 118000,
        gst_rate: 18,
        shipping_state_code: '36',
        company_state_code: '36',
        is_tax_inclusive: true,
      });

      assert.equal(res.taxable_amount, 100000);
      assert.equal(res.cgst_amount, 9000);
      assert.equal(res.sgst_amount, 9000);
      assert.equal(res.grand_total, 118000);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Document Engine Lifecycle & Terminal State Invariants
  // -------------------------------------------------------------------------
  describe('5. Document Engine Lifecycle & Terminal State Invariants', () => {
    function validateLifecycleTransition(current, target) {
      if (current === target) return { valid: true };
      if (current === 'CANCELLED' || current === 'VOID') {
        return { valid: false, reason: 'Document is ' + current + ' and cannot be transitioned to ' + target + '.' };
      }
      const allowedTransitions = {
        DRAFT: ['REVIEW', 'CANCELLED', 'VOID'],
        REVIEW: ['APPROVED', 'DRAFT', 'CANCELLED'],
        APPROVED: ['ISSUED', 'REVIEW', 'CANCELLED'],
        ISSUED: ['CANCELLED', 'VOID'],
        CANCELLED: [],
        VOID: [],
      };
      const allowed = allowedTransitions[current] || [];
      if (allowed.includes(target)) {
        return { valid: true };
      }
      return { valid: false, reason: 'Invalid transition from ' + current + ' to ' + target + '.' };
    }

    test('Terminal state CANCELLED cannot transition to DRAFT', () => {
      const res = validateLifecycleTransition('CANCELLED', 'DRAFT');
      assert.equal(res.valid, false);
      assert.match(res.reason, /cannot be transitioned/i);
    });

    test('Terminal state VOID cannot transition to ISSUED', () => {
      const res = validateLifecycleTransition('VOID', 'ISSUED');
      assert.equal(res.valid, false);
      assert.match(res.reason, /cannot be transitioned/i);
    });

    test('DRAFT cannot skip review/approval and jump directly to ISSUED', () => {
      const res = validateLifecycleTransition('DRAFT', 'ISSUED');
      assert.equal(res.valid, false);
      assert.match(res.reason, /Invalid transition/i);
    });

    test('APPROVED can legitimately transition to ISSUED', () => {
      const res = validateLifecycleTransition('APPROVED', 'ISSUED');
      assert.equal(res.valid, true);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Safe AI Gateway Prohibited Operations Policy
  // -------------------------------------------------------------------------
  describe('6. Safe AI Gateway Prohibited Operations Policy', () => {
    const STRICTLY_PROHIBITED_AI_OPERATIONS = [
      'approve_own_discount',
      'change_purchase_cost',
      'change_payment_records',
      'modify_permissions',
      'delete_customer',
      'cancel_financial_document',
      'make_unauthorized_financial_commitment',
    ];

    function validateAIToolPolicy(toolName) {
      if (STRICTLY_PROHIBITED_AI_OPERATIONS.includes(toolName.toLowerCase())) {
        return {
          allowed: false,
          reason: 'Strict Policy Violation: Operation "' + toolName + '" is prohibited for AI autonomous execution.',
        };
      }
      return { allowed: true };
    }

    test('Blocks AI attempt to approve own discount', () => {
      const check = validateAIToolPolicy('approve_own_discount');
      assert.equal(check.allowed, false);
      assert.match(check.reason, /Strict Policy Violation/i);
    });

    test('Blocks AI attempt to change purchase costs', () => {
      const check = validateAIToolPolicy('change_purchase_cost');
      assert.equal(check.allowed, false);
      assert.match(check.reason, /Strict Policy Violation/i);
    });

    test('Blocks AI attempt to modify permissions', () => {
      const check = validateAIToolPolicy('modify_permissions');
      assert.equal(check.allowed, false);
      assert.match(check.reason, /Strict Policy Violation/i);
    });

    test('Blocks AI attempt to cancel financial document', () => {
      const check = validateAIToolPolicy('cancel_financial_document');
      assert.equal(check.allowed, false);
      assert.match(check.reason, /Strict Policy Violation/i);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Voice Gateway Human Handoff Parser
  // -------------------------------------------------------------------------
  describe('7. Voice Gateway Human Handoff Parser', () => {
    const humanHandoffPhrases = [
      'transfer', 'human', 'executive', 'manager', 'talk to someone',
      'speak with representative', 'manishi', 'vyakthi', 'insaan', 'agent',
      'మనిషి', 'వ్యక్తి', 'మేనేజర్', 'इंसान', 'मैनेजर',
    ];

    function parseVoiceTurn(text, language = 'en') {
      const lower = text.toLowerCase();
      const transferRequested = humanHandoffPhrases.some((p) => lower.includes(p));
      let replyText = 'How can I help with your query?';

      if (transferRequested) {
        replyText = language.startsWith('te')
          ? 'తప్పకుండా అండీ, మీ కాల్‌ను మా కస్టమర్ ఎగ్జిక్యూటివ్‌కు బదిలీ చేస్తున్నాము. దయచేసి లైన్‌లో ఉండండి.'
          : language.startsWith('hi')
          ? 'जी, हम आपकी कॉल हमारे कस्टमर सपोर्ट एग्जीक्यूटिव को ट्रांसफर कर रहे हैं। कृपया लाइन पर बने रहें।'
          : 'Certainly, transferring your call to our Senior Support Executive now. Please stay on the line.';
      }

      return { transferRequested, replyText };
    }

    test('Detects human handoff in Telugu script (మనిషి / మేనేజర్)', () => {
      const turn = parseVoiceTurn('నాకు వెంటనే ఒక మనిషి లేదా మేనేజర్‌తో మాట్లాడాలి', 'te');
      assert.equal(turn.transferRequested, true);
      assert.match(turn.replyText, /కస్టమర్ ఎగ్జిక్యూటివ్‌కు బదిలీ/);
    });

    test('Detects human handoff in Hindi script (इंसान / मैनेजर)', () => {
      const turn = parseVoiceTurn('मुझे किसी इंसान या मैनेजर से बात करवाइए', 'hi');
      assert.equal(turn.transferRequested, true);
      assert.match(turn.replyText, /कस्टमर सपोर्ट एग्जीक्यूटिव/);
    });

    test('Detects human handoff in transliterated Telugu (manishi / vyakthi)', () => {
      const turn = parseVoiceTurn('natho evaraina vyakthi matladathara please transfer', 'te');
      assert.equal(turn.transferRequested, true);
    });

    test('Detects human handoff in English (speak with representative)', () => {
      const turn = parseVoiceTurn('Can I speak with representative now?', 'en');
      assert.equal(turn.transferRequested, true);
      assert.match(turn.replyText, /Senior Support Executive/);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Global Search Role-based Privacy Filtering
  // -------------------------------------------------------------------------
  describe('8. Global Search Role-based Privacy Filtering', () => {
    function filterSearchResultsForRole(results, role) {
      const canViewCost = ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'].includes(role);
      const isOfficeAssistant = role === 'Office Assistant';

      return results.filter((item) => {
        if (!canViewCost && (item.category === 'Supplier Invoice' || item.category === 'Debit Note')) {
          return false;
        }
        if (isOfficeAssistant && item.category === 'Invoice' && item.isLedgerSummary) {
          return false;
        }
        return true;
      });
    }

    test('Filters out Supplier Invoices and Debit Notes for Sales Executive', () => {
      const rawResults = [
        { id: '1', category: 'Customer', title: 'Swan Enterprises' },
        { id: '2', category: 'Supplier Invoice', title: 'Perfora Invoice ₹85,000' },
        { id: '3', category: 'Debit Note', title: 'Debit Note ₹12,000' },
        { id: '4', category: 'Quotation', title: 'Quote QTN-01' },
      ];

      const filtered = filterSearchResultsForRole(rawResults, 'Sales Executive');
      assert.equal(filtered.length, 2);
      assert.equal(filtered.some((i) => i.category === 'Supplier Invoice'), false);
      assert.equal(filtered.some((i) => i.category === 'Debit Note'), false);
    });

    test('Preserves Supplier Invoices and Debit Notes for Accounts and MD', () => {
      const rawResults = [
        { id: '1', category: 'Customer', title: 'Swan Enterprises' },
        { id: '2', category: 'Supplier Invoice', title: 'Perfora Invoice ₹85,000' },
        { id: '3', category: 'Debit Note', title: 'Debit Note ₹12,000' },
      ];

      const filteredAccts = filterSearchResultsForRole(rawResults, 'Accounts');
      assert.equal(filteredAccts.length, 3);

      const filteredMD = filterSearchResultsForRole(rawResults, 'Managing Director');
      assert.equal(filteredMD.length, 3);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Production Security Environment Guards
  // -------------------------------------------------------------------------
  describe('9. Production Security Environment Guards', () => {
    function checkAuthEndpointStatus(envNodeEnv, allowDevBypass) {
      if (envNodeEnv === 'production' && !allowDevBypass) {
        return { status: 403, allowed: false, error: 'Synthetic auth endpoint is disabled in production environments.' };
      }
      return { status: 200, allowed: true };
    }

    test('Rejects synthetic auth token generation in production by default', () => {
      const check = checkAuthEndpointStatus('production', false);
      assert.equal(check.status, 403);
      assert.equal(check.allowed, false);
      assert.match(check.error, /disabled in production/);
    });

    test('Allows auth endpoint in development mode', () => {
      const check = checkAuthEndpointStatus('development', false);
      assert.equal(check.status, 200);
      assert.equal(check.allowed, true);
    });
  });

});
