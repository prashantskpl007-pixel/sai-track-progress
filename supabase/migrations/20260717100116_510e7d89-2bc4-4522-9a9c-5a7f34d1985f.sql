
-- 1) Extend verification_status enum
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'partial_completed';

-- 2) Customer fields for verification partner selected at registration
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS verification_partner_user_id uuid,
  ADD COLUMN IF NOT EXISTS verification_partner_name text;

-- 3) Extra structured remark fields on verification_cases
ALTER TABLE public.verification_cases
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS pending_work_details text,
  ADD COLUMN IF NOT EXISTS missing_documents text;

-- 4) Trigger: on customer insert, create/refresh verification case pre-assigned to the selected partner
CREATE OR REPLACE FUNCTION public.auto_create_verification_case()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.verification_cases(
    customer_id,
    assigned_partner_user_id,
    assigned_partner_name,
    assigned_at,
    status
  ) VALUES (
    NEW.id,
    NEW.verification_partner_user_id,
    NEW.verification_partner_name,
    CASE WHEN NEW.verification_partner_user_id IS NOT NULL THEN now() ELSE NULL END,
    'pending_assignment'
  )
  ON CONFLICT (customer_id) DO UPDATE
    SET assigned_partner_user_id = EXCLUDED.assigned_partner_user_id,
        assigned_partner_name    = EXCLUDED.assigned_partner_name,
        assigned_at              = COALESCE(EXCLUDED.assigned_at, public.verification_cases.assigned_at);
  RETURN NEW;
END $$;
