ALTER TABLE public.field_configs ADD COLUMN IF NOT EXISTS default_value text;

CREATE TABLE IF NOT EXISTS public.field_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_config_id uuid NOT NULL REFERENCES public.field_configs(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (field_config_id, label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_options TO authenticated;
GRANT ALL ON public.field_options TO service_role;

ALTER TABLE public.field_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read field options"
  ON public.field_options FOR SELECT TO authenticated USING (true);

CREATE POLICY "Master editors can manage field options"
  ON public.field_options FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]) OR public.has_permission(auth.uid(),'master','edit'))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]) OR public.has_permission(auth.uid(),'master','edit'));

CREATE TRIGGER field_options_set_updated_at
  BEFORE UPDATE ON public.field_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Source becomes a managed dropdown
UPDATE public.field_configs SET field_type = 'dropdown' WHERE field_key = 'source_agent';

-- Payment mode field
INSERT INTO public.field_configs (field_key, label, field_type, options, is_system, is_enabled, is_required, show_in_registration, show_in_workflow, sort_order)
SELECT 'payment_method', 'Payment Mode', 'dropdown', '[]'::jsonb, false, true, false, true, false, 17
WHERE NOT EXISTS (SELECT 1 FROM public.field_configs WHERE field_key = 'payment_method');

-- Seed options from existing masters
INSERT INTO public.field_options (field_config_id, label, sort_order, is_active)
SELECT fc.id, m.label, m.sort_order, m.is_active
FROM public.field_configs fc JOIN public.master_pending_reasons m ON true
WHERE fc.field_key = 'pending_item'
ON CONFLICT (field_config_id, label) DO NOTHING;

INSERT INTO public.field_options (field_config_id, label, sort_order, is_active)
SELECT fc.id, m.label, m.sort_order, m.is_active
FROM public.field_configs fc JOIN public.master_workflow_statuses m ON true
WHERE fc.field_key = 'workflow_status'
ON CONFLICT (field_config_id, label) DO NOTHING;

INSERT INTO public.field_options (field_config_id, label, sort_order, is_active)
SELECT fc.id, m.label, m.sort_order, m.is_active
FROM public.field_configs fc JOIN public.master_verification_statuses m ON true
WHERE fc.field_key = 'verification_noc_status'
ON CONFLICT (field_config_id, label) DO NOTHING;

INSERT INTO public.field_options (field_config_id, label, sort_order)
SELECT fc.id, v.label, v.ord
FROM public.field_configs fc
JOIN (VALUES ('Rent Agreement',1),('Sale Deed',2),('Gift Deed',3),('Power of Attorney',4),('Affidavit',5),('MOU / Agreement',6),('Notary',7)) AS v(label, ord) ON true
WHERE fc.field_key = 'work_type'
ON CONFLICT (field_config_id, label) DO NOTHING;

INSERT INTO public.field_options (field_config_id, label, sort_order)
SELECT fc.id, v.label, v.ord
FROM public.field_configs fc
JOIN (VALUES ('Office Registration',1),('Doorstep (Home Visit)',2),('Sub-Registrar Office',3),('Online / e-Registration',4)) AS v(label, ord) ON true
WHERE fc.field_key = 'registration_handling_type'
ON CONFLICT (field_config_id, label) DO NOTHING;

INSERT INTO public.field_options (field_config_id, label, sort_order)
SELECT fc.id, v.label, v.ord
FROM public.field_configs fc
JOIN (VALUES ('Cash',1),('UPI',2),('Bank Transfer',3),('Cheque',4),('Card',5)) AS v(label, ord) ON true
WHERE fc.field_key = 'payment_method'
ON CONFLICT (field_config_id, label) DO NOTHING;

INSERT INTO public.field_options (field_config_id, label, sort_order)
SELECT fc.id, s.source_agent, row_number() OVER (ORDER BY s.source_agent)
FROM public.field_configs fc
JOIN (SELECT DISTINCT source_agent FROM public.customers WHERE source_agent IS NOT NULL AND btrim(source_agent) <> '') s ON true
WHERE fc.field_key = 'source_agent'
ON CONFLICT (field_config_id, label) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.field_options;
ALTER PUBLICATION supabase_realtime ADD TABLE public.field_configs;