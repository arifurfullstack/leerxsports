-- Public read for site-assets so favicons / OG images resolve without auth
CREATE POLICY "site-assets public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-assets');

-- Only admins can upload / update / delete
CREATE POLICY "site-assets admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "site-assets admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "site-assets admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));