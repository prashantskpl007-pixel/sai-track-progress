REVOKE EXECUTE ON FUNCTION public.log_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit() TO service_role;