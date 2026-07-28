import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownLeft, ArrowUpRight, Loader2, Wallet } from "lucide-react";
import { PaidCheckoutButton } from "@/components/paid-checkout-button";
import { getUserWalletBalance, listWalletEntries } from "@/lib/wallet-functions";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet | LEER" }] }),
  component: WalletPage,
});

function WalletPage() {
  const queryClient = useQueryClient();
  const getWallet = useServerFn(getUserWalletBalance);
  const getEntries = useServerFn(listWalletEntries);
  const wallet = useQuery({
    queryKey: ["user-wallet"],
    queryFn: () => getWallet(),
  });
  const entries = useQuery({
    queryKey: ["wallet-entries"],
    queryFn: () => getEntries({ data: { limit: 50 } }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["user-wallet"] });
    queryClient.invalidateQueries({ queryKey: ["wallet-entries"] });
  };

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <header>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Verified funds
        </p>
        <h1 className="mt-2 font-display text-4xl uppercase tracking-tight">LEER Wallet</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Add funds through an enabled payment gateway, then use the wallet for instant
          subscriptions, premium unlocks, and coaching tips.
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-7 shadow-2xl">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Wallet className="h-5 w-5 text-primary" />
            <span className="text-xs uppercase tracking-widest">Available balance</span>
          </div>
          {wallet.isLoading ? (
            <Loader2 className="mt-8 h-8 w-8 animate-spin" />
          ) : (
            <p className="mt-5 font-display text-6xl tracking-tight">
              {wallet.data?.currency === "USD" ? "$" : ""}
              {(wallet.data?.balance ?? 0).toFixed(2)}
              <span className="ml-2 text-lg text-muted-foreground">
                {wallet.data?.currency ?? "USD"}
              </span>
            </p>
          )}
          <p className="mt-5 text-xs text-muted-foreground">
            Wallet credits are created only after provider confirmation. No demo or promotional
            balance is added automatically.
          </p>
        </div>

        <div className="rounded-3xl border bg-card p-6">
          <h2 className="font-display text-xl uppercase">Add funds</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose an amount, then select any gateway enabled by the administrator.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[25, 50, 100, 250].map((amount) => (
              <PaidCheckoutButton
                key={amount}
                kind="wallet_topup"
                amount={amount}
                title="Add verified wallet funds"
                description="Your balance is credited after the selected provider confirms payment."
                label={`Add $${amount}`}
                className="w-full"
                onPaid={refresh}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-card">
        <div className="border-b p-5">
          <h2 className="font-display text-xl uppercase">Wallet activity</h2>
        </div>
        {entries.isLoading ? (
          <div className="grid place-items-center p-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (entries.data?.length ?? 0) === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No wallet activity yet.</p>
        ) : (
          <div className="divide-y">
            {entries.data?.map((entry) => {
              const credit = entry.amount > 0;
              return (
                <div key={entry.id} className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full ${
                        credit
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {credit ? (
                        <ArrowDownLeft className="h-5 w-5" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5" />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-medium capitalize">
                        {entry.description ?? entry.kind}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`block font-semibold ${credit ? "text-emerald-500" : ""}`}>
                      {credit ? "+" : "-"}${Math.abs(entry.amount).toFixed(2)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Balance ${entry.balance_after.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
