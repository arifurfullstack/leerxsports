import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const LS_KEY = "leer:sidebar-collapsed";

function readLocal(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLocal(v: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, v ? "1" : "0");
  } catch {}
}

/**
 * Persist sidebar collapsed state across reloads (localStorage) and devices
 * (profiles.sidebar_collapsed). Server value wins on first hydrate; subsequent
 * toggles write to both.
 */
export function useSidebarCollapsed(): [boolean, (next: boolean) => void, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => readLocal());

  // Hydrate from server + subscribe to cross-tab changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid || cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("sidebar_collapsed")
        .eq("user_id", uid)
        .maybeSingle();
      if (cancelled) return;
      if (data && typeof data.sidebar_collapsed === "boolean") {
        setCollapsed(data.sidebar_collapsed);
        writeLocal(data.sidebar_collapsed);
      }
    })();

    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY && e.newValue != null) setCollapsed(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const set = useCallback((next: boolean) => {
    setCollapsed(next);
    writeLocal(next);
    void (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;
      await supabase.from("profiles").update({ sidebar_collapsed: next }).eq("user_id", uid);
    })();
  }, []);

  const toggle = useCallback(() => set(!collapsed), [collapsed, set]);

  return [collapsed, set, toggle];
}