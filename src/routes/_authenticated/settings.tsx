import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, Download, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  getSettings,
  updateProfileSettings,
  deleteAccount,
  exportMyData,
} from "@/lib/settings-functions";
import { listBlocks, unblockUser, setDmsEnabled } from "@/lib/dm-functions";
import { toast } from "sonner";
import { ConnectedProviders } from "@/components/settings/connected-providers";
import { MfaSetup } from "@/components/settings/mfa-setup";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — LEER Sports" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getSettings);
  const saveFn = useServerFn(updateProfileSettings);
  const delFn = useServerFn(deleteAccount);
  const exportFn = useServerFn(exportMyData);
  const blocksFn = useServerFn(listBlocks);
  const unblockFn = useServerFn(unblockUser);
  const dmToggleFn = useServerFn(setDmsEnabled);

  const s = useQuery({ queryKey: ["settings"], queryFn: () => getFn() });
  const blocks = useQuery({ queryKey: ["blocks"], queryFn: () => blocksFn() });

  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    country: "",
    native_language: "",
    preferred_language: "",
    profile_visibility: "public" as "public" | "subscribers" | "private",
    transformation_visibility: "public" as "public" | "subscribers" | "private",
  });
  const [dmsEnabled, setDmsEnabledState] = useState(true);
  const [pw, setPw] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");

  useEffect(() => {
    if (s.data?.profile) {
      const p = s.data.profile as any;
      setForm({
        display_name: p.display_name ?? "",
        bio: p.bio ?? "",
        country: p.country ?? "",
        native_language: p.native_language ?? "",
        preferred_language: p.preferred_language ?? "",
        profile_visibility: p.profile_visibility ?? "public",
        transformation_visibility: p.transformation_visibility ?? "public",
      });
    }
    if (s.data?.trainer) setDmsEnabledState(s.data.trainer.dms_enabled);
  }, [s.data]);

  const saveMut = useMutation({
    mutationFn: async () => saveFn({ data: form }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const passwordMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password updated");
      setPw("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dmsMut = useMutation({
    mutationFn: async (v: boolean) => dmToggleFn({ data: { enabled: v } }),
    onSuccess: () => toast.success("DM preference saved"),
    onError: (e: Error) => toast.error(e.message),
  });

  const unblockMut = useMutation({
    mutationFn: async (userId: string) => unblockFn({ data: { userId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocks"] }),
  });

  const exportMut = useMutation({
    mutationFn: async () => exportFn(),
    onSuccess: (r) => {
      const blob = new Blob([r.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leer-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => delFn({ data: { confirmation: "DELETE" } }),
    onSuccess: async () => {
      await supabase.auth.signOut();
      window.location.href = "/";
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl">Settings</h1>
      <p className="text-sm text-muted-foreground">Manage your account, privacy, and preferences.</p>

      <Tabs defaultValue="profile" className="mt-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="blocks">Blocks</TabsTrigger>
          <TabsTrigger value="danger">Danger</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card className="space-y-4 p-5">
            <div>
              <Label>Display name</Label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <div>
                <Label>Native language</Label>
                <Input value={form.native_language} onChange={(e) => setForm({ ...form, native_language: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Preferred display language</Label>
              <Input
                value={form.preferred_language}
                onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}
                placeholder="e.g. en, es, fr"
              />
              <p className="mt-1 text-xs text-muted-foreground">Used as the default target for "See translation".</p>
            </div>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save profile
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <Card className="space-y-4 p-5">
            <div>
              <Label>Profile visibility</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                value={form.profile_visibility}
                onChange={(e) => setForm({ ...form, profile_visibility: e.target.value as any })}
              >
                <option value="public">Public</option>
                <option value="subscribers">Subscribers only</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div>
              <Label>Transformation visibility</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                value={form.transformation_visibility}
                onChange={(e) => setForm({ ...form, transformation_visibility: e.target.value as any })}
              >
                <option value="public">Public</option>
                <option value="subscribers">Subscribers only</option>
                <option value="private">Private</option>
              </select>
            </div>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Save privacy</Button>
          </Card>

          {s.data?.trainer && (
            <Card className="flex items-center justify-between p-5">
              <div>
                <div className="font-medium">Allow direct messages from subscribers</div>
                <p className="text-xs text-muted-foreground">Trainees you don't have an active subscription with cannot DM you.</p>
              </div>
              <Switch
                checked={dmsEnabled}
                onCheckedChange={(v) => {
                  setDmsEnabledState(v);
                  dmsMut.mutate(v);
                }}
              />
            </Card>
          )}

          <Card className="p-5">
            <div className="mb-2 font-medium">Notifications</div>
            <p className="mb-3 text-xs text-muted-foreground">Manage per-event delivery preferences.</p>
            <Link to="/notifications"><Button variant="outline">Open notification preferences</Button></Link>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="font-medium">Change password</div>
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="New password (min. 6 characters)"
            />
            <Button onClick={() => passwordMut.mutate()} disabled={passwordMut.isPending || pw.length < 6}>
              Update password
            </Button>
          </Card>

          <Card className="p-5">
            <div className="mb-2 font-medium">Export my data</div>
            <p className="mb-3 text-xs text-muted-foreground">Downloads a JSON archive of your content.</p>
            <Button variant="outline" onClick={() => exportMut.mutate()} disabled={exportMut.isPending}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <MfaSetup />
          <ConnectedProviders />
        </TabsContent>

        <TabsContent value="blocks" className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 font-medium">Blocked users</div>
            {blocks.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !blocks.data || blocks.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven't blocked anyone.</p>
            ) : (
              <ul className="divide-y divide-border">
                {blocks.data.map((b) => (
                  <li key={b.blocked_id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      {b.avatar_url ? (
                        <img src={b.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted" />
                      )}
                      <div>
                        <div className="text-sm font-medium">{b.display_name ?? b.username}</div>
                        <div className="text-xs text-muted-foreground">Blocked {new Date(b.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => unblockMut.mutate(b.blocked_id)}>
                      <Ban className="mr-2 h-3.5 w-3.5" /> Unblock
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="danger" className="space-y-4">
          <Card className="border-destructive p-5">
            <div className="mb-2 font-medium text-destructive">Delete account</div>
            <p className="mb-3 text-xs text-muted-foreground">
              Permanently deletes your account and all your content. This cannot be undone. Type <code>DELETE</code> to confirm.
            </p>
            <Input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder="Type DELETE" className="mb-3" />
            <Button
              variant="destructive"
              disabled={confirmDelete !== "DELETE" || deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete my account
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}