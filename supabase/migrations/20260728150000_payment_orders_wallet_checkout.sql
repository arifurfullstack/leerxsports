-- Canonical checkout orders, real user wallets, and atomic payment settlement.
-- External providers are verified by server routes before calling
-- complete_payment_order(). Wallet payments are debited and settled in one
-- database transaction through pay_payment_order_with_wallet().

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('subscription', 'unlock', 'tip', 'wallet_topup')),
  provider TEXT NOT NULL CHECK (provider IN ('wallet', 'stripe', 'paypal', 'bank')),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'pending', 'paid', 'failed', 'cancelled', 'refunded')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  -- Coaching tables were removed in 20260722112933. Keep the optional
  -- correlation id without an obsolete foreign-key dependency.
  coaching_thread_id UUID,
  duration_months INTEGER NOT NULL DEFAULT 1 CHECK (duration_months BETWEEN 1 AND 12),
  message TEXT,
  provider_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_orders_payer_created_idx
  ON public.payment_orders (payer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_orders_provider_reference_idx
  ON public.payment_orders (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

GRANT SELECT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view payment orders"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (
    payer_id = auth.uid()
    OR trainer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_payment_orders_updated_at
  BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.user_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_wallets TO authenticated;
GRANT ALL ON public.user_wallets TO service_role;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own wallet"
  ON public.user_wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_wallets_updated_at
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.wallet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('topup', 'purchase', 'refund', 'adjustment')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount <> 0),
  balance_after NUMERIC(12,2) NOT NULL CHECK (balance_after >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_entries_user_created_idx
  ON public.wallet_entries (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_entries_order_kind_unique
  ON public.wallet_entries (order_id, kind)
  WHERE order_id IS NOT NULL;

GRANT SELECT ON public.wallet_entries TO authenticated;
GRANT ALL ON public.wallet_entries TO service_role;
ALTER TABLE public.wallet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own wallet entries"
  ON public.wallet_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.complete_payment_order(
  _order_id UUID,
  _external_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_settings public.platform_settings%ROWTYPE;
  v_platform_fee NUMERIC(12,2);
  v_trainer_amount NUMERIC(12,2);
  v_transaction_id UUID;
  v_subscription_id UUID;
  v_tip_id UUID;
  v_wallet_balance NUMERIC(12,2);
  v_period_start TIMESTAMPTZ := now();
  v_period_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_order
  FROM public.payment_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;

  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true, 'order_id', v_order.id);
  END IF;

  IF v_order.status NOT IN ('created', 'pending') THEN
    RAISE EXCEPTION 'Payment order cannot be completed from status %', v_order.status;
  END IF;

  SELECT * INTO v_settings
  FROM public.platform_settings
  WHERE id = true;

  UPDATE public.payment_orders
  SET status = 'paid',
      provider_reference = COALESCE(_external_reference, provider_reference),
      completed_at = now()
  WHERE id = v_order.id;

  IF v_order.kind = 'wallet_topup' THEN
    INSERT INTO public.user_wallets (user_id, balance, currency)
    VALUES (v_order.payer_id, v_order.amount, v_order.currency)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.user_wallets.balance + EXCLUDED.balance,
          currency = EXCLUDED.currency
    RETURNING balance INTO v_wallet_balance;

    INSERT INTO public.wallet_entries (
      user_id, order_id, kind, amount, balance_after, currency, description
    )
    VALUES (
      v_order.payer_id, v_order.id, 'topup', v_order.amount,
      v_wallet_balance, v_order.currency, 'Verified wallet top-up'
    )
    ON CONFLICT (order_id, kind) WHERE order_id IS NOT NULL DO NOTHING;

    RETURN jsonb_build_object(
      'ok', true,
      'already_completed', false,
      'order_id', v_order.id,
      'wallet_balance', v_wallet_balance
    );
  END IF;

  IF v_order.trainer_id IS NULL THEN
    RAISE EXCEPTION 'Trainer is required for % orders', v_order.kind;
  END IF;

  v_platform_fee := round(
    v_order.amount * COALESCE(v_settings.commission_bps, 2000) / 10000,
    2
  );
  v_trainer_amount := v_order.amount - v_platform_fee;

  IF v_order.kind = 'subscription' THEN
    v_period_end := v_period_start + make_interval(months => v_order.duration_months);

    INSERT INTO public.subscriptions (
      subscriber_id, trainer_id, status, price,
      current_period_start, current_period_end, cancelled_at
    )
    VALUES (
      v_order.payer_id, v_order.trainer_id, 'active',
      round(v_order.amount / v_order.duration_months, 2),
      v_period_start, v_period_end, NULL
    )
    ON CONFLICT (subscriber_id, trainer_id) DO UPDATE
      SET status = 'active',
          price = EXCLUDED.price,
          current_period_start = v_period_start,
          current_period_end =
            GREATEST(public.subscriptions.current_period_end, v_period_start)
            + make_interval(months => v_order.duration_months),
          cancelled_at = NULL
    RETURNING id, current_period_end INTO v_subscription_id, v_period_end;
  END IF;

  INSERT INTO public.transactions (
    kind, status, payer_id, trainer_id, subscription_id,
    gross, platform_fee, trainer_amount, currency,
    stripe_payment_intent_id, metadata
  )
  VALUES (
    v_order.kind, 'succeeded', v_order.payer_id, v_order.trainer_id,
    v_subscription_id, v_order.amount, v_platform_fee, v_trainer_amount,
    v_order.currency,
    CASE WHEN v_order.provider = 'stripe'
      THEN COALESCE(_external_reference, v_order.provider_reference)
      ELSE NULL END,
    v_order.metadata || jsonb_build_object(
      'payment_order_id', v_order.id,
      'provider', v_order.provider,
      'post_id', v_order.post_id,
      'coaching_thread_id', v_order.coaching_thread_id
    )
  )
  RETURNING id INTO v_transaction_id;

  IF v_order.kind = 'subscription' THEN
    INSERT INTO public.subscription_events (subscription_id, kind, metadata)
    VALUES (
      v_subscription_id,
      'created',
      jsonb_build_object('payment_order_id', v_order.id, 'provider', v_order.provider)
    );

    INSERT INTO public.feedback_credits (
      subscription_id, subscriber_id, trainer_id,
      period_start, period_end, status
    )
    VALUES (
      v_subscription_id, v_order.payer_id, v_order.trainer_id,
      v_period_start, v_period_end, 'available'
    );
  ELSIF v_order.kind = 'unlock' THEN
    IF v_order.post_id IS NULL THEN
      RAISE EXCEPTION 'Post is required for unlock orders';
    END IF;

    INSERT INTO public.post_unlocks (
      post_id, user_id, trainer_id, price, currency,
      transaction_id, provider
    )
    VALUES (
      v_order.post_id, v_order.payer_id, v_order.trainer_id,
      v_order.amount, v_order.currency, v_transaction_id, v_order.provider
    )
    ON CONFLICT (post_id, user_id) DO NOTHING;
  ELSIF v_order.kind = 'tip' THEN
    INSERT INTO public.tips (
      from_user_id, trainer_id, coaching_thread_id, amount,
      currency, status, transaction_id, message
    )
    VALUES (
      v_order.payer_id, v_order.trainer_id, v_order.coaching_thread_id,
      v_order.amount, v_order.currency, 'succeeded',
      v_transaction_id, v_order.message
    )
    RETURNING id INTO v_tip_id;

    UPDATE public.transactions SET tip_id = v_tip_id WHERE id = v_transaction_id;
  END IF;

  INSERT INTO public.trainer_balances (
    trainer_id, available_amount, pending_amount, frozen_amount,
    paid_out_amount, currency
  )
  VALUES (
    v_order.trainer_id,
    CASE WHEN v_order.kind = 'subscription' THEN 0 ELSE v_trainer_amount END,
    CASE WHEN v_order.kind = 'subscription' THEN v_trainer_amount ELSE 0 END,
    0, 0, v_order.currency
  )
  ON CONFLICT (trainer_id) DO UPDATE
    SET available_amount = public.trainer_balances.available_amount
          + CASE WHEN v_order.kind = 'subscription' THEN 0 ELSE v_trainer_amount END,
        pending_amount = public.trainer_balances.pending_amount
          + CASE WHEN v_order.kind = 'subscription' THEN v_trainer_amount ELSE 0 END,
        currency = EXCLUDED.currency;

  RETURN jsonb_build_object(
    'ok', true,
    'already_completed', false,
    'order_id', v_order.id,
    'transaction_id', v_transaction_id,
    'subscription_id', v_subscription_id,
    'tip_id', v_tip_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_payment_order(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_payment_order(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.complete_payment_order(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_order(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.pay_payment_order_with_wallet(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_wallet public.user_wallets%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_order
  FROM public.payment_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.payer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;
  IF v_order.provider <> 'wallet' THEN
    RAISE EXCEPTION 'Payment order is not a wallet payment';
  END IF;
  IF v_order.kind = 'wallet_topup' THEN
    RAISE EXCEPTION 'A wallet cannot fund its own top-up';
  END IF;
  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true, 'order_id', v_order.id);
  END IF;
  IF v_order.status NOT IN ('created', 'pending') THEN
    RAISE EXCEPTION 'Payment order cannot be paid from status %', v_order.status;
  END IF;

  SELECT * INTO v_wallet
  FROM public.user_wallets
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND OR v_wallet.currency <> v_order.currency OR v_wallet.balance < v_order.amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.user_wallets
  SET balance = balance - v_order.amount
  WHERE user_id = auth.uid()
  RETURNING * INTO v_wallet;

  INSERT INTO public.wallet_entries (
    user_id, order_id, kind, amount, balance_after, currency, description
  )
  VALUES (
    auth.uid(), v_order.id, 'purchase', -v_order.amount,
    v_wallet.balance, v_wallet.currency, 'Wallet checkout'
  )
  ON CONFLICT (order_id, kind) WHERE order_id IS NOT NULL DO NOTHING;

  v_result := public.complete_payment_order(v_order.id, 'wallet:' || v_order.id::TEXT);
  RETURN v_result || jsonb_build_object('wallet_balance', v_wallet.balance);
END;
$$;

REVOKE ALL ON FUNCTION public.pay_payment_order_with_wallet(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_payment_order_with_wallet(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.pay_payment_order_with_wallet(UUID) TO authenticated;
