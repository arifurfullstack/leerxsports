-- Fix column reference in tr_notify_follow trigger (trainer_id instead of following_id)
CREATE OR REPLACE FUNCTION public.tr_notify_follow() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  aname TEXT;
  target_id UUID;
BEGIN
  -- Handle trainer_id or following_id safely
  BEGIN
    target_id := NEW.trainer_id;
  EXCEPTION WHEN OTHERS THEN
    target_id := NULL;
  END;

  IF target_id IS NULL THEN
    BEGIN
      target_id := (to_jsonb(NEW)->>'following_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      target_id := NULL;
    END;
  END IF;

  IF target_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, username, 'Someone') INTO aname FROM public.profiles WHERE user_id = NEW.follower_id;
  PERFORM public.create_notification(
    target_id,
    'follow',
    aname || ' followed you',
    NULL,
    NEW.follower_id,
    'profile',
    NEW.follower_id,
    '/u/' || COALESCE((SELECT username FROM public.profiles WHERE user_id = NEW.follower_id), ''),
    '{}'::jsonb
  );
  RETURN NEW;
END; $$;
