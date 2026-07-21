
-- Enums
CREATE TYPE public.coaching_status AS ENUM (
  'draft','pending','coached','follow_up_submitted','final_response_submitted','coaching_completed','cancelled'
);
CREATE TYPE public.coaching_message_kind AS ENUM (
  'primary_question','primary_response','follow_up','final_response'
);
CREATE TYPE public.coaching_participant_role AS ENUM ('trainee','trainer');
CREATE TYPE public.dispute_status AS ENUM ('open','under_review','resolved_trainer','resolved_trainee','withdrawn');

-- Coaching requests (threads)
CREATE TABLE public.coaching_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_id UUID REFERENCES public.feedback_credits(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  exercise TEXT,
  goal TEXT,
  injury_info TEXT,
  requested_area TEXT,
  media TEXT[] NOT NULL DEFAULT '{}',
  status public.coaching_status NOT NULL DEFAULT 'pending',
  deadline_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX coaching_requests_subscriber_idx ON public.coaching_requests(subscriber_id, created_at DESC);
CREATE INDEX coaching_requests_trainer_idx ON public.coaching_requests(trainer_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaching_requests TO authenticated;
GRANT ALL ON public.coaching_requests TO service_role;
ALTER TABLE public.coaching_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants and admins can read threads" ON public.coaching_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = subscriber_id
    OR auth.uid() = trainer_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Subscribers can open a thread" ON public.coaching_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = subscriber_id
    AND public.has_active_subscription(auth.uid(), trainer_id)
  );

CREATE POLICY "Participants and admins can update thread status" ON public.coaching_requests
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = subscriber_id
    OR auth.uid() = trainer_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_coaching_requests_updated_at
  BEFORE UPDATE ON public.coaching_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Messages
CREATE TABLE public.coaching_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.coaching_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.coaching_participant_role NOT NULL,
  kind public.coaching_message_kind NOT NULL,
  text TEXT,
  media TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX coaching_messages_thread_idx ON public.coaching_messages(thread_id, created_at ASC);
-- Enforce single primary_response, follow_up, and final_response per thread
CREATE UNIQUE INDEX coaching_messages_kind_unique
  ON public.coaching_messages(thread_id, kind)
  WHERE kind IN ('primary_response','follow_up','final_response');

GRANT SELECT, INSERT ON public.coaching_messages TO authenticated;
GRANT ALL ON public.coaching_messages TO service_role;
ALTER TABLE public.coaching_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants and admins can read messages" ON public.coaching_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coaching_requests r
      WHERE r.id = coaching_messages.thread_id
        AND (auth.uid() = r.subscriber_id OR auth.uid() = r.trainer_id)
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Participants can post allowed messages" ON public.coaching_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.coaching_requests r
      WHERE r.id = coaching_messages.thread_id
        AND (
          (role = 'trainee' AND auth.uid() = r.subscriber_id)
          OR (role = 'trainer' AND auth.uid() = r.trainer_id)
        )
    )
  );

-- Disputes
CREATE TABLE public.coaching_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.coaching_requests(id) ON DELETE CASCADE,
  opener_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  evidence TEXT[] NOT NULL DEFAULT '{}',
  status public.dispute_status NOT NULL DEFAULT 'open',
  verdict TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX coaching_disputes_thread_idx ON public.coaching_disputes(thread_id);

GRANT SELECT, INSERT, UPDATE ON public.coaching_disputes TO authenticated;
GRANT ALL ON public.coaching_disputes TO service_role;
ALTER TABLE public.coaching_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants and admins can read disputes" ON public.coaching_disputes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coaching_requests r
      WHERE r.id = coaching_disputes.thread_id
        AND (auth.uid() = r.subscriber_id OR auth.uid() = r.trainer_id)
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Participants can open disputes" ON public.coaching_disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    opener_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.coaching_requests r
      WHERE r.id = coaching_disputes.thread_id
        AND (auth.uid() = r.subscriber_id OR auth.uid() = r.trainer_id)
    )
  );

CREATE POLICY "Admins can resolve disputes" ON public.coaching_disputes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_coaching_disputes_updated_at
  BEFORE UPDATE ON public.coaching_disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
