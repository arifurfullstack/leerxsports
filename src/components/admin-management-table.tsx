import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminListRows,
  adminDeleteRow,
  adminUpdateRow,
} from "@/lib/admin-management-functions";

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
};

export type RowAction<T> = {
  label: string;
  onRun: (row: T) => Promise<void> | void;
  variant?: "default" | "outline" | "destructive" | "ghost";
  hidden?: (row: T) => boolean;
};

export type FilterOption = {
  /** Column name in the DB to eq-filter on. */
  column: string;
  /** Label shown above the select. */
  label: string;
  /** Options; value "" means "All". */
  options: { label: string; value: string }[];
};

export function AdminManagementTable<T extends { id: string; is_demo?: boolean | null }>({
  title,
  subtitle,
  table,
  select,
  orderBy = "created_at",
  searchColumn,
  columns,
  extraActions,
  allowDelete = true,
  hideToggleColumn,
  filters,
}: {
  title: string;
  subtitle?: string;
  table: string;
  select?: string;
  orderBy?: string;
  searchColumn?: string;
  columns: Column<T>[];
  extraActions?: RowAction<T>[];
  allowDelete?: boolean;
  /** Column that toggles hidden/status; e.g. "is_hidden" or "status". */
  hideToggleColumn?: { column: string; on: unknown; off: unknown; label?: string };
  /** Optional dropdown filters mapped to eq() on a column. */
  filters?: FilterOption[];
}) {
  const listFn = useServerFn(adminListRows);
  const updateFn = useServerFn(adminUpdateRow);
  const deleteFn = useServerFn(adminDeleteRow);
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [sortBy, setSortBy] = useState<string>(orderBy);
  const [ascending, setAscending] = useState<boolean>(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const activeFilter = (() => {
    const entry = Object.entries(filterValues).find(([, v]) => v && v !== "");
    return entry ? { column: entry[0], value: entry[1] } : null;
  })();
  const { data, isFetching, refetch } = useQuery<T[]>({
    queryKey: ["admin", "manage", table, submitted, sortBy, ascending, filterValues],
    queryFn: () =>
      listFn({
        data: {
          table,
          select,
          orderBy: sortBy,
          ascending,
          limit: 100,
          search:
            searchColumn && submitted ? { column: searchColumn, value: submitted } : null,
          filter: activeFilter,
        },
      }) as Promise<T[]>,
  });

  async function handleDelete(row: T) {
    if (!confirm("Delete this row? This cannot be undone.")) return;
    try {
      await deleteFn({ data: { table, id: row.id } });
      toast.success("Deleted");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleToggle(row: T) {
    if (!hideToggleColumn) return;
    const cur = (row as any)[hideToggleColumn.column];
    const next =
      cur === hideToggleColumn.on ? hideToggleColumn.off : hideToggleColumn.on;
    try {
      await updateFn({
        data: { table, id: row.id, patch: { [hideToggleColumn.column]: next } },
      });
      toast.success("Updated");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const rows = data ?? [];

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Admin
        </p>
        <h1 className="font-display text-3xl uppercase tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </header>

      <div className="flex flex-wrap items-end gap-3">
        {searchColumn && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(q);
            }}
            className="flex min-w-[260px] flex-1 gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search by ${searchColumn}`}
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
            {submitted && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setQ("");
                  setSubmitted("");
                }}
              >
                Clear
              </Button>
            )}
          </form>
        )}

        {filters?.map((f) => (
          <div key={f.column} className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              {f.label}
            </label>
            <Select
              value={filterValues[f.column] ?? "__all__"}
              onValueChange={(v) =>
                setFilterValues((prev) => {
                  // only one eq filter supported at a time; clear others
                  const next: Record<string, string> = {};
                  if (v && v !== "__all__") next[f.column] = v;
                  return next;
                })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">
            Sort by
          </label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {columns
                .filter((c) => c.sortable !== false)
                .map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              {!columns.some((c) => c.key === "created_at") && (
                <SelectItem value="created_at">Created</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          onClick={() => setAscending((a) => !a)}
          aria-label="Toggle sort direction"
          className="gap-2"
        >
          {ascending ? (
            <>
              <ArrowUp className="h-4 w-4" /> Asc
            </>
          ) : (
            <>
              <ArrowDown className="h-4 w-4" /> Desc
            </>
          )}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-4 border-b border-border px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground" style={{ gridTemplateColumns: `${columns.map(() => "1fr").join(" ")} auto` }}>
          {columns.map((c) => (
            <button
              key={c.key}
              type="button"
              disabled={c.sortable === false}
              onClick={() => {
                if (c.sortable === false) return;
                if (sortBy === c.key) setAscending((a) => !a);
                else {
                  setSortBy(c.key);
                  setAscending(false);
                }
              }}
              className={
                "flex items-center gap-1 text-left uppercase tracking-widest " +
                (c.sortable === false ? "cursor-default" : "hover:text-foreground") +
                " " +
                (c.className ?? "")
              }
            >
              {c.label}
              {c.sortable !== false &&
                (sortBy === c.key ? (
                  ascending ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                ))}
            </button>
          ))}
          <span className="text-right">Actions</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {isFetching ? "Loading…" : "No rows found."}
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid items-center gap-4 border-b border-border/60 px-4 py-3 text-sm last:border-0"
              style={{ gridTemplateColumns: `${columns.map(() => "1fr").join(" ")} auto` }}
            >
              {columns.map((c) => (
                <div key={c.key} className={"truncate " + (c.className ?? "")}>
                  {c.render ? c.render(row) : String((row as any)[c.key] ?? "—")}
                  {c.key === columns[0].key && row.is_demo && (
                    <Badge variant="outline" className="ml-2">demo</Badge>
                  )}
                </div>
              ))}
              <div className="flex justify-end gap-2">
                {hideToggleColumn && (
                  <Button size="sm" variant="outline" onClick={() => handleToggle(row)}>
                    {(row as any)[hideToggleColumn.column] === hideToggleColumn.on
                      ? (hideToggleColumn.label ?? "Unhide")
                      : (hideToggleColumn.label ?? "Hide")}
                  </Button>
                )}
                {extraActions?.map(
                  (a) =>
                    !(a.hidden?.(row)) && (
                      <Button
                        key={a.label}
                        size="sm"
                        variant={a.variant ?? "outline"}
                        onClick={async () => {
                          try {
                            await a.onRun(row);
                            refetch();
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        {a.label}
                      </Button>
                    ),
                )}
                {allowDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(row)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}