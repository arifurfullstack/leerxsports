
-- Posts table for trainer content
CREATE TYPE public.post_kind AS ENUM ('feed', 'short');

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.post_kind NOT NULL DEFAULT 'feed',
  is_premium boolean NOT NULL DEFAULT false,
  caption text,
  media_url text NOT NULL,
  thumbnail_url text,
  duration_seconds integer,
  respect_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX posts_trainer_idx ON public.posts(trainer_id, created_at DESC);
CREATE INDEX posts_kind_idx ON public.posts(kind, created_at DESC) WHERE is_published;

GRANT SELECT ON public.posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Anyone can see published posts (media_url of premium posts will be gated server-side later)
CREATE POLICY "Published posts are viewable by everyone"
  ON public.posts FOR SELECT
  USING (is_published = true OR trainer_id = auth.uid());

-- Only trainers (owner) can insert/update/delete their own posts
CREATE POLICY "Trainers can insert own posts"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (trainer_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Trainers can update own posts"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "Trainers can delete own posts"
  ON public.posts FOR DELETE
  TO authenticated
  USING (trainer_id = auth.uid());

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow public read of trainer profiles rows already exists; ensure public can read approved trainer_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trainer_profiles'
      AND policyname = 'Trainer profiles are publicly readable'
  ) THEN
    CREATE POLICY "Trainer profiles are publicly readable"
      ON public.trainer_profiles FOR SELECT
      USING (true);
  END IF;
END$$;

-- Allow public read of profiles (safe fields) - if no such policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Profiles are publicly readable'
  ) THEN
    CREATE POLICY "Profiles are publicly readable"
      ON public.profiles FOR SELECT
      USING (true);
  END IF;
END$$;

GRANT SELECT ON public.trainer_profiles TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.user_roles TO anon;
