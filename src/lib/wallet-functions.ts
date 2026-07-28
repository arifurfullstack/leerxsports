/* eslint-disable @typescript-eslint/no-explicit-any -- payment tables/functions are introduced by the pending migration and are not in generated Supabase types yet */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserWallet = {
  balance: number;
  currency: string;
};

/**
 * Return the signed-in user's verified wallet balance.
 * Wallets start at zero and are credited only after a provider-confirmed
 * top-up or an administrator adjustment.
 */
export const getUserWalletBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserWallet> => {
    const { supabase, userId } = context;
    const { data: row, error } = await (supabase as any)
      .from("user_wallets")
      .select("balance, currency")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      balance: Number(row?.balance ?? 0),
      currency: row?.currency ?? "USD",
    };
  });

export type WalletEntry = {
  id: string;
  kind: "topup" | "purchase" | "refund" | "adjustment";
  amount: number;
  balance_after: number;
  currency: string;
  description: string | null;
  created_at: string;
};

export const listWalletEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ limit: z.number().int().min(1).max(100).default(50) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<WalletEntry[]> => {
    const { data: rows, error } = await (context.supabase as any)
      .from("wallet_entries")
      .select("id, kind, amount, balance_after, currency, description, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row: any) => ({
      ...row,
      amount: Number(row.amount),
      balance_after: Number(row.balance_after),
    }));
  });
