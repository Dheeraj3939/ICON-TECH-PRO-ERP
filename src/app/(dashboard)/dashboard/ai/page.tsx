'use client';

import React, { useState } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Shield,
  Clock,
  CheckCircle2,
  FileText,
  Mail,
  MessageSquare,
  AlertTriangle,
  Languages,
  ArrowRight,
  TrendingUp,
  Package,
} from 'lucide-react';
import { processAIChatPrompt, type AIChatMessage } from '@/lib/actions/ai-chat';
import type { SupportedLanguage } from '@/types/erp';

const DEMO_PROMPTS = [
  { label: "Show today's enquiries", prompt: "Show today's enquiries and open pipeline leads" },
  { label: "Which follow-ups are overdue?", prompt: "Which follow-ups are overdue or scheduled for action?" },
  { label: "Show pending quotations", prompt: "Show my pending quotations and expected order value" },
  { label: "Today's sales summary", prompt: "Give me today's sales summary and billed revenue" },
  { label: "Low-stock products", prompt: "Show low-stock products in Hyderabad office stock" },
  { label: "Draft a follow-up email", prompt: "Draft a follow-up email for our pending quotation" },
  { label: "Draft a WhatsApp message", prompt: "Draft a WhatsApp message for the client follow-up" },
];

export default function AIChatPage() {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'msg-init',
      sender: 'assistant',
      content: 'Hello! I am your ICON TECH PRO Universal ERP Copilot. I have real-time access to authorized CRM records, stock levels, quotations, and financial ledgers for your role. How can I assist you today?',
      category: 'READ',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<SupportedLanguage>('en');

  const handleSend = async (promptToSend?: string) => {
    const text = promptToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!promptToSend) setInput('');
    setLoading(true);

    try {
      const res = await processAIChatPrompt(text, language);
      if (res.success) {
        const aiMsg: AIChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          content: res.reply,
          category: res.category,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dataSnippet: res.dataSnippet,
          draftDetails: res.draftDetails,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const errorMsg: AIChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          content: res.error || 'Failed to process request.',
          category: 'READ',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'assistant',
          content: err?.message || 'Error communicating with AI service.',
          category: 'READ',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 border border-brand-800/40 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-brand-600/20 border border-brand-500/30 text-brand-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white tracking-tight">
                AI Copilot & Assistant
              </h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live Data Connected
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Natural language intelligence linked to CRM, quotations, stock, and billing
            </p>
          </div>
        </div>

        {/* Language & Security Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            <Languages className="w-4 h-4 text-brand-400" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              <option value="en" className="bg-slate-900 text-white">English (en)</option>
              <option value="te" className="bg-slate-900 text-white">తెలుగు (Telugu)</option>
              <option value="hi" className="bg-slate-900 text-white">हिन्दी (Hindi)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Shield className="w-3.5 h-3.5" />
            <span>RBAC Guardrails Active</span>
          </div>
        </div>
      </div>

      {/* Suggested Query Chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
          Demonstration Prompts (Click to Execute):
        </span>
        <div className="flex flex-wrap gap-2">
          {DEMO_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(item.prompt)}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-brand-900/40 border border-slate-700/80 hover:border-brand-500/50 text-xs text-slate-300 hover:text-white transition duration-150 flex items-center gap-1.5 group disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-400 group-hover:scale-110 transition duration-150" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Thread Viewport */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-6 min-h-[480px] max-h-[580px] overflow-y-auto space-y-4 shadow-inner">
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <div
              key={m.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs sm:text-sm ${
                  isUser
                    ? 'bg-brand-600 text-white rounded-tr-none shadow-lg shadow-brand-600/20'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-none shadow-md'
                }`}
              >
                {/* Message Header & Category Badge */}
                <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-white/10 text-[10px]">
                  <span className="font-bold opacity-80">
                    {isUser ? 'You' : 'ICON TECH PRO Copilot'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {m.category && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                          m.category === 'READ'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : m.category === 'DRAFT'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        [{m.category}]
                      </span>
                    )}
                    <span className="opacity-60">{m.timestamp}</span>
                  </div>
                </div>

                {/* Body Text */}
                <div className="whitespace-pre-line leading-relaxed">{m.content}</div>

                {/* Tabular Data Snippet if Present */}
                {Array.isArray(m.dataSnippet) && m.dataSnippet.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700/60">
                    {/* Desktop Zero-Scroll Table */}
                    <div className="hidden md:block">
                      <table className="w-full text-left text-[11px] table-fixed">
                        <colgroup>
                          {Object.keys(m.dataSnippet[0]).map((key) => (
                            <col key={key} style={{ width: `${100 / Object.keys(m.dataSnippet[0]).length}%` }} />
                          ))}
                        </colgroup>
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-700 text-[10px]">
                            {Object.keys(m.dataSnippet[0]).map((key) => (
                              <th key={key} className="py-1 px-2 uppercase tracking-wider font-semibold truncate">
                                {key.replace(/([A-Z])/g, ' $1')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/40 text-slate-300 font-mono">
                          {m.dataSnippet.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-700/30">
                              {Object.values(row).map((val: any, vIdx) => (
                                <td key={vIdx} className="py-1.5 px-2 truncate">
                                  {String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Zero-Scroll Cards */}
                    <div className="block md:hidden space-y-2">
                      {m.dataSnippet.map((row, rIdx) => (
                        <div key={rIdx} className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 space-y-1 text-xs">
                          {Object.entries(row).map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between gap-2">
                              <span className="text-[10.5px] text-slate-400 uppercase">{k.replace(/([A-Z])/g, ' $1')}</span>
                              <span className="font-mono text-slate-200 text-right truncate max-w-[60%]">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Metrics Snippet if Present */}
                {m.dataSnippet && !Array.isArray(m.dataSnippet) && typeof m.dataSnippet === 'object' && (
                  <div className="mt-3 pt-3 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(m.dataSnippet).map(([k, v]) => (
                      <div key={k} className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/50">
                        <div className="text-[10px] text-slate-400 uppercase">{k.replace(/([A-Z])/g, ' $1')}</div>
                        <div className="text-xs font-bold text-brand-300 font-mono mt-0.5">{String(v)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Draft Review Card if Generated */}
                {m.draftDetails && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 text-slate-300 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
                      <span className="flex items-center gap-1.5">
                        {m.draftDetails.channel === 'EMAIL' ? <Mail className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                        {m.draftDetails.channel} DRAFT READY
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">To: {m.draftDetails.recipient}</span>
                    </div>
                    {m.draftDetails.subject && (
                      <div className="text-xs font-semibold text-white">Subject: {m.draftDetails.subject}</div>
                    )}
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono whitespace-pre-line text-slate-300">
                      {m.draftDetails.body}
                    </div>
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Ready for review in Communication Center</span>
                      <a
                        href={`/dashboard/communication?channel=${m.draftDetails.channel}&recipient=${encodeURIComponent(m.draftDetails.recipient)}&subject=${encodeURIComponent(m.draftDetails.subject || '')}&message=${encodeURIComponent(m.draftDetails.body)}`}
                        className="px-2.5 py-1 rounded bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-semibold flex items-center gap-1 transition"
                      >
                        <span>Review & Dispatch</span>
                        <ArrowRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
                  <span className="text-xs font-black">U</span>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3 text-slate-400 text-xs animate-pulse p-2">
            <Bot className="w-5 h-5 text-brand-400" />
            <span>Consulting authorized ERP database ledgers and compiling answer...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="relative flex items-center"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything (e.g. 'Show today\'s enquiries', 'Which follow-ups are overdue?', 'Draft a quotation follow-up')..."
          disabled={loading}
          className="w-full pl-4 pr-24 py-3.5 bg-slate-900 border border-slate-700/80 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition shadow-xl"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="absolute right-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-md"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
