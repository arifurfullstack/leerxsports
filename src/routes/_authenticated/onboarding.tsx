import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";
import { Loader2, Dumbbell, ShieldCheck, ArrowRight, CheckCircle2, ClipboardList, Check } from "lucide-react";

import { getOnboardingState, completeTraineeOnboarding, submitTrainerApplication, skipOnboarding, logOnboardingResumed } from "@/lib/onboarding-functions";
import { traineeOnboardingSchema, trainerApplicationSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const FIELD_LABELS: Record<string, string> = {
  username: "Username",
  display_name: "Display name",
  full_legal_name: "Full legal name",
  public_trainer_name: "Public trainer name",
  country: "Country",
  native_language: "Native language",
  additional_languages: "Additional languages",
  specialties: "Specialties",
  years_experience: "Years of experience",
  biography: "Biography",
  certification_details: "Certification details",
  certificates: "Certificate URLs",
  id_doc_url: "Government ID URL",
  social_links: "Social / portfolio links",
  requested_price: "Preferred monthly price",
  payout_info: "Payout info",
  agreement_accepted: "Agreement",
  gender: "Gender",
  height_cm: "Height",
  weight_kg: "Weight",
  body_fat_percent: "Body fat",
  skeletal_muscle_kg: "Skeletal muscle",
  goal: "Fitness goal",
  experience_level: "Experience level",
  injuries: "Injuries",
};

function formatZodError(err: ZodError): { title: string; description: string } {
  const issues = err.issues.slice(0, 4).map((i) => {
    const rawKey = String(i.path[0] ?? "");
    const label = FIELD_LABELS[rawKey] ?? (rawKey || "Field");
    return `${label}: ${i.message}`;
  });
  const more = err.issues.length > issues.length ? ` (+${err.issues.length - issues.length} more)` : "";
  return {
    title: "Please fix the highlighted fields",
    description: issues.join(" • ") + more,
  };
}

function showSubmitError(err: unknown, fallback = "Something went wrong") {
  if (err instanceof ZodError) {
    const { title, description } = formatZodError(err);
    toast.error(title, { description });
    return;
  }
  const msg = err instanceof Error ? err.message : fallback;
  // Server-side Zod errors surface as a JSON string in Error.message — try to parse.
  if (msg.trim().startsWith("[") || msg.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(msg);
      if (Array.isArray(parsed)) {
        const fake = new ZodError(parsed);
        const { title, description } = formatZodError(fake);
        toast.error(title, { description });
        return;
      }
    } catch { /* fall through */ }
  }
  toast.error(msg);
}

const onboardingQuery = queryOptions({
  queryKey: ["onboarding-state"],
  queryFn: () => getOnboardingState(),
});

export const Route = createFileRoute("/_authenticated/onboarding")({
  loader: ({ context }) => context.queryClient.ensureQueryData(onboardingQuery),
  validateSearch: (search: Record<string, unknown>) => ({
    resume: search.resume === "1" || search.resume === true ? true : undefined,
    source: typeof search.source === "string" ? search.source : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Onboarding — LEER Sports" },
      { name: "description", content: "Choose your role and set up your LEER Sports profile." },
    ],
  }),
  component: OnboardingPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Onboarding could not load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button
          className="mt-4"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Retry
        </Button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
    </div>
  ),
});

type Step = "role" | "trainee" | "trainer" | "pending";

type StepKey = "role" | "details" | "done";

function OnboardingStepper({ current, kind }: { current: StepKey; kind: "trainee" | "trainer" | null }) {
  const order: StepKey[] = ["role", "details", "done"];
  const idx = order.indexOf(current);
  const detailsLabel = kind === "trainer" ? "Pro Application" : kind === "trainee" ? "Trainee Profile" : "Details";
  const doneLabel = kind === "trainer" ? "Under Review" : "Complete";
  const items: { key: StepKey; label: string }[] = [
    { key: "role", label: "Choose Role" },
    { key: "details", label: detailsLabel },
    { key: "done", label: doneLabel },
  ];
  const percent = Math.round(((idx + 1) / order.length) * 100);
  return (
    <div className="mb-8">
      <ol className="flex items-center gap-2 sm:gap-4" aria-label="Onboarding progress">
        {items.map((it, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={it.key} className="flex flex-1 items-center gap-2">
              <div
                className={
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition " +
                  (done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground")
                }
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className={"truncate text-xs uppercase tracking-widest " + (active || done ? "text-foreground" : "text-muted-foreground")}>
                  {it.label}
                </p>
              </div>
              {i < items.length - 1 && (
                <div className={"hidden h-px flex-1 sm:block " + (done ? "bg-primary" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-right text-[10px] uppercase tracking-widest text-muted-foreground">
        Step {idx + 1} of {order.length}
      </p>
    </div>
  );
}

function OnboardingPage() {
  const router = useRouter();
  const { data: state } = useSuspenseQuery(onboardingQuery);
  const search = useSearch({ from: "/_authenticated/onboarding" });
  const resume = !!search.resume;
  const profileIncomplete = !state.profile?.username || !state.profile?.display_name;

  const logResume = useServerFn(logOnboardingResumed);
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current) return;
    // Only log a genuine resume: user has been through onboarding before
    // (onboarding_completed) or explicitly clicked a resume entry point.
    const isResume =
      resume || (state.onboardingCompleted && profileIncomplete);
    if (!isResume) return;
    loggedRef.current = true;
    const source = search.source
      ? search.source
      : resume
        ? "resume_param"
        : "profile_incomplete";
    // Fire-and-forget; don't block UI on logging.
    logResume({ data: { source } }).catch(() => { /* ignore */ });
  }, [resume, profileIncomplete, state.onboardingCompleted, search.source, logResume]);

  const initialStep: Step = state.trainerApplication
    ? "pending"
    : state.onboardingCompleted
      ? "role" // shouldn't happen (should be redirected), but safe default
      : "role";
  const [step, setStep] = useState<Step>(initialStep);

  if (state.onboardingCompleted && !state.trainerApplication && !resume && !profileIncomplete) {
    // Already onboarded as trainee — nudge to dashboard
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 font-display text-2xl uppercase tracking-wide">
          You're all set
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your LEER Sports profile is ready.
        </p>
        <Button className="mt-6" onClick={() => router.navigate({ to: "/dashboard" })}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  const stepperCurrent: StepKey =
    step === "role" ? "role" : step === "pending" ? "done" : "details";
  const stepperKind: "trainee" | "trainer" | null =
    step === "trainee" ? "trainee" : step === "trainer" || step === "pending" ? "trainer" : null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <OnboardingStepper current={stepperCurrent} kind={stepperKind} />
        {(resume || profileIncomplete) && step === "role" && !state.trainerApplication && (
          <div className="mb-6 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
            <p className="font-display uppercase tracking-widest text-xs text-primary">Resume onboarding</p>
            <p className="mt-1 text-muted-foreground">
              You skipped this earlier. Pick a role to finish setting up your profile — you can skip again at any time.
            </p>
          </div>
        )}
        {step === "role" && <RoleStep onPick={setStep} />}
        {step === "trainee" && <TraineeForm onBack={() => setStep("role")} profile={state.profile} />}
        {step === "trainer" && (
          <TrainerForm
            onBack={() => setStep("role")}
            onSubmitted={() => setStep("pending")}
            profile={state.profile}
            prior={state.trainerApplication}
          />
        )}
        {step === "pending" && <PendingApplication application={state.trainerApplication} />}
      </div>
    </div>
  );
}

function SkipOnboardingButton({ className, fromStep }: { className?: string; fromStep: "role" | "trainee" | "trainer" }) {
  const router = useRouter();
  const skip = useServerFn(skipOnboarding);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const copy = {
    role: {
      title: "Skip choosing your role?",
      body: "We'll mark onboarding as complete and take you to the dashboard. You won't get a personalized trainee profile or a submitted trainer application yet — you can come back and finish this any time from Settings or the dashboard resume banner.",
    },
    trainee: {
      title: "Skip your trainee profile?",
      body: "We'll mark onboarding as complete without saving your fitness stats, goals, or preferences. Trainers won't see this info until you fill it in later. You can resume from Settings whenever you're ready.",
    },
    trainer: {
      title: "Skip your Pro application?",
      body: "Any details you entered here won't be submitted for review, so you won't be a verified Pro yet and can't monetize your content. We'll keep this draft and mark onboarding complete — resume from Settings to submit later.",
    },
  }[fromStep];

  async function handleConfirm() {
    setBusy(true);
    try {
      await skip({ data: { from_step: fromStep } });
      toast.success("Skipped for now — you can complete this later from Settings.");
      await router.invalidate();
      router.navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not skip");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className={className}>
          Skip for now
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Go back</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Skip anyway"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RoleStep({ onPick }: { onPick: (s: Step) => void }) {
  return (
    <div>
      <div className="mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Step 1 of 2</p>
        <h1 className="mt-2 font-display text-4xl uppercase tracking-tight sm:text-5xl">
          Choose your role
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This decides how you'll use LEER Sports. Trainers require professional verification.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onPick("trainee")}
          className="group rounded-lg border border-border bg-card p-6 text-left transition hover:border-primary"
        >
          <Dumbbell className="h-8 w-8 text-primary" />
          <h2 className="mt-4 font-display text-xl uppercase">I am a Trainee</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Discover verified trainers, unlock premium workouts, and submit one video-feedback
            request every month per subscription.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </button>
        <button
          type="button"
          onClick={() => onPick("trainer")}
          className="group rounded-lg border border-border bg-card p-6 text-left transition hover:border-primary"
        >
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h2 className="mt-4 font-display text-xl uppercase">I am a Pro Trainer</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Apply as a verified fitness creator. Certificates and identity check required before
            monetization is enabled.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Apply <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </button>
      </div>
      <div className="mt-6 flex justify-center">
        <SkipOnboardingButton fromStep="role" />
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type ProfileState = {
  avatar_url: string | null;
  country: string | null;
  display_name: string | null;
  full_name: string | null;
  native_language: string | null;
  onboarding_completed: boolean;
  username: string | null;
} | null;

type PriorApplication = {
  full_legal_name?: string | null;
  public_trainer_name?: string | null;
  country?: string | null;
  native_language?: string | null;
  additional_languages?: string[] | null;
  specialties?: string[] | null;
  years_experience?: number | null;
  biography?: string | null;
  certification_details?: string | null;
  certificates?: string[] | null;
  id_doc_url?: string | null;
  social_links?: string[] | null;
  requested_price?: number | null;
  payout_info?: unknown;
} | null;

function TraineeForm({ onBack, profile }: { onBack: () => void; profile: ProfileState }) {
  const router = useRouter();
  const submit = useServerFn(completeTraineeOnboarding);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const raw = {
        username: String(fd.get("username") ?? ""),
        display_name: String(fd.get("display_name") ?? ""),
        country: String(fd.get("country") ?? ""),
        native_language: String(fd.get("native_language") ?? ""),
        additional_languages: String(fd.get("additional_languages") ?? "")
          .split(",").map((s) => s.trim()).filter(Boolean),
        gender: (fd.get("gender") as string) || undefined,
        height_cm: fd.get("height_cm") ? Number(fd.get("height_cm")) : undefined,
        weight_kg: fd.get("weight_kg") ? Number(fd.get("weight_kg")) : undefined,
        body_fat_percent: fd.get("body_fat_percent") ? Number(fd.get("body_fat_percent")) : undefined,
        skeletal_muscle_kg: fd.get("skeletal_muscle_kg") ? Number(fd.get("skeletal_muscle_kg")) : undefined,
        goal: String(fd.get("goal") ?? "") || undefined,
        experience_level: String(fd.get("experience_level") ?? "beginner"),
        injuries: String(fd.get("injuries") ?? "") || undefined,
        agreement_accepted: fd.get("agreement_accepted") === "on" ? true : false,
      };
      const parsed = traineeOnboardingSchema.parse(raw);
      await submit({ data: parsed });
      toast.success("Welcome to LEER Sports");
      router.invalidate();
      router.navigate({ to: "/dashboard" });
    } catch (err) {
      showSubmitError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Trainee setup</p>
          <h1 className="mt-1 font-display text-3xl uppercase tracking-tight">Your profile</h1>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>Back</Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" htmlFor="username" hint="Lowercase letters, numbers, underscores.">
            <Input id="username" name="username" required autoComplete="off" defaultValue={profile?.username ?? ""} />
          </Field>
          <Field label="Display name" htmlFor="display_name">
            <Input id="display_name" name="display_name" required defaultValue={profile?.display_name ?? profile?.full_name ?? ""} />
          </Field>
          <Field label="Country" htmlFor="country">
            <Input id="country" name="country" required placeholder="e.g. Canada" defaultValue={profile?.country ?? ""} />
          </Field>
          <Field label="Native language" htmlFor="native_language">
            <Input id="native_language" name="native_language" required placeholder="e.g. English" defaultValue={profile?.native_language ?? ""} />
          </Field>
          <Field label="Additional languages" htmlFor="additional_languages" hint="Comma separated.">
            <Input id="additional_languages" name="additional_languages" placeholder="Spanish, Korean" />
          </Field>
          <Field label="Gender (optional)" htmlFor="gender">
            <select id="gender" name="gender" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="nonbinary">Non-binary</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display text-lg uppercase tracking-wide">Fitness stats <span className="text-xs text-muted-foreground normal-case tracking-normal">(optional)</span></h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Height (cm)" htmlFor="height_cm"><Input id="height_cm" name="height_cm" type="number" step="0.1" /></Field>
          <Field label="Weight (kg)" htmlFor="weight_kg"><Input id="weight_kg" name="weight_kg" type="number" step="0.1" /></Field>
          <Field label="Body fat (%)" htmlFor="body_fat_percent"><Input id="body_fat_percent" name="body_fat_percent" type="number" step="0.1" /></Field>
          <Field label="Skeletal muscle (kg)" htmlFor="skeletal_muscle_kg"><Input id="skeletal_muscle_kg" name="skeletal_muscle_kg" type="number" step="0.1" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Experience level" htmlFor="experience_level">
            <select id="experience_level" name="experience_level" defaultValue="beginner" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="elite">Elite</option>
            </select>
          </Field>
          <Field label="Fitness goal" htmlFor="goal"><Input id="goal" name="goal" placeholder="e.g. hypertrophy, marathon" /></Field>
        </div>
        <Field label="Injuries / notes" htmlFor="injuries">
          <Textarea id="injuries" name="injuries" rows={3} placeholder="Anything a trainer should know about." />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm">
        <input type="checkbox" name="agreement_accepted" required className="mt-1 h-4 w-4 accent-[var(--primary)]" />
        <span>
          I accept the LEER Sports Trainee Agreement, including community rules, content policy, and payment terms.
        </span>
      </label>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy} className="min-w-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finish setup"}
        </Button>
      </div>
    </form>
  );
}

function TrainerForm({
  onBack,
  onSubmitted,
  profile,
  prior,
}: {
  onBack: () => void;
  onSubmitted: () => void;
  profile: ProfileState;
  prior: PriorApplication;
}) {
  const router = useRouter();
  const submit = useServerFn(submitTrainerApplication);
  const [busy, setBusy] = useState(false);
  const joinList = (v: string[] | null | undefined) => (v && v.length ? v.join(", ") : "");
  const priorPayoutNote =
    prior?.payout_info && typeof prior.payout_info === "object" && "note" in prior.payout_info
      ? String((prior.payout_info as { note?: unknown }).note ?? "")
      : "";
  const dv = {
    full_legal_name: prior?.full_legal_name ?? "",
    public_trainer_name: prior?.public_trainer_name ?? profile?.display_name ?? "",
    username: profile?.username ?? "",
    display_name: profile?.display_name ?? profile?.full_name ?? "",
    country: prior?.country ?? profile?.country ?? "",
    native_language: prior?.native_language ?? profile?.native_language ?? "",
    additional_languages: joinList(prior?.additional_languages),
    specialties: joinList(prior?.specialties),
    years_experience:
      prior?.years_experience != null ? String(prior.years_experience) : "",
    biography: prior?.biography ?? "",
    certification_details: prior?.certification_details ?? "",
    certificates: joinList(prior?.certificates),
    id_doc_url: prior?.id_doc_url ?? "",
    social_links: joinList(prior?.social_links),
    requested_price:
      prior?.requested_price != null ? Number(prior.requested_price) : 19.99,
    payout_info: priorPayoutNote,
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const str = (k: string) => String(fd.get(k) ?? "").trim();
      const list = (k: string, sep: RegExp | string = ",") =>
        str(k).split(sep).map((s) => s.trim()).filter(Boolean);
      const isHttpUrl = (s: string) => {
        try {
          const u = new URL(s);
          return u.protocol === "http:" || u.protocol === "https:";
        } catch { return false; }
      };

      const idDoc = str("id_doc_url");
      const bio = str("biography").replace(/\s+/g, " ");
      const certs = list("certificates", /[\s,]+/);
      const socials = list("social_links", /[\s,]+/);
      const payout = str("payout_info");
      const years = str("years_experience");
      const price = str("requested_price");

      const raw = {
        username: str("username").toLowerCase(),
        display_name: str("display_name"),
        full_legal_name: str("full_legal_name"),
        public_trainer_name: str("public_trainer_name"),
        country: str("country"),
        native_language: str("native_language"),
        additional_languages: list("additional_languages"),
        specialties: list("specialties"),
        years_experience: years === "" ? 0 : Number(years),
        biography: bio,
        certification_details: str("certification_details"),
        certificates: certs,
        id_doc_url: idDoc === "" ? undefined : idDoc,
        social_links: socials,
        requested_price: price === "" ? 9.99 : Number(price),
        payout_info: payout === "" ? undefined : payout,
        agreement_accepted: fd.get("agreement_accepted") === "on",
      };

      // Surface URL issues with clearer, field-specific messages before the schema runs.
      const badCerts = certs.filter((u) => !isHttpUrl(u));
      const badSocials = socials.filter((u) => !isHttpUrl(u));
      if (idDoc && !isHttpUrl(idDoc)) {
        toast.error("Government ID URL must start with http(s)://");
        return;
      }
      if (badCerts.length) {
        toast.error("Certificate URLs must be valid links", { description: badCerts.slice(0, 3).join(", ") });
        return;
      }
      if (badSocials.length) {
        toast.error("Social / portfolio links must be valid URLs", { description: badSocials.slice(0, 3).join(", ") });
        return;
      }

      const parsed = trainerApplicationSchema.parse(raw);
      await submit({ data: parsed });
      toast.success("Application submitted — under review");
      await router.invalidate();
      onSubmitted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // If an application already exists, treat as success and move to the pending view.
      if (/already have an application/i.test(msg)) {
        toast.message("Your application is already under review");
        await router.invalidate();
        onSubmitted();
        return;
      }
      showSubmitError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Trainer application</p>
          <h1 className="mt-1 font-display text-3xl uppercase tracking-tight">Apply as a Pro</h1>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>Back</Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display text-lg uppercase tracking-wide">Identity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full legal name" htmlFor="full_legal_name"><Input id="full_legal_name" name="full_legal_name" defaultValue={dv.full_legal_name} /></Field>
          <Field label="Public trainer name" htmlFor="public_trainer_name"><Input id="public_trainer_name" name="public_trainer_name" defaultValue={dv.public_trainer_name} /></Field>
          <Field label="Username" htmlFor="username" hint="Lowercase letters, numbers, underscores.">
            <Input id="username" name="username" required autoComplete="off" defaultValue={dv.username} />
          </Field>
          <Field label="Display name" htmlFor="display_name"><Input id="display_name" name="display_name" defaultValue={dv.display_name} /></Field>
          <Field label="Country" htmlFor="country"><Input id="country" name="country" defaultValue={dv.country} /></Field>
          <Field label="Native language" htmlFor="native_language"><Input id="native_language" name="native_language" defaultValue={dv.native_language} /></Field>
          <Field label="Additional languages" htmlFor="additional_languages" hint="Comma separated.">
            <Input id="additional_languages" name="additional_languages" defaultValue={dv.additional_languages} />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display text-lg uppercase tracking-wide">Professional profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Specialties" htmlFor="specialties" hint="Comma separated. e.g. Hypertrophy, Powerlifting, Mobility">
            <Input id="specialties" name="specialties" defaultValue={dv.specialties} />
          </Field>
          <Field label="Years of experience" htmlFor="years_experience">
            <Input id="years_experience" name="years_experience" type="number" min={0} max={70} defaultValue={dv.years_experience} />
          </Field>
        </div>
        <Field label="Biography" htmlFor="biography" hint="Optional. Tell us about yourself.">
          <Textarea id="biography" name="biography" rows={4} defaultValue={dv.biography} />
        </Field>
        <Field label="Certification details" htmlFor="certification_details" hint="Bodies issuing your certs, IDs, dates.">
          <Textarea id="certification_details" name="certification_details" rows={3} defaultValue={dv.certification_details} />
        </Field>
        <Field label="Certificate URLs" htmlFor="certificates" hint="Public links to scanned certificates. Comma or newline separated.">
          <Textarea id="certificates" name="certificates" rows={2} defaultValue={dv.certificates} />
        </Field>
        <Field label="Government ID URL (if legally required)" htmlFor="id_doc_url">
          <Input id="id_doc_url" name="id_doc_url" type="url" defaultValue={dv.id_doc_url} />
        </Field>
        <Field label="Social / portfolio links" htmlFor="social_links" hint="Comma or newline separated URLs.">
          <Textarea id="social_links" name="social_links" rows={2} defaultValue={dv.social_links} />
        </Field>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display text-lg uppercase tracking-wide">Monetization</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred monthly price (USD)" htmlFor="requested_price" hint="Optional.">
            <Input id="requested_price" name="requested_price" type="number" step="0.01" min={0} defaultValue={dv.requested_price} />
          </Field>
        </div>
        <Field label="Payout info (optional note)" htmlFor="payout_info" hint="Do not paste bank details here. Admin will collect them securely on approval.">
          <Textarea id="payout_info" name="payout_info" rows={2} defaultValue={dv.payout_info} />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm">
        <input type="checkbox" name="agreement_accepted" required className="mt-1 h-4 w-4 accent-[var(--primary)]" />
        <span>
          I accept the LEER Sports Trainer Agreement, including the 80/20 revenue split, quality
          standards, 48-hour coaching SLA, dispute policy, and prohibited-content rules.
        </span>
      </label>

      <div className="flex justify-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SkipOnboardingButton fromStep="trainer" />
        <Button type="submit" disabled={busy} className="min-w-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit application"}
        </Button>
      </div>
      </div>
    </form>
  );
}

function PendingApplication({ application }: { application: { status: string; created_at: string; admin_notes: string | null } | null }) {
  if (!application) return null;
  const rejected = application.status === "rejected";
  const resubmit = application.status === "resubmit";
  return (
    <div className="mx-auto max-w-xl text-center">
      <ClipboardList className="mx-auto h-10 w-10 text-primary" />
      <h1 className="mt-4 font-display text-3xl uppercase tracking-tight">
        {rejected ? "Application declined" : resubmit ? "Resubmission requested" : "Under review"}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {rejected
          ? "Your trainer application was not approved."
          : resubmit
            ? "An admin has asked you to update your application."
            : "Our team reviews new pro trainer applications within a few business days."}
      </p>
      {application.admin_notes && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4 text-left text-sm">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Admin note</p>
          <p className="mt-1 whitespace-pre-wrap">{application.admin_notes}</p>
        </div>
      )}
      <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">
        Submitted {new Date(application.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
