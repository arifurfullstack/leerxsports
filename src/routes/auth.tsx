import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

const authSearchSchema = z.object({
  intent: z.string().optional(),
  redirect: z.string().optional(),
  mode: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: zodValidator(authSearchSchema),
  beforeLoad: ({ search }) => {
    if (search.intent === "admin") {
      throw redirect({
        to: "/admin/login" as any,
        search: {
          redirect: search.redirect || "/admin",
        } as any,
      });
    }

    if (search.mode === "signup" || search.intent === "signup" || search.intent === "register") {
      throw redirect({
        to: "/signup" as any,
        search: {
          redirect: search.redirect,
        } as any,
      });
    }

    throw redirect({
      to: "/login" as any,
      search: {
        redirect: search.redirect,
      } as any,
    });
  },
  component: () => null,
});
