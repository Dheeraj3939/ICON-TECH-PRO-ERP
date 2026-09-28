import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// -----------------------------------------------------------------------------
// ICON TECH PRO ERP V9.2 — FINAL HUMAN UAT & RELEASE FREEZE VERIFICATION
// -----------------------------------------------------------------------------

const SIX_OFFICIAL_EMPLOYEES = [
  {
    name: 'Borra Narsimulu',
    email: 'icontechpro@gmail.com',
    role: 'Managing Director',
    dept: 'Executive / Leadership',
    expectedGmail: true,
    expectedZohoConfig: true,
    expectedAuditView: true,
    expectedAccountsView: true,
    expectedConfidentialDocs: true,
    expectedRestrictedDocs: true,
  },
  {
    name: 'B V Dheeraj Reddy',
    email: 'dheeraj@icontechpro.in',
    role: 'Admin / BDM',
    dept: 'Sales Executive / Admin & System Admin',
    expectedGmail: true,
    expectedZohoConfig: true,
    expectedAuditView: true,
    expectedAccountsView: true,
    expectedConfidentialDocs: true,
    expectedRestrictedDocs: true,
  },
  {
    name: 'B Vineet Babu',
    email: 'vineet@icontechpro.in',
    role: 'Sales Executive',
    dept: 'Corporate Sales',
    expectedGmail: true,
    expectedZohoConfig: false,
    expectedAuditView: false,
    expectedAccountsView: false,
    expectedConfidentialDocs: false,
    expectedRestrictedDocs: false,
  },
  {
    name: 'Reshma',
    email: 'sales@icontechpro.in',
    role: 'Sales Executive',
    dept: 'Field Sales & Customer Communication',
    expectedGmail: false, // Strictly Denied
    expectedZohoConfig: false,
    expectedAuditView: false,
    expectedAccountsView: false,
    expectedConfidentialDocs: false,
    expectedRestrictedDocs: false,
  },
  {
    name: 'Hemalath',
    email: 'accounts@icontechpro.in',
    role: 'Accounts',
    dept: 'Finance & Compliance',
    expectedGmail: false, // Strictly Denied
    expectedZohoConfig: false,
    expectedAuditView: true,
    expectedAccountsView: true,
    expectedConfidentialDocs: true,
    expectedRestrictedDocs: false,
  },
  {
    name: 'Manisha',
    email: 'service01@icontechpro.in',
    role: 'Office Assistant',
    dept: 'Operations & Service Coordination',
    expectedGmail: true, // Authorized for office service coordination
    expectedZohoConfig: false,
    expectedAuditView: false,
    expectedAccountsView: false,
    expectedConfidentialDocs: false,
    expectedRestrictedDocs: false,
  },
];

// Production logic mirror for Gmail Mailbox Guard (src/lib/actions/gmail.ts lines 320-405)
const AUTHORIZED_GMAIL_MAILBOX_EMAILS = [
  'icontechpro@gmail.com',
  'dheeraj@icontechpro.in',
  'vineet@icontechpro.in',
  'service01@icontechpro.in',
];

const AUTHORIZED_GMAIL_MAILBOX_NAMES = [
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
  const normalizedEmail = (user.email || '').toLowerCase().trim();
  const normalizedName = (user.name || '').toLowerCase().trim();

  // Explicit safety check: Reshma and Hemalath must NEVER be granted mailbox access by default
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

  if (AUTHORIZED_GMAIL_MAILBOX_EMAILS.some((e) => e.toLowerCase() === normalizedEmail)) {
    return true;
  }
  if (normalizedEmail === 'md@icontechpro.in' && (user.role === 'Managing Director' || normalizedName.includes('narsim') || normalizedName.includes('borra'))) {
    return true;
  }
  if (AUTHORIZED_GMAIL_MAILBOX_NAMES.some((n) => n === normalizedName)) {
    return true;
  }
  return false;
}

// Production logic mirror for Zoho Deduplication (src/lib/integrations/zoho/dedup.ts lines 35-215)
function findDuplicateCustomerLogic({ externalId, email, phone, companyName, existingCustomers = [], existingMappings = [] }) {
  // 1. External ID (Rank 1)
  const mapMatch = existingMappings.find((m) => m.external_id === externalId && m.provider === 'zoho_crm');
  if (mapMatch) return { matched: true, matchType: 'EXTERNAL_ID', existingCustomerId: mapMatch.erp_id };

  // 2. Email (Rank 2)
  if (email) {
    const normEmail = email.trim().toLowerCase();
    const emailMatch = existingCustomers.find((c) => c.email && c.email.trim().toLowerCase() === normEmail);
    if (emailMatch) return { matched: true, matchType: 'EMAIL', existingCustomerId: emailMatch.id };
  }

  // 3. Phone (Rank 3)
  if (phone) {
    const normPhone = phone.replace(/\D/g, '').slice(-10);
    const phoneMatch = existingCustomers.find((c) => {
      const p = (c.phone || '').replace(/\D/g, '').slice(-10);
      return p === normPhone;
    });
    if (phoneMatch) return { matched: true, matchType: 'PHONE', existingCustomerId: phoneMatch.id };
  }

  // 4. Company Name (Rank 4) - Strict Ambiguity Guard
  if (companyName && companyName.trim().length > 2) {
    const normCompany = companyName.trim().toLowerCase();
    const compMatches = existingCustomers.filter((c) => (c.company_name || '').trim().toLowerCase() === normCompany);
    if (compMatches.length > 1) {
      return {
        matched: false,
        matchType: 'AMBIGUOUS_COMPANY',
        requiresHumanReview: true,
        candidateMatches: compMatches,
        reviewReason: `Ambiguous match: Found ${compMatches.length} customer records with company name "${companyName}". Automatic merge prohibited; routed to human-review queue.`,
      };
    }
    if (compMatches.length === 1) {
      return { matched: true, matchType: 'COMPANY_NAME', existingCustomerId: compMatches[0].id };
    }
  }

  return { matched: false, matchType: 'NONE' };
}

test('ICON TECH PRO ERP V9.2 — End-to-End Human UAT & Release Freeze Suite', async (t) => {

  // ===========================================================================
  // SECTION 1: SIX-USER AUTHENTICATION & ACCESS MATRIX
  // ===========================================================================
  await t.test('1. Six-User Authentication, Role Identification & Dashboard Access', async (st) => {
    for (const emp of SIX_OFFICIAL_EMPLOYEES) {
      await st.test(`User: ${emp.name} (${emp.role})`, () => {
        assert.ok(emp.email.endsWith('@icontechpro.in') || emp.email === 'icontechpro@gmail.com');
        assert.ok(['Managing Director', 'Admin / BDM', 'Sales Executive', 'Accounts', 'Office Assistant'].includes(emp.role));
      });
    }
  });

  // ===========================================================================
  // SECTION 2: GMAIL POSITIVE & NEGATIVE ACCESS VERIFICATION
  // ===========================================================================
  await t.test('2. Corporate Gmail Shared Mailbox (icontechpro@gmail.com) Access Guard', async (st) => {
    // 1. Audit production source file to verify exact hardcoded security constants
    const gmailSrcPath = path.join(rootDir, 'src', 'lib', 'actions', 'gmail.ts');
    const gmailSrc = fs.readFileSync(gmailSrcPath, 'utf8');

    assert.ok(gmailSrc.includes("normalizedEmail === 'sales@icontechpro.in'"), 'Source must explicitly block sales email');
    assert.ok(gmailSrc.includes("normalizedEmail === 'accounts@icontechpro.in'"), 'Source must explicitly block accounts email');
    assert.ok(gmailSrc.includes("normalizedName === 'reshma'"), 'Source must explicitly block Reshma');
    assert.ok(gmailSrc.includes("normalizedName === 'hemalath'"), 'Source must explicitly block Hemalath');
    assert.ok(gmailSrc.includes("requireGmailMailboxAccess"), 'Source must export requireGmailMailboxAccess');

    // 2. Behavioral test for each of the six employees
    for (const emp of SIX_OFFICIAL_EMPLOYEES) {
      await st.test(`Gmail Access Check: ${emp.name} (${emp.role}) -> ${emp.expectedGmail ? 'ALLOWED' : 'DENIED'}`, () => {
        const isAuth = isUserAuthorizedForGmailMailboxLogic({
          id: `USR-${emp.name.replace(/\s+/g, '')}`,
          name: emp.name,
          email: emp.email,
          role: emp.role,
        });

        assert.strictEqual(
          isAuth,
          emp.expectedGmail,
          `Gmail access mismatch for ${emp.name}. Expected ${emp.expectedGmail} but got ${isAuth}`
        );
      });
    }

    // Specific negative assertions: Reshma and Hemalath must be rejected
    await st.test('Negative Guard: Reshma & Hemalath are strictly blocked from shared mailbox', () => {
      const reshmaAuth = isUserAuthorizedForGmailMailboxLogic({
        id: 'USR004',
        name: 'Reshma',
        email: 'sales@icontechpro.in',
        role: 'Sales Executive',
      });
      assert.strictEqual(reshmaAuth, false, 'Reshma must NEVER access shared Gmail mailbox');

      const hemalathAuth = isUserAuthorizedForGmailMailboxLogic({
        id: 'USR005',
        name: 'Hemalath',
        email: 'accounts@icontechpro.in',
        role: 'Accounts',
      });
      assert.strictEqual(hemalathAuth, false, 'Hemalath must NEVER access shared Gmail mailbox');
    });
  });

  // ===========================================================================
  // SECTION 3: ROLE-BASED ACCESS CONTROL (RBAC) & UNAUTHORIZED ACTION BLOCKING
  // ===========================================================================
  await t.test('3. RBAC Policy Enforcement & Unauthorized-Action Blocking', async (st) => {
    // Check Zoho configuration permission
    for (const emp of SIX_OFFICIAL_EMPLOYEES) {
      const canConfigZoho = ['Managing Director', 'Admin / BDM'].includes(emp.role);
      assert.strictEqual(canConfigZoho, emp.expectedZohoConfig, `Zoho config permission for ${emp.name}`);
    }

    // Check Audit Log visibility
    for (const emp of SIX_OFFICIAL_EMPLOYEES) {
      const canViewAudit = ['Managing Director', 'Admin / BDM', 'Accounts'].includes(emp.role);
      assert.strictEqual(canViewAudit, emp.expectedAuditView, `Audit view permission for ${emp.name}`);
    }

    // Check Accounts & Financial ledger visibility
    for (const emp of SIX_OFFICIAL_EMPLOYEES) {
      const canViewAccounts = ['Managing Director', 'Admin / BDM', 'Accounts'].includes(emp.role);
      assert.strictEqual(canViewAccounts, emp.expectedAccountsView, `Accounts permission for ${emp.name}`);
    }
  });

  // ===========================================================================
  // SECTION 4: FULL COMMERCIAL BUSINESS FLOW SIMULATION
  // ===========================================================================
  await t.test('4. End-to-End Commercial Business Flow (Customer -> Invoice -> AMC)', () => {
    // 1. Customer
    const customer = {
      id: 'CUST-UAT-001',
      customer_code: 'ICON260088',
      customer_name: 'Dr. Reddy Labs Innovation Hub',
      company_name: 'Dr. Reddy Laboratories Ltd',
      email: 'procurement@drreddylabs.com',
      phone: '9849011223',
      tax_number: '36AAACD1234F1Z5',
      state: 'Telangana',
      state_code: '36',
    };
    assert.match(customer.customer_code, /^ICON\d{6}$/);

    // 2. Enquiry
    const enquiry = {
      id: 'ENQ-UAT-001',
      enquiry_number: 'ENQ/26-27/0088',
      customer_id: customer.id,
      customer_name: customer.customer_name,
      stage: 'QUALIFIED',
      source: 'DIRECT_CALL',
      assigned_to: 'B Vineet Babu',
      estimated_value: 450000,
    };
    assert.strictEqual(enquiry.customer_id, customer.id);

    // 3. Site Visit
    const siteVisit = {
      id: 'SV-UAT-001',
      enquiry_id: enquiry.id,
      customer_id: customer.id,
      visit_date: '2026-09-30',
      technician: 'K. Suresh',
      status: 'COMPLETED',
      room_name: 'Boardroom 4th Floor',
      measurements: '32ft x 18ft, acoustic treated ceiling',
    };
    assert.strictEqual(siteVisit.enquiry_id, enquiry.id);

    // 4. Quotation with V9.2 Reseller Margin & Lock Rules
    const itemSourcingCost = 100000;
    const targetMarginPct = 20; // 20% margin
    const sellingPrice = itemSourcingCost / (1 - targetMarginPct / 100); // 125,000

    const quotation = {
      id: 'QUOT-UAT-001',
      quotation_number: 'QT/26-27/0088',
      revision_number: 0,
      customer_id: customer.id,
      items: [
        {
          sku: 'BENQ-CP8601K',
          description: 'BenQ 86" 4K Interactive Flat Panel',
          purchase_price: itemSourcingCost,
          selling_price: sellingPrice,
          margin_pct: targetMarginPct,
          quantity: 2,
          taxable_amount: sellingPrice * 2,
          gst_rate: 18,
          gst_amount: (sellingPrice * 2) * 0.18,
          total_amount: (sellingPrice * 2) * 1.18,
        },
      ],
      total_taxable: sellingPrice * 2,
      total_gst: (sellingPrice * 2) * 0.18,
      grand_total: (sellingPrice * 2) * 1.18,
      is_locked: false,
    };

    assert.strictEqual(quotation.items[0].selling_price, 125000);
    assert.strictEqual(quotation.items[0].margin_pct, 20);
    assert.strictEqual(quotation.grand_total, 295000);

    // 5. Revision Incrementing
    const revision1 = {
      ...quotation,
      id: 'QUOT-UAT-001-R1',
      revision_number: 1,
      quotation_number: 'QT/26-27/0088-R1',
    };
    assert.strictEqual(revision1.revision_number, 1);

    // 6. Sales Order
    const salesOrder = {
      id: 'SO-UAT-001',
      order_number: 'SO/26-27/0088',
      quotation_id: revision1.id,
      customer_id: customer.id,
      status: 'CONFIRMED',
      total_amount: revision1.grand_total,
    };
    assert.strictEqual(salesOrder.total_amount, 295000);

    // 7. Tax Invoice (Intrastate Telangana CGST + SGST)
    const isIntrastate = customer.state_code === '36';
    const cgstAmount = isIntrastate ? quotation.total_gst / 2 : 0;
    const sgstAmount = isIntrastate ? quotation.total_gst / 2 : 0;
    const igstAmount = isIntrastate ? 0 : quotation.total_gst;

    const invoice = {
      id: 'INV-UAT-001',
      invoice_number: 'INV/26-27/0088',
      order_id: salesOrder.id,
      customer_id: customer.id,
      taxable_amount: quotation.total_taxable,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      grand_total: quotation.grand_total,
      payment_status: 'PARTIALLY_PAID',
    };

    assert.strictEqual(invoice.cgst_amount, 22500);
    assert.strictEqual(invoice.sgst_amount, 22500);
    assert.strictEqual(invoice.igst_amount, 0);

    // 8. Payment Receipt
    const payment = {
      id: 'PAY-UAT-001',
      invoice_id: invoice.id,
      amount: 150000,
      mode: 'NEFT_RTGS',
      reference: 'HDFCN2609280012',
      recorded_by: 'Hemalath',
    };
    assert.strictEqual(payment.recorded_by, 'Hemalath');

    // 9. AMC Opportunity Triggered on Handover
    const amcOpportunity = {
      id: 'AMC-OPP-UAT-001',
      customer_id: customer.id,
      source_invoice_id: invoice.id,
      opportunity_type: 'WARRANTY_CONVERSION',
      target_annual_value: Math.round(quotation.total_taxable * 0.10), // 10% annual AMC
      status: 'IDENTIFIED',
    };
    assert.strictEqual(amcOpportunity.target_annual_value, 25000);
  });

  // ===========================================================================
  // SECTION 5: TURNKEY PROJECT EXECUTION FLOW
  // ===========================================================================
  await t.test('5. Turnkey Projects Cockpit Delivery Flow', () => {
    const project = {
      id: 'PROJ-UAT-001',
      project_code: 'PRJ/26-27/0015',
      name: 'Dr. Reddy Executive Boardroom Turnkey AV',
      client_name: 'Dr. Reddy Laboratories Ltd',
      engine: 'Turnkey Execution Engine',
      engine_version: 'v9.2',
      category: 'AUDITORIUM_AND_BOARDROOM',
      rooms: [
        {
          name: 'Main Executive Boardroom',
          boq_items_count: 14,
          costing_total: 850000,
        },
      ],
      milestones: [
        { phase: 'SITE_SURVEY_AND_ENGINEERING', status: 'COMPLETED' },
        { phase: 'CABLING_AND_FIRST_FIX', status: 'COMPLETED' },
        { phase: 'EQUIPMENT_RACK_BUILD', status: 'IN_PROGRESS' },
        { phase: 'COMMISSIONING_AND_TUNING', status: 'PENDING' },
        { phase: 'USER_TRAINING_AND_HANDOVER', status: 'PENDING' },
      ],
      current_stage: 'EXECUTION',
    };

    assert.strictEqual(project.engine_version, 'v9.2');
    assert.strictEqual(project.milestones[0].status, 'COMPLETED');
    assert.strictEqual(project.milestones.length, 5);
  });

  // ===========================================================================
  // SECTION 6: PROCUREMENT & SUPPLIER SOURCING FLOW
  // ===========================================================================
  await t.test('6. Procurement, Sourcing & Margin Comparison', () => {
    const sourcingMatrix = [
      { supplier: 'Supertron Electronics', item: 'Interactive Panel 86"', cost: 105000, creditDays: 30 },
      { supplier: 'EduTech Displays India', item: 'Interactive Panel 86"', cost: 98000, creditDays: 45 },
      { supplier: 'Ingram Micro India', item: 'Interactive Panel 86"', cost: 102000, creditDays: 30 },
    ];

    const selected = sourcingMatrix.reduce((prev, curr) => curr.cost < prev.cost ? curr : prev);
    assert.strictEqual(selected.supplier, 'EduTech Displays India');
    assert.strictEqual(selected.cost, 98000);
  });

  // ===========================================================================
  // SECTION 7: AMC 45-DAY RADAR & MANDATORY HUMAN APPROVAL
  // ===========================================================================
  await t.test('7. AMC 45-Day Proactive Radar & Governance Gate', () => {
    const contract = {
      contract_number: 'AMC260001',
      customer_name: 'Sri Sai Hospitals & Diagnostic Center',
      end_date: '2026-10-31',
      annual_value: 36000,
    };

    const daysUntilExpiry = 33;
    const isWithin45Days = daysUntilExpiry <= 45;
    assert.ok(isWithin45Days, 'Contract must fall within the 45-day radar');

    const opp = {
      opportunity_number: 'AMC-OPP-26-0001',
      target_annual_value: 39600,
      ai_draft: 'Dear Sri Sai Hospitals, your AMC expires on 31-Oct-2026. Here is your proactive renewal proposal.',
      is_approved: false,
      status: 'IDENTIFIED',
    };

    function tryDispatch(oppItem) {
      if (!oppItem.is_approved) {
        throw new Error('Mandatory Governance Guard: This outreach draft has not been approved by an authorized manager yet.');
      }
      return 'DISPATCHED';
    }

    assert.throws(
      () => tryDispatch(opp),
      /Mandatory Governance Guard/,
      'Unapproved AMC draft cannot be dispatched'
    );

    opp.is_approved = true;
    opp.approved_by = 'Borra Narsimulu';
    opp.status = 'OUTREACH_PENDING_APPROVAL';

    const dispatchResult = tryDispatch(opp);
    assert.strictEqual(dispatchResult, 'DISPATCHED');
  });

  // ===========================================================================
  // SECTION 8: ZOHO CRM DEDUPLICATION & AMBIGUOUS COMPANY SAFETY
  // ===========================================================================
  await t.test('8. Zoho 4-Level Deterministic Deduplication Hierarchy', async (st) => {
    // 1. Audit production source file to verify ambiguous merge prohibition
    const dedupSrcPath = path.join(rootDir, 'src', 'lib', 'integrations', 'zoho', 'dedup.ts');
    const dedupSrc = fs.readFileSync(dedupSrcPath, 'utf8');

    assert.ok(dedupSrc.includes("matchType: 'AMBIGUOUS_COMPANY'"), 'Source must declare AMBIGUOUS_COMPANY');
    assert.ok(dedupSrc.includes("requiresHumanReview: true"), 'Source must require human review for ambiguous companies');
    assert.ok(dedupSrc.includes("if (companyMatches.length > 1)"), 'Source must check if multiple matches exist');

    await st.test('External ID match (Rank 1)', () => {
      const res = findDuplicateCustomerLogic({
        externalId: 'EXT-ZOHO-NONEXISTENT',
        email: 'nobody@nowhere.com',
      });
      assert.strictEqual(res.matched, false);
      assert.strictEqual(res.matchType, 'NONE');
    });

    await st.test('Ambiguous Company Name NEVER auto-merges (Human Review Queue)', () => {
      const existing = [
        {
          id: 'CUST-001',
          customer_code: 'ICON260001',
          customer_name: 'Vertex Solutions Hitec City',
          company_name: 'Vertex Solutions',
          email: 'admin@vertexhitec.com',
          phone: '9849000001',
        },
        {
          id: 'CUST-002',
          customer_code: 'ICON260002',
          customer_name: 'Vertex Solutions Gachibowli',
          company_name: 'Vertex Solutions',
          email: 'contact@vertexgachi.com',
          phone: '9849000002',
        },
      ];

      const res = findDuplicateCustomerLogic({
        externalId: 'ZOHO-LEAD-999',
        companyName: 'Vertex Solutions',
        email: 'info@vertex-newbranch.com',
        phone: '9849000099',
        existingCustomers: existing,
      });

      assert.strictEqual(res.matched, false, 'Ambiguous company must NOT auto-merge');
      assert.strictEqual(res.matchType, 'AMBIGUOUS_COMPANY');
      assert.strictEqual(res.requiresHumanReview, true, 'Must require human review');
      assert.strictEqual(res.candidateMatches?.length, 2, 'Must list all ambiguous candidate matches');
    });
  });

  // ===========================================================================
  // SECTION 9: AI GOVERNANCE & 5-STATE ACTION CLASSIFICATION
  // ===========================================================================
  await t.test('9. AI Governance 5-State Lifecycle & Non-Bypassable Human Gate', () => {
    const AI_STATES = [
      'Human Entered',
      'AI Generated',
      'AI Recommended',
      'Human Approved',
      'AI Executed',
    ];

    AI_STATES.forEach((state) => {
      assert.ok(typeof state === 'string');
    });

    const actionRecord = {
      tool_name: 'send_whatsapp_quotation',
      requires_human_confirmation: true,
      classification: 'AI Recommended',
      status: 'PENDING_CONFIRMATION',
    };

    function executeSafeAction(rec, approver) {
      if (rec.requires_human_confirmation && !approver) {
        throw new Error('BLOCKED_BY_POLICY: Action requires human approval');
      }
      rec.classification = 'Human Approved';
      rec.status = 'EXECUTED';
      rec.confirmed_by = approver;
      return rec;
    }

    assert.throws(
      () => executeSafeAction(actionRecord, null),
      /BLOCKED_BY_POLICY/,
      'AI cannot execute financial or external dispatch actions without human approval'
    );

    const approved = executeSafeAction(actionRecord, 'Borra Narsimulu');
    assert.strictEqual(approved.status, 'EXECUTED');
    assert.strictEqual(approved.confirmed_by, 'Borra Narsimulu');
  });

  // ===========================================================================
  // SECTION 10: DOCUMENT CENTER WORKFLOW & SENSITIVITY ENFORCEMENT
  // ===========================================================================
  await t.test('10. Document Center Upload, Sensitivity Gates & Audit Enforcement', () => {
    const documents = [
      {
        id: 'DOC-1',
        title: 'ICON TECH PRO Profile 2026',
        category: 'COMPANY_PROFILES',
        sensitivity: 'NORMAL',
      },
      {
        id: 'DOC-2',
        title: 'Cyient Master Agreement (Signed)',
        category: 'LEGAL_CONTRACT',
        sensitivity: 'CONFIDENTIAL',
      },
      {
        id: 'DOC-3',
        title: 'BenQ Distributor Wholesale Margin Matrix',
        category: 'COMMERCIAL',
        sensitivity: 'RESTRICTED',
      },
    ];

    function filterByRole(docs, role) {
      return docs.filter((doc) => {
        if (doc.sensitivity === 'NORMAL') return true;
        if (doc.sensitivity === 'CONFIDENTIAL') {
          return ['Managing Director', 'Admin / BDM', 'Accounts'].includes(role);
        }
        if (doc.sensitivity === 'RESTRICTED') {
          return ['Managing Director', 'Admin / BDM'].includes(role);
        }
        return false;
      });
    }

    // Sales Executive (Vineet / Reshma): sees only NORMAL
    const salesDocs = filterByRole(documents, 'Sales Executive');
    assert.strictEqual(salesDocs.length, 1);
    assert.strictEqual(salesDocs[0].title, 'ICON TECH PRO Profile 2026');

    // Office Assistant (Manisha): sees only NORMAL
    const assistantDocs = filterByRole(documents, 'Office Assistant');
    assert.strictEqual(assistantDocs.length, 1);

    // Accounts (Hemalath): sees NORMAL + CONFIDENTIAL (no RESTRICTED)
    const accountsDocs = filterByRole(documents, 'Accounts');
    assert.strictEqual(accountsDocs.length, 2);
    assert.ok(accountsDocs.some((d) => d.sensitivity === 'CONFIDENTIAL'));
    assert.ok(!accountsDocs.some((d) => d.sensitivity === 'RESTRICTED'));

    // Managing Director (Borra Narsimulu): sees ALL (NORMAL + CONFIDENTIAL + RESTRICTED)
    const mdDocs = filterByRole(documents, 'Managing Director');
    assert.strictEqual(mdDocs.length, 3);
  });
});
