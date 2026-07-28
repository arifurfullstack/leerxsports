import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Loader2,
  Save,
  Trash2,
  User as UserIcon,
  Settings as SettingsIcon,
  ExternalLink,
  Plus,
  Pencil,
  Share2,
  LayoutGrid,
  Play,
  Heart,
  MessageSquare,
  BadgeCheck,
  Flame,
  MapPin,
  Languages,
  Target,
  Trophy,
  Lock,
  Clapperboard,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useProfileMode } from "@/lib/profile-mode-context";
import { LazyImage } from "@/components/ui/lazy-image";
import { supabase } from "@/integrations/supabase/client";
import { getSettings, updateProfileSettings } from "@/lib/settings-functions";
import { getFollowCounts } from "@/lib/trainer-functions";
import { getTraineePosts } from "@/lib/transformation-functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarCropperDialog, AVATAR_SIZES, type CroppedVariants } from "@/components/avatar-cropper-dialog";
import { validateAvatarFile, AVATAR_ACCEPT_ATTR } from "@/lib/avatar-validation";
import { CreatePostDialog } from "@/components/create-post-dialog";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { VerifiedBadge } from "@/components/verified-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — LEER" },
      { name: "description", content: "Your LEER profile, posts, reels, and athlete journey." },
      { property: "og:title", content: "My Profile — LEER" },
      { property: "og:description", content: "Your LEER profile, posts, reels, and athlete journey." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const AVATAR_SIGNED_TTL = 60 * 60 * 24 * 365 * 5; // ~5 years

function ProfilePage() {
  const { mode, switchMode } = useProfileMode();
  const qc = useQueryClient();
  const getFn = useServerFn(getSettings);
  const saveFn = useServerFn(updateProfileSettings);
  const fetchCounts = useServerFn(getFollowCounts);
  const fetchPosts = useServerFn(getTraineePosts);
  const fileRef = useRef<HTMLInputElement>(null);

  const s = useQuery({ queryKey: ["settings"], queryFn: () => getFn() });
  const profile = s.data?.profile;
  const userId = profile?.user_id;

  const [form, setForm] = useState({
    display_name: "",
    username: "",
    bio: "",
    country: "",
    native_language: "",
    preferred_language: "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "shorts">("posts");

  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name ?? "",
      username: profile.username ?? "",
      bio: profile.bio ?? "",
      country: profile.country ?? "",
      native_language: profile.native_language ?? "",
      preferred_language: profile.preferred_language ?? "",
    });
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  // Fetch follow counts
  const countsQ = useQuery({
    queryKey: ["follow-counts", userId],
    queryFn: () => fetchCounts({ data: { userId: userId! } }),
    enabled: !!userId,
  });

  // Fetch posts
  const postsQ = useQuery({
    queryKey: ["trainee-posts", userId],
    queryFn: () => fetchPosts({ data: { userId: userId! } }),
    enabled: !!userId,
  });

  const saveMut = useMutation({
    mutationFn: async () =>
      saveFn({
        data: {
          display_name: form.display_name || undefined,
          username: form.username || undefined,
          bio: form.bio || null,
          country: form.country || null,
          native_language: form.native_language || null,
          preferred_language: form.preferred_language || null,
        },
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      setEditProfileOpen(false);
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["navbar-user"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function persistAvatarUrls(urls: { sm: string; md: string; lg: string } | null) {
    await saveFn({
      data: {
        avatar_url: urls?.lg ?? null,
        avatar_urls: urls,
      },
    });
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["navbar-user"] });
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await validateAvatarFile(file);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPendingFile(file);
  }

  async function uploadCroppedBlob(
    variants: CroppedVariants,
    onProgress: (pct: number, phase: "cropping" | "uploading" | "finalizing") => void,
  ) {
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const stamp = Date.now();

      const items = AVATAR_SIZES.map((s) => ({
        key: s.key,
        blob: variants[s.key],
        path: `${user.id}/avatar-${stamp}-${s.px}.jpg`,
      }));
      const totalBytes = items.reduce((sum, it) => sum + it.blob.size, 0) || 1;
      const loaded: Record<string, number> = { sm: 0, md: 0, lg: 0 };

      const uploads = await Promise.all(
        items.map(async (it) => {
          const { data: signedUp, error: signErr } = await supabase.storage
            .from("avatars")
            .createSignedUploadUrl(it.path, { upsert: true });
          if (signErr || !signedUp?.signedUrl)
            throw signErr ?? new Error("Could not start upload");
          await putWithProgress(signedUp.signedUrl, it.blob, "image/jpeg", (bytes) => {
            loaded[it.key] = bytes;
            const total = loaded.sm + loaded.md + loaded.lg;
            onProgress((total / totalBytes) * 100, "uploading");
          });
          return it;
        }),
      );

      onProgress(100, "finalizing");
      const signedUrls = await Promise.all(
        uploads.map(async (it) => {
          const { data, error } = await supabase.storage
            .from("avatars")
            .createSignedUrl(it.path, AVATAR_SIGNED_TTL);
          if (error || !data?.signedUrl) throw error ?? new Error("Failed to sign URL");
          return { key: it.key, url: data.signedUrl };
        }),
      );
      const urls = signedUrls.reduce(
        (acc, cur) => ({ ...acc, [cur.key]: cur.url }),
        {} as { sm: string; md: string; lg: string },
      );

      setAvatarUrl(urls.lg);
      await persistAvatarUrls(urls);
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      throw err;
    } finally {
      setUploading(false);
    }
  }

  function putWithProgress(
    url: string,
    body: Blob,
    contentType: string,
    onProgress: (bytesLoaded: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.setRequestHeader("x-upsert", "true");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.onabort = () => reject(new Error("Upload aborted"));
      xhr.send(body);
    });
  }

  async function removeAvatar() {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: files } = await supabase.storage.from("avatars").list(user.id);
        if (files && files.length) {
          await supabase.storage
            .from("avatars")
            .remove(files.map((f) => `${user.id}/${f.name}`));
        }
      }
      setAvatarUrl(null);
      await persistAvatarUrls(null);
      toast.success("Profile picture removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setUploading(false);
      setConfirmRemove(false);
    }
  }

  const handleShare = async () => {
    const handle = profile?.username;
    if (!handle) return;
    const url = `${window.location.origin}/u/${handle}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${profile.display_name ?? handle} — LEER`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied to clipboard");
      }
    } catch {
      /* user cancelled */
    }
  };

  const initials = (form.display_name || form.username || "?")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";

  const allPosts = postsQ.data ?? [];
  const feedPosts = allPosts.filter((p) => p.kind !== "short");
  const shortPosts = allPosts.filter((p) => p.kind === "short");

  const displayedPosts = activeTab === "shorts" ? shortPosts : allPosts;

  return (
    <main className="min-h-dvh bg-background pb-16">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Instagram Profile Header */}
        <header className="mb-8 border-b border-hairline pb-8 sm:mb-12 sm:pb-12">
          {/* Desktop & Tablet Layout (sm+) */}
          <div className="hidden sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-12 sm:items-start">
            {/* Avatar container with dynamic gradient ring */}
            <div className="relative group shrink-0">
              <div className="relative p-1 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-xl">
                <Avatar className="h-36 w-36 border-4 border-background bg-muted">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt="Your profile picture" /> : null}
                  <AvatarFallback className="bg-foreground text-3xl font-semibold text-background">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Change profile picture"
                className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg transition hover:scale-110 disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
            </div>

            {/* Profile Info */}
            <div className="space-y-5">
              {/* Row 1: Username & Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl text-foreground">
                    {profile?.username ? `@${profile.username}` : "Profile"}
                  </h1>
                  {(profile as any)?.is_verified && <VerifiedBadge size="lg" />}
                </div>

                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  {/* Profile Mode Switcher Toolbar Button */}
                  <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
                    <button
                      type="button"
                      onClick={() => switchMode("normal")}
                      className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                        mode === "normal"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <UserIcon className="h-3.5 w-3.5" /> Athlete
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("creator")}
                      className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                        mode === "creator"
                          ? "bg-amber-500 text-black font-bold shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Creator
                    </button>
                  </div>

                  <Button
                    onClick={() => setCreatePostOpen(true)}
                    size="sm"
                    className="gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                  >
                    <Plus className="h-4 w-4" /> New Post
                  </Button>
                  <Button
                    onClick={() => setEditProfileOpen(true)}
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 font-semibold"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit Profile
                  </Button>
                  <Button
                    onClick={handleShare}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 font-semibold"
                  >
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </Button>
                  <Button asChild variant="ghost" size="icon" title="Settings">
                    <Link to="/settings">
                      <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Row 2: Instagram Stats Row */}
              <div className="flex items-center gap-8 border-y border-hairline/60 py-3 text-sm sm:text-base">
                <div>
                  <span className="font-bold text-foreground tabular-nums">{allPosts.length}</span>{" "}
                  <span className="text-muted-foreground">posts</span>
                </div>
                <div>
                  <span className="font-bold text-foreground tabular-nums">{countsQ.data?.followers ?? 0}</span>{" "}
                  <span className="text-muted-foreground">followers</span>
                </div>
                <div>
                  <span className="font-bold text-foreground tabular-nums">{countsQ.data?.following ?? 0}</span>{" "}
                  <span className="text-muted-foreground">following</span>
                </div>
              </div>

              {/* Row 3: Display Name & Bio */}
              <div>
                <h2 className="font-semibold text-foreground text-base">
                  {form.display_name || form.username || "Unnamed Athlete"}
                </h2>
                {form.bio && (
                  <p className="mt-1 whitespace-pre-line text-sm text-foreground/90 leading-relaxed">
                    {form.bio}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {form.country && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 text-primary" /> {form.country}
                    </span>
                  )}
                  {form.native_language && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
                      <Languages className="h-3 w-3 text-primary" /> {form.native_language}
                    </span>
                  )}
                  {profile?.username && (
                    <Link
                      to="/u/$username"
                      params={{ username: profile.username }}
                      className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> View public link
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Layout (<sm) */}
          <div className="space-y-4 sm:hidden">
            {/* Top row: Avatar & Stats */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
                  <Avatar className="h-20 w-20 border-2 border-background">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt="Your profile picture" /> : null}
                    <AvatarFallback className="bg-foreground text-xl font-semibold text-background">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label="Change profile picture"
                  className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border border-background bg-primary text-primary-foreground shadow"
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                </button>
              </div>

              <div className="grid flex-1 grid-cols-3 text-center">
                <div>
                  <p className="font-bold text-foreground text-lg tabular-nums">{allPosts.length}</p>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Posts</p>
                </div>
                <div>
                  <p className="font-bold text-foreground text-lg tabular-nums">{countsQ.data?.followers ?? 0}</p>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Followers</p>
                </div>
                <div>
                  <p className="font-bold text-foreground text-lg tabular-nums">{countsQ.data?.following ?? 0}</p>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Following</p>
                </div>
              </div>
            </div>

            {/* Name & Bio */}
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-foreground text-base">
                  {form.display_name || form.username || "Unnamed Athlete"}
                </h1>
                {(profile as any)?.is_verified && <VerifiedBadge size="sm" />}
              </div>
              {form.username && <p className="text-xs text-muted-foreground">@{form.username}</p>}
              {form.bio && <p className="mt-1 text-xs whitespace-pre-line text-foreground/90">{form.bio}</p>}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                onClick={() => setCreatePostOpen(true)}
                size="sm"
                className="gap-1 font-semibold bg-primary text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> New Post
              </Button>
              <Button
                onClick={() => setEditProfileOpen(true)}
                variant="secondary"
                size="sm"
                className="gap-1 font-semibold"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Profile
              </Button>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={AVATAR_ACCEPT_ATTR}
            className="hidden"
            onChange={handleFilePick}
          />
        </header>

        {/* Instagram Filter Tabs */}
        <section>
          <div className="mb-6 flex justify-center border-t border-hairline">
            <div className="-mt-px flex gap-8">
              <button
                type="button"
                onClick={() => setActiveTab("posts")}
                className={`flex items-center gap-2 border-t-2 py-3 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  activeTab === "posts"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-4 w-4" /> Posts ({allPosts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("shorts")}
                className={`flex items-center gap-2 border-t-2 py-3 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  activeTab === "shorts"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clapperboard className="h-4 w-4" /> Shorts ({shortPosts.length})
              </button>
            </div>
          </div>

          {/* Posts Grid */}
          {postsQ.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : displayedPosts.length === 0 ? (
            <div className="mx-auto my-12 max-w-sm rounded-2xl border border-dashed border-border p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Camera className="h-7 w-7" />
              </div>
              <h3 className="font-display text-lg font-bold uppercase tracking-tight">No Posts Yet</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeTab === "shorts"
                  ? "You haven't posted any shorts or video clips yet."
                  : "Share photos and videos to document your journey and connect with fans."}
              </p>
              <Button
                onClick={() => setCreatePostOpen(true)}
                className="mt-5 gap-1.5 font-semibold"
                size="sm"
              >
                <Plus className="h-4 w-4" /> Create your first post
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 sm:gap-3">
              {displayedPosts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setSelectedPostId(post.id)}
                  className="group relative aspect-square overflow-hidden rounded-md border border-border/30 bg-muted text-left focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <LazyImage
                    src={post.thumbnail_url || post.media_url}
                    alt={post.caption || "User post"}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {post.kind === "short" && (
                    <span className="absolute right-2 top-2 rounded-md bg-black/75 p-1 text-white backdrop-blur-sm shadow">
                      <Play className="h-3.5 w-3.5 fill-current" />
                    </span>
                  )}
                  {post.is_premium && (
                    <span className="absolute left-2 top-2 rounded-md bg-amber-500/90 p-1 text-black shadow">
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {/* Instagram-style Hover Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center gap-6 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <Heart className="h-5 w-5 fill-white" /> {post.respect_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <MessageSquare className="h-5 w-5 fill-white" /> {post.comment_count ?? 0}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your public handle, display name, and bio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="edit_display_name">Display name</Label>
              <Input
                id="edit_display_name"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Your public name"
              />
            </div>
            <div>
              <Label htmlFor="edit_username">Username handle</Label>
              <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                <span className="pl-3 text-sm text-muted-foreground">@</span>
                <Input
                  id="edit_username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                  placeholder="handle"
                  className="border-0 focus-visible:ring-0"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit_bio">Bio</Label>
              <Textarea
                id="edit_bio"
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell fans about yourself…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit_country">Country</Label>
                <Input
                  id="edit_country"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder="e.g. USA"
                />
              </div>
              <div>
                <Label htmlFor="edit_native_lang">Language</Label>
                <Input
                  id="edit_native_lang"
                  value={form.native_language}
                  onChange={(e) => setForm({ ...form, native_language: e.target.value })}
                  placeholder="e.g. English"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setEditProfileOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avatar Cropper Dialog */}
      <AvatarCropperDialog
        open={!!pendingFile}
        file={pendingFile}
        onClose={() => setPendingFile(null)}
        onCropped={uploadCroppedBlob}
      />

      {/* Remove Avatar Dialog */}
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove profile picture?</AlertDialogTitle>
            <AlertDialogDescription>
              Your avatar will be deleted and replaced with your initials across LEER.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={uploading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeAvatar} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Post Dialog */}
      <CreatePostDialog
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
      />

      {/* Selected Post Detail Modal */}
      {selectedPostId && (() => {
        const sel = allPosts.find((p) => p.id === selectedPostId);
        if (!sel) return null;
        const formattedPost = {
          ...sel,
          trainer: {
            id: userId,
            display_name: form.display_name || form.username,
            username: form.username,
            avatar_url: avatarUrl,
            is_verified: (profile as any)?.is_verified ?? false,
          },
        };
        return (
          <PostDetailDialog
            post={formattedPost as any}
            currentUserId={userId ?? null}
            isSignedIn={!!userId}
            open={!!selectedPostId}
            onOpenChange={(open) => !open && setSelectedPostId(null)}
          />
        );
      })()}
    </main>
  );
}