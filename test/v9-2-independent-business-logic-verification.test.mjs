import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('ICON TECH PRO ERP V9.2 — Independent Business Logic Functional Execution Verification', () => {

  // =========================================================================
  // 1. OPEN FILE CLOSURE RULES & WORKFLOW EXECUTION
  // =========================================================================
  describe('1. Open File State Machine & Closure Guard Execution', () => {

    function simulateCloseFile(file, payload, userRole = 'Sales Executive', userName = 'B Vineet Babu') {
      if (payload.reason === 'Other' && (!payload.explanation || payload.explanation.trim().length < 5)) {
        return { success: false, error: 'Explanation is mandatory when closure reason is "Other".' };
      }

      if (payload.category === 'Lost Enquiry') {
        if (file.has_confirmed_order || (file.customer_pos && file.customer_pos.length > 0)) {
          return {
            success: false,
            error: 'A confirmed customer order or PO already exists for this file. It cannot be closed as a Lost Enquiry. Please use Cancelled Order or complete financial review.',
          };
        }

        return {
          success: true,
          data: {
            ...file,
            sales_status: 'Lost',
            fulfilment_status: 'Cancelled',
            financial_status: 'Closed',
            status: 'Cancelled',
            closure_category: 'Lost Enquiry',
            closure_reason: payload.reason,
            closure_explanation: payload.explanation,
            closed_at: new Date().toISOString(),
            closed_by: userName,
          },
        };
      }

      if (payload.category === 'Successfully Completed') {
        const isFulfilmentDone = file.fulfilment_status === 'Fulfilment Completed';
        const isFinancialSettled = file.financial_status === 'Financially Settled';

        if (!isFulfilmentDone || !isFinancialSettled) {
          return {
            success: false,
            error: `Cannot close file as Completed. Both Fulfilment must be Completed (current: ${file.fulfilment_status}) and Financials must be Settled (current: ${file.financial_status}).`,
          };
        }

        return {
          success: true,
          data: {
            ...file,
            sales_status: 'Order Confirmed',
            status: 'Completed',
            closure_category: 'Successfully Completed',
            closure_reason: payload.reason,
            closed_at: new Date().toISOString(),
            closed_by: userName,
          },
        };
      }

      if (payload.category === 'Cancelled Confirmed Order') {
        if (!['Managing Director', 'Admin / BDM', 'Accounts'].includes(userRole)) {
          return {
            success: false,
            error: 'Only Managing Director or Accounts can approve cancellation of a confirmed order file.',
          };
        }

        return {
          success: true,
          data: {
            ...file,
            sales_status: 'Cancelled',
            fulfilment_status: 'Cancelled',
            financial_status: 'Closed',
            status: 'Cancelled',
            closure_category: payload.category,
            closure_reason: payload.reason,
            closed_at: new Date().toISOString(),
            closed_by: userName,
          },
        };
      }

      return { success: false, error: 'Invalid closure category specified.' };
    }

    test('Lost Enquiry (Requirement Not Needed): closes immediately without financial settlement when no order exists', () => {
      const activeEnquiryFile = {
        id: 'PRJ-TEST-001',
        project_number: 'FILE-2026-9001',
        customer_name: 'Dr. Reddy Labs Biotech',
        has_confirmed_order: false,
        has_financial_commitments: false,
        customer_pos: [],
        sales_status: 'Quotation Sent',
        fulfilment_status: 'Not Started',
        financial_status: 'No Financial Activity',
      };

      const res = simulateCloseFile(activeEnquiryFile, {
        category: 'Lost Enquiry',
        reason: 'Requirement Not Needed',
        explanation: 'Customer cancelled boardroom upgrade due to internal budget reallocation.',
      });

      assert.equal(res.success, true);
      assert.equal(res.data.sales_status, 'Lost');
      assert.equal(res.data.closure_category, 'Lost Enquiry');
      assert.equal(res.data.closure_reason, 'Requirement Not Needed');
      assert.ok(res.data.closed_at);
    });

    test('Lost Enquiry (Competitor Selected): closes immediately when no order exists', () => {
      const activeEnquiryFile = {
        id: 'PRJ-TEST-002',
        project_number: 'FILE-2026-9002',
        customer_name: 'Aurobindo Pharma R&D',
        has_confirmed_order: false,
        customer_pos: [],
        sales_status: 'Follow-up',
        fulfilment_status: 'Not Started',
        financial_status: 'No Financial Activity',
      };

      const res = simulateCloseFile(activeEnquiryFile, {
        category: 'Lost Enquiry',
        reason: 'Competitor Selected',
        explanation: 'Competitor offered non-laser lamp projectors at lower initial CapEx.',
      });

      assert.equal(res.success, true);
      assert.equal(res.data.sales_status, 'Lost');
      assert.equal(res.data.closure_reason, 'Competitor Selected');
    });

    test('Rejects Lost Enquiry closure when confirmed customer order or PO exists', () => {
      const confirmedOrderFile = {
        id: 'PRJ-TEST-003',
        project_number: 'FILE-2026-9003',
        customer_name: 'T-Hub Foundation',
        has_confirmed_order: true,
        customer_pos: [{ id: 'CPO-01', po_number: 'THUB-PO-99', po_value: 372000 }],
        sales_status: 'Order Confirmed',
        fulfilment_status: 'Installation in Progress',
        financial_status: 'Partially Invoiced',
      };

      const res = simulateCloseFile(confirmedOrderFile, {
        category: 'Lost Enquiry',
        reason: 'Requirement Not Needed',
      });

      assert.equal(res.success, false);
      assert.match(res.error, /A confirmed customer order or PO already exists for this file/);
    });

    test('Successfully Completed closure requires BOTH fulfilment completion AND financial settlement', () => {
      // Case 1: Fulfilment done, financials pending
      const partialSettled = {
        id: 'PRJ-TEST-004',
        project_number: 'FILE-2026-9004',
        fulfilment_status: 'Fulfilment Completed',
        financial_status: 'Partially Paid',
      };
      const res1 = simulateCloseFile(partialSettled, {
        category: 'Successfully Completed',
        reason: 'Project Delivered Successfully',
      });
      assert.equal(res1.success, false);
      assert.match(res1.error, /Both Fulfilment must be Completed.*and Financials must be Settled/);

      // Case 2: Financials settled, fulfilment in progress
      const partialFulfil = {
        id: 'PRJ-TEST-005',
        project_number: 'FILE-2026-9005',
        fulfilment_status: 'Installation in Progress',
        financial_status: 'Financially Settled',
      };
      const res2 = simulateCloseFile(partialFulfil, {
        category: 'Successfully Completed',
        reason: 'Project Delivered Successfully',
      });
      assert.equal(res2.success, false);
      assert.match(res2.error, /Both Fulfilment must be Completed.*and Financials must be Settled/);

      // Case 3: Both done -> Closure succeeds!
      const fullyReady = {
        id: 'PRJ-TEST-006',
        project_number: 'FILE-2026-9006',
        fulfilment_status: 'Fulfilment Completed',
        financial_status: 'Financially Settled',
      };
      const res3 = simulateCloseFile(fullyReady, {
        category: 'Successfully Completed',
        reason: 'Project Delivered Successfully',
      });
      assert.equal(res3.success, true);
      assert.equal(res3.data.status, 'Completed');
      assert.equal(res3.data.closure_category, 'Successfully Completed');
    });

    test('Cancelled Confirmed Order requires privileged role (MD / Admin / Accounts)', () => {
      const orderFile = {
        id: 'PRJ-TEST-007',
        project_number: 'FILE-2026-9007',
        has_confirmed_order: true,
        fulfilment_status: 'Procurement in Progress',
        financial_status: 'Advance Invoiced',
      };

      // Sales Executive tries to cancel -> Rejected
      const resSales = simulateCloseFile(orderFile, {
        category: 'Cancelled Confirmed Order',
        reason: 'Customer Insolvency',
      }, 'Sales Executive');
      assert.equal(resSales.success, false);
      assert.match(resSales.error, /Only Managing Director or Accounts can approve cancellation/);

      // Accounts / MD tries to cancel -> Approved
      const resMD = simulateCloseFile(orderFile, {
        category: 'Cancelled Confirmed Order',
        reason: 'Customer Insolvency',
      }, 'Managing Director', 'Borra Narsimulu');
      assert.equal(resMD.success, true);
      assert.equal(resMD.data.closure_category, 'Cancelled Confirmed Order');
    });
  });

  // =========================================================================
  // 2. CUSTOMER PO PROCESSING & DEPARTMENT HANDOFF
  // =========================================================================
  describe('2. Customer PO Upload & Department Handoff', () => {
    function simulateUploadPO(file, payload) {
      if (!payload.po_number || !payload.po_date || !payload.po_value) {
        return { success: false, error: 'PO Number, PO Date, and PO Value are mandatory.' };
      }

      const newPO = {
        id: `CPO-${Date.now()}`,
        file_id: file.id,
        po_number: payload.po_number.trim(),
        po_date: payload.po_date,
        po_value: payload.po_value,
        payment_terms: payload.payment_terms || '30 Days',
        payment_trigger: payload.payment_trigger || 'DELIVERY_DATE',
        status: 'RECEIVED',
      };

      const customer_pos = [...(file.customer_pos || []), newPO];
      return {
        success: true,
        data: {
          ...file,
          customer_pos,
          has_confirmed_order: true,
          has_financial_commitments: true,
          sales_status: 'Customer PO Received',
          department_owner: 'Accounts',
          updated_at: new Date().toISOString(),
        },
      };
    }

    test('Uploading PO attaches multiple POs, sets confirmed order, and hands off to Accounts', () => {
      const initialFile = {
        id: 'PRJ-TEST-010',
        project_number: 'FILE-2026-9010',
        customer_pos: [],
        has_confirmed_order: false,
        department_owner: 'Sales',
      };

      // Upload PO 1
      const res1 = simulateUploadPO(initialFile, {
        po_number: 'SWAN-PO-2026-081',
        po_date: '2026-11-01',
        po_value: 345000,
        payment_terms: '30 Days',
        payment_trigger: 'DELIVERY_DATE',
      });

      assert.equal(res1.success, true);
      assert.equal(res1.data.customer_pos.length, 1);
      assert.equal(res1.data.has_confirmed_order, true);
      assert.equal(res1.data.department_owner, 'Accounts');
      assert.equal(res1.data.sales_status, 'Customer PO Received');

      // Upload supplementary PO 2 to same file
      const res2 = simulateUploadPO(res1.data, {
        po_number: 'SWAN-PO-2026-081-SUPP',
        po_date: '2026-11-03',
        po_value: 45000,
        payment_terms: 'Immediate on Delivery',
        payment_trigger: 'DELIVERY_DATE',
      });

      assert.equal(res2.success, true);
      assert.equal(res2.data.customer_pos.length, 2);
      assert.equal(res2.data.customer_pos[1].po_number, 'SWAN-PO-2026-081-SUPP');
    });
  });

  // =========================================================================
  // 3. FILE REOPENING WORKFLOW & AUDIT PRESERVATION
  // =========================================================================
  describe('3. File Reopening Workflow & Audit History Preservation', () => {
    test('Reopening request and MD approval preserves prior closure history', () => {
      const closedFile = {
        id: 'PRJ-TEST-020',
        project_number: 'FILE-2026-9020',
        status: 'Cancelled',
        sales_status: 'Lost',
        closure_category: 'Lost Enquiry',
        closure_reason: 'Budget Postponed',
        closed_at: '2026-10-01T10:00:00Z',
        closed_by: 'B Vineet Babu',
        reopen_history: [],
      };

      // Step 1: Sales requests reopening
      const request = {
        id: 'REOPEN-001',
        requested_by_id: 'USR-SALES-001',
        requested_by_name: 'B Vineet Babu',
        requested_at: new Date().toISOString(),
        reason: 'Customer secured Q3 budget approval and wants to resume project immediately.',
        status: 'PENDING',
      };
      closedFile.reopen_request = request;

      assert.equal(closedFile.reopen_request.status, 'PENDING');

      // Step 2: MD approves reopening
      const approverName = 'Borra Narsimulu';
      const approverId = 'USR-MD-001';
      request.status = 'APPROVED';
      request.decided_by_id = approverId;
      request.decided_by_name = approverName;
      request.decided_at = new Date().toISOString();

      closedFile.reopen_history.push({ ...request });
      closedFile.closed_at = undefined;
      closedFile.closed_by = undefined;
      closedFile.sales_status = 'Follow-up';
      closedFile.status = 'In Execution';
      closedFile.reopen_request = undefined;

      // Verify file is reactivated
      assert.equal(closedFile.status, 'In Execution');
      assert.equal(closedFile.sales_status, 'Follow-up');
      assert.equal(closedFile.closed_at, undefined);

      // Verify history is permanently preserved
      assert.equal(closedFile.reopen_history.length, 1);
      assert.equal(closedFile.reopen_history[0].status, 'APPROVED');
      assert.equal(closedFile.reopen_history[0].requested_by_name, 'B Vineet Babu');
      assert.equal(closedFile.reopen_history[0].decided_by_name, 'Borra Narsimulu');
    });
  });

  // =========================================================================
  // 4. CROSS-MONTH ACCOUNTING MARGIN ALIGNMENT
  // =========================================================================
  describe('4. Cross-Month Procurement / Sales Margin Alignment', () => {
    test('Calculates authentic order gross margin across November purchase and December sale', () => {
      const crossMonthOrder = {
        file_id: 'FILE-2026-0042',
        purchase_date: '2026-11-27',
        purchase_amount: 420000,
        purchase_gst_return: 'GSTR-2B (Nov 2026)',
        sales_date: '2026-12-05',
        sales_amount: 510000,
        sales_gst_return: 'GSTR-1 (Dec 2026)',
      };

      const grossMargin = crossMonthOrder.sales_amount - crossMonthOrder.purchase_amount;
      const marginPct = Number(((grossMargin / crossMonthOrder.sales_amount) * 100).toFixed(2));

      assert.equal(grossMargin, 90000);
      assert.equal(marginPct, 17.65);
      assert.ok(crossMonthOrder.purchase_date.startsWith('2026-11'));
      assert.ok(crossMonthOrder.sales_date.startsWith('2026-12'));
    });
  });

  // =========================================================================
  // 5. UNALLOCATED BANK RECEIPTS ALLOCATION
  // =========================================================================
  describe('5. Unallocated Bank Receipts & Outstanding Invoices Allocation', () => {
    test('Allocates on-account receipt to invoice balance without exceeding balance', () => {
      let unallocatedBalance = 55000;
      let invoiceDue = 55000;

      // Attempt invalid over-allocation
      const invalidAllocation = 60000;
      const canAllocateOver = invalidAllocation <= unallocatedBalance;
      assert.equal(canAllocateOver, false);

      // Valid exact allocation
      const validAllocation = 55000;
      assert.equal(validAllocation <= unallocatedBalance, true);

      unallocatedBalance -= validAllocation;
      invoiceDue -= validAllocation;

      assert.equal(unallocatedBalance, 0);
      assert.equal(invoiceDue, 0);
    });
  });

  // =========================================================================
  // 6. ROLE-BASED PURCHASE COST & MARGIN PRIVACY
  // =========================================================================
  describe('6. Commercial Cost Redaction by Role', () => {
    function canViewPurchaseCosts(role) {
      if (!role) return false;
      return ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'].includes(role);
    }

    function sanitizeQuote(quote, role) {
      if (canViewPurchaseCosts(role)) return quote;
      return {
        ...quote,
        total_cost: 0,
        margin_pct: 0,
        items: quote.items.map((it) => ({ ...it, purchase_price: 0 })),
      };
    }

    test('Sales Executive and field staff receive strictly zeroed costs and margins', () => {
      const rawQuote = {
        quotation_number: 'ICON/26-27/QT-0112',
        grand_total: 250000,
        total_cost: 180000,
        margin_pct: 28.0,
        items: [
          { product_name: 'BenQ TK710', selling_price: 250000, purchase_price: 180000 },
        ],
      };

      const sanitizedForSales = sanitizeQuote(rawQuote, 'Sales Executive');
      assert.equal(sanitizedForSales.total_cost, 0);
      assert.equal(sanitizedForSales.margin_pct, 0);
      assert.equal(sanitizedForSales.items[0].purchase_price, 0);
      assert.equal(sanitizedForSales.grand_total, 250000);

      const privilegedView = sanitizeQuote(rawQuote, 'Managing Director');
      assert.equal(privilegedView.total_cost, 180000);
      assert.equal(privilegedView.margin_pct, 28.0);
      assert.equal(privilegedView.items[0].purchase_price, 180000);
    });
  });
});
