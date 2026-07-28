
DROP POLICY IF EXISTS "Trainers can insert own posts" ON public.posts;
CREATE POLICY "Users can insert own posts" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (trainer_id = auth.uid());

DROP POLICY IF EXISTS "Trainers can upload own post media" ON storage.objects;
CREATE POLICY "Users can upload own post media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
