import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { adminSearchUsers, type UserRow } from "@/lib/admin-roles-functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Admin · Users" }] }),
});

function UsersPage() {
  const searchFn = useServerFn(adminSearchUsers);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isFetching } = useQuery<UserRow[]>({
    queryKey: ["admin", "users", submitted],
    queryFn: () => searchFn({ data: { query: submitted } }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Admin</p>
        <h1 className="font-display text-3xl uppercase tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and search every account on the platform.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username, name, or email"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b border-border px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground">
          <span>User</span>
          <span>Email</span>
          <span>Roles</span>
        </div>
        {(data ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {isFetching ? "Loading users..." : "No users found."}
          </p>
        ) : (
          (data ?? []).map((u) => (
            <div
              key={u.user_id}
              className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 border-b border-border/60 px-4 py-3 text-sm last:border-0"
            >
              <div className="flex items-center gap-3">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted" />
                )}
                <div>
                  <p className="font-medium">{u.display_name ?? u.username ?? "Unnamed"}</p>
                  {u.username && (
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  )}
                </div>
                {u.is_demo && <Badge variant="outline">demo</Badge>}
              </div>
              <span className="truncate text-muted-foreground">{u.email ?? "—"}</span>
              <div className="flex flex-wrap justify-end gap-1">
                {u.roles.length === 0 ? (
                  <Badge variant="outline">trainee</Badge>
                ) : (
                  u.roles.map((r) => (
                    <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                      {r}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}