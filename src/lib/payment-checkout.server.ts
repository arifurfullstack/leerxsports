/* eslint-disable @typescript-eslint/no-explicit-any -- payment tables/functions are introduced by the pending migration and are not in generated Supabase types yet */
import { decryptSecret } from "./gateway-crypto.server";
import { buildStripeReturnUrls } from "./payment-return-urls";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CheckoutProvider = "stripe" | "paypal" | "bank";

type GatewayRow = {
  provider: CheckoutProvider;
  display_name: string;
  enabled: boolean;
  mode: "test" | "live";
  config: Record<string, string>;
};

type PaymentOrder = {
  id: string;
  payer_id: string;
  kind: "subscription" | "unlock" | "tip" | "wallet_topup";
  provider: CheckoutProvider;
  amount: number;
  currency: string;
};

const SECRET_FIELDS: Record<CheckoutProvider, string[]> = {
  stripe: ["secret_key", "webhook_secret"],
  paypal: ["client_secret"],
  bank: [],
};

export async function loadCheckoutGateway(provider: CheckoutProvider): Promise<GatewayRow> {
  const { data, error } = await supabaseAdmin
    .from("payment_gateways")
    .select("provider, display_name, enabled, mode, config")
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.enabled) {
    throw new Error(`${provider} is not enabled.`);
  }

  const config = {
    ...((data.config ?? {}) as Record<string, string>),
  };
  for (const field of SECRET_FIELDS[provider]) {
    if (config[field]) config[field] = decryptSecret(config[field]);
  }
  return { ...(data as GatewayRow), config };
}

function productName(kind: PaymentOrder["kind"]): string {
  if (kind === "subscription") return "LEER trainer subscription";
  if (kind === "unlock") return "LEER premium content unlock";
  if (kind === "tip") return "LEER coaching tip";
  return "LEER wallet top-up";
}

export async function createProviderCheckout(params: {
  order: PaymentOrder;
  origin: string;
}): Promise<{
  status: "redirect" | "pending";
  redirectUrl: string | null;
  providerReference: string | null;
  instructions: string | null;
}> {
  const { order, origin } = params;
  const gateway = await loadCheckoutGateway(order.provider);

  if (order.provider === "stripe") {
    const secret = gateway.config.secret_key;
    if (!secret) throw new Error("Stripe secret key is not configured.");

    const { successUrl, cancelUrl } = buildStripeReturnUrls(origin, order.id);

    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("success_url", successUrl);
    body.set("cancel_url", cancelUrl);
    body.set("client_reference_id", order.id);
    body.set("metadata[payment_order_id]", order.id);
    body.set("payment_intent_data[metadata][payment_order_id]", order.id);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", order.currency.toLowerCase());
    body.set("line_items[0][price_data][unit_amount]", String(Math.round(order.amount * 100)));
    body.set("line_items[0][price_data][product_data][name]", productName(order.kind));

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const result = (await response.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };
    if (!response.ok || !result.id || !result.url) {
      throw new Error(result.error?.message ?? `Stripe checkout failed (${response.status}).`);
    }
    return {
      status: "redirect",
      redirectUrl: result.url,
      providerReference: result.id,
      instructions: null,
    };
  }

  if (order.provider === "paypal") {
    const clientId = gateway.config.client_id;
    const clientSecret = gateway.config.client_secret;
    if (!clientId || !clientSecret) {
      throw new Error("PayPal credentials are not configured.");
    }
    const base =
      gateway.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
    const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const tokenResult = (await tokenResponse.json()) as {
      access_token?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !tokenResult.access_token) {
      throw new Error(tokenResult.error_description ?? "PayPal authentication failed.");
    }

    const returnUrl = new URL("/payment/complete", origin);
    returnUrl.searchParams.set("order", order.id);
    const cancelUrl = new URL("/payment/complete", origin);
    cancelUrl.searchParams.set("order", order.id);
    cancelUrl.searchParams.set("cancelled", "1");
    const createResponse = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.access_token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": order.id,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: order.id,
            custom_id: order.id,
            description: productName(order.kind),
            amount: {
              currency_code: order.currency.toUpperCase(),
              value: order.amount.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: returnUrl.toString(),
          cancel_url: cancelUrl.toString(),
          user_action: "PAY_NOW",
        },
      }),
    });
    const createResult = (await createResponse.json()) as {
      id?: string;
      links?: Array<{ rel: string; href: string }>;
      message?: string;
    };
    const approveUrl = createResult.links?.find((link) => link.rel === "approve")?.href;
    if (!createResponse.ok || !createResult.id || !approveUrl) {
      throw new Error(createResult.message ?? `PayPal checkout failed (${createResponse.status}).`);
    }
    return {
      status: "redirect",
      redirectUrl: approveUrl,
      providerReference: createResult.id,
      instructions: null,
    };
  }

  const reference = `BANK-${order.id.slice(0, 8).toUpperCase()}`;
  const lines = [
    gateway.config.instructions,
    gateway.config.bank_name && `Bank: ${gateway.config.bank_name}`,
    gateway.config.account_name && `Account name: ${gateway.config.account_name}`,
    gateway.config.account_number && `Account: ${gateway.config.account_number}`,
    gateway.config.iban && `IBAN: ${gateway.config.iban}`,
    gateway.config.swift && `SWIFT/BIC: ${gateway.config.swift}`,
    `Payment reference: ${reference}`,
  ].filter(Boolean);
  return {
    status: "pending",
    redirectUrl: null,
    providerReference: reference,
    instructions: lines.join("\n"),
  };
}

async function creditCreatorFromOrder(orderId: string): Promise<void> {
  try {
    const { creditCreatorWallet } = await import("./wallet-functions");
    const { data: order } = await (supabaseAdmin as any)
      .from("payment_orders")
      .select("id, trainer_id, payer_id, kind, amount, currency")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || !order.trainer_id) return;

    const { data: tx } = await (supabaseAdmin as any)
      .from("transactions")
      .select("id, trainer_amount, currency")
      .eq("metadata->>payment_order_id", orderId)
      .maybeSingle();

    const { data: payerProfile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("display_name, username")
      .eq("user_id", order.payer_id)
      .maybeSingle();

    const payerName = payerProfile?.display_name || payerProfile?.username || "supporter";
    let desc = `Earned payment from ${payerName}`;
    if (order.kind === "tip") desc = `Earned tip from ${payerName}`;
    if (order.kind === "subscription") desc = `Earned subscription from ${payerName}`;
    if (order.kind === "unlock") desc = `Earned content unlock from ${payerName}`;

    const earned = Number(tx?.trainer_amount ?? Math.round(Number(order.amount) * 0.8 * 100) / 100);
    const curr = tx?.currency || order.currency || "USD";

    await creditCreatorWallet(
      supabaseAdmin,
      order.trainer_id,
      earned,
      curr,
      tx?.id,
      desc,
      order.id,
    );
  } catch (e) {
    console.error("[verifyAndCompleteProviderOrder] Error crediting creator wallet:", e);
  }
}

export async function verifyAndCompleteProviderOrder(params: {
  orderId: string;
  providerReference: string;
}): Promise<Record<string, unknown>> {
  const { data: order, error } = await (supabaseAdmin as any)
    .from("payment_orders")
    .select("id, provider, provider_reference, status")
    .eq("id", params.orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("Payment order not found.");
  if (order.status === "paid") return { ok: true, alreadyCompleted: true };
  if (order.provider_reference !== params.providerReference) {
    throw new Error("Payment reference mismatch.");
  }

  if (order.provider === "stripe") {
    const gateway = await loadCheckoutGateway("stripe");
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(params.providerReference)}`,
      { headers: { Authorization: `Bearer ${gateway.config.secret_key}` } },
    );
    const session = (await response.json()) as {
      payment_status?: string;
      payment_intent?: string;
      metadata?: { payment_order_id?: string };
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(session.error?.message ?? "Stripe verification failed.");
    if (
      session.payment_status !== "paid" ||
      session.metadata?.payment_order_id !== params.orderId
    ) {
      throw new Error("Stripe payment is not complete.");
    }
    const { data, error: settleError } = await (supabaseAdmin as any).rpc(
      "complete_payment_order",
      {
        _order_id: params.orderId,
        _external_reference: session.payment_intent ?? params.providerReference,
      },
    );
    if (settleError) throw new Error(settleError.message);
    await creditCreatorFromOrder(params.orderId);
    return data as Record<string, unknown>;
  }

  if (order.provider === "paypal") {
    const gateway = await loadCheckoutGateway("paypal");
    const base =
      gateway.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
    const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${gateway.config.client_id}:${gateway.config.client_secret}`,
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) {
      throw new Error("PayPal authentication failed.");
    }
    const captureResponse = await fetch(
      `${base}/v2/checkout/orders/${encodeURIComponent(params.providerReference)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `capture-${params.orderId}`,
        },
      },
    );
    const capture = (await captureResponse.json()) as {
      status?: string;
      purchase_units?: Array<{ reference_id?: string; custom_id?: string }>;
      message?: string;
    };
    if (
      !captureResponse.ok ||
      capture.status !== "COMPLETED" ||
      capture.purchase_units?.[0]?.reference_id !== params.orderId
    ) {
      throw new Error(capture.message ?? "PayPal payment is not complete.");
    }
    const { data, error: settleError } = await (supabaseAdmin as any).rpc(
      "complete_payment_order",
      {
        _order_id: params.orderId,
        _external_reference: params.providerReference,
      },
    );
    if (settleError) throw new Error(settleError.message);
    await creditCreatorFromOrder(params.orderId);
    return data as Record<string, unknown>;
  }

  throw new Error("Bank transfers require administrator confirmation.");
}
