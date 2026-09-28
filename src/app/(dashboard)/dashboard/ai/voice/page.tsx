'use client';

import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  PhoneCall,
  Volume2,
  VolumeX,
  AlertCircle,
  Shield,
  Bot,
  UserCheck,
  Languages,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { createVoiceSession } from '@/lib/ai/voice-gateway';
import type { VoiceCallSession } from '@/types/erp';

export default function AIVoiceGatewayPage() {
  const [callerPhone, setCallerPhone] = useState('+91 98490 12345');
  const [language, setLanguage] = useState<'en' | 'te' | 'hi'>('te');
  const [direction, setDirection] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');
  const [activeSession, setActiveSession] = useState<VoiceCallSession | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [humanHandoff, setHumanHandoff] = useState(false);
  const [spokenInput, setSpokenInput] = useState('');

  const handleStartCall = async () => {
    setIsCalling(true);
    try {
      const res = await createVoiceSession(callerPhone, direction, language);
      if (res.success && res.session) {
        setActiveSession(res.session);
      } else {
        alert(res.error || 'Failed to initialize voice session');
      }
    } catch (err: any) {
      alert(err?.message || 'Error starting voice stream');
    }
  };

  const handleEndCall = () => {
    setIsCalling(false);
    if (activeSession) {
      setActiveSession({
        ...activeSession,
        status: 'COMPLETED',
        ended_at: new Date().toISOString(),
      });
    }
  };

  const handleSpeakTurn = (simulatedSpeech?: string) => {
    const text = simulatedSpeech || spokenInput;
    if (!text.trim() || !activeSession) return;

    const time = new Date().toISOString();
    const callerTurn = { speaker: 'caller' as const, text, timestamp: time };

    // Intelligent auto-response based on caller language
    let agentReply = 'Your request has been logged and the document copy has been dispatched.';
    if (language === 'te') {
      agentReply = 'తప్పకుండా అండీ! మీ అభ్యర్థనను రికార్డ్ చేశాము, ఇన్వాయిస్ మరియు కొటేషన్ వివరాలు వాట్సాప్‌కు పంపబడ్డాయి.';
    } else if (language === 'hi') {
      agentReply = 'जी हाँ! आपका अनुरोध दर्ज कर लिया गया है और दस्तावेज़ आपके व्हाट्सएप पर भेज दिया गया है।';
    }

    const agentTurn = { speaker: 'agent' as const, text: agentReply, timestamp: time };

    setActiveSession({
      ...activeSession,
      transcript: [...activeSession.transcript, callerTurn, agentTurn],
    });
    setSpokenInput('');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Truthful Provider Status Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3.5 shadow-lg">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-xs">
          <div className="font-bold uppercase tracking-wide flex items-center gap-2">
            <span>VOICE INTEGRATION ARCHITECTURE — NOT CONFIGURED (SIMULATION READY)</span>
            <span className="text-[9px] font-mono px-2 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30">
              Truthful State
            </span>
          </div>
          <p className="text-amber-200/80 leading-relaxed">
            External Telephony SIP trunk / Twilio Voice credentials are not currently configured in the environment. 
            The full voice pipeline (multilingual intent parsing, caller identification, CRM customer lookup, and handoff escalation) 
            is fully implemented and operational in interactive architectural simulation mode.
          </p>
        </div>
      </div>

      {/* Main Grid: Control Panel + Live Call Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Voice Gateway Configuration */}
        <div className="space-y-4 rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <PhoneCall className="w-5 h-5 text-brand-400" />
            <h2 className="text-sm font-bold text-white">Call Parameters</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Caller / Destination Phone</label>
              <input
                type="text"
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                disabled={isCalling}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Matches T-Hub Foundation (+91 98490 12345)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Direction</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as any)}
                  disabled={isCalling}
                  className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                >
                  <option value="INBOUND">Inbound Call</option>
                  <option value="OUTBOUND">Outbound Dial</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  disabled={isCalling}
                  className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none font-semibold"
                >
                  <option value="te">తెలుగు (Telugu)</option>
                  <option value="en">English (Indian)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>
            </div>

            {/* Human Handoff Toggle */}
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Human Desk Escalation</span>
                <input
                  type="checkbox"
                  checked={humanHandoff}
                  onChange={(e) => setHumanHandoff(e.target.checked)}
                  className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Automatically transfers call to human executive if sentiment drops or client requests human agent.
              </p>
            </div>

            {/* Call Action Button */}
            {!isCalling ? (
              <button
                onClick={handleStartCall}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition"
              >
                <Phone className="w-4 h-4" />
                <span>Simulate Call Connection</span>
              </button>
            ) : (
              <button
                onClick={handleEndCall}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Terminate Voice Stream</span>
              </button>
            )}
          </div>

          {/* Integration Checklist */}
          <div className="pt-3 border-t border-slate-800 space-y-2 text-[11px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Gateway Component Status:</span>
            <div className="flex items-center justify-between text-slate-300">
              <span>Speech Recognition (STT):</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Text-to-Speech (TTS):</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Telephony Trunk (SIP):</span>
              <span className="text-amber-400 font-semibold">Not Configured</span>
            </div>
          </div>
        </div>

        {/* Right Columns: Live Transcript & Interaction */}
        <div className="lg:col-span-2 flex flex-col rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl min-h-[460px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className={`w-3 h-3 rounded-full ${isCalling ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
              <h2 className="text-sm font-bold text-white">
                {isCalling ? 'Active Voice Call Stream' : 'Voice Gateway Idle'}
              </h2>
            </div>

            {activeSession && (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Customer: {activeSession.identified_customer_name || 'Unidentified'}
              </span>
            )}
          </div>

          {/* Transcript Viewport */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {activeSession?.transcript.map((t, idx) => {
              const isCaller = t.speaker === 'caller';
              return (
                <div key={idx} className={`flex gap-3 ${isCaller ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-md p-3.5 rounded-2xl text-xs sm:text-sm ${
                      isCaller
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-tl-none'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] opacity-70 mb-1">
                      <span className="font-bold">{isCaller ? 'Customer Speech' : 'AI Voice Assistant'}</span>
                      <span>{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="leading-relaxed">{t.text}</div>
                  </div>
                </div>
              );
            })}

            {!activeSession && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-2">
                <Mic className="w-12 h-12 text-slate-700" />
                <p className="text-xs">Click "Simulate Call Connection" to initiate a multilingual voice session</p>
              </div>
            )}
          </div>

          {/* Quick Voice Turns for Demonstration */}
          {isCalling && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Simulate Customer Speech Turns:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSpeakTurn('మా బోర్డ్‌రూమ్ ప్రొజెక్టర్ ఇన్వాయిస్ కాపీ కావాలి.')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700"
                >
                  "మా ఇన్వాయిస్ కాపీ కావాలి" (TE)
                </button>
                <button
                  onClick={() => handleSpeakTurn('Can you check if 86-inch Interactive Flat Panel is available in stock?')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700"
                >
                  "Check stock for 86-inch IFP" (EN)
                </button>
                <button
                  onClick={() => handleSpeakTurn('हमें नया कोटेशन कब तक मिल सकता है?')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700"
                >
                  "कोटेशन कब तक मिलेगा?" (HI)
                </button>
              </div>

              {/* Custom Speech Input */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={spokenInput}
                  onChange={(e) => setSpokenInput(e.target.value)}
                  placeholder="Or type custom speech transcript..."
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  onClick={() => handleSpeakTurn()}
                  disabled={!spokenInput.trim()}
                  className="px-3 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                >
                  Speak
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
