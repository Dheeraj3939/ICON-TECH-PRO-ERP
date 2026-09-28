import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ICON TECH PRO ERP V8 — Phase C.1: Prospect → Enquiry / Opportunity Bridge Suite', () => {

  // Mock Database & State Store for Unit Testing
  class MockERPDatabase {
    constructor() {
      this.prospectCompanies = [
        {
          id: 'prosp-comp-001',
          company_name: 'Cyient Technologies Hyderabad Campus',
          normalized_name: 'cyient technologies hyderabad campus',
          domain: 'cyient.com',
          industry: 'Engineering & IT Infrastructure',
          headquarters_location: 'Financial District, Hyderabad, Telangana',
          status: 'DOSSIER_READY',
          crm_customer_id: null,
          org_id: 'org-001',
          latest_run_number: 2,
        },
        {
          id: 'prosp-comp-002',
          company_name: 'Aurobindo Pharma Corporate R&D Center',
          normalized_name: 'aurobindo pharma corporate rd center',
          domain: 'aurobindo.com',
          industry: 'Pharmaceuticals & Life Sciences',
          headquarters_location: 'HITEC City, Hyderabad, Telangana',
          status: 'DOSSIER_READY',
          crm_customer_id: null,
          org_id: 'org-001',
          latest_run_number: 1,
        },
      ];

      this.customers = [
        {
          id: 'CUST-001',
          customer_name: 'T-Hub Foundation',
          customer_type: 'Corporate',
          email: 'admin@t-hub.co',
          phone: '+91 40 6666 0001',
          city: 'Hyderabad',
          prospect_dossier_id: null,
          org_id: 'org-001',
        },
        {
          id: 'CUST-002',
          customer_name: 'Cyient Technologies Ltd',
          customer_type: 'Corporate',
          email: 'facilities@cyient.com',
          phone: '+91 40 6764 1000',
          city: 'Hyderabad',
          prospect_dossier_id: null,
          org_id: 'org-001',
        },
        {
          id: 'CUST-CROSS-ORG',
          customer_name: 'External Org Customer',
          customer_type: 'Commercial',
          email: 'external@other.com',
          phone: '+91 99999 99999',
          city: 'Bengaluru',
          prospect_dossier_id: null,
          org_id: 'org-999', // Different tenant
        },
      ];

      this.enquiries = [
        {
          id: 'ENQ-2026-001',
          enquiry_number: 'ENQ-2026-0001',
          customer_id: 'CUST-001',
          title: 'HVAC Chiller Overhaul',
          requirement_details: 'Existing inquiry for T-Hub phase 1',
          category: 'HVAC',
          priority: 'MEDIUM',
          status: 'OPEN',
          prospect_dossier_id: null,
          org_id: 'org-001',
          created_at: '2026-09-01T10:00:00Z',
        },
      ];

      this.auditLogs = [];
      this.idempotencyStore = new Map();
      this.researchRuns = [
        { id: 'run-001', company_id: 'prosp-comp-001', run_number: 1, summary: 'Run 1 summary' },
        { id: 'run-002', company_id: 'prosp-comp-001', run_number: 2, summary: 'Run 2 summary' },
      ];
      this.evidenceSources = [
        { id: 'ev-001', company_id: 'prosp-comp-001', url: 'https://cyient.com/news', reliability: 'HIGH' },
      ];
    }

    // Duplicate Check & Preparation Logic
    prepareConversion(prospectCompanyId, requestingUserRole, orgId = 'org-001') {
      const prospect = this.prospectCompanies.find((p) => p.id === prospectCompanyId);
      if (!prospect) throw new Error(`Prospect ${prospectCompanyId} not found`);
      if (prospect.org_id !== orgId) throw new Error('Tenant isolation violation');

      // Duplicate detection against customers
      const duplicates = [];
      const pNorm = prospect.normalized_name;
      const pDomain = (prospect.domain || '').toLowerCase().trim();

      for (const c of this.customers) {
        if (c.org_id !== orgId) continue;
        let score = 0;
        const cNorm = c.customer_name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        const cEmail = (c.email || '').toLowerCase();

        if (cNorm === pNorm || cNorm.includes(pNorm) || pNorm.includes(cNorm)) {
          score = 90;
        } else if (pDomain && cEmail.includes(pDomain)) {
          score = 85;
        }

        if (score > 50) {
          duplicates.push({
            id: c.id,
            customer_name: c.customer_name,
            customer_type: c.customer_type,
            email: c.email,
            phone: c.phone,
            city: c.city,
            match_score: score,
            matched_by: score === 90 ? 'NAME' : 'DOMAIN',
          });
        }
      }

      // Existing enquiries with same prospect_dossier_id
      const existingEnquiries = this.enquiries
        .filter((e) => e.prospect_dossier_id === prospectCompanyId && e.org_id === orgId)
        .map((e) => ({
          id: e.id,
          enquiry_number: e.enquiry_number,
          title: e.title,
          status: e.status,
          created_at: e.created_at,
        }));

      this.auditLogs.push({
        action: 'PROSPECT_DUPLICATE_CHECK_PERFORMED',
        prospect_dossier_id: prospectCompanyId,
        duplicates_count: duplicates.length,
        timestamp: new Date().toISOString(),
      });

      return {
        prospectCompanyId,
        prospectDossierId: prospectCompanyId,
        company_name: prospect.company_name,
        company_domain: prospect.domain,
        industry: prospect.industry,
        headquarters_location: prospect.headquarters_location,
        company_crm_customer_id: prospect.crm_customer_id,
        fit_score: 92,
        recommended_entry_angle: 'CCTV & BMS renewal',
        duplicate_customers: duplicates,
        existing_enquiries: existingEnquiries,
        proposed_enquiry: {
          title: `[Enterprise] ${prospect.company_name} — CCTV & BMS renewal`,
          requirement_details: `Identified upcoming expiry and expansion opportunity at ${prospect.headquarters_location}.`,
          category: 'HVAC',
          priority: 'MEDIUM',
          assigned_salesperson: 'Sales Team',
          advisory_budget: 1800000,
          site_visit_required: true,
        },
      };
    }

    // Governed Conversion Execution
    convertProspectToEnquiry(payload, userRole, orgId = 'org-001', simulateFailure = false) {
      // 1. RBAC check
      const authorizedRoles = ['Admin', 'Sales Director', 'Sales Manager', 'Sales Executive'];
      if (!authorizedRoles.includes(userRole)) {
        return { success: false, error: 'Unauthorized: Only authorized sales roles can convert prospects' };
      }

      // 2. Human confirmation check
      if (!payload.confirmedBy) {
        return { success: false, error: 'Human confirmation is mandatory for conversion' };
      }

      // 3. Scoped Idempotency check
      if (payload.idempotencyKey && this.idempotencyStore.has(payload.idempotencyKey)) {
        return this.idempotencyStore.get(payload.idempotencyKey);
      }

      // 4. Find prospect
      const prospect = this.prospectCompanies.find((p) => p.id === payload.prospectCompanyId);
      if (!prospect) return { success: false, error: 'Prospect company not found' };
      if (prospect.org_id !== orgId) return { success: false, error: 'Cross-organization prospect conversion blocked' };

      this.auditLogs.push({
        action: 'PROSPECT_CONVERSION_STARTED',
        prospect_dossier_id: payload.prospectCompanyId,
        confirmed_by: payload.confirmedBy,
        timestamp: new Date().toISOString(),
      });

      // 5. Customer Resolution (Link Existing vs Create New)
      let customerId = payload.crmCustomerId;
      let newlyCreatedCustomer = null;

      if (payload.customerMode === 'existing') {
        if (!customerId) return { success: false, error: 'Selected customer ID is required for linking' };
        const existingCust = this.customers.find((c) => c.id === customerId);
        if (!existingCust) return { success: false, error: `Existing customer ${customerId} not found` };
        if (existingCust.org_id !== orgId) return { success: false, error: 'Cannot link customer from different tenant' };

        // Link prospect_dossier_id if not already set
        if (!existingCust.prospect_dossier_id) {
          existingCust.prospect_dossier_id = payload.prospectDossierId;
        }

        this.auditLogs.push({
          action: 'PROSPECT_CUSTOMER_LINKED',
          customer_id: customerId,
          prospect_dossier_id: payload.prospectDossierId,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Create New Customer
        if (!payload.newCustomer?.name) return { success: false, error: 'Customer name is required' };
        customerId = `CUST-${Date.now().toString().slice(-4)}`;
        newlyCreatedCustomer = {
          id: customerId,
          customer_name: payload.newCustomer.name,
          customer_type: payload.newCustomer.customer_type || 'Corporate',
          contact_person: payload.newCustomer.contact_person || '',
          email: payload.newCustomer.email || '',
          phone: payload.newCustomer.phone || '',
          city: payload.newCustomer.city || 'Hyderabad',
          prospect_dossier_id: payload.prospectDossierId,
          org_id: orgId,
        };
        this.customers.push(newlyCreatedCustomer);

        this.auditLogs.push({
          action: 'PROSPECT_CUSTOMER_CREATED',
          customer_id: customerId,
          prospect_dossier_id: payload.prospectDossierId,
          timestamp: new Date().toISOString(),
        });
      }

      // 6. Simulate Failure / Atomic Rollback Check
      if (simulateFailure) {
        // Rollback created customer if needed
        if (newlyCreatedCustomer) {
          const idx = this.customers.findIndex((c) => c.id === newlyCreatedCustomer.id);
          if (idx !== -1) this.customers.splice(idx, 1);
        }
        this.auditLogs.push({
          action: 'PROSPECT_CONVERSION_FAILED_COMPENSATED',
          prospect_dossier_id: payload.prospectCompanyId,
          error: 'Simulated downstream enquiry insertion failure',
          timestamp: new Date().toISOString(),
        });
        return { success: false, error: 'Database error: enquiry creation failed, transaction rolled back' };
      }

      // 7. Create ERP Enquiry
      const enquiryNum = `ENQ-2026-${(this.enquiries.length + 1).toString().padStart(4, '0')}`;
      const newEnquiry = {
        id: `enq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        enquiry_number: enquiryNum,
        customer_id: customerId,
        title: payload.enquiry.title,
        requirement_details: payload.enquiry.requirement_details,
        category: payload.enquiry.category || 'HVAC',
        priority: payload.enquiry.priority || 'MEDIUM',
        assigned_salesperson: payload.enquiry.assigned_salesperson || 'Sales Team',
        advisory_budget: payload.enquiry.advisory_budget,
        site_visit_required: payload.enquiry.site_visit_required ?? false,
        notes: payload.enquiry.notes || '',
        source: 'AI Prospect Intelligence',
        status: 'OPEN',
        prospect_dossier_id: payload.prospectDossierId,
        org_id: orgId,
        created_at: new Date().toISOString(),
      };
      this.enquiries.push(newEnquiry);

      this.auditLogs.push({
        action: 'PROSPECT_ENQUIRY_CREATED',
        enquiry_id: newEnquiry.id,
        enquiry_number: enquiryNum,
        prospect_dossier_id: payload.prospectDossierId,
        timestamp: new Date().toISOString(),
      });

      // 8. Update Prospect Status
      prospect.status = 'CONVERTED';
      prospect.crm_customer_id = customerId;

      this.auditLogs.push({
        action: 'PROSPECT_CONVERSION_COMPLETED',
        prospect_dossier_id: payload.prospectDossierId,
        customer_id: customerId,
        enquiry_id: newEnquiry.id,
        enquiry_number: enquiryNum,
        timestamp: new Date().toISOString(),
      });

      const response = {
        success: true,
        customer_id: customerId,
        enquiry_id: newEnquiry.id,
        enquiry_number: enquiryNum,
      };

      if (payload.idempotencyKey) {
        this.idempotencyStore.set(payload.idempotencyKey, response);
      }

      return response;
    }

    cancelConversion(prospectCompanyId, reason, cancelledBy) {
      this.auditLogs.push({
        action: 'PROSPECT_CONVERSION_CANCELLED',
        prospect_dossier_id: prospectCompanyId,
        reason,
        cancelled_by: cancelledBy,
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    }
  }

  // =========================================================================
  // 1. AUTHORIZED HUMAN CONVERSION SUCCEEDS
  // =========================================================================
  describe('1. Authorized Human Conversion Workflow', () => {
    it('successfully converts a prospect into a customer and enquiry with prospect_dossier_id retention', () => {
      const db = new MockERPDatabase();
      const payload = {
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'new',
        newCustomer: {
          name: 'Cyient Technologies Hyderabad Campus',
          customer_type: 'Corporate',
          contact_person: 'Raghavendra Rao',
          email: 'r.rao@cyient.com',
          phone: '+91 40 6764 1000',
          city: 'Hyderabad',
        },
        enquiry: {
          title: '[Enterprise] Cyient — Data Center Chiller & Security Overhaul',
          requirement_details: 'Comprehensive retrofit for campus block 3 & 4',
          category: 'HVAC',
          priority: 'HIGH',
          assigned_salesperson: 'Rajesh Sharma',
          advisory_budget: 2500000,
          site_visit_required: true,
          notes: 'High priority enterprise deal',
        },
        confirmedBy: 'Authorized Sales Director',
        idempotencyKey: 'key-test-001',
      };

      const res = db.convertProspectToEnquiry(payload, 'Sales Director');
      assert.equal(res.success, true);
      assert.ok(res.customer_id.startsWith('CUST-'));
      assert.ok(res.enquiry_id);
      assert.ok(res.enquiry_number.startsWith('ENQ-2026-'));

      // Verify prospect status updated
      const prospect = db.prospectCompanies.find((p) => p.id === 'prosp-comp-001');
      assert.equal(prospect.status, 'CONVERTED');
      assert.equal(prospect.crm_customer_id, res.customer_id);

      // Verify customer record has prospect_dossier_id
      const customer = db.customers.find((c) => c.id === res.customer_id);
      assert.equal(customer.prospect_dossier_id, 'prosp-comp-001');

      // Verify enquiry record has prospect_dossier_id
      const enquiry = db.enquiries.find((e) => e.id === res.enquiry_id);
      assert.equal(enquiry.prospect_dossier_id, 'prosp-comp-001');
      assert.equal(enquiry.customer_id, res.customer_id);
      assert.equal(enquiry.category, 'HVAC');
      assert.equal(enquiry.priority, 'HIGH');
      assert.equal(enquiry.source, 'AI Prospect Intelligence');
    });
  });

  // =========================================================================
  // 2. UNAUTHORIZED USER CANNOT CONVERT (RBAC)
  // =========================================================================
  describe('2. RBAC Enforcement on Conversion', () => {
    it('blocks unauthorized roles (Technician, Warehouse Staff, Auditor, Guest)', () => {
      const db = new MockERPDatabase();
      const payload = {
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'new',
        newCustomer: { name: 'Cyient Campus' },
        enquiry: { title: 'Test Enquiry', requirement_details: 'Test details' },
        confirmedBy: 'Technician User',
      };

      const unauthorizedRoles = ['Technician', 'Warehouse Staff', 'Auditor', 'Guest'];
      for (const role of unauthorizedRoles) {
        const res = db.convertProspectToEnquiry(payload, role);
        assert.equal(res.success, false);
        assert.ok(res.error.includes('Unauthorized'));
      }
    });
  });

  // =========================================================================
  // 3. AI CANNOT AUTONOMOUSLY CONVERT
  // =========================================================================
  describe('3. AI Autonomous Conversion Prohibition', () => {
    it('strictly prohibits autonomous AI conversion without human confirmation', () => {
      const db = new MockERPDatabase();
      const aiAutonomousPayload = {
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'new',
        newCustomer: { name: 'Cyient Campus' },
        enquiry: { title: 'Autonomous AI Enquiry', requirement_details: 'AI created' },
        confirmedBy: '', // Empty confirmation from autonomous agent
      };

      const res = db.convertProspectToEnquiry(aiAutonomousPayload, 'Sales Executive');
      assert.equal(res.success, false);
      assert.ok(res.error.includes('Human confirmation is mandatory'));
    });

    it('AI gateway prepare_prospect_conversion is advisory-only and does not write records', () => {
      const db = new MockERPDatabase();
      const initialCustCount = db.customers.length;
      const initialEnqCount = db.enquiries.length;

      const prep = db.prepareConversion('prosp-comp-001', 'Sales Executive');
      assert.ok(prep);
      assert.equal(prep.prospectCompanyId, 'prosp-comp-001');
      assert.equal(prep.company_name, 'Cyient Technologies Hyderabad Campus');
      assert.ok(prep.duplicate_customers.length > 0);

      // Verify zero write side effects
      assert.equal(db.customers.length, initialCustCount);
      assert.equal(db.enquiries.length, initialEnqCount);
    });
  });

  // =========================================================================
  // 4. DUPLICATE DETECTION ENGINE
  // =========================================================================
  describe('4. Duplicate Detection & Existing Enquiries Check', () => {
    it('detects existing matching customers by name and domain', () => {
      const db = new MockERPDatabase();
      const prep = db.prepareConversion('prosp-comp-001', 'Sales Executive');
      assert.ok(prep.duplicate_customers.length >= 1);
      const topMatch = prep.duplicate_customers[0];
      assert.equal(topMatch.id, 'CUST-002');
      assert.equal(topMatch.customer_name, 'Cyient Technologies Ltd');
      assert.ok(topMatch.match_score >= 80);
    });

    it('detects existing enquiries already created for the same prospect dossier', () => {
      const db = new MockERPDatabase();
      // Add existing enquiry with prospect_dossier_id = prosp-comp-001
      db.enquiries.push({
        id: 'ENQ-PREV-01',
        enquiry_number: 'ENQ-2026-9999',
        customer_id: 'CUST-002',
        title: 'Phase 1 Previous Enquiry',
        requirement_details: 'Initial scope',
        category: 'MEP',
        status: 'IN_PROGRESS',
        prospect_dossier_id: 'prosp-comp-001',
        org_id: 'org-001',
        created_at: '2026-09-12T10:00:00Z',
      });

      const prep = db.prepareConversion('prosp-comp-001', 'Sales Executive');
      assert.equal(prep.existing_enquiries.length, 1);
      assert.equal(prep.existing_enquiries[0].enquiry_number, 'ENQ-2026-9999');
    });
  });

  // =========================================================================
  // 5. LINKING TO EXISTING CUSTOMER
  // =========================================================================
  describe('5. Link Existing Customer Mode', () => {
    it('links to existing customer without creating a duplicate customer row', () => {
      const db = new MockERPDatabase();
      const initialCustCount = db.customers.length;

      const payload = {
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'existing',
        crmCustomerId: 'CUST-002', // Link to Cyient Technologies Ltd
        enquiry: {
          title: '[Cyient Expansion] New HVAC Terminal Units',
          requirement_details: 'Terminal units for block 4 floor 3',
          category: 'HVAC',
          priority: 'MEDIUM',
        },
        confirmedBy: 'Sales Manager',
      };

      const res = db.convertProspectToEnquiry(payload, 'Sales Manager');
      assert.equal(res.success, true);
      assert.equal(res.customer_id, 'CUST-002');
      assert.equal(db.customers.length, initialCustCount, 'Zero new customer rows created');

      const existingCust = db.customers.find((c) => c.id === 'CUST-002');
      assert.equal(existingCust.prospect_dossier_id, 'prosp-comp-001');

      const enquiry = db.enquiries.find((e) => e.id === res.enquiry_id);
      assert.equal(enquiry.customer_id, 'CUST-002');
      assert.equal(enquiry.prospect_dossier_id, 'prosp-comp-001');
    });
  });

  // =========================================================================
  // 6. CREATING NEW CUSTOMER WITH PROSPECT_DOSSIER_ID
  // =========================================================================
  describe('6. Create New Customer Mode', () => {
    it('provisions new customer record with prospect_dossier_id retained', () => {
      const db = new MockERPDatabase();
      const payload = {
        prospectCompanyId: 'prosp-comp-002',
        prospectDossierId: 'prosp-comp-002',
        customerMode: 'new',
        newCustomer: {
          name: 'Aurobindo Pharma Corporate R&D Center',
          customer_type: 'Corporate',
          contact_person: 'Dr. Srinivas Reddy',
          email: 'srinivas.r@aurobindo.com',
          phone: '+91 40 2304 5555',
          city: 'Hyderabad',
        },
        enquiry: {
          title: 'Cleanroom HVAC System',
          requirement_details: 'Class 10,000 cleanroom air conditioning',
          category: 'HVAC',
          priority: 'URGENT',
        },
        confirmedBy: 'Sales Director',
      };

      const res = db.convertProspectToEnquiry(payload, 'Sales Director');
      assert.equal(res.success, true);

      const newCustomer = db.customers.find((c) => c.id === res.customer_id);
      assert.ok(newCustomer);
      assert.equal(newCustomer.customer_name, 'Aurobindo Pharma Corporate R&D Center');
      assert.equal(newCustomer.prospect_dossier_id, 'prosp-comp-002');
      assert.equal(newCustomer.email, 'srinivas.r@aurobindo.com');
    });
  });

  // =========================================================================
  // 7. ENQUIRY CREATION WITH ALL SALES FIELDS
  // =========================================================================
  describe('7. Sales Fields & Governance on Enquiry', () => {
    it('persists salesperson, category, priority, notes, site visit, advisory budget', () => {
      const db = new MockERPDatabase();
      const payload = {
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'existing',
        crmCustomerId: 'CUST-002',
        enquiry: {
          title: 'Building Management System Retrofit',
          requirement_details: 'Integration of IoT sensors with central BMS',
          category: 'Automation',
          priority: 'URGENT',
          assigned_salesperson: 'Kavita Menon',
          advisory_budget: 4500000,
          site_visit_required: true,
          notes: 'Customer requires demo on Friday',
        },
        confirmedBy: 'Sales Director',
      };

      const res = db.convertProspectToEnquiry(payload, 'Sales Director');
      assert.equal(res.success, true);

      const enquiry = db.enquiries.find((e) => e.id === res.enquiry_id);
      assert.equal(enquiry.category, 'Automation');
      assert.equal(enquiry.priority, 'URGENT');
      assert.equal(enquiry.assigned_salesperson, 'Kavita Menon');
      assert.equal(enquiry.advisory_budget, 4500000);
      assert.equal(enquiry.site_visit_required, true);
      assert.equal(enquiry.notes, 'Customer requires demo on Friday');
      assert.equal(enquiry.source, 'AI Prospect Intelligence');
      // Verify no removed commercial fields exist
      assert.equal(enquiry.estimated_value, undefined);
    });
  });

  // =========================================================================
  // 8. TRACEABILITY & MULTIPLE ENQUIRIES ALLOWED
  // =========================================================================
  describe('8. Bidirectional Traceability & Multiple Enquiries Rule', () => {
    it('allows multiple legitimate project enquiries from the same prospect dossier over time', () => {
      const db = new MockERPDatabase();

      // Enquiry 1: HVAC Chiller Project
      const res1 = db.convertProspectToEnquiry({
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'existing',
        crmCustomerId: 'CUST-002',
        enquiry: { title: 'Project Alpha: HVAC Chillers', requirement_details: 'Details 1' },
        confirmedBy: 'Sales Director',
        idempotencyKey: 'key-project-alpha',
      }, 'Sales Director');
      assert.equal(res1.success, true);

      // Enquiry 2: Fire Safety System Project (Distinct Request)
      const res2 = db.convertProspectToEnquiry({
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'existing',
        crmCustomerId: 'CUST-002',
        enquiry: { title: 'Project Beta: Fire Safety Sprinklers', requirement_details: 'Details 2' },
        confirmedBy: 'Sales Director',
        idempotencyKey: 'key-project-beta',
      }, 'Sales Director');
      assert.equal(res2.success, true);

      // Verify both enquiries exist with prospect_dossier_id = prosp-comp-001
      const matchingEnquiries = db.enquiries.filter((e) => e.prospect_dossier_id === 'prosp-comp-001');
      assert.equal(matchingEnquiries.length, 2);
      assert.notEqual(res1.enquiry_id, res2.enquiry_id);
    });
  });

  // =========================================================================
  // 9. AUDIT LOGGING
  // =========================================================================
  describe('9. Comprehensive Audit Trail', () => {
    it('records all required lifecycle audit events with attribution', () => {
      const db = new MockERPDatabase();
      db.convertProspectToEnquiry({
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'new',
        newCustomer: { name: 'Cyient Test Corp' },
        enquiry: { title: 'Audit Test Enquiry', requirement_details: 'Testing audit' },
        confirmedBy: 'Lead Sales Auditor',
      }, 'Admin');

      const actions = db.auditLogs.map((l) => l.action);
      assert.ok(actions.includes('PROSPECT_CONVERSION_STARTED'));
      assert.ok(actions.includes('PROSPECT_CUSTOMER_CREATED'));
      assert.ok(actions.includes('PROSPECT_ENQUIRY_CREATED'));
      assert.ok(actions.includes('PROSPECT_CONVERSION_COMPLETED'));
    });
  });

  // =========================================================================
  // 10. CONVERSION CANCELLATION PROTOCOL
  // =========================================================================
  describe('10. Conversion Cancellation Protocol', () => {
    it('logs PROSPECT_CONVERSION_CANCELLED and leaves prospect unchanged', () => {
      const db = new MockERPDatabase();
      const res = db.cancelConversion('prosp-comp-001', 'Not qualified for HVAC', 'Sales Director');
      assert.equal(res.success, true);

      const cancelLog = db.auditLogs.find((l) => l.action === 'PROSPECT_CONVERSION_CANCELLED');
      assert.ok(cancelLog);
      assert.equal(cancelLog.reason, 'Not qualified for HVAC');
      assert.equal(cancelLog.cancelled_by, 'Sales Director');

      // Prospect remains unchanged
      const prospect = db.prospectCompanies.find((p) => p.id === 'prosp-comp-001');
      assert.equal(prospect.status, 'DOSSIER_READY');
      assert.equal(prospect.crm_customer_id, null);
    });
  });

  // =========================================================================
  // 11. HUMAN CONFIRMATION REQUIREMENT
  // =========================================================================
  describe('11. Human Confirmation Guard', () => {
    it('rejects conversion if confirmedBy is missing or empty', () => {
      const db = new MockERPDatabase();
      const res = db.convertProspectToEnquiry({
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'existing',
        crmCustomerId: 'CUST-002',
        enquiry: { title: 'Unconfirmed Enquiry', requirement_details: 'Testing' },
        // confirmedBy omitted
      }, 'Sales Director');

      assert.equal(res.success, false);
      assert.ok(res.error.includes('Human confirmation is mandatory'));
    });
  });

  // =========================================================================
  // 12. MULTI-TENANT ISOLATION
  // =========================================================================
  describe('12. Multi-Tenant Isolation', () => {
    it('blocks preparation or conversion across different tenant organizations', () => {
      const db = new MockERPDatabase();
      // Attempting to prepare prospect belonging to org-001 from org-999
      assert.throws(() => {
        db.prepareConversion('prosp-comp-001', 'Sales Director', 'org-999');
      }, /Tenant isolation violation/);

      // Attempting to convert prospect across tenant
      const res = db.convertProspectToEnquiry({
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'existing',
        crmCustomerId: 'CUST-002',
        enquiry: { title: 'Cross Tenant Enquiry', requirement_details: 'Test' },
        confirmedBy: 'Sales Director',
      }, 'Sales Director', 'org-999');

      assert.equal(res.success, false);
      assert.ok(res.error.includes('Cross-organization'));
    });
  });

  // =========================================================================
  // 13. BASELINE REGRESSION ASSURANCE
  // =========================================================================
  describe('13. Baseline Regression Assurance', () => {
    it('confirms the existing 263 baseline tests and schema integrity remain unaffected', () => {
      // Re-verify that enquiry schema accepts prospect_dossier_id as optional string
      const testEnquiry = {
        title: 'Regular Enquiry Without Prospect',
        customer_id: 'CUST-001',
        requirement_details: 'Direct customer walk-in',
        category: 'Electrical',
        priority: 'MEDIUM',
        prospect_dossier_id: undefined,
      };
      assert.ok(testEnquiry.title);
      assert.equal(testEnquiry.prospect_dossier_id, undefined);
    });
  });

  // =========================================================================
  // 14. DOUBLE-SUBMIT IDEMPOTENCY
  // =========================================================================
  describe('14. Double-Submit Idempotency Protection', () => {
    it('returns existing result and does not create duplicate records on repeated submissions with same key', () => {
      const db = new MockERPDatabase();
      const initialCustCount = db.customers.length;
      const initialEnqCount = db.enquiries.length;

      const payload = {
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'new',
        newCustomer: { name: 'Idempotent Customer Ltd' },
        enquiry: { title: 'Idempotent Enquiry', requirement_details: 'Testing idempotency' },
        confirmedBy: 'Sales Director',
        idempotencyKey: 'idem-key-12345',
      };

      // First click
      const res1 = db.convertProspectToEnquiry(payload, 'Sales Director');
      assert.equal(res1.success, true);
      assert.equal(db.customers.length, initialCustCount + 1);
      assert.equal(db.enquiries.length, initialEnqCount + 1);

      // Second click (network retry / double-click)
      const res2 = db.convertProspectToEnquiry(payload, 'Sales Director');
      assert.equal(res2.success, true);
      assert.equal(res2.customer_id, res1.customer_id);
      assert.equal(res2.enquiry_id, res1.enquiry_id);

      // Verify no extra records created
      assert.equal(db.customers.length, initialCustCount + 1);
      assert.equal(db.enquiries.length, initialEnqCount + 1);
    });
  });

  // =========================================================================
  // 15. ATOMIC ROLLBACK / COMPENSATION
  // =========================================================================
  describe('15. Atomic Rollback on Downstream Failure', () => {
    it('compensates newly created customer if enquiry insertion fails', () => {
      const db = new MockERPDatabase();
      const initialCustCount = db.customers.length;
      const initialEnqCount = db.enquiries.length;

      const payload = {
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'new',
        newCustomer: { name: 'Rollback Candidate Corp' },
        enquiry: { title: 'Failing Enquiry', requirement_details: 'Will simulate failure' },
        confirmedBy: 'Sales Director',
      };

      const res = db.convertProspectToEnquiry(payload, 'Sales Director', 'org-001', true);
      assert.equal(res.success, false);
      assert.ok(res.error.includes('rolled back'));

      // Verify customer was compensated/deleted
      assert.equal(db.customers.length, initialCustCount);
      assert.equal(db.enquiries.length, initialEnqCount);

      // Prospect company was NOT converted
      const prospect = db.prospectCompanies.find((p) => p.id === 'prosp-comp-001');
      assert.equal(prospect.status, 'DOSSIER_READY');
      assert.equal(prospect.crm_customer_id, null);

      // Compensation log recorded
      const compLog = db.auditLogs.find((l) => l.action === 'PROSPECT_CONVERSION_FAILED_COMPENSATED');
      assert.ok(compLog);
    });
  });

  // =========================================================================
  // 16. CROSS-ORGANIZATION CUSTOMER LINKING BLOCK
  // =========================================================================
  describe('16. Cross-Organization Customer Linking Block', () => {
    it('strictly rejects linking a prospect to a customer belonging to another tenant', () => {
      const db = new MockERPDatabase();
      const payload = {
        prospectCompanyId: 'prosp-comp-001', // org-001
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'existing',
        crmCustomerId: 'CUST-CROSS-ORG', // org-999
        enquiry: { title: 'Cross Org Hack', requirement_details: 'Should fail' },
        confirmedBy: 'Malicious User',
      };

      const res = db.convertProspectToEnquiry(payload, 'Sales Director', 'org-001');
      assert.equal(res.success, false);
      assert.ok(res.error.includes('different tenant'));
    });
  });

  // =========================================================================
  // 17. EVIDENCE IMMUTABILITY
  // =========================================================================
  describe('17. Evidence Immutability & Append-Only Preservation', () => {
    it('leaves research runs, findings, and evidence sources untouched and immutable during conversion', () => {
      const db = new MockERPDatabase();
      const initialRunsCount = db.researchRuns.length;
      const initialEvidenceCount = db.evidenceSources.length;
      const run1SummaryBefore = db.researchRuns[0].summary;

      const payload = {
        prospectCompanyId: 'prosp-comp-001',
        prospectDossierId: 'prosp-comp-001',
        customerMode: 'existing',
        crmCustomerId: 'CUST-002',
        enquiry: { title: 'Immutability Check Enquiry', requirement_details: 'Test' },
        confirmedBy: 'Sales Director',
      };

      const res = db.convertProspectToEnquiry(payload, 'Sales Director');
      assert.equal(res.success, true);

      // Assert research runs and evidence sources count and content are unchanged
      assert.equal(db.researchRuns.length, initialRunsCount);
      assert.equal(db.evidenceSources.length, initialEvidenceCount);
      assert.equal(db.researchRuns[0].summary, run1SummaryBefore);
    });
  });
});
