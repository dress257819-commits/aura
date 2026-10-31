import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check, Crown, ExternalLink, Lock, Paintbrush, Upload, X,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PhoneFrame } from "@/components/shared/PhoneFrame";
import { ProfileCanvas } from "@/components/profile/ProfileCanvas";
import { UpgradeModal } from "@/components/shared/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPatch, apiUpload, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { FONT_OPTIONS, PROFILE_THEMES } from "@/lib/themes";
import type { Appearance, Link, MeProfile, ProfileBundle } from "@/lib/types";
import { cn } from "@/lib/utils";

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, creator: 2 };
const THEME_MIN_PLAN: Record<string, string> = {
  cyber: "pro",
  neo: "pro",
  "creator-hub": "pro",
  luxe: "creator",
};
const FONT_MIN_PLAN: Record<string, string> = {
  sora: "pro",
  "space-grotesk": "pro",
  playfair: "creator",
  lora: "creator",
};
const CARD_STYLES = [
  { key: "rounded", name: "Rounded", description: "Clean and familiar", plan: "free" },
  { key: "soft", name: "Soft", description: "Extra-smooth corners", plan: "free" },
  { key: "editorial", name: "Editorial", description: "Crisp, framed cards", plan: "pro" },
  { key: "glass", name: "Glass", description: "Airy, luminous layers", plan: "pro" },
  { key: "outline", name: "Outline", description: "A bold creator finish", plan: "creator" },
];
const ACCENT_PRESETS = ["#8B5CF6", "#EC4899", "#22C55E", "#0EA5E9", "#F97316", "#EAB308"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"]);

function isVideoMedia(fileOrUrl: File | string) {
  if (typeof fileOrUrl !== "string") {
    return fileOrUrl.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(fileOrUrl.name);
  }
  return /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(fileOrUrl);
}

interface ProfileDraft {
  username: string;
  name: string;
  bio: string;
  location: string;
  interests: string;
  daily_question: string;
  avatar_url: string;
  avatar_file: File | null;
  cover_url: string;
  cover_file: File | null;
}

interface PreviewData {
  bundle: ProfileBundle;
  warning?: string;
}

function isUnlocked(plan: string, requiredPlan?: string) {
  return !requiredPlan || (PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0);
}

function draftFromProfile(profile: MeProfile): ProfileDraft {
  return {
    username: profile.username,
    name: profile.name,
    bio: profile.bio,
    location: profile.location,
    interests: profile.interests.join(", "),
    daily_question: profile.daily_question,
    avatar_url: profile.avatar_url,
    avatar_file: null,
    cover_url: profile.cover_url,
    cover_file: null,
  };
}

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

function ProfileMediaField({
  label,
  description,
  imageUrl,
  file,
  kind,
  onImageUrlChange,
  onFileChange,
}: {
  label: string;
  description: string;
  imageUrl: string;
  file: File | null;
  kind: "avatar" | "cover";
  onImageUrlChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
}) {
  const localPreview = useFilePreview(file);
  const src = localPreview || imageUrl;

  return (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/30">
        {kind === "cover" ? (
          <div className="relative h-28 overflow-hidden bg-gradient-to-br from-primary/30 via-primary/10 to-muted">
            {src ? (
              isVideoMedia(file ?? imageUrl) ? (
                <video
                  key={src}
                  src={src}
                  className="size-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img
                  key={src}
                  src={src}
                  alt="Profile cover preview"
                  className="size-full object-cover"
                  onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
                />
              )
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-primary)_0%,transparent_55%)] opacity-25" />
            )}
            <span className="absolute bottom-3 left-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur">
              Profile cover
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-background bg-primary/10 text-primary shadow-sm">
              {src ? (
                <img
                  key={src}
                  src={src}
                  alt="Profile photo preview"
                  className="size-full object-cover"
                  onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
                />
              ) : (
                <span className="text-xl font-semibold">A</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Your profile photo</p>
              <p className="mt-1 text-xs text-muted-foreground">Shown beside your name on your page.</p>
            </div>
          </div>
        )}
        <div className="space-y-3 border-t border-border/70 bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
              <Upload className="size-3.5" />
              {file ? "Choose another" : kind === "cover" ? "Upload image or video" : "Upload image"}
              <input
                type="file"
                accept={kind === "cover"
                  ? "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v"
                  : "image/jpeg,image/png,image/gif,image/webp"}
                className="sr-only"
                onClick={(event) => { event.currentTarget.value = ""; }}
                onChange={(event) => {
                  const selected = event.currentTarget.files?.[0];
                  if (!selected) return;
                  const isVideo = kind === "cover" && (
                    VIDEO_TYPES.has(selected.type) || /\.(mp4|webm|mov|m4v)$/i.test(selected.name)
                  );
                  if (!IMAGE_TYPES.has(selected.type) && !isVideo) {
                    toast.error(kind === "cover"
                      ? "Choose a JPEG, PNG, GIF, WebP, MP4, WebM, or MOV file"
                      : "Choose a JPEG, PNG, GIF, or WebP image");
                    return;
                  }
                  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
                  if (selected.size > maxBytes) {
                    toast.error(`Files must be ${isVideo ? 25 : 5} MB or smaller`);
                    return;
                  }
                  onImageUrlChange("");
                  onFileChange(selected);
                }}
              />
            </label>
            {(imageUrl || file) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onImageUrlChange("");
                  onFileChange(null);
                }}
              >
                <X className="size-3.5" /> Remove image
              </Button>
            )}
          </div>
          <Input
            value={imageUrl}
            onChange={(event) => {
              onImageUrlChange(event.target.value);
              onFileChange(null);
            }}
            placeholder="Or paste an image URL"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={500}
            aria-label={`${label} image URL`}
          />
          <p className="text-xs text-muted-foreground">
            {kind === "cover" ? "Images up to 5 MB · videos up to 25 MB" : "JPEG, PNG, GIF, or WebP · up to 5 MB"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ownerPreview(profile: MeProfile, links: Link[]): ProfileBundle {
  return {
    profile: {
      id: profile.id,
      username: profile.username,
      name: profile.name,
      bio: profile.bio,
      location: profile.location,
      avatar_url: profile.avatar_url,
      cover_url: profile.cover_url,
      interests: profile.interests,
      daily_question: profile.daily_question,
      music: profile.music,
      appearance: profile.appearance,
      plan: profile.plan,
      created_at: profile.created_at,
    },
    links: links.filter((link) => link.active),
    gallery: [],
    poll: null,
    qa: [],
    followers: 0,
    following: false,
  };
}

export default function DashboardCustomize() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [appearance, setAppearance] = useState<Appearance | null>(me?.appearance ?? null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(me ? draftFromProfile(me) : null);
  const [availabilityUsername, setAvailabilityUsername] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string>();

  useEffect(() => {
    if (me?.appearance) setAppearance(me.appearance);
  }, [me?.appearance]);

  useEffect(() => {
    if (me && !profileDraft) setProfileDraft(draftFromProfile(me));
  }, [me, profileDraft]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setAvailabilityUsername(profileDraft?.username.trim().toLowerCase() ?? ""),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [profileDraft?.username]);

  const usernameValid = !!profileDraft && /^[a-z0-9_]{3,24}$/.test(profileDraft.username);
  const usernameChanged = !!me && !!profileDraft && profileDraft.username !== me.username;
  const usernameAvailability = useQuery({
    queryKey: ["username-availability", availabilityUsername],
    queryFn: () => apiGet<{ available: boolean; current?: boolean; reason?: string }>(
      `/me/profile/username-availability?username=${encodeURIComponent(availabilityUsername)}`,
    ),
    enabled: usernameValid && usernameChanged && availabilityUsername === profileDraft?.username.trim().toLowerCase(),
    retry: false,
    staleTime: 10_000,
  });

  const profileQuery = useQuery({
    queryKey: ["customize-profile-preview", me?.username],
    queryFn: async (): Promise<PreviewData> => {
      try {
        return { bundle: await apiGet<ProfileBundle>(`/u/${me!.username}`) };
      } catch (publicError) {
        const links = await apiGet<Link[]>("/me/links");
        return {
          bundle: ownerPreview(me!, links),
          warning: publicError instanceof ApiError
            ? publicError.detail
            : publicError instanceof Error
              ? publicError.message
              : "Public profile details could not be loaded.",
        };
      }
    },
    enabled: !!me,
    retry: false,
  });

  const saveAppearance = useMutation({
    mutationFn: (changes: Partial<Appearance>) =>
      apiPatch<MeProfile>("/me/appearance", changes),
    onSuccess: (updated) => {
      queryClient.setQueryData(["me"], updated);
      setAppearance(updated.appearance);
      void queryClient.invalidateQueries({ queryKey: ["profile", updated.username] });
    },
    onError: (error) => {
      setAppearance(queryClient.getQueryData<MeProfile>(["me"])?.appearance ?? null);
      if (error instanceof ApiError && error.status === 403) {
        setUpgradeReason(error.detail);
        setUpgradeOpen(true);
      } else {
        toast.error(error instanceof ApiError ? error.detail : error instanceof Error ? error.message : "Couldn't save your appearance");
      }
    },
  });

  const saveProfile = useMutation({
    mutationFn: async (draft: ProfileDraft) => {
      const [avatar, cover] = await Promise.all([
        draft.avatar_file
          ? apiUpload<{ url: string }>("/me/uploads/media", draft.avatar_file)
          : Promise.resolve({ url: draft.avatar_url }),
        draft.cover_file
          ? apiUpload<{ url: string }>("/me/uploads/media", draft.cover_file)
          : Promise.resolve({ url: draft.cover_url }),
      ]);
      return apiPatch<MeProfile>("/me/profile", {
        name: draft.name,
        username: draft.username.trim().toLowerCase(),
        bio: draft.bio,
        location: draft.location,
        interests: draft.interests.split(",").map((interest) => interest.trim()).filter(Boolean).slice(0, 8),
        daily_question: draft.daily_question,
        avatar_url: avatar.url,
        cover_url: cover.url,
      });
    },
    onSuccess: (updated, draft) => {
      const previousUsername = draft.username !== updated.username ? me?.username : undefined;
      queryClient.setQueryData(["me"], updated);
      setProfileDraft(draftFromProfile(updated));
      if (previousUsername) {
        void queryClient.invalidateQueries({ queryKey: ["customize-profile-preview", previousUsername] });
        void queryClient.invalidateQueries({ queryKey: ["profile", previousUsername] });
      }
      void queryClient.invalidateQueries({ queryKey: ["customize-profile-preview", updated.username] });
      void queryClient.invalidateQueries({ queryKey: ["profile", updated.username] });
      toast.success("Your profile details are saved");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.detail : error instanceof Error ? error.message : "Couldn't save your profile");
    },
  });

  const updateAppearance = (changes: Partial<Appearance>) => {
    if (saveAppearance.isPending) return;
    setAppearance((current) => current ? { ...current, ...changes } : current);
    saveAppearance.mutate(changes);
  };

  const requestUpgrade = (reason: string) => {
    setUpgradeReason(reason);
    setUpgradeOpen(true);
  };

  const selectedTheme = appearance ? PROFILE_THEMES[appearance.theme] : undefined;
  const avatarPreview = useFilePreview(profileDraft?.avatar_file ?? null);
  const coverPreview = useFilePreview(profileDraft?.cover_file ?? null);
  const hasProfileChanges = !!me && !!profileDraft && (
    profileDraft.username !== me.username
    || profileDraft.name !== me.name
    || profileDraft.bio !== me.bio
    || profileDraft.location !== me.location
    || profileDraft.interests !== me.interests.join(", ")
    || profileDraft.daily_question !== me.daily_question
    || profileDraft.avatar_url !== me.avatar_url
    || profileDraft.cover_url !== me.cover_url
    || !!profileDraft.avatar_file
    || !!profileDraft.cover_file
  );
  const usernameAvailable = !usernameChanged || usernameAvailability.data?.available === true;
  const usernameCheckPending = usernameChanged && (
    availabilityUsername !== profileDraft?.username.trim().toLowerCase() || usernameAvailability.isPending
  );

  const previewBundle = profileQuery.data && profileDraft
    ? {
        ...profileQuery.data.bundle,
        profile: {
          ...profileQuery.data.bundle.profile,
          username: profileDraft.username.trim().toLowerCase(),
          name: profileDraft.name || me?.name || "",
          bio: profileDraft.bio,
          location: profileDraft.location,
          interests: profileDraft.interests.split(",").map((interest) => interest.trim()).filter(Boolean).slice(0, 8),
          daily_question: profileDraft.daily_question,
          avatar_url: avatarPreview || profileDraft.avatar_url,
          cover_url: coverPreview || profileDraft.cover_url,
          appearance: appearance ?? profileQuery.data.bundle.profile.appearance,
        },
      }
    : null;

  return (
    <DashboardShell active="Customize">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute -right-10 -top-14 size-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="label-caps mb-2 text-muted-foreground">Make it yours</p>
              <h1 className="font-heading text-3xl font-bold tracking-tight">Customize your page</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Make your profile feel like you. Preview every change on your mobile page as you go.
              </p>
            </div>
            {me && (
              <a
                href={`/u/${me.username}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
                data-testid="customize-view-profile"
              >
                View live page <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </header>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <Card className="border-border/70 bg-card shadow-sm">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div>
                  <p className="font-heading text-lg font-bold">Profile details</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    These are the details visitors see on your mobile profile.
                  </p>
                </div>
                {profileDraft && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="customize-username">Your profile link</Label>
                      <div className="flex items-center rounded-xl border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring/50">
                        <span className="shrink-0 text-sm text-muted-foreground">/u/</span>
                        <input
                          id="customize-username"
                          value={profileDraft.username}
                          onChange={(event) => setProfileDraft({ ...profileDraft, username: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                          className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
                          maxLength={24}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          aria-describedby="customize-username-hint"
                          data-testid="customize-username-input"
                        />
                      </div>
                      <p id="customize-username-hint" className="text-xs text-muted-foreground">
                        {!usernameValid
                          ? "Choose 3–24 lowercase letters, numbers, or underscores."
                          : usernameChanged && usernameCheckPending
                            ? "Checking username availability…"
                            : usernameChanged && usernameAvailability.isError
                              ? "Could not check availability. Try again before saving."
                              : usernameChanged && usernameAvailability.data?.available === false
                                ? usernameAvailability.data.reason ?? "That username is unavailable."
                                : "3–24 lowercase letters, numbers, or underscores. Your public link updates when saved."}
                      </p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <ProfileMediaField
                        label="Profile photo"
                        description="A clear photo makes your profile easy to recognize."
                        imageUrl={profileDraft.avatar_url}
                        file={profileDraft.avatar_file}
                        kind="avatar"
                        onImageUrlChange={(avatar_url) => setProfileDraft({ ...profileDraft, avatar_url })}
                        onFileChange={(avatar_file) => setProfileDraft({ ...profileDraft, avatar_file })}
                      />
                      <ProfileMediaField
                        label="Cover image"
                        description="Set the image or video visitors see at the top of your page."
                        imageUrl={profileDraft.cover_url}
                        file={profileDraft.cover_file}
                        kind="cover"
                        onImageUrlChange={(cover_url) => setProfileDraft({ ...profileDraft, cover_url })}
                        onFileChange={(cover_file) => setProfileDraft({ ...profileDraft, cover_file })}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="customize-name">Display name</Label>
                        <Input
                          id="customize-name"
                          value={profileDraft.name}
                          onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })}
                          maxLength={60}
                          data-testid="customize-name-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customize-location">Location</Label>
                        <Input
                          id="customize-location"
                          value={profileDraft.location}
                          onChange={(event) => setProfileDraft({ ...profileDraft, location: event.target.value })}
                          placeholder="City, country"
                          maxLength={60}
                          data-testid="customize-location-input"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customize-bio">About you</Label>
                      <Textarea
                        id="customize-bio"
                        value={profileDraft.bio}
                        onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })}
                        placeholder="A short introduction for your page"
                        maxLength={400}
                        rows={3}
                        data-testid="customize-bio-input"
                      />
                      <p className="text-right text-xs text-muted-foreground">{profileDraft.bio.length}/400</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customize-interests">Interests</Label>
                      <Input
                        id="customize-interests"
                        value={profileDraft.interests}
                        onChange={(event) => setProfileDraft({ ...profileDraft, interests: event.target.value })}
                        placeholder="Design, music, coffee"
                        maxLength={220}
                        data-testid="customize-interests-input"
                      />
                      <p className="text-xs text-muted-foreground">Separate up to 8 interests with commas.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customize-question">Question for visitors <span className="font-normal text-muted-foreground">· optional</span></Label>
                      <Input
                        id="customize-question"
                        value={profileDraft.daily_question}
                        onChange={(event) => setProfileDraft({ ...profileDraft, daily_question: event.target.value })}
                        placeholder="Ask visitors a question"
                        maxLength={200}
                        data-testid="customize-question-input"
                      />
                    </div>
                    <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">Your unsaved edits also appear in the preview.</p>
                      <Button
                        onClick={() => saveProfile.mutate(profileDraft)}
                        disabled={!hasProfileChanges || !usernameValid || !usernameAvailable || usernameCheckPending || usernameAvailability.isError || saveProfile.isPending}
                        data-testid="customize-save-profile"
                      >
                        {saveProfile.isPending ? "Saving profile…" : "Save profile details"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card shadow-sm">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div>
                  <p className="font-heading text-lg font-bold">Pick your atmosphere</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose a theme for your profile. Switch it any time.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Object.values(PROFILE_THEMES).map((theme) => {
                    const requiredPlan = THEME_MIN_PLAN[theme.key];
                    const unlocked = isUnlocked(me?.plan ?? "free", requiredPlan);
                    const active = appearance?.theme === theme.key;
                    return (
                      <button
                        key={theme.key}
                        type="button"
                        disabled={saveAppearance.isPending}
                        aria-pressed={active}
                        onClick={() => {
                          if (!unlocked) {
                            requestUpgrade(`The “${theme.name}” theme is available on the ${requiredPlan} plan.`);
                            return;
                          }
                          if (!active) updateAppearance({ theme: theme.key, accent: theme.accent });
                        }}
                        className={cn(
                          "group relative flex min-h-28 items-end overflow-hidden rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          active ? "border-primary ring-2 ring-primary/25" : "border-border/70 hover:border-primary/40",
                        )}
                        style={{ background: theme.bg, color: theme.text }}
                        data-testid={`customize-theme-${theme.key}`}
                      >
                        <span className="absolute inset-0 opacity-60 transition-opacity group-hover:opacity-80" style={{ background: theme.coverScrim }} />
                        <span className="relative flex w-full items-end justify-between gap-2">
                          <span>
                            <span className="block text-sm font-semibold">{theme.name}</span>
                            <span className="mt-1 flex items-center gap-1.5">
                              {[theme.accent, theme.chipText, theme.cardBorder].map((color) => (
                                <span key={color} className="size-2.5 rounded-full border border-white/30" style={{ background: color }} />
                              ))}
                            </span>
                          </span>
                          {active ? (
                            <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-4" />
                            </span>
                          ) : !unlocked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-1 text-[10px] font-semibold text-white">
                              <Lock className="size-3" /> {requiredPlan}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card shadow-sm">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div>
                  <p className="font-heading text-lg font-bold">Fine-tune the details</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Set the type, color, and glass effect that bring your page together.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Typography</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Object.entries(FONT_OPTIONS).map(([key, font]) => {
                      const requiredPlan = FONT_MIN_PLAN[key];
                      const unlocked = isUnlocked(me?.plan ?? "free", requiredPlan);
                      const active = appearance?.font === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={saveAppearance.isPending}
                          aria-pressed={active}
                          onClick={() => {
                            if (!unlocked) {
                              requestUpgrade(`${font.name} is available on the ${requiredPlan} plan.`);
                              return;
                            }
                            if (!active) updateAppearance({ font: key });
                          }}
                          className={cn(
                            "flex min-h-16 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors hover:border-primary/50",
                            active ? "border-primary bg-primary/5 text-primary" : "border-border/70",
                            !unlocked && "opacity-70",
                          )}
                          style={{ fontFamily: font.stack }}
                          data-testid={`customize-font-${key}`}
                        >
                          <span className="truncate text-sm font-semibold">{font.name}</span>
                          {active ? <Check className="size-4 shrink-0" /> : !unlocked ? <Lock className="size-3.5 shrink-0 text-muted-foreground" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 border-t border-border/70 pt-5">
                  <div>
                    <Label>Link card design</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pick the shape and finish used across your profile cards.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {CARD_STYLES.map((style) => {
                      const unlocked = isUnlocked(me?.plan ?? "free", style.plan);
                      const active = appearance?.card_style === style.key;
                      const radius = style.key === "soft" ? 11 : style.key === "editorial" ? 4 : 7;
                      return (
                        <button
                          key={style.key}
                          type="button"
                          disabled={saveAppearance.isPending}
                          aria-pressed={active}
                          onClick={() => {
                            if (!unlocked) {
                              requestUpgrade(`${style.name} card design is available on the ${style.plan} plan.`);
                              return;
                            }
                            if (!active) updateAppearance({ card_style: style.key });
                          }}
                          className={cn(
                            "flex min-h-[76px] items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/50",
                            active ? "border-primary bg-primary/5" : "border-border/70",
                            !unlocked && "opacity-75",
                          )}
                          data-testid={`customize-card-style-${style.key}`}
                        >
                          <span
                            className="grid h-11 w-14 shrink-0 place-items-center overflow-hidden border"
                            style={{
                              borderRadius: radius,
                              borderWidth: style.key === "editorial" || style.key === "outline" ? 2 : 1,
                              borderStyle: style.key === "outline" ? "dashed" : "solid",
                              borderColor: selectedTheme?.cardBorder,
                              background: selectedTheme?.card,
                              boxShadow: style.key === "glass" ? `0 4px 12px ${appearance?.accent ?? "#6366F1"}30` : undefined,
                            }}
                          >
                            <span className="h-1.5 w-7 rounded-full" style={{ background: appearance?.accent ?? selectedTheme?.accent }} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-sm font-semibold">
                              {style.name}
                              {!unlocked && <Lock className="size-3 text-muted-foreground" />}
                              {active && <Check className="size-3.5 text-primary" />}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{style.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 border-t border-border/70 pt-5">
                  <div>
                    <Label htmlFor="customize-accent">Your accent color</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Used for buttons, highlights, and little details.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENT_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        disabled={saveAppearance.isPending}
                        aria-label={`Use accent ${color}`}
                        aria-pressed={appearance?.accent.toLowerCase() === color.toLowerCase()}
                        onClick={() => updateAppearance({ accent: color })}
                        className={cn(
                          "grid size-9 place-items-center rounded-full border border-black/10 transition-transform hover:scale-110",
                          appearance?.accent.toLowerCase() === color.toLowerCase() && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                        )}
                        style={{ background: color }}
                        data-testid={`customize-accent-${color.slice(1)}`}
                      >
                        {appearance?.accent.toLowerCase() === color.toLowerCase() && <Check className="size-4 text-white drop-shadow" />}
                      </button>
                    ))}
                    <label className="relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-background transition-colors hover:border-primary" title="Choose a custom accent">
                      <input
                        id="customize-accent"
                        type="color"
                        value={appearance?.accent ?? selectedTheme?.accent ?? "#6366F1"}
                        onChange={(event) => updateAppearance({ accent: event.target.value })}
                        disabled={saveAppearance.isPending}
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                        aria-label="Choose a custom accent color"
                        data-testid="customize-accent-picker"
                      />
                      <Paintbrush className="size-4 text-muted-foreground" />
                    </label>
                    <span className="ml-1 font-mono text-xs uppercase text-muted-foreground">
                      {appearance?.accent ?? selectedTheme?.accent}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 border-t border-border/70 pt-5">
                  <div>
                    <p className="text-sm font-semibold">Card glass</p>
                    <p className="mt-1 text-xs text-muted-foreground">Adjust the softness behind your link cards.</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((level) => {
                      const locked = level > (me?.plan === "free" ? 2 : 3);
                      return (
                        <button
                          key={level}
                          type="button"
                          disabled={saveAppearance.isPending}
                          aria-pressed={appearance?.glass === level}
                          onClick={() => {
                            if (locked) {
                              requestUpgrade("The strongest glass effect is available with a Pro plan.");
                              return;
                            }
                            updateAppearance({ glass: level });
                          }}
                          className={cn(
                            "flex h-10 items-center justify-center gap-1 rounded-xl border text-xs font-medium transition-colors hover:border-primary/50",
                            appearance?.glass === level ? "border-primary bg-primary/5 text-primary" : "border-border/70",
                            locked && "text-muted-foreground",
                          )}
                        >
                          {locked && <Lock className="size-3" />}
                          {["Off", "Soft", "Medium", "Strong"][level]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-5">
                  <div>
                    <p className="text-sm font-semibold">Ambient effects</p>
                    <p className="mt-1 text-xs text-muted-foreground">Add a soft, animated glow behind your page.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={appearance?.effects ?? false}
                    disabled={saveAppearance.isPending}
                    onClick={() => updateAppearance({ effects: !appearance?.effects })}
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      appearance?.effects ? "bg-primary" : "bg-muted",
                    )}
                    data-testid="customize-effects-toggle"
                  >
                    <span className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      appearance?.effects ? "translate-x-[22px]" : "translate-x-0.5",
                    )} />
                  </button>
                </div>
              </CardContent>
            </Card>

            {me?.plan !== "creator" && (
              <button
                type="button"
                onClick={() => requestUpgrade("Unlock every theme and font to make your AURA page completely your own.")}
                className="flex w-full items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/10"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Crown className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Want the full studio?</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Unlock more themes, fonts, and creative controls.
                  </span>
                </span>
                <span className="text-sm font-semibold text-primary">Explore plans</span>
              </button>
            )}
          </div>

          <aside className="order-first xl:order-last xl:sticky xl:top-20">
            <section className="rounded-3xl border border-border/70 bg-card/70 p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="label-caps text-muted-foreground">Live preview</p>
                  <p className="mt-1 text-xs text-muted-foreground">Your page, with your real profile and links.</p>
                </div>
                {me && (
                  <a
                    href={`/u/${me.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted"
                    aria-label="Open your public profile"
                    data-testid="customize-preview-open"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
              {profileQuery.isPending ? (
                <PhoneFrame height={560}>
                  <div className="min-h-full animate-pulse bg-background p-5 pt-14">
                    <div className="h-28 rounded-2xl bg-muted" />
                    <div className="mx-auto -mt-10 size-20 rounded-full border-4 border-background bg-muted" />
                    <div className="mx-auto mt-3 h-4 w-2/3 rounded-full bg-muted" />
                    <div className="mx-auto mt-2 h-3 w-1/2 rounded-full bg-muted" />
                    <div className="mt-7 space-y-3">
                      <div className="h-12 rounded-xl bg-muted" />
                      <div className="h-12 rounded-xl bg-muted" />
                    </div>
                  </div>
                </PhoneFrame>
              ) : profileQuery.isError ? (
                <div className="rounded-2xl border bg-background p-5 text-center" data-testid="customize-preview-error">
                  <p className="text-sm font-semibold">Your preview couldn’t load</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {profileQuery.error instanceof ApiError ? profileQuery.error.detail : profileQuery.error instanceof Error ? profileQuery.error.message : "Please check your connection and try again."}
                  </p>
                  <Button className="mt-4" size="sm" variant="outline" onClick={() => void profileQuery.refetch()}>
                    Try again
                  </Button>
                </div>
              ) : previewBundle ? (
                <PhoneFrame height={640}>
                  <ProfileCanvas
                    bundle={previewBundle}
                    appearanceOverride={appearance ?? undefined}
                    preview
                  />
                </PhoneFrame>
              ) : null}
              {profileQuery.data?.warning && (
                <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground" data-testid="customize-preview-fallback">
                  Public preview unavailable: {profileQuery.data.warning} Showing your saved profile and links instead.
                </p>
              )}
              {saveAppearance.isPending || saveProfile.isPending ? (
                <p className="mt-3 text-center text-xs text-muted-foreground" aria-live="polite">
                  Saving your changes…
                </p>
              ) : null}
              {me && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Public profile <span className="font-mono">/u/{profileDraft?.username ?? me.username}</span>
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} reason={upgradeReason} />
    </DashboardShell>
  );
}
