CREATE POLICY "Public can read follows for counts"
ON public.follows
FOR SELECT
TO anon
USING (true);

GRANT SELECT ON public.follows TO anon;