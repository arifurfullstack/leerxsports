import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, Eye, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SiteAssetUploader } from "@/components/admin/site-asset-uploader";
import {
  getSiteSettingsAdmin,
  updateSiteSettings,
  siteSettingsSchema,
  SITE_SETTINGS_DEFAULTS,
  type SiteSettingsInput,
} from "@/lib/site-settings-functions";

function AssetPreviewBox({
  url,
  label,
  kind,
  disabled,
  onUploaded,
}: {
  url: string;
  label: string;
  kind: "favicon" | "logo" | "logo_dark" | "og";
  disabled?: boolean;
  onUploaded: (url: string) => void;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [url]);

  const hasValue = Boolean(url && url.trim());

  return (
    <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2.5 shadow-sm transition-all hover:bg-muted/40">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card shadow-inner">
        <div
          aria-hidden
          className="absolute inset-0 opacity-20 [background-image:radial-gradient(hsl(var(--foreground))_1px,transparent_1px)] [background-size:8px_8px]"
        />
        {hasValue && !hasError ? (
          <img
            src={url}
            alt={`${label} preview`}
            className="relative z-10 max-h-full max-w-full object-contain p-1"
            onError={() => setHasError(true)}
          />
        ) : hasError ? (
          <div className="relative z-10 flex flex-col items-center justify-center text-destructive">
            <span className="text-[10px] font-mono font-bold">ERR</span>
          </div>
        ) : (
          <div className="relative z-10 text-muted-foreground/40">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="flex flex-1 min-w-0 flex-col gap-0.5">
        <span className="text-xs font-semibold text-foreground truncate">
          {hasValue ? (hasError ? "Invalid or unreachable image URL" : label) : "No image set"}
        </span>
        <span className="text-[11px] text-muted-foreground truncate">
          {hasValue
            ? hasError
              ? "Check URL or upload a new file below"
              : url
            : "Upload an asset or enter an image URL above"}
        </span>
      </div>

      <SiteAssetUploader
        kind={kind}
        disabled={disabled}
        onUploaded={onUploaded}
      />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin/website")({
  component: WebsiteSettingsPage,
  head: () => ({ meta: [{ title: "Admin · Website settings" }] }),
});

type Field = {
  key: keyof SiteSettingsInput;
  label: string;
  hint?: string;
  type?: "text" | "textarea" | "url" | "email" | "color";
  placeholder?: string;
};

const SECTIONS: { title: string; description: string; fields: Field[] }[] = [
  {
    title: "Identity",
    description: "Brand name, tagline, and hex theme color used across the app.",
    fields: [
      { key: "site_name", label: "Website name", placeholder: "LEER Sports" },
      { key: "tagline", label: "Tagline", placeholder: "Elite Fitness Creators & Private Coaching" },
      { key: "theme_color", label: "Theme color (hex)", type: "color", placeholder: "#0a0a0a" },
      { key: "support_email", label: "Support email", type: "email", placeholder: "support@leer.app" },
    ],
  },
  {
    title: "SEO metadata",
    description: "Default title, description and keywords for search engines.",
    fields: [
      { key: "meta_title", label: "Meta title", hint: "Recommended under 60 characters." },
      { key: "meta_description", label: "Meta description", type: "textarea", hint: "Recommended under 160 characters." },
      { key: "meta_keywords", label: "Meta keywords", hint: "Comma-separated (optional)." },
    ],
  },
  {
    title: "Branding assets",
    description: "URLs for favicon, logo variants and social share image.",
    fields: [
      { key: "favicon_url", label: "Favicon URL", type: "url", placeholder: "/favicon.ico" },
      { key: "logo_url", label: "Logo (light) URL", type: "url" },
      { key: "logo_dark_url", label: "Logo (dark) URL", type: "url" },
      { key: "og_image_url", label: "Open Graph image URL", type: "url", hint: "Absolute HTTPS URL, ideally 1200×630." },
    ],
  },
  {
    title: "Social preview",
    description: "How your site appears when shared on social platforms.",
    fields: [
      { key: "og_title", label: "OG title" },
      { key: "og_description", label: "OG description", type: "textarea" },
      { key: "twitter_handle", label: "Twitter handle", placeholder: "@leersports" },
    ],
  },
  {
    title: "Social profiles",
    description: "Full URLs to your official social accounts.",
    fields: [
      { key: "social_twitter", label: "Twitter / X", type: "url" },
      { key: "social_instagram", label: "Instagram", type: "url" },
      { key: "social_youtube", label: "YouTube", type: "url" },
      { key: "social_tiktok", label: "TikTok", type: "url" },
      { key: "social_facebook", label: "Facebook", type: "url" },
      { key: "social_linkedin", label: "LinkedIn", type: "url" },
    ],
  },
  {
    title: "Advanced",
    description: "Custom footer copy and raw HTML injected into <head>.",
    fields: [
      { key: "footer_text", label: "Footer text", type: "textarea" },
      { key: "custom_head_html", label: "Custom head HTML", type: "textarea", hint: "Analytics snippets, verification tags, etc." },
    ],
  },
];

function normalize(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function WebsiteSettingsPage() {
  const qc = useQueryClient();
  const load = useServerFn(getSiteSettingsAdmin);
  const save = useServerFn(updateSiteSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "site-settings"],
    queryFn: () => load(),
  });

  const [form, setForm] = useState<SiteSettingsInput>(SITE_SETTINGS_DEFAULTS);
  const [errors, setErrors] = useState<Partial<Record<keyof SiteSettingsInput, string>>>({});

  useEffect(() => {
    if (data) setForm({ ...SITE_SETTINGS_DEFAULTS, ...data });
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: SiteSettingsInput) => save({ data: payload }),
    onSuccess: (result) => {
      if (result?.ok === false) {
        if (result.fieldErrors) setErrors(result.fieldErrors as any);
        toast.error(result.message || "Please fix the highlighted fields.");
        return;
      }
      setErrors({});
      toast.success("Website settings saved");
      qc.invalidateQueries({ queryKey: ["admin", "site-settings"] });
      qc.invalidateQueries({ queryKey: ["public", "site-settings"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to save"),
  });

  function setField<K extends keyof SiteSettingsInput>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v } as SiteSettingsInput));
    setErrors((e) => ({ ...e, [k]: undefined }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = siteSettingsSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setErrors(errs as any);
      toast.error("Please fix the highlighted fields");
      return;
    }
    mutation.mutate(parsed.data);
  }

  function resetDefaults() {
    setForm(SITE_SETTINGS_DEFAULTS);
    setErrors({});
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Admin</p>
          <h1 className="font-display text-3xl uppercase tracking-tight">Website settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your site's name, SEO metadata, branding assets and social presence. Changes apply site-wide.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild type="button" variant="secondary" size="sm">
            <Link to="/admin/website-preview">
              <Eye className="mr-2 h-4 w-4" /> Preview
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetDefaults}
            disabled={mutation.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reset to defaults
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          {SECTIONS.map((section) => (
            <section
              key={section.title}
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="mb-4">
                <h2 className="font-display text-lg uppercase tracking-tight">
                  {section.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {section.description}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {section.fields.map((field) => {
                  const value = normalize(form[field.key]);
                  const err = errors[field.key];
                  const spanFull =
                    field.type === "textarea" ||
                    field.key === "meta_description" ||
                    field.key === "og_description" ||
                    field.key === "custom_head_html" ||
                    field.key === "footer_text";
                  return (
                    <div
                      key={field.key}
                      className={spanFull ? "md:col-span-2" : undefined}
                    >
                      <Label htmlFor={field.key} className="text-xs uppercase tracking-wider">
                        {field.label}
                      </Label>
                      {field.type === "textarea" ? (
                        <Textarea
                          id={field.key}
                          value={value}
                          onChange={(e) => setField(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={4}
                          className={err ? "border-destructive" : ""}
                        />
                      ) : field.type === "color" ? (
                        <div className="flex items-center gap-2">
                          <Input
                            id={field.key}
                            value={value}
                            onChange={(e) => setField(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className={err ? "border-destructive" : ""}
                          />
                          <input
                            type="color"
                            aria-label={`${field.label} picker`}
                            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#0a0a0a"}
                            onChange={(e) => setField(field.key, e.target.value)}
                            className="h-9 w-12 shrink-0 cursor-pointer rounded border border-border bg-transparent"
                          />
                        </div>
                      ) : (
                        <Input
                          id={field.key}
                          type={field.type === "email" ? "email" : "text"}
                          value={value}
                          onChange={(e) => setField(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className={err ? "border-destructive" : ""}
                        />
                      )}
                      {field.hint && !err && (
                        <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>
                      )}
                      {err && (
                        <p className="mt-1 text-xs text-destructive">{err}</p>
                      )}
                      {(field.key === "favicon_url" ||
                        field.key === "logo_url" ||
                        field.key === "logo_dark_url" ||
                        field.key === "og_image_url") && (
                        <AssetPreviewBox
                          url={value}
                          label={field.label}
                          kind={
                            field.key === "favicon_url"
                              ? "favicon"
                              : field.key === "logo_url"
                              ? "logo"
                              : field.key === "logo_dark_url"
                              ? "logo_dark"
                              : "og"
                          }
                          disabled={mutation.isPending}
                          onUploaded={(url) => setField(field.key, url)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="sticky bottom-4 z-10 flex justify-end">
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="shadow-lg"
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}