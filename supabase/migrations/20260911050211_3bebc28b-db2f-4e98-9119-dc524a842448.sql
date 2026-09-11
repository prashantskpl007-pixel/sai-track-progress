-- 1) Audit log: only privileged roles may insert, and only as themselves
DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_log;
CREATE POLICY "Backoffice insert audit" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    (actor_user_id IS NULL OR actor_user_id = auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['admin','owner','manager','staff','verification_partner']::app_role[])
  );

-- 2) customer_remarks: scope staff/partner inserts to assigned customers
DROP POLICY IF EXISTS "Backoffice can add remarks" ON public.customer_remarks;
CREATE POLICY "Backoffice can add remarks" ON public.customer_remarks
  FOR INSERT TO authenticated
  WITH CHECK (
    (author_user_id IS NULL OR author_user_id = auth.uid())
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::app_role[])
      OR (
        public.has_role(auth.uid(), 'staff'::app_role)
        AND EXISTS (
          SELECT 1 FROM public.customers c
          JOIN public.staff s ON s.id = c.assigned_staff_id
          WHERE c.id = customer_remarks.customer_id AND s.user_id = auth.uid()
        )
      )
      OR (
        public.has_role(auth.uid(), 'verification_partner'::app_role)
        AND EXISTS (
          SELECT 1 FROM public.verification_cases vc
          WHERE vc.customer_id = customer_remarks.customer_id
            AND vc.assigned_partner_user_id = auth.uid()
        )
      )
    )
  );

-- 3) payment_history: scope staff inserts to assigned customers
DROP POLICY IF EXISTS "payment_history_insert" ON public.payment_history;
CREATE POLICY "payment_history_insert" ON public.payment_history
  FOR INSERT TO authenticated
  WITH CHECK (
    (updated_by IS NULL OR updated_by = auth.uid())
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin','owner','manager']::app_role[])
      OR (
        public.has_role(auth.uid(), 'staff'::app_role)
        AND EXISTS (
          SELECT 1 FROM public.customers c
          JOIN public.staff s ON s.id = c.assigned_staff_id
          WHERE c.id = payment_history.customer_id AND s.user_id = auth.uid()
        )
      )
    )
  );

-- 4) Lock down SECURITY DEFINER functions exposed on the API
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.effective_role_name(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_handled_by(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_applications_by_mobile(text) FROM anon, authenticated;