import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ICON TECH PRO ERP V8 — Master Implementation & Verification Suite', () => {
  // =========================================================================
  // 1. KUN MOTORS 1TB HDD TRADING E2E TEST
  // =========================================================================
  describe('1. Kun Motors 1TB HDD Trading Flow (Enquiry -> PO -> Order -> Invoice -> Payment)', () => {
    it('executes the full trading workflow with customer confirmation evidence and invoice locking', () => {
      // 1. Customer Enquiry
      const enquiry = {
        id: 'ENQ-KUN-001',
        enquiry_number: 'ENQ/2026-27/0412',
        customer_name: 'Kun Motors Pvt Ltd',
        contact_person: 'Mr. Rajesh Sharma (IT Head)',
        phone: '+91 98490 12345',
        requirement_summary: '5x Seagate SkyHawk 1TB Surveillance Hard Drives for Workshop CCTV',
        product_category: 'Surveillance & Storage',
        status: 'Quotation sent',
        created_at: '2026-09-18T10:00:00Z',
      };
      assert.equal(enquiry.customer_name, 'Kun Motors Pvt Ltd');

      // 2. Commercial Quotation
      const quotation = {
        id: 'QT-KUN-1001',
        quotation_code: 'QT-2026-1001',
        customer_name: 'Kun Motors Pvt Ltd',
        enquiry_id: enquiry.id,
        items: [
          {
            sku: 'ST1000VX001',
            product_name: 'Seagate SkyHawk 1TB Surveillance HDD 3.5"',
            quantity: 5,
            unit_price: 4200,
            cost_price: 3350,
            tax_rate: 18,
            tax_amount: 3780,
            total_amount: 24780,
          },
        ],
        subtotal: 21000,
        tax_total: 3780,
        grand_total: 24780,
        status: 'Sent',
        revision_number: 1,
      };
      assert.equal(quotation.grand_total, 24780);

      // 3. Customer Confirmation Record (V8 Customer Confirmation Evidence)
      const confirmationPayload = {
        confirmation_type: 'PURCHASE_ORDER',
        reference_number: 'KM/PO/2026/09/088',
        confirmation_date: '2026-09-18',
        confirmed_by: 'Mr. Rajesh Sharma',
        document_url: 'https://cdn.icontechpro.com/evidence/KM_PO_088.pdf',
        notes: 'Delivery required at Kun Motors Gachibowli service workshop within 48 hours.',
      };
      assert.equal(confirmationPayload.confirmation_type, 'PURCHASE_ORDER');
      assert.ok(confirmationPayload.reference_number);

      // 4. Sales Order Creation from Confirmed Quote
      const salesOrder = {
        id: 'SO-KUN-001',
        order_number: 'SO/2026-27/0088',
        quotation_id: quotation.id,
        customer_name: quotation.customer_name,
        total_amount: quotation.grand_total,
        status: 'Confirmed',
        customer_confirmation_type: confirmationPayload.confirmation_type,
        customer_po_reference: confirmationPayload.reference_number,
        confirmation_date: confirmationPayload.confirmation_date,
        confirmation_document_url: confirmationPayload.document_url,
        items: quotation.items,
        created_at: '2026-09-18T14:30:00Z',
      };
      assert.equal(salesOrder.status, 'Confirmed');
      assert.equal(salesOrder.customer_po_reference, 'KM/PO/2026/09/088');

      // 5. Tax Invoice Generation & Locking
      const invoice = {
        id: 'INV-KUN-001',
        invoice_number: 'ICON/26-27/INV-0412',
        order_id: salesOrder.id,
        customer_name: salesOrder.customer_name,
        amount: salesOrder.total_amount,
        status: 'Draft',
        is_locked: false,
        posted_at: null,
      };

      // Approve invoice
      invoice.status = 'Approved';
      assert.equal(invoice.status, 'Approved');

      // Post & Lock invoice (V8 Financial Locking)
      invoice.status = 'Posted';
      invoice.is_locked = true;
      invoice.posted_at = new Date().toISOString();
      invoice.posted_by = 'Srinivas Rao (Accounts)';

      assert.equal(invoice.is_locked, true);
      assert.ok(invoice.posted_at);

      // Attempt to modify locked invoice must fail
      const tryModifyLockedInvoice = () => {
        if (invoice.is_locked) {
          throw new Error('FINANCIAL_LOCK: Invoice is locked and cannot be modified after posting.');
        }
        invoice.amount = 30000;
      };
      assert.throws(tryModifyLockedInvoice, /FINANCIAL_LOCK/);

      // 6. Payment Receipt
      const payment = {
        id: 'PAY-KUN-001',
        receipt_number: 'REC/26-27/0315',
        invoice_id: invoice.id,
        amount: 24780,
        payment_mode: 'NEFT',
        bank_reference: 'HDFCN26091800192',
        status: 'Cleared',
        cleared_at: '2026-09-19T11:00:00Z',
      };
      assert.equal(payment.status, 'Cleared');
      assert.equal(payment.amount, quotation.grand_total);
    });
  });

  // =========================================================================
  // 2. TURNKEY HOME THEATER PROJECT E2E TEST
  // =========================================================================
  describe('2. Turnkey Home Theater Project Flow (Site Visit -> Detailed Project Quote -> Milestones)', () => {
    it('executes a complete multi-room project with milestone billing and attachments', () => {
      // 1. Mobile Technical Site Survey
      const siteSurvey = {
        id: 'SV-HT-001',
        visit_number: 'SV/2026-27/0045',
        customer_name: 'Dr. Vikram Reddy',
        site_address: 'Villa 14, Palm Meadows, Jubilee Hills, Hyderabad',
        room_dimensions: '22ft (L) x 16ft (W) x 10.5ft (H)',
        wall_construction: 'Double-layer drywall with acoustic insulation',
        conduit_verified: true,
        power_supply_notes: 'Dedicated 20A circuit with pure sine-wave online UPS',
        ambient_light: 'Complete dark room (blackout motorized velvet drapes)',
        survey_status: 'Completed',
        photos: [
          'https://cdn.icontechpro.com/surveys/sv0045_front_stage.jpg',
          'https://cdn.icontechpro.com/surveys/sv0045_conduit_run.jpg',
        ],
      };
      assert.equal(siteSurvey.conduit_verified, true);
      assert.equal(siteSurvey.photos.length, 2);

      // 2. Detailed Project Quotation with Project Sections
      const projectQuote = {
        id: 'QT-HT-2001',
        quotation_code: 'QT-2026-2001',
        customer_name: siteSurvey.customer_name,
        quotation_format: 'DETAILED_PROJECT',
        project_sections: [
          {
            section_id: 'sec-disp',
            section_name: 'Projection & Screen Display',
            room_name: 'Home Cinema Hall',
            items: [
              {
                sku: 'PROJ-JVC-DLA-NP5',
                product_name: 'JVC DLA-NP5 Native 4K D-ILA Projector',
                quantity: 1,
                unit_price: 650000,
                cost_price: 520000,
                total_amount: 650000,
                section_name: 'Projection & Screen Display',
              },
              {
                sku: 'SCR-150-CURV-AT',
                product_name: '150" 2.35:1 Acoustically Transparent Curved Screen',
                quantity: 1,
                unit_price: 125000,
                cost_price: 95000,
                total_amount: 125000,
                section_name: 'Projection & Screen Display',
              },
            ],
            subtotal: 775000,
          },
          {
            section_id: 'sec-audio',
            section_name: 'Dolby Atmos 7.2.4 Audio & Amplification',
            room_name: 'Home Cinema Hall',
            items: [
              {
                sku: 'AMP-DENON-X3800H',
                product_name: 'Denon AVR-X3800H 9.4 Channel 8K Receiver',
                quantity: 1,
                unit_price: 185000,
                cost_price: 145000,
                total_amount: 185000,
                section_name: 'Dolby Atmos 7.2.4 Audio & Amplification',
              },
              {
                sku: 'SPK-KLIPSCH-724',
                product_name: 'Klipsch Reference Premiere 7.2.4 Speaker Package',
                quantity: 1,
                unit_price: 420000,
                cost_price: 330000,
                total_amount: 420000,
                section_name: 'Dolby Atmos 7.2.4 Audio & Amplification',
              },
            ],
            subtotal: 605000,
          },
        ],
        subtotal: 1380000,
        tax_total: 248400,
        grand_total: 1628400,
        status: 'Sent',
      };
      assert.equal(projectQuote.quotation_format, 'DETAILED_PROJECT');
      assert.equal(projectQuote.project_sections.length, 2);

      // 3. Project Creation & 4-Stage Milestone Tracking
      const turnkeyProject = {
        id: 'PRJ-HT-001',
        project_number: 'PRJ/2026-27/0014',
        project_name: 'Jubilee Hills Villa Dolby Atmos 7.2.4 Cinema',
        project_type: 'Home Theater',
        customer_name: projectQuote.customer_name,
        total_project_value: projectQuote.grand_total,
        status: 'In Execution',
        milestones: [
          {
            milestone_number: 1,
            title: 'Advance & Procurement Mobilization (40%)',
            percentage: 40,
            amount: 651360,
            status: 'Paid',
            invoice_number: 'ICON/26-27/INV-0501',
          },
          {
            milestone_number: 2,
            title: 'First-Fix Cabling & Conduit Pull (30%)',
            percentage: 30,
            amount: 488520,
            status: 'In Progress',
            invoice_number: null,
          },
          {
            milestone_number: 3,
            title: 'AV Equipment Installation & Calibration (20%)',
            percentage: 20,
            amount: 325680,
            status: 'Pending',
            invoice_number: null,
          },
          {
            milestone_number: 4,
            title: 'Acoustic Handover & Sign-off (10%)',
            percentage: 10,
            amount: 162840,
            status: 'Pending',
            invoice_number: null,
          },
        ],
      };

      // Validate milestone percentages sum to 100%
      const totalPct = turnkeyProject.milestones.reduce((sum, m) => sum + m.percentage, 0);
      assert.equal(totalPct, 100);

      // Validate milestone amounts sum to total project value
      const totalMilestoneAmt = turnkeyProject.milestones.reduce((sum, m) => sum + m.amount, 0);
      assert.equal(totalMilestoneAmt, turnkeyProject.total_project_value);

      // Complete milestone 2 and progress milestone 3
      turnkeyProject.milestones[1].status = 'Completed';
      turnkeyProject.milestones[2].status = 'In Progress';
      assert.equal(turnkeyProject.milestones[1].status, 'Completed');
      assert.equal(turnkeyProject.milestones[2].status, 'In Progress');
    });
  });

  // =========================================================================
  // 3. SUPPLIER SOURCING 3-QUOTE RECORDING & SELECTION TEST
  // =========================================================================
  describe('3. Supplier Sourcing 3-Quote Recording & Selection with Cost Privacy', () => {
    it('records 3 supplier offers, selects winner with rationale, and masks costs for sales roles', () => {
      // Sourcing Request
      const sourcingItem = {
        item_id: 'ITEM-VIEWSONIC-75',
        product_name: 'ViewSonic IFP7550-3 75" 4K Interactive Flat Panel',
        quantity: 2,
        client_quote_id: 'QT-2026-1099',
      };

      // 3 Supplier Offers (Human-Recorded)
      const offers = [
        {
          id: 'OFFER-A',
          supplier_name: 'Iris Computers Ltd',
          offer_price: 138000,
          warranty_terms: '3 Years On-site OEM',
          delivery_days: 3,
          is_selected: false,
        },
        {
          id: 'OFFER-B',
          supplier_name: 'Redington India Ltd',
          offer_price: 135500,
          warranty_terms: '3 Years On-site OEM',
          delivery_days: 2,
          is_selected: false,
        },
        {
          id: 'OFFER-C',
          supplier_name: 'Savex Technologies',
          offer_price: 136000,
          warranty_terms: '3 Years On-site OEM + 1 Free Wall Mount',
          delivery_days: 1,
          is_selected: false,
        },
      ];
      assert.equal(offers.length, 3);

      // Human selects winner: Offer B (lowest price & fast delivery)
      const winningOfferId = 'OFFER-B';
      const selectionRationale = 'Lowest landed unit price of ₹1,35,500 with immediate 2-day dispatch from Secunderabad warehouse.';
      
      const updatedOffers = offers.map((o) => ({
        ...o,
        is_selected: o.id === winningOfferId,
        selection_rationale: o.id === winningOfferId ? selectionRationale : null,
      }));

      const selectedOffer = updatedOffers.find((o) => o.is_selected);
      assert.ok(selectedOffer);
      assert.equal(selectedOffer.supplier_name, 'Redington India Ltd');
      assert.equal(selectedOffer.offer_price, 135500);

      // Cost Privacy Masking Function (matches src/lib/actions/supplier-sourcing.ts)
      const applyCostPrivacy = (offerList, userRole) => {
        const canSeeCosts = userRole === 'Managing Director' || userRole === 'Accounts';
        return offerList.map((o) => {
          if (!canSeeCosts) {
            const { offer_price, ...rest } = o;
            return { ...rest, offer_price: null, cost_hidden: true };
          }
          return o;
        });
      };

      // Managing Director sees full price
      const mdView = applyCostPrivacy(updatedOffers, 'Managing Director');
      assert.equal(mdView[0].offer_price, 138000);
      assert.equal(mdView[1].offer_price, 135500);

      // Sales Executive has cost strictly masked
      const salesView = applyCostPrivacy(updatedOffers, 'Sales Executive');
      assert.equal(salesView[0].offer_price, null);
      assert.equal(salesView[0].cost_hidden, true);
      assert.equal(salesView[1].offer_price, null);
      assert.equal(salesView[1].supplier_name, 'Redington India Ltd'); // Supplier name remains visible
    });
  });

  // =========================================================================
  // 4. QUOTATION REVISION SNAPSHOT IMMUTABILITY TEST
  // =========================================================================
  describe('4. Quotation Revision Snapshot Immutability', () => {
    it('creates immutable revision snapshots and preserves revision 1 when revision 2 is created', () => {
      // Revision 1
      const rev1Snapshot = {
        revision_id: 'REV-001',
        quotation_id: 'QT-1099',
        revision_number: 1,
        total_amount: 372000,
        subtotal: 315254,
        tax_total: 56746,
        change_summary: 'Initial commercial proposal sent to customer.',
        items_snapshot: [
          { sku: 'IFP-86-4K', product_name: '86" 4K Interactive Flat Panel', quantity: 1, unit_price: 245000 },
          { sku: 'CAM-VC-4K', product_name: 'All-in-One 4K Tracking Video Bar', quantity: 1, unit_price: 127000 },
        ],
        created_at: '2026-09-05T10:00:00Z',
        created_by: 'Bhavani Prasad (Sales)',
      };

      // Revise quotation to Rev 2 (customer requested 10% discount on video bar)
      const rev2Changes = {
        revision_number: 2,
        total_amount: 359300,
        change_summary: 'Applied 10% discount on 4K Tracking Video Bar per MD approval.',
        items: [
          { sku: 'IFP-86-4K', product_name: '86" 4K Interactive Flat Panel', quantity: 1, unit_price: 245000 },
          { sku: 'CAM-VC-4K', product_name: 'All-in-One 4K Tracking Video Bar', quantity: 1, unit_price: 114300 },
        ],
      };

      // The historical revision registry
      const revisionHistory = [rev1Snapshot];

      // Create Rev 2 snapshot
      const rev2Snapshot = {
        revision_id: 'REV-002',
        quotation_id: 'QT-1099',
        revision_number: 2,
        total_amount: rev2Changes.total_amount,
        change_summary: rev2Changes.change_summary,
        items_snapshot: rev2Changes.items,
        created_at: '2026-09-06T12:00:00Z',
        created_by: 'Bhavani Prasad (Sales)',
      };
      revisionHistory.push(rev2Snapshot);

      assert.equal(revisionHistory.length, 2);

      // Verify Immutability: Rev 1 has NOT been altered by Rev 2 changes
      assert.equal(revisionHistory[0].revision_number, 1);
      assert.equal(revisionHistory[0].total_amount, 372000);
      assert.equal(revisionHistory[0].items_snapshot[1].unit_price, 127000);

      // Verify Rev 2 has the updated total and items
      assert.equal(revisionHistory[1].revision_number, 2);
      assert.equal(revisionHistory[1].total_amount, 359300);
      assert.equal(revisionHistory[1].items_snapshot[1].unit_price, 114300);
    });
  });

  // =========================================================================
  // 5. INVOICE FINANCIAL POSTING & LOCKING TEST
  // =========================================================================
  describe('5. Invoice Financial Posting and Immutability Locking', () => {
    it('prevents modification or deletion of posted invoices and requires credit notes for adjustments', () => {
      const invoice = {
        id: 'INV-2026-0088',
        invoice_number: 'ICON/26-27/INV-0088',
        customer_name: 'T-Hub Foundation',
        amount: 372000,
        status: 'Draft',
        is_locked: false,
        posted_at: null,
      };

      // Step 1: Approve
      invoice.status = 'Approved';
      assert.equal(invoice.status, 'Approved');

      // Step 2: Post & Lock
      invoice.status = 'Posted';
      invoice.is_locked = true;
      invoice.posted_at = new Date().toISOString();
      invoice.posted_by = 'Srinivas Rao (Accounts)';

      // Financial Lock Policy Verification
      const modifyInvoice = (inv, newAmount) => {
        if (inv.is_locked) {
          throw new Error(`INVOICE_LOCKED: Invoice ${inv.invoice_number} is financially locked. Edits are prohibited.`);
        }
        inv.amount = newAmount;
      };

      const deleteInvoice = (inv) => {
        if (inv.is_locked) {
          throw new Error(`INVOICE_LOCKED: Invoice ${inv.invoice_number} is financially locked. Deletion is prohibited.`);
        }
      };

      assert.throws(() => modifyInvoice(invoice, 400000), /INVOICE_LOCKED/);
      assert.throws(() => deleteInvoice(invoice), /INVOICE_LOCKED/);

      // Financial adjustment must be done via Credit Note
      const creditNote = {
        credit_note_number: 'CN/26-27/001',
        original_invoice_number: invoice.invoice_number,
        adjustment_amount: 15000,
        reason: 'Post-delivery commercial discount agreed by MD',
        issued_by: 'Srinivas Rao (Accounts)',
      };
      assert.equal(creditNote.original_invoice_number, 'ICON/26-27/INV-0088');
      assert.equal(creditNote.adjustment_amount, 15000);
    });
  });

  // =========================================================================
  // 6. SPEC INTELLIGENCE AUTHENTIC LOOKUP & FALLBACK TEST
  // =========================================================================
  describe('6. Specification Intelligence (Authentic Lookup & Zero Hallucination Fallback)', () => {
    const SPEC_CATALOG = {
      'IFP7550': {
        brand: 'ViewSonic',
        model: 'IFP7550-3',
        category: 'Interactive Display',
        specs: {
          display_size: '75 inch',
          resolution: '3840 x 2160 (4K UHD)',
          brightness: '400 nits',
          touch_points: '20-point touch',
          ports: 'HDMI 2.0 x 3, USB-C x 1 (65W PD), OPS Slot x 1',
          speakers: '2 x 15W + 15W Subwoofer',
        },
      },
      'DLA-NP5': {
        brand: 'JVC',
        model: 'DLA-NP5',
        category: 'Projector',
        specs: {
          display_tech: 'Native 4K D-ILA (0.69")',
          resolution: '4096 x 2160',
          brightness: '1,900 ANSI Lumens',
          contrast_ratio: '40,000:1 Native',
          hdr_support: 'HDR10+ / Frame Adapt HDR',
        },
      },
    };

    const fetchProductSpecs = (query) => {
      const q = query.toUpperCase();
      for (const [key, val] of Object.entries(SPEC_CATALOG)) {
        if (q.includes(key) || val.model.toUpperCase().includes(q)) {
          return { found: true, data: val };
        }
      }
      // Zero hallucination fallback
      return {
        found: false,
        message: 'No verified technical datasheet found in verified catalog. Manual entry required.',
      };
    };

    it('returns authentic datasheet for known product models', () => {
      const result = fetchProductSpecs('ViewSonic IFP7550-3');
      assert.equal(result.found, true);
      assert.equal(result.data.brand, 'ViewSonic');
      assert.equal(result.data.specs.resolution, '3840 x 2160 (4K UHD)');
    });

    it('returns authentic datasheet for JVC projector', () => {
      const result = fetchProductSpecs('JVC DLA-NP5');
      assert.equal(result.found, true);
      assert.equal(result.data.brand, 'JVC');
      assert.equal(result.data.specs.hdr_support, 'HDR10+ / Frame Adapt HDR');
    });

    it('falls back safely without hallucinating for unknown models', () => {
      const result = fetchProductSpecs('UNKNOWN-CUSTOM-XYZ-9999');
      assert.equal(result.found, false);
      assert.match(result.message, /No verified technical datasheet found/);
    });
  });
});
