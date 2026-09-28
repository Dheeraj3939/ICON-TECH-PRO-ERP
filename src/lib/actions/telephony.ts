'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getCustomers } from '@/lib/actions/customers';
import type {
  TelephonyCallRecord,
  CallTranscriptTurn,
  CallDirection,
  CallStatus,
  CallIntent,
  SupportedLanguage,
} from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_TELEPHONY_CALLS__: TelephonyCallRecord[] | undefined;
}

const INITIAL_CALLS: TelephonyCallRecord[] = [
  {
    id: 'CALL-0001',
    call_sid: 'CA_EXO_98492001',
    direction: 'INBOUND',
    caller_number: '+91 98490 12345',
    recipient_number: '+91 40 6900 0000',
    customer_id: 'CUST0001',
    customer_name: 'T-Hub Foundation',
    status: 'COMPLETED',
    intent_detected: 'SALES_ENQUIRY',
    language: 'en',
    duration_seconds: 145,
    recording_url: 'https://storage.icontechpro.in/recordings/CA_EXO_98492001.mp3',
    sentiment: 'POSITIVE',
    extracted_summary: 'Client called regarding laser projector installation for Auditorium 2. Requested demonstration and proposal.',
    action_items: ['Schedule site survey for Auditorium 2', 'Send 4K laser projector brochure'],
    provider_name: 'Exotel Telephony Gateway',
    transcript_turns: [
      { speaker: 'CALLER', text: 'Hello, I am calling from T-Hub about our Auditorium 2 projection upgrade.', timestamp: '2026-04-05T10:00:00Z', language: 'en' },
      { speaker: 'AI_AGENT', text: 'Welcome to ICON TECH PRO. I can help you with high-lumen laser projectors and interactive setups.', timestamp: '2026-04-05T10:00:05Z', language: 'en' },
      { speaker: 'CALLER', text: 'We need around 10000 lumens for a 200-inch screen.', timestamp: '2026-04-05T10:00:15Z', language: 'en' },
      { speaker: 'AI_AGENT', text: 'Our Epson 4K Laser series is an ideal fit. I have logged an enquiry and assigned our senior AV engineer to coordinate a site visit.', timestamp: '2026-04-05T10:00:30Z', language: 'en' },
    ],
    created_at: '2026-04-05T10:00:00Z',
    ended_at: '2026-04-05T10:02:25Z',
  },
];

function getCallsStore(): TelephonyCallRecord[] {
  if (!globalThis.__ICON_TELEPHONY_CALLS__) {
    globalThis.__ICON_TELEPHONY_CALLS__ = [...INITIAL_CALLS];
  }
  return globalThis.__ICON_TELEPHONY_CALLS__;
}

/**
 * Handle an Inbound Telephony Webhook from provider (Exotel / Twilio / Tata Tele).
 */
export async function handleInboundCallWebhook(payload: {
  call_sid: string;
  caller_number: string;
  recipient_number: string;
  provider_name?: string;
  language?: SupportedLanguage;
}): Promise<{ success: boolean; call: TelephonyCallRecord; matchedCustomer?: { id: string; name: string } }> {
  const store = getCallsStore();
  const callerDigits = payload.caller_number.replace(/\D/g, '');

  let matchedCustomer: { id: string; name: string } | undefined;
  try {
    const { customers } = await getCustomers();
    const match = customers.find((c) => {
      if (c.phone) {
        const custDigits = c.phone.replace(/\D/g, '');
        if (custDigits && (callerDigits.endsWith(custDigits) || custDigits.endsWith(callerDigits))) {
          return true;
        }
      }
      return false;
    });

    if (match) {
      matchedCustomer = {
        id: match.id,
        name: match.company_name || match.contact_person || 'Client',
      };
    }
  } catch (err) {
    console.warn('Customer lookup during call webhook failed:', err);
  }

  const call: TelephonyCallRecord = {
    id: `CALL-${Date.now()}`,
    call_sid: payload.call_sid,
    direction: 'INBOUND',
    caller_number: payload.caller_number,
    recipient_number: payload.recipient_number,
    customer_id: matchedCustomer?.id,
    customer_name: matchedCustomer?.name,
    status: 'IN_PROGRESS',
    intent_detected: 'GENERAL',
    language: payload.language || 'en',
    duration_seconds: 0,
    transcript_turns: [],
    provider_name: payload.provider_name || 'Exotel Telephony Gateway',
    created_at: new Date().toISOString(),
  };

  store.unshift(call);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      await admin.from('telephony_calls').insert({
        id: call.id,
        call_sid: call.call_sid,
        direction: call.direction,
        caller_number: call.caller_number,
        recipient_number: call.recipient_number,
        customer_id: call.customer_id || null,
        customer_name: call.customer_name || null,
        status: call.status,
        intent_detected: call.intent_detected,
        language: call.language,
        provider_name: call.provider_name,
      });
    } catch (err) {
      console.warn('Supabase handleInboundCallWebhook fallback:', err);
    }
  }

  await logAuditEvent({
    userName: 'TELEPHONY_GATEWAY',
    action: 'INBOUND_CALL_CONNECTED',
    module: 'TELEPHONY',
    details: `Inbound call ${call.call_sid} connected from ${call.caller_number}${call.customer_name ? ` (${call.customer_name})` : ''}`,
  });

  revalidatePath('/dashboard/communication');
  return { success: true, call, matchedCustomer };
}

/**
 * Initiate an Outbound Telephony Call to customer or lead.
 */
export async function initiateOutboundCall(payload: {
  recipient_number: string;
  customer_id?: string;
  customer_name?: string;
  language?: SupportedLanguage;
  intent?: CallIntent;
}): Promise<{ success: boolean; call?: TelephonyCallRecord; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts']);
    const store = getCallsStore();
    const callSid = `CA_OUT_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const call: TelephonyCallRecord = {
      id: `CALL-${Date.now()}`,
      call_sid: callSid,
      direction: 'OUTBOUND',
      caller_number: '+91 40 6900 0000', // Corporate Outbound Line
      recipient_number: payload.recipient_number,
      customer_id: payload.customer_id,
      customer_name: payload.customer_name,
      status: 'INITIATED',
      intent_detected: payload.intent || 'GENERAL',
      language: payload.language || 'en',
      duration_seconds: 0,
      transcript_turns: [],
      provider_name: 'Exotel Telephony Gateway',
      created_at: new Date().toISOString(),
    };

    store.unshift(call);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('telephony_calls').insert({
          id: call.id,
          call_sid: call.call_sid,
          direction: call.direction,
          caller_number: call.caller_number,
          recipient_number: call.recipient_number,
          customer_id: call.customer_id || null,
          customer_name: call.customer_name || null,
          status: call.status,
          intent_detected: call.intent_detected,
          language: call.language,
          provider_name: call.provider_name,
        });
      } catch (err) {
        console.warn('Supabase initiateOutboundCall fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'OUTBOUND_CALL_INITIATED',
      module: 'TELEPHONY',
      details: `Initiated outbound call to ${payload.recipient_number} (Intent: ${call.intent_detected})`,
    });

    revalidatePath('/dashboard/communication');
    return { success: true, call };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to initiate outbound call' };
  }
}

/**
 * Record a conversational transcript turn during a live call.
 */
export async function recordCallTranscriptTurn(
  callSid: string,
  turn: {
    speaker: 'CALLER' | 'AI_AGENT' | 'EXECUTIVE';
    text: string;
    language?: SupportedLanguage;
    confidence?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const store = getCallsStore();
  const call = store.find((c) => c.call_sid === callSid || c.id === callSid);
  if (!call) return { success: false, error: 'Call record not found' };

  const fullTurn: CallTranscriptTurn = {
    speaker: turn.speaker,
    text: turn.text.trim(),
    language: turn.language || call.language,
    confidence: turn.confidence ?? 1.0,
    timestamp: new Date().toISOString(),
  };

  call.transcript_turns.push(fullTurn);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      await admin.from('telephony_transcripts').insert({
        id: `TRN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        call_id: call.id,
        speaker: fullTurn.speaker,
        text: fullTurn.text,
        language: fullTurn.language,
        confidence: fullTurn.confidence,
      });
    } catch (err) {
      console.warn('Supabase recordCallTranscriptTurn fallback:', err);
    }
  }

  return { success: true };
}

/**
 * Update Call Status, duration, and recording URL upon call completion.
 */
export async function updateCallStatus(
  callSid: string,
  status: CallStatus,
  durationSeconds: number = 0,
  recordingUrl?: string
): Promise<{ success: boolean; data?: TelephonyCallRecord; error?: string }> {
  const store = getCallsStore();
  const call = store.find((c) => c.call_sid === callSid || c.id === callSid);
  if (!call) return { success: false, error: 'Call record not found' };

  call.status = status;
  call.duration_seconds = durationSeconds;
  if (recordingUrl) call.recording_url = recordingUrl;
  if (status === 'COMPLETED' || status === 'FAILED' || status === 'MISSED') {
    call.ended_at = new Date().toISOString();
  }

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      await admin
        .from('telephony_calls')
        .update({
          status: call.status,
          duration_seconds: call.duration_seconds,
          recording_url: call.recording_url || null,
          ended_at: call.ended_at || null,
        })
        .eq('id', call.id);
    } catch (err) {
      console.warn('Supabase updateCallStatus fallback:', err);
    }
  }

  revalidatePath('/dashboard/communication');
  return { success: true, data: call };
}

/**
 * Analyze transcript: Detects intent, sentiment, summary, and action items.
 */
export async function analyzeCallTranscript(callSid: string): Promise<{
  success: boolean;
  intent: CallIntent;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  summary: string;
  actionItems: string[];
  error?: string;
}> {
  const store = getCallsStore();
  const call = store.find((c) => c.call_sid === callSid || c.id === callSid);
  if (!call) {
    return {
      success: false,
      intent: 'GENERAL',
      sentiment: 'NEUTRAL',
      summary: '',
      actionItems: [],
      error: 'Call not found',
    };
  }

  const fullText = call.transcript_turns.map((t) => `${t.speaker}: ${t.text}`).join(' ').toLowerCase();

  // Intent classification
  let intent: CallIntent = 'GENERAL';
  if (fullText.includes('projector') || fullText.includes('display') || fullText.includes('screen') || fullText.includes('quote') || fullText.includes('price')) {
    intent = 'SALES_ENQUIRY';
  } else if (fullText.includes('not working') || fullText.includes('issue') || fullText.includes('broken') || fullText.includes('repair') || fullText.includes('fault')) {
    intent = 'SERVICE_COMPLAINT';
  } else if (fullText.includes('invoice') || fullText.includes('payment') || fullText.includes('receipt') || fullText.includes('neft') || fullText.includes('balance')) {
    intent = 'PAYMENT_BILLING';
  } else if (fullText.includes('amc') || fullText.includes('annual maintenance') || fullText.includes('renewal')) {
    intent = 'AMC_RENEWAL';
  }

  // Sentiment classification
  let sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
  if (fullText.includes('thank') || fullText.includes('great') || fullText.includes('excellent') || fullText.includes('appreciate') || fullText.includes('interested')) {
    sentiment = 'POSITIVE';
  } else if (fullText.includes('unacceptable') || fullText.includes('delay') || fullText.includes('angry') || fullText.includes('disappointed') || fullText.includes('failed')) {
    sentiment = 'NEGATIVE';
  }

  const summary = `Call with ${call.customer_name || call.caller_number} regarding ${intent}. Sentiment detected as ${sentiment}.`;
  const actionItems: string[] = [];
  if (intent === 'SALES_ENQUIRY') {
    actionItems.push('Prepare and email product catalogue / commercial proposal');
    actionItems.push('Assign territory BDM to conduct site survey');
  } else if (intent === 'SERVICE_COMPLAINT') {
    actionItems.push('Dispatch field service technician with diagnostic spares');
  } else if (intent === 'PAYMENT_BILLING') {
    actionItems.push('Send updated ledger statement and payment receipt');
  } else if (intent === 'AMC_RENEWAL') {
    actionItems.push('Generate AMC renewal agreement and schedule first PM visit');
  }

  call.intent_detected = intent;
  call.sentiment = sentiment;
  call.extracted_summary = summary;
  call.action_items = actionItems;

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      await admin
        .from('telephony_calls')
        .update({
          intent_detected: intent,
          sentiment,
          extracted_summary: summary,
          action_items: actionItems,
        })
        .eq('id', call.id);
    } catch (err) {
      console.warn('Supabase analyzeCallTranscript fallback:', err);
    }
  }

  return {
    success: true,
    intent,
    sentiment,
    summary,
    actionItems,
  };
}

/**
 * Retrieve call history with optional filters.
 */
export async function getCallHistory(filters?: {
  customer_id?: string;
  status?: CallStatus;
  direction?: CallDirection;
}): Promise<TelephonyCallRecord[]> {
  const store = getCallsStore();
  let list = [...store];

  if (filters?.customer_id) list = list.filter((c) => c.customer_id === filters.customer_id);
  if (filters?.status) list = list.filter((c) => c.status === filters.status);
  if (filters?.direction) list = list.filter((c) => c.direction === filters.direction);

  return list;
}

/**
 * Retrieve single call by SID or ID.
 */
export async function getCallBySid(callSid: string): Promise<TelephonyCallRecord | null> {
  const store = getCallsStore();
  return store.find((c) => c.call_sid === callSid || c.id === callSid) || null;
}

/**
 * Initiate Direct Human Call from Salesperson's Airtel phone to Customer.
 * Logs click-to-call or direct dial session in CRM with caller attribution.
 */
export async function initiateDirectSalespersonCall(payload: {
  salesperson_phone: string;
  salesperson_name?: string;
  customer_phone: string;
  customer_id?: string;
  customer_name?: string;
  note?: string;
}): Promise<{ success: boolean; call?: TelephonyCallRecord; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts']);
    const store = getCallsStore();
    const callSid = `CA_HUMAN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const call: TelephonyCallRecord = {
      id: `CALL-${Date.now()}`,
      call_sid: callSid,
      direction: 'OUTBOUND',
      caller_number: payload.salesperson_phone, // Salesperson's Airtel Phone
      recipient_number: payload.customer_phone,
      customer_id: payload.customer_id,
      customer_name: payload.customer_name,
      status: 'INITIATED',
      intent_detected: 'GENERAL',
      language: 'en',
      duration_seconds: 0,
      transcript_turns: [],
      provider_name: 'Airtel Business Direct Voice',
      is_salesperson_direct: true,
      extracted_summary: payload.note || `Direct call from ${payload.salesperson_name || authUser.name} (${payload.salesperson_phone}) to ${payload.customer_name || payload.customer_phone}`,
      created_at: new Date().toISOString(),
    };

    store.unshift(call);

    await logAuditEvent({
      userName: authUser.name,
      action: 'DIRECT_HUMAN_CALL_INITIATED',
      module: 'TELEPHONY',
      details: `Salesperson ${payload.salesperson_name || authUser.name} called ${payload.customer_phone} via Airtel phone`,
    });

    revalidatePath('/dashboard/communication');
    return { success: true, call };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to initiate human call' };
  }
}

/**
 * Transfer an active AI voice call to a Salesperson's Airtel phone.
 * Generates a warm-handoff brief with caller context and transcript summary.
 */
export async function transferCallToSalesperson(payload: {
  call_sid: string;
  salesperson_phone: string;
  salesperson_name?: string;
  reason?: string;
}): Promise<{
  success: boolean;
  call?: TelephonyCallRecord;
  handoffSummary?: string;
  error?: string;
}> {
  try {
    const store = getCallsStore();
    const call = store.find((c) => c.call_sid === payload.call_sid || c.id === payload.call_sid);
    if (!call) return { success: false, error: 'Call record not found' };

    const transcriptSummary = call.transcript_turns.length > 0
      ? call.transcript_turns.slice(-4).map((t) => `${t.speaker}: "${t.text}"`).join(' | ')
      : 'Initial caller connection established.';

    const handoffSummary = `AI -> HUMAN WARM TRANSFER:
Caller: ${call.customer_name || 'Prospect'} (${call.caller_number})
Detected Intent: ${call.intent_detected || 'GENERAL'}
Reason: ${payload.reason || 'Customer requested human salesperson'}
Context: ${transcriptSummary}`;

    call.transferred_to = payload.salesperson_phone;
    call.transferred_salesperson_name = payload.salesperson_name || 'Sales Executive';
    call.transfer_status = 'INITIATED';
    call.transfer_reason = payload.reason || 'AI Escalation to Human Agent';
    call.transfer_summary = handoffSummary;
    call.status = 'IN_PROGRESS';

    call.transcript_turns.push({
      speaker: 'AI_AGENT',
      text: `Transferring your call to our Senior Solutions Specialist at ${payload.salesperson_phone}. Please hold the line while I bridge you.`,
      language: call.language,
      confidence: 1.0,
      timestamp: new Date().toISOString(),
    });

    await logAuditEvent({
      userName: 'AI_VOICE_AGENT',
      action: 'CALL_TRANSFERRED_TO_SALESPERSON',
      module: 'TELEPHONY',
      details: `Transferred Call ${call.call_sid} to ${payload.salesperson_name || 'Salesperson'} (${payload.salesperson_phone}) - Reason: ${call.transfer_reason}`,
    });

    revalidatePath('/dashboard/communication');
    return { success: true, call, handoffSummary };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to transfer call' };
  }
}
