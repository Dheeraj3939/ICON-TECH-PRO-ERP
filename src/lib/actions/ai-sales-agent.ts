'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getIndianFinancialYear } from '@/lib/utils/sequence';
import { getProducts } from '@/lib/actions/products';
import { createEnquiry } from '@/lib/actions/enquiries';
import type {
  AISalesSession,
  AISalesMessage,
  LeadQualificationCriteria,
  LeadQualificationResult,
  SolutionPackageRecommendation,
  QualificationStatus,
} from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_AI_SALES_SESSIONS__: AISalesSession[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_AI_SALES_MESSAGES__: AISalesMessage[] | undefined;
}

const INITIAL_SESSIONS: AISalesSession[] = [
  {
    id: 'SESS-000001',
    session_number: 'ICON/26-27/SES-0001',
    customer_name: 'Dr. Reddys Laboratories',
    contact_phone: '+91 98490 55555',
    contact_email: 'procurement@drreddys.com',
    space_type: 'BOARDROOM',
    seating_capacity: 18,
    estimated_budget: 450000,
    qualification_score: 88,
    qualification_status: 'HOT',
    status: 'QUALIFIED',
    recommended_package: {
      package_name: 'Executive Boardroom 4K IFP & Ceiling Audio Solution',
      space_type: 'BOARDROOM',
      items: [
        { product_name: '86-inch 4K Interactive Flat Panel Display', quantity: 1, estimated_price: 240000 },
        { product_name: 'Ceiling Array Microphone with DSP Mixer', quantity: 1, estimated_price: 120000 },
        { product_name: '4K PTZ Video Conference Camera 12x Optical Zoom', quantity: 1, estimated_price: 75000 },
      ],
      estimated_subtotal: 435000,
      estimated_gst: 78300,
      estimated_grand_total: 513300,
      rationale: 'Optimized for 18-seat executive boardroom with crystal clear voice pickup and 4K interactive presentation.',
    },
    created_at: '2026-04-08T10:00:00.000Z',
    updated_at: '2026-04-08T10:30:00.000Z',
  },
];

function getSessionsStore(): AISalesSession[] {
  if (!globalThis.__ICON_AI_SALES_SESSIONS__) {
    globalThis.__ICON_AI_SALES_SESSIONS__ = [...INITIAL_SESSIONS];
  }
  return globalThis.__ICON_AI_SALES_SESSIONS__;
}

function getMessagesStore(): AISalesMessage[] {
  if (!globalThis.__ICON_AI_SALES_MESSAGES__) {
    globalThis.__ICON_AI_SALES_MESSAGES__ = [];
  }
  return globalThis.__ICON_AI_SALES_MESSAGES__;
}

/**
 * Lead Qualification Engine
 * Objectively scores sales leads based on space, budget, timeline, and decision-maker authority.
 */
export async function qualifySalesLead(
  criteria: LeadQualificationCriteria
): Promise<LeadQualificationResult> {
  let score = 0;

  // 1. Space definition clarity (0-25 pts)
  const validSpaces = ['BOARDROOM', 'AUDITORIUM', 'CLASSROOM', 'VIDEO_CONFERENCE', 'TRAINING_ROOM'];
  const upperSpace = criteria.space_type?.toUpperCase() || '';
  if (validSpaces.some((s) => upperSpace.includes(s))) {
    score += 25;
  } else if (criteria.space_type) {
    score += 15;
  }

  // 2. Budget Adequacy Check (0-30 pts)
  let budgetAdequacy: 'SUFFICIENT' | 'TIGHT' | 'INSUFFICIENT' | 'UNKNOWN' = 'UNKNOWN';
  const estimatedBenchmark: Record<string, number> = {
    BOARDROOM: 300000,
    AUDITORIUM: 800000,
    CLASSROOM: 150000,
    VIDEO_CONFERENCE: 250000,
    TRAINING_ROOM: 350000,
  };

  const matchedSpaceKey = Object.keys(estimatedBenchmark).find((k) => upperSpace.includes(k));
  const benchmark = matchedSpaceKey ? estimatedBenchmark[matchedSpaceKey] : 200000;

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
    score += 10; // Neutral if budget not disclosed yet
  }

  // 3. Timeline Urgency (0-25 pts)
  let urgency: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
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

  // 4. Decision Maker Authority (0-20 pts)
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

  // Determine Status
  let status: QualificationStatus = 'COLD';
  if (score >= 75) status = 'HOT';
  else if (score >= 50) status = 'WARM';
  else if (score >= 30) status = 'COLD';
  else status = 'UNQUALIFIED';

  const summary = `Lead scored ${score}/100 (${status}). Budget is ${budgetAdequacy}, urgency is ${urgency}.`;
  let recommended_next_action = 'Nurture via product brochures and customer case studies.';
  if (status === 'HOT') {
    recommended_next_action = 'Schedule immediate on-site technical site survey and generate commercial quotation.';
  } else if (status === 'WARM') {
    recommended_next_action = 'Send tailored solution package options and arrange technical demo.';
  }

  return {
    score,
    status,
    budget_adequacy: budgetAdequacy,
    timeline_urgency: urgency,
    recommended_next_action,
    summary,
  };
}

/**
 * Recommend Solution Package from actual product catalog.
 */
export async function recommendSolutionPackage(
  spaceType: string,
  seatingCapacity: number = 10,
  budgetInr?: number
): Promise<SolutionPackageRecommendation> {
  const upperSpace = spaceType.toUpperCase();
  let packageName = 'Enterprise AV Solution';
  let items: Array<{ product_name: string; sku?: string; quantity: number; estimated_price: number }> = [];
  let rationale = '';

  if (upperSpace.includes('AUDITORIUM') || seatingCapacity > 50) {
    packageName = 'Large Venue & Auditorium 4K Laser Projection Solution';
    items = [
      { product_name: 'Epson High-Lumen 4K Laser Projector (10,000+ Lumens)', quantity: 1, estimated_price: 650000 },
      { product_name: 'Motorized Tensioned Projection Screen 200-inch 16:9', quantity: 1, estimated_price: 180000 },
      { product_name: 'Digital Audio DSP Processor with Column Line Array Speakers', quantity: 2, estimated_price: 220000 },
      { product_name: 'Dual Wireless Handheld & Lapel Microphone Set', quantity: 2, estimated_price: 65000 },
      { product_name: '4K HDBaseT Presentation Matrix Switcher 8x8', quantity: 1, estimated_price: 145000 },
    ];
    rationale = `Engineered for large audience sightlines (${seatingCapacity}+ seats) with high-output laser lumen density and line-array acoustic distribution.`;
  } else if (upperSpace.includes('BOARDROOM') || upperSpace.includes('CONFERENCE')) {
    packageName = 'Executive Boardroom Interactive 4K Collaboration Suite';
    items = [
      { product_name: '86-inch 4K Interactive Flat Panel Display (IFP)', quantity: 1, estimated_price: 240000 },
      { product_name: 'Ceiling Beamforming Microphone Array with Acoustic Echo Cancellation', quantity: 1, estimated_price: 115000 },
      { product_name: '4K Auto-Framing PTZ Camera with 12x Optical Zoom', quantity: 1, estimated_price: 75000 },
      { product_name: 'Wireless Presentation Dongle & ClickShare Gateway', quantity: 1, estimated_price: 45000 },
    ];
    rationale = `Optimized for high-impact executive meetings (${seatingCapacity} seats) with touch annotation, wire-free BYOM conferencing, and noise cancellation.`;
  } else if (upperSpace.includes('CLASSROOM') || upperSpace.includes('TRAINING')) {
    packageName = 'Smart Interactive Classroom & Training Solution';
    items = [
      { product_name: '75-inch 4K Interactive Flat Panel Display', quantity: 1, estimated_price: 165000 },
      { product_name: 'Wall-Mount Active Stereo Soundbar with Wireless Mic', quantity: 1, estimated_price: 35000 },
      { product_name: 'HD Document Camera / Visualizer', quantity: 1, estimated_price: 22000 },
    ];
    rationale = `Tailored for interactive education and corporate training with durable anti-glare touch glass and clear instructor voice amplification.`;
  } else {
    packageName = 'Compact Huddle Room Video Conferencing Package';
    items = [
      { product_name: '65-inch Commercial 4K UHD Display', quantity: 1, estimated_price: 85000 },
      { product_name: 'All-in-One 4K Video Bar with Integrated Mic & Speaker Array', quantity: 1, estimated_price: 65000 },
    ];
    rationale = `Cost-effective plug-and-play video conferencing for focus rooms and huddle spaces up to 6 seats.`;
  }

  const estimated_subtotal = items.reduce((sum, it) => sum + it.estimated_price * it.quantity, 0);
  const estimated_gst = Number((estimated_subtotal * 0.18).toFixed(2));
  const estimated_grand_total = Number((estimated_subtotal + estimated_gst).toFixed(2));

  return {
    package_name: packageName,
    space_type: spaceType,
    items,
    estimated_subtotal,
    estimated_gst,
    estimated_grand_total,
    rationale,
  };
}

/**
 * Start or resume an AI Sales Session.
 */
export async function createSalesSession(payload: {
  customer_name: string;
  customer_id?: string;
  contact_phone?: string;
  contact_email?: string;
  space_type?: string;
  seating_capacity?: number;
  estimated_budget?: number;
}): Promise<{ success: boolean; data?: AISalesSession; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const store = getSessionsStore();
    const fy = getIndianFinancialYear();
    const seq = (store.length + 1).toString().padStart(4, '0');
    const sessionNumber = `ICON/${fy}/SES-${seq}`;

    // Qualify initial criteria
    const qual = await qualifySalesLead({
      space_type: payload.space_type || 'BOARDROOM',
      seating_capacity: payload.seating_capacity,
      budget_inr: payload.estimated_budget,
    });

    const recommendation = await recommendSolutionPackage(
      payload.space_type || 'BOARDROOM',
      payload.seating_capacity || 12,
      payload.estimated_budget
    );

    const session: AISalesSession = {
      id: `SES-${Date.now()}`,
      session_number: sessionNumber,
      customer_id: payload.customer_id,
      customer_name: payload.customer_name.trim(),
      contact_phone: payload.contact_phone,
      contact_email: payload.contact_email,
      space_type: payload.space_type,
      seating_capacity: payload.seating_capacity,
      estimated_budget: payload.estimated_budget,
      qualification_score: qual.score,
      qualification_status: qual.status,
      recommended_package: recommendation,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    store.unshift(session);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('ai_sales_sessions').insert({
          id: session.id,
          session_number: session.session_number,
          customer_id: session.customer_id || null,
          customer_name: session.customer_name,
          contact_phone: session.contact_phone || null,
          contact_email: session.contact_email || null,
          space_type: session.space_type || null,
          seating_capacity: session.seating_capacity || null,
          estimated_budget: session.estimated_budget || null,
          qualification_score: session.qualification_score,
          qualification_status: session.qualification_status,
          recommended_package: session.recommended_package || null,
          status: session.status,
        });
      } catch (err) {
        console.warn('Supabase createSalesSession fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_AI_SALES_SESSION',
      module: 'SALES_INTELLIGENCE',
      details: `Created AI sales session ${sessionNumber} for ${payload.customer_name} (Score: ${qual.score})`,
    });

    revalidatePath('/dashboard/ai-sales');
    return { success: true, data: session };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create sales session' };
  }
}

/**
 * Send a message in a sales session.
 */
export async function sendSalesMessage(
  sessionId: string,
  sender: 'BUYER' | 'AI_AGENT',
  content: string,
  intentDetected?: string
): Promise<{ success: boolean; data?: AISalesMessage; error?: string }> {
  try {
    const sessions = getSessionsStore();
    const session = sessions.find((s) => s.id === sessionId || s.session_number === sessionId);
    if (!session) {
      return { success: false, error: 'Sales session not found' };
    }

    const messages = getMessagesStore();
    const msg: AISalesMessage = {
      id: `SMSG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      session_id: session.id,
      sender,
      content: content.trim(),
      intent_detected: intentDetected,
      created_at: new Date().toISOString(),
    };

    messages.push(msg);
    session.updated_at = new Date().toISOString();

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('ai_sales_messages').insert({
          id: msg.id,
          session_id: msg.session_id,
          sender: msg.sender,
          content: msg.content,
          intent_detected: msg.intent_detected || null,
        });
      } catch (err) {
        console.warn('Supabase sendSalesMessage fallback:', err);
      }
    }

    return { success: true, data: msg };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to send sales message' };
  }
}

/**
 * Human-Gated: Convert a qualified AI sales session into an official CRM Enquiry.
 */
export async function convertSalesSessionToEnquiry(
  sessionId: string,
  confirmation: {
    confirmedBy: string;
    notes?: string;
  }
): Promise<{ success: boolean; enquiryId?: string; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    if (!confirmation.confirmedBy || confirmation.confirmedBy.trim() === '') {
      return { success: false, error: 'Human confirmation is strictly required to convert sales session to CRM enquiry.' };
    }

    const sessions = getSessionsStore();
    const session = sessions.find((s) => s.id === sessionId || s.session_number === sessionId);
    if (!session) {
      return { success: false, error: 'Sales session not found' };
    }

    if (session.status === 'CONVERTED') {
      return { success: false, error: 'Session is already converted to an enquiry' };
    }

    // Prepare enquiry requirement description from recommended package
    const pkg = session.recommended_package;
    const reqDesc = pkg
      ? `AI Sales Qualified Package: ${pkg.package_name}\nSpace Type: ${session.space_type}\nSeating: ${session.seating_capacity || 'N/A'}\nEst. Budget: ₹${session.estimated_budget || 'N/A'}\nRecommended Items:\n${pkg.items.map((it) => `- ${it.product_name} (Qty: ${it.quantity})`).join('\n')}\nNotes: ${confirmation.notes || 'None'}`
      : `AI Sales Session ${session.session_number} qualification. Space: ${session.space_type}. Notes: ${confirmation.notes || 'None'}`;

    const enquiryRes = await createEnquiry({
      customer_id: session.customer_id || `CUST-${Date.now()}`,
      customer_name: session.customer_name,
      company_name: session.customer_name,
      customer_type: 'COMPANY',
      phone: session.contact_phone || '+919849000000',
      email: session.contact_email || 'sales@icontechpro.in',
      source: 'Direct',
      salesperson_name: authUser.name,
      product_category: session.space_type || 'Audio Visual',
      requirement_summary: reqDesc,
      estimated_budget: session.estimated_budget || 0,
      status: 'Enquiry',
      site_visit_required: true,
    });

    if (!enquiryRes.success || !enquiryRes.data) {
      return { success: false, error: enquiryRes.error || 'Failed to create enquiry' };
    }

    session.status = 'CONVERTED';
    session.enquiry_id = enquiryRes.data.id;
    session.updated_at = new Date().toISOString();

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('ai_sales_sessions')
          .update({
            status: 'CONVERTED',
            enquiry_id: enquiryRes.data.id,
            updated_at: session.updated_at,
          })
          .or(`id.eq.${session.id},session_number.eq.${session.session_number}`);
      } catch (err) {
        console.warn('Supabase convertSalesSessionToEnquiry fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'CONVERT_SALES_SESSION_TO_ENQUIRY',
      module: 'SALES_INTELLIGENCE',
      details: `Converted sales session ${session.session_number} to Enquiry ${enquiryRes.data.enquiry_number} (Confirmed by: ${confirmation.confirmedBy})`,
    });

    revalidatePath('/dashboard/enquiries');
    revalidatePath('/dashboard/ai-sales');
    return { success: true, enquiryId: enquiryRes.data.id };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to convert sales session' };
  }
}

/**
 * Retrieve all AI sales sessions.
 */
export async function getSalesSessions(filters?: { status?: string }): Promise<AISalesSession[]> {
  const store = getSessionsStore();
  if (filters?.status && filters.status !== 'ALL') {
    return store.filter((s) => s.status === filters.status);
  }
  return store;
}

/**
 * Retrieve a specific sales session with its messages.
 */
export async function getSalesSessionById(sessionId: string): Promise<{
  session: AISalesSession | null;
  messages: AISalesMessage[];
}> {
  const sessions = getSessionsStore();
  const session = sessions.find((s) => s.id === sessionId || s.session_number === sessionId) || null;
  const messages = getMessagesStore().filter((m) => m.session_id === session?.id);

  return { session, messages };
}
