
-- 1) Extend profiles with visibility + PRs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_visibility text NOT NULL DEFAULT 'public'
    CHECK (profile_visibility IN ('public','subscribers','private')),
  ADD COLUMN IF NOT EXISTS transformation_visibility text NOT NULL DEFAULT 'public'
    CHECK (transformation_visibility IN ('public','subscribers','private')),
  ADD COLUMN IF NOT EXISTS personal_records text;

-- 2) transformation_posts table
CREATE TABLE public.transformation_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo','video')),
  media_url text NOT NULL,
  thumbnail_url text,
  view_angle text NOT NULL DEFAULT 'front' CHECK (view_angle IN ('front','side','back','other')),
  captured_on date NOT NULL,
  weight_kg numeric(6,2),
  body_fat_percent numeric(5,2),
  notes text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','subscribers','private')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transformation_posts_user_captured
  ON public.transformation_posts (user_id, captured_on DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transformation_posts TO authenticated;
GRANT SELECT ON public.transformation_posts TO anon;
GRANT ALL ON public.transformation_posts TO service_role;

ALTER TABLE public.transformation_posts ENABLE ROW LEVEL SECURITY;

-- Public rows visible to everyone (anon + authenticated)
CREATE POLICY "Public transformation posts are viewable"
  ON public.transformation_posts FOR SELECT
  TO anon, authenticated
  USING (visibility = 'public');

-- Owner sees all their rows regardless of visibility
CREATE POLICY "Owners can view own transformation posts"
  ON public.transformation_posts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins see everything
CREATE POLICY "Admins can view all transformation posts"
  ON public.transformation_posts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert own transformation posts"
  ON public.transformation_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners update own transformation posts"
  ON public.transformation_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners delete own transformation posts"
  ON public.transformation_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage transformation posts"
  ON public.transformation_posts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_transformation_posts_updated
  BEFORE UPDATE ON public.transformation_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Storage: allow any authenticated user to upload their own transformation media
--    under transformations/{uid}/… inside the existing post-media bucket.
CREATE POLICY "Users upload own transformation media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = 'transformations'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
