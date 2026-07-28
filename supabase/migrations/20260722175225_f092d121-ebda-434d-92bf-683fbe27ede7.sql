CREATE OR REPLACE FUNCTION public.tr_notify_post_respect()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE aname TEXT; owner UUID;
BEGIN
  SELECT trainer_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Someone') INTO aname FROM public.profiles WHERE user_id = NEW.user_id;
  PERFORM public.create_notification(owner, 'respect', aname || ' respected your post', NULL, NEW.user_id, 'post', NEW.post_id, NULL, '{}'::jsonb);
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tr_notify_post_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE aname TEXT; owner UUID;
BEGIN
  IF NEW.status <> 'visible' THEN RETURN NEW; END IF;
  SELECT trainer_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Someone') INTO aname FROM public.profiles WHERE user_id = NEW.author_id;
  PERFORM public.create_notification(owner, 'comment', aname || ' commented on your post', LEFT(COALESCE(NEW.text,''),160), NEW.author_id, 'post', NEW.post_id, NULL, '{}'::jsonb);
  RETURN NEW;
END; $function$;