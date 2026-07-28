-- Per-post price (nullable; falls back to trainer subscription price)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS unlock_price NUMERIC(10,2);

-- One-off post unlocks
CREATE TABLE IF NOT EXISTS public.post_unlocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'placeholder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_unlocks_user_idx ON public.post_unlocks(user_id);
CREATE INDEX IF NOT EXISTS post_unlocks_trainer_idx ON public.post_unlocks(trainer_id);

GRANT SELECT ON public.post_unlocks TO authenticated;
GRANT ALL ON public.post_unlocks TO service_role;

ALTER TABLE public.post_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own unlocks"
  ON public.post_unlocks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Creators can view unlocks of their posts"
  ON public.post_unlocks FOR SELECT
  TO authenticated
  USING (auth.uid() = trainer_id);
