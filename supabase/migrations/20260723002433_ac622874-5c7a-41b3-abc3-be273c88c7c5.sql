CREATE OR REPLACE FUNCTION public.notify_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE aname text;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO aname FROM public.profiles WHERE user_id = NEW.follower_id;
  PERFORM public.create_notification(NEW.trainer_id, 'follow', aname || ' followed you', NULL, NEW.follower_id, 'profile', NEW.follower_id, '/u/' || COALESCE((SELECT username FROM public.profiles WHERE user_id = NEW.follower_id), ''), '{}'::jsonb);
  RETURN NEW;
END $$;