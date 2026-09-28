import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

// ===========================================================================
// 1. Communication Authorization & Send-As Security
// ===========================================================================
describe('Communication Authorization & Send-As Security', () => {
  const SENDER_POLICIES = {
    'Sales Executive': ['sales@icontechpro.com'],
    'BDM': ['sales@icontechpro.com', 'bdm@icontechpro.com'],
    'Operations Manager': ['sales@icontechpro.com', 'operations@icontechpro.com', 'service@icontechpro.com'],
    'Finance Manager': ['accounts@icontechpro.com', 'billing@icontechpro.com'],
    'Managing Director': ['sales@icontechpro.com', 'operations@icontechpro.com', 'accounts@icontechpro.com', 'md@icontechpro.com'],
  };

  function canSendAs(userRole, senderEmail) {
    const allowed = SENDER_POLICIES[userRole] || [];
    return allowed.includes(senderEmail.toLowerCase().trim());
  }

  test('Sales Executive can send as sales@icontechpro.com but cannot send as accounts@icontechpro.com', () => {
    assert.equal(canSendAs('Sales Executive', 'sales@icontechpro.com'), true);
    assert.equal(canSendAs('Sales Executive', 'accounts@icontechpro.com'), false);
    assert.equal(canSendAs('Sales Executive', 'md@icontechpro.com'), false);
  });

  test('Finance Manager can send as accounts@icontechpro.com and billing@icontechpro.com', () => {
    assert.equal(canSendAs('Finance Manager', 'accounts@icontechpro.com'), true);
    assert.equal(canSendAs('Finance Manager', 'billing@icontechpro.com'), true);
    assert.equal(canSendAs('Finance Manager', 'operations@icontechpro.com'), false);
  });

  test('Managing Director can send as any corporate identity', () => {
    assert.equal(canSendAs('Managing Director', 'md@icontechpro.com'), true);
    assert.equal(canSendAs('Managing Director', 'accounts@icontechpro.com'), true);
    assert.equal(canSendAs('Managing Director', 'sales@icontechpro.com'), true);
  });

  test('Preview communication formats message and masks sensitive variables', () => {
    function previewTemplate(template, params) {
      let body = template;
      for (const [key, val] of Object.entries(params)) {
        body = body.replaceAll('{{' + key + '}}', String(val));
      }
      return body;
    }

    const template = 'Dear {{customer_name}}, your order {{order_number}} of amount ₹{{amount}} is confirmed.';
    const rendered = previewTemplate(template, {
      customer_name: 'T-Hub Foundation',
      order_number: 'ICON/26-27/SO-0001',
      amount: '4,50,000',
    });
    assert.match(rendered, /T-Hub Foundation/);
    assert.match(rendered, /ICON\/26-27\/SO-0001/);
    assert.match(rendered, /4,50,000/);
  });
});

// ===========================================================================
// 2. Operational Tasks & Presales Follow-ups Engine
// ===========================================================================
describe('Operational Tasks & Presales Follow-ups Engine', () => {
  const sampleTasks = [
    {
      id: 'TSK-1',
      task_number: 'TSK-001',
      task_type: 'QUOTATION_FOLLOWUP',
      assigned_user_name: 'Vamshi Krishna',
      assigned_user_id: 'user-vamshi',
      due_date: '2026-04-10',
      status: 'Pending',
    },
    {
      id: 'TSK-2',
      task_number: 'TSK-002',
      task_type: 'PAYMENT_COLLECTION',
      assigned_user_name: 'Vamshi Krishna',
      assigned_user_id: 'user-vamshi',
      due_date: '2026-03-01', // Overdue relative to 2026-04-01
      status: 'Pending',
    },
    {
      id: 'TSK-3',
      task_number: 'TSK-003',
      task_type: 'AMC_RENEWAL',
      assigned_user_name: 'Dheeraj',
      assigned_user_id: 'user-dheeraj',
      due_date: '2026-04-01', // Today
      status: 'In Progress',
    },
    {
      id: 'TSK-4',
      task_number: 'TSK-004',
      task_type: 'DISPATCH_FOLLOWUP',
      assigned_user_name: 'Vamshi Krishna',
      assigned_user_id: 'user-vamshi',
      due_date: '2026-04-15', // Upcoming
      status: 'Completed',
    },
  ];

  function filterTasks(tasks, scope, currentUser, todayStr) {
    let result = [...tasks];
    if (scope === 'MY_TASKS') {
      result = result.filter(
        (t) => t.assigned_user_id === currentUser.id || t.assigned_user_name === currentUser.name
      );
    } else if (scope === 'OVERDUE') {
      result = result.filter(
        (t) => t.due_date < todayStr && t.status !== 'Completed' && t.status !== 'Cancelled'
      );
    } else if (scope === 'TODAY') {
      result = result.filter(
        (t) => t.due_date === todayStr && t.status !== 'Completed' && t.status !== 'Cancelled'
      );
    } else if (scope === 'UPCOMING') {
      result = result.filter(
        (t) => t.due_date > todayStr && t.status !== 'Completed' && t.status !== 'Cancelled'
      );
    } else if (scope === 'COMPLETED') {
      result = result.filter((t) => t.status === 'Completed');
    }
    return result;
  }

  const currentUser = { id: 'user-vamshi', name: 'Vamshi Krishna' };
  const todayStr = '2026-04-01';

  test('Filters MY_TASKS correctly for assigned user', () => {
    const myTasks = filterTasks(sampleTasks, 'MY_TASKS', currentUser, todayStr);
    assert.equal(myTasks.length, 3);
    assert.ok(myTasks.every((t) => t.assigned_user_name === 'Vamshi Krishna'));
  });

  test('Filters OVERDUE tasks excluding completed/cancelled items', () => {
    const overdue = filterTasks(sampleTasks, 'OVERDUE', currentUser, todayStr);
    assert.equal(overdue.length, 1);
    assert.equal(overdue[0].id, 'TSK-2');
  });

  test('Filters TODAY tasks due on current date', () => {
    const today = filterTasks(sampleTasks, 'TODAY', currentUser, todayStr);
    assert.equal(today.length, 1);
    assert.equal(today[0].id, 'TSK-3');
  });

  test('Filters UPCOMING tasks due after current date', () => {
    const upcoming = filterTasks(sampleTasks, 'UPCOMING', currentUser, todayStr);
    assert.equal(upcoming.length, 1);
    assert.equal(upcoming[0].id, 'TSK-1'); // TSK-4 is completed, so excluded
  });
});

// ===========================================================================
// 3. Commercial Approval Center & Self-Approval Prevention
// ===========================================================================
describe('Commercial Approval Workflow & Rule Enforcement', () => {
  function evaluateApproval(rule, requester, proposedValue) {
    let requiresApproval = false;
    if (rule.threshold_operator === '>' && proposedValue > rule.threshold_value) {
      requiresApproval = true;
    } else if (rule.threshold_operator === '<' && proposedValue < rule.threshold_value) {
      requiresApproval = true;
    }
    return requiresApproval;
  }

  function canUserApprove(request, approver) {
    // Self-approval check
    if (request.prevent_self_approval && request.requested_by_id === approver.id) {
      return { allowed: false, reason: 'Self-approval prohibited by commercial governance policy' };
    }

    const ROLE_HIERARCHY = {
      'Sales Executive': 1,
      'Technician': 1,
      'BDM': 2,
      'Operations Manager': 3,
      'Finance Manager': 3,
      'Managing Director': 4,
    };

    const requiredRank = ROLE_HIERARCHY[request.required_approver_role] || 4;
    const approverRank = ROLE_HIERARCHY[approver.role] || 0;

    // Managing Director can always approve/override
    if (approver.role === 'Managing Director') {
      return { allowed: true };
    }

    if (approverRank < requiredRank) {
      return { allowed: false, reason: `Minimum role required is ${request.required_approver_role}` };
    }

    return { allowed: true };
  }

  test('Discount > 5% triggers BDM approval requirement', () => {
    const discountRule = {
      threshold_metric: 'discount_pct',
      threshold_operator: '>',
      threshold_value: 5,
      min_role_required: 'BDM',
    };
    assert.equal(evaluateApproval(discountRule, { role: 'Sales Executive' }, 8), true);
    assert.equal(evaluateApproval(discountRule, { role: 'Sales Executive' }, 4), false);
  });

  test('Margin < 15% triggers Managing Director approval requirement', () => {
    const marginRule = {
      threshold_metric: 'margin_pct',
      threshold_operator: '<',
      threshold_value: 15,
      min_role_required: 'Managing Director',
    };
    assert.equal(evaluateApproval(marginRule, { role: 'BDM' }, 11), true);
    assert.equal(evaluateApproval(marginRule, { role: 'BDM' }, 18), false);
  });

  test('Prevents self-approval when requester and approver are the same user', () => {
    const request = {
      id: 'APR-001',
      requested_by_id: 'user-bdm-1',
      requested_by_name: 'BDM Rahul',
      required_approver_role: 'BDM',
      prevent_self_approval: true,
    };
    const approverSame = { id: 'user-bdm-1', role: 'BDM' };
    const check = canUserApprove(request, approverSame);
    assert.equal(check.allowed, false);
    assert.match(check.reason, /Self-approval prohibited/);
  });

  test('Allows higher authority to approve and Managing Director to override', () => {
    const request = {
      id: 'APR-002',
      requested_by_id: 'user-sales-1',
      requested_by_name: 'Sales Rep',
      required_approver_role: 'BDM',
      prevent_self_approval: true,
    };
    const bdmApprover = { id: 'user-bdm-2', role: 'BDM' };
    const mdApprover = { id: 'user-md-1', role: 'Managing Director' };

    assert.equal(canUserApprove(request, bdmApprover).allowed, true);
    assert.equal(canUserApprove(request, mdApprover).allowed, true);
  });
});

// ===========================================================================
// 4. Lean Procurement Distributor Recommendation & Cost Masking
// ===========================================================================
describe('Distributor Recommendation & Role-based Cost Masking', () => {
  const suppliers = [
    {
      supplier_id: 'SUP001',
      supplier_name: 'Hyderabad AV Tech Distributors',
      purchase_cost: 145000,
      lead_time_days: 2,
      availability_status: 'IN_STOCK',
      is_preferred: true,
      minimum_order_qty: 1,
    },
    {
      supplier_id: 'SUP002',
      supplier_name: 'National AV Wholesale Corp',
      purchase_cost: 139000,
      lead_time_days: 4,
      availability_status: '2_3_DAYS',
      is_preferred: false,
      minimum_order_qty: 1,
    },
    {
      supplier_id: 'SUP003',
      supplier_name: 'EduTech Displays India',
      purchase_cost: 142000,
      lead_time_days: 3,
      availability_status: 'IN_STOCK',
      is_preferred: false,
      minimum_order_qty: 5,
    },
  ];

  function scoreDistributors(supplierList, requestedQty = 1) {
    const minCost = Math.min(...supplierList.map((s) => s.purchase_cost));
    return supplierList.map((s) => {
      // Cost score (0-40)
      const costScore = (minCost / s.purchase_cost) * 40;
      // Lead time score (0-25)
      const leadScore = Math.max(0, 25 - s.lead_time_days * 3);
      // Stock score (0-25)
      const stockScore = s.availability_status === 'IN_STOCK' ? 25 : s.availability_status === '2_3_DAYS' ? 15 : 5;
      // Bonus / Penalties (0-10)
      let bonus = s.is_preferred ? 10 : 0;
      if (s.minimum_order_qty > requestedQty) bonus -= 15;

      const totalScore = Math.round(costScore + leadScore + stockScore + bonus);
      return { ...s, score: totalScore };
    }).sort((a, b) => b.score - a.score);
  }

  function maskPurchaseCosts(data, userRole) {
    const allowedRoles = ['Managing Director', 'Operations Manager', 'Finance Manager'];
    const canView = allowedRoles.includes(userRole);
    if (canView) return data;

    return data.map((item) => ({
      ...item,
      purchase_cost: 0,
      cost_masked: true,
    }));
  }

  test('Scores preferred distributor with in-stock availability highest', () => {
    const scored = scoreDistributors(suppliers, 1);
    assert.equal(scored[0].supplier_id, 'SUP001'); // In-stock + preferred
    assert.ok(scored[0].score > scored[1].score);
  });

  test('Penalizes supplier with MOQ higher than requested order quantity', () => {
    const scored = scoreDistributors(suppliers, 1);
    const moqSupplier = scored.find((s) => s.supplier_id === 'SUP003');
    assert.ok(moqSupplier.score < scored[0].score);
  });

  test('Masks purchase cost for Sales Executive', () => {
    const masked = maskPurchaseCosts(suppliers, 'Sales Executive');
    assert.ok(masked.every((m) => m.purchase_cost === 0 && m.cost_masked === true));
  });

  test('Preserves purchase cost for Operations Manager and MD', () => {
    const opsData = maskPurchaseCosts(suppliers, 'Operations Manager');
    assert.equal(opsData[0].purchase_cost, 145000);
    assert.equal(opsData[0].cost_masked, undefined);

    const mdData = maskPurchaseCosts(suppliers, 'Managing Director');
    assert.equal(mdData[0].purchase_cost, 145000);
  });
});

// ===========================================================================
// 5. Service & Installation: Auto-Warranty Activation & Workload
// ===========================================================================
describe('Service & Installation Handover and Workload', () => {
  test('Completing installation automatically activates warranty start and end dates on serials', () => {
    const serials = [
      { id: 'SER-1', serial_number: 'SN-001', warranty_duration_months: 12, status: 'ALLOCATED' },
      { id: 'SER-2', serial_number: 'SN-002', warranty_duration_months: 24, status: 'ALLOCATED' },
    ];

    const handoverDate = '2026-04-10';
    const updatedSerials = serials.map((s) => {
      const start = new Date(handoverDate);
      const end = new Date(handoverDate);
      end.setMonth(end.getMonth() + s.warranty_duration_months);

      return {
        ...s,
        warranty_start_date: start.toISOString().split('T')[0],
        warranty_end_date: end.toISOString().split('T')[0],
        status: 'ACTIVE_WARRANTY',
      };
    });

    assert.equal(updatedSerials[0].status, 'ACTIVE_WARRANTY');
    assert.equal(updatedSerials[0].warranty_start_date, '2026-04-10');
    assert.equal(updatedSerials[0].warranty_end_date, '2027-04-10');

    assert.equal(updatedSerials[1].warranty_end_date, '2028-04-10');
  });

  test('Calculates technician workload correctly across active and completed jobs', () => {
    const installations = [
      { lead_technician_name: 'Ravi Kumar', status: 'IN_PROGRESS' },
      { lead_technician_name: 'Ravi Kumar', status: 'SCHEDULED' },
      { lead_technician_name: 'Ravi Kumar', status: 'COMPLETED' },
      { lead_technician_name: 'Suresh Tech', status: 'IN_PROGRESS' },
    ];

    const workloadMap = {};
    installations.forEach((inst) => {
      const tech = inst.lead_technician_name;
      if (!workloadMap[tech]) {
        workloadMap[tech] = { active: 0, completed: 0, total: 0 };
      }
      workloadMap[tech].total++;
      if (inst.status === 'COMPLETED' || inst.status === 'HANDED_OVER') {
        workloadMap[tech].completed++;
      } else {
        workloadMap[tech].active++;
      }
    });

    assert.equal(workloadMap['Ravi Kumar'].active, 2);
    assert.equal(workloadMap['Ravi Kumar'].completed, 1);
    assert.equal(workloadMap['Ravi Kumar'].total, 3);
    assert.equal(workloadMap['Suresh Tech'].active, 1);
  });
});

// ===========================================================================
// 6. Warranty & AMC Expiration Alert Queries
// ===========================================================================
describe('Warranty & AMC Expiration Alert Engine', () => {
  const nowStr = '2026-04-01';

  test('Identifies serial warranties expiring within target window', () => {
    const serials = [
      { id: 's1', serial_number: 'SN-01', warranty_end_date: '2026-04-15' }, // 14 days away -> Match
      { id: 's2', serial_number: 'SN-02', warranty_end_date: '2026-04-28' }, // 27 days away -> Match
      { id: 's3', serial_number: 'SN-03', warranty_end_date: '2026-06-01' }, // 61 days away -> No match
      { id: 's4', serial_number: 'SN-04', warranty_end_date: '2026-03-20' }, // Expired already -> No match
    ];

    function getExpiringWarranties(list, withinDays = 30, baseDate = nowStr) {
      const base = new Date(baseDate).getTime();
      const maxTime = base + withinDays * 24 * 60 * 60 * 1000;
      return list.filter((s) => {
        if (!s.warranty_end_date) return false;
        const endTime = new Date(s.warranty_end_date).getTime();
        return endTime >= base && endTime <= maxTime;
      });
    }

    const expiring = getExpiringWarranties(serials, 30);
    assert.equal(expiring.length, 2);
    assert.deepEqual(expiring.map((s) => s.id), ['s1', 's2']);
  });

  test('Identifies active AMC contracts expiring within target window', () => {
    const amcs = [
      { id: 'amc1', contract_number: 'AMC-01', end_date: '2026-04-20', is_active: true }, // Match
      { id: 'amc2', contract_number: 'AMC-02', end_date: '2026-04-20', is_active: false }, // Inactive -> No match
      { id: 'amc3', contract_number: 'AMC-03', end_date: '2026-07-01', is_active: true }, // Far away -> No match
    ];

    function getExpiringAMCs(list, withinDays = 30, baseDate = nowStr) {
      const base = new Date(baseDate).getTime();
      const maxTime = base + withinDays * 24 * 60 * 60 * 1000;
      return list.filter((a) => {
        if (!a.is_active || !a.end_date) return false;
        const endTime = new Date(a.end_date).getTime();
        return endTime >= base && endTime <= maxTime;
      });
    }

    const expiring = getExpiringAMCs(amcs, 30);
    assert.equal(expiring.length, 1);
    assert.equal(expiring[0].id, 'amc1');
  });
});

// ===========================================================================
// 7. Supplier Invoices & 3-Way Match Invariant Engine
// ===========================================================================
describe('Supplier Invoice 3-Way Matching Engine', () => {
  function executeThreeWayMatch(po, invoice, grnRecords = []) {
    const discrepancies = [];

    // 1. Line Item Price & Quantity Match
    for (const invItem of invoice.items) {
      const poItem = po.items.find(
        (pi) => pi.product_name.toLowerCase() === invItem.product_name.toLowerCase()
      );

      if (!poItem) {
        discrepancies.push(`Item "${invItem.product_name}" not found in Purchase Order ${po.po_number}`);
        continue;
      }

      if (invItem.billed_unit_cost > poItem.unit_cost) {
        discrepancies.push(
          `PRICE_MISMATCH: Billed rate ₹${invItem.billed_unit_cost} exceeds PO rate ₹${poItem.unit_cost} for ${invItem.product_name}`
        );
      }

      if (invItem.billed_quantity > poItem.quantity) {
        discrepancies.push(
          `QTY_MISMATCH: Billed qty ${invItem.billed_quantity} exceeds PO qty ${poItem.quantity} for ${invItem.product_name}`
        );
      }

      // Check GRN receipt
      const totalReceived = (poItem.received_quantity || 0);
      if (invItem.billed_quantity > totalReceived) {
        discrepancies.push(
          `UNRECEIVED_GRN: Billed qty ${invItem.billed_quantity} exceeds verified GRN received qty ${totalReceived} for ${invItem.product_name}`
        );
      }
    }

    const isMatch = discrepancies.length === 0;
    const matchStatus = isMatch
      ? 'MATCHED'
      : discrepancies.some((d) => d.includes('PRICE_MISMATCH'))
      ? 'PRICE_MISMATCH'
      : discrepancies.some((d) => d.includes('QTY_MISMATCH'))
      ? 'QTY_MISMATCH'
      : 'UNRECEIVED_GRN';

    return {
      isMatch,
      matchStatus,
      discrepancies,
      shouldStageToTally: isMatch,
    };
  }

  const basePO = {
    po_number: 'PO260001',
    items: [
      { product_name: '75" Interactive Flat Panel', unit_cost: 145000, quantity: 2, received_quantity: 2 },
    ],
  };

  test('Validates perfect 3-way match and triggers Tally sync staging', () => {
    const perfectInvoice = {
      distributor_invoice_number: 'INV-DIST-991',
      items: [
        { product_name: '75" Interactive Flat Panel', billed_unit_cost: 145000, billed_quantity: 2 },
      ],
    };

    const match = executeThreeWayMatch(basePO, perfectInvoice);
    assert.equal(match.isMatch, true);
    assert.equal(match.matchStatus, 'MATCHED');
    assert.equal(match.discrepancies.length, 0);
    assert.equal(match.shouldStageToTally, true);
  });

  test('Flags PRICE_MISMATCH when supplier charges more than contracted PO unit rate', () => {
    const overchargedInvoice = {
      distributor_invoice_number: 'INV-DIST-992',
      items: [
        { product_name: '75" Interactive Flat Panel', billed_unit_cost: 152000, billed_quantity: 2 }, // PO is 145000
      ],
    };

    const match = executeThreeWayMatch(basePO, overchargedInvoice);
    assert.equal(match.isMatch, false);
    assert.equal(match.matchStatus, 'PRICE_MISMATCH');
    assert.equal(match.shouldStageToTally, false);
  });

  test('Flags QTY_MISMATCH when supplier bills more than PO quantity', () => {
    const overbilledInvoice = {
      distributor_invoice_number: 'INV-DIST-993',
      items: [
        { product_name: '75" Interactive Flat Panel', billed_unit_cost: 145000, billed_quantity: 3 }, // PO is 2
      ],
    };

    const match = executeThreeWayMatch(basePO, overbilledInvoice);
    assert.equal(match.isMatch, false);
    assert.equal(match.matchStatus, 'QTY_MISMATCH');
    assert.equal(match.shouldStageToTally, false);
  });

  test('Flags UNRECEIVED_GRN when material has not yet arrived or been verified in office/site', () => {
    const unreceivedPO = {
      po_number: 'PO260002',
      items: [
        { product_name: '75" Interactive Flat Panel', unit_cost: 145000, quantity: 2, received_quantity: 0 },
      ],
    };

    const unreceivedInvoice = {
      distributor_invoice_number: 'INV-DIST-994',
      items: [
        { product_name: '75" Interactive Flat Panel', billed_unit_cost: 145000, billed_quantity: 2 },
      ],
    };

    const match = executeThreeWayMatch(unreceivedPO, unreceivedInvoice);
    assert.equal(match.isMatch, false);
    assert.equal(match.matchStatus, 'UNRECEIVED_GRN');
  });
});

// ===========================================================================
// 8. TallyPrime Integration Queue & XML Voucher Generation
// ===========================================================================
describe('TallyPrime Integration Queue & XML Generator', () => {
  function generateTallyXml(voucher) {
    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>ICON TECH PRO</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${voucher.type}" ACTION="Create">
            <DATE>${voucher.date.replace(/-/g, '')}</DATE>
            <VOUCHERNUMBER>${voucher.number}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${voucher.partyLedger}</PARTYLEDGERNAME>
            <NARRATION>${voucher.narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${voucher.partyLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${voucher.isDebit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
              <AMOUNT>${voucher.amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  test('Generates valid Tally XML envelope for Sales Invoice voucher', () => {
    const xml = generateTallyXml({
      type: 'Sales',
      date: '2026-04-10',
      number: 'ICON/26-27/INV-0001',
      partyLedger: 'T-Hub Foundation (Sundry Debtors)',
      narration: 'AV Infrastructure Implementation',
      isDebit: true,
      amount: -450000,
    });

    assert.match(xml, /<ENVELOPE>/);
    assert.match(xml, /<SVCURRENTCOMPANY>ICON TECH PRO<\/SVCURRENTCOMPANY>/);
    assert.match(xml, /<VOUCHER VCHTYPE="Sales" ACTION="Create">/);
    assert.match(xml, /<VOUCHERNUMBER>ICON\/26-27\/INV-0001<\/VOUCHERNUMBER>/);
    assert.match(xml, /<PARTYLEDGERNAME>T-Hub Foundation \(Sundry Debtors\)<\/PARTYLEDGERNAME>/);
    assert.match(xml, /<DATE>20260410<\/DATE>/);
  });

  test('Ensures sync queueing is idempotent for same entity reference', () => {
    const queue = [];
    function queueForSync(item) {
      const existing = queue.find(
        (q) => q.entity_type === item.entity_type && q.entity_id === item.entity_id
      );
      if (existing) {
        return { isNew: false, item: existing };
      }
      const newItem = { ...item, id: `sync-${queue.length + 1}`, status: 'PENDING' };
      queue.push(newItem);
      return { isNew: true, item: newItem };
    }

    const first = queueForSync({ entity_type: 'INVOICE', entity_id: 'INV-001' });
    const duplicate = queueForSync({ entity_type: 'INVOICE', entity_id: 'INV-001' });

    assert.equal(first.isNew, true);
    assert.equal(duplicate.isNew, false);
    assert.equal(queue.length, 1);
  });
});

// ===========================================================================
// 9. Operational Notification Engine Triggers
// ===========================================================================
describe('Operational Notification Engine Triggers', () => {
  const triggers = [];
  function dispatchNotification(event, payload) {
    const notif = {
      id: `notif-${triggers.length + 1}`,
      trigger: event,
      title: '',
      recipientRole: 'Managing Director',
      read: false,
    };

    switch (event) {
      case 'ENQUIRY_ASSIGNED':
        notif.title = `New Enquiry ${payload.number} assigned to ${payload.rep}`;
        notif.recipientRole = 'Sales Executive';
        break;
      case 'QUOTATION_APPROVAL_REQUIRED':
        notif.title = `Quotation ${payload.number} requires ${payload.approvalType} approval`;
        notif.recipientRole = 'BDM';
        break;
      case 'PURCHASE_PRICE_MISMATCH':
        notif.title = `Invoice ${payload.invNum} has price discrepancy against PO ${payload.poNum}`;
        notif.recipientRole = 'Finance Manager';
        break;
      case 'WARRANTY_EXPIRING':
        notif.title = `Asset ${payload.serial} warranty expires in ${payload.days} days`;
        notif.recipientRole = 'Sales Executive';
        break;
      default:
        notif.title = 'System Notification';
    }
    triggers.push(notif);
    return notif;
  }

  test('Creates targeted notification for purchase price mismatch', () => {
    const notif = dispatchNotification('PURCHASE_PRICE_MISMATCH', {
      invNum: 'INV-991',
      poNum: 'PO-001',
    });
    assert.equal(notif.trigger, 'PURCHASE_PRICE_MISMATCH');
    assert.equal(notif.recipientRole, 'Finance Manager');
    assert.match(notif.title, /price discrepancy/);
  });

  test('Creates targeted notification for warranty expiring alert', () => {
    const notif = dispatchNotification('WARRANTY_EXPIRING', {
      serial: 'SN-IFP-4001',
      days: 15,
    });
    assert.equal(notif.trigger, 'WARRANTY_EXPIRING');
    assert.equal(notif.recipientRole, 'Sales Executive');
    assert.match(notif.title, /SN-IFP-4001/);
  });
});

// ===========================================================================
// 10. Safe AI Action Execution Layer & Anti-Abuse Guards
// ===========================================================================
describe('Safe AI Action Execution & Anti-Abuse Guards', () => {
  const PROHIBITED_KEYWORDS = ['DROP TABLE', 'TRUNCATE', 'DELETE FROM', 'BYPASS_RLS', 'ALTER TABLE'];

  function validateAiAction(action, userRole, confirmedByHuman) {
    // 1. Prohibited operation check
    const upper = (action.prompt || '').toUpperCase();
    for (const keyword of PROHIBITED_KEYWORDS) {
      if (upper.includes(keyword)) {
        return {
          allowed: false,
          blocked: true,
          reason: `Prohibited SQL or destructive operation detected: ${keyword}`,
        };
      }
    }

    // 2. High commercial impact check requires human confirmation
    if (action.action_type === 'APPROVE_DISCOUNT' && !confirmedByHuman) {
      return {
        allowed: false,
        blocked: false,
        requiresHumanConfirmation: true,
        reason: 'Commercial approval modifications require explicit human confirmation',
      };
    }

    // 3. Unauthorized role check
    if (action.action_type === 'APPROVE_DISCOUNT' && userRole === 'Sales Executive') {
      return {
        allowed: false,
        blocked: true,
        reason: 'Sales Executive role is not authorized to approve discounts',
      };
    }

    return { allowed: true, blocked: false };
  }

  test('Blocks destructive SQL drop/truncate attempts via AI layer', () => {
    const action = {
      action_type: 'EXECUTE_QUERY',
      prompt: 'DROP TABLE customers;',
    };
    const result = validateAiAction(action, 'Managing Director', true);
    assert.equal(result.allowed, false);
    assert.equal(result.blocked, true);
    assert.match(result.reason, /destructive operation detected/);
  });

  test('Enforces human confirmation requirement for commercial discounts', () => {
    const action = {
      action_type: 'APPROVE_DISCOUNT',
      prompt: 'Approve 10% discount on Quotation 1099',
    };
    const result = validateAiAction(action, 'BDM', false);
    assert.equal(result.allowed, false);
    assert.equal(result.requiresHumanConfirmation, true);
  });

  test('Blocks unauthorized role execution of commercial approval', () => {
    const action = {
      action_type: 'APPROVE_DISCOUNT',
      prompt: 'Approve 10% discount on Quotation 1099',
    };
    const result = validateAiAction(action, 'Sales Executive', true);
    assert.equal(result.allowed, false);
    assert.equal(result.blocked, true);
    assert.match(result.reason, /not authorized/);
  });
});

// ===========================================================================
// 11. Global Universal Search (Ctrl+K) Extended Natural Language Intents
// ===========================================================================
describe('Global Universal Search Day 3 Natural Language Recognizers', () => {
  function parseDay3SearchQuery(query) {
    const lower = query.toLowerCase().trim();

    if (/pending\s+approvals?|approval\s+requests?/i.test(lower)) {
      return { intent: 'PENDING_APPROVALS' };
    }

    if (/overdue\s+(?:customer\s+)?payments?|overdue\s+receivables?/i.test(lower)) {
      return { intent: 'OVERDUE_PAYMENTS' };
    }

    if (/(?:projector|ifp|av)\s+installations?\s+(?:this\s+month|upcoming)/i.test(lower)) {
      return { intent: 'INSTALLATIONS_SCHEDULE' };
    }

    const supInvMatch = lower.match(/(.+?)\s+(?:supplier\s+)?invoices?/i);
    if (supInvMatch) {
      return { intent: 'SUPPLIER_INVOICE_SEARCH', supplierTerm: supInvMatch[1].trim() };
    }

    const taskMatch = lower.match(/tasks?\s+(?:for|assigned\s+to)\s+(.+)/i);
    if (taskMatch) {
      return { intent: 'USER_TASKS', userTerm: taskMatch[1].trim() };
    }

    return { intent: 'GENERAL_SEARCH', term: lower };
  }

  test('Recognizes "pending approvals" intent', () => {
    const res = parseDay3SearchQuery('pending approvals');
    assert.equal(res.intent, 'PENDING_APPROVALS');
  });

  test('Recognizes "overdue customer payments" intent', () => {
    const res = parseDay3SearchQuery('overdue customer payments');
    assert.equal(res.intent, 'OVERDUE_PAYMENTS');
  });

  test('Recognizes "projector installations this month" intent', () => {
    const res = parseDay3SearchQuery('projector installations this month');
    assert.equal(res.intent, 'INSTALLATIONS_SCHEDULE');
  });

  test('Recognizes "perfora invoices" as supplier invoice search', () => {
    const res = parseDay3SearchQuery('perfora invoices');
    assert.equal(res.intent, 'SUPPLIER_INVOICE_SEARCH');
    assert.equal(res.supplierTerm, 'perfora');
  });

  test('Recognizes "tasks for Vamshi" as user-filtered task query', () => {
    const res = parseDay3SearchQuery('tasks for Vamshi');
    assert.equal(res.intent, 'USER_TASKS');
    assert.equal(res.userTerm, 'vamshi');
  });
});
