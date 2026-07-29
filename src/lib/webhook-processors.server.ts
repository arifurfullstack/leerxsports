/**
 * Server-only helpers for verifying and processing payment gateway webhooks.
 * Never import this file from client-reachable module scope — use dynamic
 * `await import()` from inside server route handlers.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { creditCreatorWallet } from "@/lib/wallet-functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SECRET_FIELDS } from "./gateway-config-schemas";
import { decryptSecret } from "./gateway-crypto.server";

type GatewayRow = {
  provider: "stripe" | "paypal" | "bank";
  enabled: boolean;
  mode: "test" | "live";
  config: Record<string, string>;
};

export async function loadGateway(
  provider: "stripe" | "paypal",
): Promise<GatewayRow | null> {
  const { data, error } = await supabaseAdmin
    .from("payment_gateways")
    .select("provider, enabled, mode, config")
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = (data as GatewayRow | null) ?? null;
  if (!row) return null;
  // Decrypt secret fields for server-side use only.
  const cfg = { ...(row.config ?? {}) };
  for (const field of SECRET_FIELDS[provider] ?? []) {
    if (cfg[field]) cfg[field] = decryptSecret(cfg[field]);
  }
  return { ...row, config: cfg };
}

/* -------------------------------------------------------------------------- */
/* Stripe signature verification                                              */
/* -------------------------------------------------------------------------- */

/** Verify a Stripe `Stripe-Signature` header per Stripe's HMAC scheme. */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
): { ok: true } | { ok: false; reason: string } {
  if (!header) return { ok: false, reason: "missing signature header" };
  if (!secret) return { ok: false, reason: "no webhook secret configured" };

  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  ) as Record<string, string>;
  const timestamp = parts.t;
  const v1 = header
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!timestamp || v1.length === 0) {
    return { ok: false, reason: "malformed signature header" };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "invalid timestamp" };
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > toleranceSeconds) {
    return { ok: false, reason: "timestamp outside tolerance" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const matches = v1.some((sig) => {
    try {
      const sigBuf = Buffer.from(sig, "hex");
      return (
        sigBuf.length === expectedBuf.length &&
        timingSafeEqual(sigBuf, expectedBuf)
      );
    } catch {
      return false;
    }
  });
  return matches ? { ok: true } : { ok: false, reason: "signature mismatch" };
}

/* -------------------------------------------------------------------------- */
/* PayPal signature verification (via PayPal API)                             */
/* -------------------------------------------------------------------------- */

function paypalBaseUrl(mode: "test" | "live") {
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function paypalAccessToken(
  clientId: string,
  clientSecret: string,
  mode: "test" | "live",
): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${paypalBaseUrl(mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal token fetch failed [${res.status}]`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function verifyPaypalSignature(params: {
  rawBody: string;
  headers: Headers;
  clientId: string;
  clientSecret: string;
  webhookId: string;
  mode: "test" | "live";
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { rawBody, headers, clientId, clientSecret, webhookId, mode } = params;
  if (!clientId || !clientSecret || !webhookId) {
    return { ok: false, reason: "paypal credentials not configured" };
  }
  const required = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ] as const;
  for (const h of required) {
    if (!headers.get(h)) return { ok: false, reason: `missing header ${h}` };
  }
  let token: string;
  try {
    token = await paypalAccessToken(clientId, clientSecret, mode);
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
  const verifyRes = await fetch(
    `${paypalBaseUrl(mode)}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    },
  );
  if (!verifyRes.ok) {
    return { ok: false, reason: `verify api ${verifyRes.status}` };
  }
  const json = (await verifyRes.json()) as { verification_status: string };
  return json.verification_status === "SUCCESS"
    ? { ok: true }
    : { ok: false, reason: `status ${json.verification_status}` };
}

/* -------------------------------------------------------------------------- */
/* Event processing                                                            */
/* -------------------------------------------------------------------------- */

export type IngestResult = {
  status: "processed" | "ignored" | "failed";
  transaction_id?: string;
  payout_id?: string;
  error?: string;
};

export async function recordWebhookEvent(input: {
  provider: "stripe" | "paypal";
  event_id: string;
  event_type: string;
  verified: boolean;
  payload: unknown;
  result: IngestResult;
}) {
  const { data, error } = await supabaseAdmin
    .from("payment_webhook_events")
    .upsert(
      {
        provider: input.provider,
        event_id: input.event_id,
        event_type: input.event_type,
        verified: input.verified,
        status: input.result.status,
        processing_error: input.result.error ?? null,
        transaction_id: input.result.transaction_id ?? null,
        payout_id: input.result.payout_id ?? null,
        payload: input.payload as any,
        processed_at: new Date().toISOString(),
      },
      { onConflict: "provider,event_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Return true if an event with (provider,event_id) has already been processed. */
export async function isDuplicateEvent(
  provider: "stripe" | "paypal",
  eventId: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("payment_webhook_events")
    .select("id, status")
    .eq("provider", provider)
    .eq("event_id", eventId)
    .maybeSingle();
  return !!data && data.status === "processed";
}

/** Map a Stripe event to a transaction / payout upsert. */
export async function processStripeEvent(event: any): Promise<IngestResult> {
  const type = event?.type as string | undefined;
  const obj = event?.data?.object ?? {};
  if (!type) return { status: "ignored" };

  try {
    const paymentOrderId =
      obj?.metadata?.payment_order_id ?? obj?.client_reference_id;
    if (
      paymentOrderId &&
      (type === "checkout.session.completed" ||
        type === "payment_intent.succeeded")
    ) {
      const { data, error } = await (supabaseAdmin as any).rpc(
        "complete_payment_order",
        {
          _order_id: paymentOrderId,
          _external_reference: obj?.payment_intent ?? obj?.id ?? event?.id,
        },
      );
      if (error) throw error;
      return {
        status: "processed",
        transaction_id: data?.transaction_id ?? undefined,
      };
    }

    if (type === "charge.succeeded" || type === "payment_intent.succeeded") {
      const gross = Number(obj.amount_received ?? obj.amount ?? 0) / 100;
      const currency = String(obj.currency ?? "usd").toUpperCase();
      const pi = obj.payment_intent ?? obj.id;
      const { data, error } = await (supabaseAdmin as any)
        .from("transactions")
        .upsert(
          {
            kind: "charge",
            status: "succeeded",
            gross,
            platform_fee: 0,
            trainer_amount: gross,
            currency,
            stripe_payment_intent_id: pi,
            metadata: { source: "stripe_webhook", event_type: type },
          },
          { onConflict: "stripe_payment_intent_id" },
        )
        .select("id, trainer_amount, currency, metadata")
        .single();
      if (error) throw error;
      // Credit creator's wallet if trainer_id is present in metadata
      const trainerId = (data?.metadata?.trainer_id) as string | undefined;
      if (trainerId && data.trainer_amount && data.currency) {
        await creditCreatorWallet(supabaseAdmin, trainerId, data.trainer_amount, data.currency, data.id);
      }
      return { status: "processed", transaction_id: data.id };
    }

    if (type === "charge.refunded") {
      const pi = obj.payment_intent;
      if (pi) {
        await supabaseAdmin
          .from("transactions")
          .update({ status: "refunded" })
          .eq("stripe_payment_intent_id", pi);
      }
      return { status: "processed" };
    }

    if (type.startsWith("payout.")) {
      // Payouts are trainer-scoped; without a mapping to trainer_id we log
      // the event for admin review but do not create a payout row.
      return { status: "ignored" };
    }

    return { status: "ignored" };
  } catch (e) {
    return { status: "failed", error: (e as Error).message };
  }
}

/** Map a PayPal event to a transaction upsert. */
export async function processPaypalEvent(event: any): Promise<IngestResult> {
  const type = event?.event_type as string | undefined;
  const resource = event?.resource ?? {};
  if (!type) return { status: "ignored" };

  try {
    const paymentOrderId =
      resource?.custom_id ??
      resource?.purchase_units?.[0]?.custom_id ??
      resource?.purchase_units?.[0]?.reference_id;
    if (paymentOrderId && type === "PAYMENT.CAPTURE.COMPLETED") {
      const { data, error } = await (supabaseAdmin as any).rpc(
        "complete_payment_order",
        {
          _order_id: paymentOrderId,
          _external_reference: resource?.id ?? event?.id,
        },
      );
      if (error) throw error;
      return {
        status: "processed",
        transaction_id: data?.transaction_id ?? undefined,
      };
    }

    if (
      type === "PAYMENT.CAPTURE.COMPLETED" ||
      type === "CHECKOUT.ORDER.APPROVED"
    ) {
      const gross = Number(resource?.amount?.value ?? 0);
      const currency = String(
        resource?.amount?.currency_code ?? "USD",
      ).toUpperCase();
      const externalId =
        resource?.id ?? event?.id ?? `paypal_${Date.now()}`;
      const { data, error } = await (supabaseAdmin as any)
        .from("transactions")
        .upsert(
          {
            kind: "charge",
            status: "succeeded",
            gross,
            platform_fee: 0,
            trainer_amount: gross,
            currency,
            stripe_payment_intent_id: `paypal:${externalId}`,
            metadata: { source: "paypal_webhook", event_type: type },
          },
          { onConflict: "stripe_payment_intent_id" },
        )
        .select("id")
        .single();
      if (error) throw error;
      return { status: "processed", transaction_id: data.id };
    }

    if (type === "PAYMENT.CAPTURE.REFUNDED") {
      const externalId = resource?.id;
      if (externalId) {
        await supabaseAdmin
          .from("transactions")
          .update({ status: "refunded" })
          .eq("stripe_payment_intent_id", `paypal:${externalId}`);
      }
      return { status: "processed" };
    }

    return { status: "ignored" };
  } catch (e) {
    return { status: "failed", error: (e as Error).message };
  }
}