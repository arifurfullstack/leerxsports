import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";
import { Loader2, Dumbbell, ShieldCheck, ArrowRight, CheckCircle2, ClipboardList, Check, Sparkles } from "lucide-react";

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

function OnboardingStepper({
  current,
  kind,
  onSelectStep,
}: {
  current: StepKey;
  kind: "trainee" | "trainer" | null;
  onSelectStep?: (key: StepKey) => void;
}) {
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
    <div className="mb-8 rounded-3xl border border-red-500/30 bg-black/80 backdrop-blur-2xl p-5 shadow-[0_0_40px_-15px_rgba(239,68,68,0.25)]">
      <ol className="flex items-center gap-2 sm:gap-4" aria-label="Onboarding progress">
        {items.map((it, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={it.key} className="flex flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => onSelectStep?.(it.key)}
                className="flex items-center gap-2 sm:gap-3 text-left focus:outline-none group/step"
              >
                <div
                  className={
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border text-xs font-black transition-all duration-300 " +
                    (done
                      ? "border-red-500 bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)] group-hover/step:scale-110"
                      : active
                        ? "border-red-500 bg-red-600/20 text-red-400 shadow-[0_0_20px_-3px_rgba(239,68,68,0.5)] scale-110"
                        : "border-neutral-800 bg-neutral-900 text-muted-foreground group-hover/step:border-neutral-700")
                  }
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="h-4 w-4 stroke-[3]" /> : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={"truncate text-xs font-black uppercase tracking-wider transition-colors " + (active ? "text-red-400" : done ? "text-foreground group-hover/step:text-red-300" : "text-muted-foreground")}>
                    {it.label}
                  </p>
                  <p className="hidden text-[10px] text-muted-foreground sm:block">
                    {done ? "Completed" : active ? "In Progress" : "Upcoming"}
                  </p>
                </div>
              </button>
              {i < items.length - 1 && (
                <div className={"hidden h-0.5 flex-1 sm:block transition-all duration-500 " + (done ? "bg-gradient-to-r from-red-600 to-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-neutral-800")} />
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-950 p-0.5 border border-red-500/20" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-orange-500 transition-all duration-700 ease-out shadow-[0_0_15px_rgba(239,68,68,0.7)]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <span className="text-red-400 font-bold">Gymshark Pro Setup Flow</span>
        <span>Step {idx + 1} of {order.length} ({percent}%)</span>
      </div>
    </div>
  );
}

function StepPreloader({ stepName }: { stepName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-in fade-in duration-300">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping" />
        <div className="h-12 w-12 rounded-full border-4 border-red-500/30 border-t-red-500 animate-spin shadow-[0_0_20px_rgba(239,68,68,0.6)]" />
        <Dumbbell className="absolute h-5 w-5 text-red-500 animate-pulse" />
      </div>
      <p className="mt-5 font-display text-lg font-black uppercase tracking-wider text-foreground">
        Loading {stepName || "Step Content"}…
      </p>
      <p className="mt-1 text-xs text-muted-foreground font-mono uppercase tracking-widest">
        Gymshark Pro Onboarding Engine
      </p>
    </div>
  );
}

function OnboardingPage() {
  const router = useRouter();
  const { data: state } = useSuspenseQuery(onboardingQuery);
  const search = useSearch({ from: "/_authenticated/onboarding" });
  const resume = !!search.resume;
  const profileIncomplete = !state?.profile?.username || !state?.profile?.display_name;

  const logResume = useServerFn(logOnboardingResumed);
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current || !state) return;
    // Only log a genuine resume: user has been through onboarding before
    // (onboarding_completed) or explicitly clicked a resume entry point.
    const isResume =
      resume || (state?.onboardingCompleted && profileIncomplete);
    if (!isResume) return;
    loggedRef.current = true;
    const source = search.source
      ? search.source
      : resume
        ? "resume_param"
        : "profile_incomplete";
    // Fire-and-forget; don't block UI on logging.
    logResume({ data: { source } }).catch(() => { /* ignore */ });
  }, [resume, profileIncomplete, state?.onboardingCompleted, search.source, logResume, state]);

  const selectedRole = state?.userMetadata?.selected_role;
  const initialStep: Step = state?.trainerApplication
    ? "pending"
    : selectedRole === "trainer"
      ? "trainer"
      : selectedRole === "trainee"
        ? "trainee"
        : "role";
  const [step, setStep] = useState<Step>(initialStep);
  const [isChangingStep, setIsChangingStep] = useState(false);

  const changeStep = (targetStep: Step) => {
    if (targetStep === step) return;
    setIsChangingStep(true);
    setTimeout(() => {
      setStep(targetStep);
      setIsChangingStep(false);
    }, 220);
  };

  if (state?.onboardingCompleted && !state?.trainerApplication && !resume && !profileIncomplete) {
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

  const handleSelectStepperKey = (key: StepKey) => {
    if (key === "role") {
      changeStep("role");
    } else if (key === "details") {
      changeStep(stepperKind === "trainee" ? "trainee" : "trainer");
    } else if (key === "done") {
      changeStep("pending");
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <OnboardingStepper current={stepperCurrent} kind={stepperKind} onSelectStep={handleSelectStepperKey} />
        {(resume || profileIncomplete) && step === "role" && !state?.trainerApplication && (
          <div className="mb-6 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
            <p className="font-display uppercase tracking-widest text-xs text-primary">Resume onboarding</p>
            <p className="mt-1 text-muted-foreground">
              You skipped this earlier. Pick a role to finish setting up your profile — you can skip again at any time.
            </p>
          </div>
        )}

        {isChangingStep ? (
          <StepPreloader stepName={stepperCurrent === "role" ? "Role Choice" : stepperCurrent === "details" ? "Application Setup" : "Review Portal"} />
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            {step === "role" && <RoleStep onPick={changeStep} />}
            {step === "trainee" && <TraineeForm onBack={() => changeStep("role")} profile={state?.profile} />}
            {step === "trainer" && (
              <TrainerForm
                onBack={() => changeStep("role")}
                onSubmitted={() => changeStep("pending")}
                profile={state?.profile}
                prior={state?.trainerApplication}
              />
            )}
            {step === "pending" && (
              <PendingApplication
                application={state?.trainerApplication}
                onGoToApplication={() => changeStep("trainer")}
              />
            )}
          </div>
        )}
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
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-600/10 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-red-400">
          <Sparkles className="h-3.5 w-3.5" /> Step 1 of 2
        </span>
        <h1 className="font-display text-4xl font-black uppercase tracking-tight text-foreground sm:text-5xl">
          Choose Your <span className="text-red-500">Arena Role</span>
        </h1>
        <p className="mx-auto max-w-lg text-xs sm:text-sm text-muted-foreground">
          Select how you want to experience LEER Sports. Pro Trainers require credentials verification.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Trainee Card */}
        <button
          type="button"
          onClick={() => onPick("trainee")}
          className="group relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-black/80 p-7 text-left backdrop-blur-2xl transition-all duration-300 hover:scale-[1.03] hover:border-emerald-400 hover:shadow-[0_0_50px_-10px_rgba(16,185,129,0.35)] flex flex-col justify-between"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl transition-opacity group-hover:opacity-100" />
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 transition-transform duration-300 group-hover:scale-110">
              <Dumbbell className="h-7 w-7" />
            </div>
            <h2 className="mt-5 font-display text-2xl font-black uppercase tracking-wider text-foreground group-hover:text-emerald-400 transition-colors">
              I am a Trainee
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Discover verified trainers, track your physique transformations, and access exclusive workout routines &amp; 1-on-1 Q&amp;A coaching.
            </p>

            <ul className="mt-4 space-y-2 border-t border-hairline/60 pt-4 text-xs font-semibold text-muted-foreground">
              <li className="flex items-center gap-2 text-emerald-300">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> Track progress &amp; body metrics
              </li>
              <li className="flex items-center gap-2 text-emerald-300">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> Access verified trainer feeds
              </li>
              <li className="flex items-center gap-2 text-emerald-300">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> Submit 1-on-1 Q&amp;A video requests
              </li>
            </ul>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-hairline/60 pt-4">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
              Start Trainee Setup <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </button>

        {/* Trainer Card */}
        <button
          type="button"
          onClick={() => onPick("trainer")}
          className="group relative overflow-hidden rounded-3xl border border-red-500/50 bg-black/80 p-7 text-left backdrop-blur-2xl transition-all duration-300 hover:scale-[1.03] hover:border-red-400 hover:shadow-[0_0_50px_-10px_rgba(239,68,68,0.45)] flex flex-col justify-between"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-600/15 blur-3xl transition-opacity group-hover:opacity-100" />
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/20 border border-red-500/40 text-red-400 transition-transform duration-300 group-hover:scale-110 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div className="mt-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-black uppercase tracking-wider text-foreground group-hover:text-red-400 transition-colors">
                I am a Pro Trainer
              </h2>
              <span className="rounded-lg bg-red-600/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-400 border border-red-500/30">
                PRO VERIFIED
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Apply as an authorized fitness creator. Publish workouts, manage clients, and monetize content with verified credentials.
            </p>

            <ul className="mt-4 space-y-2 border-t border-hairline/60 pt-4 text-xs font-semibold text-muted-foreground">
              <li className="flex items-center gap-2 text-red-300">
                <Check className="h-3.5 w-3.5 text-red-400 shrink-0" /> 80/20 Revenue split on subscriptions
              </li>
              <li className="flex items-center gap-2 text-red-300">
                <Check className="h-3.5 w-3.5 text-red-400 shrink-0" /> Paid 1-on-1 Q&amp;A inbox &amp; coaching
              </li>
              <li className="flex items-center gap-2 text-red-300">
                <Check className="h-3.5 w-3.5 text-red-400 shrink-0" /> Verified Pro Badge on community profile
              </li>
            </ul>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-hairline/60 pt-4">
            <span className="text-xs font-black uppercase tracking-widest text-red-400 flex items-center gap-1">
              Apply As Pro Trainer <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </button>
      </div>

      <div className="flex justify-center pt-2">
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

function AttractiveAgreementCheckbox({
  name,
  checked,
  onChange,
  theme = "red",
  children,
}: {
  name: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  theme?: "red" | "emerald";
  children: React.ReactNode;
}) {
  const isRed = theme === "red";
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`group relative flex cursor-pointer items-start gap-4 rounded-3xl border p-5 text-xs transition-all duration-300 backdrop-blur-2xl ${
        checked
          ? isRed
            ? "border-red-500 bg-red-950/30 shadow-[0_0_35px_-5px_rgba(239,68,68,0.4)]"
            : "border-emerald-500 bg-emerald-950/30 shadow-[0_0_35px_-5px_rgba(16,185,129,0.4)]"
          : isRed
            ? "border-red-500/30 bg-black/80 hover:border-red-500/60 shadow-[0_0_20px_-10px_rgba(239,68,68,0.2)]"
            : "border-emerald-500/30 bg-black/80 hover:border-emerald-500/60 shadow-[0_0_20px_-10px_rgba(16,185,129,0.2)]"
      }`}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
        required
      />

      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border-2 transition-all duration-300 ${
          checked
            ? isRed
              ? "border-red-500 bg-gradient-to-br from-red-600 to-rose-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.8)] scale-110"
              : "border-emerald-500 bg-gradient-to-br from-emerald-500 to-teal-600 text-black shadow-[0_0_15px_rgba(16,185,129,0.8)] scale-110"
            : "border-neutral-700 bg-neutral-900/90 text-transparent group-hover:border-neutral-500"
        }`}
      >
        <Check className={`h-4 w-4 stroke-[3.5] transition-all duration-200 ${checked ? "scale-100 opacity-100" : "scale-50 opacity-0"}`} />
      </div>

      <span className="leading-relaxed text-foreground select-none">
        {children}
      </span>
    </div>
  );
}

function TraineeForm({ onBack, profile }: { onBack: () => void; profile: ProfileState }) {
  const router = useRouter();
  const submit = useServerFn(completeTraineeOnboarding);
  const [busy, setBusy] = useState(false);
  const [goal, setGoal] = useState("");
  const [exp, setExp] = useState("beginner");
  const [agreement, setAgreement] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agreement) {
      toast.error("Please accept the Trainee Agreement to proceed");
      return;
    }
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
        goal: goal || String(fd.get("goal") ?? "") || undefined,
        experience_level: exp || String(fd.get("experience_level") ?? "beginner"),
        injuries: String(fd.get("injuries") ?? "") || undefined,
        agreement_accepted: agreement,
      };
      const parsed = traineeOnboardingSchema.parse(raw);
      await submit({ data: parsed });
      toast.success("Welcome to LEER Sports 🏃");
      router.invalidate();
      router.navigate({ to: "/dashboard" });
    } catch (err) {
      showSubmitError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Form Header */}
      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-400 flex items-center gap-1.5">
            <Dumbbell className="h-3.5 w-3.5" /> Trainee Setup
          </p>
          <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight text-foreground">
            Setup Your <span className="text-emerald-400">Trainee Profile</span>
          </h1>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="rounded-xl border border-neutral-800 text-xs font-bold text-muted-foreground hover:text-foreground">
          &larr; Back
        </Button>
      </div>

      {/* Section 1: Profile Details */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-black/80 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_40px_-15px_rgba(16,185,129,0.2)] space-y-6">
        <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
          <h2 className="font-display text-lg font-black uppercase tracking-wide text-foreground flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs">1</span> Personal Handle &amp; Location
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Username" htmlFor="username" hint="Lowercase letters, numbers, underscores.">
            <Input id="username" name="username" required autoComplete="off" defaultValue={profile?.username ?? ""} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
          <Field label="Display name" htmlFor="display_name">
            <Input id="display_name" name="display_name" required defaultValue={profile?.display_name ?? profile?.full_name ?? ""} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
          <Field label="Country" htmlFor="country">
            <Input id="country" name="country" required placeholder="e.g. Canada" defaultValue={profile?.country ?? ""} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
          <Field label="Native language" htmlFor="native_language">
            <Input id="native_language" name="native_language" required placeholder="e.g. English" defaultValue={profile?.native_language ?? ""} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
          <Field label="Additional languages" htmlFor="additional_languages" hint="Comma separated.">
            <Input id="additional_languages" name="additional_languages" placeholder="Spanish, French" className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
          <Field label="Gender (optional)" htmlFor="gender">
            <select id="gender" name="gender" className="h-11 w-full rounded-2xl border border-neutral-800 bg-neutral-900/80 px-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none">
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="nonbinary">Non-binary</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Section 2: Fitness Stats & Goals */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-black/80 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_40px_-15px_rgba(16,185,129,0.2)] space-y-6">
        <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
          <h2 className="font-display text-lg font-black uppercase tracking-wide text-foreground flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs">2</span> Fitness Stats &amp; Goals <span className="text-xs text-muted-foreground font-normal tracking-normal">(optional)</span>
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Height (cm)" htmlFor="height_cm">
            <Input id="height_cm" name="height_cm" type="number" step="0.1" placeholder="178" className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
          <Field label="Weight (kg)" htmlFor="weight_kg">
            <Input id="weight_kg" name="weight_kg" type="number" step="0.1" placeholder="75" className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
          <Field label="Body fat (%)" htmlFor="body_fat_percent">
            <Input id="body_fat_percent" name="body_fat_percent" type="number" step="0.1" placeholder="14.5" className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
          <Field label="Skeletal muscle (kg)" htmlFor="skeletal_muscle_kg">
            <Input id="skeletal_muscle_kg" name="skeletal_muscle_kg" type="number" step="0.1" placeholder="38" className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
        </div>

        {/* Experience Level Cards */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Experience Level</Label>
          <input type="hidden" name="experience_level" value={exp} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { id: "beginner", label: "Beginner", desc: "0-1 yrs training" },
              { id: "intermediate", label: "Intermediate", desc: "1-3 yrs training" },
              { id: "advanced", label: "Advanced", desc: "3-5 yrs training" },
              { id: "elite", label: "Elite", desc: "5+ yrs athlete" },
            ].map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setExp(lvl.id)}
                className={`rounded-2xl border p-3 text-left transition-all ${
                  exp === lvl.id
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)]"
                    : "border-neutral-800 bg-neutral-900/60 text-muted-foreground hover:border-neutral-700"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-wider">{lvl.label}</p>
                <p className="text-[10px] text-muted-foreground">{lvl.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Fitness Goal with Quick Chips */}
        <div className="space-y-2">
          <Field label="Fitness Goal" htmlFor="goal">
            <Input id="goal" name="goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Hypertrophy & Muscle Gain" className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Quick Suggestions:</span>
            {["Hypertrophy & Muscle Gain", "Cut to 10-12% Body Fat", "Build Overall Strength", "Marathon & Endurance", "Body Recomp & Toning"].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGoal(g)}
                className={`rounded-xl border px-2.5 py-1 text-[10px] font-bold transition-all ${
                  goal === g ? "border-emerald-500 bg-emerald-500/20 text-emerald-300" : "border-neutral-800 bg-neutral-900/60 text-muted-foreground hover:border-neutral-700"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <Field label="Injuries / notes" htmlFor="injuries">
          <Textarea id="injuries" name="injuries" rows={3} placeholder="Anything a trainer should know (e.g. past knee injury, lower back sensitivity)..." className="rounded-2xl border-neutral-800 bg-neutral-900/80 p-3 text-xs" />
        </Field>
      </div>

      {/* Agreement */}
      <AttractiveAgreementCheckbox
        name="agreement_accepted"
        checked={agreement}
        onChange={setAgreement}
        theme="emerald"
      >
        I accept the <strong className="text-emerald-400">LEER Sports Trainee Agreement</strong>, including community guidelines, content policy, and payment terms.
      </AttractiveAgreementCheckbox>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3">
        <SkipOnboardingButton fromStep="trainee" />
        <Button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-3 font-black uppercase tracking-wider text-black shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Profile…
            </>
          ) : (
            "Complete Trainee Setup 🏃"
          )}
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
  const queryClient = useQueryClient();
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

  const [specialties, setSpecialties] = useState(dv.specialties);
  const [country, setCountry] = useState(dv.country);
  const [lang, setLang] = useState(dv.native_language);
  const [bio, setBio] = useState(dv.biography);
  const [certs, setCerts] = useState(dv.certification_details);
  const [price, setPrice] = useState(String(dv.requested_price));
  const [agreement, setAgreement] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agreement) {
      toast.error("Please accept the Trainer Agreement to proceed");
      return;
    }
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
        requested_price: price === "" ? 19.99 : Number(price),
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
      await queryClient.invalidateQueries({ queryKey: ["navbar-trainer-status"] });
      await router.invalidate();
      onSubmitted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // If an application already exists, treat as success and move to the pending view.
      if (/already have an application/i.test(msg)) {
        toast.message("Your application is already under review");
        await queryClient.invalidateQueries({ queryKey: ["navbar-trainer-status"] });
        await router.invalidate();
        onSubmitted();
        return;
      }
      showSubmitError(err);
    } finally {
      setBusy(false);
    }
  }

  const appendChip = (setter: React.Dispatch<React.SetStateAction<string>>, currentVal: string, tag: string) => {
    if (!currentVal.trim()) {
      setter(tag);
    } else if (!currentVal.includes(tag)) {
      setter(`${currentVal.trim()}, ${tag}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Form Header */}
      <div className="flex items-center justify-between border-b border-red-500/20 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-red-500 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Trainer Application
          </p>
          <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight text-foreground">
            Apply as a Pro <span className="text-red-500">Trainer</span>
          </h1>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="rounded-xl border border-neutral-800 text-xs font-bold text-muted-foreground hover:text-foreground">
          &larr; Back
        </Button>
      </div>

      {/* Section 1: Identity */}
      <div className="relative overflow-hidden rounded-3xl border border-red-500/30 bg-black/80 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_40px_-15px_rgba(239,68,68,0.2)] space-y-6">
        <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
          <h2 className="font-display text-lg font-black uppercase tracking-wide text-foreground flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 text-xs">1</span> Identity &amp; Handle
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full legal name" htmlFor="full_legal_name">
            <Input id="full_legal_name" name="full_legal_name" defaultValue={dv.full_legal_name} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
          <Field label="Public trainer name" htmlFor="public_trainer_name">
            <Input id="public_trainer_name" name="public_trainer_name" defaultValue={dv.public_trainer_name} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
          <Field label="Username" htmlFor="username" hint="Lowercase letters, numbers, underscores.">
            <Input id="username" name="username" required autoComplete="off" defaultValue={dv.username} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
          <Field label="Display name" htmlFor="display_name">
            <Input id="display_name" name="display_name" defaultValue={dv.display_name} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>

          {/* Country with Chips */}
          <div className="space-y-1.5">
            <Field label="Country" htmlFor="country">
              <Input id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
            </Field>
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {["United States", "Canada", "United Kingdom", "Australia", "Germany", "Japan"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCountry(c)}
                  className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition-all ${
                    country === c ? "border-red-500 bg-red-600/30 text-white" : "border-neutral-800 bg-neutral-900/60 text-muted-foreground hover:border-neutral-700"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Native Language with Chips */}
          <div className="space-y-1.5">
            <Field label="Native language" htmlFor="native_language">
              <Input id="native_language" name="native_language" value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
            </Field>
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {["English", "Spanish", "French", "German", "Japanese"].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition-all ${
                    lang === l ? "border-red-500 bg-red-600/30 text-white" : "border-neutral-800 bg-neutral-900/60 text-muted-foreground hover:border-neutral-700"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <Field label="Additional languages" htmlFor="additional_languages" hint="Comma separated.">
              <Input id="additional_languages" name="additional_languages" defaultValue={dv.additional_languages} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" placeholder="Spanish, French, German" />
            </Field>
          </div>
        </div>
      </div>

      {/* Section 2: Professional Profile */}
      <div className="relative overflow-hidden rounded-3xl border border-red-500/30 bg-black/80 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_40px_-15px_rgba(239,68,68,0.2)] space-y-6">
        <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
          <h2 className="font-display text-lg font-black uppercase tracking-wide text-foreground flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 text-xs">2</span> Professional Credentials
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Specialties with Quick Chips */}
          <div className="sm:col-span-2 space-y-1.5">
            <Field label="Specialties" htmlFor="specialties" hint="Comma separated. e.g. Hypertrophy, Powerlifting, Mobility">
              <Input id="specialties" name="specialties" value={specialties} onChange={(e) => setSpecialties(e.target.value)} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" placeholder="e.g. Bodybuilding, Fat Loss, Powerlifting" />
            </Field>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Quick Select:</span>
              {["Hypertrophy", "Powerlifting", "Fat Loss / Shredding", "Nutrition Coaching", "Mobility & Rehab", "Boxing / MMA", "CrossFit"].map((spec) => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => appendChip(setSpecialties, specialties, spec)}
                  className="rounded-xl border border-red-500/30 bg-red-600/10 px-2.5 py-1 text-[10px] font-bold text-red-300 transition-all hover:border-red-500 hover:bg-red-600/30 hover:scale-105"
                >
                  + {spec}
                </button>
              ))}
            </div>
          </div>

          <Field label="Years of experience" htmlFor="years_experience">
            <Input id="years_experience" name="years_experience" type="number" min={0} max={70} defaultValue={dv.years_experience} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
          </Field>
        </div>

        {/* Biography with Suggestions */}
        <div className="space-y-1.5">
          <Field label="Biography" htmlFor="biography" hint="Optional. Tell us about yourself and coaching methodology.">
            <Textarea id="biography" name="biography" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} className="rounded-2xl border-neutral-800 bg-neutral-900/80 p-3 text-xs" placeholder="Certified strength coach with 8+ years helping trainees achieve real physique transformations..." />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Bio Starters:</span>
            {[
              "Passionate strength coach specializing in progressive overload and body recomposition.",
              "Former competitive athlete offering customized 1-on-1 online coaching.",
            ].map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setBio(prompt)}
                className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-all hover:border-red-500/50 hover:text-foreground truncate max-w-[280px]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Certifications with Suggestions */}
        <div className="space-y-1.5">
          <Field label="Certification details" htmlFor="certification_details" hint="Bodies issuing your certs, IDs, dates.">
            <Textarea id="certification_details" name="certification_details" rows={3} value={certs} onChange={(e) => setCerts(e.target.value)} className="rounded-2xl border-neutral-800 bg-neutral-900/80 p-3 text-xs" placeholder="NASM Certified Personal Trainer #1209381 (Valid thru 2028)" />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Cert Ideas:</span>
            {["NASM CPT", "ACE Certified Trainer", "CSCS Strength Coach", "ISSA Master Trainer", "Precision Nutrition Level 1"].map((cert) => (
              <button
                key={cert}
                type="button"
                onClick={() => appendChip(setCerts, certs, cert)}
                className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-all hover:border-red-500/50 hover:text-foreground"
              >
                + {cert}
              </button>
            ))}
          </div>
        </div>

        <Field label="Certificate URLs" htmlFor="certificates" hint="Public links to scanned certificates. Comma or newline separated.">
          <Textarea id="certificates" name="certificates" rows={2} defaultValue={dv.certificates} className="rounded-2xl border-neutral-800 bg-neutral-900/80 p-3 text-xs" placeholder="https://example.com/cert.pdf" />
        </Field>
        <Field label="Government ID URL (if legally required)" htmlFor="id_doc_url">
          <Input id="id_doc_url" name="id_doc_url" type="url" defaultValue={dv.id_doc_url} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" placeholder="https://example.com/id.png" />
        </Field>
        <Field label="Social / portfolio links" htmlFor="social_links" hint="Comma or newline separated URLs.">
          <Textarea id="social_links" name="social_links" rows={2} defaultValue={dv.social_links} className="rounded-2xl border-neutral-800 bg-neutral-900/80 p-3 text-xs" placeholder="https://instagram.com/myhandle, https://youtube.com/@mychannel" />
        </Field>
      </div>

      {/* Section 3: Monetization */}
      <div className="relative overflow-hidden rounded-3xl border border-red-500/30 bg-black/80 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_40px_-15px_rgba(239,68,68,0.2)] space-y-6">
        <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
          <h2 className="font-display text-lg font-black uppercase tracking-wide text-foreground flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 text-xs">3</span> Monetization &amp; Pricing
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Field label="Preferred monthly price (USD)" htmlFor="requested_price" hint="Choose a monthly price between $4.99 and $499.99.">
              <Input id="requested_price" name="requested_price" type="number" step="0.01" min={4.99} max={499.99} value={price} onChange={(e) => setPrice(e.target.value)} className="rounded-2xl border-neutral-800 bg-neutral-900/80 h-11 text-xs" />
            </Field>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Presets:</span>
              {["4.99", "9.99", "19.99", "49.99", "99.99"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrice(p)}
                  className={`rounded-xl border px-3 py-1 text-[10px] font-bold transition-all ${
                    price === p ? "border-red-500 bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "border-neutral-800 bg-neutral-900/60 text-muted-foreground hover:border-neutral-700"
                  }`}
                >
                  ${p}/mo
                </button>
              ))}
            </div>
          </div>
        </div>

        <Field label="Payout info (optional note)" htmlFor="payout_info" hint="Do not paste bank details here. Admin will collect them securely on approval.">
          <Textarea id="payout_info" name="payout_info" rows={2} defaultValue={dv.payout_info} className="rounded-2xl border-neutral-800 bg-neutral-900/80 p-3 text-xs" />
        </Field>
      </div>

      {/* Agreement Checkbox */}
      <AttractiveAgreementCheckbox
        name="agreement_accepted"
        checked={agreement}
        onChange={setAgreement}
        theme="red"
      >
        I accept the <strong className="text-red-400">LEER Sports Trainer Agreement</strong>, including the 80/20 revenue split, quality standards, 48-hour coaching SLA, dispute policy, and prohibited-content rules.
      </AttractiveAgreementCheckbox>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3">
        <SkipOnboardingButton fromStep="trainer" />
        <Button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 px-8 py-3 font-black uppercase tracking-wider text-white shadow-[0_0_25px_rgba(239,68,68,0.6)] transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Application…
            </>
          ) : (
            "Submit Pro Application 🚀"
          )}
        </Button>
      </div>
    </form>
  );
}

function PendingApplication({
  application,
  onGoToApplication,
}: {
  application: { status: string; created_at: string; admin_notes: string | null } | null;
  onGoToApplication?: () => void;
}) {
  const router = useRouter();

  if (!application) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-red-500/30 bg-black/90 p-8 sm:p-12 text-center backdrop-blur-2xl shadow-[0_0_60px_-15px_rgba(239,68,68,0.3)] space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-600/10 blur-3xl" />

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-600/20 border border-red-500/40 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
          <ClipboardList className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" /> Application Step Pending
          </span>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl">
            Complete Your Pro Application
          </h1>
          <p className="mx-auto max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
            You haven't submitted your Pro Trainer application for verification yet. Complete Step 2 (Pro Application) to submit your details for admin review.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onGoToApplication && (
            <Button
              onClick={onGoToApplication}
              className="rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_25px_rgba(239,68,68,0.6)] transition-all hover:scale-105"
            >
              Complete Application Step &rarr;
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.navigate({ to: "/dashboard" })}
            className="rounded-2xl border-neutral-800 bg-neutral-900 px-6 py-3 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const rejected = application.status === "rejected";
  const resubmit = application.status === "resubmit";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-red-500/30 bg-black/90 p-8 sm:p-12 text-center backdrop-blur-2xl shadow-[0_0_60px_-15px_rgba(239,68,68,0.3)] space-y-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-600/10 blur-3xl" />

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-600/20 border border-red-500/40 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
        <ClipboardList className="h-8 w-8" />
      </div>

      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-600/10 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-red-400">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Status: {application.status.toUpperCase()}
        </span>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl">
          {rejected ? "Application Declined" : resubmit ? "Resubmission Requested" : "Application Under Review"}
        </h1>
        <p className="mx-auto max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {rejected
            ? "Your trainer application was reviewed but could not be approved at this time."
            : resubmit
              ? "An admin has reviewed your application and requested updates to your details or credentials."
              : "Our staff reviews new pro trainer applications within 24–48 business hours."}
        </p>
      </div>

      {application.admin_notes && (
        <div className="mx-auto max-w-md rounded-2xl border border-red-500/30 bg-neutral-900/90 p-4 text-left text-xs">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Admin Review Feedback</p>
          <p className="mt-1.5 whitespace-pre-wrap text-muted-foreground leading-relaxed">{application.admin_notes}</p>
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-3 pt-2">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-xs font-semibold text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-red-400" />
          <span>Submitted on {new Date(application.created_at).toLocaleDateString()}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
          <Button
            onClick={() => router.navigate({ to: "/dashboard" })}
            className="rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all hover:scale-105"
          >
            Go to Dashboard &rarr;
          </Button>
        </div>
      </div>
    </div>
  );
}
