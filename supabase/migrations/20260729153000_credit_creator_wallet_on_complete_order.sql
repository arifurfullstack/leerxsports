-- Update complete_payment_order to credit the creator's user_wallet and insert a wallet_entry on every paid order.

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
  v_trainer_wallet_balance NUMERIC(12,2);
  v_payer_name TEXT;
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

  -- Credit Creator's user_wallets balance & add wallet_entry
  SELECT COALESCE(display_name, username, 'a supporter')
  INTO v_payer_name
  FROM public.profiles
  WHERE user_id = v_order.payer_id;

  INSERT INTO public.user_wallets (user_id, balance, currency)
  VALUES (v_order.trainer_id, v_trainer_amount, v_order.currency)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_wallets.balance + EXCLUDED.balance,
        currency = EXCLUDED.currency
  RETURNING balance INTO v_trainer_wallet_balance;

  INSERT INTO public.wallet_entries (
    user_id, order_id, kind, amount, balance_after, currency, description
  )
  VALUES (
    v_order.trainer_id,
    v_order.id,
    'adjustment',
    v_trainer_amount,
    v_trainer_wallet_balance,
    v_order.currency,
    CASE
      WHEN v_order.kind = 'tip' THEN 'Earned tip from ' || COALESCE(v_payer_name, 'supporter')
      WHEN v_order.kind = 'subscription' THEN 'Earned subscription from ' || COALESCE(v_payer_name, 'subscriber')
      WHEN v_order.kind = 'unlock' THEN 'Earned content unlock from ' || COALESCE(v_payer_name, 'user')
      ELSE 'Earned payment from ' || COALESCE(v_payer_name, 'user')
    END
  )
  ON CONFLICT (order_id, kind) WHERE order_id IS NOT NULL DO NOTHING;

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
