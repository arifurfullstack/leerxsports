import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, Pencil, X, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  adminBulkUserAction,
  adminSearchUsers,
  type BulkAction,
  type BulkResult,
  type UserRow,
} from "@/lib/admin-roles-functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditUserDialog } from "@/components/admin/edit-user-dialog";
import { VerifiedBadge } from "@/components/verified-badge";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Admin · Users" }] }),
});

type RoleFilter = "any" | "admin" | "moderator" | "trainer" | "trainee";
type StatusFilter = "any" | "verified" | "unverified" | "demo" | "real" | "banned" | "active";

function UsersPage() {
  const searchFn = useServerFn(adminSearchUsers);
  const bulkFn = useServerFn(adminBulkUserAction);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState<RoleFilter>("any");
  const [status, setStatus] = useState<StatusFilter>("any");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ action: BulkAction; role?: string; label: string } | null>(null);
  const [passwords, setPasswords] = useState<BulkResult["passwords"]>(undefined);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  const { data, isFetching } = useQuery<UserRow[]>({
    queryKey: ["admin", "users", debounced],
    queryFn: () => searchFn({ data: { query: debounced } }),
    placeholderData: (prev) => prev,
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    return rows.filter((u) => {
      if (role !== "any") {
        const has = u.roles.includes(role) || (role === "trainee" && u.roles.length === 0);
        if (!has) return false;
      }
      switch (status) {
        case "verified": if (!u.is_verified) return false; break;
        case "unverified": if (u.is_verified) return false; break;
        case "demo": if (!u.is_demo) return false; break;
        case "real": if (u.is_demo) return false; break;
        case "banned": if (!u.banned) return false; break;
        case "active": if (u.banned) return false; break;
      }
      return true;
    });
  }, [data, role, status]);

  const hasFilters = role !== "any" || status !== "any" || query.length > 0;

  const visibleIds = useMemo(() => filtered.map((u) => u.user_id), [filtered]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = !allVisibleSelected && visibleIds.some((id) => selected.has(id));

  const toggleAllVisible = (checked: boolean) => {
    const next = new Set(selected);
    if (checked) visibleIds.forEach((id) => next.add(id));
    else visibleIds.forEach((id) => next.delete(id));
    setSelected(next);
  };
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const bulkMutation = useMutation({
    mutationFn: (input: { action: BulkAction; role?: string }) =>
      bulkFn({ data: { userIds: [...selected], action: input.action, role: input.role } }),
    onSuccess: (res, vars) => {
      const okN = res.succeeded.length;
      const failN = res.failed.length;
      if (okN) toast.success(`${vars.action.replace("_", " ")}: ${okN} user${okN === 1 ? "" : "s"} updated`);
      if (failN) toast.error(`${failN} failed${res.failed[0]?.error ? `: ${res.failed[0].error}` : ""}`);
      if (res.passwords?.length) setPasswords(res.passwords);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Bulk action failed"),
    onSettled: () => setConfirm(null),
  });

  const runAction = (action: BulkAction, role?: string) => {
    if (selected.size === 0) return;
    const label =
      action === "add_role" ? `Add "${role}" role to`
      : action === "remove_role" ? `Remove "${role}" role from`
      : action === "verify" ? "Verify"
      : action === "unverify" ? "Unverify"
      : action === "ban" ? "Ban"
      : action === "unban" ? "Unban"
      : action === "reset_password" ? "Reset password for"
      : "Delete";
    setConfirm({ action, role, label });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Admin</p>
        <h1 className="font-display text-3xl uppercase tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and search every account on the platform.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username, name, or email"
            className="pl-9 pr-9"
          />
          {isFetching ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <Select value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="moderator">Moderator</SelectItem>
            <SelectItem value="trainer">Trainer</SelectItem>
            <SelectItem value="trainee">Trainee</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">All statuses</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
            <SelectItem value="real">Real users</SelectItem>
            <SelectItem value="demo">Demo</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => { setQuery(""); setRole("any"); setStatus("any"); }}
          >
            Reset
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground">{filtered.length}</span>
          {data && data.length !== filtered.length ? ` of ${data.length}` : ""} user{filtered.length === 1 ? "" : "s"}
        </span>
        {selected.size > 0 && (
          <span>
            <span className="font-medium text-foreground">{selected.size}</span> selected
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-2 underline hover:text-foreground"
            >
              clear
            </button>
          </span>
        )}
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 shadow-sm">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  Roles <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Add role</DropdownMenuLabel>
                {(["admin", "moderator", "trainer", "trainee"] as const).map((r) => (
                  <DropdownMenuItem key={"a" + r} onClick={() => runAction("add_role", r)}>
                    Add {r}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Remove role</DropdownMenuLabel>
                {(["admin", "moderator", "trainer", "trainee"] as const).map((r) => (
                  <DropdownMenuItem key={"r" + r} onClick={() => runAction("remove_role", r)}>
                    Remove {r}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="outline" onClick={() => runAction("verify")}>Verify</Button>
            <Button size="sm" variant="outline" onClick={() => runAction("unverify")}>Unverify</Button>
            <Button size="sm" variant="outline" onClick={() => runAction("ban")}>Ban</Button>
            <Button size="sm" variant="outline" onClick={() => runAction("unban")}>Unban</Button>
            <Button size="sm" variant="outline" onClick={() => runAction("reset_password")}>Reset password</Button>
            <Button size="sm" variant="destructive" onClick={() => runAction("delete")}>Delete</Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-4 border-b border-border px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Checkbox
            checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
            onCheckedChange={(v) => toggleAllVisible(!!v)}
            aria-label="Select all visible"
          />
          <span>User</span>
          <span>Email</span>
          <span>Roles</span>
          <span className="text-right">Actions</span>
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {isFetching && !data ? "Loading users..." : "No users match your filters."}
          </p>
        ) : (
          filtered.map((u) => (
            <div
              key={u.user_id}
              className={`grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-4 border-b border-border/60 px-4 py-3 text-sm last:border-0 ${selected.has(u.user_id) ? "bg-primary/5" : ""}`}
            >
              <Checkbox
                checked={selected.has(u.user_id)}
                onCheckedChange={(v) => toggleOne(u.user_id, !!v)}
                aria-label={`Select ${u.username ?? u.user_id}`}
              />
              <div className="flex items-center gap-3">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted" />
                )}
                <div>
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{u.display_name ?? u.username ?? "Unnamed"}</span>
                    {u.is_verified && <VerifiedBadge size="sm" />}
                  </p>
                  {u.username && (
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  )}
                </div>
                {u.is_demo && <Badge variant="outline">demo</Badge>}
                {u.banned && <Badge variant="destructive">banned</Badge>}
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(u)}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          ))
        )}
      </div>

      <EditUserDialog
        user={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && !bulkMutation.isPending && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.label} {selected.size} user{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "delete"
                ? "This permanently deletes the selected accounts. This cannot be undone."
                : confirm?.action === "reset_password"
                ? "New random passwords will be set. You'll get a list to share with the users — they won't be emailed."
                : "This action will be applied to every selected user."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!confirm) return;
                bulkMutation.mutate({ action: confirm.action, role: confirm.role });
              }}
            >
              {bulkMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!passwords} onOpenChange={(o) => !o && setPasswords(undefined)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Temporary passwords</DialogTitle>
            <DialogDescription>
              Copy and share these securely. They won't be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {passwords?.map((p) => (
              <div key={p.userId} className="flex items-center gap-2 rounded border border-border bg-muted/40 px-2 py-1.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted-foreground">{p.email ?? p.userId}</p>
                  <p className="truncate font-mono">{p.password}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(p.password);
                    toast.success("Copied");
                  }}
                  aria-label="Copy password"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                const text = passwords?.map((p) => `${p.email ?? p.userId}\t${p.password}`).join("\n") ?? "";
                navigator.clipboard.writeText(text);
                toast.success("All copied");
              }}
            >
              Copy all
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}