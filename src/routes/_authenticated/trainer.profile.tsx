import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ExternalLink, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  getMyTrainerProfile,
  updateMyTrainerProfile,
} from "@/lib/trainer-profile-edit.functions";

export const Route = createFileRoute("/_authenticated/trainer/profile")({
  head: () => ({
    meta: [
      { title: "Edit Trainer Profile — LEER Sports" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrainerProfileEdit,
});

type FormState = {
  display_name: string;
  username: string;
  bio: string;
  country: string;
  avatar_url: string;
  cover_url: string;
  value_proposition: string;
  specialties: string[];
  subscription_price: number;
  monetization_enabled: boolean;
  dms_enabled: boolean;
};

const empty: FormState = {
  display_name: "",
  username: "",
  bio: "",
  country: "",
  avatar_url: "",
  cover_url: "",
  value_proposition: "",
  specialties: [],
  subscription_price: 0,
  monetization_enabled: false,
  dms_enabled: true,
};

function TrainerProfileEdit() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyTrainerProfile);
  const saveFn = useServerFn(updateMyTrainerProfile);

  const q = useQuery({
    queryKey: ["my-trainer-profile"],
    queryFn: () => getFn(),
  });

  const [form, setForm] = useState<FormState>(empty);
  const [specInput, setSpecInput] = useState("");

  useEffect(() => {
    if (!q.data) return;
    setForm({
      display_name: q.data.display_name ?? q.data.full_name ?? "",
      username: q.data.username ?? "",
      bio: q.data.bio ?? "",
      country: q.data.country ?? "",
      avatar_url: q.data.avatar_url ?? "",
      cover_url: q.data.cover_url ?? "",
      value_proposition: q.data.value_proposition ?? "",
      specialties: q.data.specialties ?? [],
      subscription_price: Number(q.data.subscription_price ?? 0),
      monetization_enabled: !!q.data.monetization_enabled,
      dms_enabled: q.data.dms_enabled ?? true,
    });
  }, [q.data]);

  const mut = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["my-trainer-profile"] });
      qc.invalidateQueries({ queryKey: ["trainer", form.username] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (q.data && !q.data.is_trainer) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl uppercase tracking-tight">
          Trainer accounts only
        </h1>
        <p className="mt-2 text-muted-foreground">
          Apply to become a trainer to unlock this page.
        </p>
        <Button asChild className="mt-6">
          <Link to="/settings">Back to settings</Link>
        </Button>
      </div>
    );
  }

  const addSpecialty = () => {
    const v = specInput.trim();
    if (!v) return;
    if (form.specialties.includes(v)) {
      setSpecInput("");
      return;
    }
    if (form.specialties.length >= 12) {
      toast.error("Up to 12 specialties");
      return;
    }
    setForm((f) => ({ ...f, specialties: [...f.specialties, v] }));
    setSpecInput("");
  };

  const removeSpecialty = (s: string) =>
    setForm((f) => ({
      ...f,
      specialties: f.specialties.filter((x) => x !== s),
    }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Trainer Profile
          </h1>
          <p className="text-sm text-muted-foreground">
            Update how you appear across LEER Sports.
          </p>
        </div>
        {form.username && (
          <Button asChild variant="outline" size="sm">
            <Link
              to="/trainers/$username"
              params={{ username: form.username }}
              target="_blank"
            >
              View public page <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        )}
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
        className="space-y-6"
      >
        {/* Media preview */}
        <Card className="overflow-hidden p-0">
          <div
            className="h-40 w-full bg-muted"
            style={{
              backgroundImage: form.cover_url
                ? `url(${form.cover_url})`
                : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="flex items-end gap-4 p-4">
            <div className="-mt-14 h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-background bg-muted">
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt="avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-2xl text-muted-foreground">
                  {(form.display_name || "?")[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-lg uppercase">
                {form.display_name || "Your name"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                @{form.username || "username"}
              </p>
            </div>
          </div>
        </Card>

        {/* Identity */}
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Identity
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                value={form.display_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, display_name: e.target.value }))
                }
                maxLength={80}
                required
              />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  }))
                }
                maxLength={32}
                required
              />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: e.target.value }))
                }
                maxLength={80}
                placeholder="e.g. Portugal"
              />
            </div>
            <div>
              <Label htmlFor="value_proposition">Tagline</Label>
              <Input
                id="value_proposition"
                value={form.value_proposition}
                onChange={(e) =>
                  setForm((f) => ({ ...f, value_proposition: e.target.value }))
                }
                maxLength={160}
                placeholder="One sharp line about your coaching"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              maxLength={2000}
              rows={5}
              placeholder="Background, philosophy, results…"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              {form.bio.length}/2000
            </p>
          </div>
        </Card>

        {/* Media */}
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Media
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="avatar_url">Avatar URL</Label>
              <Input
                id="avatar_url"
                value={form.avatar_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, avatar_url: e.target.value }))
                }
                type="url"
                placeholder="https://…"
              />
            </div>
            <div>
              <Label htmlFor="cover_url">Cover URL</Label>
              <Input
                id="cover_url"
                value={form.cover_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cover_url: e.target.value }))
                }
                type="url"
                placeholder="https://…"
              />
            </div>
          </div>
        </Card>

        {/* Specialties */}
        <Card className="space-y-3 p-5">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Specialties
          </h2>
          <div className="flex flex-wrap gap-2">
            {form.specialties.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs uppercase tracking-wider"
              >
                {s}
                <button
                  type="button"
                  aria-label={`Remove ${s}`}
                  onClick={() => removeSpecialty(s)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {form.specialties.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add up to 12 specialties (e.g. Boxing, Mobility, Nutrition).
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={specInput}
              onChange={(e) => setSpecInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSpecialty();
                }
              }}
              placeholder="Add specialty"
              maxLength={40}
            />
            <Button type="button" variant="outline" onClick={addSpecialty}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        {/* Monetization */}
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Monetization
          </h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="monetization_enabled" className="text-sm">
                Accept subscribers
              </Label>
              <p className="text-xs text-muted-foreground">
                Turn on to show your subscribe button on your profile.
              </p>
            </div>
            <Switch
              id="monetization_enabled"
              checked={form.monetization_enabled}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, monetization_enabled: v }))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="dms_enabled" className="text-sm">
                Allow direct messages
              </Label>
              <p className="text-xs text-muted-foreground">
                Subscribers can DM you when this is on.
              </p>
            </div>
            <Switch
              id="dms_enabled"
              checked={form.dms_enabled}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, dms_enabled: v }))
              }
            />
          </div>
          <div className="max-w-xs">
            <Label htmlFor="subscription_price">Monthly price (USD)</Label>
            <Input
              id="subscription_price"
              type="number"
              min={0}
              max={999}
              step="0.01"
              value={form.subscription_price}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  subscription_price: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {q.data?.is_verified && (
            <span className="text-xs uppercase tracking-widest text-primary">
              Verified trainer
            </span>
          )}
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}