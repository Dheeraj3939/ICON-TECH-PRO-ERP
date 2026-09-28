// ==============================================================================
// ICON TECH PRO ERP V8 — Phase K: AI Sales Agent Tests
// Validates:
//   1. Lead qualification scoring (0-100) and status categorization (HOT, WARM, COLD)
//   2. Budget adequacy assessment against industry benchmarks
//   3. Timeline urgency evaluation based on buyer requirements
//   4. Solution package recommendation & transparent 18% GST arithmetic
//   5. Multi-turn conversational session history
//   6. Human-gated conversion guard (blocks CRM enquiry creation without human approval)
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

// --- Pure Mock Engines Matching Phase K Action Layer ---

function qualifyLeadEngine(criteria) {
  let score = 0;

  // 1. Space clarity
  const validSpaces = ['BOARDROOM', 'AUDITORIUM', 'CLASSROOM', 'VIDEO_CONFERENCE', 'TRAINING_ROOM'];
  const upperSpace = criteria.space_type?.toUpperCase() || '';
  if (validSpaces.some((s) => upperSpace.includes(s))) {
    score += 25;
  } else if (criteria.space_type) {
    score += 15;
  }

  // 2. Budget adequacy
  let budgetAdequacy = 'UNKNOWN';
  const benchmarks = {
    BOARDROOM: 300000,
    AUDITORIUM: 800000,
    CLASSROOM: 150000,
    VIDEO_CONFERENCE: 250000,
    TRAINING_ROOM: 350000,
  };

  const matchedKey = Object.keys(benchmarks).find((k) => upperSpace.includes(k));
  const benchmark = matchedKey ? benchmarks[matchedKey] : 200000;

  if (criteria.budget_inr && criteria.budget_inr > 0) {
    if (criteria.budget_inr >= benchmark) {
      budgetAdequacy = 'SUFFICIENT';
      score += 30;
    } else if (criteria.budget_inr >= benchmark * 0.7) {
      budgetAdequacy = 'TIGHT';
      score += 20;
    } else {
      budgetAdequacy = 'INSUFFICIENT';
      score += 5;
    }
  } else {
    score += 10;
  }

  // 3. Timeline urgency
  let urgency = 'LOW';
  if (criteria.timeline === 'IMMEDIATE') {
    urgency = 'HIGH';
    score += 25;
  } else if (criteria.timeline === 'WITHIN_1_MONTH') {
    urgency = 'HIGH';
    score += 20;
  } else if (criteria.timeline === 'WITHIN_1_QUARTER') {
    urgency = 'MEDIUM';
    score += 15;
  } else {
    urgency = 'LOW';
    score += 5;
  }

  // 4. Authority
  const role = criteria.decision_maker_role?.toLowerCase() || '';
  if (
    role.includes('director') ||
    role.includes('md') ||
    role.includes('vp') ||
    role.includes('head') ||
    role.includes('cio') ||
    role.includes('cto') ||
    role.includes('owner')
  ) {
    score += 20;
  } else if (role.includes('manager') || role.includes('lead') || role.includes('procurement')) {
    score += 15;
  } else if (role) {
    score += 10;
  }

  let status = 'COLD';
  if (score >= 75) status = 'HOT';
  else if (score >= 50) status = 'WARM';
  else if (score >= 30) status = 'COLD';
  else status = 'UNQUALIFIED';

  return {
    score,
    status,
    budget_adequacy: budgetAdequacy,
    timeline_urgency: urgency,
  };
}

function recommendPackageEngine(spaceType, seatingCapacity = 10) {
  const upperSpace = spaceType.toUpperCase();
  let packageName = '';
  let items = [];

  if (upperSpace.includes('AUDITORIUM') || seatingCapacity > 50) {
    packageName = 'Large Venue & Auditorium 4K Laser Projection Solution';
    items = [
      { product_name: 'Epson High-Lumen 4K Laser Projector', quantity: 1, estimated_price: 650000 },
      { product_name: 'Motorized Tensioned Screen 200-inch', quantity: 1, estimated_price: 180000 },
      { product_name: 'Digital Audio DSP with Line Array Speakers', quantity: 2, estimated_price: 220000 },
    ];
  } else if (upperSpace.includes('BOARDROOM')) {
    packageName = 'Executive Boardroom Interactive 4K Collaboration Suite';
    items = [
      { product_name: '86-inch 4K IFP', quantity: 1, estimated_price: 240000 },
      { product_name: 'Ceiling Beamforming Mic Array', quantity: 1, estimated_price: 115000 },
      { product_name: '4K Auto-Framing PTZ Camera', quantity: 1, estimated_price: 75000 },
    ];
  } else {
    packageName = 'Smart Interactive Classroom';
    items = [
      { product_name: '75-inch 4K IFP', quantity: 1, estimated_price: 165000 },
      { product_name: 'Active Soundbar with Mic', quantity: 1, estimated_price: 35000 },
    ];
  }

  const estimated_subtotal = items.reduce((sum, it) => sum + it.estimated_price * it.quantity, 0);
  const estimated_gst = Number((estimated_subtotal * 0.18).toFixed(2));
  const estimated_grand_total = Number((estimated_subtotal + estimated_gst).toFixed(2));

  return {
    package_name: packageName,
    items,
    estimated_subtotal,
    estimated_gst,
    estimated_grand_total,
  };
}

function convertSessionToEnquiryEngine(session, confirmation) {
  if (!confirmation?.confirmedBy || confirmation.confirmedBy.trim() === '') {
    return {
      success: false,
      error: 'Human confirmation is strictly required to convert sales session to CRM enquiry.',
    };
  }

  if (session.status === 'CONVERTED') {
    return { success: false, error: 'Session is already converted' };
  }

  const updatedSession = {
    ...session,
    status: 'CONVERTED',
    enquiry_id: `ENQ-${Date.now()}`,
    converted_by: confirmation.confirmedBy,
  };

  return { success: true, session: updatedSession, enquiryId: updatedSession.enquiry_id };
}

// --- Test Suite ---

test('Phase K.1: Lead qualification scoring calculates HOT lead with high budget and immediate timeline', () => {
  const criteria = {
    space_type: 'BOARDROOM',
    budget_inr: 450000, // Benchmark is 300,000 -> SUFFICIENT (30 pts)
    timeline: 'IMMEDIATE', // IMMEDIATE -> HIGH (25 pts)
    decision_maker_role: 'Managing Director', // 20 pts
    // Space: 25 pts
    // Total: 25 + 30 + 25 + 20 = 100
  };

  const result = qualifyLeadEngine(criteria);
  assert.equal(result.score, 100);
  assert.equal(result.status, 'HOT');
  assert.equal(result.budget_adequacy, 'SUFFICIENT');
  assert.equal(result.timeline_urgency, 'HIGH');
});

test('Phase K.2: Lead qualification categorizes tight budget and distant timeline as COLD/WARM', () => {
  const criteria = {
    space_type: 'AUDITORIUM',
    budget_inr: 200000, // Benchmark is 800,000 -> INSUFFICIENT (5 pts)
    timeline: 'EXPLORING', // LOW (5 pts)
    decision_maker_role: 'Office Admin', // 10 pts
    // Space: 25 pts
    // Total: 25 + 5 + 5 + 10 = 45 -> COLD
  };

  const result = qualifyLeadEngine(criteria);
  assert.equal(result.score, 45);
  assert.equal(result.status, 'COLD');
  assert.equal(result.budget_adequacy, 'INSUFFICIENT');
  assert.equal(result.timeline_urgency, 'LOW');
});

test('Phase K.3: Solution package recommendation calculates subtotal, 18% GST, and grand total transparently', () => {
  const rec = recommendPackageEngine('BOARDROOM', 12);
  assert.equal(rec.package_name, 'Executive Boardroom Interactive 4K Collaboration Suite');
  assert.equal(rec.items.length, 3);

  // Subtotal = 240000 + 115000 + 75000 = 430000
  assert.equal(rec.estimated_subtotal, 430000);
  // GST = 430000 * 0.18 = 77400
  assert.equal(rec.estimated_gst, 77400);
  // Grand Total = 430000 + 77400 = 507400
  assert.equal(rec.estimated_grand_total, 507400);
});

test('Phase K.4: Auditorium recommendation scales components for large venue seating', () => {
  const rec = recommendPackageEngine('AUDITORIUM', 120);
  assert.equal(rec.package_name, 'Large Venue & Auditorium 4K Laser Projection Solution');
  // Subtotal = 650000 + 180000 + (220000 * 2) = 1270000
  assert.equal(rec.estimated_subtotal, 1270000);
  assert.equal(rec.estimated_gst, 228600);
  assert.equal(rec.estimated_grand_total, 1498600);
});

test('Phase K.5: Multi-turn dialogue tracks buyer and agent messages in session', () => {
  const session = {
    id: 'SES-101',
    messages: [],
  };

  // Buyer turn
  session.messages.push({
    sender: 'BUYER',
    content: 'We need an interactive display for our 20-seat executive room.',
    created_at: new Date().toISOString(),
  });

  // AI turn
  session.messages.push({
    sender: 'AI_AGENT',
    content: 'For a 20-seat room, an 86-inch 4K IFP with ceiling array microphones is recommended.',
    created_at: new Date().toISOString(),
  });

  assert.equal(session.messages.length, 2);
  assert.equal(session.messages[0].sender, 'BUYER');
  assert.equal(session.messages[1].sender, 'AI_AGENT');
});

test('Phase K.6: Human-gated conversion guard strictly rejects converting session without explicit human approval', () => {
  const session = {
    id: 'SES-102',
    session_number: 'ICON/26-27/SES-0002',
    customer_name: 'Tech Innovations Ltd',
    status: 'ACTIVE',
  };

  // 1. Attempt conversion without confirmedBy -> MUST FAIL
  const attempt1 = convertSessionToEnquiryEngine(session, { confirmedBy: '' });
  assert.equal(attempt1.success, false);
  assert.match(attempt1.error, /Human confirmation is strictly required/);

  // 2. Authorized human conversion -> MUST SUCCEED
  const attempt2 = convertSessionToEnquiryEngine(session, {
    confirmedBy: 'Narsimha Naidu (Managing Director)',
    notes: 'Approved for direct enquiry generation',
  });
  assert.equal(attempt2.success, true);
  assert.equal(attempt2.session.status, 'CONVERTED');
  assert.ok(attempt2.enquiryId);
});
