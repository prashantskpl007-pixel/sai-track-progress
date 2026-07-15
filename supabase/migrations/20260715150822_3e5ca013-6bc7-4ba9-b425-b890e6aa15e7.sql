
-- has_any_role helper
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles)) $$;

-- Verification cases
CREATE TABLE IF NOT EXISTS public.verification_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  assigned_partner_user_id uuid,
  assigned_partner_name text,
  assigned_at timestamptz,
  status public.verification_status NOT NULL DEFAULT 'pending_assignment',
  scheduled_date timestamptz,
  actual_verification_date timestamptz,
  completion_date timestamptz,
  verification_time text,
  verification_location text,
  verification_remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_cases TO authenticated;
GRANT ALL ON public.verification_cases TO service_role;
ALTER TABLE public.verification_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vc_admin_all" ON public.verification_cases FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::public.app_role[]));
CREATE POLICY "vc_viewer_read" ON public.verification_cases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "vc_partner_read" ON public.verification_cases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'verification_partner') AND assigned_partner_user_id = auth.uid());
CREATE POLICY "vc_partner_update" ON public.verification_cases FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'verification_partner') AND assigned_partner_user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'verification_partner') AND assigned_partner_user_id = auth.uid());
CREATE POLICY "vc_staff_assigned_read" ON public.verification_cases FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff') AND EXISTS (
      SELECT 1 FROM public.customers c JOIN public.staff s ON s.id = c.assigned_staff_id
      WHERE c.id = verification_cases.customer_id AND s.user_id = auth.uid()
    )
  );

-- KYC documents
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  document_type public.kyc_document_type NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  remarks text,
  uploaded_by uuid,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_documents TO authenticated;
GRANT ALL ON public.kyc_documents TO service_role;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kyc_admin_all" ON public.kyc_documents FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::public.app_role[]));
CREATE POLICY "kyc_viewer_read" ON public.kyc_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "kyc_staff_assigned" ON public.kyc_documents FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff') AND EXISTS (
      SELECT 1 FROM public.customers c JOIN public.staff s ON s.id = c.assigned_staff_id
      WHERE c.id = kyc_documents.customer_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'staff') AND EXISTS (
      SELECT 1 FROM public.customers c JOIN public.staff s ON s.id = c.assigned_staff_id
      WHERE c.id = kyc_documents.customer_id AND s.user_id = auth.uid()
    )
  );
CREATE POLICY "kyc_partner_read" ON public.kyc_documents FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'verification_partner') AND EXISTS (
      SELECT 1 FROM public.verification_cases vc
      WHERE vc.customer_id = kyc_documents.customer_id AND vc.assigned_partner_user_id = auth.uid()
    )
  );

-- Verification documents
CREATE TABLE IF NOT EXISTS public.verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_case_id uuid NOT NULL REFERENCES public.verification_cases(id) ON DELETE CASCADE,
  document_type public.verification_document_type NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  remarks text,
  uploaded_by uuid,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_documents TO authenticated;
GRANT ALL ON public.verification_documents TO service_role;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vd_admin_all" ON public.verification_documents FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::public.app_role[]));
CREATE POLICY "vd_viewer_read" ON public.verification_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "vd_partner_own" ON public.verification_documents FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'verification_partner') AND EXISTS (
      SELECT 1 FROM public.verification_cases vc
      WHERE vc.id = verification_documents.verification_case_id AND vc.assigned_partner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'verification_partner') AND EXISTS (
      SELECT 1 FROM public.verification_cases vc
      WHERE vc.id = verification_documents.verification_case_id AND vc.assigned_partner_user_id = auth.uid()
    )
  );

-- Triggers
CREATE TRIGGER kyc_documents_set_updated_at BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER verification_cases_set_updated_at BEFORE UPDATE ON public.verification_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER kyc_documents_audit AFTER INSERT OR UPDATE OR DELETE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER verification_cases_audit AFTER INSERT OR UPDATE OR DELETE ON public.verification_cases
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER verification_documents_audit AFTER INSERT OR UPDATE OR DELETE ON public.verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE OR REPLACE FUNCTION public.auto_create_verification_case()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.verification_cases(customer_id) VALUES (NEW.id)
    ON CONFLICT (customer_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER customers_auto_verification_case AFTER INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_verification_case();

-- Backfill verification cases for existing customers
INSERT INTO public.verification_cases(customer_id)
SELECT id FROM public.customers ON CONFLICT (customer_id) DO NOTHING;

-- Grant existing admins the owner role
INSERT INTO public.user_roles(user_id, role)
SELECT user_id, 'owner'::public.app_role FROM public.user_roles WHERE role = 'admin'
ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "kyc_storage_admin" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.has_any_role(auth.uid(), ARRAY['admin','owner','manager','viewer']::public.app_role[]))
  WITH CHECK (bucket_id = 'kyc-documents' AND public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::public.app_role[]));
CREATE POLICY "kyc_storage_staff" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'staff'))
  WITH CHECK (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'staff'));
CREATE POLICY "kyc_storage_partner_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'verification_partner'));
CREATE POLICY "vd_storage_admin" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'verification-documents' AND public.has_any_role(auth.uid(), ARRAY['admin','owner','manager','viewer']::public.app_role[]))
  WITH CHECK (bucket_id = 'verification-documents' AND public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::public.app_role[]));
CREATE POLICY "vd_storage_partner" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'verification-documents' AND public.has_role(auth.uid(), 'verification_partner'))
  WITH CHECK (bucket_id = 'verification-documents' AND public.has_role(auth.uid(), 'verification_partner'));
