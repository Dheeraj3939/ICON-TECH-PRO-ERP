-- ==============================================================================
-- ICON TECH PRO ERP V8 — Phase J: Unified Communication Center Migration
-- Migration: 20260919000018_v8_communication_center.sql
-- 
-- Safety: 100% Additive, Idempotent, Zero DROP/TRUNCATE.
-- Purpose:
--   1. Create communication_inbox for multi-channel inbound messages.
--   2. Create communication_templates for multi-channel messaging templates.
--   3. Create indexes for customer message history retrieval.
-- ==============================================================================

-- 1. Inbound Communication Messages
CREATE TABLE IF NOT EXISTS public.communication_inbox (
    id VARCHAR(50) PRIMARY KEY,
    channel VARCHAR(30) NOT NULL, -- 'WHATSAPP', 'EMAIL', 'SMS'
    sender VARCHAR(150) NOT NULL,
    sender_name VARCHAR(150),
    recipient VARCHAR(150) NOT NULL,
    subject TEXT,
    message_body TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id),
    customer_name VARCHAR(150),
    provider_name VARCHAR(100) NOT NULL,
    provider_message_id VARCHAR(150),
    raw_payload JSONB,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Communication Templates
CREATE TABLE IF NOT EXISTS public.communication_templates (
    id VARCHAR(50) PRIMARY KEY,
    template_code VARCHAR(80) UNIQUE NOT NULL,
    template_name VARCHAR(150) NOT NULL,
    channel VARCHAR(30) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    subject_template TEXT,
    body_template TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for fast history lookups
CREATE INDEX IF NOT EXISTS idx_comm_inbox_customer ON public.communication_inbox(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_inbox_sender ON public.communication_inbox(sender);
CREATE INDEX IF NOT EXISTS idx_comm_inbox_channel ON public.communication_inbox(channel);
CREATE INDEX IF NOT EXISTS idx_comm_inbox_received ON public.communication_inbox(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_templates_channel ON public.communication_templates(channel);
