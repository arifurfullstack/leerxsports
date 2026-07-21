import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, ShieldCheck, ShieldOff, Shield } from "lucide-react";
import {
  adminSearchUsers,
  adminPromoteUser,
  adminDemoteUser,
  adminListAdmins,
  type UserRow,
} from "@/lib/admin-roles-functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminNav } from "@/components/admin-nav";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: RolesPage,
  head: () => ({
    meta: [{ title: "Admin · Roles" }],
  }),
});

function RolesPage() {
  const qc = useQueryClient();
  const searchFn = useServerFn(adminSearchUsers);
  const promoteFn = useServerFn(adminPromoteUser);
  const demoteFn = useServerFn(adminDemoteUser);
  const listAdminsFn = useServerFn(adminListAdmins);

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data: users, isFetching } = useQuery({
    queryKey: ["admin-user-search", submitted],
    queryFn: () => searchFn({ data: { query: submitted } }),
  });

  const { data: admins, isFetching: adminsLoading } = useQuery({
    queryKey: ["admin-list-admins"],
    queryFn: () => listAdminsFn(),
  });

  const promote = useMutation({
    mutationFn: (userId: string) => promoteFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Promoted to admin");
      qc.invalidateQueries({ queryKey: ["admin-user-search"] });
      qc.invalidateQueries({ queryKey: ["admin-list-admins"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const demote = useMutation({
    mutationFn: (userId: string) => demoteFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Admin role removed");
      qc.invalidateQueries({ queryKey: ["admin-user-search"] });
      qc.invalidateQueries({ queryKey: ["admin-list-admins"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-4 py-10">
      <header>
        <h1 className="font-display text-3xl">Role management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Promote a signed-up user to <strong>admin</strong>, or remove admin access.
        </p>
        <AdminNav />
      </header>

      <section className="mt-6 rounded-lg border border-border/60 bg-card">
        <header className="flex items-center justify-between border-b border-border/60 p-4">
          <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-widest">
            <Shield className="h-4 w-4 text-primary" /> Current admins
            {admins && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({admins.length})
              </span>
            )}
          </h2>
          {adminsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </header>
        {!admins || admins.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No admins found. Promote a user below to grant admin access.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {admins.map((u) => {
              const busy = demote.isPending && demote.variables === u.user_id;
              return (
                <li
                  key={u.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {u.display_name || u.username || "Unnamed"}
                      </span>
                      {u.username && (
                        <span className="text-xs text-muted-foreground">@{u.username}</span>
                      )}
                      {u.is_demo && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          demo
                        </span>
                      )}
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        admin
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {u.email ?? u.user_id}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Remove admin role from ${u.display_name || u.username || u.email}?`,
                        )
                      )
                        demote.mutate(u.user_id);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldOff className="mr-2 h-4 w-4" />
                    )}
                    Remove admin
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by username, name, or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Search
        </Button>
      </form>

      <section className="mt-6 rounded-lg border border-border/60 bg-card">
        {!users || users.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {submitted
              ? `No users match "${submitted}".`
              : "Search for a user to promote or demote."}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {users.map((u: UserRow) => {
              const isAdmin = u.roles.includes("admin");
              const busy =
                (promote.isPending && promote.variables === u.user_id) ||
                (demote.isPending && demote.variables === u.user_id);
              return (
                <li
                  key={u.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {u.display_name || u.username || "Unnamed"}
                      </span>
                      {u.username && (
                        <span className="text-xs text-muted-foreground">
                          @{u.username}
                        </span>
                      )}
                      {u.is_demo && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          demo
                        </span>
                      )}
                      {u.roles.map((r) => (
                        <span
                          key={r}
                          className={
                            r === "admin"
                              ? "rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary"
                              : "rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground"
                          }
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {u.email ?? u.user_id}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {isAdmin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              `Remove admin role from ${u.display_name || u.username || u.email}?`,
                            )
                          )
                            demote.mutate(u.user_id);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        {busy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldOff className="mr-2 h-4 w-4" />
                        )}
                        Remove admin
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => promote.mutate(u.user_id)}
                      >
                        {busy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-2 h-4 w-4" />
                        )}
                        Promote to admin
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
