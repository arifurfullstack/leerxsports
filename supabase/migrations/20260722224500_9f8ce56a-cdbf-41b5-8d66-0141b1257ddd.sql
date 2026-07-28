
CREATE OR REPLACE FUNCTION public.tr_notify_story_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  owner UUID;
  aname TEXT;
BEGIN
  SELECT user_id INTO owner FROM public.stories WHERE id = NEW.story_id;
  IF owner IS NULL OR owner = NEW.viewer_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(display_name, username, 'Someone')
    INTO aname FROM public.profiles WHERE user_id = NEW.viewer_id;
  PERFORM public.create_notification(
    owner,
    'story_view',
    COALESCE(aname, 'Someone') || ' viewed your story',
    NULL,
    NEW.viewer_id,
    'story',
    NEW.story_id,
    '/home',
    '{}'::jsonb
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS story_views_notify ON public.story_views;
CREATE TRIGGER story_views_notify
  AFTER INSERT ON public.story_views
  FOR EACH ROW EXECUTE FUNCTION public.tr_notify_story_view();
