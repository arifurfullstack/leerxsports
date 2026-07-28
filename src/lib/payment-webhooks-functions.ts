import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type WebhookEvent = {
  id: string;
  provider: "stripe" | "paypal";
  event_id: string;
  event_type: string;
  verified: boolean;
  status: "received" | "processed" | "ignored" | "failed";
  processing_error: string | null;
  transaction_id: string | null;
  payout_id: string | null;
  received_at: string;
  processed_at: string | null;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const listSchema = z.object({
  provider: z.enum(["stripe", "paypal", "all"]).default("all"),
  status: z
    .enum(["received", "processed", "ignored", "failed", "all"])
    .default("all"),
  limit: z.number().int().min(1).max(200).default(50),
});

export const listWebhookEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    let q = supabase
      .from("payment_webhook_events")
      .select(
        "id, provider, event_id, event_type, verified, status, processing_error, transaction_id, payout_id, received_at, processed_at",
      )
      .order("received_at", { ascending: false })
      .limit(data.limit);
    if (data.provider !== "all") q = q.eq("provider", data.provider);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as WebhookEvent[];
  });