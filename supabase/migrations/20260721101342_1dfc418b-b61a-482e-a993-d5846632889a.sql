
CREATE OR REPLACE FUNCTION public.bump_community_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_trainer BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'visible' THEN
    UPDATE public.community_posts
       SET comment_count = comment_count + 1
     WHERE id = NEW.post_id;
    SELECT public.has_role(NEW.author_id, 'trainer') INTO is_trainer;
    IF is_trainer THEN
      UPDATE public.community_posts SET trainer_answered = true WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'visible' THEN
    UPDATE public.community_posts
       SET comment_count = GREATEST(0, comment_count - 1)
     WHERE id = OLD.post_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'visible' AND NEW.status <> 'visible' THEN
      UPDATE public.community_posts
         SET comment_count = GREATEST(0, comment_count - 1)
       WHERE id = NEW.post_id;
    ELSIF OLD.status <> 'visible' AND NEW.status = 'visible' THEN
      UPDATE public.community_posts
         SET comment_count = comment_count + 1
       WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bump_community_respect()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET respect_count = respect_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET respect_count = GREATEST(0, respect_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
