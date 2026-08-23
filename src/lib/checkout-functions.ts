/* eslint-disable @typescript-eslint/no-explicit-any -- payment tables/functions are introduced by the pending migration and are not in generated Supabase types yet */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CheckoutProvider = "wallet" | "stripe" | "paypal" | "bank";
export type CheckoutKind = "subscription" | "unlock" | "tip" | "wallet_topup";

export type CheckoutGateway = {
  provider: Exclude<CheckoutProvider, "wallet">;
  displayName: string;
  mode: "test" | "live";
};

export type CheckoutStartResult = {
  orderId: string;
  status: "paid" | "redirect" | "pending" | "embedded";
  redirectUrl: string | null;
  clientSecret?: string | null;
  publishableKey?: string | null;
  instructions: string | null;
  walletBalance: number | null;
};

const checkoutSchema = z
  .object({
    kind: z.enum(["subscription", "unlock", "tip", "wallet_topup"]),
    provider: z.enum(["wallet", "stripe", "paypal", "bank"]),
    trainerId: z.string().uuid().optional(),
    postId: z.string().uuid().optional(),
    threadId: z.string().uuid().optional(),
    durationMonths: z.number().int().min(1).max(12).default(1),
    amount: z.number().min(1).max(10000).optional(),
    message: z.string().trim().max(280).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "subscription" && !value.trainerId) {
      ctx.addIssue({ code: "custom", message: "Trainer is required.", path: ["trainerId"] });
    }
    if (value.kind === "unlock" && !value.postId) {
      ctx.addIssue({ code: "custom", message: "Post is required.", path: ["postId"] });
    }
    if (value.kind === "tip" && (!value.trainerId || !value.amount)) {
      ctx.addIssue({ code: "custom", message: "Trainer and amount are required." });
    }
    if (value.kind === "wallet_topup" && !value.amount) {
      ctx.addIssue({ code: "custom", message: "Top-up amount is required.", path: ["amount"] });
    }
    if (value.kind === "wallet_topup" && value.provider === "wallet") {
      ctx.addIssue({ code: "custom", message: "A wallet cannot fund its own top-up." });
    }
  });

export const listCheckoutGateways = createServerFn({ method: "GET" }).handler(
  async (): Promise<CheckoutGateway[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("payment_gateways")
      .select("provider, display_name, mode, config")
      .eq("enabled", true)
      .in("provider", ["stripe", "paypal", "bank"])
      .order("provider");
    if (error) throw new Error(error.message);

    // Only present gateways in the UI that have valid credentials configured
    const valid = (data ?? []).filter((row) => {
      const cfg = (row.config ?? {}) as Record<string, string>;
      if (row.provider === "paypal") {
        return Boolean(cfg.client_id && (cfg.client_secret || cfg.secret));
      }
      if (row.provider === "stripe") {
        return Boolean(cfg.publishable_key && cfg.secret_key);
      }
      return true;
    });

    return valid.map((row) => ({
      provider: row.provider as CheckoutGateway["provider"],
      displayName: row.display_name,
      mode: row.mode as "test" | "live",
    }));
  },
);

export const createCheckoutOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ data, context }): Promise<CheckoutStartResult> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("platform_settings")
      .select("base_currency, min_subscription_price, max_subscription_price")
      .eq("id", true)
      .maybeSingle();
    if (settingsError) throw new Error(settingsError.message);

    const currency = settings?.base_currency ?? "USD";
    let amount = 0;
    let trainerId = data.trainerId ?? null;
    let postId = data.postId ?? null;
    const metadata: Record<string, unknown> = {};
  // Attach trainer identifier for downstream webhook processing (e.g., wallet credit)
  if (trainerId) {
    metadata.trainer_id = trainerId;
  }

    if (data.provider === "wallet") {
      throw new Error("LEER Wallet is currently disabled for this release. Please choose Card (Stripe) or an enabled gateway.");
    }
    if (data.kind === "wallet_topup") {
      throw new Error("Wallet top-ups are disabled for this release. Please pay directly with Card (Stripe).");
    }

    if (data.kind === "subscription") {
      if (trainerId === userId) throw new Error("You cannot subscribe to yourself.");
      const { data: trainer, error } = await supabaseAdmin
        .from("trainer_profiles")
        .select("user_id, subscription_price, monetization_enabled")
        .eq("user_id", trainerId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!trainer || !trainer.monetization_enabled) {
        throw new Error("This trainer is not accepting subscriptions.");
      }
      const monthlyPrice = Number(trainer.subscription_price ?? 0);
      const minimum = Number(settings?.min_subscription_price ?? 4.99);
      const maximum = Number(settings?.max_subscription_price ?? 499.99);
      if (monthlyPrice < minimum || monthlyPrice > maximum) {
        throw new Error(`The trainer subscription price is outside platform limits ($${minimum.toFixed(2)} - $${maximum.toFixed(2)}).`);
      }
      const { count, error: postCountError } = await supabaseAdmin
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("trainer_id", trainerId!)
        .eq("kind", "feed")
        .eq("is_premium", false)
        .eq("is_published", true)
        .eq("is_hidden", false);
      if (postCountError) throw new Error(postCountError.message);
      if ((count ?? 0) < 3) {
        throw new Error("This trainer needs at least 3 public posts before accepting subscribers.");
      }
      amount = Math.round(monthlyPrice * 100) / 100;
      metadata.monthly_price = monthlyPrice;
      metadata.recurring = "monthly";
    } else if (data.kind === "unlock") {
      const { data: post, error } = await supabaseAdmin
        .from("posts")
        .select("id, trainer_id, is_premium, unlock_price")
        .eq("id", postId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!post || !post.is_premium) throw new Error("Premium post not found.");
      if (post.trainer_id === userId) throw new Error("You already own this post.");
      trainerId = post.trainer_id;
      const { data: existing } = await supabaseAdmin
        .from("post_unlocks")
        .select("id")
        .eq("post_id", postId!)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) throw new Error("This post is already unlocked.");
      const { data: trainer } = await supabaseAdmin
        .from("trainer_profiles")
        .select("subscription_price")
        .eq("user_id", trainerId)
        .maybeSingle();
      amount = Number(post.unlock_price ?? trainer?.subscription_price ?? 0);
      if (!(amount > 0)) throw new Error("This post has no unlock price.");
    } else if (data.kind === "tip") {
      if (trainerId === userId) throw new Error("You cannot tip yourself.");
      amount = Math.round(Number(data.amount) * 100) / 100;
      if (data.threadId) {
        const { data: thread, error } = await (supabaseAdmin as any)
          .from("coaching_requests")
          .select("id, subscriber_id, trainer_id, status")
          .eq("id", data.threadId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (
          !thread ||
          thread.subscriber_id !== userId ||
          thread.trainer_id !== trainerId ||
          thread.status !== "coaching_completed"
        ) {
          throw new Error("Tips are available only for your completed coaching thread.");
        }
      }
    } else {
      amount = Math.round(Number(data.amount) * 100) / 100;
      if (amount < 5 || amount > 1000) {
        throw new Error("Wallet top-up must be between 5 and 1000.");
      }
      trainerId = null;
      postId = null;
    }

    const { data: gateway, error } = await supabaseAdmin
      .from("payment_gateways")
      .select("provider")
      .eq("provider", data.provider)
      .eq("enabled", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!gateway) throw new Error(`${data.provider} is not enabled.`);

    const { data: order, error: orderError } = await (supabaseAdmin as any)
      .from("payment_orders")
      .insert({
        payer_id: userId,
        trainer_id: trainerId,
        kind: data.kind,
        provider: data.provider,
        status: "created",
        amount,
        currency,
        post_id: postId,
        coaching_thread_id: data.threadId ?? null,
        duration_months: data.kind === "subscription" ? 1 : (data.durationMonths ?? 1),
        message: data.message ?? null,
        metadata,
      })
      .select("id, payer_id, kind, provider, amount, currency")
      .single();
    if (orderError) throw new Error(orderError.message);

    try {
      const request = getRequest();
      const origin = request ? new URL(request.url).origin : "http://localhost:3000";
      const { createProviderCheckout } = await import("./payment-checkout.server");
      const checkout = await createProviderCheckout({
        order: {
          ...order,
          amount: Number(order.amount),
          provider: data.provider,
        },
        origin,
      });
      await (supabaseAdmin as any)
        .from("payment_orders")
        .update({
          status: "pending",
          provider_reference: checkout.providerReference,
        })
        .eq("id", order.id);
      return {
        orderId: order.id,
        status: checkout.status,
        redirectUrl: checkout.redirectUrl,
        clientSecret: checkout.clientSecret ?? null,
        publishableKey: checkout.publishableKey ?? null,
        instructions: checkout.instructions,
        walletBalance: null,
      };
    } catch (error) {
      await (supabaseAdmin as any)
        .from("payment_orders")
        .update({
          status: "failed",
          metadata: {
            ...metadata,
            checkout_error: error instanceof Error ? error.message : "Checkout failed",
          },
        })
        .eq("id", order.id);
      throw error;
    }
  });

export const confirmPaymentReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        providerReference: z.string().min(1).max(255),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await (supabaseAdmin as any)
      .from("payment_orders")
      .select("payer_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order || order.payer_id !== context.userId) {
      throw new Error("Payment order not found.");
    }
    const { verifyAndCompleteProviderOrder } = await import("./payment-checkout.server");
    await verifyAndCompleteProviderOrder({
      orderId: data.orderId,
      providerReference: data.providerReference,
    });
    return { ok: true as const };
  });

export const getPaymentOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await (context.supabase as any)
      .from("payment_orders")
      .select("id, kind, provider, status, amount, currency, provider_reference, created_at")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Payment order not found.");
    return order as {
      id: string;
      kind: CheckoutKind;
      provider: CheckoutProvider;
      status: string;
      amount: number;
      currency: string;
      provider_reference: string | null;
      created_at: string;
    };
  });
