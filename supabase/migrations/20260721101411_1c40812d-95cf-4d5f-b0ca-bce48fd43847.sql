
REVOKE EXECUTE ON FUNCTION public.bump_community_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_community_respect() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_post_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_post_respect() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_post_save() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tr_notify_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tr_notify_tip() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tr_notify_coaching_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tr_notify_post_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tr_notify_post_respect() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tr_notify_follow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_hide_on_reports() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
