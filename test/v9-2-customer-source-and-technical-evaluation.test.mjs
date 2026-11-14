/**
 * ICON TECH PRO ERP V9.2
 * Customer Enquiry Source & Technical Evaluation Verification Test Suite
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('ICON TECH PRO ERP V9.2 - Customer Source & Technical Evaluation Verification', () => {

  describe('1. Controlled Customer Enquiry Sources', () => {
    test('Exact 7 Canonical Sources are defined in customer-source.ts', async () => {
      const sourceFile = path.resolve('src/lib/constants/customer-source.ts');
      assert.ok(fs.existsSync(sourceFile), 'customer-source.ts must exist');

      const content = fs.readFileSync(sourceFile, 'utf8');

      const expectedSources = [
        'Just Dial',
        'India Mart',
        'Google ADS',
        'Existing Customers',
        'Referrals',
        'Website',
        'Walk-in',
      ];

      for (const src of expectedSources) {
        assert.ok(content.includes(`'${src}'`), `Source '${src}' must be present in ENQUIRY_SOURCES`);
      }

      // Check count
      const match = content.match(/ENQUIRY_SOURCES\s*=\s*\[([\s\S]*?)\]\s*as\s*const/);
      assert.ok(match, 'ENQUIRY_SOURCES array must be defined as const');
      const items = match[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
      assert.equal(items.length, 7, `There must be exactly 7 sources, found ${items.length}: ${JSON.stringify(items)}`);
      assert.deepEqual(items, expectedSources, 'Sources must match expected canonical set exactly');
    });

    test('Customer validation schema enforces canonical sources with legacy tolerance', () => {
      const valFile = path.resolve('src/lib/validations/customer.ts');
      assert.ok(fs.existsSync(valFile), 'customer.ts validation must exist');
      const content = fs.readFileSync(valFile, 'utf8');
      assert.ok(content.includes('isCanonicalEnquirySource'), 'Validation must reference isCanonicalEnquirySource');
      assert.ok(content.includes('enquirySourceSchema'), 'Validation must define enquirySourceSchema');
    });

    test('Customer Form Modal renders canonical sources and historical fallback', () => {
      const modalFile = path.resolve('src/components/customers/customer-form-modal.tsx');
      assert.ok(fs.existsSync(modalFile), 'customer-form-modal.tsx must exist');
      const content = fs.readFileSync(modalFile, 'utf8');
      assert.ok(content.includes('ENQUIRY_SOURCES.map'), 'Must render ENQUIRY_SOURCES in dropdown');
      assert.ok(content.includes('Historical / Legacy'), 'Must preserve and label historical legacy sources');
    });

    test('New Enquiry Modal and Edit Enquiry Modal use ENQUIRY_SOURCES', () => {
      const newModalFile = path.resolve('src/components/modals/NewEnquiryModal.tsx');
      const editModalFile = path.resolve('src/components/modals/EditEnquiryModal.tsx');
      assert.ok(fs.existsSync(newModalFile), 'NewEnquiryModal.tsx must exist');
      assert.ok(fs.existsSync(editModalFile), 'EditEnquiryModal.tsx must exist');

      const newContent = fs.readFileSync(newModalFile, 'utf8');
      const editContent = fs.readFileSync(editModalFile, 'utf8');

      assert.ok(newContent.includes('ENQUIRY_SOURCES.map'), 'NewEnquiryModal must map ENQUIRY_SOURCES');
      assert.ok(editContent.includes('ENQUIRY_SOURCES.map'), 'EditEnquiryModal must map ENQUIRY_SOURCES');
      assert.ok(newContent.includes('Historical / Legacy'), 'NewEnquiryModal must have legacy fallback');
      assert.ok(editContent.includes('Historical / Legacy'), 'EditEnquiryModal must have legacy fallback');
    });
  });

  describe('2. Site Visit Project Categories & Field Expansion', () => {
    test('Exact 7 Site Visit Project Categories are defined', () => {
      const typesFile = path.resolve('src/types/technical-evaluation.ts');
      assert.ok(fs.existsSync(typesFile), 'technical-evaluation.ts must exist');
      const content = fs.readFileSync(typesFile, 'utf8');

      const expectedCategories = [
        'Networking Solutions',
        'Video Conferencing Solutions',
        'Home Theater Solutions',
        'CCTV & Surveillance',
        'IT Infrastructure',
        'Audio-Visual Solutions',
        'Other Projects',
      ];

      for (const cat of expectedCategories) {
        assert.ok(content.includes(`'${cat}'`), `Category '${cat}' must be present in SITE_VISIT_PROJECT_CATEGORIES`);
      }

      const match = content.match(/SITE_VISIT_PROJECT_CATEGORIES\s*=\s*\[([\s\S]*?)\]\s*as\s*const/);
      assert.ok(match, 'SITE_VISIT_PROJECT_CATEGORIES must be defined as const');
      const items = match[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
      assert.equal(items.length, 7, `There must be exactly 7 project categories, found ${items.length}`);
      assert.deepEqual(items, expectedCategories, 'Categories must match specification');
    });

    test('SiteVisitDetails interface has all required expanded fields', () => {
      const typesFile = path.resolve('src/types/erp.ts');
      const content = fs.readFileSync(typesFile, 'utf8');

      const requiredFields = [
        'customer_name',
        'contact_person',
        'contact_phone',
        'salesperson_name',
        'project_category',
        'other_project_description',
        'purpose',
        'scheduled_time',
        'next_action',
        'follow_up_date',
        'technical_evaluation_id',
        'technical_evaluation_status',
      ];

      for (const field of requiredFields) {
        assert.ok(content.includes(`${field}?:`), `SiteVisitDetails must have optional field ${field}`);
      }
    });

    test('Site Visits page supports 7 project categories and conditional other_project_description', () => {
      const pageFile = path.resolve('src/app/(dashboard)/dashboard/site-visits/page.tsx');
      assert.ok(fs.existsSync(pageFile), 'site-visits/page.tsx must exist');
      const content = fs.readFileSync(pageFile, 'utf8');

      assert.ok(content.includes('SITE_VISIT_PROJECT_CATEGORIES.map'), 'Must render project category options');
      assert.ok(content.includes("projectCategory === 'Other Projects'"), 'Must conditionally render other_project_description');
      assert.ok(content.includes('createSiteVisit'), 'Must call createSiteVisit server action');
    });
  });

  describe('3. Technical Evaluation Architecture & Sections A to H', () => {
    test('TechnicalEvaluation interface covers all Sections A to H', () => {
      const typesFile = path.resolve('src/types/technical-evaluation.ts');
      const content = fs.readFileSync(typesFile, 'utf8');

      // Section A
      assert.ok(content.includes('evaluation_number: string'), 'Section A: evaluation_number');
      assert.ok(content.includes('project_category: SiteVisitProjectCategory'), 'Section A: project_category');
      assert.ok(content.includes('assigned_technical_employee_name?: string'), 'Section A: assigned_technical_employee_name');

      // Section B
      assert.ok(content.includes('stated_requirement: string'), 'Section B: stated_requirement');
      assert.ok(content.includes('project_objectives?: string'), 'Section B: project_objectives');
      assert.ok(content.includes('number_of_rooms?: number'), 'Section B: number_of_rooms');

      // Section C
      assert.ok(content.includes('network_infrastructure?: string'), 'Section C: network_infrastructure');
      assert.ok(content.includes('cabling_conduits_status?: string'), 'Section C: cabling_conduits_status');

      // Section D
      assert.ok(content.includes('site_measurements?: string'), 'Section D: site_measurements');
      assert.ok(content.includes('physical_constraints?: string'), 'Section D: physical_constraints');

      // Section E
      assert.ok(content.includes('recommended_items: TechnicalRecommendedItem[]'), 'Section E: recommended_items');
      assert.ok(content.includes('system_architecture_summary?: string'), 'Section E: system_architecture_summary');

      // Section F
      assert.ok(content.includes('technical_risks?: string'), 'Section F: technical_risks');
      assert.ok(content.includes('installation_limitations?: string'), 'Section F: installation_limitations');

      // Section G
      assert.ok(content.includes('proposed_solution_summary: string'), 'Section G: proposed_solution_summary');
      assert.ok(content.includes('internal_engineer_remarks?: string'), 'Section G: internal_engineer_remarks');

      // Section H
      assert.ok(content.includes('submitted_at?: string'), 'Section H: submitted_at');
      assert.ok(content.includes('reviewed_at?: string'), 'Section H: reviewed_at');
      assert.ok(content.includes('revisions?: TechnicalEvaluationRevision[]'), 'Section H: revisions');
    });

    test('TechnicalEvaluationModal component exists and implements full workflow', () => {
      const modalFile = path.resolve('src/components/technical-evaluation/TechnicalEvaluationModal.tsx');
      assert.ok(fs.existsSync(modalFile), 'TechnicalEvaluationModal.tsx must exist');
      const content = fs.readFileSync(modalFile, 'utf8');

      // Check section tabs A through H
      assert.ok(content.includes("'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'"), 'Must implement tabs A through H');
      assert.ok(content.includes('handleSaveDraft'), 'Must support Save Draft');
      assert.ok(content.includes('handleSubmitForReview'), 'Must support Submit for Review');
      assert.ok(content.includes('handleReviewApprove'), 'Must support Review / Approve');
      assert.ok(content.includes('handleRequestRevision'), 'Must support Request Revision');

      // Check internal remarks quarantine warning
      assert.ok(content.includes('Internal Engineer Remarks (Confidential'), 'Must display internal remarks confidentiality warning');
      assert.ok(content.includes('Strictly NOT Exported to Quotations'), 'Must declare quarantine from quotations');
    });
  });

  describe('4. Quotation Workspace Integration & Confidentiality', () => {
    test('QuotationFormWorkspace imports Technical Evaluation recommendations', () => {
      const workspaceFile = path.resolve('src/components/quotations/QuotationFormWorkspace.tsx');
      assert.ok(fs.existsSync(workspaceFile), 'QuotationFormWorkspace.tsx must exist');
      const content = fs.readFileSync(workspaceFile, 'utf8');

      assert.ok(content.includes('getTechnicalEvaluations'), 'Workspace must fetch technical evaluations');
      assert.ok(content.includes('Technical Evaluation Available'), 'Workspace must display technical evaluation banner');
      assert.ok(content.includes('handleConfirmImportEquipment'), 'Workspace must implement equipment import handler');
      assert.ok(content.includes('purchase_price: 0'), 'Confidential purchase price must NOT be imported from evaluation');
    });

    test('Quotation workflow remains completely optional without evaluation', () => {
      const workspaceFile = path.resolve('src/components/quotations/QuotationFormWorkspace.tsx');
      const content = fs.readFileSync(workspaceFile, 'utf8');

      // Ensure evaluation is not mandatory for saving quotations
      assert.ok(!content.includes('if (!selectedImportEvaluation) throw'), 'Evaluation must never be mandatory to save');
      assert.ok(content.includes('linkedEvaluations.length > 0'), 'Evaluation section only displays when evaluations exist');
    });
  });

  describe('5. Database Migration & Rollback Artifacts', () => {
    test('Additive migration file exists and contains all required DDL', () => {
      const migFile = path.resolve('supabase/migrations/20261031000002_v9_2_technical_evaluations_and_sources.sql');
      assert.ok(fs.existsSync(migFile), 'Additive migration file must exist');
      const content = fs.readFileSync(migFile, 'utf8');

      assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.technical_evaluations'), 'Must create technical_evaluations table');
      assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.site_visits'), 'Must ensure site_visits table');
      assert.ok(content.includes('ALTER TABLE public.technical_evaluations ENABLE ROW LEVEL SECURITY'), 'Must enable RLS');
      assert.ok(content.includes('internal_engineer_remarks text'), 'Must include internal_engineer_remarks column');
    });

    test('Rollback migration file exists and cleanly drops additions', () => {
      const rollFile = path.resolve('supabase/migrations/20261031000002_v9_2_technical_evaluations_and_sources_rollback.sql');
      assert.ok(fs.existsSync(rollFile), 'Rollback migration file must exist');
      const content = fs.readFileSync(rollFile, 'utf8');

      assert.ok(content.includes('DROP TABLE IF EXISTS public.technical_evaluations CASCADE'), 'Must drop technical_evaluations on rollback');
    });
  });
});
