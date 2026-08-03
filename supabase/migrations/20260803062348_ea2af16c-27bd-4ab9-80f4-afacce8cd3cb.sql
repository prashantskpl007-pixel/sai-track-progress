-- 1. Verification / NOC master
CREATE TABLE public.master_verification_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_verification_statuses TO authenticated;
GRANT ALL ON public.master_verification_statuses TO service_role;
ALTER TABLE public.master_verification_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read verification statuses" ON public.master_verification_statuses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage verification statuses" ON public.master_verification_statuses
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::app_role[]));
CREATE TRIGGER set_updated_at_master_verification_statuses
  BEFORE UPDATE ON public.master_verification_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.master_verification_statuses (label, sort_order) VALUES
  ('Not Required', 1),
  ('Pending', 2),
  ('In Progress', 3),
  ('Additional Documents Required', 4),
  ('Completed', 5),
  ('Rejected', 6),
  ('Other', 7);

-- 2. Registration & workflow field configuration
CREATE TABLE public.field_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text NOT NULL UNIQUE,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  is_required boolean NOT NULL DEFAULT false,
  show_in_registration boolean NOT NULL DEFAULT true,
  show_in_workflow boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_configs TO authenticated;
GRANT ALL ON public.field_configs TO service_role;
ALTER TABLE public.field_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read field configs" ON public.field_configs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage field configs" ON public.field_configs
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]));
CREATE TRIGGER set_updated_at_field_configs
  BEFORE UPDATE ON public.field_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.field_configs
  (field_key, label, field_type, is_system, is_required, show_in_registration, show_in_workflow, sort_order) VALUES
  ('registration_date',           'Registration Date',   'date',      true,  true,  true,  true,  1),
  ('token_number',                'Token Number',        'text',      true,  true,  true,  true,  2),
  ('source_agent',                'Source',              'text',      true,  false, true,  true,  3),
  ('customer_name',               'Customer Name',       'text',      true,  true,  true,  true,  4),
  ('mobile_number',               'Mobile Number',       'mobile',    true,  true,  true,  true,  5),
  ('property_address',            'Property Address',    'textarea',  true,  false, true,  true,  6),
  ('work_type',                   'Work Type',           'dropdown',  true,  false, true,  true,  7),
  ('registration_handling_type',  'Handling Type',       'dropdown',  true,  false, true,  true,  8),
  ('assigned_staff_id',           'Assigned Staff',      'dropdown',  true,  false, true,  true,  9),
  ('verification_noc_status',     'Verification / NOC',  'dropdown',  true,  false, true,  true,  10),
  ('total_amount',                'Fees',                'currency',  true,  false, true,  true,  11),
  ('payment_received',            'Amount Received',     'currency',  true,  false, true,  true,  12),
  ('balance_amount',              'Balance',             'currency',  true,  false, false, true,  13),
  ('pending_item',                'Pending',             'dropdown',  true,  false, true,  true,  14),
  ('workflow_status',             'Status',              'dropdown',  true,  false, true,  true,  15),
  ('notes',                       'Remarks',             'textarea',  true,  false, true,  true,  16);

-- 3. Role permissions
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_add boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  menu_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_name, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "owners manage role permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]));
CREATE TRIGGER set_updated_at_role_permissions
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults for existing base roles
INSERT INTO public.role_permissions (role_name, module, can_view, can_add, can_edit, can_delete, can_export, menu_visible)
SELECT r.role_name, m.module,
       r.full_access, r.full_access, r.full_access, r.full_access, r.full_access, true
FROM (VALUES ('owner', true), ('admin', true), ('manager', true)) AS r(role_name, full_access)
CROSS JOIN (VALUES ('dashboard'), ('workflow'), ('schedule'), ('analytics'), ('master'), ('reports')) AS m(module);

INSERT INTO public.role_permissions (role_name, module, can_view, can_add, can_edit, can_delete, can_export, menu_visible) VALUES
  ('staff','dashboard', true, false, false, false, false, true),
  ('staff','workflow',  true, true,  true,  false, false, true),
  ('staff','schedule',  true, true,  true,  false, false, true),
  ('staff','analytics', false,false, false, false, false, false),
  ('staff','master',    false,false, false, false, false, false),
  ('staff','reports',   false,false, false, false, false, false),
  ('viewer','dashboard',true, false, false, false, false, true),
  ('viewer','workflow', true, false, false, false, false, true),
  ('viewer','schedule', true, false, false, false, false, true),
  ('viewer','analytics',true, false, false, false, false, true),
  ('viewer','master',   false,false, false, false, false, false),
  ('viewer','reports',  true, false, false, false, false, true);

-- 4. Soft delete + custom field values on workflow records
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_by_name text,
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 5. Permission resolution helper
CREATE OR REPLACE FUNCTION public.effective_role_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT lower(s.role_name) FROM public.staff s
      WHERE s.user_id = _user_id AND s.role_name IS NOT NULL AND s.is_active LIMIT 1),
    (SELECT ur.role::text FROM public.user_roles ur
      WHERE ur.user_id = _user_id
      ORDER BY CASE ur.role
        WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3
        WHEN 'staff' THEN 4 WHEN 'viewer' THEN 5 ELSE 6 END
      LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
  ok boolean;
BEGIN
  IF public.has_any_role(_user_id, ARRAY['admin','owner']::app_role[]) THEN
    RETURN true;
  END IF;
  r := public.effective_role_name(_user_id);
  IF r IS NULL THEN RETURN false; END IF;
  SELECT CASE _action
           WHEN 'view' THEN rp.can_view
           WHEN 'add' THEN rp.can_add
           WHEN 'edit' THEN rp.can_edit
           WHEN 'delete' THEN rp.can_delete
           WHEN 'export' THEN rp.can_export
           WHEN 'menu' THEN rp.menu_visible
           ELSE false END
    INTO ok
  FROM public.role_permissions rp
  WHERE lower(rp.role_name) = lower(r) AND rp.module = _module;
  RETURN COALESCE(ok, false);
END $$;