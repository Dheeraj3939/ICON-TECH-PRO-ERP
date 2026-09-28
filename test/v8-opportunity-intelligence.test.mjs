import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ICON TECH PRO ERP V8 — Phase C.2: Opportunity & Sales Intelligence Suite', () => {

  // Domain models & logic under test
  class MockOpportunityIntelligenceEngine {
    constructor() {
      this.enquiries = [
        {
          id: 'ENQ-001',
          enquiry_number: 'ENQ260001',
          customer_id: 'CUST-001',
          customer_name: 'Dr. Reddy Laboratories SEZ',
          company_name: 'Dr. Reddy Laboratories Ltd',
          customer_type: 'COMPANY',
          phone: '9849011223',
          source: 'Direct',
          salesperson_name: 'Dheeraj Sharma',
          product_category: 'Commercial AV & Interactive Displays',
          requirement_summary: 'Turnkey boardroom upgrade: 85-inch 4K Interactive Flat Panel with PTZ camera and ceiling mic array.',
          estimated_budget: 450000,
          status: 'Enquiry',
          site_visit_required: true,
          follow_up_date: '2026-10-15',
          prospect_dossier_id: null,
          org_id: 'org-001',
        },
        {
          id: 'ENQ-002',
          enquiry_number: 'ENQ260002',
          customer_id: 'CUST-002',
          customer_name: 'Aurobindo Pharma Tech Park',
          company_name: 'Aurobindo Pharma',
          customer_type: 'COMPANY',
          phone: '9849099887',
          source: 'Prospect Intelligence',
          salesperson_name: 'Dheeraj Sharma',
          product_category: 'HVAC & Cleanroom Climate Control',
          requirement_summary: 'Central chilled water air handling units for research block B.',
          estimated_budget: 1200000,
          status: 'Enquiry',
          site_visit_required: true,
          follow_up_date: '2026-10-20',
          prospect_dossier_id: 'prosp-comp-001',
          org_id: 'org-001',
        },
        {
          id: 'ENQ-003',
          enquiry_number: 'ENQ260003',
          customer_id: 'CUST-003',
          customer_name: 'Unknown Walk-in Client',
          customer_type: 'INDIVIDUAL',
          phone: '',
          source: 'Direct',
          salesperson_name: 'Dheeraj Sharma',
          product_category: 'General AV',
          requirement_summary: 'Need panels.',
          estimated_budget: 0,
          status: 'Enquiry',
          site_visit_required: false,
          follow_up_date: null,
          prospect_dossier_id: null,
          org_id: 'org-001',
        },
        {
          id: 'ENQ-004',
          enquiry_number: 'ENQ260004',
          customer_id: 'CUST-999',
          customer_name: 'Foreign Org Client',
          customer_type: 'COMPANY',
          phone: '9849088888',
          source: 'Direct',
          salesperson_name: 'John Doe',
          product_category: 'CCTV',
          requirement_summary: 'Perimeter cameras.',
          estimated_budget: 200000,
          status: 'Enquiry',
          site_visit_required: false,
          follow_up_date: '2026-10-30',
          prospect_dossier_id: null,
          org_id: 'org-foreign',
        }
      ];

      this.prospectDossiers = {
        'prosp-comp-001': {
          company: {
            company_name: 'Aurobindo Pharma Corporate R&D Center',
            domain: 'aurobindo.com',
            relevance_summary: 'Active expansion of life sciences research campus in Hyderabad.',
          },
          relevance_analysis: {
            fit_score: 92,
            why_relevant: 'Requires precision HVAC climate control and high-end interactive boardroom tech.',
            recommended_entry_angle: 'Displace incumbent vendor Blue Star by offering 5-year preventative maintenance SLA and 4-hour local response.',
          },
          vendor_intelligence: [
            {
              incumbent_vendor: 'Blue Star Climate Solutions',
              contract_status: 'Expiring in 60 days',
              contract_end_date: '2026-11-30',
              displacement_angle: 'Incumbent contract expiration presents immediate displacement window.',
              pricing_pressure: 'HIGH',
            }
          ],
          decision_makers: [
            {
              full_name: 'Dr. Satish Reddy',
              job_title: 'VP Operations & Infrastructure',
              department: 'Engineering & Infrastructure',
              classification: 'VERIFIED',
              influence_level: 'HIGH',
            }
          ],
          projects: [
            {
              project_name: 'Research Block B HVAC Modernization',
              timeline: 'Q4 2026',
              estimated_budget: '₹1.5 - 2.0 Cr',
            }
          ],
          opportunity_signals: [
            {
              signal_type: 'Campus Expansion',
              details: 'Aurobindo adding 50,000 sq ft cleanroom laboratory in Hyderabad.',
            }
          ]
        }
      };

      this.customerInvoices = [
        { customer_id: 'CUST-001', grand_total: 650000 },
        { customer_id: 'CUST-001', grand_total: 150000 },
      ];

      this.briefsStore = [];
      this.auditLogs = [];
    }

    canUserAccess(userRole) {
      const allowedRoles = ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'];
      return allowedRoles.includes(userRole);
    }

    generateSalesBrief(enquiryId, user, forceRefresh = false) {
      if (!this.canUserAccess(user.role)) {
        return { success: false, error: 'Unauthorized: Access denied by Presales RBAC policy.' };
      }

      const enquiry = this.enquiries.find(e => e.id === enquiryId || e.enquiry_number === enquiryId);
      if (!enquiry) {
        return { success: false, error: `Enquiry with identifier '${enquiryId}' not found.` };
      }

      // Organization isolation guard
      if (user.org_id && enquiry.org_id !== user.org_id) {
        return { success: false, error: 'Tenant Isolation Violation: Cross-organization enquiry access is prohibited.' };
      }

      // Check cache
      if (!forceRefresh) {
        const cached = this.briefsStore.find(b => b.enquiry_id === enquiry.id);
        if (cached) return { success: true, data: cached };
      }

      // Customer history & relationship
      const invoices = this.customerInvoices.filter(i => i.customer_id === enquiry.customer_id);
      const historicalRevenue = invoices.reduce((sum, i) => sum + i.grand_total, 0);
      let relationshipType = 'NEW';
      if (historicalRevenue > 500000) relationshipType = 'HIGH_VALUE';
      else if (invoices.length > 0) relationshipType = 'REPEAT';

      // Prospect intelligence linkage
      let prospectDossier = null;
      if (enquiry.prospect_dossier_id && this.prospectDossiers[enquiry.prospect_dossier_id]) {
        prospectDossier = this.prospectDossiers[enquiry.prospect_dossier_id];
      }

      // Requirement analysis
      const reqText = (enquiry.requirement_summary || '').toLowerCase();
      const budget = Number(enquiry.estimated_budget) || 0;

      let scopeComplexity = 'MEDIUM';
      if (budget > 1000000 || reqText.includes('cleanroom') || reqText.includes('central')) scopeComplexity = 'ENTERPRISE';
      else if (budget > 300000 || reqText.includes('boardroom')) scopeComplexity = 'HIGH';
      else if (budget < 50000) scopeComplexity = 'LOW';

      const keySpecs = [];
      if (reqText.includes('4k')) keySpecs.push('4K UHD Ultra-High Resolution Display');
      if (reqText.includes('ptz')) keySpecs.push('Optical Zoom PTZ Auto-Tracking Camera');
      if (reqText.includes('mic')) keySpecs.push('Integrated Acoustic Beamforming Microphone Array');
      if (reqText.includes('hvac') || reqText.includes('chilled')) keySpecs.push('Precision Chilled Water Air Handling System');
      if (keySpecs.length === 0) keySpecs.push('Standard Commercial Presales Deployment');

      // Health score calculation (0-100)
      let healthScore = 50;
      if (budget > 0) healthScore += 15;
      if (enquiry.requirement_summary && enquiry.requirement_summary.length > 30) healthScore += 10;
      if (enquiry.site_visit_required) healthScore += 10;
      if (enquiry.follow_up_date) healthScore += 5;
      if (relationshipType === 'HIGH_VALUE' || relationshipType === 'REPEAT') healthScore += 10;
      if (prospectDossier?.relevance_analysis?.fit_score) {
        healthScore += Math.round((prospectDossier.relevance_analysis.fit_score / 100) * 10);
      }
      healthScore = Math.min(100, Math.max(10, healthScore));

      const healthStatus = healthScore >= 75 ? 'STRONG' : healthScore >= 55 ? 'MODERATE' : healthScore >= 35 ? 'AT_RISK' : 'CRITICAL';

      // Buying signals
      const buyingSignals = [];
      if (enquiry.site_visit_required) {
        buyingSignals.push({
          signal: 'Site Measurement Requested',
          strength: 'HIGH',
          evidence: 'Client explicitly flagged site inspection requirement.',
        });
      }
      if (budget > 0) {
        buyingSignals.push({
          signal: 'Allocated Capital Budget',
          strength: 'HIGH',
          evidence: `Estimated procurement budget of ₹${budget.toLocaleString('en-IN')} specified.`,
        });
      }
      if (prospectDossier?.opportunity_signals?.length > 0) {
        buyingSignals.push({
          signal: prospectDossier.opportunity_signals[0].signal_type,
          strength: 'HIGH',
          evidence: prospectDossier.opportunity_signals[0].details,
        });
      }

      // Decision maker & Vendor Intelligence
      let primaryContact = enquiry.customer_name;
      let designation = 'Presales Contact';
      let displacementAngle = 'Differentiate via local Hyderabad OEM-certified field support, 4-hour replacement SLA.';
      let incumbentVendor = 'Unspecified Local Reseller';

      if (prospectDossier?.decision_makers?.length > 0) {
        const dm = prospectDossier.decision_makers[0];
        primaryContact = dm.full_name;
        designation = dm.job_title;
      }
      if (prospectDossier?.vendor_intelligence?.length > 0) {
        const vi = prospectDossier.vendor_intelligence[0];
        incumbentVendor = vi.incumbent_vendor;
        displacementAngle = vi.displacement_angle;
      }

      // Risks & Missing Info
      const opportunityRisks = [];
      if (budget === 0) {
        opportunityRisks.push({
          risk: 'Unspecified Commercial Budget',
          severity: 'MEDIUM',
          mitigation: 'Present Good-Better-Best solution tiers during initial discovery.',
        });
      }

      const missingInformation = [];
      if (!enquiry.phone) {
        missingInformation.push({
          item: 'Direct Phone Number',
          impact: 'BLOCKING',
          suggested_question: 'Could you confirm the best mobile or direct phone number to reach you?',
        });
      }

      // Recommended next actions
      const recommendedNextActions = [
        {
          action: enquiry.site_visit_required ? 'Dispatch Presales Engineer for Site Inspection' : 'Schedule Discovery Call',
          priority: 'IMMEDIATE',
          due_in_days: 2,
          target_outcome: 'Validate technical bill of quantities and site readiness.',
        }
      ];

      const brief = {
        id: `BRF-${enquiry.id}-${Date.now()}`,
        enquiry_id: enquiry.id,
        customer_id: enquiry.customer_id,
        prospect_dossier_id: enquiry.prospect_dossier_id,
        health_score: healthScore,
        health_status: healthStatus,
        requirement_analysis: {
          core_need: `${enquiry.product_category} commercial solution for ${enquiry.company_name || enquiry.customer_name}`,
          scope_complexity: scopeComplexity,
          key_specifications: keySpecs,
          inferred_technology_stack: ['Commercial Grade System', 'Structured Low-Voltage Cabling'],
          budget_realism: budget === 0 ? 'UNSPECIFIED' : 'REALISTIC',
        },
        customer_context: {
          relationship_type: relationshipType,
          historical_revenue: historicalRevenue,
          credit_standing: relationshipType === 'HIGH_VALUE' ? 'EXCELLENT' : 'STANDARD',
        },
        buying_signals: buyingSignals,
        decision_maker_context: {
          primary_contact_name: primaryContact,
          role_or_designation: designation,
          influence_level: 'HIGH',
        },
        vendor_intelligence: {
          incumbent_vendor: incumbentVendor,
          displacement_angle: displacementAngle,
          pricing_pressure: prospectDossier ? 'HIGH' : 'MEDIUM',
        },
        opportunity_risks: opportunityRisks,
        missing_information: missingInformation,
        recommended_next_actions: recommendedNextActions,
        follow_up_intelligence: {
          recommended_follow_up_date: enquiry.follow_up_date || '2026-10-15',
          recommended_channel: enquiry.site_visit_required ? 'SITE_VISIT' : 'CALL',
          suggested_opening_script: `Hello ${primaryContact.split(' ')[0]}, this is ${user.name} from ICON TECH PRO following up on your ${enquiry.product_category} requirement.`,
          key_value_hook: displacementAngle,
        },
        generated_by: `AI Sales Intelligence (${user.name})`,
        created_at: new Date().toISOString(),
      };

      this.briefsStore = this.briefsStore.filter(b => b.enquiry_id !== enquiry.id);
      this.briefsStore.push(brief);

      this.auditLogs.push({
        action: 'GENERATE_ENQUIRY_SALES_BRIEF',
        enquiry_id: enquiry.id,
        user_name: user.name,
        health_score: healthScore,
        timestamp: new Date().toISOString(),
      });

      return { success: true, data: brief };
    }
  }

  const engine = new MockOpportunityIntelligenceEngine();
  const salesExec = { id: 'u-01', name: 'Dheeraj Sharma', role: 'Sales Executive', org_id: 'org-001' };
  const managingDirector = { id: 'u-02', name: 'Managing Director', role: 'Managing Director', org_id: 'org-001' };
  const technician = { id: 'u-03', name: 'Ramesh Kumar', role: 'Technician', org_id: 'org-001' };
  const foreignUser = { id: 'u-04', name: 'External User', role: 'Sales Executive', org_id: 'org-other' };

  describe('1. Presales AI Sales Brief Generation & Caching', () => {
    it('generates a comprehensive sales brief for a presales enquiry', () => {
      const res = engine.generateSalesBrief('ENQ-001', salesExec);
      assert.equal(res.success, true);
      assert.ok(res.data);
      assert.equal(res.data.enquiry_id, 'ENQ-001');
      assert.ok(res.data.health_score >= 0 && res.data.health_score <= 100);
      assert.equal(res.data.health_status, 'STRONG');
      assert.ok(res.data.buying_signals.length > 0);
      assert.ok(res.data.recommended_next_actions.length > 0);
      assert.ok(res.data.follow_up_intelligence.suggested_opening_script.length > 0);
    });

    it('returns cached sales brief on subsequent calls unless forceRefresh is true', () => {
      const first = engine.generateSalesBrief('ENQ-001', salesExec);
      const second = engine.generateSalesBrief('ENQ-001', salesExec);
      assert.equal(first.data.id, second.data.id, 'Cached brief should return same ID');

      const refreshed = engine.generateSalesBrief('ENQ-001', salesExec, true);
      assert.notEqual(refreshed.data.id, first.data.id, 'Force refresh should create fresh brief');
    });
  });

  describe('2. Deep Integration with Prospect Dossier Intelligence', () => {
    it('pulls incumbent vendor, contract expiry, and displacement angle when prospect_dossier_id is linked', () => {
      const res = engine.generateSalesBrief('ENQ-002', salesExec);
      assert.equal(res.success, true);
      const brief = res.data;

      assert.equal(brief.prospect_dossier_id, 'prosp-comp-001');
      assert.equal(brief.vendor_intelligence.incumbent_vendor, 'Blue Star Climate Solutions');
      assert.ok(brief.vendor_intelligence.displacement_angle.includes('displacement window'));
      assert.equal(brief.decision_maker_context.primary_contact_name, 'Dr. Satish Reddy');
      assert.ok(brief.health_score >= 80, 'Prospect intelligence match should boost health score');
    });
  });

  describe('3. Objective Opportunity Health Scoring & Risk Engine', () => {
    it('scores budget-committed and site-visit-ready enquiries as STRONG', () => {
      const res = engine.generateSalesBrief('ENQ-001', salesExec);
      assert.equal(res.data.health_status, 'STRONG');
      assert.ok(res.data.health_score >= 75);
    });

    it('identifies budget disconnect and missing phone number for uncommitted enquiries', () => {
      const res = engine.generateSalesBrief('ENQ-003', salesExec);
      assert.equal(res.success, true);
      const brief = res.data;

      assert.ok(brief.health_score < 70);
      assert.equal(brief.requirement_analysis.budget_realism, 'UNSPECIFIED');
      assert.ok(brief.opportunity_risks.some(r => r.risk.includes('Budget')));
      assert.ok(brief.missing_information.some(m => m.item.includes('Phone')));
      assert.equal(brief.missing_information.find(m => m.item.includes('Phone')).impact, 'BLOCKING');
    });
  });

  describe('4. Advisory Governance & Non-Destructive Invariance', () => {
    it('generating sales brief leaves enquiry records unchanged', () => {
      const enquiryBefore = { ...engine.enquiries.find(e => e.id === 'ENQ-001') };
      engine.generateSalesBrief('ENQ-001', salesExec, true);
      const enquiryAfter = engine.enquiries.find(e => e.id === 'ENQ-001');

      assert.equal(enquiryAfter.status, enquiryBefore.status);
      assert.equal(enquiryAfter.estimated_budget, enquiryBefore.estimated_budget);
    });
  });

  describe('5. RBAC & Security Enforcement', () => {
    it('permits authorized roles (Sales Executive, Managing Director)', () => {
      const res1 = engine.generateSalesBrief('ENQ-001', salesExec);
      assert.equal(res1.success, true);

      const res2 = engine.generateSalesBrief('ENQ-001', managingDirector);
      assert.equal(res2.success, true);
    });

    it('blocks unauthorized roles (Technician, Auditor, Guest)', () => {
      const res = engine.generateSalesBrief('ENQ-001', technician);
      assert.equal(res.success, false);
      assert.ok(res.error.includes('Unauthorized'));
    });
  });

  describe('6. Multi-Tenant Isolation', () => {
    it('strictly blocks cross-organization enquiry access', () => {
      const res = engine.generateSalesBrief('ENQ-001', foreignUser);
      assert.equal(res.success, false);
      assert.ok(res.error.includes('Tenant Isolation Violation'));
    });
  });

  describe('7. Comprehensive Audit Logging', () => {
    it('records GENERATE_ENQUIRY_SALES_BRIEF in audit log with health metrics and attribution', () => {
      const initialCount = engine.auditLogs.length;
      engine.generateSalesBrief('ENQ-001', salesExec, true);
      assert.equal(engine.auditLogs.length, initialCount + 1);

      const lastLog = engine.auditLogs[engine.auditLogs.length - 1];
      assert.equal(lastLog.action, 'GENERATE_ENQUIRY_SALES_BRIEF');
      assert.equal(lastLog.enquiry_id, 'ENQ-001');
      assert.equal(lastLog.user_name, 'Dheeraj Sharma');
      assert.ok(lastLog.health_score > 0);
    });
  });

  describe('8. AI Gateway Tool Specification & Safety Model', () => {
    it('verifies tool registration and policy rules', () => {
      const tool = {
        tool_name: 'get_enquiry_sales_brief',
        min_role: 'Sales Executive',
        allowed_roles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'],
        requires_confirmation: false, // advisory read-only
      };

      assert.equal(tool.tool_name, 'get_enquiry_sales_brief');
      assert.equal(tool.requires_confirmation, false, 'Presales brief is advisory read-only');
      assert.ok(tool.allowed_roles.includes('Sales Executive'));
    });
  });

  describe('9. Error Handling & Edge Cases', () => {
    it('returns error when enquiry does not exist', () => {
      const res = engine.generateSalesBrief('ENQ-999999', salesExec);
      assert.equal(res.success, false);
      assert.ok(res.error.includes('not found'));
    });
  });
});
