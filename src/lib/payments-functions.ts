import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlatformSettings = {
  commission_bps: number;
  min_subscription_price: number;
  max_subscription_price: number;
  min_payout_amount: number;
  dispute_window_hours: number;
  trainer_sla_hours: number;
  tip_presets: number[];
  base_currency: string;
};

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformSettings> => {
    const { data, error } = await context.supabase
      .from("platform_settings")
      .select(
        "commission_bps, min_subscription_price, max_subscription_price, min_payout_amount, dispute_window_hours, trainer_sla_hours, tip_presets, base_currency",
      )
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      commission_bps: data?.commission_bps ?? 2000,
      min_subscription_price: Number(data?.min_subscription_price ?? 5),
      max_subscription_price: Number(data?.max_subscription_price ?? 200),
      min_payout_amount: Number(data?.min_payout_amount ?? 25),
      dispute_window_hours: data?.dispute_window_hours ?? 24,
      trainer_sla_hours: data?.trainer_sla_hours ?? 48,
      tip_presets: (data?.tip_presets ?? [5, 15, 30]).map((n) => Number(n)),
      base_currency: data?.base_currency ?? "USD",
    };
  });

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        commission_bps: z.number().int().min(0).max(5000).optional(),
        min_subscription_price: z.number().min(0).optional(),
        max_subscription_price: z.number().min(0).optional(),
        min_payout_amount: z.number().min(0).optional(),
        dispute_window_hours: z.number().int().min(1).optional(),
        trainer_sla_hours: z.number().int().min(1).optional(),
        tip_presets: z.array(z.number().min(1)).min(1).max(6).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("platform_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type TrainerBalance = {
  available_amount: number;
  pending_amount: number;
  frozen_amount: number;
  paid_out_amount: number;
  currency: string;
};

export const getTrainerBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrainerBalance> => {
    const { data, error } = await context.supabase
      .from("trainer_balances")
      .select(
        "available_amount, pending_amount, frozen_amount, paid_out_amount, currency",
      )
      .eq("trainer_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      available_amount: Number(data?.available_amount ?? 0),
      pending_amount: Number(data?.pending_amount ?? 0),
      frozen_amount: Number(data?.frozen_amount ?? 0),
      paid_out_amount: Number(data?.paid_out_amount ?? 0),
      currency: data?.currency ?? "USD",
    };
  });

export type TransactionRow = {
  id: string;
  kind: string;
  status: string;
  gross: number;
  platform_fee: number;
  trainer_amount: number;
  currency: string;
  created_at: string;
  counterparty: string | null;
};

export const listTrainerTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TransactionRow[]> => {
    const { data, error } = await context.supabase
      .from("transactions")
      .select("id, kind, status, gross, platform_fee, trainer_amount, currency, created_at, payer_id")
      .eq("trainer_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const payerIds = Array.from(
      new Set((data ?? []).map((r) => r.payer_id).filter((v): v is string => !!v)),
    );
    const nameMap = new Map<string, string>();
    if (payerIds.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", payerIds);
      for (const p of profiles ?? []) {
        nameMap.set(p.user_id, p.display_name ?? p.username ?? "user");
      }
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      gross: Number(r.gross),
      platform_fee: Number(r.platform_fee),
      trainer_amount: Number(r.trainer_amount),
      currency: r.currency,
      created_at: r.created_at,
      counterparty: r.payer_id ? nameMap.get(r.payer_id) ?? null : null,
    }));
  });

export const sendTip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        trainerId: z.string().uuid(),
        amount: z.number().min(1).max(10000),
        threadId: z.string().uuid().optional(),
        message: z.string().max(280).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (userId === data.trainerId) throw new Error("You can't tip yourself.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("commission_bps, base_currency")
      .eq("id", true)
      .maybeSingle();
    const bps = settings?.commission_bps ?? 2000;
    const currency = settings?.base_currency ?? "USD";
    const gross = Math.round(data.amount * 100) / 100;
    const platformFee = Math.round(gross * bps) / 10000;
    const trainerAmount = Math.round((gross - platformFee) * 100) / 100;

    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        kind: "tip",
        status: "succeeded",
        payer_id: userId,
        trainer_id: data.trainerId,
        gross,
        platform_fee: platformFee,
        trainer_amount: trainerAmount,
        currency,
        metadata: { source: "placeholder", threadId: data.threadId ?? null },
      })
      .select("id")
      .single();
    if (txErr) throw new Error(txErr.message);

    const { data: tip, error: tipErr } = await supabaseAdmin
      .from("tips")
      .insert({
        from_user_id: userId,
        trainer_id: data.trainerId,
        coaching_thread_id: data.threadId ?? null,
        amount: gross,
        currency,
        status: "succeeded",
        transaction_id: tx.id,
        message: data.message ?? null,
      })
      .select("id")
      .single();
    if (tipErr) throw new Error(tipErr.message);

    await supabaseAdmin.from("transactions").update({ tip_id: tip.id }).eq("id", tx.id);

    const { data: bal } = await supabaseAdmin
      .from("trainer_balances")
      .select("trainer_id, available_amount")
      .eq("trainer_id", data.trainerId)
      .maybeSingle();
    if (bal) {
      await supabaseAdmin
        .from("trainer_balances")
        .update({
          available_amount: Number(bal.available_amount ?? 0) + trainerAmount,
        })
        .eq("trainer_id", data.trainerId);
    } else {
      await supabaseAdmin.from("trainer_balances").insert({
        trainer_id: data.trainerId,
        available_amount: trainerAmount,
        currency,
      });
    }

    return { ok: true, tipId: tip.id };
  });

export type PayoutRow = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  requested_at: string;
  resolved_at: string | null;
  admin_note: string | null;
};

export const listMyPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayoutRow[]> => {
    const { data, error } = await context.supabase
      .from("payouts")
      .select("id, amount, currency, method, status, requested_at, resolved_at, admin_note")
      .eq("trainer_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      currency: r.currency,
      method: r.method,
      status: r.status,
      requested_at: r.requested_at,
      resolved_at: r.resolved_at,
      admin_note: r.admin_note,
    }));
  });

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        amount: z.number().min(1),
        method: z.enum(["stripe", "bank", "paypal", "other"]),
        method_details: z.record(z.string(), z.string()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: settings } = await supabase
      .from("platform_settings")
      .select("min_payout_amount")
      .eq("id", true)
      .maybeSingle();
    const min = Number(settings?.min_payout_amount ?? 25);
    if (data.amount < min) {
      throw new Error(`Minimum payout is ${min}.`);
    }

    const { data: bal } = await supabase
      .from("trainer_balances")
      .select("available_amount, frozen_amount, currency")
      .eq("trainer_id", userId)
      .maybeSingle();
    const available = Number(bal?.available_amount ?? 0);
    if (data.amount > available) {
      throw new Error(`You only have ${available.toFixed(2)} available.`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payout, error } = await supabaseAdmin
      .from("payouts")
      .insert({
        trainer_id: userId,
        amount: data.amount,
        currency: bal?.currency ?? "USD",
        method: data.method,
        method_details: data.method_details ?? {},
        status: "requested",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Move requested amount into frozen (reserved) until admin resolves
    await supabaseAdmin
      .from("trainer_balances")
      .update({
        available_amount: available - data.amount,
        frozen_amount: Number(bal?.frozen_amount ?? 0) + data.amount,
      })
      .eq("trainer_id", userId);

    return { ok: true, payoutId: payout.id };
  });

export const listRecentTipsForTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ trainerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tips")
      .select("id, amount, currency, message, created_at")
      .eq("trainer_id", data.trainerId)
      .eq("from_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });