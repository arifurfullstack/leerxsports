import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    intent: typeof search.intent === "string" ? search.intent : "",
    redirect: typeof search.redirect === "string" ? search.redirect : "",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — leersports" },
      { name: "description", content: "Sign in or create a free leersports account to book sports classes." },
      { property: "og:title", content: "Sign in — leersports" },
      { property: "og:description", content: "Sign in or create a free leersports account to book sports classes." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { intent, redirect } = Route.useSearch();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <AuthForm intent={intent} redirect={redirect} />
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to="/admin">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Go to admin panel
          </Link>
        </Button>
      </div>
    </main>
  );
}
