import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, BadgeCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { RolesEditor, type RolesValidation } from "@/components/admin/roles-editor";
import {
  adminUpdateUser,
  adminDeleteUser,
  type UserRow,
} from "@/lib/admin-roles-functions";

export function EditUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(adminUpdateUser);
  const deleteFn = useServerFn(adminDeleteUser);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [originalRoles, setOriginalRoles] = useState<string[]>([]);
  const [rolesValidation, setRolesValidation] = useState<RolesValidation | null>(null);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    setPassword("");
    setUsername(user.username ?? "");
    setDisplayName(user.display_name ?? "");
    setAvatarUrl(user.avatar_url ?? "");
    setIsDemo(user.is_demo);
    setIsVerified(!!user.is_verified);
    const initial = user.roles.length ? user.roles : ["trainee"];
    setRoles(initial);
    setOriginalRoles(initial);
  }, [user]);

  const fieldErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errs.email = "Invalid email address.";
    if (username && !/^[a-zA-Z0-9_.]{2,30}$/.test(username))
      errs.username = "2–30 chars: letters, numbers, _ or .";
    if (password && password.length > 0 && password.length < 8)
      errs.password = "Password must be at least 8 characters.";
    if (avatarUrl && !/^https?:\/\//i.test(avatarUrl))
      errs.avatarUrl = "Must start with http:// or https://";
    return errs;
  }, [email, username, password, avatarUrl]);

  const rolesDirty =
    (rolesValidation?.added.length ?? 0) > 0 ||
    (rolesValidation?.removed.length ?? 0) > 0;
  const canSave =
    Object.keys(fieldErrors).length === 0 && (rolesValidation?.valid ?? true);

  const update = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          userId: user!.user_id,
          email: email || null,
          password: password || null,
          username: username || null,
          displayName: displayName || null,
          avatarUrl: avatarUrl || null,
          isDemo,
          isVerified,
          roles,
        },
      }),
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { userId: user!.user_id } }),
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update account credentials, profile, and roles.
          </DialogDescription>
        </DialogHeader>

        {user && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="eu-username">Username</Label>
                <Input
                  id="eu-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eu-display">Display name</Label>
                <Input
                  id="eu-display"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="eu-email">Email</Label>
              <Input
                id="eu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!fieldErrors.email}
              />
              {fieldErrors.email && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /> {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="eu-password">New password</Label>
              <Input
                id="eu-password"
                type="password"
                placeholder="Leave blank to keep current"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /> {fieldErrors.password}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="eu-avatar">Avatar URL</Label>
              <Input
                id="eu-avatar"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                aria-invalid={!!fieldErrors.avatarUrl}
              />
              {fieldErrors.avatarUrl && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /> {fieldErrors.avatarUrl}
                </p>
              )}
            </div>
            {username && fieldErrors.username && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" /> {fieldErrors.username}
              </p>
            )}

            <Separator />

            <RolesEditor
              value={roles}
              original={originalRoles}
              targetUserId={user.user_id}
              onChange={setRoles}
              onValidationChange={setRolesValidation}
            />

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Demo account</p>
                <p className="text-xs text-muted-foreground">
                  Included in seed/clear demo operations.
                </p>
              </div>
              <Switch checked={isDemo} onCheckedChange={setIsDemo} />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 text-sky-500" />
                <div>
                  <p className="text-sm font-medium">Verified account</p>
                  <p className="text-xs text-muted-foreground">
                    Shows a blue checkmark next to this user's name and avatar.
                  </p>
                </div>
              </div>
              <Switch checked={isVerified} onCheckedChange={setIsVerified} />
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this user permanently? This cannot be undone.")) {
                remove.mutate();
              }
            }}
            disabled={remove.isPending || update.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <div className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => update.mutate()}
              disabled={update.isPending || !canSave}
            >
              {update.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {rolesDirty ? "Save changes" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}