-- Paid media must never be downloadable through a public bucket URL.
UPDATE storage.buckets
SET public = false
WHERE id = 'post-media';

DROP POLICY IF EXISTS "Post media is readable" ON storage.objects;
DROP POLICY IF EXISTS "Public free post media" ON storage.objects;
DROP POLICY IF EXISTS "Paid post media requires entitlement" ON storage.objects;
DROP POLICY IF EXISTS "Owners can read own post media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read social media" ON storage.objects;
DROP POLICY IF EXISTS "Public transformation media" ON storage.objects;

CREATE POLICY "Public free post media"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'post-media'
  AND EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE (p.media_url = storage.objects.name OR p.thumbnail_url = storage.objects.name)
      AND p.is_premium = false
      AND p.is_published = true
      AND p.is_hidden = false
  )
);

CREATE POLICY "Paid post media requires entitlement"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'post-media'
  AND EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE (p.media_url = storage.objects.name OR p.thumbnail_url = storage.objects.name)
      AND p.is_premium = true
      AND (
        p.trainer_id = auth.uid()
        OR public.has_active_subscription(auth.uid(), p.trainer_id)
        OR EXISTS (
          SELECT 1
          FROM public.post_unlocks u
          WHERE u.post_id = p.id
            AND u.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Owners can read own post media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'post-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Preserve the existing signed-media behaviour for social surfaces that share
-- this bucket. Community URLs are signed at upload; stories are signed for
-- authenticated viewers; transformations remain publicly viewable.
CREATE POLICY "Authenticated users can read social media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'post-media'
  AND (storage.foldername(name))[2] IN ('community', 'stories')
);

CREATE POLICY "Public transformation media"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'post-media'
  AND (storage.foldername(name))[1] = 'transformations'
);

-- Repair the supplied demo creator so subscription and one-off unlock flows
-- have a real trainer profile and server-priced premium content.
DO $$
DECLARE
  v_creator_id UUID;
BEGIN
  SELECT id INTO v_creator_id
  FROM auth.users
  WHERE lower(email) = 'coach-nova@leerdemo.local'
  LIMIT 1;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Demo creator account coach-nova@leerdemo.local is missing';
  END IF;

  UPDATE public.profiles
  SET username = 'coach_nova_demo',
      display_name = 'Coach Nova',
      full_name = COALESCE(NULLIF(full_name, ''), 'Coach Nova'),
      bio = COALESCE(NULLIF(bio, ''), 'Swim technique and conditioning coach.'),
      onboarding_completed = true,
      updated_at = now()
  WHERE user_id = v_creator_id;

  INSERT INTO public.trainer_profiles (
    user_id,
    value_proposition,
    specialties,
    subscription_price,
    is_verified,
    monetization_enabled,
    is_demo
  )
  VALUES (
    v_creator_id,
    'Improve your stroke, pacing, and conditioning with a clear weekly plan.',
    ARRAY['Swimming', 'Conditioning'],
    19.99,
    true,
    true,
    true
  )
  ON CONFLICT (user_id) DO UPDATE
  SET value_proposition = EXCLUDED.value_proposition,
      specialties = EXCLUDED.specialties,
      subscription_price = EXCLUDED.subscription_price,
      is_verified = true,
      monetization_enabled = true,
      is_demo = true,
      updated_at = now();

  UPDATE public.posts
  SET unlock_price = 7.00,
      updated_at = now()
  WHERE trainer_id = v_creator_id
    AND is_premium = true
    AND (unlock_price IS NULL OR unlock_price <= 0);
END;
$$;
