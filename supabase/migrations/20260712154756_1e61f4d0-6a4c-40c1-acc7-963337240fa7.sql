
-- Storage RLS policies for post-media bucket
CREATE POLICY "Trainers can upload own post media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_role(auth.uid(), 'trainer')
  );

CREATE POLICY "Trainers can update own post media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Trainers can delete own post media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Post media is readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'post-media');
