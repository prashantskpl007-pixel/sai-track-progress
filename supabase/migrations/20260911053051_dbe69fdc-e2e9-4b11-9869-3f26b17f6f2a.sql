-- 1. audit_log: remove open insert policy; trigger function becomes SECURITY DEFINER so system-triggered writes still work
DROP POLICY IF EXISTS "Backoffice insert audit" ON public.audit_log;

CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_log(actor_user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'old', CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
    )
  );
  RETURN COALESCE(NEW, OLD);
END $function$;

-- 2. role_permissions: restrict read to internal staff roles, not all authenticated users
DROP POLICY IF EXISTS "auth read role permissions" ON public.role_permissions;
CREATE POLICY "staff read role permissions" ON public.role_permissions
FOR SELECT TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin','owner','manager','staff','verification_partner','viewer']::app_role[])
  OR EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.is_active)
);

-- 3. kyc-documents storage: staff only for customers assigned to them (path = <application_number>/<file>)
DROP POLICY IF EXISTS "kyc_storage_staff" ON storage.objects;
CREATE POLICY "kyc_storage_staff" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND has_role(auth.uid(), 'staff'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.customers c
    JOIN public.staff s ON s.id = c.assigned_staff_id
    WHERE s.user_id = auth.uid()
      AND c.application_number = split_part(objects.name, '/', 1)
  )
)
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND has_role(auth.uid(), 'staff'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.customers c
    JOIN public.staff s ON s.id = c.assigned_staff_id
    WHERE s.user_id = auth.uid()
      AND c.application_number = split_part(objects.name, '/', 1)
  )
);

-- 4. verification-documents storage: partners only for cases assigned to them
DROP POLICY IF EXISTS "vd_storage_partner" ON storage.objects;
CREATE POLICY "vd_storage_partner" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'verification-documents'
  AND has_role(auth.uid(), 'verification_partner'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.verification_cases vc
    JOIN public.customers c ON c.id = vc.customer_id
    WHERE vc.assigned_partner_user_id = auth.uid()
      AND c.application_number = split_part(objects.name, '/', 1)
  )
)
WITH CHECK (
  bucket_id = 'verification-documents'
  AND has_role(auth.uid(), 'verification_partner'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.verification_cases vc
    JOIN public.customers c ON c.id = vc.customer_id
    WHERE vc.assigned_partner_user_id = auth.uid()
      AND c.application_number = split_part(objects.name, '/', 1)
  )
);