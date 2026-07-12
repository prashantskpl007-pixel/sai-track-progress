
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TYPE public.registration_status AS ENUM (
  'application_created',
  'documents_received',
  'draft_prepared',
  'appointment_scheduled',
  'biometric_completed',
  'registration_submitted',
  'registration_completed',
  'agreement_ready'
);

CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid');

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  application_number TEXT NOT NULL UNIQUE,
  agreement_type TEXT NOT NULL,
  property_address TEXT,
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_status registration_status NOT NULL DEFAULT 'application_created',
  appointment_date TIMESTAMPTZ,
  appointment_location TEXT,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_amount NUMERIC(12,2),
  agreement_pdf_path TEXT,
  support_number TEXT DEFAULT '+91 98765 43210',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customers_mobile_idx ON public.customers(mobile_number);
CREATE INDEX customers_status_idx ON public.customers(current_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own record" ON public.customers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all customers" ON public.customers
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update customers" ON public.customers
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete customers" ON public.customers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status registration_status NOT NULL,
  remarks TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX status_updates_customer_idx ON public.status_updates(customer_id, created_at DESC);

GRANT SELECT, INSERT ON public.status_updates TO authenticated;
GRANT ALL ON public.status_updates TO service_role;
ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer views own status history" ON public.status_updates
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
  );
CREATE POLICY "Admins view all status history" ON public.status_updates
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert status updates" ON public.status_updates
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.current_status IS DISTINCT FROM OLD.current_status THEN
    INSERT INTO public.status_updates(customer_id, status, remarks, updated_by)
    VALUES (NEW.id, NEW.current_status, NEW.notes, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_customers_log_status
  AFTER INSERT OR UPDATE OF current_status ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

-- Function to atomically claim admin role if none exists (for first-time bootstrap)
CREATE OR REPLACE FUNCTION public.claim_first_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO admin_exists;
  IF admin_exists THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, 'admin')
    ON CONFLICT DO NOTHING;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION public.claim_first_admin(UUID) TO authenticated;
