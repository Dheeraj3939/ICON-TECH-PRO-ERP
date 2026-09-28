-- ==============================================================================
-- ICON TECH PRO ERP V8 — Phase K: AI Sales Agent Migration
-- Migration: 20260919000019_v8_ai_sales_agent.sql
-- 
-- Safety: 100% Additive, Idempotent, Zero DROP/TRUNCATE.
-- Purpose:
--   1. Create ai_sales_sessions for conversational sales qualification.
--   2. Create ai_sales_messages for multi-turn dialogue logs.
--   3. Create indexes for customer & session lookups.
-- ==============================================================================

-- 1. AI Sales Sessions
CREATE TABLE IF NOT EXISTS public.ai_sales_sessions (
    id VARCHAR(50) PRIMARY KEY,
    session_number VARCHAR(40) UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id),
    customer_name VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(50),
    contact_email VARCHAR(120),
    space_type VARCHAR(50),
    seating_capacity INT,
    estimated_budget NUMERIC(12, 2),
    qualification_score INT DEFAULT 0,
    qualification_status VARCHAR(30) DEFAULT 'COLD', -- 'HOT', 'WARM', 'COLD', 'UNQUALIFIED'
    recommended_package JSONB,
    status VARCHAR(30) DEFAULT 'ACTIVE', -- 'ACTIVE', 'QUALIFIED', 'CONVERTED', 'DISMISSED'
    enquiry_id UUID REFERENCES public.enquiries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. AI Sales Messages
CREATE TABLE IF NOT EXISTS public.ai_sales_messages (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES public.ai_sales_sessions(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL, -- 'BUYER', 'AI_AGENT'
    content TEXT NOT NULL,
    intent_detected VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_sales_sessions_customer ON public.ai_sales_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_sessions_status ON public.ai_sales_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sales_messages_session ON public.ai_sales_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_sales_messages_created ON public.ai_sales_messages(created_at);
