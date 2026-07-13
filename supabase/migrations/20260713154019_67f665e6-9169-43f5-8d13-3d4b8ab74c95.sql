
-- STAFF table
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  designation text NOT NULL DEFAULT 'Registration Executive',
  mobile_number text NOT NULL,
  email text NOT NULL UNIQUE,
  username text UNIQUE,
  profile_photo_url text,
  joining_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage staff" ON public.staff FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff view all staff" ON public.staff FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff update own profile" ON public.staff FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_staff_updated_at BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS agreement_charges numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registration_charges numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charges numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charges numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_received numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS agreement_downloaded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_customers_mobile ON public.customers(mobile_number);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(current_status);
CREATE INDEX IF NOT EXISTS idx_customers_assigned_staff ON public.customers(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers(created_at);

CREATE POLICY "Staff view assigned customers" ON public.customers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff')
    AND assigned_staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
  );
CREATE POLICY "Staff update assigned customers" ON public.customers FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff')
    AND assigned_staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
  );

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff view notifications for assigned" ON public.notifications FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff')
    AND customer_id IN (SELECT id FROM public.customers WHERE assigned_staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid()))
  );
CREATE POLICY "Customer views own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));
CREATE POLICY "Customer marks own read" ON public.notifications FOR UPDATE TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

CREATE INDEX idx_notifications_customer ON public.notifications(customer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_on_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_title text;
  v_message text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.current_status IS DISTINCT FROM OLD.current_status THEN
    CASE NEW.current_status
      WHEN 'draft_prepared' THEN
        v_title := 'Agreement Draft Ready';
        v_message := 'Your agreement draft for Application ' || NEW.application_number || ' is ready.';
      WHEN 'appointment_scheduled' THEN
        v_title := 'Appointment Scheduled';
        v_message := 'Your appointment has been scheduled' ||
          CASE WHEN NEW.appointment_date IS NOT NULL
               THEN ' for ' || to_char(NEW.appointment_date AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY at HH12:MI AM')
               ELSE '' END || '.';
      WHEN 'registration_submitted' THEN
        v_title := 'Registration Submitted';
        v_message := 'Your registration has been submitted to the sub-registrar office.';
      WHEN 'registration_completed' THEN
        v_title := 'Registration Completed';
        v_message := 'Your registration process has been completed successfully.';
      WHEN 'agreement_ready' THEN
        v_title := 'Agreement Ready';
        v_message := 'Your agreement is ready for download.';
      ELSE
        v_title := NULL;
    END CASE;
    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications(customer_id, title, message)
      VALUES (NEW.id, v_title, v_message);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_status AFTER UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_status_change();

-- INTERNAL NOTES
CREATE TABLE public.internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_notes TO authenticated;
GRANT ALL ON public.internal_notes TO service_role;
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notes" ON public.internal_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff manage notes on assigned" ON public.internal_notes FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff')
    AND customer_id IN (SELECT id FROM public.customers WHERE assigned_staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'staff')
    AND customer_id IN (SELECT id FROM public.customers WHERE assigned_staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid()))
  );

CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON public.internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated insert audit" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() OR actor_user_id IS NULL);

CREATE INDEX idx_audit_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_log(entity_type, entity_id);

CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
END $$;

CREATE TRIGGER trg_audit_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER trg_audit_staff AFTER INSERT OR UPDATE OR DELETE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ALERT RESOLUTIONS
CREATE TABLE public.alert_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(alert_key, customer_id)
);
GRANT SELECT, INSERT, DELETE ON public.alert_resolutions TO authenticated;
GRANT ALL ON public.alert_resolutions TO service_role;
ALTER TABLE public.alert_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin+staff manage alerts" ON public.alert_resolutions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Public function: fetch applications by mobile
CREATE OR REPLACE FUNCTION public.find_applications_by_mobile(_mobile text)
RETURNS TABLE(application_number text, customer_name text, current_status registration_status, agreement_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT application_number, customer_name, current_status, agreement_type
  FROM public.customers
  WHERE mobile_number = _mobile
  ORDER BY created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.find_applications_by_mobile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_applications_by_mobile(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_handled_by(_customer_id uuid)
RETURNS TABLE(full_name text, designation text, mobile_number text, profile_photo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.full_name, s.designation, s.mobile_number, s.profile_photo_url
  FROM public.customers c
  JOIN public.staff s ON s.id = c.assigned_staff_id
  WHERE c.id = _customer_id;
$$;
REVOKE ALL ON FUNCTION public.get_handled_by(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_handled_by(uuid) TO authenticated;
