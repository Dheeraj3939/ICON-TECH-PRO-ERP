-- ==============================================================================
-- ICON TECH PRO ERP - MIGRATION 20260919000010
-- VERSION 8 PHASE C.1: PROSPECT -> ENQUIRY / OPPORTUNITY BRIDGE
-- 100% ADDITIVE & NON-DESTRUCTIVE (ZERO DROP, ZERO TRUNCATE, ZERO DATA LOSS)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Add prospect_dossier_id to enquiries for end-to-end commercial traceability
-- ------------------------------------------------------------------------------
ALTER TABLE public.enquiries 
ADD COLUMN IF NOT EXISTS prospect_dossier_id UUID REFERENCES public.prospect_companies(id) ON DELETE SET NULL;

-- Non-unique index to permit multiple legitimate project enquiries over time
CREATE INDEX IF NOT EXISTS idx_enquiries_prospect_dossier_id ON public.enquiries(prospect_dossier_id);

-- ------------------------------------------------------------------------------
-- 2. Atomic Transactional RPC for Governed Prospect -> Enquiry Conversion
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_prospect_to_enquiry_tx(
  p_prospect_id UUID,
  p_link_existing BOOLEAN,
  p_existing_customer_id UUID,
  p_customer_payload JSONB,
  p_enquiry_payload JSONB,
  p_converted_by VARCHAR
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id UUID;
  v_customer_code VARCHAR(30);
  v_enquiry_id UUID;
  v_enquiry_number VARCHAR(30);
  v_company RECORD;
BEGIN
  -- 1. Lock and verify prospect company
  SELECT * INTO v_company 
  FROM public.prospect_companies 
  WHERE id = p_prospect_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prospect company % not found', p_prospect_id;
  END IF;

  -- 2. Resolve Customer (Link existing or Create new)
  IF p_link_existing THEN
    IF p_existing_customer_id IS NULL THEN
      RAISE EXCEPTION 'Existing customer ID must be provided when link_existing is true';
    END IF;

    SELECT id, customer_code INTO v_customer_id, v_customer_code
    FROM public.customers
    WHERE id = p_existing_customer_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Target customer % not found', p_existing_customer_id;
    END IF;

    -- Update prospect_dossier_id on customer if not already set
    UPDATE public.customers
    SET prospect_dossier_id = p_prospect_id,
        updated_at = NOW()
    WHERE id = v_customer_id AND prospect_dossier_id IS NULL;

  ELSE
    -- Create new customer record
    v_customer_code := COALESCE(p_customer_payload->>'customer_code', 'ICON' || TO_CHAR(NOW(), 'YY') || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0'));

    INSERT INTO public.customers (
      customer_code,
      customer_name,
      company_name,
      customer_type,
      phone,
      email,
      billing_address,
      city,
      state,
      state_code,
      status,
      prospect_dossier_id
    ) VALUES (
      v_customer_code,
      COALESCE(p_customer_payload->>'customer_name', v_company.company_name),
      COALESCE(p_customer_payload->>'company_name', v_company.company_name),
      COALESCE(p_customer_payload->>'customer_type', 'COMPANY'),
      COALESCE(p_customer_payload->>'phone', '9849012345'),
      p_customer_payload->>'email',
      COALESCE(p_customer_payload->>'billing_address', v_company.headquarters_location, 'Hyderabad, Telangana'),
      COALESCE(p_customer_payload->>'city', 'Hyderabad'),
      COALESCE(p_customer_payload->>'state', 'Telangana'),
      '36',
      'ACTIVE',
      p_prospect_id
    ) RETURNING id, customer_code INTO v_customer_id, v_customer_code;
  END IF;

  -- 3. Create Enquiry record
  v_enquiry_number := COALESCE(p_enquiry_payload->>'enquiry_number', 'ENQ' || TO_CHAR(NOW(), 'YY') || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0'));

  INSERT INTO public.enquiries (
    enquiry_number,
    customer_id,
    customer_name,
    company_name,
    customer_type,
    phone,
    email,
    source,
    salesperson_name,
    product_category,
    requirement_summary,
    estimated_budget,
    status,
    follow_up_date,
    site_visit_required,
    prospect_dossier_id
  ) VALUES (
    v_enquiry_number,
    v_customer_id,
    COALESCE(p_customer_payload->>'customer_name', v_company.company_name),
    COALESCE(p_customer_payload->>'company_name', v_company.company_name),
    COALESCE(p_customer_payload->>'customer_type', 'COMPANY'),
    COALESCE(p_customer_payload->>'phone', '9849012345'),
    p_customer_payload->>'email',
    COALESCE(p_enquiry_payload->>'source', 'AI Prospect Intelligence'),
    COALESCE(p_enquiry_payload->>'salesperson_name', p_converted_by),
    COALESCE(p_enquiry_payload->>'product_category', 'Integrated Technology'),
    COALESCE(p_enquiry_payload->>'requirement_summary', 'Converted from Prospect Intelligence Dossier'),
    COALESCE((p_enquiry_payload->>'estimated_budget')::NUMERIC, 0.00),
    'Enquiry',
    (p_enquiry_payload->>'follow_up_date')::DATE,
    COALESCE((p_enquiry_payload->>'site_visit_required')::BOOLEAN, FALSE),
    p_prospect_id
  ) RETURNING id, enquiry_number INTO v_enquiry_id, v_enquiry_number;

  -- 4. Update Prospect Company state
  UPDATE public.prospect_companies
  SET status = 'CONVERTED',
      crm_customer_id = v_customer_id,
      updated_at = NOW()
  WHERE id = p_prospect_id;

  -- 5. Return atomic transaction payload
  RETURN jsonb_build_object(
    'success', true,
    'prospect_company_id', p_prospect_id,
    'customer_id', v_customer_id,
    'customer_code', v_customer_code,
    'enquiry_id', v_enquiry_id,
    'enquiry_number', v_enquiry_number,
    'is_new_customer', NOT p_link_existing
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_prospect_to_enquiry_tx TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_prospect_to_enquiry_tx TO service_role;

COMMIT;
