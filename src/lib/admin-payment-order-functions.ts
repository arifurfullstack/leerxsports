/* eslint-disable @typescript-eslint/no-explicit-any -- payment tables/functions are introduced by the pending migration and are not in generated Supabase types yet */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export type PendingBankOrder = {
  id: string;
  payer_id: string;
  payer_name: string | null;
  kind: string;
  amount: number;
  currency: string;
  provider_reference: string;
  created_at: string;
};

export const listPendingBankOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingBankOrder[]> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("payment_orders")
      .select("id, payer_id, kind, amount, currency, provider_reference, created_at")
      .eq("provider", "bank")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);

    const orderRows = (rows ?? []) as Array<{
      id: string;
      payer_id: string;
      kind: string;
      amount: number | string;
      currency: string;
      provider_reference: string;
      created_at: string;
    }>;
    const payerIds = Array.from(new Set(orderRows.map((row) => row.payer_id)));
    const names = new Map<string, string>();
    if (payerIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", payerIds);
      for (const profile of profiles ?? []) {
        names.set(profile.user_id, profile.display_name ?? profile.username ?? "User");
      }
    }
    return orderRows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      payer_name: names.get(row.payer_id) ?? null,
    }));
  });

export const resolveBankPaymentOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        decision: z.enum(["confirm", "reject"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await (supabaseAdmin as any)
      .from("payment_orders")
      .select("id, provider, status, provider_reference")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order || order.provider !== "bank" || order.status !== "pending") {
      throw new Error("Pending bank order not found.");
    }
    if (data.decision === "reject") {
      const { error: rejectError } = await (supabaseAdmin as any)
        .from("payment_orders")
        .update({ status: "failed" })
        .eq("id", data.orderId)
        .eq("status", "pending");
      if (rejectError) throw new Error(rejectError.message);
      return { ok: true, status: "failed" as const };
    }
    const { data: result, error: settleError } = await (supabaseAdmin as any).rpc(
      "complete_payment_order",
      {
        _order_id: data.orderId,
        _external_reference: order.provider_reference,
      },
    );
    if (settleError) throw new Error(settleError.message);
    return { ok: true, status: "paid" as const, result };
  });
