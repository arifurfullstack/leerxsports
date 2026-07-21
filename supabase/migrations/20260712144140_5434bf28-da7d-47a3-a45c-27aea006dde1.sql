-- Revoke direct EXECUTE on security definer functions from public
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Revoke direct EXECUTE on trigger functions from authenticated users
-- (they are only invoked by triggers, never by app code)
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- The role checker is referenced by RLS policies, so authenticated users
-- must be able to invoke it when their queries trigger policy checks.
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
