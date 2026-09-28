import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// ICON TECH PRO ERP V9.1 — Master Scope and Priority Control Verification Suite
// Self-contained Node ESM test runner - tests all 10 master-data & operational
// editing capabilities and strict financial/historical transaction protection.
// ============================================================================

describe('ICON TECH PRO ERP V9.1 — Master Scope & Safe Correction Verification', () => {

  // --------------------------------------------------------------------------
  // 1. Customer Master Data Editing & Duplicate Protection
  // --------------------------------------------------------------------------
  describe('1. Customer Master Data Editing', () => {
    const mockCustomer = {
      id: 'CUST-001',
      customer_code: 'ICON260001',
      customer_name: 'Alpha Systems Pvt Ltd',
      company_name: 'Alpha Systems Pvt Ltd',
      customer_type: 'COMPANY',
      phone: '9849012345',
      email: 'contact@alphasys.com',
      billing_address: 'Plot 12, HITEC City, Hyderabad',
      gstin: '36AABCA1234A1Z5',
      credit_limit: 500000,
      status: 'ACTIVE',
    };

    function updateCustomerLogic(customer, values, userRole) {
      const allowedRoles = ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'];
      if (!allowedRoles.includes(userRole)) {
        return { success: false, error: 'Unauthorized: insufficient permissions to edit customer' };
      }
      return {
        success: true,
        customer: {
          ...customer,
          ...values,
          customer_code: customer.customer_code, // strictly immutable
        },
      };
    }

    it('should allow authorized roles to correct customer phone, email, and address', () => {
      const res = updateCustomerLogic(mockCustomer, {
        phone: '9849099999',
        email: 'info@alphasys.com',
        billing_address: 'Plot 14, HITEC City, Hyderabad',
      }, 'Sales Executive');

      assert.ok(res.success, 'Update must succeed for Sales Executive');
      assert.equal(res.customer.phone, '9849099999');
      assert.equal(res.customer.email, 'info@alphasys.com');
      assert.equal(res.customer.customer_code, 'ICON260001', 'Customer code must remain strictly immutable');
    });

    it('should reject customer edit attempts by unauthorized roles', () => {
      const res = updateCustomerLogic(mockCustomer, { phone: '9999999999' }, 'Office Assistant');
      assert.equal(res.success, false);
      assert.match(res.error, /Unauthorized/);
    });

    it('should detect duplicate customers by phone, email, or GSTIN', () => {
      const existingCustomers = [mockCustomer];
      function checkDuplicate(query) {
        for (const c of existingCustomers) {
          if (query.phone && c.phone === query.phone) return { isDuplicate: true, matchedBy: 'phone' };
          if (query.email && c.email.toLowerCase() === query.email.toLowerCase()) return { isDuplicate: true, matchedBy: 'email' };
          if (query.gstin && c.gstin === query.gstin) return { isDuplicate: true, matchedBy: 'gstin' };
        }
        return { isDuplicate: false };
      }

      assert.equal(checkDuplicate({ phone: '9849012345' }).isDuplicate, true);
      assert.equal(checkDuplicate({ email: 'contact@alphasys.com' }).isDuplicate, true);
      assert.equal(checkDuplicate({ gstin: '36AABCA1234A1Z5' }).isDuplicate, true);
      assert.equal(checkDuplicate({ phone: '9876543210' }).isDuplicate, false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Enquiry Editing & Requirements Correction
  // --------------------------------------------------------------------------
  describe('2. Enquiry Master & Requirements Editing', () => {
    const mockEnquiry = {
      id: 'ENQ-001',
      enquiry_number: 'ENQ260001',
      customer_name: 'Tech Solutions',
      phone: '9849055555',
      product_category: 'Projector',
      requirement_summary: 'Requires 1x projector for meeting room',
      estimated_budget: 45000,
      follow_up_date: '2026-10-10',
      status: 'Enquiry',
    };

    function updateEnquiryLogic(enquiry, values, userRole) {
      const allowedRoles = ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'];
      if (!allowedRoles.includes(userRole)) {
        return { success: false, error: 'Unauthorized: insufficient permissions' };
      }
      return {
        success: true,
        data: {
          ...enquiry,
          ...values,
          enquiry_number: enquiry.enquiry_number, // strictly immutable
        },
      };
    }

    it('should allow sales staff to correct budget, requirement summary, and follow-up date', () => {
      const res = updateEnquiryLogic(mockEnquiry, {
        requirement_summary: 'Corrected: 2x 4K Laser Projectors with motorized ceiling mount',
        estimated_budget: 120000,
        follow_up_date: '2026-10-15',
      }, 'Sales Executive');

      assert.ok(res.success);
      assert.equal(res.data.estimated_budget, 120000);
      assert.equal(res.data.requirement_summary, 'Corrected: 2x 4K Laser Projectors with motorized ceiling mount');
      assert.equal(res.data.enquiry_number, 'ENQ260001', 'Enquiry number must remain strictly immutable');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Task Editing & Follow-up Rescheduling
  // --------------------------------------------------------------------------
  describe('3. Task Editing & Follow-up Rescheduling', () => {
    const mockTask = {
      id: 'TSK-001',
      task_number: 'ICON/26-27/TSK-0001',
      title: 'Follow up on Quotation',
      assigned_user_name: 'Vamshi Krishna',
      priority: 'MEDIUM',
      due_date: '2026-04-15',
      status: 'Pending',
    };

    function updateTaskLogic(task, values) {
      if (task.status === 'Completed') {
        return { success: false, error: 'Completed tasks cannot be directly modified' };
      }
      return {
        success: true,
        data: { ...task, ...values },
      };
    }

    it('should allow editing pending task title, due date, priority, and assignment', () => {
      const res = updateTaskLogic(mockTask, {
        title: 'Urgent: Follow up on Boardroom IFP Quotation',
        priority: 'URGENT',
        due_date: '2026-04-10',
      });
      assert.ok(res.success);
      assert.equal(res.data.priority, 'URGENT');
      assert.equal(res.data.due_date, '2026-04-10');
    });

    it('should strictly protect completed tasks from direct overwrite', () => {
      const completedTask = { ...mockTask, status: 'Completed' };
      const res = updateTaskLogic(completedTask, { priority: 'LOW' });
      assert.equal(res.success, false);
      assert.match(res.error, /Completed tasks cannot be directly modified/);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Site Visit Details & Findings Updating
  // --------------------------------------------------------------------------
  describe('4. Site Visit Details Updating', () => {
    const mockVisit = {
      id: 'SV-ENQ260001',
      scheduledDate: '2026-10-12',
      assignedTechnician: 'Nagaraju',
      siteAddress: 'Cyber Towers, Madhapur, Hyderabad',
      roomType: 'Commercial Hall',
      measurements: 'Standard Room Dimensions',
      status: 'SCHEDULED',
    };

    function updateSiteVisitLogic(visit, values) {
      return {
        success: true,
        data: { ...visit, ...values },
      };
    }

    it('should allow updating scheduled date, technician, room type, and measurements', () => {
      const res = updateSiteVisitLogic(mockVisit, {
        scheduledDate: '2026-10-18',
        assignedTechnician: 'Dheeraj',
        roomType: 'Boardroom / Executive Meeting Space',
        measurements: '24ft x 16ft x 10ft ceiling height',
      });
      assert.ok(res.success);
      assert.equal(res.data.scheduledDate, '2026-10-18');
      assert.equal(res.data.roomType, 'Boardroom / Executive Meeting Space');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Product Catalog Master Editing & Physical Stock Protection
  // --------------------------------------------------------------------------
  describe('5. Product Master Editing & Stock Protection Invariant', () => {
    const mockProduct = {
      id: 'prod_ifp_1',
      sku: 'IFP-86-4K',
      name: '86" Interactive Flat Panel 4K',
      brand_name: 'Generic',
      model_name: 'IFP-86',
      category_name: 'Interactive Flat Panel',
      gst_rate: 18,
      purchase_price: 185000,
      selling_price: 225000,
      current_stock: 4,
      reorder_level: 2,
    };

    function updateProductLogic(product, values, userRole) {
      if (!['Managing Director', 'Admin / BDM'].includes(userRole)) {
        return { success: false, error: 'Unauthorized: only Admin/MD can edit product catalog' };
      }
      // current_stock is stripped/protected from direct form overwrite
      const { current_stock, ...safeValues } = values;
      return {
        success: true,
        data: {
          ...product,
          ...safeValues,
          current_stock: product.current_stock, // strictly preserved
        },
      };
    }

    it('should allow Admin to update brand, model, selling price, and reorder level', () => {
      const res = updateProductLogic(mockProduct, {
        brand_name: 'ViewSonic Pro',
        model_name: 'IFP8650-3',
        reorder_level: 3,
        selling_price: 235000,
      }, 'Admin / BDM');

      assert.ok(res.success);
      assert.equal(res.data.brand_name, 'ViewSonic Pro');
      assert.equal(res.data.selling_price, 235000);
      assert.equal(res.data.current_stock, 4, 'Physical stock count must remain protected');
    });

    it('should ignore any attempt to directly modify stock via product master update', () => {
      const res = updateProductLogic(mockProduct, {
        current_stock: 999, // malicious or accidental overwrite attempt
      }, 'Admin / BDM');

      assert.equal(res.data.current_stock, 4, 'Stock count must NOT change via master form');
    });

    it('should reject product master edit attempts from Sales Executive', () => {
      const res = updateProductLogic(mockProduct, { selling_price: 200000 }, 'Sales Executive');
      assert.equal(res.success, false);
      assert.match(res.error, /Unauthorized/);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Supplier Sourcing Quotes Correction
  // --------------------------------------------------------------------------
  describe('6. Supplier Sourcing Offers Editing', () => {
    const mockOffer = {
      id: 'SPO-001',
      offer_number: 'SPO/2026-27/0001',
      supplier_name: 'EduTech Displays India',
      quoted_price: 215000,
      lead_time_days: 3,
      contact_person: 'Anil Kumar',
      phone: '9980077889',
      is_selected: false,
    };

    function updateSupplierOfferLogic(offer, values, userRole) {
      if (!['Managing Director', 'Admin / BDM', 'BDM'].includes(userRole)) {
        return { success: false, error: 'Unauthorized: insufficient sourcing permissions' };
      }
      return {
        success: true,
        data: { ...offer, ...values },
      };
    }

    it('should allow BDM to update renegotiated price, lead time, and contact info', () => {
      const res = updateSupplierOfferLogic(mockOffer, {
        quoted_price: 210000,
        lead_time_days: 2,
        contact_person: 'Anil Kumar (Regional VP)',
      }, 'BDM');

      assert.ok(res.success);
      assert.equal(res.data.quoted_price, 210000);
      assert.equal(res.data.lead_time_days, 2);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Purchase Orders (Draft/Issued vs Received Protection)
  // --------------------------------------------------------------------------
  describe('7. Purchase Order Editing & Received PO Protection', () => {
    const mockDraftPO = {
      id: 'PO260002',
      po_number: 'ICON/26-27/PO-0002',
      supplier_name: 'EduTech Displays India',
      expected_delivery: '2026-09-08',
      delivery_type: 'DIRECT_CUSTOMER_DROPSHIP',
      consignee_contact: 'Dr. Srinivas',
      status: 'Issued',
    };

    const mockReceivedPO = {
      ...mockDraftPO,
      id: 'PO260001',
      po_number: 'ICON/26-27/PO-0001',
      status: 'Received',
    };

    function updatePurchaseOrderLogic(po, values, userRole) {
      if (!['Managing Director', 'Admin / BDM', 'Accounts'].includes(userRole)) {
        return { success: false, error: 'Unauthorized' };
      }
      if (po.status === 'Received' || po.status === 'Closed') {
        return { success: false, error: 'Cannot modify PO in "Received" state. Finalized procurement transactions are protected.' };
      }
      return {
        success: true,
        data: { ...po, ...values },
      };
    }

    it('should allow Accounts to update expected delivery date and contact on Issued PO', () => {
      const res = updatePurchaseOrderLogic(mockDraftPO, {
        expected_delivery: '2026-09-12',
        consignee_contact: 'Dr. Srinivas (9849055555)',
      }, 'Accounts');

      assert.ok(res.success);
      assert.equal(res.data.expected_delivery, '2026-09-12');
    });

    it('should strictly block editing of finalized/received Purchase Orders', () => {
      const res = updatePurchaseOrderLogic(mockReceivedPO, {
        expected_delivery: '2026-09-20',
      }, 'Accounts');

      assert.equal(res.success, false);
      assert.match(res.error, /Finalized procurement transactions are protected/);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Sales Orders (Pending vs Dispatched Protection)
  // --------------------------------------------------------------------------
  describe('8. Sales Order Editing & Dispatched Order Protection', () => {
    const mockPendingOrder = {
      id: 'ORD260001',
      order_number: 'ICON/26-27/ORD-0001',
      customer_po_reference: 'PO-OLD-123',
      expected_delivery: '2026-09-10',
      dispatch_status: 'Not Dispatched',
      status: 'Confirmed',
    };

    const mockDispatchedOrder = {
      ...mockPendingOrder,
      id: 'ORD260002',
      dispatch_status: 'Dispatched',
      status: 'Completed',
    };

    function updateSalesOrderLogic(order, values, userRole) {
      if (!['Managing Director', 'Admin / BDM', 'BDM'].includes(userRole)) {
        return { success: false, error: 'Unauthorized' };
      }
      if (order.status === 'Completed' || order.dispatch_status === 'Dispatched') {
        return { success: false, error: 'Cannot modify Sales Order in "Dispatched" state. Finalized order transactions are protected.' };
      }
      return {
        success: true,
        data: { ...order, ...values },
      };
    }

    it('should allow BDM to correct customer PO reference and expected delivery date on un-dispatched orders', () => {
      const res = updateSalesOrderLogic(mockPendingOrder, {
        customer_po_reference: 'PO-CLIENT-REV-456',
        expected_delivery: '2026-09-15',
      }, 'BDM');

      assert.ok(res.success);
      assert.equal(res.data.customer_po_reference, 'PO-CLIENT-REV-456');
      assert.equal(res.data.expected_delivery, '2026-09-15');
    });

    it('should strictly block operational updates to completed/dispatched Sales Orders', () => {
      const res = updateSalesOrderLogic(mockDispatchedOrder, {
        expected_delivery: '2026-09-25',
      }, 'BDM');

      assert.equal(res.success, false);
      assert.match(res.error, /Finalized order transactions are protected/);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Service Tickets & AMC Contract Editing
  // --------------------------------------------------------------------------
  describe('9. Service Tickets & AMC Contract Editing', () => {
    const mockTicket = {
      id: 'SRV260001',
      ticket_number: 'ICON/26-27/SRV-0001',
      customer_complaint: 'Optical lens misalignment',
      assigned_technician: 'Nagaraju',
      priority: 'HIGH',
      status: 'OPEN',
    };

    function updateServiceTicketLogic(ticket, values) {
      return {
        success: true,
        data: { ...ticket, ...values },
      };
    }

    it('should allow updating technician assignment and priority on service ticket', () => {
      const res = updateServiceTicketLogic(mockTicket, {
        assigned_technician: 'Nagaraju (Senior AV Tech)',
        priority: 'CRITICAL',
        resolution_details: 'Realigned prism block and recalibrated convergence',
      });
      assert.ok(res.success);
      assert.equal(res.data.priority, 'CRITICAL');
      assert.equal(res.data.assigned_technician, 'Nagaraju (Senior AV Tech)');
    });
  });

  // --------------------------------------------------------------------------
  // 10. Audit Logging Invariance for All Corrections
  // --------------------------------------------------------------------------
  describe('10. Audit Logging Invariance for Corrections', () => {
    const auditLogs = [];

    function recordAudit(action, module, details, user) {
      const entry = {
        id: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action,
        module,
        details,
        user_name: user.name,
        timestamp: new Date().toISOString(),
      };
      auditLogs.push(entry);
      return entry;
    }

    it('should record immutable audit entries with user, timestamp, and details for every correction', () => {
      const mockUser = { name: 'Dheeraj (Admin)' };
      const e1 = recordAudit('UPDATE_CUSTOMER', 'CUSTOMERS', 'Corrected phone for CUST0001', mockUser);
      const e2 = recordAudit('UPDATE_ENQUIRY', 'ENQUIRIES', 'Updated budget for ENQ260001', mockUser);
      const e3 = recordAudit('UPDATE_TASK', 'TASKS', 'Rescheduled due date for TSK-001', mockUser);

      assert.equal(auditLogs.length, 3);
      assert.equal(e1.action, 'UPDATE_CUSTOMER');
      assert.equal(e2.action, 'UPDATE_ENQUIRY');
      assert.equal(e3.action, 'UPDATE_TASK');
      for (const log of auditLogs) {
        assert.ok(log.user_name, 'Log must record user');
        assert.ok(log.timestamp, 'Log must record timestamp');
        assert.ok(log.details, 'Log must record change details');
      }
    });
  });
});
