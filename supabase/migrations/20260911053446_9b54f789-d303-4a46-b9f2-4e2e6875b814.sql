CREATE SCHEMA IF NOT EXISTS private;

-- Privileged implementations (not exposed through the API schema)
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION private.effective_role_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION private.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
  ok boolean;
BEGIN
  IF private.has_any_role(_user_id, ARRAY['admin','owner']::public.app_role[]) THEN
    RETURN true;
  END IF;
  r := private.effective_role_name(_user_id);
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

CREATE OR REPLACE FUNCTION private.claim_first_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.effective_role_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.has_permission(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.claim_first_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION private.has_any_role(uuid, public.app_role[]) TO service_role;
GRANT EXECUTE ON FUNCTION private.effective_role_name(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.has_permission(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION private.claim_first_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_any_role(uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION private.effective_role_name(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_permission(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.claim_first_admin(uuid) TO authenticated;

-- Public wrappers become SECURITY INVOKER pass-throughs (no longer flagged),
-- keeping every existing policy and RPC call working unchanged.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.has_role(_user_id, _role) $$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.has_any_role(_user_id, _roles) $$;

CREATE OR REPLACE FUNCTION public.effective_role_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.effective_role_name(_user_id) $$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.has_permission(_user_id, _module, _action) $$;

CREATE OR REPLACE FUNCTION public.claim_first_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.claim_first_admin(_user_id) $$;