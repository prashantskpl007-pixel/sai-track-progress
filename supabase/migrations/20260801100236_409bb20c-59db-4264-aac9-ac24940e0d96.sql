ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS token_number text,
  ADD COLUMN IF NOT EXISTS source_agent text,
  ADD COLUMN IF NOT EXISTS work_type text,
  ADD COLUMN IF NOT EXISTS registration_handling_type text,
  ADD COLUMN IF NOT EXISTS verification_noc_status text,
  ADD COLUMN IF NOT EXISTS pending_item text,
  ADD COLUMN IF NOT EXISTS appointment_time text;

CREATE UNIQUE INDEX IF NOT EXISTS customers_token_number_key
  ON public.customers (token_number) WHERE token_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.customer_remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  message text NOT NULL,
  author_user_id uuid,
  author_name text NOT NULL DEFAULT 'Staff',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.customer_remarks TO authenticated;
GRANT ALL ON public.customer_remarks TO service_role;

ALTER TABLE public.customer_remarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backoffice can read remarks" ON public.customer_remarks
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager','staff','viewer','verification_partner']::app_role[]));

CREATE POLICY "Backoffice can add remarks" ON public.customer_remarks
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager','staff','verification_partner']::app_role[]));

CREATE INDEX IF NOT EXISTS customer_remarks_customer_idx ON public.customer_remarks (customer_id, created_at DESC);