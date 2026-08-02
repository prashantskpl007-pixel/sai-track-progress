
-- Master: Pending reasons
CREATE TABLE public.master_pending_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_pending_reasons TO authenticated;
GRANT ALL ON public.master_pending_reasons TO service_role;
ALTER TABLE public.master_pending_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "master_pending_read" ON public.master_pending_reasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "master_pending_write" ON public.master_pending_reasons FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::app_role[]));

-- Master: Workflow statuses
CREATE TABLE public.master_workflow_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_workflow_statuses TO authenticated;
GRANT ALL ON public.master_workflow_statuses TO service_role;
ALTER TABLE public.master_workflow_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "master_status_read" ON public.master_workflow_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "master_status_write" ON public.master_workflow_statuses FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::app_role[]));

-- Master: Staff roles
CREATE TABLE public.master_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  base_role app_role NOT NULL DEFAULT 'staff',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_roles TO authenticated;
GRANT ALL ON public.master_roles TO service_role;
ALTER TABLE public.master_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "master_roles_read" ON public.master_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "master_roles_write" ON public.master_roles FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::app_role[]));

-- Payment change history
CREATE TABLE public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  field text NOT NULL,
  previous_amount numeric,
  new_amount numeric,
  updated_by uuid REFERENCES auth.users(id),
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_history_customer_idx ON public.payment_history(customer_id, created_at DESC);
GRANT SELECT, INSERT ON public.payment_history TO authenticated;
GRANT ALL ON public.payment_history TO service_role;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_history_read" ON public.payment_history FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager','staff','viewer']::app_role[]));
CREATE POLICY "payment_history_insert" ON public.payment_history FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager','staff']::app_role[]));

-- Staff role assignment + customer workflow status label
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS role_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS workflow_status text;

CREATE TRIGGER set_master_pending_updated BEFORE UPDATE ON public.master_pending_reasons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_master_status_updated BEFORE UPDATE ON public.master_workflow_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_master_roles_updated BEFORE UPDATE ON public.master_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.master_pending_reasons (label, sort_order) VALUES
  ('No Pending', 0), ('Documents Pending', 1), ('NOC Pending', 2), ('Payment Pending', 3),
  ('Appointment Pending', 4), ('Customer Confirmation Pending', 5), ('Overdue', 6)
ON CONFLICT (label) DO NOTHING;

INSERT INTO public.master_workflow_statuses (label, sort_order) VALUES
  ('New', 0), ('Documents Received', 1), ('Draft Ready', 2), ('Appointment Scheduled', 3),
  ('Registration Pending', 4), ('Registration Completed', 5), ('Closed', 6)
ON CONFLICT (label) DO NOTHING;

INSERT INTO public.master_roles (name, base_role, sort_order) VALUES
  ('Owner', 'owner', 0), ('Manager', 'manager', 1), ('Registration Executive', 'staff', 2),
  ('Registration Assistant', 'staff', 3), ('Office Staff', 'staff', 4), ('Viewer', 'viewer', 5)
ON CONFLICT (name) DO NOTHING;
