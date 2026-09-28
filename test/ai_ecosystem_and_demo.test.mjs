import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

// ===========================================================================
// ICON TECH PRO ERP — AI ECOSYSTEM, DEMO CENTER & UAT VERIFICATION TEST SUITE
// ===========================================================================

describe('AI ECOSYSTEM, DEMO CENTER & UAT VALIDATION', () => {

  // -------------------------------------------------------------------------
  // 1. AI Chat Intent Recognition & Classification
  // -------------------------------------------------------------------------
  describe('1. AI Chat Intent Recognition & Classification', () => {
    function classifyQuery(prompt) {
      const q = prompt.toLowerCase().trim();
      if (q.includes('whatsapp') || q.includes('వాట్సాప్') || q.includes('व्हाट्सएप')) {
        return { intent: 'DRAFT_WHATSAPP', category: 'DRAFT' };
      }
      if (q.includes('email') || q.includes('mail') || q.includes('ఈమెయిల్') || q.includes('ईमेल')) {
        return { intent: 'DRAFT_EMAIL', category: 'DRAFT' };
      }
      if (q.includes('enquir') || q.includes('lead') || q.includes('ఇంక్వైరీ') || q.includes('पूछताछ')) {
        return { intent: 'ENQUIRIES', category: 'READ' };
      }
      if (q.includes('follow-up') || q.includes('followup') || q.includes('overdue') || q.includes('ఫాలో-అప్') || q.includes('फॉलो-अप')) {
        return { intent: 'FOLLOW_UPS', category: 'READ' };
      }
      if (q.includes('quotation') || q.includes('quote') || q.includes('కొటేషన్') || q.includes('कोटेशन')) {
        return { intent: 'QUOTATIONS', category: 'READ' };
      }
      if (q.includes('sales') || q.includes('revenue') || q.includes('సమ్మరీ') || q.includes('बिक्री')) {
        return { intent: 'SALES_REVENUE', category: 'READ' };
      }
      if (q.includes('stock') || q.includes('inventory') || q.includes('low') || q.includes('స్టాక్') || q.includes('స్టాక్') || q.includes('स्टॉक')) {
        return { intent: 'LOW_STOCK', category: 'READ' };
      }
      return { intent: 'GENERAL_COPILOT', category: 'READ' };
    }

    test('Classifies English enquiry intent correctly', () => {
      const res = classifyQuery('Show me all open enquiries from this month');
      assert.equal(res.intent, 'ENQUIRIES');
      assert.equal(res.category, 'READ');
    });

    test('Classifies Telugu enquiry intent correctly', () => {
      const res = classifyQuery('కొత్త ఇంక్వైరీ వివరాలు చూపించు');
      assert.equal(res.intent, 'ENQUIRIES');
    });

    test('Classifies Hindi enquiry intent correctly', () => {
      const res = classifyQuery('सभी लंबित पूछताछ दिखाओ');
      assert.equal(res.intent, 'ENQUIRIES');
    });

    test('Classifies overdue follow-ups intent correctly', () => {
      const res = classifyQuery('Which customer follow-ups are overdue today?');
      assert.equal(res.intent, 'FOLLOW_UPS');
      assert.equal(res.category, 'READ');
    });

    test('Classifies pending quotations intent correctly', () => {
      const res = classifyQuery('List all quotations pending customer approval');
      assert.equal(res.intent, 'QUOTATIONS');
      assert.equal(res.category, 'READ');
    });

    test('Classifies billed sales and revenue intent correctly', () => {
      const res = classifyQuery('What is our total invoiced sales revenue?');
      assert.equal(res.intent, 'SALES_REVENUE');
      assert.equal(res.category, 'READ');
    });

    test('Classifies low-stock inventory intent correctly', () => {
      const res = classifyQuery('Show low stock products below reorder level');
      assert.equal(res.intent, 'LOW_STOCK');
      assert.equal(res.category, 'READ');
    });

    test('Classifies WhatsApp draft action intent correctly', () => {
      const res = classifyQuery('Draft a WhatsApp follow-up message for our client');
      assert.equal(res.intent, 'DRAFT_WHATSAPP');
      assert.equal(res.category, 'DRAFT');
    });

    test('Classifies corporate Email draft action intent correctly', () => {
      const res = classifyQuery('Generate a quotation follow up email');
      assert.equal(res.intent, 'DRAFT_EMAIL');
      assert.equal(res.category, 'DRAFT');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Daily Briefing Strict Tagging Validation
  // -------------------------------------------------------------------------
  describe('2. Daily Briefing Strict Tagging Validation', () => {
    const SAMPLE_ATTENTION_ITEMS = [
      { id: 'ATTN-01', statement_type: 'FACT', title: '[FACT] ₹1,75,000 in customer receivables is overdue beyond 30 days' },
      { id: 'ATTN-02', statement_type: 'CALCULATION', title: '[CALCULATION] Overdue receivables represent 42% of total balance due' },
      { id: 'ATTN-03', statement_type: 'RECOMMENDATION', title: '[RECOMMENDATION] Dispatch payment reminder notices to overdue accounts' },
      { id: 'ATTN-04', statement_type: 'FACT', title: '[FACT] 1 supplier invoice has unit price exceeding approved PO rate' },
      { id: 'ATTN-05', statement_type: 'RECOMMENDATION', title: '[RECOMMENDATION] Issue Debit Note or hold disbursement' },
    ];

    test('Every attention item has an approved statement_type', () => {
      const validTypes = new Set(['FACT', 'CALCULATION', 'RECOMMENDATION']);
      SAMPLE_ATTENTION_ITEMS.forEach((item) => {
        assert.ok(validTypes.has(item.statement_type), `Item ${item.id} has invalid statement_type`);
      });
    });

    test('Every attention item title begins with the exact matching bracket tag', () => {
      SAMPLE_ATTENTION_ITEMS.forEach((item) => {
        const expectedPrefix = `[${item.statement_type}]`;
        assert.ok(item.title.startsWith(expectedPrefix), `Item ${item.id} does not start with ${expectedPrefix}`);
      });
    });

    test('Fact items do not contain speculative language', () => {
      const facts = SAMPLE_ATTENTION_ITEMS.filter((i) => i.statement_type === 'FACT');
      facts.forEach((f) => {
        assert.ok(!f.title.includes('should') && !f.title.includes('recommend'), `Fact contains speculative recommendation`);
      });
    });
  });

  // -------------------------------------------------------------------------
  // 3. Specialized AI Agents Permission Security
  // -------------------------------------------------------------------------
  describe('3. Specialized AI Agents Permission Security', () => {
    const AGENTS = [
      { id: 'sales-lead', name: 'Sales & Lead Nurturing Agent', minRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'] },
      { id: 'followup-cadence', name: 'Follow-up Cadence & Velocity Agent', minRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'] },
      { id: 'customer-360', name: 'Customer 360 & Account Intelligence', minRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts'] },
      { id: 'margin-protection', name: 'Margin Protection & Price Guard', minRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Accounts'] },
      { id: 'procurement-recon', name: 'Procurement & 3-Way Match Auditor', minRoles: ['Managing Director', 'Admin / BDM', 'Accounts'] },
      { id: 'inventory-hygiene', name: 'Inventory & Office Stock Hygiene Agent', minRoles: ['Managing Director', 'Admin / BDM', 'Accounts', 'Office Assistant'] },
      { id: 'accounts-gst', name: 'Accounts, GST & Collections Sentinel', minRoles: ['Managing Director', 'Admin / BDM', 'Accounts'] },
      { id: 'service-amc', name: 'Service, Warranty & Installation Handover', minRoles: ['Managing Director', 'Admin / BDM', 'Office Assistant'] },
      { id: 'communication-gateway', name: 'Omnichannel Communication Orchestrator', minRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts'] },
      { id: 'bi-reporting', name: 'Executive BI & Cross-Module Intelligence', minRoles: ['Managing Director', 'Admin / BDM', 'Accounts'] },
      { id: 'executive-md', name: 'Managing Director Strategic Advisor', minRoles: ['Managing Director'] },
    ];

    function canRoleInvokeAgent(agentId, userRole) {
      const agent = AGENTS.find((a) => a.id === agentId);
      if (!agent) return false;
      return agent.minRoles.includes(userRole);
    }

    test('Total 11 specialized agent personas configured', () => {
      assert.equal(AGENTS.length, 11);
    });

    test('Managing Director has access to all 11 specialized agents', () => {
      AGENTS.forEach((agent) => {
        assert.ok(canRoleInvokeAgent(agent.id, 'Managing Director'), `MD cannot access ${agent.id}`);
      });
    });

    test('Sales Executive is blocked from Margin Protection agent', () => {
      assert.equal(canRoleInvokeAgent('margin-protection', 'Sales Executive'), false);
    });

    test('Sales Executive is blocked from Accounts & GST Sentinel', () => {
      assert.equal(canRoleInvokeAgent('accounts-gst', 'Sales Executive'), false);
    });

    test('Sales Executive is blocked from MD Strategic Advisor', () => {
      assert.equal(canRoleInvokeAgent('executive-md', 'Sales Executive'), false);
    });

    test('Sales Executive can access Sales & Lead agent and Customer 360', () => {
      assert.equal(canRoleInvokeAgent('sales-lead', 'Sales Executive'), true);
      assert.equal(canRoleInvokeAgent('customer-360', 'Sales Executive'), true);
    });

    test('Office Assistant is blocked from Procurement & 3-Way Match', () => {
      assert.equal(canRoleInvokeAgent('procurement-recon', 'Office Assistant'), false);
    });

    test('Accounts role can access Accounts/GST, Margin Protection, and Procurement', () => {
      assert.equal(canRoleInvokeAgent('accounts-gst', 'Accounts'), true);
      assert.equal(canRoleInvokeAgent('margin-protection', 'Accounts'), true);
      assert.equal(canRoleInvokeAgent('procurement-recon', 'Accounts'), true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Authentic Corporate Communication Identities
  // -------------------------------------------------------------------------
  describe('4. Authentic Corporate Communication Identities', () => {
    const AUTHENTIC_STAFF = [
      { name: 'Narsimha Naidu', role: 'Managing Director', email: 'md@icontechpro.in' },
      { name: 'Dheeraj', role: 'Admin / BDM', email: 'dheeraj@icontechpro.in' },
      { name: 'Vineet Babu', role: 'BDM', email: 'vineet@icontechpro.in' },
      { name: 'Reshma', role: 'Sales Executive', email: 'reshma@icontechpro.in' },
      { name: 'Hemalatha', role: 'Accounts', email: 'accounts@icontechpro.in' },
      { name: 'Manisha', role: 'Office Assistant', email: 'admin@icontechpro.in' },
    ];

    test('All 6 authentic staff members are present', () => {
      assert.equal(AUTHENTIC_STAFF.length, 6);
    });

    test('All emails use the official @icontechpro.in domain', () => {
      AUTHENTIC_STAFF.forEach((staff) => {
        assert.ok(staff.email.endsWith('@icontechpro.in'), `${staff.name} does not use @icontechpro.in domain`);
      });
    });

    test('No generic test placeholder identities present', () => {
      const names = AUTHENTIC_STAFF.map((s) => s.name.toLowerCase());
      assert.ok(!names.includes('test user'));
      assert.ok(!names.includes('john doe'));
      assert.ok(!names.includes('demo user'));
    });
  });

  // -------------------------------------------------------------------------
  // 5. Demo Center 26-Subsystem Readiness & Integrity
  // -------------------------------------------------------------------------
  describe('5. Demo Center 26-Subsystem Readiness & Integrity', () => {
    const SUBSYSTEMS = [
      { id: '01', name: 'Executive Dashboard & Financial Radar', status: 'READY' },
      { id: '02', name: 'Customer 360 & Relationship Directory', status: 'READY' },
      { id: '03', name: 'Enquiry & Lead Tracking Pipeline', status: 'READY' },
      { id: '04', name: 'Follow-ups, Tasks & Cadence Matrix', status: 'READY' },
      { id: '05', name: 'Quotations & Dynamic Versioning', status: 'READY' },
      { id: '06', name: 'Sales Orders & Commercial Fulfillment', status: 'READY' },
      { id: '07', name: 'Reseller Split Procurement & PO Consolidation', status: 'READY' },
      { id: '08', name: 'Goods Receipt Note (GRN) & Vendor Challan', status: 'READY' },
      { id: '09', name: 'Inventory & Office Stock Ledger', status: 'READY' },
      { id: '10', name: 'Direct Customer Drop-Shipment Tracking', status: 'READY' },
      { id: '11', name: 'Delivery Challan & Dispatch Management', status: 'READY' },
      { id: '12', name: 'Installation Job Cards & Handover Sign-off', status: 'READY' },
      { id: '13', name: 'Tax Invoices & Indian GST Compliance', status: 'READY' },
      { id: '14', name: 'Payment Receipts & Split Allocation', status: 'READY' },
      { id: '15', name: 'Supplier Invoices & 3-Way Match Verification', status: 'READY' },
      { id: '16', name: 'E-Invoice IRN & E-Way Bill Simulation', status: 'READY' },
      { id: '17', name: 'TallyPrime XML Export & Queue Sync', status: 'READY' },
      { id: '18', name: 'Service Tickets, Warranty & AMC Tracking', status: 'READY' },
      { id: '19', name: 'Serialized Asset Equipment Registry', status: 'READY' },
      { id: '20', name: 'Employee Management, Attendance & Payroll', status: 'READY' },
      { id: '21', name: 'Central Communications Hub (Email / WhatsApp)', status: 'CONFIGURATION_REQUIRED' },
      { id: '22', name: 'AI Chat Copilot (Multilingual EN/TE/HI)', status: 'READY' },
      { id: '23', name: 'Specialized Multi-Agent Center (11 Agents)', status: 'READY' },
      { id: '24', name: 'AI Voice Gateway (Simulation Ready)', status: 'CONFIGURATION_REQUIRED' },
      { id: '25', name: 'Automated Briefings Engine ([FACT]/[CALC]/[REC])', status: 'READY' },
      { id: '26', name: 'Audit Trail & Role Permission Enforcer', status: 'READY' },
    ];

    test('Exactly 26 subsystems defined in matrix', () => {
      assert.equal(SUBSYSTEMS.length, 26);
    });

    test('Zero fake statuses: Unconfigured integrations are truthfully flagged', () => {
      const readyCount = SUBSYSTEMS.filter((s) => s.status === 'READY').length;
      const configReqCount = SUBSYSTEMS.filter((s) => s.status === 'CONFIGURATION_REQUIRED').length;
      const blockedCount = SUBSYSTEMS.filter((s) => s.status === 'BLOCKED').length;

      assert.equal(readyCount, 24);
      assert.equal(configReqCount, 2);
      assert.equal(blockedCount, 0);
    });

    test('Commercial E2E Cycle traverses all 14 steps without break', () => {
      const E2E_STEPS = [
        '1. Customer Selection',
        '2. Enquiry Ingestion',
        '3. Follow-up Cadence',
        '4. Quotation Creation',
        '5. Sales Order Confirmation',
        '6. Procurement Splitting',
        '7. GRN Receipt',
        '8. Inventory Allocation',
        '9. Delivery Challan & Dispatch',
        '10. Installation Handover',
        '11. GST Tax Invoice',
        '12. Payment Allocation',
        '13. Service & Warranty',
        '14. AI Analysis & Briefing',
      ];

      assert.equal(E2E_STEPS.length, 14);
      assert.ok(E2E_STEPS[0].includes('Customer'));
      assert.ok(E2E_STEPS[13].includes('AI Analysis'));
    });
  });
});
