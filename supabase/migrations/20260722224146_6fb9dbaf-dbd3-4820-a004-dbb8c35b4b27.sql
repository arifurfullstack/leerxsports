
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.story_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.story_likes TO authenticated;
GRANT ALL ON public.story_likes TO service_role;

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read story likes"
  ON public.story_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can like as themselves"
  ON public.story_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own like"
  ON public.story_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS story_likes_story_idx ON public.story_likes(story_id);
CREATE INDEX IF NOT EXISTS story_likes_user_idx ON public.story_likes(user_id);

CREATE OR REPLACE FUNCTION public.bump_story_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stories SET like_count = like_count + 1 WHERE id = NEW.story_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stories SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.story_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_story_like_bump ON public.story_likes;
CREATE TRIGGER tr_story_like_bump
AFTER INSERT OR DELETE ON public.story_likes
FOR EACH ROW EXECUTE FUNCTION public.bump_story_like();
