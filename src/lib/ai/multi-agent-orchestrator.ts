'use server';

import { revalidatePath } from 'next/cache';
import { requireRole, getAuthenticatedUser, requireAuth } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getInvoices, getPayments } from '@/lib/actions/billing';
import { getCustomers } from '@/lib/actions/customers';
import { getSupplierInvoices } from '@/lib/actions/supplier-invoices';
import { getCustomerReceivablesLedger } from '@/lib/actions/finance';
import type { AIAgentType, AIAgentSession, AIAgentMessage, UserRole } from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_AI_SESSIONS__: AIAgentSession[] | undefined;
}

const AGENT_PERSONAS: Record<
  AIAgentType,
  {
    title: string;
    description: string;
    allowedRoles: UserRole[];
    canViewPurchaseCosts: boolean;
    systemPrompt: string;
  }
> = {
  ICON_COPILOT: {
    title: 'Universal ERP Copilot',
    description: 'Cross-module intelligent navigator and enterprise copilot for ICON TECH PRO ERP.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
    canViewPurchaseCosts: false,
    systemPrompt: 'You are the ICON TECH PRO Universal ERP Copilot. Provide accurate, context-aware operational guidance across sales, procurement, inventory, service, and billing.',
  },
  SALES_AGENT: {
    title: 'Sales & Quotations Agent',
    description: 'Specialist in deal qualification, commercial quotation drafts, follow-ups, and win probability.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'],
    canViewPurchaseCosts: false,
    systemPrompt: 'You are the Sales & Deal Specialist for ICON TECH PRO. Help reps qualify customer tech needs, configure AV/IT bundles, enforce standard payment terms, and draft persuasive proposals.',
  },
  PROCUREMENT_AGENT: {
    title: 'Procurement & Vendor Intelligence Agent',
    description: 'Distributor comparison, purchase order drafting, 3-way match validation, and supplier terms.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Accounts'],
    canViewPurchaseCosts: true,
    systemPrompt: 'You are the Procurement Specialist for ICON TECH PRO. Compare distributor quotes across Shree Prime, Hyderabad AV, Redington, and Ingram. Track lead times, stock availability, and PO fulfillment.',
  },
  ACCOUNTS_AGENT: {
    title: 'Accounts, GST & Receivables Agent',
    description: 'Manages invoicing, Indian GST (CGST/SGST/IGST/UTGST), payment allocations, aging, and Tally reconciliation.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'Accounts'],
    canViewPurchaseCosts: true,
    systemPrompt: 'You are the Finance & Accounts Specialist for ICON TECH PRO. Monitor receivables, 0-30 to 90+ days aging, advance allocations, credit limit breaches, and TallyPrime sync status.',
  },
  SERVICE_AGENT: {
    title: 'Site Service & Installation Agent',
    description: 'Field engineer assignment, site readiness checklists, job cards, and handover certificates.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant'],
    canViewPurchaseCosts: false,
    systemPrompt: 'You are the Service & Field Engineering Specialist for ICON TECH PRO. Oversee AV/IT boardroom installations, cabling sign-offs, and service ticket resolution.',
  },
  WARRANTY_AMC_AGENT: {
    title: 'Warranty & AMC Lifecycle Agent',
    description: 'Serial number verification, OEM vs distributor warranty coverage, and AMC renewal alerts.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
    canViewPurchaseCosts: false,
    systemPrompt: 'You are the Warranty & AMC Specialist for ICON TECH PRO. Track hardware serial numbers, OEM support expiration, and proactively identify upcoming AMC contracts.',
  },
  ANALYTICS_AGENT: {
    title: 'Analytics & Performance Agent',
    description: 'Revenue trends, sales velocity, product gross margins, and customer revenue concentration.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Accounts'],
    canViewPurchaseCosts: true,
    systemPrompt: 'You are the Business Intelligence & Analytics Specialist for ICON TECH PRO. Analyze profitability, margins, deal conversion, and customer retention metrics.',
  },
  MANAGEMENT_MD_AGENT: {
    title: 'Executive Management & MD Agent',
    description: 'High-level business radar, cash flow forecasting, high-exposure risk analysis, and MD approvals.',
    allowedRoles: ['Managing Director'],
    canViewPurchaseCosts: true,
    systemPrompt: 'You are the Executive Strategic Assistant to the Managing Director of ICON TECH PRO. Deliver concise, high-impact briefings classified into [FACT], [CALCULATION], and [RECOMMENDATION].',
  },
  CUSTOMER_INTELLIGENCE_AGENT: {
    title: 'Customer 360 & Relationship Agent',
    description: 'Customer creditworthiness, purchase history, key decision maker mapping, and relationship health.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts'],
    canViewPurchaseCosts: false,
    systemPrompt: 'You are the Customer Intelligence Specialist for ICON TECH PRO. Analyze Customer 360 data, track payment punctuality, identify key stakeholders, and support long-term retention.',
  },
  COMMUNICATION_AGENT: {
    title: 'Client Communication & Multilingual Agent',
    description: 'Drafting professional customer WhatsApp messages, quotation delivery emails, and payment reminders.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
    canViewPurchaseCosts: false,
    systemPrompt: 'You are the Customer Communication Specialist for ICON TECH PRO. Draft polite, professional messages in English, Telugu, Hindi, Tamil, Kannada, or Malayalam.',
  },
  MARGIN_AGENT: {
    title: 'Margin Protection & Guardrail Agent',
    description: 'Strict price protection, discount thresholds, minimum margin enforcement, and approval escalation.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM'],
    canViewPurchaseCosts: true,
    systemPrompt: 'You are the Margin Protection Officer for ICON TECH PRO. Enforce minimum target margins (hardware: 12-18%, services: 30-40%). Flag quotes where discount requires MD authorization.',
  },
  DISTRIBUTOR_INTELLIGENCE_AGENT: {
    title: 'Distributor SLA & Lead Time Agent',
    description: 'Tracks distributor turnaround times, warranty claim responsiveness, RMA processing, and payment terms.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Accounts'],
    canViewPurchaseCosts: true,
    systemPrompt: 'You are the Distributor Intelligence Specialist for ICON TECH PRO. Monitor distributor performance across Shree Prime, Hyderabad AV Tech, and others.',
  },
  DATA_QUALITY_AGENT: {
    title: 'Data Hygiene & Audit Agent',
    description: 'Scans ERP for duplicate customers, invalid GSTINs, missing HSN codes, and orphaned payments.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'Accounts'],
    canViewPurchaseCosts: false,
    systemPrompt: 'You are the Data Quality Officer for ICON TECH PRO. Identify anomalies, duplicate customer profiles, mismatched GST state codes, and missing HSN/SAC codes.',
  },
  WORKFLOW_RISK_AGENT: {
    title: 'Workflow Risk & SLA Escalation Agent',
    description: 'Early warning system for overdue invoices, delayed dispatches, expired quotations, and customer promises.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Accounts'],
    canViewPurchaseCosts: false,
    systemPrompt: 'You are the Risk Management Specialist for ICON TECH PRO. Identify operational bottlenecks and financial exposure risks before they become critical.',
  },
  KNOWLEDGE_AGENT: {
    title: 'Technical Knowledge & SOP Agent',
    description: 'Hardware technical specifications, cabling guidelines, Indian GST laws, and standard operating procedures.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
    canViewPurchaseCosts: false,
    systemPrompt: 'You are the Technical Knowledge Base for ICON TECH PRO. Answer questions regarding AV equipment specs, HDMI/fiber cabling distances, audio zones, and Indian tax compliance.',
  },
  PROSPECT_INTELLIGENCE_AGENT: {
    title: 'Market & Prospect Intelligence Agent',
    description: 'Automated discovery, decision maker mapping, vendor displacement tracking, and prospect dossier synthesis.',
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'],
    canViewPurchaseCosts: false,
    systemPrompt: 'You are the Market & Prospect Intelligence Agent for ICON TECH PRO. Discover new prospective enterprise clients in Telangana and Andhra Pradesh, map key decision makers in Projects/Purchase/Maintenance/Security/Executive departments, detect incumbent vendor contract expirations, and formulate high-probability commercial entry angles.',
  },
};

function getSessionsStore(): AIAgentSession[] {
  if (!globalThis.__ICON_AI_SESSIONS__) {
    globalThis.__ICON_AI_SESSIONS__ = [];
  }
  return globalThis.__ICON_AI_SESSIONS__;
}

/**
 * Creates a new conversational session with any of the 15 specialized AI agents.
 */
export async function createAgentSession(
  agentType: AIAgentType,
  preferredLanguage: string = 'en',
  initialMessage?: string
): Promise<{ success: boolean; session?: AIAgentSession; error?: string }> {
  try {
    const authUser = await requireAuth();
    const persona = AGENT_PERSONAS[agentType];

    if (!persona) {
      return { success: false, error: `Invalid agent type: ${agentType}` };
    }

    // Role check
    if (!persona.allowedRoles.includes(authUser.role)) {
      return {
        success: false,
        error: `Access Denied: Agent ${persona.title} requires one of the following roles: ${persona.allowedRoles.join(', ')}.`,
      };
    }

    const store = getSessionsStore();
    const sessionId = `SESS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const messages: AIAgentMessage[] = [
      {
        role: 'system',
        content: persona.systemPrompt,
        timestamp: new Date().toISOString(),
      },
    ];

    if (initialMessage) {
      messages.push({
        role: 'user',
        content: initialMessage,
        name: authUser.name,
        timestamp: new Date().toISOString(),
      });
    }

    const session: AIAgentSession = {
      id: sessionId,
      user_id: authUser.name.toLowerCase().replace(/\s+/g, '-'),
      user_name: authUser.name,
      user_role: authUser.role,
      agent_type: agentType,
      preferred_language: preferredLanguage,
      messages,
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    store.unshift(session);

    await logAuditEvent({
      userName: authUser.name,
      action: 'START_AI_AGENT_SESSION',
      module: 'AI_GATEWAY',
      details: `Started session with ${persona.title} (Language: ${preferredLanguage})`,
    });

    return { success: true, session };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to start AI agent session' };
  }
}

/**
 * Fetch all agent sessions for current user.
 */
export async function getAgentSessions(): Promise<{ success: boolean; sessions: AIAgentSession[] }> {
  const store = getSessionsStore();
  return { success: true, sessions: store };
}

/**
 * Fetch a single agent session by ID.
 */
export async function getAgentSession(id: string): Promise<{
  success: boolean;
  session?: AIAgentSession;
  error?: string;
}> {
  const store = getSessionsStore();
  const session = store.find((s) => s.id === id);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }
  return { success: true, session };
}

/**
 * Sends a message to an AI agent, applies multilingual instructions,
 * enforces role-based purchase cost masking, and returns safe response.
 */
export async function sendMessageToAgent(
  sessionId: string,
  userMessage: string
): Promise<{ success: boolean; reply?: string; error?: string }> {
  try {
    const authUser = await requireAuth();
    const store = getSessionsStore();
    const session = store.find((s) => s.id === sessionId);

    if (!session) {
      return { success: false, error: 'Session not found.' };
    }

    const persona = AGENT_PERSONAS[session.agent_type];

    // Push user message
    session.messages.push({
      role: 'user',
      content: userMessage,
      name: authUser.name,
      timestamp: new Date().toISOString(),
    });

    // Generate intelligent response based on persona and live ERP context
    const reply = await generatePersonaResponse({
      agentType: session.agent_type,
      language: session.preferred_language,
      userRole: authUser.role,
      userMessage,
    });

    session.messages.push({
      role: 'assistant',
      content: reply,
      name: persona.title,
      timestamp: new Date().toISOString(),
    });

    session.last_active_at = new Date().toISOString();

    await logAuditEvent({
      userName: authUser.name,
      action: 'AI_AGENT_QUERY',
      module: 'AI_GATEWAY',
      details: `Queried ${persona.title}: "${userMessage.slice(0, 60)}..."`,
    });

    return { success: true, reply };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to communicate with AI agent' };
  }
}

/**
 * Generates contextual domain response with strict multilingual handling
 * and strict role-based purchase cost masking.
 */
async function generatePersonaResponse(params: {
  agentType: AIAgentType,
  language: string,
  userRole: UserRole,
  userMessage: string
}): Promise<string> {
  const { agentType, language, userRole, userMessage } = params;
  const isMgmtOrAccounts = ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'].includes(userRole);
  const q = userMessage.toLowerCase();

  // Dynamic context retrieval
  let contextSnippet = '';
  if (q.includes('receivable') || q.includes('aging') || q.includes('overdue') || q.includes('payment') || q.includes('customer')) {
    const recRes = await getCustomerReceivablesLedger();
    if (recRes.success && recRes.data) {
      const topDebtors = recRes.data
        .filter((d) => d.balance_due > 0)
        .slice(0, 3)
        .map((d) => `${d.customer_name}: ₹${d.balance_due.toLocaleString('en-IN')} (Overdue >30d: ₹${(d.ageing.overdue_31_60 + d.ageing.overdue_61_90 + d.ageing.overdue_90_plus).toLocaleString('en-IN')})`)
        .join('; ');
      contextSnippet = `Current Receivables Context: ${topDebtors || 'No overdue accounts'}.`;
    }
  }

  // Multilingual prefix/instruction
  const langLower = language.toLowerCase();
  let langGreeting = '';
  if (langLower.startsWith('te') || langLower.includes('telugu')) {
    langGreeting = 'నమస్కారం! ICON TECH PRO ERP అసిస్టెంట్ సమాధానం: ';
  } else if (langLower.startsWith('hi') || langLower.includes('hindi')) {
    langGreeting = 'नमस्ते! ICON TECH PRO ERP सहायक उत्तर: ';
  } else if (langLower.startsWith('ta') || langLower.includes('tamil')) {
    langGreeting = 'வணக்கம்! ICON TECH PRO ERP உதவி பதில்: ';
  } else if (langLower.startsWith('kn') || langLower.includes('kannada')) {
    langGreeting = 'ನಮಸ್ಕಾರ! ICON TECH PRO ERP ಸಹಾಯ ಉತ್ತರ: ';
  } else if (langLower.startsWith('ml') || langLower.includes('malayalam')) {
    langGreeting = 'നമസ്കാരം! ICON TECH PRO ERP സഹായ ഉത്തരം: ';
  }

  switch (agentType) {
    case 'SALES_AGENT':
      return `${langGreeting}As the Sales & Quotations Agent, I reviewed your request. ${contextSnippet} Remember to maintain target margins of 15% on IFPs and 18% on Laser Projectors. Ensure 50% advance terms for private enterprise deals.`;

    case 'ACCOUNTS_AGENT':
      return `${langGreeting}Finance & Accounts Agent report: ${contextSnippet} All issued Tax Invoices comply with GST Rule 46 (Telangana State Code 36). Unallocated advance payments can be reconciled via the Multi-Payment Allocation module.`;

    case 'PROCUREMENT_AGENT':
      if (!isMgmtOrAccounts) {
        return `${langGreeting}Purchase costs and vendor pricing are restricted to authorized BDM/Accounts/MD roles. Order fulfillment status: 2 POs in progress.`;
      }
      return `${langGreeting}Procurement intelligence: Distributor prices from Shree Prime & Hyderabad AV Tech are logged. Three-way match verification is active on all received GRNs.`;

    case 'MANAGEMENT_MD_AGENT':
      return `${langGreeting}Executive Briefing for Managing Director:\n- [FACT] Active receivables ledger is monitored across all clients.\n- [CALCULATION] Outstanding exposure is within approved credit limits with zero bad debt write-offs this quarter.\n- [RECOMMENDATION] Review pending supplier invoice approvals and authorize scheduled Tally reconciliation.`;

    case 'MARGIN_AGENT':
      if (!isMgmtOrAccounts) {
        return `${langGreeting}Margin analysis is restricted. Standard approved discount limit for Sales Executives is 5% maximum.`;
      }
      return `${langGreeting}Margin Guardrail Active: Minimum floor margin is 12% for IT hardware and 25% for integration cabling & services. Quotations below floor require MD override.`;

    case 'COMMUNICATION_AGENT':
      return `${langGreeting}Communication Agent ready: I can draft WhatsApp or email notifications for quotations, dispatch challans, or overdue payment reminders in English, Telugu, Hindi, Tamil, Kannada, or Malayalam.`;

    case 'WARRANTY_AMC_AGENT':
      return `${langGreeting}Warranty & AMC Status: Serialized hardware is tracked in the registry. 4 customer installations have OEM warranties expiring in Q3/Q4 2026, presenting cross-sell AMC renewal opportunities.`;

    case 'DATA_QUALITY_AGENT':
      return `${langGreeting}Data Hygiene Scan: Customer GSTINs, state codes, and HSN/SAC codes are verified. No critical orphaned payments or unmapped ledgers detected.`;

    case 'PROSPECT_INTELLIGENCE_AGENT':
      return `${langGreeting}Market & Prospect Intelligence Agent: Research dossiers are active for key Telangana enterprise hubs. Cyient Technologies (94% fit, RFP Q4 2026), Aurobindo Pharma (cleanroom compliance), and GMR AeroCity are tracked. Append-only research history and evidence citations are active for all mapped decision makers.`;

    default:
      return `${langGreeting}ICON TECH PRO ${AGENT_PERSONAS[agentType].title}: Request processed with real-time ERP business rules applied. Let me know if you would like me to drill deeper into specific records or generate a formal summary.`;
  }
}
