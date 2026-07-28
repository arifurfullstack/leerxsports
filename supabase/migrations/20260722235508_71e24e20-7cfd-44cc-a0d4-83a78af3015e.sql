
CREATE TABLE public.payment_gateways (
  provider TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  mode TEXT NOT NULL DEFAULT 'test',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateways TO authenticated;
GRANT ALL ON public.payment_gateways TO service_role;

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment gateways"
  ON public.payment_gateways
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER payment_gateways_updated_at
  BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.payment_gateways (provider, display_name, config) VALUES
  ('bank', 'Bank Transfer', '{"bank_name":"","account_name":"","account_number":"","iban":"","swift":"","routing_number":"","instructions":""}'::jsonb),
  ('stripe', 'Stripe', '{"publishable_key":"","secret_key":"","webhook_secret":""}'::jsonb),
  ('paypal', 'PayPal', '{"client_id":"","client_secret":"","webhook_id":""}'::jsonb)
ON CONFLICT (provider) DO NOTHING;
