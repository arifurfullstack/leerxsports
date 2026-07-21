import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search as SearchIcon, BadgeCheck, MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  searchTrainers,
  searchPosts,
  searchCommunity,
  type TrainerHit,
  type PostHit,
  type CommunityHit,
} from "@/lib/search-functions";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — LEER Sports" },
      { name: "description", content: "Find trainers, posts, and community threads on LEER Sports." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<"popularity" | "newest" | "price_asc" | "price_desc">("popularity");
  const [tab, setTab] = useState<"trainers" | "posts" | "community">("trainers");

  const trainerFn = useServerFn(searchTrainers);
  const postFn = useServerFn(searchPosts);
  const commFn = useServerFn(searchCommunity);

  const trainerMut = useMutation<TrainerHit[], Error>({
    mutationFn: async () =>
      trainerFn({
        data: {
          q: q || undefined,
          country: country || undefined,
          language: language || undefined,
          specialty: specialty || undefined,
          verifiedOnly,
          sort,
          limit: 24,
        },
      }),
  });
  const postMut = useMutation<PostHit[], Error>({
    mutationFn: async () => postFn({ data: { q, limit: 24 } }),
  });
  const commMut = useMutation<CommunityHit[], Error>({
    mutationFn: async () => commFn({ data: { q, limit: 24 } }),
  });

  const runAll = () => {
    trainerMut.mutate();
    if (q.trim().length > 0) {
      postMut.mutate();
      commMut.mutate();
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl">Search</h1>
      <p className="text-sm text-muted-foreground">Trainers, posts, and community threads.</p>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          runAll();
        }}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search names, bios, specialties, captions..."
              className="pl-9"
            />
          </div>
          <Button type="submit">Search</Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" />
          <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Language" />
          <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Specialty" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
            Verified only
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="popularity">Popular</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
        </div>
      </form>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-8">
        <TabsList>
          <TabsTrigger value="trainers">Trainers</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
        </TabsList>

        <TabsContent value="trainers" className="mt-6">
          {trainerMut.isPending && <Spinner />}
          {trainerMut.data && trainerMut.data.length === 0 && <Empty label="No trainers match." />}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(trainerMut.data ?? []).map((t) => (
              <li key={t.user_id} className="rounded-lg border border-border bg-card p-4">
                <Link to="/trainers/$username" params={{ username: t.username ?? "" }} className="flex items-start gap-3">
                  {t.avatar_url ? (
                    <img src={t.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{t.display_name ?? t.username}</span>
                      {t.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
                    </div>
                    {t.country && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {t.country}
                      </div>
                    )}
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.bio}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.specialties.slice(0, 3).map((s) => (
                        <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{s}</span>
                      ))}
                    </div>
                    <div className="mt-2 text-xs font-semibold">${t.subscription_price.toFixed(2)}/mo</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="posts" className="mt-6">
          {postMut.isPending && <Spinner />}
          {postMut.data && postMut.data.length === 0 && <Empty label="No matching posts." />}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {(postMut.data ?? []).map((p) => (
              <li key={p.id} className="overflow-hidden rounded-lg border border-border bg-card">
                <img src={p.thumbnail_url ?? p.media_url} alt={p.caption ?? ""} className="aspect-square w-full object-cover" loading="lazy" decoding="async" />
                {p.caption && <div className="line-clamp-2 p-2 text-xs">{p.caption}</div>}
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="community" className="mt-6">
          {commMut.isPending && <Spinner />}
          {commMut.data && commMut.data.length === 0 && <Empty label="No matching threads." />}
          <ul className="space-y-2">
            {(commMut.data ?? []).map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-card p-3">
                <div className="font-medium">{c.title}</div>
                <div className="line-clamp-2 text-sm text-muted-foreground">{c.body}</div>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{label}</div>;
}