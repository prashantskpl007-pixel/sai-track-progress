-- 1. Field configuration becomes module-aware
ALTER TABLE public.field_configs ADD COLUMN IF NOT EXISTS module text NOT NULL DEFAULT 'workflow';
ALTER TABLE public.field_configs DROP CONSTRAINT IF EXISTS field_configs_field_key_key;
DROP INDEX IF EXISTS public.field_configs_field_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS field_configs_module_field_key_key
  ON public.field_configs (module, field_key);

-- 2. Enquiry records
CREATE TABLE IF NOT EXISTS public.enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_date date NOT NULL DEFAULT CURRENT_DATE,
  client_name text NOT NULL,
  reference text,
  work_type text,
  property text,
  rent_deposit text,
  fees numeric,
  client_fees numeric,
  remark text,
  enquiry_status text,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_by_name text,
  deleted_at timestamp with time zone,
  deleted_by uuid REFERENCES auth.users(id),
  deleted_by_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquiries TO authenticated;
GRANT ALL ON public.enquiries TO service_role;

ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enquiry view by permission" ON public.enquiries
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'enquiry', 'view'));

CREATE POLICY "Enquiry add by permission" ON public.enquiries
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'enquiry', 'add'));

CREATE POLICY "Enquiry edit by permission" ON public.enquiries
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'enquiry', 'edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'enquiry', 'edit'));

CREATE POLICY "Enquiry delete by permission" ON public.enquiries
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'enquiry', 'delete'));

CREATE TRIGGER enquiries_set_updated_at
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Default Enquiry field configuration
INSERT INTO public.field_configs
  (module, field_key, label, field_type, options, is_system, is_enabled, is_required,
   show_in_registration, show_in_workflow, sort_order)
VALUES
  ('enquiry','enquiry_date','Date','date','[]'::jsonb,true,true,true,true,true,1),
  ('enquiry','client_name','Client Name','text','[]'::jsonb,true,true,true,true,true,2),
  ('enquiry','reference','Reference','text','[]'::jsonb,true,true,false,true,true,3),
  ('enquiry','work_type','Type of Work','dropdown','[]'::jsonb,true,true,false,true,true,4),
  ('enquiry','property','Property','text','[]'::jsonb,true,true,false,true,true,5),
  ('enquiry','rent_deposit','Rent / Deposit','textarea','[]'::jsonb,true,true,false,true,true,6),
  ('enquiry','fees','Fees','currency','[]'::jsonb,true,true,false,true,true,7),
  ('enquiry','client_fees','Client Fees','currency','[]'::jsonb,true,true,false,true,true,8),
  ('enquiry','remark','Remark','textarea','[]'::jsonb,true,true,false,true,true,9),
  ('enquiry','enquiry_status','Enquiry Status','dropdown','[]'::jsonb,true,true,false,true,true,10)
ON CONFLICT (module, field_key) DO NOTHING;

-- 4. Default dropdown values
INSERT INTO public.field_options (field_config_id, label, sort_order, is_active)
SELECT fc.id, v.label, v.ord, true
FROM public.field_configs fc
JOIN (VALUES
  ('New Enquiry',1),('In Discussion',2),('Quotation Sent',3),
  ('Converted',4),('On Hold',5),('Not Interested',6)
) AS v(label, ord) ON true
WHERE fc.module = 'enquiry' AND fc.field_key = 'enquiry_status';

INSERT INTO public.field_options (field_config_id, label, sort_order, is_active)
SELECT fc.id, v.label, v.ord, true
FROM public.field_configs fc
JOIN (VALUES
  ('Rent Agreement',1),('Leave & License',2),('Sale Deed',3),
  ('Gift Deed',4),('Other',5)
) AS v(label, ord) ON true
WHERE fc.module = 'enquiry' AND fc.field_key = 'work_type';

-- 5. Role permission rows for the new module (owner/admin bypass these)
INSERT INTO public.role_permissions (role_name, module, can_view, can_add, can_edit, can_delete, can_export, menu_visible)
SELECT DISTINCT rp.role_name, 'enquiry', false, false, false, false, false, false
FROM public.role_permissions rp
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions x WHERE x.role_name = rp.role_name AND x.module = 'enquiry'
);