
-- ============ platform_settings ============
CREATE TABLE public.platform_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  commission_bps INTEGER NOT NULL DEFAULT 2000, -- 20%
  min_subscription_price NUMERIC(10,2) NOT NULL DEFAULT 5,
  max_subscription_price NUMERIC(10,2) NOT NULL DEFAULT 200,
  min_payout_amount NUMERIC(10,2) NOT NULL DEFAULT 25,
  dispute_window_hours INTEGER NOT NULL DEFAULT 24,
  trainer_sla_hours INTEGER NOT NULL DEFAULT 48,
  tip_presets NUMERIC(10,2)[] NOT NULL DEFAULT ARRAY[5,15,30]::NUMERIC(10,2)[],
  base_currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings readable by authenticated"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "settings updated by admins"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "settings inserted by admins"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ============ transactions ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('subscription','tip','refund','adjustment')),
  status TEXT NOT NULL DEFAULT 'succeeded' CHECK (status IN ('pending','succeeded','failed','refunded','frozen')),
  payer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  tip_id UUID,
  gross NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL,
  trainer_amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  stripe_payment_intent_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transactions_trainer_created_idx ON public.transactions (trainer_id, created_at DESC);
CREATE INDEX transactions_payer_created_idx ON public.transactions (payer_id, created_at DESC);

GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer or payer or admin sees tx"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    trainer_id = auth.uid()
    OR payer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "admin manages tx"
  ON public.transactions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ trainer_balances ============
CREATE TABLE public.trainer_balances (
  trainer_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  available_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  pending_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  frozen_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_out_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.trainer_balances TO authenticated;
GRANT ALL ON public.trainer_balances TO service_role;
ALTER TABLE public.trainer_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer or admin sees balance"
  ON public.trainer_balances FOR SELECT
  TO authenticated
  USING (trainer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages balances"
  ON public.trainer_balances FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_trainer_balances_updated_at
  BEFORE UPDATE ON public.trainer_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ tips ============
CREATE TABLE public.tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coaching_thread_id UUID REFERENCES public.coaching_requests(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'succeeded' CHECK (status IN ('pending','succeeded','failed','refunded')),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tips_trainer_idx ON public.tips (trainer_id, created_at DESC);
CREATE INDEX tips_thread_idx ON public.tips (coaching_thread_id);

GRANT SELECT ON public.tips TO authenticated;
GRANT ALL ON public.tips TO service_role;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tips visible to participants and admin"
  ON public.tips FOR SELECT
  TO authenticated
  USING (
    from_user_id = auth.uid()
    OR trainer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "admin manages tips"
  ON public.tips FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ payouts ============
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL CHECK (method IN ('stripe','bank','paypal','other')),
  method_details JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','paid','rejected','cancelled')),
  statement_url TEXT,
  admin_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payouts_trainer_idx ON public.payouts (trainer_id, created_at DESC);
CREATE INDEX payouts_status_idx ON public.payouts (status);

GRANT SELECT, INSERT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer or admin reads payouts"
  ON public.payouts FOR SELECT
  TO authenticated
  USING (trainer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "trainer requests own payout"
  ON public.payouts FOR INSERT
  TO authenticated
  WITH CHECK (trainer_id = auth.uid() AND status = 'requested');
CREATE POLICY "admin manages payouts"
  ON public.payouts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
