CREATE OR REPLACE FUNCTION public.tr_notify_story_view()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  owner UUID;
  aname TEXT;
  ahandle TEXT;
  aavatar TEXT;
BEGIN
  SELECT user_id INTO owner FROM public.stories WHERE id = NEW.story_id;
  IF owner IS NULL OR owner = NEW.viewer_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(display_name, username, 'Someone'), username, avatar_url
    INTO aname, ahandle, aavatar
    FROM public.profiles WHERE user_id = NEW.viewer_id;
  PERFORM public.create_notification(
    owner,
    'story_view',
    COALESCE(aname, 'Someone') || ' viewed your story',
    NULL,
    NEW.viewer_id,
    'story',
    NEW.story_id,
    '/home?story=' || NEW.story_id::text,
    jsonb_build_object(
      'story_id', NEW.story_id,
      'viewer_id', NEW.viewer_id,
      'viewer_name', aname,
      'viewer_username', ahandle,
      'viewer_avatar_url', aavatar
    )
  );
  RETURN NEW;
END;
$function$;