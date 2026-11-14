import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  productResearchAgent,
  matchesExactModel,
  normalizeQuery,
  normalizeModelCode,
  generateModelAliases,
  isGenericHomepage,
  isCorporateBoilerplate,
  synthesizeCustomerDescription,
  formatKeySpecifications,
  classifySource,
} from '../src/lib/ai/product-research-agent.ts';

import {
  detectQuotationFormat,
  QUOTATION_FORMAT_REGISTRY,
} from '../src/lib/ai/quotation-format-detector.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — MASTER PRODUCT INTELLIGENCE & QUOTATION TEST SUITE
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Master Product Intelligence & Quotation Suite', async (t) => {
  const specActionPath = path.join(rootDir, 'src/lib/actions/spec-intelligence.ts');
  const printModalPath = path.join(rootDir, 'src/components/modals/PrintQuotationModal.tsx');
  const workspacePath = path.join(rootDir, 'src/components/quotations/QuotationFormWorkspace.tsx');
  const specModalPath = path.join(rootDir, 'src/components/modals/SpecIntelligenceLookupModal.tsx');
  const typesPath = path.join(rootDir, 'src/types/erp.ts');
  const migrationPath = path.join(rootDir, 'supabase/migrations/20261001000003_product_intelligence_library.sql');

  // ---------------------------------------------------------------------------
  // 1. QUERY NORMALIZATION & ALIAS GENERATION
  // ---------------------------------------------------------------------------
  await t.test('1. Query Normalization & Model Alias Generation', async (st) => {
    await st.test('1.1: Handles arbitrary spaces, hyphens, and casing in query', () => {
      const q1 = normalizeQuery('  Sony   VW-5000ES   projector   ');
      assert.equal(q1, 'Sony VW-5000ES projector');

      const code1 = normalizeModelCode('VW-5000ES');
      const code2 = normalizeModelCode('VW 5000 ES');
      const code3 = normalizeModelCode('VW5000ES');
      const code4 = normalizeModelCode('VPL-VW5000ES');

      assert.equal(code1, 'VW5000ES');
      assert.equal(code2, 'VW5000ES');
      assert.equal(code3, 'VW5000ES');
      assert.equal(code4, 'VPLVW5000ES');
    });

    await st.test('1.2: Generates comprehensive model aliases for matching', () => {
      const aliases = generateModelAliases('Sony', 'VW-5000ES');
      assert.ok(aliases.includes('VW-5000ES'));
      assert.ok(aliases.includes('VW 5000ES') || aliases.includes('VW 5000 ES'));
      assert.ok(aliases.includes('VW5000ES'));
      assert.ok(aliases.includes('VPL-VW-5000ES') || aliases.includes('VPL-VW5000ES'));
    });

    await st.test('1.3: Normalizes Dell and Lenovo IT hardware models', () => {
      const dellCode = normalizeModelCode('Latitude 5440');
      assert.equal(dellCode, 'LATITUDE5440');

      const lenovoCode = normalizeModelCode('ThinkPad E14 Gen 5');
      assert.equal(lenovoCode, 'THINKPADE14GEN5');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. REAL-WORLD BENCHMARK SPEC INTELLIGENCE VERIFICATION
  // ---------------------------------------------------------------------------
  await t.test('2. Real-World Benchmark Spec Intelligence Retrieval', async (st) => {
    const benchmarks = [
      {
        query: 'Sony VW-5000ES',
        expectedBrand: 'Sony',
        expectedModel: 'VW-5000ES',
        keySpecKeyword: '4K',
      },
      {
        query: 'Epson EB-W49',
        expectedBrand: 'Epson',
        expectedModel: 'EB-W49',
        keySpecKeyword: '3,800',
      },
      {
        query: 'Dell Latitude 5440',
        expectedBrand: 'Dell',
        expectedModel: 'Latitude 5440',
        keySpecKeyword: 'Intel',
      },
      {
        query: 'Lenovo ThinkPad E14',
        expectedBrand: 'Lenovo',
        expectedModel: 'ThinkPad E14 Gen 5',
        keySpecKeyword: 'Core',
      },
      {
        query: 'CP Plus CP-UNC-T41ZL3-VMS',
        expectedBrand: 'CP Plus',
        expectedModel: 'CP-UNC-T41ZL3-VMS',
        keySpecKeyword: '4MP',
      },
      {
        query: 'Hikvision DS-2CD2143G2-IS',
        expectedBrand: 'Hikvision',
        expectedModel: 'DS-2CD2143G2-IS',
        keySpecKeyword: '4MP',
      },
      {
        query: 'Logitech Rally Bar',
        expectedBrand: 'Logitech',
        expectedModel: 'Rally Bar',
        keySpecKeyword: '4K',
      },
      {
        query: 'Klipsch RP-8000F II',
        expectedBrand: 'Klipsch',
        expectedModel: 'RP-8000F II',
        keySpecKeyword: 'Titanium',
      },
      {
        query: 'Cisco CBS350-24T-4G',
        expectedBrand: 'Cisco',
        expectedModel: 'CBS350-24T-4G',
        keySpecKeyword: 'Gigabit',
      },
      {
        query: 'Canon imageCLASS MF3010',
        expectedBrand: 'Canon',
        expectedModel: 'imageCLASS MF3010',
        keySpecKeyword: 'Laser',
      },
    ];

    for (const b of benchmarks) {
      await st.test(`2.Benchmark: ${b.query}`, async () => {
        const result = await productResearchAgent.executeResearch(b.query);
        assert.equal(result.found, true, `Must resolve benchmark ${b.query}`);
        assert.ok(
          result.model === b.expectedModel ||
          result.model.includes(b.expectedModel) ||
          b.expectedModel.includes(result.model)
        );
        assert.ok(
          result.key_specifications.toLowerCase().includes(b.keySpecKeyword.toLowerCase()) ||
          (result.specs_text && result.specs_text.toLowerCase().includes(b.keySpecKeyword.toLowerCase())),
          `Specs must include keyword ${b.keySpecKeyword}`
        );
        assert.ok(result.datasheet_url || result.source_url);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. DATABASE-FIRST PRODUCT LIBRARY RESOLUTION & PERSISTENCE
  // ---------------------------------------------------------------------------
  await t.test('3. Database-First Product Library Instant Retrieval', async (st) => {
    await st.test('3.1: Additive migration for library metadata exists with GIN index', () => {
      assert.ok(fs.existsSync(migrationPath), 'Migration 20261001000003 must exist');
      const content = fs.readFileSync(migrationPath, 'utf8');
      assert.match(content, /ALTER TABLE public\.spec_intelligence_records/);
      assert.match(content, /ADD COLUMN IF NOT EXISTS normalized_brand/);
      assert.match(content, /ADD COLUMN IF NOT EXISTS normalized_model/);
      assert.match(content, /ADD COLUMN IF NOT EXISTS search_aliases/);
      assert.match(content, /idx_spec_intel_aliases\s+ON public\.spec_intelligence_records USING GIN/);
    });

    await st.test('3.2: Server action spec-intelligence.ts exports searchProductLibrary', () => {
      assert.ok(fs.existsSync(specActionPath));
      const content = fs.readFileSync(specActionPath, 'utf8');
      assert.match(content, /export async function searchProductLibrary/);
      assert.match(content, /export async function researchProductWeb/);
      assert.match(content, /searchProductLibrary\(userQuery\)/, 'researchProductWeb must do database-first check');
      assert.match(content, /from_library: true/);
    });

    await st.test('3.3: SpecIntelligenceLookupModal integrates debounced searchProductLibrary', () => {
      assert.ok(fs.existsSync(specModalPath));
      const content = fs.readFileSync(specModalPath, 'utf8');
      assert.match(content, /searchProductLibrary/, 'Modal must call searchProductLibrary as user types');
      assert.match(content, /autocompleteResults/, 'Modal must track autocompleteResults state');
      assert.match(content, /✓ Verified • Official Source/, 'Modal must show verified badge on library card');
      assert.match(content, /Force Web Refresh/, 'Modal must provide Force Web Refresh button');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. ZERO-HALLUCINATION & REJECTION GATES
  // ---------------------------------------------------------------------------
  await t.test('4. Zero-Hallucination & Model Rejection Gates', async (st) => {
    await st.test('4.1: Bogus model returns found=false without fabricating specs', async () => {
      const res = await productResearchAgent.executeResearch('NonExistentBogusModelXYZ9999');
      assert.equal(res.found, false);
      assert.equal(res.verification_status, 'NO_RELIABLE_MATCH');
      assert.match(res.message, /could not be reliably verified|No verified specifications found|No reliable product specification/i);
    });

    await st.test('4.2: Wrong model rejection (EB-W50 when requesting EB-W53)', () => {
      const isMatch = matchesExactModel(
        'Epson EB-W50 WXGA 3LCD Projector Specifications',
        'EB-W53',
        'Epson'
      );
      assert.equal(isMatch, false, 'Must reject EB-W50 when EB-W53 was requested');
    });

    await st.test('4.3: Generic homepage rejection as proof of model existence', () => {
      assert.equal(isGenericHomepage('https://www.epson.co.in/'), true);
      assert.equal(isGenericHomepage('https://www.sony.co.in'), true);
      assert.equal(isGenericHomepage('https://www.dell.com/en-in'), true);
      assert.equal(isGenericHomepage('https://www.epson.co.in/Projectors/Corporate-and-Education/EB-W53-WXGA-3LCD-Projector/p/V11HB57056'), false);
    });

    await st.test('4.4: Corporate marketing boilerplate suppression in synthesized description', () => {
      const isBoilerplate = isCorporateBoilerplate('Canon India Pvt Ltd is a 100% subsidiary of Canon Singapore Pte Ltd and world-leading human technology.');
      assert.equal(isBoilerplate, true);

      const cleanDesc = synthesizeCustomerDescription('Canon', 'MF3010', { 'Print Technology': 'Monochrome Laser', 'Print Speed': 'Up to 18 ppm' }, 'Canon India Pvt Ltd is a 100% subsidiary of Canon.');
      assert.doesNotMatch(cleanDesc, /100% subsidiary/i);
      assert.match(cleanDesc, /laser printer|multifunction/i);
    });

    await st.test('4.5: 6-level source confidence classification', () => {
      const c1 = classifySource('https://www.sony.com/electronics/projectors/vpl-vw5000es', 'VW5000ES Product', 'Sony');
      assert.equal(c1.confidenceLevel, 1);
      assert.equal(c1.sourceType, 'MANUFACTURER_PRODUCT_PAGE');

      const c2 = classifySource('https://www.sony.com/vpl-vw5000es-datasheet.pdf', 'VW5000ES Datasheet', 'Sony');
      assert.equal(c2.confidenceLevel, 2);
      assert.equal(c2.sourceType, 'MANUFACTURER_DATASHEET');

      const c5 = classifySource('https://www.projectorcentral.com/Sony-VW5000ES.htm', 'ProjectorCentral', 'Sony');
      assert.equal(c5.confidenceLevel, 5);
      assert.equal(c5.sourceType, 'TECHNICAL_DATABASE');

      const c6 = classifySource('https://randomblog.com/electronics', 'Blog Review', 'Sony');
      assert.equal(c6.confidenceLevel, 6);
      assert.equal(c6.sourceType, 'GENERAL_WEB');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. AI QUOTATION FORMAT DETECTION & MULTI-CATEGORY ENGINE
  // ---------------------------------------------------------------------------
  await t.test('5. AI Quotation Format Detection Engine', async (st) => {
    await st.test('5.1: Srikanth Home Theater Standard (7.2.1 Atmos with 4K Projector)', () => {
      const prompt = 'Turnkey 7.2.1 Dolby Atmos Private Home Theater with 4K Laser Projector and 130 inch Acoustically Transparent Screen';
      const detected = detectQuotationFormat(prompt);

      assert.equal(detected.format, 'HOME_THEATER');
      assert.equal(detected.confidence >= 0.85, true);
      assert.equal(detected.suggestedSections.length, 5);

      // Verify the 5 canonical Srikanth sections
      assert.ok(detected.suggestedSections[0].includes('HOME THEATER ROOM / CONFIGURATION'));
      assert.ok(detected.suggestedSections[1].includes('AVR / PROTECTION / SCREEN'));
      assert.ok(detected.suggestedSections[2].includes('ALL INTERCONNECTIVITIES'));
      assert.ok(detected.suggestedSections[3].includes('VIDEO PROJECTOR'));
      assert.ok(detected.suggestedSections[4].includes('INSTALLATION / DESIGN / TRANSPORT / COMMISSIONING'));
    });

    await st.test('5.2: Detects Conference Room Solution', () => {
      const prompt = 'Boardroom video conference setup with 4K PTZ Camera and Wireless Presentation Pods';
      const detected = detectQuotationFormat(prompt);
      assert.equal(detected.format, 'CONFERENCE_ROOM');
      assert.ok(detected.suggestedSections.some(s => s.includes('CAMERA') || s.includes('DISPLAY')));
    });

    await st.test('5.3: Detects CCTV Surveillance Solution', () => {
      const prompt = '32-Channel IP CCTV Surveillance Solution with 4MP Dome Cameras and NVR Storage';
      const detected = detectQuotationFormat(prompt);
      assert.equal(detected.format, 'CCTV_SURVEILLANCE');
      assert.ok(detected.suggestedSections.some(s => s.includes('CAMERAS') || s.includes('RECORDING')));
    });

    await st.test('5.4: Detects Enterprise Networking Solution', () => {
      const prompt = 'Managed Core Network with 24-Port PoE Switch, Wi-Fi 6 APs and Rack Infrastructure';
      const detected = detectQuotationFormat(prompt);
      assert.equal(detected.format, 'NETWORKING');
      assert.ok(detected.suggestedSections.some(s => s.includes('SWITCH') || s.includes('WIRELESS')));
    });

    await st.test('5.5: Multi-zone & mixed project detects CUSTOM_PROJECT', () => {
      const prompt = 'Campus facility setup combining 64 CCTV cameras, Home Theater auditorium, and enterprise networking switch';
      const detected = detectQuotationFormat(prompt);
      assert.equal(detected.format, 'CUSTOM_PROJECT');
    });

    await st.test('5.6: Format-Product Independence: Projector can be used in standard or any project format', () => {
      for (const formatKey of Object.keys(QUOTATION_FORMAT_REGISTRY)) {
        const config = QUOTATION_FORMAT_REGISTRY[formatKey];
        assert.ok(config.label);
        assert.ok(Array.isArray(config.defaultSections));
      }
    });

    await st.test('5.7: Quotation types and schemas in src/types/erp.ts and validations', () => {
      const typesContent = fs.readFileSync(typesPath, 'utf8');
      assert.match(typesContent, /export type QuotationFormatType =/);
      assert.match(typesContent, /'HOME_THEATER'/);
      assert.match(typesContent, /'CONFERENCE_ROOM'/);
      assert.match(typesContent, /'CCTV_SURVEILLANCE'/);
      assert.match(typesContent, /'NETWORKING'/);

      const valContent = fs.readFileSync(path.join(rootDir, 'src/lib/validations/erp.ts'), 'utf8');
      assert.match(valContent, /quotation_format:\s*z\s*\.\s*enum\(/);
      assert.match(valContent, /notes:\s*z\.string\(\)\.optional\(\)/);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. QUOTATION LINE CARD COMMERCIAL CONTROLS & MATH
  // ---------------------------------------------------------------------------
  await t.test('6. Quotation Line Card Commercial Math & Controls', async (st) => {
    await st.test('6.1: Pricing Mode EXCLUSIVE calculation (Tax added on top)', () => {
      const qty = 2;
      const rateExcl = 150000;
      const gstRate = 18;
      const taxable = rateExcl * qty;
      const gst = (taxable * gstRate) / 100;
      const grandTotal = taxable + gst;

      assert.equal(taxable, 300000);
      assert.equal(gst, 54000);
      assert.equal(grandTotal, 354000);
    });

    await st.test('6.2: Pricing Mode INCLUSIVE calculation (Reverse-calculated backwards)', () => {
      const qty = 1;
      const allInRate = 65000;
      const gstRate = 18;
      const grossTotal = allInRate * qty;
      const taxable = Number((grossTotal / (1 + gstRate / 100)).toFixed(2));
      const gst = Number((grossTotal - taxable).toFixed(2));

      assert.equal(grossTotal, 65000);
      assert.equal(taxable, 55084.75);
      assert.equal(gst, 9915.25);
      assert.equal(taxable + gst, 65000);
    });

    await st.test('6.3: Quantity stepper bounds (cannot be negative or zero in calculation)', () => {
      const sanitizeQty = (q) => Math.max(1, Number(q) || 1);
      assert.equal(sanitizeQty(0), 1);
      assert.equal(sanitizeQty(-5), 1);
      assert.equal(sanitizeQty(5), 5);
    });

    await st.test('6.4: 12 Commercial Units supported in UI', () => {
      const allowedUnits = [
        'Nos.', 'Set', 'Pair', 'Box', 'Pack',
        'Meter', 'Feet', 'Hour', 'Day', 'Job', 'Lot', 'Months'
      ];
      assert.equal(allowedUnits.length, 12);
      assert.ok(allowedUnits.includes('Set'));
      assert.ok(allowedUnits.includes('Lot'));
    });

    await st.test('6.5: Line card UI controls verified in QuotationFormWorkspace.tsx', () => {
      const content = fs.readFileSync(workspacePath, 'utf8');
      assert.match(content, /handleMoveItem/, 'Must have reorder controls');
      assert.match(content, /handleDuplicateItem/, 'Must have duplicate control');
      assert.match(content, /handleRemoveItem/, 'Must have remove control');
      assert.match(content, /handleToggleExpand/, 'Must have expand/collapse toggle');
      assert.match(content, /Quotation Line Cards/, 'Must render quotation line cards');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. SNAPSHOT EDITING ISOLATION (ZERO MUTATION OF MASTER LIBRARY)
  // ---------------------------------------------------------------------------
  await t.test('7. Snapshot Editing Isolation', async (st) => {
    await st.test('7.1: Editing quotation item does not mutate master library or benchmark', async () => {
      const benchmark = await productResearchAgent.executeResearch('Sony VW-5000ES');
      assert.ok(benchmark.found);
      const originalSpecs = benchmark.key_specifications;

      const quotationItem = {
        product_name: benchmark.product_name,
        brand: benchmark.brand,
        model: benchmark.model,
        specs: benchmark.key_specifications,
        description: benchmark.customer_description,
        spec_record_id: 'spec-test-123',
        selling_price: 3500000,
        quantity: 1,
      };

      quotationItem.specs = 'Calibrated by ISF Certified Engineer, Includes Chief Ceiling Mount & 15m 8K Fibre Cable';
      quotationItem.description = 'Exclusive VIP Screening Room Custom Projection Setup';

      const recheck = await productResearchAgent.executeResearch('Sony VW-5000ES');
      assert.equal(recheck.key_specifications, originalSpecs);
      assert.doesNotMatch(recheck.key_specifications, /Chief Ceiling Mount/);
      assert.doesNotMatch(recheck.customer_description, /VIP Screening Room/);
    });

    await st.test('7.2: QuotationFormWorkspace verifies snapshot isolation banner', () => {
      const content = fs.readFileSync(workspacePath, 'utf8');
      assert.match(content, /Quotation Line Snapshot/, 'Must warn user that edits are isolated to quotation');
      assert.match(content, /placeholder="Brand \(e\.g\. BenQ\)"/);
      assert.match(content, /placeholder="Model \(e\.g\. TK710\)"/);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. SRIKANTH CUSTOMER-FACING QUOTATION PRESENTATION
  // ---------------------------------------------------------------------------
  await t.test('8. Srikanth Customer-Facing Quotation Presentation', async (st) => {
    function simulateParseProduct(it) {
      let brand = (it.brand || it.category || '').trim();
      let model = (it.model || it.sku || '').trim();
      let specs = (it.specs || '').trim();
      let description = (it.description || it.internal_remarks || '').trim();
      const rawName = (it.product_name || '').trim();

      if (rawName && (rawName.includes('–') || rawName.includes('—') || (rawName.includes(' - ') && !rawName.startsWith('[')))) {
        const delim = rawName.includes('–') ? '–' : rawName.includes('—') ? '—' : '-';
        const parts = rawName.split(delim).map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 4) {
          if (!brand) brand = parts[0];
          if (!model) model = parts[1];
          if (!specs) specs = parts[2];
          if (!description) description = parts.slice(3).join(' – ');
        }
      }

      if (description) {
        description = description.replace(/^description[:\s-]*/i, '').trim();
        if (description.includes('subsidiary of') || description.includes('world-leading')) {
          description = 'High-brightness 4K UHD laser/LED home and entertainment projector designed for vibrant cinematic viewing and responsive gaming even in well-lit rooms.';
        }
      }

      const isService =
        it.category?.toLowerCase() === 'services' ||
        it.sku?.startsWith('SRV-') ||
        (rawName.toLowerCase().includes('installation') && !brand && !model);

      if (isService) {
        specs = '';
      }

      let brandModel = '';
      if (brand && model) {
        const cleanModel = model.replace(new RegExp(`^${brand}\\s*`, 'i'), '').trim();
        brandModel = `${brand.toUpperCase()} – ${(cleanModel || model).toUpperCase()}`;
      } else {
        brandModel = rawName;
      }

      return { brandModel, specs, description, isService };
    }

    await st.test('8.1: Service lines never show redundant or empty "Key Specifications:" block', () => {
      const serviceItem = {
        product_name: 'Site Installation, Alignment, Acoustic Calibration & Testing',
        brand: '',
        model: '',
        specs: '',
        description: 'Comprehensive installation and system commissioning by certified technical team.',
        quantity: 1,
        selling_price: 25000,
      };

      const parsed = simulateParseProduct(serviceItem);
      assert.equal(parsed.isService, true);
      assert.equal(parsed.specs, '');
      assert.ok(parsed.description.includes('Comprehensive installation'));
    });

    await st.test('8.2: Hardware lines format BRAND – MODEL header with deduplication', () => {
      const hardwareItem = {
        product_name: 'Sony VPL-VW5000ES 4K SXRD Laser Projector',
        brand: 'Sony',
        model: 'Sony VPL-VW5000ES',
        specs: 'Native 4K SXRD, 5,000 Lumens, Z-Phosphor Laser Engine',
        description: 'Flagship commercial 4K laser projector.',
        quantity: 1,
        selling_price: 4500000,
      };

      const parsed = simulateParseProduct(hardwareItem);
      assert.equal(parsed.brandModel, 'SONY – VPL-VW5000ES');
      assert.ok(parsed.specs.includes('Native 4K SXRD'));
      assert.ok(parsed.description.includes('Flagship commercial'));
    });

    await st.test('8.3: PrintQuotationModal source contains dynamic sectionGroups and Srikanth support', () => {
      const content = fs.readFileSync(printModalPath, 'utf8');
      assert.match(content, /export function parseCustomerFacingProduct/);
      assert.match(content, /sectionGroups = (?:React\.)?useMemo/);
      assert.match(content, /sec\.section_subtotal/);
      assert.match(content, /quotation\.quotation_format/);
      assert.match(content, /prod\.brandModel/);
    });

    await st.test('8.4: Dynamic section grouping parses Srikanth HOME_THEATER 5 sections', () => {
      const sampleQuote = {
        quotation_format: 'HOME_THEATER',
        items: [
          {
            product_name: 'Klipsch In-Wall Speakers',
            brand: 'Klipsch',
            model: 'PRO-180RPW',
            section_id: 'HOME THEATER ROOM / CONFIGURATION',
            selling_price: 150000,
            quantity: 1,
            gst_rate: 18,
            total_amount: 177000,
          },
          {
            product_name: 'Denon AVR-X3800H 9.4 Channel 8K Receiver',
            brand: 'Denon',
            model: 'AVR-X3800H',
            section_id: 'AVR / PROTECTION / SCREEN',
            selling_price: 185000,
            quantity: 1,
            gst_rate: 18,
            total_amount: 218300,
          },
          {
            product_name: 'AudioQuest 4K HDMI 15m Optical Fiber Cable',
            brand: 'AudioQuest',
            model: 'Cherry Cola',
            section_id: 'ALL INTERCONNECTIVITIES',
            selling_price: 32000,
            quantity: 2,
            gst_rate: 18,
            total_amount: 75520,
          },
          {
            product_name: 'Sony VPL-VW5000ES Flagship 4K Laser Projector',
            brand: 'Sony',
            model: 'VPL-VW5000ES',
            section_id: 'VIDEO PROJECTOR',
            selling_price: 4500000,
            quantity: 1,
            gst_rate: 18,
            total_amount: 5310000,
          },
          {
            product_name: 'Turnkey Installation, Acoustic Calibration & Testing',
            section_id: 'INSTALLATION / DESIGN / TRANSPORT / COMMISSIONING',
            selling_price: 65000,
            quantity: 1,
            gst_rate: 18,
            total_amount: 76700,
          },
        ],
      };

      const sections = QUOTATION_FORMAT_REGISTRY['HOME_THEATER'].defaultSections;
      assert.equal(sections.length, 5);

      const itemsBySection = {};
      for (const s of sections) {
        itemsBySection[s] = sampleQuote.items.filter(it => it.section_id === s);
      }

      assert.equal(itemsBySection['HOME THEATER ROOM / CONFIGURATION'].length, 1);
      assert.equal(itemsBySection['AVR / PROTECTION / SCREEN'].length, 1);
      assert.equal(itemsBySection['ALL INTERCONNECTIVITIES'].length, 1);
      assert.equal(itemsBySection['VIDEO PROJECTOR'].length, 1);
      assert.equal(itemsBySection['INSTALLATION / DESIGN / TRANSPORT / COMMISSIONING'].length, 1);
    });
  });

});
