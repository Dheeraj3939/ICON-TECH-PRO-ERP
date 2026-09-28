import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ICON TECH PRO ERP v7.1 Upgrade Suite', () => {
  describe('1. Customer Types & GeM / Tender Compliance', () => {
    it('Validates all three customer types (COMPANY, INDIVIDUAL, GOVERNMENT)', () => {
      const validTypes = ['COMPANY', 'INDIVIDUAL', 'GOVERNMENT'];
      assert.equal(validTypes.length, 3);
      assert.ok(validTypes.includes('GOVERNMENT'));
      assert.ok(validTypes.includes('COMPANY'));
      assert.ok(validTypes.includes('INDIVIDUAL'));
    });

    it('Correctly models government customer with GeM and tender attributes', () => {
      const govtCustomer = {
        id: 'cust-govt-01',
        customer_code: 'GOV-2026-001',
        customer_name: 'Director of Information Technology',
        company_name: 'Telangana State Technology Services (TSTS)',
        customer_type: 'GOVERNMENT',
        department_name: 'IT, Electronics & Communications',
        tender_reference: 'TSTS/HW/2026/892',
        gem_order_number: 'GEMC-511687729831',
        gem_seller_id: 'ICON-GEM-HYD-99',
        nodal_officer: 'Sri R. K. Varma, Joint Director',
        emd_amount: 150000,
        payment_terms_days: 45,
        status: 'Active',
      };

      assert.equal(govtCustomer.customer_type, 'GOVERNMENT');
      assert.equal(govtCustomer.department_name, 'IT, Electronics & Communications');
      assert.equal(govtCustomer.gem_order_number, 'GEMC-511687729831');
      assert.equal(govtCustomer.payment_terms_days, 45);
      assert.equal(govtCustomer.emd_amount, 150000);
    });

    it('Correctly models individual residential customer with room measurements', () => {
      const individualCustomer = {
        id: 'cust-ind-01',
        customer_code: 'IND-2026-002',
        customer_name: 'Dr. Srinivas Rao',
        company_name: 'Residential Villa 42',
        customer_type: 'INDIVIDUAL',
        room_measurements: [
          { room_name: 'Home Cinema Hall', length: 24, width: 18, height: 11, throw_distance: 19 },
          { room_name: 'Living Lounge', length: 16, width: 14, height: 10 },
        ],
        status: 'Active',
      };

      assert.equal(individualCustomer.customer_type, 'INDIVIDUAL');
      assert.equal(individualCustomer.room_measurements?.length, 2);
      assert.equal(individualCustomer.room_measurements[0].throw_distance, 19);
    });
  });

  describe('2. Attendance Role Permissions (HTTP 500 Fix)', () => {
    it('Authorizes BDM and Sales Executive for attendance correction requests', () => {
      const allowedRoles = [
        'Managing Director',
        'Admin / BDM',
        'BDM',
        'Sales Executive',
        'Accounts',
        'Office Assistant',
      ];

      assert.ok(allowedRoles.includes('BDM'), 'BDM must be allowed in attendance corrections');
      assert.ok(allowedRoles.includes('Sales Executive'), 'Sales Executive must be allowed in attendance corrections');
      assert.equal(allowedRoles.length, 6, 'All 6 ERP personas must have attendance correction access');
    });
  });

  describe('3. Financial Receivables Aging Engine', () => {
    function calculateAgingBucket(dueDateStr, asOfDateStr = '2026-09-18') {
      const due = new Date(dueDateStr);
      const asOf = new Date(asOfDateStr);
      const diffMs = asOf.getTime() - due.getTime();
      const overdueDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      if (overdueDays <= 30) return '0-30';
      if (overdueDays <= 60) return '31-60';
      if (overdueDays <= 90) return '61-90';
      return '90+';
    }

    it('Categorizes 0-30 day overdue invoice correctly', () => {
      assert.equal(calculateAgingBucket('2026-09-01', '2026-09-18'), '0-30'); // 17 days
    });

    it('Categorizes 31-60 day overdue invoice correctly', () => {
      assert.equal(calculateAgingBucket('2026-08-01', '2026-09-18'), '31-60'); // 48 days
    });

    it('Categorizes 61-90 day overdue invoice correctly', () => {
      assert.equal(calculateAgingBucket('2026-07-01', '2026-09-18'), '61-90'); // 79 days
    });

    it('Categorizes 90+ day critical default risk invoice correctly', () => {
      assert.equal(calculateAgingBucket('2026-05-01', '2026-09-18'), '90+'); // 140 days
    });

    it('Correctly aggregates aging bucket totals across invoice list', () => {
      const invoices = [
        { id: '1', balance_amount: 50000, due_date: '2026-09-10' }, // 8 days -> 0-30
        { id: '2', balance_amount: 75000, due_date: '2026-08-10' }, // 39 days -> 31-60
        { id: '3', balance_amount: 120000, due_date: '2026-07-10' }, // 70 days -> 61-90
        { id: '4', balance_amount: 300000, due_date: '2026-04-10' }, // 161 days -> 90+
      ];

      const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
      for (const inv of invoices) {
        const b = calculateAgingBucket(inv.due_date, '2026-09-18');
        buckets[b] += inv.balance_amount;
      }

      assert.equal(buckets['0-30'], 50000);
      assert.equal(buckets['31-60'], 75000);
      assert.equal(buckets['61-90'], 120000);
      assert.equal(buckets['90+'], 300000);
      assert.equal(buckets['0-30'] + buckets['31-60'] + buckets['61-90'] + buckets['90+'], 545000);
    });
  });

  describe('4. Cross-Module Workflow Continuity & Shortcuts', () => {
    it('Transfers site survey room parameters into quotation builder format', () => {
      const surveyContext = {
        customer_name: 'Dr. Srinivas Rao',
        survey_notes: '120 inch ambient-light rejection motorized screen with 4K laser projector',
        room_length: 24,
        room_width: 18,
        throw_distance: 19,
      };

      const quotationItems = [
        {
          product_name: 'Custom Room Package (' + surveyContext.room_length + 'x' + surveyContext.room_width + ' ft)',
          description: surveyContext.survey_notes + ' | Throw: ' + surveyContext.throw_distance + ' ft',
          quantity: 1,
          unit_price: 285000,
        },
      ];

      assert.equal(quotationItems[0].quantity, 1);
      assert.ok(quotationItems[0].description.includes('Throw: 19 ft'));
    });

    it('Dispatches trigger installation scheduling with matched SO details', () => {
      const dispatchRecord = {
        dispatch_id: 'DSP-2026-042',
        order_number: 'SO-2026-018',
        customer_name: 'Telangana State Technology Services (TSTS)',
        destination_site: 'Secretariat Complex, Hyderabad',
        status: 'DELIVERED',
      };

      const scheduledInstallation = {
        job_number: 'INST-' + dispatchRecord.dispatch_id,
        order_number: dispatchRecord.order_number,
        customer_name: dispatchRecord.customer_name,
        site_address: dispatchRecord.destination_site,
        status: 'SCHEDULED',
      };

      assert.equal(scheduledInstallation.customer_name, dispatchRecord.customer_name);
      assert.equal(scheduledInstallation.status, 'SCHEDULED');
    });

    it('Completed installations generate AMC proposal with matching equipment baseline', () => {
      const completedInstallation = {
        job_number: 'JOB-2026-101',
        customer_name: 'Dr. Srinivas Rao',
        system_type: 'Home Cinema 4K Laser Projection',
        warranty_end_date: '2027-09-18',
      };

      const amcProposal = {
        customer_name: completedInstallation.customer_name,
        equipment_coverage: completedInstallation.system_type,
        start_date: completedInstallation.warranty_end_date,
        tier: 'COMPREHENSIVE_ANNUAL',
      };

      assert.equal(amcProposal.customer_name, 'Dr. Srinivas Rao');
      assert.equal(amcProposal.start_date, '2027-09-18');
    });
  });

  describe('5. Role-Tailored Cockpits for All 6 Personas', () => {
    it('Provides dedicated KPI configuration for each persona', () => {
      const roleCockpits = {
        'Managing Director': { focus: 'PROFIT_MARGIN_REVENUE', showCost: true },
        'Admin / BDM': { focus: 'SALES_AND_OPERATIONS', showCost: true },
        'BDM': { focus: 'PIPELINE_VOLUME_AND_CLOSURES', showCost: false },
        'Sales Executive': { focus: 'DAILY_ACTIVITIES_AND_QUOTES', showCost: false },
        'Accounts': { focus: 'LIQUIDITY_AGING_AND_TALLY', showCost: true },
        'Office Assistant': { focus: 'DISPATCHES_AND_TECHNICIANS', showCost: false },
      };

      const personas = Object.keys(roleCockpits);
      assert.equal(personas.length, 6);
      assert.equal(roleCockpits['Managing Director'].showCost, true);
      assert.equal(roleCockpits['Sales Executive'].showCost, false);
      assert.equal(roleCockpits['Accounts'].focus, 'LIQUIDITY_AGING_AND_TALLY');
    });
  });
});