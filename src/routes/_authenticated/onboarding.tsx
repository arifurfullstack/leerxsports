import { createFileRoute, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Dumbbell, ShieldCheck, ArrowRight, CheckCircle2, ClipboardList } from "lucide-react";

import { getOnboardingState, completeTraineeOnboarding, submitTrainerApplication } from "@/lib/onboarding-functions";
import { traineeOnboardingSchema, trainerApplicationSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const onboardingQuery = queryOptions({
  queryKey: ["onboarding-state"],
  queryFn: () => getOnboardingState(),
});

export const Route = createFileRoute("/_authenticated/onboarding")({
  loader: ({ context }) => context.queryClient.ensureQueryData(onboardingQuery),
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

function OnboardingPage() {
  const router = useRouter();
  const { data: state } = useSuspenseQuery(onboardingQuery);

  const initialStep: Step = state.trainerApplication
    ? "pending"
    : state.onboardingCompleted
      ? "role" // shouldn't happen (should be redirected), but safe default
      : "role";
  const [step, setStep] = useState<Step>(initialStep);

  if (state.onboardingCompleted && !state.trainerApplication) {
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

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {step === "role" && <RoleStep onPick={setStep} />}
        {step === "trainee" && <TraineeForm onBack={() => setStep("role")} />}
        {step === "trainer" && <TrainerForm onBack={() => setStep("role")} onSubmitted={() => setStep("pending")} />}
        {step === "pending" && <PendingApplication application={state.trainerApplication} />}
      </div>
    </div>
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

function TraineeForm({ onBack }: { onBack: () => void }) {
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
      toast.error(err instanceof Error ? err.message : "Something went wrong");
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
            <Input id="username" name="username" required autoComplete="off" />
          </Field>
          <Field label="Display name" htmlFor="display_name">
            <Input id="display_name" name="display_name" required />
          </Field>
          <Field label="Country" htmlFor="country">
            <Input id="country" name="country" required placeholder="e.g. Canada" />
          </Field>
          <Field label="Native language" htmlFor="native_language">
            <Input id="native_language" name="native_language" required placeholder="e.g. English" />
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

function TrainerForm({ onBack, onSubmitted }: { onBack: () => void; onSubmitted: () => void }) {
  const submit = useServerFn(submitTrainerApplication);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const raw = {
        username: String(fd.get("username") ?? ""),
        display_name: String(fd.get("display_name") ?? ""),
        full_legal_name: String(fd.get("full_legal_name") ?? ""),
        public_trainer_name: String(fd.get("public_trainer_name") ?? ""),
        country: String(fd.get("country") ?? ""),
        native_language: String(fd.get("native_language") ?? ""),
        additional_languages: String(fd.get("additional_languages") ?? "")
          .split(",").map((s) => s.trim()).filter(Boolean),
        specialties: String(fd.get("specialties") ?? "")
          .split(",").map((s) => s.trim()).filter(Boolean),
        years_experience: Number(fd.get("years_experience") ?? 0),
        biography: String(fd.get("biography") ?? ""),
        certification_details: String(fd.get("certification_details") ?? ""),
        certificates: String(fd.get("certificates") ?? "")
          .split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
        id_doc_url: String(fd.get("id_doc_url") ?? ""),
        social_links: String(fd.get("social_links") ?? "")
          .split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
        requested_price: Number(fd.get("requested_price") ?? 9.99),
        payout_info: String(fd.get("payout_info") ?? "") || undefined,
        agreement_accepted: fd.get("agreement_accepted") === "on" ? true : false,
      };
      const parsed = trainerApplicationSchema.parse(raw);
      await submit({ data: parsed });
      toast.success("Application submitted — under review");
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
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
          <Field label="Full legal name" htmlFor="full_legal_name"><Input id="full_legal_name" name="full_legal_name" required /></Field>
          <Field label="Public trainer name" htmlFor="public_trainer_name"><Input id="public_trainer_name" name="public_trainer_name" required /></Field>
          <Field label="Username" htmlFor="username" hint="Lowercase letters, numbers, underscores.">
            <Input id="username" name="username" required autoComplete="off" />
          </Field>
          <Field label="Display name" htmlFor="display_name"><Input id="display_name" name="display_name" required /></Field>
          <Field label="Country" htmlFor="country"><Input id="country" name="country" required /></Field>
          <Field label="Native language" htmlFor="native_language"><Input id="native_language" name="native_language" required /></Field>
          <Field label="Additional languages" htmlFor="additional_languages" hint="Comma separated.">
            <Input id="additional_languages" name="additional_languages" />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display text-lg uppercase tracking-wide">Professional profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Specialties" htmlFor="specialties" hint="Comma separated. e.g. Hypertrophy, Powerlifting, Mobility">
            <Input id="specialties" name="specialties" required />
          </Field>
          <Field label="Years of experience" htmlFor="years_experience">
            <Input id="years_experience" name="years_experience" type="number" min={0} max={70} required />
          </Field>
        </div>
        <Field label="Biography" htmlFor="biography" hint="Minimum 20 characters.">
          <Textarea id="biography" name="biography" rows={4} required />
        </Field>
        <Field label="Certification details" htmlFor="certification_details" hint="Bodies issuing your certs, IDs, dates.">
          <Textarea id="certification_details" name="certification_details" rows={3} required />
        </Field>
        <Field label="Certificate URLs" htmlFor="certificates" hint="Public links to scanned certificates. Comma or newline separated.">
          <Textarea id="certificates" name="certificates" rows={2} />
        </Field>
        <Field label="Government ID URL (if legally required)" htmlFor="id_doc_url">
          <Input id="id_doc_url" name="id_doc_url" type="url" />
        </Field>
        <Field label="Social / portfolio links" htmlFor="social_links" hint="Comma or newline separated URLs.">
          <Textarea id="social_links" name="social_links" rows={2} />
        </Field>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display text-lg uppercase tracking-wide">Monetization</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred monthly price (USD)" htmlFor="requested_price" hint="Between $9.99 and $49.99.">
            <Input id="requested_price" name="requested_price" type="number" step="0.01" min={9.99} max={49.99} defaultValue={19.99} required />
          </Field>
        </div>
        <Field label="Payout info (optional note)" htmlFor="payout_info" hint="Do not paste bank details here. Admin will collect them securely on approval.">
          <Textarea id="payout_info" name="payout_info" rows={2} />
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
        <Button type="submit" disabled={busy} className="min-w-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit application"}
        </Button>
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
