
-- Blocks
CREATE TABLE public.blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own blocks" ON public.blocks
  FOR ALL TO authenticated USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- DM threads: canonical (user_a < user_b) ordering
CREATE TABLE public.dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
CREATE INDEX idx_dm_threads_user_a ON public.dm_threads(user_a, last_message_at DESC);
CREATE INDEX idx_dm_threads_user_b ON public.dm_threads(user_b, last_message_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.dm_threads TO authenticated;
GRANT ALL ON public.dm_threads TO service_role;
ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read threads" ON public.dm_threads
  FOR SELECT TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);
-- Inserts and updates happen exclusively through server functions using service role.

-- Direct messages
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT,
  media TEXT[] NOT NULL DEFAULT '{}'::text[],
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_direct_messages_thread ON public.direct_messages(thread_id, created_at);
GRANT SELECT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read messages" ON public.direct_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.dm_threads t
      WHERE t.id = direct_messages.thread_id
        AND (auth.uid() = t.user_a OR auth.uid() = t.user_b)
    )
  );
CREATE POLICY "Recipients mark read" ON public.direct_messages
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.dm_threads t
      WHERE t.id = direct_messages.thread_id
        AND (auth.uid() = t.user_a OR auth.uid() = t.user_b)
        AND auth.uid() <> direct_messages.sender_id
    )
  );

-- Trainer opt-out of DMs
ALTER TABLE public.trainer_profiles ADD COLUMN IF NOT EXISTS dms_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Preferred language for auto-translate defaults
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT;
