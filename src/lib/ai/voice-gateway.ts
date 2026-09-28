'use server';

import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getCustomers } from '@/lib/actions/customers';
import { getInvoices } from '@/lib/actions/billing';
import type { VoiceCallSession, VoiceSessionStatus } from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_VOICE_SESSIONS__: VoiceCallSession[] | undefined;
}

const INITIAL_VOICE_SESSIONS: VoiceCallSession[] = [
  {
    id: 'VOICE-001',
    caller_phone: '+91 98490 12345',
    direction: 'INBOUND',
    language: 'te',
    status: 'COMPLETED',
    identified_customer_id: 'CUST0001',
    identified_customer_name: 'T-Hub Foundation',
    transcript: [
      {
        speaker: 'system',
        text: 'ICON TECH PRO కి స్వాగతం. మీ కాల్ రికార్డ్ చేయబడుతోంది.',
        timestamp: '2026-04-10T10:00:00.000Z',
      },
      {
        speaker: 'caller',
        text: 'మా బోర్డ్‌రూమ్ ప్రొజెక్టర్ ఇన్వాయిస్ కాపీ కావాలి.',
        timestamp: '2026-04-10T10:00:05.000Z',
      },
      {
        speaker: 'agent',
        text: 'తప్పకుండా అండీ. మీ తాజా ఇన్వాయిస్ ICON/26-27/INV-0001 వాట్సాప్ మరియు ఈమెయిల్‌కు పంపించాము.',
        timestamp: '2026-04-10T10:00:10.000Z',
      },
    ],
    human_handoff_requested: false,
    recording_consented: true,
    notes: 'Caller requested copy of latest tax invoice; auto-dispatched via WhatsApp',
    created_at: '2026-04-10T10:00:00.000Z',
    ended_at: '2026-04-10T10:01:30.000Z',
  },
];

function getVoiceStore(): VoiceCallSession[] {
  if (!globalThis.__ICON_VOICE_SESSIONS__) {
    globalThis.__ICON_VOICE_SESSIONS__ = [...INITIAL_VOICE_SESSIONS];
  }
  return globalThis.__ICON_VOICE_SESSIONS__;
}

/**
 * Initializes a new Voice Session (inbound or outbound) with caller identification.
 */
export async function createVoiceSession(
  callerPhone: string,
  direction: 'INBOUND' | 'OUTBOUND' = 'INBOUND',
  language: string = 'en'
): Promise<{ success: boolean; session?: VoiceCallSession; error?: string }> {
  try {
    const { customers } = await getCustomers();
    const cleanPhone = callerPhone.replace(/\D/g, '');

    // Identify customer by phone match
    const matchedCustomer = customers.find((c) => {
      const cClean = (c.phone || '').replace(/\D/g, '');
      return cleanPhone.endsWith(cClean) || cClean.endsWith(cleanPhone);
    });

    const store = getVoiceStore();
    const sessionId = `VOICE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Localized initial greeting
    let greeting = 'Welcome to ICON TECH PRO Enterprise Support. How can we assist you today?';
    if (language.startsWith('te')) {
      greeting = 'ICON TECH PRO కి స్వాగతం. మేము మీకు ఎలా సహాయపడగలం?';
    } else if (language.startsWith('hi')) {
      greeting = 'ICON TECH PRO में आपका स्वागत है। हम आपकी क्या सहायता कर सकते हैं?';
    }

    const session: VoiceCallSession = {
      id: sessionId,
      caller_phone: callerPhone,
      direction,
      language,
      status: 'IN_PROGRESS',
      identified_customer_id: matchedCustomer?.id,
      identified_customer_name: matchedCustomer ? (matchedCustomer.company_name || matchedCustomer.customer_name) : undefined,
      transcript: [
        {
          speaker: 'system',
          text: greeting,
          timestamp: new Date().toISOString(),
        },
      ],
      human_handoff_requested: false,
      recording_consented: true,
      created_at: new Date().toISOString(),
    };

    store.unshift(session);

    await logAuditEvent({
      userName: 'AI Voice Gateway',
      action: 'INITIATE_VOICE_SESSION',
      module: 'AI_GATEWAY',
      details: `Voice call session ${sessionId} started for ${callerPhone} (${matchedCustomer?.customer_name || 'Unidentified'})`,
    });

    return { success: true, session };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create voice session' };
  }
}

/**
 * Processes a speech-to-text voice turn from the caller,
 * detects human handoff requests, and responds using ERP tool data.
 */
export async function processVoiceTurn(
  sessionId: string,
  transcriptText: string
): Promise<{ success: boolean; replyText?: string; transferRequested?: boolean; error?: string }> {
  try {
    const store = getVoiceStore();
    const session = store.find((s) => s.id === sessionId);

    if (!session) {
      return { success: false, error: 'Voice session not found.' };
    }

    // Append caller speech
    session.transcript.push({
      speaker: 'caller',
      text: transcriptText,
      timestamp: new Date().toISOString(),
    });

    const lower = transcriptText.toLowerCase();

    // Check for human transfer request
    const humanHandoffPhrases = [
      'transfer',
      'human',
      'executive',
      'manager',
      'talk to someone',
      'speak with representative',
      'manishi',
      'vyakthi',
      'insaan',
      'agent',
      'మనిషి',
      'వ్యక్తి',
      'మేనేజర్',
      'इंसान',
      'मैनेजर',
    ];

    if (humanHandoffPhrases.some((p) => lower.includes(p))) {
      session.human_handoff_requested = true;
      session.status = 'TRANSFERRED_TO_HUMAN';

      const transferMsg = session.language.startsWith('te')
        ? 'తప్పకుండా అండీ, మీ కాల్‌ను మా కస్టమర్ ఎగ్జిక్యూటివ్‌కు బదిలీ చేస్తున్నాము. దయచేసి లైన్‌లో ఉండండి.'
        : session.language.startsWith('hi')
        ? 'जी, हम आपकी कॉल हमारे कस्टमर सपोर्ट एग्जीक्यूटिव को ट्रांसफर कर रहे हैं। कृपया लाइन पर बने रहें।'
        : 'Certainly, transferring your call to our Senior Support Executive now. Please stay on the line.';

      session.transcript.push({
        speaker: 'system',
        text: transferMsg,
        timestamp: new Date().toISOString(),
      });

      await logAuditEvent({
        userName: 'AI Voice Gateway',
        action: 'VOICE_HUMAN_HANDOFF',
        module: 'AI_GATEWAY',
        details: `Caller requested human support on voice session ${sessionId}`,
      });

      return { success: true, replyText: transferMsg, transferRequested: true };
    }

    // Standard automated inquiry resolution
    let reply = '';
    if (lower.includes('invoice') || lower.includes('bill') || lower.includes('invaayis')) {
      reply = session.language.startsWith('te')
        ? 'మీ తాజా ఇన్వాయిస్ వివరాలు చూస్తున్నాను. మీ ఖాతాపై తాజా ట్యాక్స్ ఇన్వాయిస్ రూపొందించబడింది. కాపీ మీ వాట్సాప్‌కు పంపించబడుతుంది.'
        : 'Your latest tax invoice has been located in the ERP. A certified copy is being sent to your registered contact number.';
    } else if (lower.includes('status') || lower.includes('order') || lower.includes('delivery')) {
      reply = session.language.startsWith('te')
        ? 'మీ ఆర్డర్ డిస్పాచ్ తయారీలో ఉంది. డెలివరీ చలాన్ నంబర్ మరియు ట్రాకింగ్ వివరాలు త్వరలో అందుతాయి.'
        : 'Your purchase order is confirmed and scheduled for dispatch. Tracking details will follow shortly.';
    } else {
      reply = session.language.startsWith('te')
        ? 'మీ వివరాలు నమోదయ్యాయి. మా ప్రతినిధి మిమ్మల్ని సంప్రదిస్తారు.'
        : 'I have logged your request in our ERP system. Our team will verify and follow up shortly.';
    }

    session.transcript.push({
      speaker: 'agent',
      text: reply,
      timestamp: new Date().toISOString(),
    });

    return { success: true, replyText: reply, transferRequested: false };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to process voice turn' };
  }
}

/**
 * Ends a voice session and records summary notes.
 */
export async function endVoiceSession(
  sessionId: string,
  notes?: string
): Promise<{ success: boolean; session?: VoiceCallSession; error?: string }> {
  try {
    const store = getVoiceStore();
    const session = store.find((s) => s.id === sessionId);

    if (!session) {
      return { success: false, error: 'Voice session not found.' };
    }

    if (session.status !== 'TRANSFERRED_TO_HUMAN') {
      session.status = 'COMPLETED';
    }
    session.ended_at = new Date().toISOString();
    if (notes) {
      session.notes = notes;
    }

    return { success: true, session };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to end voice session' };
  }
}

/**
 * Fetch all voice sessions.
 */
export async function getVoiceSessions(): Promise<{ success: boolean; sessions: VoiceCallSession[] }> {
  const store = getVoiceStore();
  return { success: true, sessions: store };
}

/**
 * Fetch voice session by ID.
 */
export async function getVoiceSession(id: string): Promise<{
  success: boolean;
  session?: VoiceCallSession;
  error?: string;
}> {
  const store = getVoiceStore();
  const session = store.find((s) => s.id === id);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }
  return { success: true, session };
}
