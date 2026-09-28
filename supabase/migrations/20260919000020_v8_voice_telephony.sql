-- ==============================================================================
-- ICON TECH PRO ERP V8 — Phase L: AI Voice Telephony Architecture Migration
-- Migration: 20260919000020_v8_voice_telephony.sql
-- 
-- Safety: 100% Additive, Idempotent, Zero DROP/TRUNCATE.
-- Purpose:
--   1. Create telephony_calls for voice telephony session records.
--   2. Create telephony_transcripts for turn-by-turn conversational audio transcripts.
--   3. Create indexes for caller, customer, status, and timestamp queries.
-- ==============================================================================

-- 1. Telephony Calls Table
CREATE TABLE IF NOT EXISTS public.telephony_calls (
    id VARCHAR(50) PRIMARY KEY,
    call_sid VARCHAR(100) UNIQUE NOT NULL,
    direction VARCHAR(20) NOT NULL, -- 'INBOUND', 'OUTBOUND'
    caller_number VARCHAR(50) NOT NULL,
    recipient_number VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES public.customers(id),
    customer_name VARCHAR(150),
    status VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
    intent_detected VARCHAR(50) DEFAULT 'GENERAL',
    language VARCHAR(10) DEFAULT 'en',
    duration_seconds INT DEFAULT 0,
    recording_url TEXT,
    sentiment VARCHAR(20),
    extracted_summary TEXT,
    action_items JSONB DEFAULT '[]',
    provider_name VARCHAR(80) NOT NULL DEFAULT 'Simulation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- 2. Telephony Transcripts Table
CREATE TABLE IF NOT EXISTS public.telephony_transcripts (
    id VARCHAR(50) PRIMARY KEY,
    call_id VARCHAR(50) NOT NULL REFERENCES public.telephony_calls(id) ON DELETE CASCADE,
    speaker VARCHAR(20) NOT NULL, -- 'CALLER', 'AI_AGENT', 'EXECUTIVE'
    text TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    confidence NUMERIC(4, 3) DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Telephony Performance Indexes
CREATE INDEX IF NOT EXISTS idx_telephony_caller ON public.telephony_calls(caller_number);
CREATE INDEX IF NOT EXISTS idx_telephony_customer ON public.telephony_calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_telephony_status ON public.telephony_calls(status);
CREATE INDEX IF NOT EXISTS idx_telephony_created ON public.telephony_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telephony_transcripts_call ON public.telephony_transcripts(call_id);
