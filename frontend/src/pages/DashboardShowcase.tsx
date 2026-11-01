import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { GalleryItem, Poll } from "@/lib/types";

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

export default function DashboardShowcase() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [editingImage, setEditingImage] = useState<GalleryItem | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("");
  const imagePreview = useFilePreview(imageFile);
  const editImagePreview = useFilePreview(editImageFile);
  const galleryLimit = me?.plan === "creator" ? 50 : me?.plan === "pro" ? 12 : 3;
  const optionCount = options.split(/\r?\n/).filter((option) => option.trim()).length;

  const galleryQuery = useQuery({
    queryKey: ["my-gallery"],
    queryFn: () => apiGet<GalleryItem[]>("/me/gallery"),
    enabled: !!me,
  });
  const pollsQuery = useQuery({
    queryKey: ["my-polls"],
    queryFn: () => apiGet<Poll[]>("/me/polls"),
    enabled: !!me,
  });

  const refreshShowcase = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-gallery"] });
    void queryClient.invalidateQueries({ queryKey: ["my-polls"] });
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
  };
  const handleError = (error: unknown) => {
    toast.error(error instanceof ApiError ? error.detail : error instanceof Error ? error.message : "Something went wrong");
  };

  const addImage = useMutation({
    mutationFn: async () => {
      if (!imageFile) throw new Error("Choose an image to add to your gallery.");
      const { url } = await apiUpload<{ url: string }>("/me/uploads/images", imageFile);
      return apiPost<GalleryItem>("/me/gallery", { url, caption: caption.trim() });
    },
    onSuccess: () => {
      setImageFile(null);
      setCaption("");
      toast.success("Image added to your showcase");
      refreshShowcase();
    },
    onError: handleError,
  });

  const removeImage = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/me/gallery/${id}`),
    onSuccess: (_removed, id) => {
      if (editingImage?.id === id) {
        setEditingImage(null);
        setEditImageFile(null);
        setEditCaption("");
      }
      toast.success("Image removed");
      refreshShowcase();
    },
    onError: handleError,
  });

  const updateImage = useMutation({
    mutationFn: async () => {
      if (!editingImage) throw new Error("Choose a gallery image to update.");
      const url = editImageFile
        ? (await apiUpload<{ url: string }>("/me/uploads/images", editImageFile)).url
        : editingImage.url;
      return apiPatch<GalleryItem>(`/me/gallery/${editingImage.id}`, {
        url,
        caption: editCaption.trim(),
      });
    },
    onSuccess: () => {
      setEditingImage(null);
      setEditImageFile(null);
      setEditCaption("");
      toast.success("Gallery image updated");
      refreshShowcase();
    },
    onError: handleError,
  });

  const addPoll = useMutation({
    mutationFn: () => apiPost<Poll>("/me/polls", {
      question: question.trim(),
      options: options.split(/\r?\n/).map((option) => option.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      setQuestion("");
      setOptions("");
      toast.success("Your poll is live on your page");
      refreshShowcase();
    },
    onError: handleError,
  });

  const setPollActive = useMutation({
    mutationFn: async ({ poll, active }: { poll: Poll; active: boolean }) => {
      if (active) {
        const activePolls = (pollsQuery.data ?? []).filter((item) => item.active && item.id !== poll.id);
        for (const activePoll of activePolls) {
          await apiPatch<Poll>(`/me/polls/${activePoll.id}`, { active: false });
        }
      }
      return apiPatch<Poll>(`/me/polls/${poll.id}`, { active });
    },
    onSuccess: () => {
      toast.success("Poll visibility updated");
      refreshShowcase();
    },
    onError: handleError,
  });

  const removePoll = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/me/polls/${id}`),
    onSuccess: () => {
      toast.success("Poll deleted");
      refreshShowcase();
    },
    onError: handleError,
  });

  return (
    <DashboardShell active="Showcase">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute -right-10 -top-14 size-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <p className="label-caps mb-2 text-muted-foreground">More than a list of links</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight">Showcase</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Add a gallery of your work and a live poll. Visitors can explore what you make and join the conversation on your public page.
            </p>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
          <Card className="border-border/70 bg-card shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-heading text-lg font-bold">Your gallery</p>
                  <p className="mt-1 text-sm text-muted-foreground">Pin photos, projects, and moments to your profile.</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {galleryQuery.data?.length ?? 0}/{galleryLimit}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex min-h-40 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/30">
                  {imagePreview ? (
                    <img src={imagePreview} alt="New gallery upload preview" className="h-40 w-full object-cover" />
                  ) : (
                    <div className="px-5 text-center">
                      <ImagePlus className="mx-auto size-7 text-muted-foreground" />
                      <p className="mt-2 text-sm font-medium">Choose a gallery image</p>
                      <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, GIF or WebP · up to 5 MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="sr-only"
                    aria-label="Choose gallery image"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      if (!IMAGE_TYPES.has(file.type)) {
                        toast.error("Choose a JPEG, PNG, GIF, or WebP image");
                        return;
                      }
                      if (file.size > MAX_IMAGE_BYTES) {
                        toast.error("Images must be 5 MB or smaller");
                        return;
                      }
                      setImageFile(file);
                    }}
                    data-testid="showcase-image-input"
                  />
                </label>
                <div className="flex flex-col gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="showcase-caption">Caption <span className="font-normal text-muted-foreground">· optional</span></Label>
                    <Input
                      id="showcase-caption"
                      value={caption}
                      onChange={(event) => setCaption(event.target.value)}
                      placeholder="What are we looking at?"
                      maxLength={120}
                      data-testid="showcase-caption-input"
                    />
                  </div>
                  <Button
                    className="mt-auto"
                    disabled={!imageFile || addImage.isPending || (galleryQuery.data?.length ?? 0) >= galleryLimit}
                    onClick={() => addImage.mutate()}
                    data-testid="showcase-add-image"
                  >
                    <Plus className="size-4" /> {addImage.isPending ? "Adding image…" : "Add to gallery"}
                  </Button>
                  {(galleryQuery.data?.length ?? 0) >= galleryLimit && (
                    <p className="text-xs text-muted-foreground">You’ve reached your gallery limit for this plan.</p>
                  )}
                </div>
              </div>

              {galleryQuery.isError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <p className="font-medium">Your gallery couldn’t load.</p>
                  <p className="mt-1 text-muted-foreground">
                    {galleryQuery.error instanceof ApiError ? galleryQuery.error.detail : galleryQuery.error instanceof Error ? galleryQuery.error.message : "Try again in a moment."}
                  </p>
                  <Button className="mt-3" size="sm" variant="outline" onClick={() => void galleryQuery.refetch()}>Try again</Button>
                </div>
              ) : galleryQuery.isPending ? (
                <p className="py-5 text-center text-sm text-muted-foreground">Loading your gallery…</p>
              ) : galleryQuery.data?.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {galleryQuery.data.map((item) => (
                    <figure key={item.id} className="group relative overflow-hidden rounded-2xl border border-border/70 bg-muted/30">
                      <img
                        src={editingImage?.id === item.id && editImagePreview ? editImagePreview : item.url}
                        alt={item.caption || "Gallery image"}
                        className="aspect-square w-full object-cover"
                      />
                      {editingImage?.id === item.id ? (
                        <div className="space-y-2 border-t border-border/70 p-3">
                          <Input
                            value={editCaption}
                            onChange={(event) => setEditCaption(event.target.value)}
                            placeholder="Add a caption"
                            maxLength={120}
                            aria-label="Gallery image caption"
                          />
                          <div className="flex items-center justify-between gap-2">
                            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:border-primary/40 hover:text-primary">
                              <Upload className="size-3.5" />
                              Replace image
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                className="sr-only"
                                aria-label="Choose replacement gallery image"
                                onChange={(event) => {
                                  const file = event.currentTarget.files?.[0];
                                  event.currentTarget.value = "";
                                  if (!file) return;
                                  if (!IMAGE_TYPES.has(file.type)) {
                                    toast.error("Choose a JPEG, PNG, GIF, or WebP image");
                                    return;
                                  }
                                  if (file.size > MAX_IMAGE_BYTES) {
                                    toast.error("Images must be 5 MB or smaller");
                                    return;
                                  }
                                  setEditImageFile(file);
                                }}
                              />
                            </label>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Cancel gallery image edit"
                                onClick={() => {
                                  setEditingImage(null);
                                  setEditImageFile(null);
                                  setEditCaption("");
                                }}
                              >
                                <X className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => updateImage.mutate()}
                                disabled={updateImage.isPending}
                              >
                                {updateImage.isPending ? "Saving…" : "Save"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {item.caption && (
                            <figcaption className="truncate px-3 py-2 text-xs text-muted-foreground">{item.caption}</figcaption>
                          )}
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon-sm"
                            className="absolute left-2 top-2 opacity-100 shadow sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                            aria-label={`Edit ${item.caption || "gallery image"}`}
                            onClick={() => {
                              setEditingImage(item);
                              setEditCaption(item.caption);
                              setEditImageFile(null);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        className="absolute right-2 top-2 opacity-100 shadow sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                        aria-label={`Remove ${item.caption || "gallery image"}`}
                        onClick={() => removeImage.mutate(item.id)}
                        disabled={removeImage.isPending || updateImage.isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-8 text-center">
                  <ImagePlus className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">Your gallery starts here</p>
                  <p className="mt-1 text-xs text-muted-foreground">Add an image above to show visitors what you create.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70 bg-card shadow-sm">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div>
                  <p className="font-heading text-lg font-bold">Ask your audience</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create a poll visitors can answer on your page.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="showcase-poll-question">Poll question</Label>
                  <Input
                    id="showcase-poll-question"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="What should I make next?"
                    maxLength={200}
                    data-testid="showcase-poll-question"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="showcase-poll-options">Answer options</Label>
                  <Textarea
                    id="showcase-poll-options"
                    value={options}
                    onChange={(event) => setOptions(event.target.value)}
                    placeholder={"One option per line\nAt least two options"}
                    rows={4}
                    data-testid="showcase-poll-options"
                  />
                  <p className="text-xs text-muted-foreground">Add 2–5 options, one per line ({optionCount}/5).</p>
                </div>
                <Button
                  className="w-full"
                  disabled={
                    question.trim().length < 4
                    || optionCount < 2
                    || optionCount > 5
                    || addPoll.isPending
                  }
                  onClick={() => addPoll.mutate()}
                  data-testid="showcase-create-poll"
                >
                  <Plus className="size-4" /> {addPoll.isPending ? "Publishing…" : "Publish poll"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card shadow-sm">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div>
                  <p className="font-heading text-lg font-bold">Your polls</p>
                  <p className="mt-1 text-sm text-muted-foreground">Choose which poll visitors see, or retire an old one.</p>
                </div>
                {pollsQuery.isPending ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Loading your polls…</p>
                ) : pollsQuery.isError ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                    <p className="font-medium">Your polls couldn’t load.</p>
                    <p className="mt-1 text-muted-foreground">
                      {pollsQuery.error instanceof ApiError ? pollsQuery.error.detail : pollsQuery.error instanceof Error ? pollsQuery.error.message : "Try again in a moment."}
                    </p>
                    <Button className="mt-3" size="sm" variant="outline" onClick={() => void pollsQuery.refetch()}>Try again</Button>
                  </div>
                ) : pollsQuery.data?.length ? (
                  <div className="space-y-3">
                    {pollsQuery.data.map((poll) => (
                      <article key={poll.id} className="rounded-2xl border border-border/70 p-4">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{poll.question}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {poll.options.map((option) => `${option.text} · ${option.votes}`).join("  /  ")}
                            </p>
                            <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${poll.active ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                              {poll.active ? "Live on your page" : "Archived"}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              size="sm"
                              variant={poll.active ? "outline" : "default"}
                              onClick={() => setPollActive.mutate({ poll, active: !poll.active })}
                              disabled={setPollActive.isPending}
                              aria-label={poll.active ? "Archive poll" : "Make poll live"}
                            >
                              {poll.active ? "Archive" : "Make live"}
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => removePoll.mutate(poll.id)}
                              disabled={removePoll.isPending}
                              aria-label="Delete poll"
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-7 text-center">
                    <p className="text-sm font-medium">No polls yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Create your first poll above and invite people in.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
