
CREATE POLICY "Admins manage agreement files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'agreements' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'agreements' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers read own agreement" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'agreements'
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.user_id = auth.uid() AND c.agreement_pdf_path = storage.objects.name
    )
  );
