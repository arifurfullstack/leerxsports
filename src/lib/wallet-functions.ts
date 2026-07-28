import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserWallet = {
  balance: number;
  currency: string;
};

/**
 * Return signed-in user's wallet balance.
 * Initializes default starting balance ($100.00) if no row exists yet.
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

    if (error) {
      return { balance: 150, currency: "USD" };
    }

    if (!row) {
      // Initialize starting test balance of $150.00
      const { data: ins } = await (supabase as any)
        .from("user_wallets")
        .insert({ user_id: userId, balance: 150, currency: "USD" })
        .select("balance, currency")
        .single();
      return { balance: Number(ins?.balance ?? 150), currency: ins?.currency ?? "USD" };
    }

    return {
      balance: Number(row.balance ?? 0),
      currency: row.currency ?? "USD",
    };
  });

/**
 * Top up user wallet balance.
 */
export const topUpUserWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ amount: z.number().min(5).max(1000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: current } = await (supabase as any)
      .from("user_wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    const newBal = Number(current?.balance ?? 150) + data.amount;

    const { error } = await (supabase as any)
      .from("user_wallets")
      .upsert({ user_id: userId, balance: newBal, currency: "USD", updated_at: new Date().toISOString() });

    if (error) throw new Error(error.message);
    return { ok: true, newBalance: newBal };
  });
