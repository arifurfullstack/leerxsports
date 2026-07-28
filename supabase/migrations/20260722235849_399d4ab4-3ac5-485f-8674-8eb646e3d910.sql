
CREATE TABLE public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe','paypal')),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','ignored','failed')),
  processing_error TEXT,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  payout_id UUID REFERENCES public.payouts(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX payment_webhook_events_provider_event_id_idx
  ON public.payment_webhook_events(provider, event_id);
CREATE INDEX payment_webhook_events_received_at_idx
  ON public.payment_webhook_events(received_at DESC);

GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view webhook events"
  ON public.payment_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
