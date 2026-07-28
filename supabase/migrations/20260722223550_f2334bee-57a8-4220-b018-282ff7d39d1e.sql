
-- Stories table (24h ephemeral status)
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image','video')),
  thumbnail_url TEXT,
  caption TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 5000,
  view_count INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

CREATE INDEX stories_user_idx ON public.stories (user_id, created_at DESC);
CREATE INDEX stories_active_idx ON public.stories (expires_at) WHERE is_hidden = FALSE;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view active stories"
  ON public.stories FOR SELECT TO authenticated
  USING (is_hidden = FALSE AND expires_at > now());

CREATE POLICY "Authors can view their own stories"
  ON public.stories FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authors can insert their own stories"
  ON public.stories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can update their own stories"
  ON public.stories FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can delete their own stories"
  ON public.stories FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Story views
CREATE TABLE public.story_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, viewer_id)
);

CREATE INDEX story_views_story_idx ON public.story_views (story_id);
CREATE INDEX story_views_viewer_idx ON public.story_views (viewer_id);

GRANT SELECT, INSERT, DELETE ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers can record their own view"
  ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Viewers see their own view records"
  ON public.story_views FOR SELECT TO authenticated
  USING (auth.uid() = viewer_id);

CREATE POLICY "Story authors see all views on their stories"
  ON public.story_views FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_id AND s.user_id = auth.uid()
  ));

-- Trigger: bump story view_count when a unique view is inserted
CREATE OR REPLACE FUNCTION public.bump_story_view()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.stories
    SET view_count = view_count + 1
    WHERE id = NEW.story_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER story_views_bump
  AFTER INSERT ON public.story_views
  FOR EACH ROW EXECUTE FUNCTION public.bump_story_view();
