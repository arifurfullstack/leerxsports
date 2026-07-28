
CREATE TABLE public.qa_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 10 AND 2000),
  answer TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 300,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','answered','expired','refunded')),
  transaction_id UUID,
  answered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.qa_dispatches TO authenticated;
GRANT ALL ON public.qa_dispatches TO service_role;

ALTER TABLE public.qa_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their dispatches" ON public.qa_dispatches
  FOR SELECT TO authenticated
  USING (auth.uid() = fan_id OR auth.uid() = creator_id);

CREATE POLICY "Fans can create dispatches" ON public.qa_dispatches
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = fan_id AND fan_id <> creator_id);

CREATE POLICY "Creators can answer their dispatches" ON public.qa_dispatches
  FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE INDEX idx_qa_dispatches_creator ON public.qa_dispatches(creator_id, status, created_at DESC);
CREATE INDEX idx_qa_dispatches_fan ON public.qa_dispatches(fan_id, created_at DESC);

CREATE TRIGGER update_qa_dispatches_updated_at BEFORE UPDATE ON public.qa_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
