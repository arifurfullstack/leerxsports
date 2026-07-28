import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EyeOff, GripVertical, Plus, RotateCcw, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type WidgetDef = {
  id: string;
  label: string;
  render: () => ReactNode;
  defaultHidden?: boolean;
};

type Layout = { order: string[]; hidden: string[] };

const storageKey = (scope: string) => `leer:dashboard:layout:${scope}`;

function loadLayout(scope: string): Layout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Layout;
    if (!Array.isArray(parsed.order) || !Array.isArray(parsed.hidden)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function defaultLayout(widgets: WidgetDef[]): Layout {
  return {
    order: widgets.map((w) => w.id),
    hidden: widgets.filter((w) => w.defaultHidden).map((w) => w.id),
  };
}

function reconcile(saved: Layout, widgets: WidgetDef[]): Layout {
  const ids = new Set(widgets.map((w) => w.id));
  const order = saved.order.filter((id) => ids.has(id));
  for (const w of widgets) if (!order.includes(w.id)) order.push(w.id);
  const hidden = saved.hidden.filter((id) => ids.has(id));
  return { order, hidden };
}

export function DashboardWidgets({
  scope,
  widgets,
}: {
  scope: string;
  widgets: WidgetDef[];
}) {
  const initial = useMemo(() => defaultLayout(widgets), [widgets]);
  const [layout, setLayout] = useState<Layout>(initial);
  const [editing, setEditing] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const saved = loadLayout(scope);
    setLayout(saved ? reconcile(saved, widgets) : defaultLayout(widgets));
  }, [scope, widgets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey(scope), JSON.stringify(layout));
  }, [scope, layout]);

  const hiddenSet = new Set(layout.hidden);
  const visibleIds = layout.order.filter((id) => !hiddenSet.has(id));
  const widgetMap = new Map(widgets.map((w) => [w.id, w] as const));
  const hiddenWidgets = layout.hidden
    .map((id) => widgetMap.get(id))
    .filter((w): w is WidgetDef => Boolean(w));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLayout((prev) => {
      const oldIndex = prev.order.indexOf(String(active.id));
      const newIndex = prev.order.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      return { ...prev, order: arrayMove(prev.order, oldIndex, newIndex) };
    });
  };

  const hide = (id: string) =>
    setLayout((p) => (p.hidden.includes(id) ? p : { ...p, hidden: [...p.hidden, id] }));
  const show = (id: string) =>
    setLayout((p) => ({ ...p, hidden: p.hidden.filter((x) => x !== id) }));
  const reset = () => setLayout(defaultLayout(widgets));

  return (
    <div className="space-y-3 sm:space-y-4">
      <WidgetToolbar
        editing={editing}
        onToggleEdit={() => setEditing((v) => !v)}
        onReset={reset}
        hiddenWidgets={hiddenWidgets}
        onShow={show}
        allWidgets={widgets}
        hiddenSet={hiddenSet}
        onToggle={(id) => (hiddenSet.has(id) ? show(id) : hide(id))}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-4 sm:space-y-6">
            {visibleIds.map((id) => {
              const w = widgetMap.get(id);
              if (!w) return null;
              return (
                <SortableWidget key={id} id={id} label={w.label} editing={editing} onHide={() => hide(id)}>
                  {w.render()}
                </SortableWidget>
              );
            })}
            {visibleIds.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">
                All widgets are hidden. Use <span className="text-foreground">Customize</span> to add them back.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function WidgetToolbar({
  editing,
  onToggleEdit,
  onReset,
  hiddenWidgets,
  onShow,
  allWidgets,
  hiddenSet,
  onToggle,
}: {
  editing: boolean;
  onToggleEdit: () => void;
  onReset: () => void;
  hiddenWidgets: WidgetDef[];
  onShow: (id: string) => void;
  allWidgets: WidgetDef[];
  hiddenSet: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Layout
        </span>
        {editing && (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
            Editing
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {editing && hiddenWidgets.length > 0 && (
          <div className="hidden flex-wrap items-center gap-1 md:flex">
            {hiddenWidgets.map((w) => (
              <button
                key={w.id}
                onClick={() => onShow(w.id)}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Plus className="h-3 w-3" /> {w.label}
              </button>
            ))}
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" /> Widgets
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Show / hide sections</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allWidgets.map((w) => {
              const hidden = hiddenSet.has(w.id);
              return (
                <DropdownMenuItem
                  key={w.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    onToggle(w.id);
                  }}
                  className="flex items-center justify-between"
                >
                  <span className={hidden ? "text-muted-foreground" : ""}>{w.label}</span>
                  {hidden ? (
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onReset(); }}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset to default
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant={editing ? "default" : "outline"}
          size="sm"
          onClick={onToggleEdit}
          className="gap-1.5"
        >
          {editing ? (
            <>
              <X className="h-3.5 w-3.5" /> Done
            </>
          ) : (
            <>
              <GripVertical className="h-3.5 w-3.5" /> Customize
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function SortableWidget({
  id,
  label,
  editing,
  onHide,
  children,
}: {
  id: string;
  label: string;
  editing: boolean;
  onHide: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? "z-10 opacity-80" : ""}`}
    >
      {editing && (
        <div className="pointer-events-none absolute -top-3 left-3 right-3 z-10 flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-primary/40 bg-background/90 px-2 py-1 shadow-sm backdrop-blur">
            <button
              className="flex cursor-grab items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground active:cursor-grabbing"
              {...attributes}
              {...listeners}
              aria-label={`Drag ${label}`}
            >
              <GripVertical className="h-3 w-3" /> {label}
            </button>
          </div>
          <button
            onClick={onHide}
            className="pointer-events-auto rounded-full border border-border bg-background/90 p-1 text-muted-foreground shadow-sm backdrop-blur hover:text-destructive"
            aria-label={`Hide ${label}`}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div
        className={
          editing
            ? "rounded-2xl ring-2 ring-dashed ring-primary/30 ring-offset-2 ring-offset-background transition-shadow"
            : ""
        }
      >
        {children}
      </div>
    </div>
  );
}