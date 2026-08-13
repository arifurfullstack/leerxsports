import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-bearer";
import { optionalSupabaseAuth, requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const QA_PRICE = 300;

export type QADispatch = {
  id: string;
  fan_id: string;
  creator_id: string;
  question: string;
  answer: string | null;
  video_url?: string | null;
  followup_question?: string | null;
  followup_answer?: string | null;
  price: number;
  status: "pending" | "coached" | "followup_pending" | "completed" | "expired" | "refunded" | "disputing";
  answered_at: string | null;
  expires_at: string;
  created_at: string;
  fan?: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  creator?: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

/** Send a paid question ($300 placeholder charge) to a creator. */
export const sendQADispatch = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((input: any) => {
    const payload = input?.data ?? input;
    return z
      .object({
        creatorId: z.string().uuid(),
        question: z.string().min(10).max(2000),
        videoUrl: z.string().url().optional().nullable(),
      })
      .parse(payload);
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.creatorId === userId) throw new Error("You can't message yourself.");

    const { data: tp, error: tpErr } = await supabase
      .from("trainer_profiles")
      .select("user_id, monetization_enabled")
      .eq("user_id", data.creatorId)
      .maybeSingle();
    if (tpErr) throw new Error(tpErr.message);
    if (!tp) throw new Error("Creator not found.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("commission_bps, base_currency")
      .eq("id", true)
      .maybeSingle();
    const bps = settings?.commission_bps ?? 2000;
    const currency = settings?.base_currency ?? "USD";
    const gross = QA_PRICE;
    const platformFee = Math.round(gross * bps) / 10000;
    const trainerAmount = Math.round((gross - platformFee) * 100) / 100;

    // Check trainee wallet balance
    const { data: walletRow, error: wErr } = await (supabaseAdmin as any)
      .from("user_wallets")
      .select("balance, currency")
      .eq("user_id", userId)
      .maybeSingle();
    if (wErr) throw new Error(wErr.message);

    const currentBalance = Number(walletRow?.balance ?? 0);
    if (currentBalance < gross) {
      throw new Error(
        `Insufficient wallet balance ($${currentBalance.toFixed(2)} available, $${gross}.00 required). Please top up your wallet.`,
      );
    }

    const newBalance = Math.round((currentBalance - gross) * 100) / 100;

    // Deduct $300 from trainee wallet
    const { error: updWalletErr } = await (supabaseAdmin as any)
      .from("user_wallets")
      .upsert(
        {
          user_id: userId,
          balance: newBalance,
          currency: walletRow?.currency ?? currency,
        },
        { onConflict: "user_id" },
      );
    if (updWalletErr) throw new Error(updWalletErr.message);

    // Insert wallet entry for trainee purchase
    await (supabaseAdmin as any).from("wallet_entries").insert({
      user_id: userId,
      kind: "purchase",
      amount: -gross,
      balance_after: newBalance,
      currency: walletRow?.currency ?? currency,
      description: `Paid Q&A Dispatch ($${gross})`,
    });

    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        kind: "qa",
        status: "held",
        payer_id: userId,
        trainer_id: data.creatorId,
        gross,
        platform_fee: platformFee,
        trainer_amount: trainerAmount,
        currency,
        metadata: { source: "placeholder", type: "qa_dispatch", video_url: data.videoUrl ?? null },
      })
      .select("id")
      .maybeSingle();
    if (txErr) throw new Error(txErr.message);

    const { data: dispatch, error: dErr } = await supabase
      .from("qa_dispatches")
      .insert({
        fan_id: userId,
        creator_id: data.creatorId,
        question: data.question,
        price: gross,
        transaction_id: tx?.id ?? null,
      })
      .select("id")
      .single();
    if (dErr) throw new Error(dErr.message);

    return { ok: true, id: dispatch.id };
  });

/** Creator answers a pending dispatch or follow-up. Releases held funds to their balance. */
export const answerQADispatch = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((input: any) => {
    const payload = input?.data ?? input;
    return z
      .object({
        dispatchId: z.string().uuid(),
        answer: z.string().min(10).max(5000),
        videoUrl: z.string().url().optional().nullable(),
      })
      .parse(payload);
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("qa_dispatches")
      .select("id, creator_id, status, transaction_id, price")
      .eq("id", data.dispatchId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Question not found.");
    if (row.creator_id !== userId) throw new Error("Not authorized.");

    if (row.status === "completed" || row.status === "expired" || row.status === "refunded") {
      throw new Error("This coaching thread is locked and completed.");
    }

    const isFinalAnswer = row.status === "followup_pending";
    const nextStatus: QADispatch["status"] = isFinalAnswer ? "completed" : "coached";

    if (isFinalAnswer) {
      const { error: updErr } = await supabase
        .from("qa_dispatches")
        .update({ followup_answer: data.answer, status: "completed" })
        .eq("id", data.dispatchId);
      if (updErr) throw new Error(updErr.message);
    } else {
      const { error: updErr } = await supabase
        .from("qa_dispatches")
        .update({ answer: data.answer, status: "coached", answered_at: new Date().toISOString() })
        .eq("id", data.dispatchId);
      if (updErr) throw new Error(updErr.message);
    }

    // Release held funds to creator balance if not already released.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (row.transaction_id) {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "succeeded" })
        .eq("id", row.transaction_id);
    }
    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("commission_bps, base_currency")
      .eq("id", true)
      .maybeSingle();
    const bps = settings?.commission_bps ?? 2000;
    const currency = settings?.base_currency ?? "USD";
    const gross = Number(row.price ?? QA_PRICE);
    const platformFee = Math.round(gross * bps) / 10000;
    const trainerAmount = Math.round((gross - platformFee) * 100) / 100;

    const { data: bal } = await supabaseAdmin
      .from("trainer_balances")
      .select("available_amount")
      .eq("trainer_id", userId)
      .maybeSingle();
    if (bal) {
      await supabaseAdmin
        .from("trainer_balances")
        .update({ available_amount: Number(bal.available_amount ?? 0) + trainerAmount })
        .eq("trainer_id", userId);
    } else {
      await supabaseAdmin
        .from("trainer_balances")
        .insert({ trainer_id: userId, available_amount: trainerAmount, currency });
    }

    // Also credit creator's user_wallets balance
    const { creditCreatorWallet } = await import("@/lib/wallet-functions");
    await creditCreatorWallet(
      supabaseAdmin,
      userId,
      trainerAmount,
      currency,
      row.transaction_id ?? undefined,
      "Earned Paid Q&A response",
    );

    return { ok: true, status: nextStatus };
  });

/** Trainee submits exactly 1 follow-up reply on a coached question. */
export const submitQAFollowup = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((input: any) => {
    const payload = input?.data ?? input;
    return z
      .object({
        dispatchId: z.string().uuid(),
        question: z.string().min(5).max(2000),
      })
      .parse(payload);
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("qa_dispatches")
      .select("id, fan_id, status, followup_question")
      .eq("id", data.dispatchId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Question not found.");
    if (row.fan_id !== userId) throw new Error("Only the original trainee can submit a follow-up.");

    if (row.status !== "coached") {
      throw new Error(
        row.status === "completed"
          ? "This coaching thread is completed and locked. Only 1 follow-up was allowed."
          : "Follow-up can only be submitted after the trainer provides initial coaching."
      );
    }
    if (row.followup_question) {
      throw new Error("Only 1 follow-up is allowed per coaching session.");
    }

    const { error: updErr } = await supabase
      .from("qa_dispatches")
      .update({
        followup_question: data.question,
        status: "followup_pending",
      })
      .eq("id", data.dispatchId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, status: "followup_pending" };
  });

/** List dispatches where the caller is fan or creator. */
export const listMyQADispatches = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, optionalSupabaseAuth])
  .validator((input: any) => {
    const payload = input?.data ?? input ?? {};
    return z.object({ role: z.enum(["fan", "creator", "all"]).default("all") }).parse(payload);
  })
  .handler(async ({ data, context }): Promise<QADispatch[]> => {
    const { userId } = context;
    if (!userId) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("qa_dispatches")
      .select("id, fan_id, creator_id, question, answer, followup_question, followup_answer, price, status, answered_at, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.role === "fan") q = q.eq("fan_id", userId);
    else if (data.role === "creator") q = q.eq("creator_id", userId);
    else q = q.or(`fan_id.eq.${userId},creator_id.eq.${userId}`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set((rows ?? []).flatMap((r) => [r.fan_id, r.creator_id])),
    );
    const { data: profiles } = ids.length
      ? await supabaseAdmin
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", ids)
      : { data: [] as Array<{ user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }> };
    const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    return (rows ?? []).map((r) => ({
      ...r,
      price: Number(r.price),
      status: r.status as QADispatch["status"],
      fan: pmap.get(r.fan_id) ?? null,
      creator: pmap.get(r.creator_id) ?? null,
    }));
  });
