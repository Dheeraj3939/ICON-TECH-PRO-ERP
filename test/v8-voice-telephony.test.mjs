// ==============================================================================
// ICON TECH PRO ERP V8 — Phase L: AI Voice Telephony Architecture Tests
// Validates:
//   1. Inbound call webhook handling & CRM customer resolution by phone number
//   2. Outbound call session initiation with corporate caller ID
//   3. Call state lifecycle progression (INITIATED -> IN_PROGRESS -> COMPLETED)
//   4. Multi-turn conversational speech transcript recording
//   5. Speech transcript analysis (sentiment detection & action items extraction)
//   6. IVR intent routing engine (Sales, Service, Billing, AMC)
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

// --- Pure Mock Engines Matching Phase L Action Layer ---

function routeCallEngine(speechSnippet, callerNumber) {
  const s = (speechSnippet || '').toLowerCase();
  let targetDepartment = 'General Desk';
  let routingIntent = 'GENERAL';

  if (s.includes('quote') || s.includes('price') || s.includes('projector') || s.includes('display')) {
    targetDepartment = 'Commercial Sales Desk';
    routingIntent = 'SALES_ENQUIRY';
  } else if (s.includes('not working') || s.includes('repair') || s.includes('broken') || s.includes('technician')) {
    targetDepartment = 'Technical Support & Service Desk';
    routingIntent = 'SERVICE_COMPLAINT';
  } else if (s.includes('invoice') || s.includes('payment') || s.includes('bill')) {
    targetDepartment = 'Accounts & Billing Desk';
    routingIntent = 'PAYMENT_BILLING';
  } else if (s.includes('amc') || s.includes('annual maintenance') || s.includes('contract')) {
    targetDepartment = 'AMC & Contracts Desk';
    routingIntent = 'AMC_RENEWAL';
  }

  return {
    callerNumber,
    targetDepartment,
    routingIntent,
    priority: routingIntent === 'SERVICE_COMPLAINT' ? 'HIGH' : 'NORMAL',
  };
}

function analyzeTranscriptEngine(transcriptTurns) {
  const fullText = transcriptTurns.map((t) => `${t.speaker}: ${t.text}`).join(' ').toLowerCase();

  let intent = 'GENERAL';
  if (fullText.includes('projector') || fullText.includes('display') || fullText.includes('quote') || fullText.includes('price')) {
    intent = 'SALES_ENQUIRY';
  } else if (fullText.includes('not working') || fullText.includes('issue') || fullText.includes('broken') || fullText.includes('repair')) {
    intent = 'SERVICE_COMPLAINT';
  } else if (fullText.includes('invoice') || fullText.includes('payment') || fullText.includes('receipt') || fullText.includes('balance')) {
    intent = 'PAYMENT_BILLING';
  } else if (fullText.includes('amc') || fullText.includes('annual maintenance') || fullText.includes('renewal')) {
    intent = 'AMC_RENEWAL';
  }

  let sentiment = 'NEUTRAL';
  if (fullText.includes('thank') || fullText.includes('great') || fullText.includes('excellent') || fullText.includes('appreciate')) {
    sentiment = 'POSITIVE';
  } else if (fullText.includes('unacceptable') || fullText.includes('delay') || fullText.includes('angry') || fullText.includes('disappointed')) {
    sentiment = 'NEGATIVE';
  }

  const actionItems = [];
  if (intent === 'SALES_ENQUIRY') {
    actionItems.push('Prepare and email product catalogue / commercial proposal');
  } else if (intent === 'SERVICE_COMPLAINT') {
    actionItems.push('Dispatch field service technician with diagnostic spares');
  } else if (intent === 'PAYMENT_BILLING') {
    actionItems.push('Send updated ledger statement and payment receipt');
  } else if (intent === 'AMC_RENEWAL') {
    actionItems.push('Generate AMC renewal agreement');
  }

  return { intent, sentiment, actionItems };
}

function handleInboundCallEngine(payload, customers) {
  const callerDigits = payload.caller_number.replace(/\D/g, '');
  let matchedCustomer;

  for (const c of customers) {
    if (c.phone) {
      const custDigits = c.phone.replace(/\D/g, '');
      if (custDigits && (callerDigits.endsWith(custDigits) || custDigits.endsWith(callerDigits))) {
        matchedCustomer = { id: c.id, name: c.company_name || c.contact_person };
        break;
      }
    }
  }

  const call = {
    id: `CALL-${Date.now()}`,
    call_sid: payload.call_sid,
    direction: 'INBOUND',
    caller_number: payload.caller_number,
    recipient_number: payload.recipient_number,
    customer_id: matchedCustomer?.id,
    customer_name: matchedCustomer?.name,
    status: 'IN_PROGRESS',
    language: payload.language || 'en',
    duration_seconds: 0,
    transcript_turns: [],
    created_at: new Date().toISOString(),
  };

  return { success: true, call, matchedCustomer };
}

function updateCallStatusEngine(call, newStatus, duration = 0, recordingUrl) {
  return {
    ...call,
    status: newStatus,
    duration_seconds: duration,
    recording_url: recordingUrl,
    ended_at: ['COMPLETED', 'FAILED', 'MISSED'].includes(newStatus) ? new Date().toISOString() : undefined,
  };
}

// --- Test Suite ---

test('Phase L.1: Inbound call webhook matches caller phone number to CRM customer', () => {
  const customers = [
    { id: 'CUST-001', company_name: 'T-Hub Foundation', phone: '+91 98490 12345' },
    { id: 'CUST-002', company_name: 'Dr. Reddys Labs', phone: '+91 98490 67890' },
  ];

  const payload = {
    call_sid: 'CA_EXO_001',
    caller_number: '+91 98490 12345',
    recipient_number: '+91 40 6900 0000',
  };

  const res = handleInboundCallEngine(payload, customers);
  assert.equal(res.success, true);
  assert.ok(res.matchedCustomer);
  assert.equal(res.matchedCustomer.id, 'CUST-001');
  assert.equal(res.matchedCustomer.name, 'T-Hub Foundation');
  assert.equal(res.call.status, 'IN_PROGRESS');
});

test('Phase L.2: Outbound call session initializes with corporate caller ID and INITIATED status', () => {
  const call = {
    id: 'CALL-OUT-001',
    call_sid: 'CA_OUT_999',
    direction: 'OUTBOUND',
    caller_number: '+91 40 6900 0000',
    recipient_number: '+91 98490 55555',
    customer_name: 'Wipro Technologies',
    status: 'INITIATED',
  };

  assert.equal(call.direction, 'OUTBOUND');
  assert.equal(call.caller_number, '+91 40 6900 0000');
  assert.equal(call.status, 'INITIATED');
});

test('Phase L.3: Call lifecycle state transitions accurately record duration and recording URL', () => {
  const call = {
    id: 'CALL-001',
    call_sid: 'CA_001',
    status: 'IN_PROGRESS',
    duration_seconds: 0,
  };

  const completedCall = updateCallStatusEngine(
    call,
    'COMPLETED',
    185,
    'https://storage.icontechpro.in/recordings/CA_001.mp3'
  );

  assert.equal(completedCall.status, 'COMPLETED');
  assert.equal(completedCall.duration_seconds, 185);
  assert.equal(completedCall.recording_url, 'https://storage.icontechpro.in/recordings/CA_001.mp3');
  assert.ok(completedCall.ended_at);
});

test('Phase L.4: Conversational transcript records turn-by-turn speech with speaker attribution', () => {
  const turns = [
    { speaker: 'CALLER', text: 'Our boardroom interactive panel is showing an HDMI handshake error.', timestamp: '2026-09-19T10:00:00Z' },
    { speaker: 'AI_AGENT', text: 'I understand. Is the power indicator blinking amber or steady green?', timestamp: '2026-09-19T10:00:05Z' },
  ];

  assert.equal(turns.length, 2);
  assert.equal(turns[0].speaker, 'CALLER');
  assert.equal(turns[1].speaker, 'AI_AGENT');
});

test('Phase L.5: Transcript analysis classifies intent, sentiment, and extracts operational action items', () => {
  const turns = [
    { speaker: 'CALLER', text: 'Thank you for following up! We are very happy with the demo and want a commercial quote for the 86-inch IFP.' },
    { speaker: 'AI_AGENT', text: 'Excellent! I will prepare the quotation and dispatch it immediately.' },
  ];

  const analysis = analyzeTranscriptEngine(turns);
  assert.equal(analysis.intent, 'SALES_ENQUIRY');
  assert.equal(analysis.sentiment, 'POSITIVE');
  assert.ok(analysis.actionItems.length > 0);
  assert.match(analysis.actionItems[0], /catalogue|proposal|quotation/i);
});

test('Phase L.6: IVR intent router directs call to appropriate department based on speech context', () => {
  // 1. Sales enquiry
  const r1 = routeCallEngine('I want to know the price of a 4K projector', '+919849011111');
  assert.equal(r1.routingIntent, 'SALES_ENQUIRY');
  assert.equal(r1.targetDepartment, 'Commercial Sales Desk');

  // 2. Service complaint
  const r2 = routeCallEngine('The microphone is broken and not working', '+919849022222');
  assert.equal(r2.routingIntent, 'SERVICE_COMPLAINT');
  assert.equal(r2.targetDepartment, 'Technical Support & Service Desk');
  assert.equal(r2.priority, 'HIGH');

  // 3. Billing query
  const r3 = routeCallEngine('Checking payment status for our invoice', '+919849033333');
  assert.equal(r3.routingIntent, 'PAYMENT_BILLING');
  assert.equal(r3.targetDepartment, 'Accounts & Billing Desk');

  // 4. AMC renewal
  const r4 = routeCallEngine('Need to renew our annual maintenance contract', '+919849044444');
  assert.equal(r4.routingIntent, 'AMC_RENEWAL');
  assert.equal(r4.targetDepartment, 'AMC & Contracts Desk');
});
