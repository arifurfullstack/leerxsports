import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260728150000_payment_orders_wallet_checkout.sql"),
  "utf8",
);
const walletSource = readFileSync(resolve(process.cwd(), "src/lib/wallet-functions.ts"), "utf8");

describe("verified checkout architecture", () => {
  it("settles external and wallet payments through idempotent database functions", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.complete_payment_order");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.pay_payment_order_with_wallet");
    expect(migration).toContain("IF v_order.status = 'paid'");
    expect(migration).toContain("FOR UPDATE");
  });

  it("keeps settlement privileged and wallet payment user-scoped", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.complete_payment_order(UUID, TEXT) FROM authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.complete_payment_order(UUID, TEXT) TO service_role",
    );
    expect(migration).toContain("v_order.payer_id <> auth.uid()");
  });

  it("never gives newly created wallets a demo balance", () => {
    expect(migration).toContain("balance NUMERIC(12,2) NOT NULL DEFAULT 0");
    expect(walletSource).not.toContain("balance: 150");
    expect(walletSource).not.toContain("balance: 100");
  });

  it("records immutable wallet entries for top-ups and purchases", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.wallet_entries");
    expect(migration).toContain("'topup'");
    expect(migration).toContain("'purchase'");
    expect(migration).toContain("wallet_entries_order_kind_unique");
  });
});
