import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ICON TECH PRO ERP v7.1 — Wave 1 & Wave 2 Controlled Upgrades', () => {
  describe('1. Quotation Solution Bundles & Presets', () => {
    const SOLUTION_BUNDLES = [
      {
        id: 'bundle-smart-classroom',
        name: 'Smart Classroom Suite',
        description: 'Interactive touch display, ultra-short throw laser projector, motorized screen, and wall audio.',
        category: 'Education',
        items: [
          { sku: 'EP-4K-980', product_name: 'Epson 4K Laser Projector', quantity: 1, unit_price: 185000 },
          { sku: 'SCR-120-MOT', product_name: 'Motorized Projection Screen 120"', quantity: 1, unit_price: 35000 },
          { sku: 'AUD-WALL-PAIR', product_name: 'Active Wall Mount Speaker Pair 60W', quantity: 1, unit_price: 18500 },
          { sku: 'CBL-HDMI-15M', product_name: 'High-Speed 4K HDMI Optical Cable 15m', quantity: 2, unit_price: 4500 },
        ],
        total_bundle_price: 247500,
      },
      {
        id: 'bundle-boardroom-av',
        name: 'Executive Boardroom AV Package',
        description: 'Pan-Tilt-Zoom 4K camera, ceiling beamforming mic array, dual displays, and wireless presentation system.',
        category: 'Corporate',
        items: [
          { sku: 'CAM-PTZ-4K', product_name: 'Poly Studio 4K PTZ Camera', quantity: 1, unit_price: 225000 },
          { sku: 'MIC-CEIL-ARRAY', product_name: 'Shure Ceiling Array Microphone', quantity: 1, unit_price: 145000 },
          { sku: 'DSP-CORE-8', product_name: 'Q-SYS Audio DSP Processor', quantity: 1, unit_price: 175000 },
          { sku: 'WPR-BARCO-CX30', product_name: 'Barco ClickShare CX-30 Gen 2', quantity: 1, unit_price: 165000 },
        ],
        total_bundle_price: 710000,
      },
      {
        id: 'bundle-surveillance',
        name: 'Enterprise IP Surveillance Suite',
        description: '16-Channel 4K NVR, outdoor IR dome cameras, PoE switches, and surveillance hard drives.',
        category: 'Security',
        items: [
          { sku: 'NVR-16CH-4K', product_name: 'Hikvision 16-Channel 4K Network Video Recorder', quantity: 1, unit_price: 48000 },
          { sku: 'CAM-IP-DOME-5MP', product_name: 'Hikvision 5MP IP Dome IR Camera', quantity: 8, unit_price: 6500 },
          { sku: 'SW-POE-16P', product_name: 'Gigabit 16-Port Managed PoE+ Switch', quantity: 1, unit_price: 22000 },
          { sku: 'HDD-SURV-8TB', product_name: 'Seagate SkyHawk 8TB Surveillance HDD', quantity: 2, unit_price: 17500 },
        ],
        total_bundle_price: 157000,
      },
      {
        id: 'bundle-home-cinema',
        name: 'Dolby Atmos 7.2.4 Home Theater Suite',
        description: 'Native 4K projector, acoustically transparent curved screen, and 11-channel THX amplifier system.',
        category: 'Residential',
        items: [
          { sku: 'PROJ-JVC-DLA-NP5', product_name: 'JVC DLA-NP5 Native 4K D-ILA Projector', quantity: 1, unit_price: 650000 },
          { sku: 'SCR-150-CURV-AT', product_name: '150" 2.35:1 Acoustically Transparent Curved Screen', quantity: 1, unit_price: 125000 },
          { sku: 'AMP-DENON-X3800H', product_name: 'Denon AVR-X3800H 9.4 Channel 8K Receiver', quantity: 1, unit_price: 185000 },
          { sku: 'SPK-KLIPSCH-724', product_name: 'Klipsch Reference Premiere 7.2.4 Speaker Package', quantity: 1, unit_price: 420000 },
        ],
        total_bundle_price: 1380000,
      },
    ];

    it('validates pre-configured solution bundles with line item arithmetic', () => {
      assert.equal(SOLUTION_BUNDLES.length, 4);
      for (const bundle of SOLUTION_BUNDLES) {
        const computed = bundle.items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
        assert.equal(bundle.total_bundle_price, computed, `Bundle ${bundle.name} sum mismatch`);
      }
    });

    it('clones an existing quotation with new numbering and resets status to Draft', () => {
      const originalQuote = {
        id: 'quote-001',
        quotation_number: 'QT-26-0042',
        customer_name: 'Dr. Reddy Labs',
        company_name: 'Dr. Reddy Laboratories Ltd',
        status: 'Approved',
        line_items: [
          { product_name: 'Epson 4K Laser Projector', quantity: 2, unit_price: 185000 },
        ],
        grand_total: 436600,
        terms_and_conditions: 'Standard 1 year warranty.',
      };

      const clonedQuote = {
        ...originalQuote,
        id: 'quote-cloned-' + Date.now(),
        quotation_number: 'QT-26-0043',
        status: 'Draft', // Reset approval state
        created_at: new Date().toISOString(),
      };

      assert.notEqual(clonedQuote.id, originalQuote.id);
      assert.notEqual(clonedQuote.quotation_number, originalQuote.quotation_number);
      assert.equal(clonedQuote.status, 'Draft');
      assert.equal(clonedQuote.customer_name, originalQuote.customer_name);
      assert.equal(clonedQuote.line_items.length, originalQuote.line_items.length);
    });
  });

  describe('2. Customer Duplicate Detection Logic', () => {
    const existingCustomers = [
      { id: '1', phone: '9849012345', email: 'purchase@drreddys.com', gstin: '36AAACD1234F1Z5' },
      { id: '2', phone: '9849067890', email: 'director@tsts.telangana.gov.in', gstin: '36AAAGT5678B1Z2' },
    ];

    function checkDup(query, excludeId) {
      const cleanPhone = query.phone ? query.phone.replace(/\D/g, '').slice(-10) : null;
      const cleanEmail = query.email ? query.email.trim().toLowerCase() : null;
      const cleanGstin = query.gstin ? query.gstin.trim().toUpperCase() : null;

      for (const c of existingCustomers) {
        if (excludeId && c.id === excludeId) continue;
        if (cleanPhone && c.phone.slice(-10) === cleanPhone) return { duplicate: true, field: 'phone' };
        if (cleanEmail && c.email.toLowerCase() === cleanEmail) return { duplicate: true, field: 'email' };
        if (cleanGstin && c.gstin === cleanGstin) return { duplicate: true, field: 'gstin' };
      }
      return { duplicate: false };
    }

    it('flags duplicate phone numbers regardless of spacing and country code', () => {
      assert.equal(checkDup({ phone: '+91 98490-12345' }).duplicate, true);
      assert.equal(checkDup({ phone: '9849012345' }).field, 'phone');
    });

    it('flags duplicate corporate email addresses case-insensitively', () => {
      assert.equal(checkDup({ email: 'Purchase@DrReddys.com' }).duplicate, true);
      assert.equal(checkDup({ email: 'Purchase@DrReddys.com' }).field, 'email');
    });

    it('flags duplicate GSTIN numbers', () => {
      assert.equal(checkDup({ gstin: '36aaacd1234f1z5' }).duplicate, true);
      assert.equal(checkDup({ gstin: '36aaacd1234f1z5' }).field, 'gstin');
    });

    it('passes for genuinely new customer records', () => {
      assert.equal(checkDup({ phone: '9123456780', email: 'info@newcorp.in', gstin: '36AABCN9999P1Z8' }).duplicate, false);
    });
  });

  describe('3. Role + Add - Restrict Permission Model', () => {
    const roleBaseMatrix = {
      'Managing Director': { Quotations: { view: true, create: true, edit: true, delete: true, approve: true } },
      'BDM': { Quotations: { view: true, create: true, edit: true, delete: false, approve: false } },
      'Sales Executive': { Quotations: { view: true, create: true, edit: false, delete: false, approve: false } },
    };

    function resolvePermission(userRole, overrides, module, action) {
      if (userRole === 'Managing Director') return true;
      const override = overrides.find((o) => o.module === module && o.action === action);
      if (override !== undefined) {
        return override.granted;
      }
      return Boolean(roleBaseMatrix[userRole]?.[module]?.[action]);
    }

    it('defaults to base role permissions when no overrides exist', () => {
      assert.equal(resolvePermission('Sales Executive', [], 'Quotations', 'approve'), false);
      assert.equal(resolvePermission('BDM', [], 'Quotations', 'create'), true);
      assert.equal(resolvePermission('Managing Director', [], 'Quotations', 'approve'), true);
    });

    it('grants additional privilege via + ADD override', () => {
      const overrides = [{ module: 'Quotations', action: 'approve', granted: true }];
      const allowed = resolvePermission('Sales Executive', overrides, 'Quotations', 'approve');
      assert.equal(allowed, true, 'User granted approve override despite Sales Executive role');
    });

    it('denies specific privilege via - RESTRICT override', () => {
      const overrides = [{ module: 'Quotations', action: 'create', granted: false }];
      const allowed = resolvePermission('BDM', overrides, 'Quotations', 'create');
      assert.equal(allowed, false, 'User restricted from creating quotes despite BDM role');
    });
  });

  describe('4. Reverse Permission Lookup ("Who Has Access?")', () => {
    it('accurately compiles list of authorized roles for a given module', () => {
      const matrix = {
        'Managing Director': { Purchases: ['view', 'create', 'approve'] },
        'Admin / BDM': { Purchases: ['view', 'create', 'approve'] },
        'Accounts': { Purchases: ['view', 'create'] },
        'Sales Executive': { Purchases: [] },
      };

      const module = 'Purchases';
      const authorizedRoles = Object.entries(matrix)
        .filter(([_, mods]) => mods[module]?.length > 0)
        .map(([role, mods]) => ({ role, actions: mods[module] }));

      assert.equal(authorizedRoles.length, 3);
      assert.ok(authorizedRoles.some((r) => r.role === 'Managing Director'));
      assert.ok(authorizedRoles.some((r) => r.role === 'Accounts'));
      assert.equal(authorizedRoles.some((r) => r.role === 'Sales Executive'), false);
    });
  });

  describe('5. Custom Dropdown Manager & System Value Protection', () => {
    const dropdownOptions = [
      { id: '1', category: 'Customer Industry', label: 'Education', is_system: true, is_active: true },
      { id: '2', category: 'Customer Industry', label: 'Healthcare', is_system: true, is_active: true },
      { id: '3', category: 'Customer Industry', label: 'Aerospace', is_system: false, is_active: true },
    ];

    function toggleOption(id, active) {
      const opt = dropdownOptions.find((o) => o.id === id);
      if (!opt) return { success: false, error: 'Not found' };
      if (opt.is_system && !active) {
        return { success: false, error: 'System options cannot be deactivated' };
      }
      opt.is_active = active;
      return { success: true, option: opt };
    }

    it('protects core system dropdown values from accidental deactivation', () => {
      const res = toggleOption('1', false);
      assert.equal(res.success, false);
      assert.ok(res.error.includes('System options cannot be deactivated'));
    });

    it('allows toggling custom dropdown options freely', () => {
      const res = toggleOption('3', false);
      assert.equal(res.success, true);
      assert.equal(res.option.is_active, false);
    });
  });

  describe('6. Custom Field Registry Security & Key Sanitization', () => {
    function sanitizeFieldKey(rawKey) {
      const clean = (rawKey || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const reserved = ['id', 'status', 'created_at', '__proto__', 'constructor', 'prototype'];
      if (!clean || clean.length < 2 || clean.length > 40) return { valid: false, error: 'Invalid length' };
      if (reserved.includes(clean)) return { valid: false, error: 'Reserved identifier' };
      return { valid: true, cleanKey: clean };
    }

    it('rejects reserved SQL/JS properties and malformed keys', () => {
      assert.equal(sanitizeFieldKey('__proto__').valid, false);
      assert.equal(sanitizeFieldKey('status').valid, false);
      assert.equal(sanitizeFieldKey('a').valid, false);
    });

    it('sanitizes messy user keys into valid database attribute names', () => {
      const res = sanitizeFieldKey('GeM Tender Cart ID #1');
      assert.equal(res.valid, true);
      assert.equal(res.cleanKey, 'gem_tender_cart_id__1');
    });
  });
});
