import { z } from "zod";

/** Client-safe map of which config fields are secret (encrypted at rest). */
export const SECRET_FIELDS: Record<"bank" | "stripe" | "paypal", string[]> = {
  bank: [],
  stripe: ["secret_key", "webhook_secret"],
  paypal: ["client_secret"],
};

const trimmed = (max = 500) =>
  z.string().trim().max(max, `Must be ${max} chars or fewer`);

/** Per-provider config schemas. All fields optional so partial saves work. */
export const CONFIG_SCHEMAS = {
  bank: z
    .object({
      bank_name: trimmed(120).optional(),
      account_name: trimmed(120).optional(),
      account_number: trimmed(40)
        .regex(/^[A-Za-z0-9 -]*$/, "Digits, letters, spaces or dashes only")
        .optional(),
      iban: trimmed(40)
        .regex(/^[A-Za-z0-9 ]*$/, "Invalid IBAN characters")
        .optional(),
      swift: trimmed(15)
        .regex(/^[A-Za-z0-9]*$/, "SWIFT/BIC must be alphanumeric")
        .optional(),
      routing_number: trimmed(20)
        .regex(/^[0-9]*$/, "Digits only")
        .optional(),
      instructions: trimmed(2000).optional(),
    })
    .strict(),
  stripe: z
    .object({
      publishable_key: trimmed(200)
        .refine((v) => !v || /^pk_(test|live)_[A-Za-z0-9]+$/.test(v), {
          message: "Must start with pk_test_ or pk_live_",
        })
        .optional(),
      secret_key: trimmed(200)
        .refine(
          (v) => !v || v.startsWith("enc::") || /^sk_(test|live)_[A-Za-z0-9]+$/.test(v),
          { message: "Must start with sk_test_ or sk_live_" },
        )
        .optional(),
      webhook_secret: trimmed(200)
        .refine(
          (v) => !v || v.startsWith("enc::") || /^whsec_[A-Za-z0-9]+$/.test(v),
          { message: "Must start with whsec_" },
        )
        .optional(),
    })
    .strict(),
  paypal: z
    .object({
      client_id: trimmed(120)
        .regex(/^[A-Za-z0-9_-]*$/, "Invalid client ID characters")
        .optional(),
      client_secret: trimmed(200)
        .refine((v) => !v || v.startsWith("enc::") || /^[A-Za-z0-9_-]+$/.test(v), {
          message: "Invalid client secret characters",
        })
        .optional(),
      webhook_id: trimmed(120)
        .regex(/^[A-Za-z0-9_-]*$/, "Invalid webhook ID characters")
        .optional(),
    })
    .strict(),
} as const;

export type GatewayProvider = keyof typeof CONFIG_SCHEMAS;

/** UI-facing descriptor for a single credential field. */
export type GatewayFieldDef = {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
  secret?: boolean;
  placeholder?: { test?: string; live?: string; default?: string };
  helperText?: string;
  /** If omitted the field applies to both modes. */
  modes?: Array<"test" | "live">;
  required?: boolean;
};

/**
 * Single source of truth for which fields render for each provider + mode.
 * The admin UI reads this so it only shows fields that apply.
 */
export const GATEWAY_FIELDS: Record<GatewayProvider, GatewayFieldDef[]> = {
  bank: [
    { key: "bank_name", label: "Bank name", type: "text", placeholder: { default: "Chase" }, required: true },
    { key: "account_name", label: "Account holder", type: "text", placeholder: { default: "Leer Inc." }, required: true },
    {
      key: "account_number",
      label: "Account number",
      type: "text",
      placeholder: { test: "TEST 0000 0000 0000", live: "0000 0000 0000" },
      required: true,
    },
    { key: "iban", label: "IBAN", type: "text", placeholder: { default: "GB00 XXXX ..." } },
    { key: "swift", label: "SWIFT / BIC", type: "text", placeholder: { default: "CHASUS33" } },
    {
      key: "routing_number",
      label: "Routing number",
      type: "text",
      placeholder: { default: "021000021" },
      modes: ["live"],
    },
    {
      key: "instructions",
      label: "Payment instructions",
      type: "textarea",
      placeholder: {
        test: "Sandbox transfer — reference SANDBOX-<order-id> in the memo.",
        live: "Include order ID in the memo. Funds settle in 1-2 business days.",
      },
      helperText: "Shown to customers on the checkout page.",
    },
  ],
  stripe: [
    {
      key: "publishable_key",
      label: "Publishable key",
      type: "text",
      placeholder: { test: "pk_test_...", live: "pk_live_..." },
      helperText: "Safe to expose in the browser.",
      required: true,
    },
    {
      key: "secret_key",
      label: "Secret key",
      type: "password",
      secret: true,
      placeholder: { test: "sk_test_...", live: "sk_live_..." },
      helperText: "Server-side only. Encrypted at rest.",
      required: true,
    },
    {
      key: "webhook_secret",
      label: "Webhook signing secret",
      type: "password",
      secret: true,
      placeholder: { default: "whsec_..." },
      helperText: "Required to verify inbound webhook events.",
    },
  ],
  paypal: [
    {
      key: "client_id",
      label: "Client ID",
      type: "text",
      placeholder: { test: "Sandbox client ID (AUxxxx...)", live: "Live client ID (AUxxxx...)" },
      required: true,
    },
    {
      key: "client_secret",
      label: "Client secret",
      type: "password",
      secret: true,
      placeholder: { test: "Sandbox secret (ELxxxx...)", live: "Live secret (ELxxxx...)" },
      helperText: "Encrypted at rest. Rotate from the PayPal dashboard.",
      required: true,
    },
    {
      key: "webhook_id",
      label: "Webhook ID",
      type: "text",
      placeholder: { default: "WH-xxxx-xxxx" },
      helperText: "Only needed in live mode for signature verification.",
      modes: ["live"],
    },
  ],
};

export function getGatewayFields(
  provider: GatewayProvider,
  mode: "test" | "live",
): GatewayFieldDef[] {
  return GATEWAY_FIELDS[provider].filter(
    (f) => !f.modes || f.modes.includes(mode),
  );
}

export function resolvePlaceholder(
  field: GatewayFieldDef,
  mode: "test" | "live",
): string | undefined {
  return field.placeholder?.[mode] ?? field.placeholder?.default;
}

/**
 * Validate a single field value against its provider's Zod schema.
 * Returns an error message string, or null when the value is valid.
 * Empty strings are always valid here — required-ness is enforced on submit.
 */
export function validateGatewayField(
  provider: GatewayProvider,
  key: string,
  value: string,
): string | null {
  if (!value) return null;
  const shape = (CONFIG_SCHEMAS[provider] as unknown as {
    shape: Record<string, z.ZodTypeAny>;
  }).shape;
  const fieldSchema = shape[key];
  if (!fieldSchema) return null;
  const result = fieldSchema.safeParse(value);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? "Invalid value";
}

/**
 * Validate an entire config object; returns a map of field -> error message
 * plus errors for missing required fields (per the supplied mode).
 */
export function validateGatewayConfigLive(
  provider: GatewayProvider,
  mode: "test" | "live",
  config: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const fields = GATEWAY_FIELDS[provider].filter(
    (f) => !f.modes || f.modes.includes(mode),
  );
  for (const f of fields) {
    const value = (config[f.key] ?? "").trim();
    if (!value) {
      if (f.required) errors[f.key] = `${f.label} is required`;
      continue;
    }
    const err = validateGatewayField(provider, f.key, value);
    if (err) errors[f.key] = err;
  }
  return errors;
}

export function validateGatewayConfig(
  provider: GatewayProvider,
  config: Record<string, string>,
) {
  const schema = CONFIG_SCHEMAS[provider];
  const parsed = schema.parse(config);
  // Drop empty strings so we don't overwrite existing values with blanks.
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === "string" && v.length > 0) clean[k] = v;
  }
  return clean;
}