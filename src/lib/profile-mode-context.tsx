import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type ProfileMode = "normal" | "creator";

type ProfileModeContextType = {
  mode: ProfileMode;
  isCreator: boolean;
  isLoadingCreatorStatus: boolean;
  switchMode: (newMode: ProfileMode) => Promise<{ success: boolean; requiresOnboarding?: boolean }>;
  becomeCreatorOpen: boolean;
  setBecomeCreatorOpen: (open: boolean) => void;
};

const ProfileModeContext = createContext<ProfileModeContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "leer_profile_mode";

export function ProfileModeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [mode, setMode] = useState<ProfileMode>("normal");
  const [becomeCreatorOpen, setBecomeCreatorOpen] = useState(false);

  // Check creator status (has_role trainer or approved trainer_profile row)
  const creatorQ = useQuery({
    queryKey: ["user-creator-status"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isCreator: false, userId: null };

      const { data: hasTrainerRole } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "trainer",
      });

      const { data: trainerRow } = await supabase
        .from("trainer_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const isCreator = Boolean(hasTrainerRole || trainerRow);
      return { isCreator, userId: user.id };
    },
    staleTime: 60_000,
  });

  const isCreator = creatorQ.data?.isCreator ?? false;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY) as ProfileMode | null;
      if (saved === "creator" || saved === "normal") {
        setMode(saved);
      }
    } catch {
      /* fallback to normal */
    }
  }, []);

  const switchMode = async (targetMode: ProfileMode): Promise<{ success: boolean; requiresOnboarding?: boolean }> => {
    if (targetMode === mode) return { success: true };

    setMode(targetMode);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, targetMode);
    } catch {
      /* ignore */
    }

    if (targetMode === "creator") {
      if (isCreator) {
        toast.success("Switched to Trainer Studio ⚡");
        router.navigate({ to: "/creator/dashboard" });
      } else {
        toast.success("Switched to Trainer Mode — complete your application ⚡");
        router.navigate({ to: "/onboarding", search: { resume: true, source: "mode_switcher" } });
      }
    } else {
      toast.success("Switched to Trainee Profile 🏃");
      router.navigate({ to: "/dashboard" });
    }

    return { success: true };
  };

  return (
    <ProfileModeContext.Provider
      value={{
        mode,
        isCreator,
        isLoadingCreatorStatus: creatorQ.isLoading,
        switchMode,
        becomeCreatorOpen,
        setBecomeCreatorOpen,
      }}
    >
      {children}
    </ProfileModeContext.Provider>
  );
}

export function useProfileMode() {
  const ctx = useContext(ProfileModeContext);
  if (!ctx) {
    throw new Error("useProfileMode must be used within a ProfileModeProvider");
  }
  return ctx;
}