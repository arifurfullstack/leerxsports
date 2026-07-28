import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Guest browse mode: cheap client-side auth check + a global "prompt to
 * sign in" dialog. Interactions (like, save, follow, comment, tip, DM,
 * subscribe) call `requireAuth(intent)`; unauthenticated callers get the
 * dialog and the underlying mutation is skipped.
 */

export type AuthGateIntent = {
  title?: string;
  action?: string; // e.g. "like this post"
  description?: string;
};

type Listener = () => void;

let isAuthed: boolean | null = null;
let dialogOpen = false;
let currentIntent: AuthGateIntent | null = null;
let redirectPath: string | null = null;

const listeners = new Set<Listener>();
function emit() {
  for (const l of listeners) l();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function initAuthGate() {
  if (typeof window === "undefined") return () => {};
  supabase.auth.getSession().then(({ data }) => {
    isAuthed = !!data.session;
    emit();
  });
  const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
    isAuthed = !!session;
    if (isAuthed && dialogOpen) {
      dialogOpen = false;
      currentIntent = null;
    }
    emit();
  });
  return () => sub.subscription.unsubscribe();
}

function getSnapshot() {
  // Encode all reactive state in a single string so useSyncExternalStore
  // does not tear.
  return `${isAuthed}|${dialogOpen}|${currentIntent?.action ?? ""}`;
}

function getServerSnapshot() {
  return "null|false|";
}

export function useAuthGateState() {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    isAuthed,
    dialogOpen,
    intent: currentIntent,
    redirectPath: redirectPath ?? "/",
  };
}

export function openAuthGate(intent?: AuthGateIntent) {
  if (typeof window !== "undefined") {
    redirectPath = window.location.pathname + window.location.search;
  }
  currentIntent = intent ?? null;
  dialogOpen = true;
  emit();
}

export function closeAuthGate() {
  dialogOpen = false;
  currentIntent = null;
  emit();
}

/**
 * Guard a would-be interactive action. Returns true when the viewer is
 * signed in and the caller should proceed; returns false (and opens the
 * sign-in dialog) otherwise. If auth state has not resolved yet, treat
 * as authed to avoid blocking real users on first paint — the server
 * still enforces auth on the mutation.
 */
export function requireAuthNow(intent?: AuthGateIntent): boolean {
  if (isAuthed === false) {
    openAuthGate(intent);
    return false;
  }
  return true;
}

export function useAuthGate() {
  const { isAuthed } = useAuthGateState();
  return {
    isAuthed: isAuthed === true,
    isResolved: isAuthed !== null,
    requireAuth: (intent?: AuthGateIntent) => requireAuthNow(intent),
  };
}