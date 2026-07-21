
-- Subscriptions
CREATE TYPE public.subscription_status AS ENUM ('trial','active','past_due','grace','cancelled','expired','refunded','suspended');
CREATE TYPE public.subscription_event_kind AS ENUM ('created','renewed','cancelled','expired','payment_failed','refunded','reactivated');
CREATE TYPE public.credit_status AS ENUM ('available','in_use','consumed','expired','restored');

CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.subscription_status NOT NULL DEFAULT 'active',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, trainer_id)
);
CREATE INDEX idx_subscriptions_trainer_status ON public.subscriptions(trainer_id, status);
CREATE INDEX idx_subscriptions_subscriber ON public.subscriptions(subscriber_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscribers view own subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = subscriber_id OR auth.uid() = trainer_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Subscribers create own subscriptions"
  ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "Subscribers update own subscriptions"
  ON public.subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = subscriber_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = subscriber_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete subscriptions"
  ON public.subscriptions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Subscription events (audit)
CREATE TABLE public.subscription_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  kind public.subscription_event_kind NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscription_events_sub ON public.subscription_events(subscription_id);

GRANT SELECT, INSERT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own subscription events"
  ON public.subscription_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_events.subscription_id
        AND (s.subscriber_id = auth.uid() OR s.trainer_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Subscriber inserts own subscription events"
  ON public.subscription_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_events.subscription_id
        AND s.subscriber_id = auth.uid()
    )
  );

-- Follows
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, trainer_id)
);
CREATE INDEX idx_follows_trainer ON public.follows(trainer_id);
CREATE INDEX idx_follows_follower ON public.follows(follower_id);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read follows"
  ON public.follows FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users create own follows"
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users delete own follows"
  ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- Feedback credits (monthly video coaching slot)
CREATE TABLE public.feedback_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_end TIMESTAMPTZ NOT NULL,
  status public.credit_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credits_subscriber ON public.feedback_credits(subscriber_id, trainer_id, status);

GRANT SELECT, INSERT, UPDATE ON public.feedback_credits TO authenticated;
GRANT ALL ON public.feedback_credits TO service_role;
ALTER TABLE public.feedback_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own feedback credits"
  ON public.feedback_credits FOR SELECT TO authenticated
  USING (auth.uid() = subscriber_id OR auth.uid() = trainer_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Subscriber inserts own credit"
  ON public.feedback_credits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "Subscriber updates own credit"
  ON public.feedback_credits FOR UPDATE TO authenticated
  USING (auth.uid() = subscriber_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = subscriber_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_feedback_credits_updated_at
BEFORE UPDATE ON public.feedback_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Entitlement helper: active subscription (period not expired)
CREATE OR REPLACE FUNCTION public.has_active_subscription(_subscriber_id UUID, _trainer_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE subscriber_id = _subscriber_id
      AND trainer_id = _trainer_id
      AND status IN ('active','trial','grace')
      AND current_period_end > now()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID, UUID) TO authenticated, service_role;
