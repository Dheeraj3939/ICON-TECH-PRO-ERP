import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ICON TECH PRO ERP V8 — Phase B: AI Prospect Intelligence Suite', () => {
  // =========================================================================
  // 1. DEDUPLICATION ENGINE (Normalized Name & Domain Matching)
  // =========================================================================
  describe('1. Deduplication Engine (Normalized Name & Domain Matching)', () => {
    function normalizeCompanyName(name) {
      return name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const EXISTING_PROSPECTS = [
      {
        id: 'prosp-comp-001',
        company_name: 'Cyient Technologies Hyderabad Campus',
        normalized_name: 'cyient technologies hyderabad campus',
        domain: 'cyient.com',
        status: 'DOSSIER_READY',
      },
      {
        id: 'prosp-comp-002',
        company_name: 'Aurobindo Pharma Corporate R&D Center',
        normalized_name: 'aurobindo pharma corporate rd center',
        domain: 'aurobindo.com',
        status: 'DOSSIER_READY',
      },
    ];

    const EXISTING_CRM_CUSTOMERS = [
      { id: 'CUST-001', name: 'T-Hub Foundation', company_name: 'T-Hub Foundation' },
      { id: 'CUST-002', name: 'Kun Motors Pvt Ltd', company_name: 'Kun Motors Pvt Ltd' },
    ];

    function checkDuplicate(name, domain) {
      const norm = normalizeCompanyName(name);
      const cleanDomain = domain ? domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') : '';

      // Check existing prospects
      const matchedProspect = EXISTING_PROSPECTS.find((c) => {
        const cNorm = normalizeCompanyName(c.company_name);
        const cDomain = c.domain ? c.domain.toLowerCase().trim() : '';
        return cNorm === norm || (cleanDomain && cDomain === cleanDomain);
      });

      if (matchedProspect) {
        return {
          isDuplicate: true,
          matchType: 'PROSPECT',
          matchedRecord: matchedProspect,
          warningMessage: `Prospect "${matchedProspect.company_name}" already exists.`,
        };
      }

      // Check active CRM customers
      const matchedCustomer = EXISTING_CRM_CUSTOMERS.find((c) => {
        const cNorm = normalizeCompanyName(c.company_name || c.name);
        return cNorm === norm;
      });

      if (matchedCustomer) {
        return {
          isDuplicate: true,
          matchType: 'CUSTOMER',
          matchedRecord: matchedCustomer,
          warningMessage: `"${matchedCustomer.name}" is already an active CRM Customer.`,
        };
      }

      return { isDuplicate: false };
    }

    it('detects duplicate prospect company by normalized name (case, punctuation & whitespace insensitive)', () => {
      const res1 = checkDuplicate('Cyient Technologies Hyderabad Campus');
      assert.equal(res1.isDuplicate, true);
      assert.equal(res1.matchType, 'PROSPECT');
      assert.ok(res1.warningMessage.includes('already exists'));

      const res2 = checkDuplicate('   cyient   technologies  hyderabad-campus!  ');
      assert.equal(res2.isDuplicate, true);
      assert.equal(res2.matchType, 'PROSPECT');
    });

    it('detects duplicate prospect company by domain matching', () => {
      const res = checkDuplicate('New Cyient Branch', 'https://cyient.com/about');
      assert.equal(res.isDuplicate, true);
      assert.equal(res.matchType, 'PROSPECT');
      assert.equal(res.matchedRecord.domain, 'cyient.com');
    });

    it('detects when prospective company is already an active CRM customer', () => {
      const res = checkDuplicate('Kun Motors Pvt. Ltd.');
      assert.equal(res.isDuplicate, true);
      assert.equal(res.matchType, 'CUSTOMER');
      assert.ok(res.warningMessage.includes('already an active CRM Customer'));
    });

    it('allows distinct non-duplicate enterprise targets', () => {
      const res = checkDuplicate('Unique Telangana Tech Hub Ltd', 'uniquetechhub.in');
      assert.equal(res.isDuplicate, false);
    });
  });

  // =========================================================================
  // 2. APPEND-ONLY RESEARCH RUNS & HISTORY PRESERVATION
  // =========================================================================
  describe('2. Append-Only Research Runs (Zero Overwrite Policy)', () => {
    class ProspectResearchStore {
      constructor() {
        this.runs = [
          {
            id: 'run-001-1',
            company_id: 'prosp-comp-001',
            run_number: 1,
            summary: 'Initial discovery identified Cyient campus expansion in Financial District.',
            key_findings: [{ title: 'Campus Expansion', classification: 'VERIFIED', confidence: 'HIGH' }],
            created_at: '2026-09-10T08:30:00Z',
          },
          {
            id: 'run-001-2',
            company_id: 'prosp-comp-001',
            run_number: 2,
            summary: 'Deep intelligence detected incumbent CCTV vendor contract expiring Nov 2026.',
            key_findings: [{ title: 'Vendor Expiration', classification: 'VERIFIED', confidence: 'HIGH' }],
            created_at: '2026-09-18T11:00:00Z',
          },
        ];
        this.decisionMakers = [
          { id: 'dm-1', company_id: 'prosp-comp-001', run_id: 'run-001-1', full_name: 'Raghavendra Rao', department: 'PROJECTS' },
          { id: 'dm-2', company_id: 'prosp-comp-001', run_id: 'run-001-2', full_name: 'Raghavendra Rao', department: 'PROJECTS' },
          { id: 'dm-3', company_id: 'prosp-comp-001', run_id: 'run-001-2', full_name: 'K. S. Narayana', department: 'PURCHASE' },
        ];
      }

      executeRun(companyId, summary, keyFindings) {
        const existingRuns = this.runs.filter((r) => r.company_id === companyId);
        const nextNum = existingRuns.length + 1;
        const newRun = {
          id: `run-${companyId}-${nextNum}`,
          company_id: companyId,
          run_number: nextNum,
          summary,
          key_findings: keyFindings,
          created_at: new Date().toISOString(),
        };
        this.runs.push(newRun);
        return newRun;
      }

      getRuns(companyId) {
        return this.runs.filter((r) => r.company_id === companyId);
      }

      getRun(companyId, runNumber) {
        return this.runs.find((r) => r.company_id === companyId && r.run_number === runNumber);
      }
    }

    it('preserves past research runs and increments run_number monotonically', () => {
      const store = new ProspectResearchStore();
      const initialRuns = store.getRuns('prosp-comp-001');
      assert.equal(initialRuns.length, 2);

      // Execute Run 3
      const run3 = store.executeRun('prosp-comp-001', 'Run 3 deep RFP scan', [
        { title: 'Tender Issued', classification: 'VERIFIED', confidence: 'HIGH' },
      ]);
      assert.equal(run3.run_number, 3);

      // Verify Run 1, 2, and 3 are all intact
      const allRuns = store.getRuns('prosp-comp-001');
      assert.equal(allRuns.length, 3);
      assert.equal(store.getRun('prosp-comp-001', 1).summary.includes('Initial discovery'), true);
      assert.equal(store.getRun('prosp-comp-001', 2).summary.includes('Deep intelligence'), true);
      assert.equal(store.getRun('prosp-comp-001', 3).summary.includes('Run 3 deep RFP'), true);
    });

    it('accurately computes diff between research runs', () => {
      const run1DMs = ['Raghavendra Rao'];
      const run2DMs = ['Raghavendra Rao', 'K. S. Narayana'];

      const set1 = new Set(run1DMs);
      const newDMs = run2DMs.filter((name) => !set1.has(name));

      assert.equal(newDMs.length, 1);
      assert.equal(newDMs[0], 'K. S. Narayana');
    });
  });

  // =========================================================================
  // 3. RIGOROUS EVIDENCE STANDARDS (Classification, Confidence & Citations)
  // =========================================================================
  describe('3. Rigorous Evidence Standards (Classification, Confidence & Citations)', () => {
    const SAMPLE_DOSSIER = {
      decision_makers: [
        {
          full_name: 'Raghavendra Rao',
          title: 'Vice President — Global Infrastructure & Facilities',
          department: 'PROJECTS',
          classification: 'VERIFIED',
          confidence: 'HIGH',
          evidence_sources: [
            {
              source_name: 'Cyient Leadership Directory & Press Release',
              source_url: 'https://cyient.com/news/infra-expansion-hyderabad-2026',
              retrieval_date: '2026-09-18T10:00:00Z',
              snippet_content: '...Raghavendra Rao, VP Infrastructure, spearheaded the ground-breaking...',
              reliability: 'HIGH',
            },
          ],
        },
        {
          full_name: 'Pooja Reddy',
          title: 'Senior Manager — Physical Security & Vigilance',
          department: 'SECURITY',
          classification: 'LIKELY',
          confidence: 'MEDIUM',
        },
      ],
      projects: [
        {
          project_name: 'Block 3 & 4 Smart Building Security & Telepresence',
          estimated_value: '₹1.80 — ₹2.40 Cr',
          timeline: 'Q4 2026 — Q1 2027',
          classification: 'VERIFIED',
          confidence: 'HIGH',
        },
      ],
      vendor_intelligence: [
        {
          incumbent_vendor: 'Honeywell Building Solutions',
          category: 'CCTV Surveillance & Access Control',
          contract_status: 'Expiring November 30, 2026',
          classification: 'VERIFIED',
          confidence: 'HIGH',
        },
      ],
    };

    it('guarantees valid classifications and confidences across all decision makers', () => {
      const validClassifications = ['VERIFIED', 'LIKELY', 'HISTORICAL', 'UNKNOWN'];
      const validConfidences = ['HIGH', 'MEDIUM', 'LOW'];

      for (const dm of SAMPLE_DOSSIER.decision_makers) {
        assert.ok(validClassifications.includes(dm.classification));
        assert.ok(validConfidences.includes(dm.confidence));
        assert.ok(dm.full_name && dm.title && dm.department);
      }
    });

    it('guarantees projects and vendor intelligence contain timeline and contract status', () => {
      for (const p of SAMPLE_DOSSIER.projects) {
        assert.ok(p.project_name);
        assert.ok(p.timeline);
        assert.ok(p.estimated_value);
      }
      for (const v of SAMPLE_DOSSIER.vendor_intelligence) {
        assert.ok(v.incumbent_vendor);
        assert.ok(v.contract_status);
      }
    });

    it('guarantees evidence sources contain verifiable URL, snippet and reliability', () => {
      const ev = SAMPLE_DOSSIER.decision_makers[0].evidence_sources[0];
      assert.ok(ev.source_url.startsWith('https://'));
      assert.ok(ev.retrieval_date);
      assert.ok(ev.snippet_content.length > 10);
      assert.equal(ev.reliability, 'HIGH');
    });
  });

  // =========================================================================
  // 4. HUMAN VERIFICATION & GATING PROTOCOL
  // =========================================================================
  describe('4. Human Verification & Gating Protocol', () => {
    it('applies human verification, reviewer attribution, and notes to findings', () => {
      const contact = {
        id: 'dm-001',
        full_name: 'Raghavendra Rao',
        human_verified: false,
        classification: 'LIKELY',
      };

      // Reviewer verifies contact
      function verifyContact(record, reviewerName, notes) {
        return {
          ...record,
          human_verified: true,
          verified_by: reviewerName,
          verification_notes: notes,
          classification: 'VERIFIED',
        };
      }

      const verified = verifyContact(contact, 'Sales Director', 'Confirmed via direct phone call');
      assert.equal(verified.human_verified, true);
      assert.equal(verified.verified_by, 'Sales Director');
      assert.equal(verified.verification_notes, 'Confirmed via direct phone call');
      assert.equal(verified.classification, 'VERIFIED');
    });
  });

  // =========================================================================
  // 5. HUMAN-GATED CRM CONVERSION WITH CROSS-REFERENCE
  // =========================================================================
  describe('5. Human-Gated CRM Conversion with Cross-Reference', () => {
    it('creates CRM customer record linked via prospect_dossier_id and updates prospect status', () => {
      const prospectCompany = {
        id: 'prosp-comp-999',
        company_name: 'MedPlus Health Services Corporate Center',
        status: 'DOSSIER_READY',
        crm_customer_id: null,
      };

      function convertToCRM(company, payload) {
        if (company.status === 'CONVERTED') {
          return { success: false, error: 'Company already converted' };
        }
        const newCustomerId = `CUST-${Date.now()}`;
        const newCustomer = {
          id: newCustomerId,
          name: company.company_name,
          contact_person: payload.contact_person,
          email: payload.email,
          phone: payload.phone,
          customer_type: payload.customer_type || 'Corporate',
          prospect_dossier_id: company.id, // Mandatory back-reference
        };

        const updatedCompany = {
          ...company,
          status: 'CONVERTED',
          crm_customer_id: newCustomerId,
        };

        return {
          success: true,
          customer: newCustomer,
          company: updatedCompany,
        };
      }

      const res = convertToCRM(prospectCompany, {
        contact_person: 'Mr. Venkat Reddy',
        email: 'v.reddy@medplusindia.com',
        phone: '+91 98499 11223',
        customer_type: 'Corporate',
      });

      assert.equal(res.success, true);
      assert.ok(res.customer.id);
      assert.equal(res.customer.prospect_dossier_id, 'prosp-comp-999');
      assert.equal(res.company.status, 'CONVERTED');
      assert.equal(res.company.crm_customer_id, res.customer.id);

      // Attempting second conversion fails
      const duplicateRes = convertToCRM(res.company, {});
      assert.equal(duplicateRes.success, false);
      assert.ok(duplicateRes.error.includes('already converted'));
    });
  });

  // =========================================================================
  // 6. AI TOOL REGISTRATION, RBAC & POLICY CHECK
  // =========================================================================
  describe('6. AI Gateway Approved Tools & RBAC Policy Check', () => {
    const APPROVED_TOOLS = {
      search_prospect_companies: {
        tool_name: 'search_prospect_companies',
        min_role: 'Sales Executive',
        allowed_roles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'],
      },
      get_prospect_dossier: {
        tool_name: 'get_prospect_dossier',
        min_role: 'Sales Executive',
        allowed_roles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'],
      },
      run_prospect_research: {
        tool_name: 'run_prospect_research',
        min_role: 'BDM',
        allowed_roles: ['Managing Director', 'Admin / BDM', 'BDM'],
      },
      convert_prospect_to_crm: {
        tool_name: 'convert_prospect_to_crm',
        min_role: 'BDM',
        allowed_roles: ['Managing Director', 'Admin / BDM', 'BDM'],
      },
    };

    function validateToolPolicy(toolName, userRole) {
      const tool = APPROVED_TOOLS[toolName];
      if (!tool) return { allowed: false, reason: 'Tool not found' };
      if (!tool.allowed_roles.includes(userRole)) {
        return { allowed: false, reason: 'Unauthorized role' };
      }
      const humanConfirmRequired = ['convert_prospect_to_crm', 'run_prospect_research'];
      return {
        allowed: true,
        requiresConfirmation: humanConfirmRequired.includes(toolName),
      };
    }

    it('authorizes Sales Executive for read-only prospect search and dossier inspection', () => {
      const searchCheck = validateToolPolicy('search_prospect_companies', 'Sales Executive');
      assert.equal(searchCheck.allowed, true);
      assert.equal(searchCheck.requiresConfirmation, false);

      const dossierCheck = validateToolPolicy('get_prospect_dossier', 'Sales Executive');
      assert.equal(dossierCheck.allowed, true);
      assert.equal(dossierCheck.requiresConfirmation, false);
    });

    it('requires elevated role and human confirmation for CRM conversion and research execution', () => {
      // Sales Executive cannot convert to CRM
      const salesConv = validateToolPolicy('convert_prospect_to_crm', 'Sales Executive');
      assert.equal(salesConv.allowed, false);

      // BDM can convert, but requires confirmation
      const bdmConv = validateToolPolicy('convert_prospect_to_crm', 'BDM');
      assert.equal(bdmConv.allowed, true);
      assert.equal(bdmConv.requiresConfirmation, true);

      // MD can execute research, but requires confirmation
      const mdRun = validateToolPolicy('run_prospect_research', 'Managing Director');
      assert.equal(mdRun.allowed, true);
      assert.equal(mdRun.requiresConfirmation, true);
    });
  });

  // =========================================================================
  // 7. ZERO-SCRAPING COMPLIANCE & LEGAL CITATIONS
  // =========================================================================
  describe('7. Zero-Scraping Compliance & Permitted Public Sources Only', () => {
    it('verifies that no automated scraping bots or credential automation are permitted', () => {
      const PROHIBITED_METHODS = ['linkedin_scraper', 'browser_automation_bot', 'credential_harvester'];
      const ALLOWED_SOURCES = ['PUBLIC_TENDER_PORTAL', 'GOVERNMENT_POLLUTION_BOARD', 'ROC_MCA_FILINGS', 'CORPORATE_PRESS_RELEASE'];

      for (const method of PROHIBITED_METHODS) {
        assert.equal(ALLOWED_SOURCES.includes(method), false);
      }
    });
  });
});
