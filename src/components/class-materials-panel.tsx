import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Link as LinkIcon, PlayCircle, ClipboardList, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";

type Material = {
  id: string;
  kind: "syllabus" | "resource" | "video" | "reading" | "link";
  title: string;
  description: string | null;
  url: string | null;
  content: string | null;
  sort_order: number;
};

type Assignment = {
  id: string;
  title: string;
  instructions: string | null;
  due_at: string | null;
  points: number;
  sort_order: number;
};

type Submission = {
  id: string;
  assignment_id: string;
  status: "submitted" | "completed" | "graded";
};

const kindIcon = {
  syllabus: BookOpen,
  resource: FileText,
  video: PlayCircle,
  reading: FileText,
  link: LinkIcon,
} as const;

export function ClassMaterialsPanel({ classId, isEnrolled, userId }: { classId: string; isEnrolled: boolean; userId: string | null }) {
  const qc = useQueryClient();

  const materials = useQuery({
    queryKey: ["class-materials", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_materials")
        .select("id, kind, title, description, url, content, sort_order")
        .eq("class_id", classId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Material[];
    },
    enabled: isEnrolled,
  });

  const assignments = useQuery({
    queryKey: ["class-assignments", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_assignments")
        .select("id, title, instructions, due_at, points, sort_order")
        .eq("class_id", classId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Assignment[];
    },
    enabled: isEnrolled,
  });

  const submissions = useQuery({
    queryKey: ["class-submissions", classId, userId],
    queryFn: async () => {
      if (!userId || !assignments.data?.length) return [];
      const ids = assignments.data.map((a) => a.id);
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("id, assignment_id, status")
        .in("assignment_id", ids)
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as Submission[];
    },
    enabled: isEnrolled && !!userId && !!assignments.data?.length,
  });

  const toggle = useMutation({
    mutationFn: async (assignmentId: string) => {
      if (!userId) throw new Error("Not signed in");
      const existing = submissions.data?.find((s) => s.assignment_id === assignmentId);
      if (existing) {
        const { error } = await supabase.from("assignment_submissions").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("assignment_submissions")
          .insert({ assignment_id: assignmentId, user_id: userId, status: "completed" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-submissions", classId, userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isEnrolled) {
    return (
      <div className="mt-10 rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center">
        <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
        <h3 className="mt-3 text-base font-semibold text-foreground">Syllabus, materials & assignments</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Book this class to unlock the syllabus, resource links, and assignments.
        </p>
      </div>
    );
  }

  const items = materials.data ?? [];
  const asgn = assignments.data ?? [];
  const done = new Set((submissions.data ?? []).map((s) => s.assignment_id));

  return (
    <div className="mt-10 space-y-8 border-t border-border pt-8">
      <section>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-sport" />
          <h2 className="text-lg font-semibold text-card-foreground">Syllabus & materials</h2>
          <Badge variant="secondary" className="ml-1">Enrolled</Badge>
        </div>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No materials posted yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((m) => {
              const Icon = kindIcon[m.kind] ?? FileText;
              return (
                <li key={m.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sport" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-foreground">{m.title}</h3>
                        <Badge variant="outline" className="capitalize text-xs">{m.kind}</Badge>
                      </div>
                      {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                      {m.content && (
                        <pre className="mt-2 whitespace-pre-wrap rounded bg-muted p-3 text-xs text-muted-foreground">{m.content}</pre>
                      )}
                      {m.url && (
                        <a
                          href={m.url}
                          target={m.url.startsWith("http") ? "_blank" : undefined}
                          rel="noreferrer noopener"
                          className="mt-2 inline-flex items-center gap-1 text-sm text-sport hover:underline"
                        >
                          Open link <LinkIcon className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-sport" />
          <h2 className="text-lg font-semibold text-card-foreground">Assignments</h2>
        </div>
        {asgn.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {asgn.map((a) => {
              const isDone = done.has(a.id);
              return (
                <li key={a.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-foreground">{a.title}</h3>
                        <Badge variant="outline" className="text-xs">{a.points} pts</Badge>
                        {isDone && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
                          </Badge>
                        )}
                      </div>
                      {a.instructions && <p className="mt-1 text-sm text-muted-foreground">{a.instructions}</p>}
                      {a.due_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Due {new Date(a.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isDone ? "outline" : "default"}
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate(a.id)}
                    >
                      {isDone ? "Mark incomplete" : "Mark complete"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}