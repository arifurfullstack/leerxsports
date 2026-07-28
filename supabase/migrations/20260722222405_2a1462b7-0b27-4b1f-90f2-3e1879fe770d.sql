
CREATE TABLE IF NOT EXISTS public.user_upload_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  uploads_today INTEGER NOT NULL DEFAULT 0,
  uploads_day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_upload_stats TO authenticated;
GRANT ALL ON public.user_upload_stats TO service_role;

ALTER TABLE public.user_upload_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own upload stats"
  ON public.user_upload_stats
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Read current quota + limits
CREATE OR REPLACE FUNCTION public.get_upload_quota()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  row_uploads INTEGER := 0;
  row_bytes BIGINT := 0;
  row_day DATE := (now() AT TIME ZONE 'utc')::date;
  daily_limit INTEGER := 20;
  storage_limit BIGINT := 2147483648; -- 2 GB
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT uploads_today, total_bytes, uploads_day
    INTO row_uploads, row_bytes, row_day
    FROM public.user_upload_stats WHERE user_id = uid;
  IF NOT FOUND THEN
    row_uploads := 0; row_bytes := 0; row_day := (now() AT TIME ZONE 'utc')::date;
  END IF;
  IF row_day <> (now() AT TIME ZONE 'utc')::date THEN
    row_uploads := 0;
  END IF;
  RETURN jsonb_build_object(
    'uploads_today', row_uploads,
    'uploads_limit', daily_limit,
    'uploads_remaining', GREATEST(0, daily_limit - row_uploads),
    'storage_used', row_bytes,
    'storage_limit', storage_limit,
    'storage_remaining', GREATEST(0, storage_limit - row_bytes)
  );
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_upload_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_upload_quota() TO authenticated;

-- Atomic check + record
CREATE OR REPLACE FUNCTION public.try_record_upload(_bytes BIGINT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  today DATE := (now() AT TIME ZONE 'utc')::date;
  daily_limit INTEGER := 20;
  storage_limit BIGINT := 2147483648;
  cur_uploads INTEGER := 0;
  cur_bytes BIGINT := 0;
  cur_day DATE := today;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _bytes IS NULL OR _bytes < 0 THEN
    RAISE EXCEPTION 'invalid bytes';
  END IF;

  INSERT INTO public.user_upload_stats(user_id) VALUES (uid)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT uploads_today, total_bytes, uploads_day
    INTO cur_uploads, cur_bytes, cur_day
    FROM public.user_upload_stats WHERE user_id = uid FOR UPDATE;

  IF cur_day <> today THEN
    cur_uploads := 0; cur_day := today;
  END IF;

  IF cur_uploads + 1 > daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit',
      'uploads_today', cur_uploads,
      'uploads_limit', daily_limit,
      'uploads_remaining', 0,
      'storage_used', cur_bytes,
      'storage_limit', storage_limit,
      'storage_remaining', GREATEST(0, storage_limit - cur_bytes)
    );
  END IF;

  IF cur_bytes + _bytes > storage_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'storage_limit',
      'uploads_today', cur_uploads,
      'uploads_limit', daily_limit,
      'uploads_remaining', GREATEST(0, daily_limit - cur_uploads),
      'storage_used', cur_bytes,
      'storage_limit', storage_limit,
      'storage_remaining', GREATEST(0, storage_limit - cur_bytes)
    );
  END IF;

  UPDATE public.user_upload_stats
    SET uploads_today = cur_uploads + 1,
        uploads_day = today,
        total_bytes = cur_bytes + _bytes,
        updated_at = now()
    WHERE user_id = uid;

  RETURN jsonb_build_object(
    'allowed', true,
    'uploads_today', cur_uploads + 1,
    'uploads_limit', daily_limit,
    'uploads_remaining', daily_limit - (cur_uploads + 1),
    'storage_used', cur_bytes + _bytes,
    'storage_limit', storage_limit,
    'storage_remaining', storage_limit - (cur_bytes + _bytes)
  );
END; $$;

REVOKE EXECUTE ON FUNCTION public.try_record_upload(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_record_upload(BIGINT) TO authenticated;
