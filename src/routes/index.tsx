import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Hero } from "@/components/hero";
import { HomeSections } from "@/components/home-sections";
import { RedirectIfAuthed } from "@/components/redirect-if-authed";

const indexSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: zodValidator(indexSearchSchema),
  head: () => ({
    meta: [
      { title: "LEER Sports — Elite Fitness Training & Creator Platform" },
      { name: "description", content: "Train with world-class coaches across martial arts, strength, endurance, and sport-specific performance." },
      { property: "og:title", content: "LEER Sports — Elite Fitness Training & Creator Platform" },
      { property: "og:description", content: "Train with world-class coaches across martial arts, strength, endurance, and sport-specific performance." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const search = Route.useSearch();

  return (
    <main id="main-content" className="relative min-h-dvh bg-background text-foreground selection:bg-sport selection:text-black">
      {!search?.redirect && <RedirectIfAuthed />}
      <Hero />
      <HomeSections />
    </main>
  );
}
