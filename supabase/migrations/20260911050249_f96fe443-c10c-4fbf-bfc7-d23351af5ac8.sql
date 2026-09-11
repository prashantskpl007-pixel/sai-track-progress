REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.effective_role_name(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_handled_by(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_applications_by_mobile(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_role_name(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_first_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_handled_by(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_applications_by_mobile(text) TO service_role;