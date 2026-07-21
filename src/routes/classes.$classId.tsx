import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getClassBySlug, getClassBookingCounts } from "@/lib/class-functions";
import { BookingForm } from "@/components/booking-form";
import { ClassMaterialsPanel } from "@/components/class-materials-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Users, ArrowLeft, Calendar } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function classQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["class", slug],
    queryFn: () => getClassBySlug({ data: { slug } }),
  });
}

function countsQueryOptions(classId: string) {
  return queryOptions({
    queryKey: ["class-counts", classId],
    queryFn: () => getClassBookingCounts({ data: { classIds: [classId] } }),
  });
}

export const Route = createFileRoute("/classes/$classId")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(classQueryOptions(params.classId));
    if (!data) throw notFound();
    await context.queryClient.ensureQueryData(countsQueryOptions(data.id));
    return data;
  },
  head: ({ loaderData }) => {
    const classItem = loaderData;
    return {
      meta: [
        { title: classItem ? `${classItem.title} — leersports` : "Class — leersports" },
        { name: "description", content: classItem ? `Book ${classItem.title} with ${classItem.instructor}.` : "Class details" },
        { property: "og:title", content: classItem ? `${classItem.title} — leersports` : "Class — leersports" },
        { property: "og:description", content: classItem ? `Book ${classItem.title} with ${classItem.instructor}.` : "Class details" },
        { property: "og:type", content: "website" },
      ],
    };
  },
  component: ClassDetailPage,
  errorComponent: ClassDetailError,
  notFoundComponent: ClassDetailNotFound,
});

function ClassDetailPage() {
  const params = Route.useParams();
  const { data: classItem } = useSuspenseQuery(classQueryOptions(params.classId));
  const { data: counts } = useSuspenseQuery(countsQueryOptions(classItem!.id));
  const [user, setUser] = useState<User | null>(null);

  useQuery({
    queryKey: ["class-user"],
    queryFn: async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      setUser(u);
      return u;
    },
    staleTime: 1000 * 60,
  });

  const { data: enrollment } = useQuery({
    queryKey: ["class-enrollment", classItem?.id, user?.id],
    queryFn: async () => {
      if (!user || !classItem) return null;
      const { data } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("class_id", classItem.id)
        .eq("user_id", user.id)
        .in("status", ["confirmed", "attended"])
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!classItem,
  });

  if (!classItem) return null;

  const date = new Date(classItem.schedule);
  const bookedCount = counts?.find((c) => c.class_id === classItem.id)?.count ?? 0;
  const spotsLeft = classItem.capacity - bookedCount;
  const isFull = spotsLeft <= 0;

  return (
    <main className="min-h-dvh bg-background py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Link to="/classes" className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to classes
        </Link>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="aspect-video w-full overflow-hidden bg-muted">
            {classItem.image_url ? (
              <img
                src={classItem.image_url}
                alt={classItem.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-muted text-muted-foreground">
                No image
              </div>
            )}
          </div>

          <div className="p-6 sm:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="sport" className="capitalize">
                {classItem.level}
              </Badge>
              {classItem.category && <Badge variant="outline" className="capitalize">{classItem.category}</Badge>}
              {isFull && <Badge variant="destructive">Full</Badge>}
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-card-foreground sm:text-4xl">
              {classItem.title}
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              with {classItem.instructor}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
                <Calendar className="h-5 w-5 text-sport" />
                <div>
                  <p className="text-sm font-medium text-foreground">Date & time</p>
                  <p className="text-sm text-muted-foreground">
                    {date.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
                <Clock className="h-5 w-5 text-sport" />
                <div>
                  <p className="text-sm font-medium text-foreground">Duration</p>
                  <p className="text-sm text-muted-foreground">{classItem.duration_minutes} minutes</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
                <Users className="h-5 w-5 text-sport" />
                <div>
                  <p className="text-sm font-medium text-foreground">Capacity</p>
                  <p className="text-sm text-muted-foreground">
                    {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left of {classItem.capacity}
                  </p>
                </div>
              </div>
              {classItem.location && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
                  <MapPin className="h-5 w-5 text-sport" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Location</p>
                    <p className="text-sm text-muted-foreground">{classItem.location}</p>
                  </div>
                </div>
              )}
            </div>

            {classItem.description && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-card-foreground">About this class</h2>
                <p className="mt-2 whitespace-pre-line text-muted-foreground">{classItem.description}</p>
              </div>
            )}

            <ClassMaterialsPanel
              classId={classItem.id}
              isEnrolled={!!enrollment}
              userId={user?.id ?? null}
            />

            <div className="mt-10 border-t border-border pt-8">
              {user ? (
                <BookingForm classId={classItem.id} isFull={isFull} isBooked={false} />
              ) : (
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    Sign in to book this class.
                  </p>
                  <Link to="/auth" className="mt-3 inline-block">
                    <Button>Sign in</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function ClassDetailError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Could not load class</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}

function ClassDetailNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Class not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The class you are looking for does not exist or has been removed.
        </p>
        <Link to="/classes" className="mt-4 inline-block text-sport hover:underline">
          Browse classes
        </Link>
      </div>
    </div>
  );
}
