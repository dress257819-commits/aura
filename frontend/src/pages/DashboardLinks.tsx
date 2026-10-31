import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight, ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, ImagePlus, Link2,
  Pencil, Plus, RotateCcw, Trash2, Upload, X,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { UpgradeModal } from "@/components/shared/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { PLATFORMS, platformDef, platformIconStyle } from "@/lib/platforms";
import type { Link as LinkType } from "@/lib/types";

interface FormState {
  id?: string;
  platform: string;
  title: string;
  url: string;
  description: string;
  thumbnail_url: string;
  thumbnail_file: File | null;
  icon_url: string;
  icon_file: File | null;
}

const EMPTY: FormState = {
  platform: "custom",
  title: "",
  url: "",
  description: "",
  thumbnail_url: "",
  thumbnail_file: null,
  icon_url: "",
  icon_file: null,
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function useFilePreview(file: File | null) {
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return preview;
}

function normalizeWebUrl(value: string, label: string) {
  const trimmed = value.trim();
  const url = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    throw new Error(`${label} must be a valid web address`);
  }
  return url;
}

export default function DashboardLinks() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const coverFilePreview = useFilePreview(form?.thumbnail_file ?? null);
  const iconFilePreview = useFilePreview(form?.icon_file ?? null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>();

  const linksQuery = useQuery({
    queryKey: ["my-links"],
    queryFn: () => apiGet<LinkType[]>("/me/links"),
    enabled: !!me,
  });
  const links = linksQuery.data ?? [];
  const linkLimit = me?.plan === "free" ? 5 : me?.plan === "pro" ? 15 : 100;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-links"] });
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const onError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 403) {
      setUpgradeReason(err.detail);
      setUpgradeOpen(true);
    } else {
      toast.error(err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const save = useMutation({
    mutationFn: async (currentForm: FormState) => {
      const thumbnail_url = currentForm.thumbnail_file
        ? (await apiUpload<{ url: string }>("/me/uploads/images", currentForm.thumbnail_file)).url
        : currentForm.thumbnail_url.trim()
          ? normalizeWebUrl(currentForm.thumbnail_url, "Cover image URL")
          : "";
      const icon_url = currentForm.icon_file
        ? (await apiUpload<{ url: string }>("/me/uploads/images", currentForm.icon_file)).url
        : currentForm.icon_url.trim()
          ? normalizeWebUrl(currentForm.icon_url, "Logo URL")
          : "";
      const body = {
        platform: currentForm.platform,
        title: currentForm.title.trim(),
        url: normalizeWebUrl(currentForm.url, "URL"),
        description: currentForm.description.trim(),
        thumbnail_url,
        icon_url,
      };
      return currentForm.id
        ? apiPatch<LinkType>(`/me/links/${currentForm.id}`, body)
        : apiPost<LinkType>("/me/links", body);
    },
    onSuccess: (_saved, submittedForm) => {
      toast.success(submittedForm.id ? "Link updated" : "Link added to your AURA page");
      setForm(null);
      invalidate();
    },
    onError,
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch<LinkType>(`/me/links/${id}`, body),
    onSuccess: invalidate,
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/me/links/${id}`),
    onSuccess: () => {
      toast.success("Link deleted");
      invalidate();
    },
    onError,
  });

  const [moving, setMoving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const moveTo = async (index: number, targetIndex: number) => {
    if (moving) return;
    if (targetIndex < 0 || targetIndex >= links.length || index === targetIndex) return;
    const reordered = [...links];
    const [dragged] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, dragged);
    setMoving(true);
    try {
      for (const [sort_order, link] of reordered.entries()) {
        if (link.sort_order !== sort_order) {
          await apiPatch(`/me/links/${link.id}`, { sort_order });
        }
      }
      invalidate();
    } catch (error) {
      invalidate();
      onError(error);
    } finally {
      setMoving(false);
    }
  };

  const move = (index: number, dir: -1 | 1) => moveTo(index, index + dir);

  return (
    <DashboardShell active="Links">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute -right-10 -top-14 size-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="label-caps mb-2 text-muted-foreground">Your corner of the internet</p>
              <h1 className="font-heading text-3xl font-bold tracking-tight">Links</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Bring your favorite places together in one easy-to-share page.
              </p>
              <p className="mt-3 text-xs font-medium text-muted-foreground" data-testid="links-count">
                {links.length} of {linkLimit} links added
              </p>
            </div>
            <div className="flex items-center gap-2">
              {me && (
                <a
                  href={`/u/${me.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <ExternalLink className="size-4" /> View page
                </a>
              )}
              <Button
                className="shadow-lg shadow-indigo-500/20"
                onClick={() => setForm({ ...EMPTY })}
                data-testid="links-add-button"
              >
                <Plus className="size-4" /> Add link
              </Button>
            </div>
          </div>
        </header>

        {linksQuery.isPending ? (
          <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Loading your links…
          </div>
        ) : linksQuery.isError ? (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <p className="font-semibold">Your links couldn’t load</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {linksQuery.error instanceof ApiError ? linksQuery.error.detail : "Please try again."}
            </p>
            <Button className="mt-4" size="sm" variant="outline" onClick={() => void linksQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : links.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/80 bg-card/60 px-5 py-12 text-center sm:px-10">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Link2 className="size-6" />
            </span>
            <h2 className="mt-4 font-heading text-lg font-bold">Your page starts here</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Add your Instagram, shop, portfolio, playlist, or anything else you want people to find.
            </p>
            <Button className="mt-5" onClick={() => setForm({ ...EMPTY })} data-testid="links-empty-add-button">
              <Plus className="size-4" /> Add your first link
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-heading font-bold">Your links</h2>
              <span className="text-xs text-muted-foreground">Drag a link or use the arrows to reorder</span>
            </div>
            {links.map((link, index) => {
            const def = platformDef(link.platform);
            const Icon = def.icon;
            return (
              <article
                key={link.id}
                draggable={!moving}
                onDragStart={() => setDraggingId(link.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceIndex = links.findIndex((item) => item.id === draggingId);
                  if (sourceIndex >= 0) void moveTo(sourceIndex, index);
                  setDraggingId(null);
                }}
                onDragEnd={() => setDraggingId(null)}
                className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm transition-all hover:border-primary/25 hover:shadow-md sm:gap-4 sm:p-4"
                data-testid={`link-row-${link.id}`}
              >
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon-xs" onClick={() => void move(index, -1)} disabled={index === 0 || patch.isPending || moving} aria-label="Move up" title="Move up" data-testid={`link-up-${link.id}`}>
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => void move(index, 1)} disabled={index === links.length - 1 || patch.isPending || moving} aria-label="Move down" title="Move down" data-testid={`link-down-${link.id}`}>
                    <ChevronDown className="size-3.5" />
                  </Button>
                </div>
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-black/10"
                  style={platformIconStyle(link.platform)}
                >
                  <Icon size={18} color={def.iconColor} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold">
                    {link.title}
                    {!link.active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        hidden
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{link.url}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowUpRight className="size-3" /> {link.clicks} {link.clicks === 1 ? "click" : "clicks"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => patch.mutate({ id: link.id, body: { active: !link.active } })} aria-label={link.active ? "Hide link" : "Show link"} title={link.active ? "Hide link" : "Show link"} data-testid={`link-toggle-${link.id}`}>
                    {link.active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setForm({
                        id: link.id,
                        platform: link.platform,
                        title: link.title,
                        url: link.url,
                        description: link.description,
                        thumbnail_url: link.thumbnail_url,
                        thumbnail_file: null,
                        icon_url: link.icon_url ?? "",
                        icon_file: null,
                      })
                    }
                    aria-label={`Edit ${link.title}`}
                    title="Edit link"
                    data-testid={`link-edit-${link.id}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => remove.mutate(link.id)} aria-label={`Delete ${link.title}`} title="Delete link" data-testid={`link-delete-${link.id}`}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </article>
            );
            })}
          </div>
        )}
      </div>

      {/* add / edit dialog */}
      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg" data-testid="link-form-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{form?.id ? "Edit your link" : "Add a link"}</DialogTitle>
            <DialogDescription>
              Add a destination and give it a name people will recognize.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="link-platform">Platform</Label>
                <Select
                  value={form.platform}
                  onValueChange={(value) => setForm({
                    ...form,
                    platform: value,
                    title: form.title || `My ${PLATFORMS[value]?.label ?? "link"}`,
                  })}
                >
                  <SelectTrigger id="link-platform" data-testid="link-platform-select">
                    <SelectValue>{PLATFORMS[form.platform]?.label ?? "Website"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLATFORMS).map(([key, def]) => (
                      <SelectItem key={key} value={key}>
                        <span className="grid size-6 place-items-center rounded-md border border-black/10" style={platformIconStyle(key)}>
                          <def.icon size={14} />
                        </span>
                        {def.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-title">Title</Label>
                <Input
                  id="link-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={`My ${PLATFORMS[form.platform]?.label ?? "website"}`}
                  maxLength={60}
                  data-testid="link-title-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-url">URL</Label>
                <Input
                  id="link-url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder={form.platform === "instagram" ? "instagram.com/yourname" : "yourwebsite.com"}
                  data-testid="link-url-input"
                />
                <p className="text-xs text-muted-foreground">You can leave off https:// — we’ll add it for you.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-desc">Description <span className="font-normal text-muted-foreground">· optional</span></Label>
                <Input
                  id="link-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="A little more about where this link goes"
                  maxLength={140}
                  data-testid="link-description-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-thumb">Cover image <span className="font-normal text-muted-foreground">· optional</span></Label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
                    <Upload className="size-3.5" />
                    {form.thumbnail_file ? "Choose another" : "Upload image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="sr-only"
                      onClick={(event) => { event.currentTarget.value = ""; }}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (!file) return;
                        if (!IMAGE_TYPES.has(file.type)) {
                          toast.error("Choose a JPEG, PNG, GIF, or WebP image");
                          return;
                        }
                        if (file.size > MAX_IMAGE_BYTES) {
                          toast.error("Images must be 5 MB or smaller");
                          return;
                        }
                        setForm({ ...form, thumbnail_url: "", thumbnail_file: file });
                      }}
                      data-testid="link-cover-upload"
                    />
                  </label>
                  {(form.thumbnail_file || form.thumbnail_url) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setForm({ ...form, thumbnail_url: "", thumbnail_file: null })}
                    >
                      <X className="size-3.5" /> Remove cover
                    </Button>
                  )}
                </div>
                <Input
                  id="link-thumb"
                  value={form.thumbnail_url}
                  onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value, thumbnail_file: null })}
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Or paste an image URL"
                  maxLength={500}
                  data-testid="link-thumbnail-input"
                />
                <p className="text-xs text-muted-foreground">Use your own image to give this link a personal cover.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-icon-url">Link logo <span className="font-normal text-muted-foreground">· optional</span></Label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
                    <ImagePlus className="size-3.5" />
                    {form.icon_file ? "Choose another" : "Upload logo"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="sr-only"
                      onClick={(event) => { event.currentTarget.value = ""; }}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (!file) return;
                        if (!IMAGE_TYPES.has(file.type)) {
                          toast.error("Choose a JPEG, PNG, GIF, or WebP image");
                          return;
                        }
                        if (file.size > MAX_IMAGE_BYTES) {
                          toast.error("Images must be 5 MB or smaller");
                          return;
                        }
                        setForm({ ...form, icon_url: "", icon_file: file });
                      }}
                      data-testid="link-logo-upload"
                    />
                  </label>
                  {(form.icon_file || form.icon_url) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setForm({ ...form, icon_url: "", icon_file: null })}
                    >
                      <RotateCcw className="size-3.5" /> Use platform logo
                    </Button>
                  )}
                </div>
                <Input
                  id="link-icon-url"
                  value={form.icon_url}
                  onChange={(e) => setForm({ ...form, icon_url: e.target.value, icon_file: null })}
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Or paste a logo image URL"
                  maxLength={500}
                  data-testid="link-logo-url-input"
                />
                <p className="text-xs text-muted-foreground">If you leave this blank, we’ll use the platform’s logo.</p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm" data-testid="link-form-preview">
                {(coverFilePreview || form.thumbnail_url) ? (
                  <img
                    src={coverFilePreview || form.thumbnail_url}
                    alt="Link cover preview"
                    className="h-28 w-full object-cover"
                  />
                ) : (
                  <div
                    className="h-20"
                    style={{ background: `linear-gradient(135deg, ${platformDef(form.platform).color}55, ${platformDef(form.platform).color}18, var(--muted))` }}
                  />
                )}
                <div className="flex items-center gap-3 p-3">
                  <span
                    className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/70"
                    style={platformIconStyle(form.platform)}
                  >
                    {(iconFilePreview || form.icon_url) ? (
                      <img src={iconFilePreview || form.icon_url} alt="" className="size-full object-cover" />
                    ) : (
                      (() => {
                        const Icon = platformDef(form.platform).icon;
                        return <Icon size={19} color={platformDef(form.platform).iconColor} />;
                      })()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{form.title || "Your link title"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {form.description || form.url || "A little more about this link"}
                    </span>
                  </span>
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)} data-testid="link-cancel-button">
              Cancel
            </Button>
            <Button
              onClick={() => form && save.mutate(form)}
              disabled={!form?.title.trim() || !form?.url.trim() || save.isPending}
              data-testid="link-save-button"
            >
              {save.isPending ? "Saving…" : "Save link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} reason={upgradeReason} />
    </DashboardShell>
  );
}
