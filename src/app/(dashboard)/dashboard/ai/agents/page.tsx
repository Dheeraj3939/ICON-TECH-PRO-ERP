'use client';

import React, { useState } from 'react';
import {
  Users,
  Shield,
  Bot,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Truck,
  CreditCard,
  Wrench,
  MessageSquare,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowRight,
  Send,
  X,
} from 'lucide-react';
import { createAgentSession, sendMessageToAgent } from '@/lib/ai/multi-agent-orchestrator';
import type { AIAgentType } from '@/types/erp';

interface AgentCard {
  type: AIAgentType;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  purpose: string;
  status: 'ACTIVE' | 'ROLE_RESTRICTED' | 'SUPERVISED';
  capabilities: string[];
  allowedRoles: string[];
  canViewCosts: boolean;
  samplePrompt: string;
}

const AGENTS: AgentCard[] = [
  {
    type: 'SALES_AGENT',
    name: 'Sales & Quotations Agent',
    category: 'Commercial Operations',
    icon: ShoppingBag,
    purpose: 'Deal qualification, margin-protected proposal drafting, discount escalation, and follow-up cadence.',
    status: 'ACTIVE',
    capabilities: [
      'Deal qualification & AV/IT sizing',
      'Target margin validation (15% hardware / 30% service)',
      'Discount threshold validation against MD rules',
      'Commercial proposal drafting',
    ],
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive'],
    canViewCosts: false,
    samplePrompt: 'Review my active quotation pipeline and check if any discounts require executive approval.',
  },
  {
    type: 'WORKFLOW_RISK_AGENT',
    name: 'Follow-up & Escalation Agent',
    category: 'Sales Execution',
    icon: AlertTriangle,
    purpose: 'Identifies stalled client conversations, overdue follow-ups, and prepares high-conversion re-engagement scripts.',
    status: 'ACTIVE',
    capabilities: [
      'Overdue lead detection',
      'Promise-to-pay tracking',
      'Follow-up schedule prioritization',
      'Multilingual follow-up drafting',
    ],
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts'],
    canViewCosts: false,
    samplePrompt: 'Identify all overdue follow-ups and prepare a prioritized action list for today.',
  },
  {
    type: 'CUSTOMER_INTELLIGENCE_AGENT',
    name: 'Customer 360 & Relationship Agent',
    category: 'CRM & Client Intelligence',
    icon: Users,
    purpose: 'Synthesizes complete customer profile, historical order volumes, payment reliability, and decision-maker mapping.',
    status: 'ACTIVE',
    capabilities: [
      'Customer 360 transaction ledger lookup',
      'GSTIN & state compliance verification',
      'Credit limit utilization monitoring',
      'Relationship longevity assessment',
    ],
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts'],
    canViewCosts: false,
    samplePrompt: 'Summarize customer payment history and active quotations for T-Hub.',
  },
  {
    type: 'MARGIN_AGENT',
    name: 'Quotation & Margin Protection Agent',
    category: 'Commercial Governance',
    icon: Shield,
    purpose: 'Strictly enforces floor margins, flags predatory discounts, and mandates human approvals for commercial concessions.',
    status: 'SUPERVISED',
    capabilities: [
      'Floor margin protection (Min 12% IT Hardware)',
      'Sales rep discount limit check (Max 5%)',
      'Two-stage approval routing to Managing Director',
      'Anti-dumping price protection',
    ],
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM'],
    canViewCosts: true,
    samplePrompt: 'Check if applying an 8% discount on Laser Projector requires Managing Director authorization.',
  },
  {
    type: 'PROCUREMENT_AGENT',
    name: 'Procurement & Vendor Intelligence Agent',
    category: 'Supply Chain',
    icon: Truck,
    purpose: 'Compares distributor prices across Shree Prime, Hyderabad AV, Redington, and Ingram. Validates 3-way match.',
    status: 'ROLE_RESTRICTED',
    capabilities: [
      'Multi-distributor price comparison',
      'Consolidated PO generation from backorders',
      '3-way match validation (PO vs GRN vs Invoice)',
      'Purchase price variance detection',
    ],
    allowedRoles: ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'],
    canViewCosts: true,
    samplePrompt: 'Compare distributor quotes and check for any purchase price mismatch on recent supplier invoices.',
  },
  {
    type: 'DATA_QUALITY_AGENT',
    name: 'Inventory & Stock Hygiene Agent',
    category: 'Inventory Control',
    icon: TrendingUp,
    purpose: 'Monitors office stock versus customer drop-ship deliveries, serial number allocations, and reorder triggers.',
    status: 'ACTIVE',
    capabilities: [
      'Office stock vs Drop-Ship segregation check',
      'Serial number tracking and duplication prevention',
      'Minimum reorder point alerts',
      'Dead stock and aging hardware detection',
    ],
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
    canViewCosts: false,
    samplePrompt: 'Scan warehouse stock for products below minimum reorder thresholds.',
  },
  {
    type: 'ACCOUNTS_AGENT',
    name: 'Accounts, GST & Receivables Agent',
    category: 'Finance & Compliance',
    icon: CreditCard,
    purpose: 'Manages Indian GST (CGST/SGST/IGST/UTGST), 0-30 to 90+ days aging buckets, unallocated advances, and TallyPrime XML.',
    status: 'ROLE_RESTRICTED',
    capabilities: [
      'Telangana vs Interstate Place of Supply validation',
      'Receivables aging distribution analysis',
      'Customer advance payment ledger reconciliation',
      'TallyPrime XML sync verification',
    ],
    allowedRoles: ['Managing Director', 'Admin / BDM', 'Accounts'],
    canViewCosts: true,
    samplePrompt: 'Generate current receivables aging analysis and highlight accounts overdue beyond 60 days.',
  },
  {
    type: 'SERVICE_AGENT',
    name: 'Service / Rental / AMC Agent',
    category: 'After-Sales & Field Operations',
    icon: Wrench,
    purpose: 'Oversees technician job card dispatch, site readiness checklists, equipment rental returns, and AMC renewals.',
    status: 'ACTIVE',
    capabilities: [
      'Technician workload balancing',
      'Installation sign-off checklist validation',
      'Rental equipment return tracking',
      'OEM warranty and AMC expiration calendar',
    ],
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
    canViewCosts: false,
    samplePrompt: 'List AV equipment installations scheduled this week and upcoming AMC contract renewals.',
  },
  {
    type: 'COMMUNICATION_AGENT',
    name: 'Client Communication Agent',
    category: 'Omnichannel Engagement',
    icon: MessageSquare,
    purpose: 'Drafts corporate emails and WhatsApp messages in customer-preferred languages using authorized staff identities.',
    status: 'ACTIVE',
    capabilities: [
      'Corporate email generation (sales@, accounts@, etc.)',
      'WhatsApp commercial proposal delivery drafts',
      'Multilingual message synthesis (EN, TE, HI)',
      'Customer conversation history association',
    ],
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'],
    canViewCosts: false,
    samplePrompt: 'Draft a polite quotation reminder for T-Hub in Telugu.',
  },
  {
    type: 'ANALYTICS_AGENT',
    name: 'Reporting & BI Analytics Agent',
    category: 'Business Intelligence',
    icon: BarChart3,
    purpose: 'Generates daily, weekly, monthly performance reports, sales velocity graphs, and gross margin breakdowns.',
    status: 'ROLE_RESTRICTED',
    capabilities: [
      'Multi-timeframe sales velocity metrics',
      'Product category profit margin breakdown',
      'Salesperson performance attribution',
      'Customer revenue concentration analysis',
    ],
    allowedRoles: ['Managing Director', 'Admin / BDM', 'BDM', 'Accounts'],
    canViewCosts: true,
    samplePrompt: 'Provide an analysis of top-performing AV hardware categories and gross margin trends.',
  },
  {
    type: 'MANAGEMENT_MD_AGENT',
    name: 'Executive Management & MD Agent',
    category: 'Executive Governance',
    icon: Sparkles,
    purpose: 'Executive radar classified into [FACT], [CALCULATION], and [RECOMMENDATION] for high-impact decision making.',
    status: 'ROLE_RESTRICTED',
    capabilities: [
      'Executive Briefing with strict statement classification',
      'Cash flow exposure and working capital forecast',
      'High-exposure deal authorization review',
      'Strategic growth and margin recommendations',
    ],
    allowedRoles: ['Managing Director'],
    canViewCosts: true,
    samplePrompt: 'Give me the Executive Briefing covering cash flow, overdue exposure, and pending approvals.',
  },
];

export default function AIAgentsPage() {
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    agent: AgentCard;
    messages: Array<{ sender: 'user' | 'agent'; text: string; time: string }>;
  } | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const handleStartChat = async (agent: AgentCard, customPrompt?: string) => {
    setLoading(true);
    try {
      const initText = customPrompt || agent.samplePrompt;
      const res = await createAgentSession(agent.type, 'en', initText);

      if (res.success && res.session) {
        // Send initial message
        const replyRes = await sendMessageToAgent(res.session.id, initText);
        setActiveSession({
          sessionId: res.session.id,
          agent,
          messages: [
            { sender: 'user', text: initText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
            { sender: 'agent', text: replyRes.reply || 'Agent ready.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
          ],
        });
      } else {
        alert(res.error || 'Access Denied: You do not have permission for this agent.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to start agent conversation.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!activeSession || !chatInput.trim() || loading) return;

    const userText = chatInput;
    setChatInput('');
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setActiveSession((prev) => prev ? {
      ...prev,
      messages: [...prev.messages, { sender: 'user', text: userText, time }],
    } : null);

    setLoading(true);
    try {
      const res = await sendMessageToAgent(activeSession.sessionId, userText);
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setActiveSession((prev) => prev ? {
        ...prev,
        messages: [...prev.messages, { sender: 'agent', text: res.reply || 'No response', time: replyTime }],
      } : null);
    } catch (err: any) {
      setActiveSession((prev) => prev ? {
        ...prev,
        messages: [...prev.messages, { sender: 'agent', text: `Error: ${err?.message}`, time }],
      } : null);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['ALL', ...new Set(AGENTS.map((a) => a.category))];
  const filteredAgents = filterCategory === 'ALL' ? AGENTS : AGENTS.filter((a) => a.category === filterCategory);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white tracking-tight">
                Specialized AI Business Agents Center
              </h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 font-mono">
                11 Active Agents
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Domain-specific autonomous intelligence with server-side RBAC and data guardrails
            </p>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition ${
                filterCategory === cat
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.map((agent) => {
          const Icon = agent.icon;
          return (
            <div
              key={agent.type}
              className="flex flex-col justify-between p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-brand-500/40 transition duration-200 shadow-lg group"
            >
              <div className="space-y-3.5">
                {/* Top Row: Icon & Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/80 text-brand-400 group-hover:bg-brand-600/20 group-hover:text-brand-300 transition">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      agent.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        : agent.status === 'ROLE_RESTRICTED'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                    }`}
                  >
                    {agent.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Name & Category */}
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {agent.category}
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-brand-300 transition">
                    {agent.name}
                  </h3>
                </div>

                {/* Purpose */}
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {agent.purpose}
                </p>

                {/* Capabilities List */}
                <div className="space-y-1 pt-2 border-t border-slate-800/80 text-[11px] text-slate-300">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Core Capabilities:</span>
                  {agent.capabilities.map((cap, cIdx) => (
                    <div key={cIdx} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-brand-400 shrink-0" />
                      <span className="truncate">{cap}</span>
                    </div>
                  ))}
                </div>

                {/* Permission Requirements */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>Permitted Roles:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {agent.allowedRoles.map((r, rIdx) => (
                      <span
                        key={rIdx}
                        className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700/60"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 mt-4 border-t border-slate-800">
                <button
                  onClick={() => handleStartChat(agent)}
                  disabled={loading}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-brand-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition duration-150 disabled:opacity-50"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Launch Agent Session</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Modal / Drawer for Agent Conversation */}
      {activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {activeSession.agent.name}
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">
                      Live
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">{activeSession.agent.purpose}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveSession(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conversation Log */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-900">
              {activeSession.messages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                return (
                  <div key={idx} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xl rounded-xl p-3 text-xs leading-relaxed whitespace-pre-line ${
                        isUser
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-800 text-slate-200 border border-slate-700/80'
                      }`}
                    >
                      <div className="text-[9px] font-bold opacity-70 mb-1 flex justify-between">
                        <span>{isUser ? 'You' : activeSession.agent.name}</span>
                        <span>{msg.time}</span>
                      </div>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div className="text-xs text-slate-400 flex items-center gap-2 animate-pulse">
                  <Bot className="w-4 h-4 text-brand-400" />
                  <span>Agent is reasoning against permitted records...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Ask ${activeSession.agent.name}...`}
                disabled={loading}
                className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={loading || !chatInput.trim()}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
