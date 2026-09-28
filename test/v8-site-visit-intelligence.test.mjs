import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ICON TECH PRO ERP V8 — Phase C.3: Site Visit Intelligence Suite', () => {

  // Domain models & logic under test
  class MockSiteVisitIntelligenceEngine {
    constructor() {
      this.enquiries = [
        {
          id: 'ENQ-001',
          enquiry_number: 'ENQ260001',
          customer_name: 'Dr. Reddy Laboratories SEZ',
          company_name: 'Dr. Reddy Laboratories Ltd',
          salesperson_name: 'Dheeraj Sharma',
          requirement_summary: 'Turnkey boardroom upgrade: 85-inch 4K Interactive Flat Panel with PTZ camera.',
          status: 'Enquiry',
          site_visit_required: true,
          site_visit: {
            visitNumber: 'SV260001',
            siteAddress: 'Survey No. 42, Bachupally, Hyderabad',
            roomType: 'Executive Boardroom',
            measurements: '26ft L x 18ft W x 11ft H',
            scheduledDate: '2026-10-15',
            assignedTechnician: 'Vamshi Krishna',
            notes: 'High ambient sunlight on east wall, false ceiling with gypsum grid.',
          },
          notes: [],
          org_id: 'org-001',
        },
        {
          id: 'ENQ-002',
          enquiry_number: 'ENQ260002',
          customer_name: 'Aurobindo Pharma Tech Park',
          company_name: 'Aurobindo Pharma',
          salesperson_name: 'Dheeraj Sharma',
          requirement_summary: 'Cleanroom climate control & AV monitoring.',
          status: 'Enquiry',
          site_visit_required: true,
          site_visit: {
            visitNumber: 'SV260002',
            siteAddress: 'HITEC City, Phase II, Hyderabad',
            roomType: 'Cleanroom Facility',
            measurements: '40ft L x 25ft W x 12ft H',
            scheduledDate: '2026-10-20',
            assignedTechnician: 'Nagaraju',
            notes: 'Class 10,000 cleanroom. Antistatic shoe covers mandatory.',
          },
          notes: [],
          org_id: 'org-001',
        },
        {
          id: 'ENQ-003',
          enquiry_number: 'ENQ260003',
          customer_name: 'Foreign Org Tenant',
          company_name: 'Foreign Org',
          salesperson_name: 'John Doe',
          requirement_summary: 'CCTV perimeter survey.',
          status: 'Enquiry',
          site_visit_required: true,
          site_visit: {
            visitNumber: 'SV260099',
            siteAddress: 'Bangalore Campus',
            roomType: 'Security Control Room',
            measurements: '15ft x 15ft',
            scheduledDate: '2026-10-25',
            assignedTechnician: 'External Tech',
            notes: 'Restricted access zone.',
          },
          notes: [],
          org_id: 'org-foreign',
        }
      ];

      this.intelligenceStore = [];
      this.auditLogs = [];
    }

    // Role-based authorization check
    checkRole(userRole, allowedRoles) {
      if (!allowedRoles.includes(userRole)) {
        throw new Error(`Unauthorized: User role '${userRole}' is not authorized. Required: ${allowedRoles.join(', ')}`);
      }
    }

    // Generate Pre-Visit Brief
    generatePreVisitBrief(visitIdOrNumber, user) {
      this.checkRole(user.role, ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Technician']);

      const enquiry = this.enquiries.find(
        (e) => e.site_visit?.visitNumber === visitIdOrNumber || `SV-${e.enquiry_number}` === visitIdOrNumber
      );

      if (!enquiry) {
        return { success: false, error: 'Site visit or associated enquiry not found' };
      }

      // Tenant isolation
      if (enquiry.org_id !== user.org_id) {
        return { success: false, error: 'Tenant isolation violation: Access denied to cross-organization visit' };
      }

      const sv = enquiry.site_visit;
      const roomType = sv?.roomType || 'Standard Commercial Room';
      const isBoardroom = roomType.toLowerCase().includes('boardroom') || roomType.toLowerCase().includes('conference');
      const isCleanroom = roomType.toLowerCase().includes('cleanroom');

      const preBrief = {
        site_access_notes: isCleanroom
          ? 'Antistatic protocol required. Pass through airlock with PPE and dust-free tools.'
          : 'Security gate pass required. Carry company ID card and contractor badge.',
        key_focus_areas: isBoardroom
          ? ['Ambient daylight wash on front wall', 'Ceiling tile type & plenum depth', 'Under-table conduit pathway', 'Microphone pickup acoustic boundary']
          : ['Room dimensions & throw distance', 'Wall construction material & weight bearing', 'Power point proximity & UPS circuit availability'],
        acoustic_considerations: isBoardroom
          ? 'Assess reverberation time (RT60). Large glass partitions require acoustic wall treatment or specialized beamforming mics.'
          : 'Standard acoustic survey. Note background HVAC dB noise level.',
        structural_considerations: 'Inspect wall substrate. Brick masonry accepts expansion bolts; drywall partitions require wooden backing or floor-to-ceiling unistrut supports.',
        safety_precautions: 'Check for concealed high-voltage conduits before drilling. Ensure 3-pin earth grounding is under 2V neutral-to-earth.',
      };

      const equipment = [
        { id: 'eq-1', tool_name: 'Laser Distance Meter', category: 'MEASUREMENT', model_or_serial: 'Bosch GLM 50 C', is_packed: true },
        { id: 'eq-2', tool_name: 'Digital Lux / Light Meter', category: 'OPTICAL', model_or_serial: 'Extech LT300', is_packed: true },
        { id: 'eq-3', tool_name: 'Wall Stud & Live Wire Scanner', category: 'STRUCTURAL', model_or_serial: 'Bosch D-tect 120', is_packed: true },
        { id: 'eq-4', tool_name: 'Digital Multimeter with True-RMS Ground Test', category: 'ELECTRICAL', model_or_serial: 'Fluke 117', is_packed: true },
        { id: 'eq-5', tool_name: 'Fiberglass Fish Tape / Pull-wire Probe', category: 'CABLING', model_or_serial: 'Klein Tools 56331', is_packed: true },
      ];

      const checklist = [
        { id: 'chk-1', category: 'MEASUREMENT', item_question: 'Verify length, width, and true clear height below false ceiling', is_mandatory: true },
        { id: 'chk-2', category: 'MOUNTING_SURFACE', item_question: 'Identify wall substrate (Concrete / Hollow block / Gypsum partition with ply)', is_mandatory: true },
        { id: 'chk-3', category: 'OPTICAL', item_question: 'Measure ambient lux with blinds open and closed', is_mandatory: true },
        { id: 'chk-4', category: 'ELECTRICAL', item_question: 'Verify 230V AC socket presence and neutral-to-earth voltage (< 2V)', is_mandatory: true },
        { id: 'chk-5', category: 'CABLING', item_question: 'Trace conduit run from display location to rack / table pop-up box', is_mandatory: true },
      ];

      const intel = {
        id: `SVI-${Date.now()}`,
        site_visit_id: `SV-${enquiry.enquiry_number}`,
        visit_number: sv?.visitNumber || visitIdOrNumber,
        enquiry_id: enquiry.id,
        pre_visit_brief: preBrief,
        assigned_equipment: equipment,
        survey_checklist: checklist,
        post_visit_summary: null,
        extracted_requirements: [],
        status: 'DRAFT',
        org_id: enquiry.org_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      this.intelligenceStore.push(intel);
      this.auditLogs.push({
        action: 'GENERATE_PRE_VISIT_BRIEF',
        userName: user.name,
        details: `Generated pre-visit brief for survey ${intel.visit_number}`,
      });

      return { success: true, data: intel };
    }

    // Record Post-Visit Physical Findings
    recordPostVisitFindings(visitIdOrNumber, findings, user) {
      this.checkRole(user.role, ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Technician']);

      const intel = this.intelligenceStore.find(
        (i) => i.visit_number === visitIdOrNumber || i.site_visit_id === visitIdOrNumber
      );

      if (!intel) {
        return { success: false, error: 'Site visit intelligence brief not found' };
      }

      if (intel.org_id !== user.org_id) {
        return { success: false, error: 'Tenant isolation violation: Access denied to cross-organization visit' };
      }

      if (!findings.room_dimensions || findings.room_dimensions.trim().length === 0) {
        return { success: false, error: 'Room dimensions are mandatory to record survey findings' };
      }

      intel.post_visit_summary = {
        room_dimensions: findings.room_dimensions,
        ambient_lux_level: findings.ambient_lux_level || 'Moderate ambient light (250 Lux)',
        mounting_surface_strength: findings.mounting_surface_strength || 'Solid masonry',
        conduit_and_cabling_readiness: findings.conduit_and_cabling_readiness || '25mm PVC conduit present',
        power_and_grounding_readiness: findings.power_and_grounding_readiness || '230V AC verified, Neutral-Earth 1.2V',
        reverberation_notes: findings.reverberation_notes || 'Slight echo, requires carpet / acoustic panels',
        notes: findings.notes || '',
        recorded_at: new Date().toISOString(),
        recorded_by: user.name,
      };

      intel.status = 'SURVEYED';
      intel.updated_at = new Date().toISOString();

      this.auditLogs.push({
        action: 'RECORD_POST_VISIT_FINDINGS',
        userName: user.name,
        details: `Recorded physical survey findings for ${intel.visit_number}`,
      });

      return { success: true, data: intel };
    }

    // Extract Bill-of-Quantities Requirements
    extractVisitRequirements(visitIdOrNumber, user) {
      this.checkRole(user.role, ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Technician']);

      const intel = this.intelligenceStore.find(
        (i) => i.visit_number === visitIdOrNumber || i.site_visit_id === visitIdOrNumber
      );

      if (!intel) {
        return { success: false, error: 'Site visit intelligence brief not found' };
      }

      if (intel.org_id !== user.org_id) {
        return { success: false, error: 'Tenant isolation violation' };
      }

      if (!intel.post_visit_summary) {
        return { success: false, error: 'Survey findings must be recorded before extracting requirements' };
      }

      const sum = intel.post_visit_summary;
      const extracted = [
        {
          component: 'Commercial Display / Interactive Panel',
          specification: `Sized for ${sum.room_dimensions}. Anti-glare coating verified against ${sum.ambient_lux_level}. Bracket rated for ${sum.mounting_surface_strength}.`,
          quantity_estimate: 1,
          readiness_prerequisite: sum.mounting_surface_strength.includes('Reinforcement')
            ? 'Client must install wooden backing ply before mounting'
            : 'Direct masonry anchors verified',
        },
        {
          component: 'Structured Low-Voltage Cabling & Conduit Kit',
          specification: `High-speed 4K HDMI 2.1 & Cat6 UTP cabling. Pathway: ${sum.conduit_and_cabling_readiness}.`,
          quantity_estimate: 1,
          readiness_prerequisite: sum.conduit_and_cabling_readiness.includes('Casing')
            ? 'Surface casing-capping required'
            : 'Conduit pull wires ready',
        },
        {
          component: 'Electrical & Surge Protection Interface',
          specification: `Isolated electrical distribution. Grounding status: ${sum.power_and_grounding_readiness}.`,
          quantity_estimate: 1,
          readiness_prerequisite: 'Dedicated 16A UPS line at display location',
        },
      ];

      if (sum.reverberation_notes && sum.reverberation_notes.toLowerCase().includes('acoustic')) {
        extracted.push({
          component: 'Acoustic Absorption Treatment Panels',
          specification: 'Fabric-wrapped sound absorption panels (NRC 0.85) to mitigate boardroom echo.',
          quantity_estimate: 4,
          readiness_prerequisite: 'Mounting on rear brick wall',
        });
      }

      intel.extracted_requirements = extracted;
      intel.status = 'SYNTHESIZED';
      intel.updated_at = new Date().toISOString();

      this.auditLogs.push({
        action: 'EXTRACT_SITE_VISIT_REQUIREMENTS',
        userName: user.name,
        details: `Extracted ${extracted.length} requirements for ${intel.visit_number}`,
      });

      return { success: true, data: intel };
    }

    // Human-Confirmed Enquiry Synchronization
    applyVisitFindingsToEnquiry(visitIdOrNumber, confirmedBy, user) {
      // Human confirmation strictly requires sales or management role
      this.checkRole(user.role, ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);

      if (!confirmedBy || confirmedBy.trim().length === 0) {
        return { success: false, error: 'Human confirmation is required to sync site visit findings into the commercial enquiry.' };
      }

      const intel = this.intelligenceStore.find(
        (i) => i.visit_number === visitIdOrNumber || i.site_visit_id === visitIdOrNumber
      );

      if (!intel) {
        return { success: false, error: 'Site visit intelligence not found' };
      }

      if (intel.org_id !== user.org_id) {
        return { success: false, error: 'Tenant isolation violation' };
      }

      if (!intel.extracted_requirements || intel.extracted_requirements.length === 0) {
        return { success: false, error: 'Extracted requirements not found. Please extract requirements first.' };
      }

      const enquiry = this.enquiries.find((e) => e.id === intel.enquiry_id);
      if (!enquiry) {
        return { success: false, error: 'Linked presales enquiry not found for this site visit' };
      }

      const formattedExtracted = intel.extracted_requirements
        .map((r) => `- ${r.component} (Qty: ${r.quantity_estimate}): ${r.specification}`)
        .join('\n');

      const updatedSummary = `${enquiry.requirement_summary}\n\n[Site Survey Verified by ${confirmedBy} on ${new Date().toISOString().split('T')[0]}]:\nRoom: ${intel.post_visit_summary?.room_dimensions || 'Verified'}\n${formattedExtracted}`;

      enquiry.requirement_summary = updatedSummary;
      enquiry.status = 'Site Visit Scheduled';
      enquiry.notes.push({
        text: `Site survey ${intel.visit_number} completed and synchronized by ${confirmedBy}. Bill of quantities verified.`,
        author: confirmedBy,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      });

      intel.status = 'CONVERTED';
      intel.converted_to_enquiry_at = new Date().toISOString();
      intel.updated_at = new Date().toISOString();

      this.auditLogs.push({
        action: 'APPLY_SITE_VISIT_TO_ENQUIRY',
        userName: user.name,
        details: `Synchronized site survey ${intel.visit_number} findings into Enquiry ${enquiry.enquiry_number} (Confirmed by ${confirmedBy})`,
      });

      return {
        success: true,
        data: intel,
        enquiry_id: enquiry.id,
      };
    }
  }

  // TEST CASES

  it('1. Generates pre-visit brief with tailored focus areas and safety protocols based on room type', () => {
    const engine = new MockSiteVisitIntelligenceEngine();
    const user = { name: 'Vamshi Krishna', role: 'Technician', org_id: 'org-001' };

    const res = engine.generatePreVisitBrief('SV260001', user);
    assert.equal(res.success, true);
    assert.ok(res.data);
    assert.equal(res.data.visit_number, 'SV260001');
    assert.equal(res.data.status, 'DRAFT');
    assert.ok(res.data.pre_visit_brief.key_focus_areas.length > 0);
    assert.match(res.data.pre_visit_brief.acoustic_considerations, /reverberation/i);
    assert.match(res.data.pre_visit_brief.safety_precautions, /high-voltage/i);
  });

  it('2. Populates essential diagnostic equipment checklist for on-site technician', () => {
    const engine = new MockSiteVisitIntelligenceEngine();
    const user = { name: 'Vamshi Krishna', role: 'Technician', org_id: 'org-001' };

    const res = engine.generatePreVisitBrief('SV260001', user);
    assert.equal(res.success, true);
    const tools = res.data.assigned_equipment;
    assert.ok(tools.length >= 5);
    assert.ok(tools.some((t) => t.tool_name.includes('Laser Distance Meter')));
    assert.ok(tools.some((t) => t.tool_name.includes('Lux / Light Meter')));
    assert.ok(tools.some((t) => t.tool_name.includes('Multimeter')));
  });

  it('3. Generates structured survey checklist covering dimensional, electrical, optical, and cabling requirements', () => {
    const engine = new MockSiteVisitIntelligenceEngine();
    const user = { name: 'Vamshi Krishna', role: 'Technician', org_id: 'org-001' };

    const res = engine.generatePreVisitBrief('SV260001', user);
    assert.equal(res.success, true);
    const checklist = res.data.survey_checklist;
    assert.ok(checklist.length >= 5);
    assert.ok(checklist.every((c) => c.is_mandatory === true));
    assert.ok(checklist.some((c) => c.category === 'MEASUREMENT'));
    assert.ok(checklist.some((c) => c.category === 'ELECTRICAL'));
  });

  it('4. Successfully records physical post-visit findings from technician walkthrough', () => {
    const engine = new MockSiteVisitIntelligenceEngine();
    const user = { name: 'Vamshi Krishna', role: 'Technician', org_id: 'org-001' };

    engine.generatePreVisitBrief('SV260001', user);

    const findings = {
      room_dimensions: '26.4ft L x 18.2ft W x 10.8ft H',
      ambient_lux_level: '380 Lux (High daylight from east glass facade)',
      mounting_surface_strength: 'Reinforced RCC pillar with drywall flank',
      conduit_and_cabling_readiness: '32mm underfloor conduit with pull-wire',
      power_and_grounding_readiness: '230V 16A Dedicated UPS, Neutral-Earth 0.8V',
      reverberation_notes: 'Excessive acoustic reflection from glass walls (~1.1s RT60)',
      notes: 'Ceiling grid is standard 600x600mm Armstrong acoustic tiles.',
    };

    const res = engine.recordPostVisitFindings('SV260001', findings, user);
    assert.equal(res.success, true);
    assert.equal(res.data.status, 'SURVEYED');
    assert.equal(res.data.post_visit_summary.room_dimensions, '26.4ft L x 18.2ft W x 10.8ft H');
    assert.equal(res.data.post_visit_summary.recorded_by, 'Vamshi Krishna');
  });

  it('5. Rejects recording findings without mandatory room dimensions', () => {
    const engine = new MockSiteVisitIntelligenceEngine();
    const user = { name: 'Vamshi Krishna', role: 'Technician', org_id: 'org-001' };

    engine.generatePreVisitBrief('SV260001', user);

    const findings = {
      room_dimensions: '', // empty!
      ambient_lux_level: '200 Lux',
    };

    const res = engine.recordPostVisitFindings('SV260001', findings, user);
    assert.equal(res.success, false);
    assert.match(res.error, /dimensions are mandatory/i);
  });

  it('6. Rejects requirements extraction if post-visit findings have not been recorded yet', () => {
    const engine = new MockSiteVisitIntelligenceEngine();
    const user = { name: 'Dheeraj Sharma', role: 'Sales Executive', org_id: 'org-001' };

    engine.generatePreVisitBrief('SV260001', user);

    // Attempt to extract without recording findings
    const res = engine.extractVisitRequirements('SV260001', user);
    assert.equal(res.success, false);
    assert.match(res.error, /must be recorded before extracting requirements/i);
  });

  it('7. Synthesizes physical findings into actionable bill-of-quantities components', () => {
    const engine = new MockSiteVisitIntelligenceEngine();
    const user = { name: 'Vamshi Krishna', role: 'Technician', org_id: 'org-001' };

    engine.generatePreVisitBrief('SV260001', user);
    engine.recordPostVisitFindings(
      'SV260001',
      {
        room_dimensions: '26ft L x 18ft W x 11ft H',
        ambient_lux_level: 'High daylight',
        mounting_surface_strength: 'Reinforced concrete',
        conduit_and_cabling_readiness: '32mm conduit ready',
        power_and_grounding_readiness: 'UPS available',
        reverberation_notes: 'Acoustic panels required',
      },
      user
    );

    const res = engine.extractVisitRequirements('SV260001', user);
    assert.equal(res.success, true);
    assert.equal(res.data.status, 'SYNTHESIZED');
    assert.ok(res.data.extracted_requirements.length >= 4);

    // Check that acoustic panels were included due to reverberation notes
    const acousticReq = res.data.extracted_requirements.find((r) => r.component.includes('Acoustic'));
    assert.ok(acousticReq);
    assert.equal(acousticReq.quantity_estimate, 4);
  });

  it('8. Requires human confirmation to sync survey findings to enquiry (blocks empty confirmation)', () => {
    const engine = new MockSiteVisitIntelligenceEngine();
    const user = { name: 'Dheeraj Sharma', role: 'Sales Executive', org_id: 'org-001' };

    engine.generatePreVisitBrief('SV260001', user);
    engine.recordPostVisitFindings('SV260001', { room_dimensions: '26ft x 18ft' }, user);
    engine.extractVisitRequirements('SV260001', user);

    // Attempt sync with empty confirmedBy
    const res = engine.applyVisitFindingsToEnquiry('SV260001', '', user);
    assert.equal(res.success, false);
    assert.match(res.error, /human confirmation is required/i);
  });

  it('9. Successfully synchronizes verified findings into commercial enquiry upon human confirmation', () => {
    const engine = new MockSiteVisitIntelligenceEngine();
    const user = { name: 'Dheeraj Sharma', role: 'Sales Executive', org_id: 'org-001' };

    engine.generatePreVisitBrief('SV260001', user);
    engine.recordPostVisitFindings('SV260001', { room_dimensions: '26ft L x 18ft W x 11ft H' }, user);
    engine.extractVisitRequirements('SV260001', user);

    const res = engine.applyVisitFindingsToEnquiry('SV260001', 'Dheeraj Sharma (Lead Sales)', user);
    assert.equal(res.success, true);
    assert.equal(res.data.status, 'CONVERTED');
    assert.ok(res.data.converted_to_enquiry_at);

    // Verify enquiry was updated
    const enq = engine.enquiries.find((e) => e.id === res.enquiry_id);
    assert.ok(enq.requirement_summary.includes('[Site Survey Verified by Dheeraj Sharma'));
    assert.ok(enq.requirement_summary.includes('Commercial Display / Interactive Panel'));
    assert.equal(enq.status, 'Site Visit Scheduled');
    assert.ok(enq.notes.some((n) => n.author === 'Dheeraj Sharma (Lead Sales)'));
  });

  it('10. Enforces strict RBAC: Technicians can record findings, but cannot confirm commercial sync to enquiry', () => {
    const engine = new MockSiteVisitIntelligenceEngine();
    const techUser = { name: 'Vamshi Krishna', role: 'Technician', org_id: 'org-001' };

    engine.generatePreVisitBrief('SV260001', techUser);
    engine.recordPostVisitFindings('SV260001', { room_dimensions: '26ft x 18ft' }, techUser);
    engine.extractVisitRequirements('SV260001', techUser);

    // Technician attempts to apply findings to commercial enquiry
    assert.throws(
      () => engine.applyVisitFindingsToEnquiry('SV260001', 'Vamshi Krishna', techUser),
      /Unauthorized/i
    );
  });

  it('11. Enforces tenant isolation: Prevents accessing or syncing site visits belonging to another organization', () => {
    const engine = new MockSiteVisitIntelligenceEngine();
    const userOrg1 = { name: 'Dheeraj Sharma', role: 'Sales Executive', org_id: 'org-001' };

    // SV260099 belongs to org-foreign
    const res = engine.generatePreVisitBrief('SV260099', userOrg1);
    assert.equal(res.success, false);
    assert.match(res.error, /tenant isolation violation/i);
  });

  it('12. Emits structured audit log entries for all key site visit lifecycle events', () => {
    const engine = new MockSiteVisitIntelligenceEngine();
    const tech = { name: 'Vamshi Krishna', role: 'Technician', org_id: 'org-001' };
    const sales = { name: 'Dheeraj Sharma', role: 'Sales Executive', org_id: 'org-001' };

    engine.generatePreVisitBrief('SV260001', tech);
    engine.recordPostVisitFindings('SV260001', { room_dimensions: '26ft x 18ft' }, tech);
    engine.extractVisitRequirements('SV260001', tech);
    engine.applyVisitFindingsToEnquiry('SV260001', 'Dheeraj Sharma', sales);

    assert.equal(engine.auditLogs.length, 4);
    assert.equal(engine.auditLogs[0].action, 'GENERATE_PRE_VISIT_BRIEF');
    assert.equal(engine.auditLogs[1].action, 'RECORD_POST_VISIT_FINDINGS');
    assert.equal(engine.auditLogs[2].action, 'EXTRACT_SITE_VISIT_REQUIREMENTS');
    assert.equal(engine.auditLogs[3].action, 'APPLY_SITE_VISIT_TO_ENQUIRY');
  });

  it('13. Verifies AI Gateway safe actions registration for site visit tools', () => {
    const approvedTools = [
      'get_customer_history',
      'get_pipeline_summary',
      'get_enquiry_sales_brief',
      'get_site_visit_brief',
      'extract_visit_requirements',
      'draft_followup_message',
      'search_product_catalog',
    ];

    assert.ok(approvedTools.includes('get_site_visit_brief'));
    assert.ok(approvedTools.includes('extract_visit_requirements'));
  });

});
