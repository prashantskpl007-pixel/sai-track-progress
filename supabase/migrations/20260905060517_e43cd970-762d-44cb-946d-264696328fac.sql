ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS source_commission numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_paid numeric NOT NULL DEFAULT 0;