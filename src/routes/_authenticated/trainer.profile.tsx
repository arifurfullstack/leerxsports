import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  ExternalLink,
  X,
  Plus,
  User as UserIcon,
  Image as ImageIcon,
  Sparkles,
  DollarSign,
  Globe,
  Tag,
  ShieldCheck,
  CheckCircle2,
  Lock,
  MessageSquare,
  Save,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LazyImage } from "@/components/ui/lazy-image";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getMyTrainerProfile,
  updateMyTrainerProfile,
} from "@/lib/trainer-profile-edit.functions";

export const Route = createFileRoute("/_authenticated/trainer/profile")({
  head: () => ({
    meta: [
      { title: "Creator Profile Setup — LEER Sports" },
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

const PRESET_SPECIALTIES = [
  "Strength & Conditioning",
  "Bodybuilding",
  "Boxing & Combat",
  "Fat Loss",
  "Mobility & Recovery",
  "HIIT & Cardio",
  "Sports Nutrition",
  "Calisthenics",
  "Hypertrophy",
  "Rehab & Injury",
];

function TrainerProfileEdit() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyTrainerProfile);
  const saveFn = useServerFn(updateMyTrainerProfile);

  const q = useQuery({
    queryKey: ["my-trainer-profile"],
    queryFn: () => getFn(),
  });

  const [form, setForm] = useState<FormState>(empty);
  const [initialForm, setInitialForm] = useState<FormState>(empty);
  const [specInput, setSpecInput] = useState("");
  const [activeTab, setActiveTab] = useState("identity");

  useEffect(() => {
    if (!q.data) return;
    const loaded: FormState = {
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
    };
    setForm(loaded);
    setInitialForm(loaded);
  }, [q.data]);

  const mut = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: () => {
      toast.success("Creator profile saved successfully! ✨");
      setInitialForm(form);
      qc.invalidateQueries({ queryKey: ["my-trainer-profile"] });
      qc.invalidateQueries({ queryKey: ["trainer", form.username] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (q.data && !q.data.is_trainer) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
          <Sparkles className="h-8 w-8" />
        </div>
        <h1 className="font-display text-3xl uppercase tracking-tight text-foreground sm:text-4xl">
          Creator Accounts Only
        </h1>
        <p className="mt-2 text-muted-foreground">
          Apply to become a LEER creator to unlock your Creator Studio and profile customization.
        </p>
        <Button asChild className="mt-6 font-bold bg-primary text-primary-foreground">
          <Link to="/onboarding" search={{ resume: false, source: "trainer_profile_gate" }}>
            Apply to Become a Creator
          </Link>
        </Button>
      </div>
    );
  }

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const addSpecialty = (vOverride?: string) => {
    const v = (vOverride ?? specInput).trim();
    if (!v) return;
    if (form.specialties.includes(v)) {
      setSpecInput("");
      return;
    }
    if (form.specialties.length >= 12) {
      toast.error("You can add up to 12 specialties");
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

  const resetForm = () => {
    setForm(initialForm);
    toast.info("Reverted changes");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-500">
            <Sparkles className="h-3.5 w-3.5" /> Creator Studio Setup
          </div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-foreground sm:text-4xl">
            Creator Profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure your brand, media, coaching tagline, and fan unlock pricing.
          </p>
        </div>

        {form.username && (
          <Button asChild variant="outline" size="sm" className="gap-1.5 font-semibold">
            <Link
              to="/trainers/$username"
              params={{ username: form.username }}
              target="_blank"
            >
              View Public Page <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </header>

      {/* Live Brand Header Card */}
      <Card className="mb-8 overflow-hidden border-border/70 bg-card/70 backdrop-blur-xl shadow-xl">
        <div
          className="relative h-44 w-full bg-gradient-to-br from-primary/30 via-accent/20 to-background sm:h-52"
          style={
            form.cover_url
              ? {
                  backgroundImage: `url(${form.cover_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
          <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            Live Fan View Preview
          </div>
        </div>

        <div className="-mt-14 flex flex-col items-start gap-4 px-6 pb-6 sm:-mt-16 sm:flex-row sm:items-end sm:gap-6">
          <div className="relative shrink-0">
            <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-background bg-muted shadow-2xl sm:h-32 sm:w-32">
              {form.avatar_url ? (
                <LazyImage
                  src={form.avatar_url}
                  alt="Avatar preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-accent/30 font-display text-3xl uppercase text-foreground font-bold">
                  {(form.display_name || form.username || "?")[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
                {form.display_name || "Your Name"}
              </h2>
              {q.data?.is_verified && (
                <span title="Verified Creator" className="inline-flex items-center text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              @{form.username || "username"}
            </p>
            {form.value_proposition && (
              <p className="mt-1 text-xs font-medium text-foreground/90 italic">
                "{form.value_proposition}"
              </p>
            )}
          </div>
        </div>
      </Card>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-muted/60 p-1">
            <TabsTrigger value="identity" className="gap-2 font-semibold text-xs sm:text-sm">
              <UserIcon className="h-4 w-4" /> Identity &amp; Bio
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-2 font-semibold text-xs sm:text-sm">
              <ImageIcon className="h-4 w-4" /> Branding &amp; Media
            </TabsTrigger>
            <TabsTrigger value="monetization" className="gap-2 font-semibold text-xs sm:text-sm">
              <Sparkles className="h-4 w-4 text-amber-500" /> Monetization &amp; Tags
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Identity & Bio */}
          <TabsContent value="identity" className="space-y-6">
            <Card className="space-y-5 p-6 border-hairline">
              <div className="flex items-center gap-2 border-b border-hairline pb-3">
                <UserIcon className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold uppercase tracking-wider text-foreground">
                  Basic Information
                </h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="display_name" className="text-xs font-semibold">
                    Display Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="display_name"
                    value={form.display_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, display_name: e.target.value }))
                    }
                    maxLength={80}
                    placeholder="e.g. Alex Morgan"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="username" className="text-xs font-semibold">
                    Username Handle <span className="text-destructive">*</span>
                  </Label>
                  <div className="mt-1 flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                    <span className="pl-3 text-sm text-muted-foreground">@</span>
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
                      placeholder="alex_morgan"
                      required
                      className="border-0 focus-visible:ring-0"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="country" className="text-xs font-semibold">
                    Country
                  </Label>
                  <div className="mt-1 relative">
                    <Input
                      id="country"
                      value={form.country}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, country: e.target.value }))
                      }
                      maxLength={80}
                      placeholder="e.g. United States"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="value_proposition" className="text-xs font-semibold">
                    Coaching Tagline / Value Proposition <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="value_proposition"
                    value={form.value_proposition}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, value_proposition: e.target.value }))
                    }
                    maxLength={160}
                    placeholder="e.g. High-performance strength & mobility coaching."
                    required
                    className="mt-1"
                  />
                  <p className="mt-1 text-right text-[10px] text-muted-foreground">
                    {form.value_proposition.length}/160
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="bio" className="text-xs font-semibold">
                  Full Bio / Background
                </Label>
                <Textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  maxLength={2000}
                  rows={5}
                  placeholder="Tell fans about your experience, training philosophy, achievements, and programs..."
                  className="mt-1"
                />
                <p className="mt-1 text-right text-[10px] text-muted-foreground">
                  {form.bio.length}/2000
                </p>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 2: Branding & Media */}
          <TabsContent value="branding" className="space-y-6">
            <Card className="space-y-5 p-6 border-hairline">
              <div className="flex items-center gap-2 border-b border-hairline pb-3">
                <ImageIcon className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold uppercase tracking-wider text-foreground">
                  Avatar &amp; Banner Graphics
                </h3>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="avatar_url" className="text-xs font-semibold">
                    Avatar Image URL
                  </Label>
                  <Input
                    id="avatar_url"
                    value={form.avatar_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, avatar_url: e.target.value }))
                    }
                    type="url"
                    placeholder="https://images.unsplash.com/…"
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Direct link to a square profile picture (JPG, PNG, WEBP).
                  </p>
                </div>

                <div>
                  <Label htmlFor="cover_url" className="text-xs font-semibold">
                    Cover Banner Image URL
                  </Label>
                  <Input
                    id="cover_url"
                    value={form.cover_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cover_url: e.target.value }))
                    }
                    type="url"
                    placeholder="https://images.unsplash.com/…"
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    High-resolution horizontal banner image for your creator profile top.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 3: Monetization & Specialties */}
          <TabsContent value="monetization" className="space-y-6">
            {/* Specialties Card */}
            <Card className="space-y-5 p-6 border-hairline">
              <div className="flex items-center gap-2 border-b border-hairline pb-3">
                <Tag className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold uppercase tracking-wider text-foreground">
                  Coaching Specialties ({form.specialties.length}/12)
                </h3>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-semibold">Current Selected Specialties</Label>
                <div className="flex flex-wrap gap-2 min-h-[44px] items-center rounded-xl border border-hairline bg-muted/30 p-3">
                  {form.specialties.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                    >
                      {s}
                      <button
                        type="button"
                        aria-label={`Remove ${s}`}
                        onClick={() => removeSpecialty(s)}
                        className="text-primary/70 hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  {form.specialties.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      No specialties selected yet. Type a custom tag below or click any preset chip.
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
                    placeholder="Type a custom specialty (e.g. Kettlebells)"
                    maxLength={40}
                  />
                  <Button type="button" variant="outline" onClick={() => addSpecialty()}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </div>

              {/* One-Click Presets */}
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Popular Suggested Presets
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_SPECIALTIES.map((preset) => {
                    const selected = form.specialties.includes(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => (selected ? removeSpecialty(preset) : addSpecialty(preset))}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border/60 bg-card hover:border-primary/60 hover:text-primary"
                        }`}
                      >
                        {selected ? <CheckCircle2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Monetization & Pricing Card */}
            <Card className="space-y-6 p-6 border-amber-500/30 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white backdrop-blur-xl shadow-xl">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                    Monetization &amp; Unlock Settings
                  </h3>
                </div>
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400">
                  Creator Earnings
                </Badge>
              </div>

              <div className="grid gap-4">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <div>
                    <Label htmlFor="monetization_enabled" className="text-sm font-semibold text-white">
                      Accept Subscribers &amp; Enable Unlock
                    </Label>
                    <p className="text-xs text-neutral-400">
                      When enabled, fans can pay your monthly fee to unlock your profile &amp; exclusive posts.
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

                <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <div>
                    <Label htmlFor="dms_enabled" className="text-sm font-semibold text-white">
                      Direct Messaging Access for Subscribers
                    </Label>
                    <p className="text-xs text-neutral-400">
                      Active subscribers can send direct messages and coaching inquiries to your inbox.
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
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="subscription_price" className="text-xs font-semibold text-white">
                    Monthly Fan Unlock Fee (USD)
                  </Label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">
                      $
                    </span>
                    <Input
                      id="subscription_price"
                      type="number"
                      min={4.99}
                      max={499.99}
                      step="0.01"
                      className="pl-8 border-neutral-800 bg-neutral-900 text-white focus-visible:ring-amber-500 font-bold text-base"
                      value={form.subscription_price}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          subscription_price: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-neutral-400">
                    Set your monthly subscriber fee between $4.99 and $499.99 / month.
                  </p>
                </div>

                {/* Live Button Preview Card */}
                <div className="flex flex-col justify-between rounded-xl border border-neutral-800 bg-neutral-900/90 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    Fan Button Live Preview
                  </div>
                  <div className="mt-3 flex items-center justify-start">
                    <div className="inline-flex items-center rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-lg">
                      <Lock className="mr-2 h-4 w-4" />
                      Unlock · ${form.subscription_price.toFixed(2)}/mo
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Floating / Sticky Save Action Bar */}
        <div className="fixed bottom-4 inset-x-4 z-40 max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/95 p-3.5 shadow-2xl backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 ring-1 ring-black/5">
            <div className="flex items-center gap-2">
              {isDirty ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> Unsaved changes
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Saved
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  disabled={mut.isPending}
                  className="gap-1 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Revert
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={mut.isPending}
                className="gap-1.5 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
              >
                {mut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Profile Changes
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}