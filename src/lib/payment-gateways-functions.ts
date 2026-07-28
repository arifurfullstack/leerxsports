import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  CONFIG_SCHEMAS,
  SECRET_FIELDS,
  validateGatewayConfig,
  type GatewayProvider,
} from "./gateway-config-schemas";

export type PaymentGateway = {
  provider: "bank" | "stripe" | "paypal";
  display_name: string;
  enabled: boolean;
  mode: "test" | "live";
  config: Record<string, string>;
  updated_at: string;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const listPaymentGateways = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("payment_gateways")
      .select("*")
      .order("provider");
    if (error) throw new Error(error.message);
    return ((data ?? []) as PaymentGateway[]).map(maskGateway);
  });

const updateSchema = z.object({
  provider: z.enum(["bank", "stripe", "paypal"]) as z.ZodEnum<[GatewayProvider, ...GatewayProvider[]]>,
  enabled: z.boolean().optional(),
  mode: z.enum(["test", "live"]).optional(),
  config: z.record(z.string(), z.string()).optional(),
});

export const updatePaymentGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    // Snapshot before-state for the audit log.
    const { data: before } = await supabase
      .from("payment_gateways")
      .select("enabled, mode, config")
      .eq("provider", data.provider)
      .single();
    const patch: Record<string, unknown> = { updated_by: userId };
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.mode !== undefined) patch.mode = data.mode;
    if (data.config !== undefined) {
      // Strip the mask sentinel: if the admin didn't touch a secret field,
      // the UI echoes back "••••••••". Treat that as "no change".
      const incoming: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.config)) {
        if (v && !/^•+$/.test(v)) incoming[k] = v;
      }
      // 1. Per-provider validation (throws user-readable ZodError on failure).
      const clean = validateGatewayConfig(data.provider, incoming);
      // 2. Merge onto the existing stored config so secret fields the admin
      //    didn't touch aren't wiped.
      const { data: existing } = await supabase
        .from("payment_gateways")
        .select("config")
        .eq("provider", data.provider)
        .single();
      const merged: Record<string, string> = {
        ...((existing?.config as Record<string, string>) ?? {}),
        ...clean,
      };
      // 3. Encrypt any secret fields at rest.
      const { encryptSecret, isEncrypted } = await import("./gateway-crypto.server");
      for (const field of SECRET_FIELDS[data.provider]) {
        const v = merged[field];
        if (v && !isEncrypted(v)) merged[field] = encryptSecret(v);
      }
      patch.config = merged;
    }
    const { data: row, error } = await supabase
      .from("payment_gateways")
      .update(patch)
      .eq("provider", data.provider)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Build a redacted change record: log field names only for secrets.
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (data.enabled !== undefined && before?.enabled !== data.enabled) {
      changes.enabled = { from: before?.enabled, to: data.enabled };
    }
    if (data.mode !== undefined && before?.mode !== data.mode) {
      changes.mode = { from: before?.mode, to: data.mode };
    }
    if (data.config !== undefined) {
      const secretSet = new Set(SECRET_FIELDS[data.provider] ?? []);
      const beforeCfg = (before?.config ?? {}) as Record<string, string>;
      const afterCfg = (row?.config ?? {}) as Record<string, string>;
      const keys = new Set([...Object.keys(beforeCfg), ...Object.keys(afterCfg)]);
      for (const k of keys) {
        const b = beforeCfg[k] ?? "";
        const a = afterCfg[k] ?? "";
        if (b === a) continue;
        if (secretSet.has(k)) {
          changes[k] = {
            from: b ? "••••" : null,
            to: a ? "••••" : null,
          };
        } else {
          changes[k] = { from: b || null, to: a || null };
        }
      }
    }
    if (Object.keys(changes).length > 0) {
      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: "payment_gateway.update",
        target_table: "payment_gateways",
        target_id: data.provider,
        metadata: { provider: data.provider, changes },
      });
    }

    return maskGateway(row as PaymentGateway);
  });

/** Load the raw (decrypted) config for a provider — admin-only. */
async function loadDecryptedConfig(
  supabase: any,
  provider: GatewayProvider,
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("payment_gateways")
    .select("config")
    .eq("provider", provider)
    .single();
  if (error) throw new Error(error.message);
  const cfg = (data?.config ?? {}) as Record<string, string>;
  const { decryptSecret, isEncrypted } = await import("./gateway-crypto.server");
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg)) {
    out[k] = v && isEncrypted(v) ? decryptSecret(v) : v;
  }
  return out;
}

const testSchema = z.object({
  provider: z.enum(["bank", "stripe", "paypal"]) as z.ZodEnum<
    [GatewayProvider, ...GatewayProvider[]]
  >,
});

export type TestConnectionResult = {
  ok: boolean;
  message: string;
  details?: Record<string, string | number | boolean | null>;
};

export const testPaymentGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => testSchema.parse(input))
  .handler(async ({ data, context }): Promise<TestConnectionResult> => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("payment_gateways")
      .select("mode")
      .eq("provider", data.provider)
      .single();
    if (error) throw new Error(error.message);
    const mode = (row?.mode ?? "test") as "test" | "live";
    const cfg = await loadDecryptedConfig(supabase, data.provider);

    if (data.provider === "bank") {
      const required = ["bank_name", "account_name", "account_number"];
      const missing = required.filter((k) => !cfg[k]?.trim());
      if (missing.length) {
        return { ok: false, message: `Missing: ${missing.join(", ")}` };
      }
      return {
        ok: true,
        message: "Bank details look complete.",
        details: { bank: cfg.bank_name, account: cfg.account_name },
      };
    }

    if (data.provider === "stripe") {
      const key = cfg.secret_key;
      if (!key) return { ok: false, message: "Missing Stripe secret key." };
      try {
        const res = await fetch("https://api.stripe.com/v1/account", {
          headers: { Authorization: `Bearer ${key}` },
        });
        const body = (await res.json()) as any;
        if (!res.ok) {
          return {
            ok: false,
            message: body?.error?.message ?? `Stripe error (${res.status})`,
          };
        }
        const isLive = key.startsWith("sk_live_");
        if ((mode === "live") !== isLive) {
          return {
            ok: false,
            message: `Key is ${isLive ? "LIVE" : "TEST"} but gateway mode is ${mode.toUpperCase()}.`,
          };
        }
        return {
          ok: true,
          message: `Connected to Stripe account ${body.id}.`,
          details: {
            account_id: body.id,
            business: body.business_profile?.name ?? body.settings?.dashboard?.display_name ?? null,
            country: body.country ?? null,
            charges_enabled: body.charges_enabled ?? null,
            payouts_enabled: body.payouts_enabled ?? null,
            livemode: !!body.livemode,
          },
        };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      }
    }

    if (data.provider === "paypal") {
      const id = cfg.client_id;
      const secret = cfg.client_secret;
      if (!id || !secret) {
        return { ok: false, message: "Missing PayPal client ID or secret." };
      }
      const base =
        mode === "live"
          ? "https://api-m.paypal.com"
          : "https://api-m.sandbox.paypal.com";
      try {
        const auth = Buffer.from(`${id}:${secret}`).toString("base64");
        const res = await fetch(`${base}/v1/oauth2/token`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "grant_type=client_credentials",
        });
        const body = (await res.json()) as any;
        if (!res.ok || !body.access_token) {
          return {
            ok: false,
            message:
              body?.error_description ??
              body?.error ??
              `PayPal error (${res.status})`,
          };
        }
        return {
          ok: true,
          message: `Authenticated with PayPal (${mode}).`,
          details: {
            app_id: body.app_id ?? null,
            scope: body.scope ?? null,
            expires_in: body.expires_in ?? null,
          },
        };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      }
    }

    return { ok: false, message: "Unknown provider." };
  });

export type GatewayAuditEntry = {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  target_id: string | null;
  metadata: Record<string, any>;
};

const listAuditSchema = z.object({
  provider: z
    .enum(["bank", "stripe", "paypal", "all"])
    .optional()
    .default("all"),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

export const listPaymentGatewayAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => listAuditSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<GatewayAuditEntry[]> => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    let q = supabase
      .from("audit_logs")
      .select("id, created_at, actor_id, action, target_id, metadata")
      .in("action", ["payment_gateway.update", "payment_gateway.test"])
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.provider !== "all") q = q.eq("target_id", data.provider);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    const actorIds = Array.from(
      new Set(list.map((r) => r.actor_id).filter(Boolean)),
    );
    let profiles: Record<string, { display_name: string | null; username: string | null }> = {};
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", actorIds);
      for (const p of profs ?? []) {
        profiles[p.user_id] = { display_name: p.display_name, username: p.username };
      }
    }
    return list.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      actor_id: r.actor_id,
      actor_name:
        profiles[r.actor_id]?.display_name ??
        profiles[r.actor_id]?.username ??
        null,
      actor_email: null,
      action: r.action,
      target_id: r.target_id,
      metadata: r.metadata ?? {},
    }));
  });

/** Replace encrypted secret values with a redacted marker for the UI. */
function maskGateway(gw: PaymentGateway): PaymentGateway {
  const secretKeys = SECRET_FIELDS[gw.provider] ?? [];
  const config = { ...(gw.config ?? {}) };
  for (const k of secretKeys) {
    if (config[k]) config[k] = "••••••••";
  }
  return { ...gw, config };
}

/**
 * Reveal a single decrypted secret to an authenticated admin.
 * Every reveal is recorded in `audit_logs` with the actor and field name.
 */
const revealSchema = z.object({
  provider: z.enum(["bank", "stripe", "paypal"]) as z.ZodEnum<
    [GatewayProvider, ...GatewayProvider[]]
  >,
  field: z.string().min(1).max(64),
});

export const revealGatewaySecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => revealSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ value: string }> => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const allowed = SECRET_FIELDS[data.provider] ?? [];
    if (!allowed.includes(data.field)) {
      throw new Error("Field is not a secret");
    }

    const cfg = await loadDecryptedConfig(supabase, data.provider);
    const value = cfg[data.field] ?? "";

    // Audit trail — never log the value itself.
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "payment_gateway.reveal_secret",
      target_type: "payment_gateway",
      target_id: data.provider,
      metadata: { field: data.field, has_value: value.length > 0 },
    });

    return { value };
  });