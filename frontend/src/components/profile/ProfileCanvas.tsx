// The public profile renderer — used full-page on /u/:username and inside the
// dashboard's live phone simulator. Renders from the theme the owner picked.
import { useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck, CalendarHeart, ExternalLink, Heart, MapPin, MessageCircle,
  Moon, Share2, Sun, ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { ShareModal } from "@/components/profile/ShareModal";
import { apiPost, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { visitorId } from "@/lib/visitor";
import { fontStack, themeOf } from "@/lib/themes";
import { platformDef } from "@/lib/platforms";
import type { Appearance, GalleryItem, ProfileBundle } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProfileCanvasProps {
  bundle: ProfileBundle;
  appearanceOverride?: Appearance;
  preview?: boolean; // inside the phone simulator — no tracking, no navigation
}

let activeGalleryItem: GalleryItem | null = null;
const galleryViewerSubscribers = new Set<() => void>();

function subscribeToGalleryViewer(onChange: () => void) {
  galleryViewerSubscribers.add(onChange);
  return () => galleryViewerSubscribers.delete(onChange);
}

function openGalleryImage(item: GalleryItem) {
  activeGalleryItem = item;
  galleryViewerSubscribers.forEach((onChange) => onChange());
}

function closeGalleryImage() {
  activeGalleryItem = null;
  galleryViewerSubscribers.forEach((onChange) => onChange());
}

function ExpandableGalleryImage({
  item,
  className,
}: {
  item: GalleryItem;
  className?: string;
}) {
  const alt = item.caption || "Gallery image";

  return (
    <button
      type="button"
      onClick={() => openGalleryImage(item)}
      className={cn("block w-full cursor-zoom-in overflow-hidden text-left", className)}
      aria-label={`View full-size image: ${alt}`}
      data-testid="gallery-image-trigger"
    >
      <img
        src={item.url}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        data-testid="gallery-item"
      />
    </button>
  );
}

export function GalleryImageViewer() {
  const item = useSyncExternalStore(
    subscribeToGalleryViewer,
    () => activeGalleryItem,
    () => null,
  );
  const alt = item?.caption || "Gallery image";

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && closeGalleryImage()}>
      <DialogContent
        className="max-h-[92svh] overflow-hidden border-white/10 bg-[#0b0b0e]/95 p-3 text-white duration-0 data-open:animate-none data-closed:animate-none sm:max-w-5xl"
        overlayClassName="bg-black/80 duration-0 supports-backdrop-filter:backdrop-blur-none data-open:animate-none data-closed:animate-none"
        data-testid="gallery-image-viewer"
      >
        {item && (
          <>
            <DialogTitle className="sr-only">{alt}</DialogTitle>
            <DialogDescription className="sr-only">Full-size gallery image.</DialogDescription>
            <img
              key={item.url}
              src={item.url}
              alt={alt}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="mx-auto max-h-[82svh] max-w-full rounded-lg object-contain"
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProfileCanvas({ bundle, appearanceOverride, preview = false }: ProfileCanvasProps) {
  const { profile, links, gallery, poll, qa, followers, following } = bundle;
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const appearance = appearanceOverride ?? profile.appearance;
  const theme = useMemo(() => themeOf(appearance), [appearance]);
  const accent = appearance.accent || theme.accent;
  const cardShape = appearance.card_style ?? "rounded";

  const [shareOpen, setShareOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgName, setMsgName] = useState("");
  const [votedOption, setVotedOption] = useState<string | null>(null);
  const [hubLightMode, setHubLightMode] = useState(true);

  const socialLinks = links.filter((l) => platformDef(l.platform).social);
  const cardLinks = links.filter((l) => !platformDef(l.platform).social || l.description || l.thumbnail_url);

  const trackViewShare = (type: "share") => {
    if (preview) return;
    void apiPost(`/u/${profile.username}/events`, { type, ref: "" }).catch(() => undefined);
  };

  const clickLink = (linkId: string, url: string) => {
    if (preview) return;
    void apiPost(`/u/${profile.username}/links/${linkId}/click`, {}).catch(() => undefined);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const sendMessage = useMutation({
    mutationFn: () =>
      apiPost(`/u/${profile.username}/messages`, {
        content: msgText,
        sender_name: msgName || "Anonymous",
        visitor_id: visitorId(),
      }),
    onSuccess: () => {
      toast.success("Sent anonymously — they'll see it in their inbox");
      setMsgText("");
      setMsgName("");
      setMsgOpen(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.detail : "Couldn't send the message"),
  });

  const votePoll = useMutation({
    mutationFn: (optionId: string) =>
      apiPost(`/u/${profile.username}/polls/${poll!.id}/vote`, {
        option_id: optionId,
        voter_id: visitorId(),
      }),
    onSuccess: (_data, optionId) => {
      setVotedOption(optionId);
      toast.success("Vote counted");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.detail : "Vote failed"),
  });

  const toggleFollow = useMutation({
    mutationFn: () => apiPost<{ following: boolean; followers: number }>(`/u/${profile.username}/follow`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", profile.username] }),
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Sign in to follow creators");
        navigate("/auth");
      } else {
        toast.error("Couldn't follow right now");
      }
    },
  });

  const totalVotes = poll?.options.reduce((sum, o) => sum + o.votes, 0) ?? 0;
  const cardStyle = {
    background: theme.card,
    borderColor: theme.cardBorder,
    borderRadius: cardShape === "soft" ? 28 : cardShape === "editorial" ? 12 : cardShape === "glass" ? 24 : 20,
    borderWidth: cardShape === "editorial" || cardShape === "outline" ? 2 : 1,
    borderStyle: cardShape === "outline" ? "dashed" as const : "solid" as const,
    boxShadow: cardShape === "outline"
      ? `0 8px 26px ${accent}18`
      : cardShape === "glass"
        ? `0 12px 36px ${accent}24`
        : `0 8px 28px ${accent}0D`,
    ...(cardShape === "glass" ? { background: theme.card } : {}),
    backdropFilter: appearance.glass > 0 ? `blur(${appearance.glass * 4}px)` : undefined,
  };

  if (appearance.theme === "aura-editorial") {
    const memberSince = new Date(profile.created_at).toLocaleDateString("en", {
      month: "long",
      year: "numeric",
    });

    return (
      <div
        className={cn("relative overflow-hidden", preview ? "min-h-full" : "min-h-svh")}
        style={{ background: theme.bg, color: theme.text, fontFamily: fontStack(appearance.font) }}
        data-testid="profile-canvas"
        data-profile-layout="aura-editorial"
      >
        {appearance.effects && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(ellipse at 50% 0%, ${accent}12, transparent 48%)` }}
            aria-hidden
          />
        )}

        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="AURA home">
            <span className="grid size-8 place-items-center rounded-full bg-[#1f1f1f] text-sm font-bold text-white">A</span>
            <span className="font-heading text-sm font-bold tracking-tight">AURA</span>
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: theme.muted }}>
            Creator profile
          </span>
        </header>

        <main className={cn("relative mx-auto max-w-5xl px-3 pb-12 sm:px-6", preview ? "pt-1" : "pt-5 sm:pt-8")}>
          <article
            className="overflow-hidden rounded-[1.75rem] border shadow-[0_24px_70px_rgba(54,44,32,0.12)]"
            style={{ background: theme.card, borderColor: theme.cardBorder }}
          >
            <div className="flex h-11 items-center gap-3 border-b px-4 sm:px-5" style={{ borderColor: theme.cardBorder }}>
              <span className="flex gap-1.5" aria-hidden>
                <span className="size-2 rounded-full bg-rose-400" />
                <span className="size-2 rounded-full bg-amber-400" />
                <span className="size-2 rounded-full bg-emerald-400" />
              </span>
              <span
                className="min-w-0 flex-1 truncate rounded-lg px-3 py-1 text-center font-mono text-[10px]"
                style={{ background: theme.bg, color: theme.muted }}
              >
                aura.page/{profile.username}
              </span>
              <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] sm:block" style={{ color: theme.muted }}>
                AURA / PROFILE
              </span>
            </div>

            <section className="relative h-40 overflow-hidden sm:h-56" data-testid="profile-cover-area">
              {profile.cover_url ? (
                /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(profile.cover_url) ? (
                  <video src={profile.cover_url} className="size-full object-cover" autoPlay muted loop playsInline data-testid="profile-cover-video" />
                ) : (
                  <img src={profile.cover_url} alt="" className="size-full object-cover" data-testid="profile-cover" />
                )
              ) : (
                <div
                  className="size-full"
                  style={{
                    background: "radial-gradient(ellipse at 72% 20%, rgba(197,164,105,.34), transparent 40%), linear-gradient(125deg, #211e19 8%, #55462d 52%, #473a2d 100%)",
                  }}
                />
              )}
              <div className="absolute inset-0" style={{ background: theme.coverScrim }} />
              <div className="absolute -right-7 -top-20 size-56 rounded-full border border-white/10" aria-hidden />
              <div className="absolute right-8 top-5 size-36 rounded-full border border-white/10" aria-hidden />
              <div className="absolute bottom-3 left-5 flex items-end gap-3 sm:bottom-4 sm:left-7 sm:gap-4">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="size-[4.25rem] rounded-2xl border-4 object-cover shadow-xl sm:size-[4.5rem]"
                    style={{ borderColor: theme.card }}
                    data-testid="profile-avatar"
                  />
                ) : (
                  <span
                    className="grid size-[4.25rem] place-items-center rounded-2xl border-4 text-2xl font-bold text-white shadow-xl sm:size-[4.5rem]"
                    style={{ borderColor: theme.card, background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
                    data-testid="profile-avatar"
                  >
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="pb-1 text-white">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/65">AURA creator</p>
                  <p className="mt-1 text-xs font-medium">@{profile.username}</p>
                </div>
              </div>
            </section>

            <div className="space-y-6 px-5 pb-6 pt-5 sm:px-7 sm:pb-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl" data-testid="profile-name">
                    {profile.name}
                    {profile.plan !== "free" && (
                      <BadgeCheck className="ml-1.5 inline size-5 align-middle" style={{ color: "#1d9bf0" }} aria-label={`${profile.plan} member`} />
                    )}
                  </h1>
                  {profile.bio && (
                    <p className="mt-1.5 max-w-2xl text-sm leading-6" style={{ color: theme.muted }} data-testid="profile-bio">
                      {profile.bio}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.location && (
                      <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: theme.cardBorder, color: theme.muted }} data-testid="profile-location">
                        <MapPin className="mr-1 inline size-3" />{profile.location}
                      </span>
                    )}
                    {profile.interests.map((interest) => (
                      <span
                        key={interest}
                        className="rounded-full border px-3 py-1 text-xs"
                        style={{ background: theme.chipBg, borderColor: theme.cardBorder, color: theme.chipText }}
                        data-testid="profile-interest-chip"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
                <span
                  className="w-fit shrink-0 rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em]"
                  style={{ background: `${accent}12`, borderColor: `${accent}35`, color: accent }}
                >
                  The creator edit
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2" data-testid="profile-actions-row">
                <Button
                  size="sm"
                  className="rounded-full px-4 text-white"
                  style={{ background: accent, boxShadow: `0 7px 20px ${accent}30` }}
                  onClick={() => setMsgOpen((open) => !open)}
                  data-testid="anonymous-message-open-button"
                >
                  <MessageCircle className="size-4" /> Say hello
                </Button>
                {!(me?.username === profile.username) && !preview && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full border"
                    style={{ borderColor: theme.cardBorder, color: theme.text }}
                    onClick={() => toggleFollow.mutate()}
                    disabled={toggleFollow.isPending}
                    data-testid="follow-button"
                  >
                    <Heart className="size-4" fill={following ? accent : "none"} />
                    {following ? "Following" : "Follow"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full border"
                  style={{ borderColor: theme.cardBorder, color: theme.text }}
                  onClick={() => {
                    setShareOpen(true);
                    trackViewShare("share");
                  }}
                  data-testid="profile-share-button"
                >
                  <Share2 className="size-4" /> Share
                </Button>
              </div>

              {msgOpen && (
                <section className="rounded-2xl border p-4" style={cardStyle} data-testid="message-form">
                  {profile.daily_question && (
                    <p className="mb-3 flex items-start gap-2 text-sm font-medium" data-testid="daily-question">
                      <CalendarHeart className="mt-0.5 size-4 shrink-0" style={{ color: accent }} />
                      {profile.daily_question}
                    </p>
                  )}
                  <Textarea
                    value={msgText}
                    onChange={(event) => setMsgText(event.target.value)}
                    placeholder="Write something nice, curious or unhinged — it’s anonymous…"
                    rows={3}
                    maxLength={500}
                    data-testid="message-content-input"
                  />
                  <Input
                    className="mt-2"
                    value={msgName}
                    onChange={(event) => setMsgName(event.target.value)}
                    placeholder="Name (optional)"
                    maxLength={30}
                    data-testid="message-name-input"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs" style={{ color: theme.muted }}>{msgText.length}/500</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setMsgOpen(false)} data-testid="message-cancel-button">Cancel</Button>
                      <Button
                        size="sm"
                        className="text-white"
                        style={{ background: accent }}
                        disabled={sendMessage.isPending || msgText.trim().length < 2}
                        onClick={() => sendMessage.mutate()}
                        data-testid="message-send-button"
                      >
                        {sendMessage.isPending ? "Sending…" : "Send anonymously"}
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              {!preview && socialLinks.length > 0 && (
                <div className="flex flex-wrap gap-2" data-testid="social-links-row">
                  {socialLinks.map((link) => {
                    const def = platformDef(link.platform);
                    const Icon = def.icon;
                    return (
                      <a
                        key={link.id}
                        href={preview ? undefined : link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${def.label} — ${link.title}`}
                        title={def.label}
                        onClick={(event) => {
                          if (preview) event.preventDefault();
                          else void apiPost(`/u/${profile.username}/links/${link.id}/click`, {}).catch(() => undefined);
                        }}
                        className="grid size-9 place-items-center rounded-xl border transition-transform hover:-translate-y-0.5"
                        style={{ borderColor: theme.cardBorder, background: theme.bg, color: def.color }}
                      >
                        {link.icon_url ? <img src={link.icon_url} alt="" className="size-4 rounded object-cover" /> : <Icon size={16} />}
                      </a>
                    );
                  })}
                </div>
              )}

              {links.length > 0 && (
                <section aria-label="Profile links">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-heading text-sm font-bold">Find me around the web</h2>
                    <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: theme.muted }}>{links.length} links</span>
                  </div>
                  <div className={cn("grid gap-2.5", !preview && "sm:grid-cols-2")}>
                    {links.map((link) => {
                      const Icon = platformDef(link.platform).icon;
                      return (
                        <button
                          key={link.id}
                          type="button"
                          onClick={() => clickLink(link.id, link.url)}
                          className="group flex min-h-14 items-center gap-3 rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                          style={{ ...cardStyle, background: "transparent" }}
                          data-testid={`link-card-${link.id}`}
                        >
                          {link.thumbnail_url ? (
                            <img src={link.thumbnail_url} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
                          ) : link.icon_url ? (
                            <img src={link.icon_url} alt="" className="size-11 shrink-0 rounded-xl border object-cover" style={{ borderColor: theme.cardBorder }} />
                          ) : (
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `${accent}16`, color: accent }}>
                              <Icon size={18} />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold" data-testid="link-card-title">{link.title}</span>
                            {link.description && <span className="mt-0.5 block truncate text-xs" style={{ color: theme.muted }}>{link.description}</span>}
                          </span>
                          <ExternalLink className="size-4 shrink-0" style={{ color: theme.muted }} />
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {gallery.length > 0 && (
                <section className="border-t pt-5" style={{ borderColor: theme.cardBorder }} data-testid="profile-gallery">
                  <h2 className="mb-3 font-heading text-sm font-bold">A little more you</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {gallery.map((item) => (
                      <figure key={item.id} className="overflow-hidden rounded-xl" data-testid="gallery-item">
                        <ExpandableGalleryImage item={item} className="aspect-square" />
                        {item.caption && <figcaption className="truncate px-2 py-1.5 text-[10px]" style={{ color: theme.muted }}>{item.caption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                </section>
              )}

              {poll && (
                <section className="rounded-2xl border p-4" style={cardStyle} data-testid="poll-widget">
                  <h2 className="font-heading text-sm font-bold">Join the conversation</h2>
                  <p className="mb-3 mt-1 text-sm" data-testid="poll-question">{poll.question}</p>
                  <div className="space-y-2">
                    {poll.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => !preview && !votedOption && votePoll.mutate(option.id)}
                        disabled={preview || !!votedOption || votePoll.isPending}
                        className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm disabled:cursor-default"
                        style={{ borderColor: theme.cardBorder, background: votedOption === option.id ? `${accent}18` : theme.bg }}
                        data-testid={`poll-option-${option.id}`}
                      >
                        <span>{option.text}</span>
                        {votedOption && <span className="text-xs" style={{ color: theme.muted }}>{option.votes} votes</span>}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {qa.length > 0 && (
                <section className="border-t pt-5" style={{ borderColor: theme.cardBorder }} data-testid="qa-wall">
                  <h2 className="mb-3 font-heading text-sm font-bold">From the community</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {qa.slice(0, 4).map((item) => (
                      <article key={item.id} className="rounded-xl border p-3" style={cardStyle} data-testid="qa-item">
                        <p className="text-xs" style={{ color: theme.muted }}>{item.sender_name} asked</p>
                        <p className="mt-1 text-sm font-medium" data-testid="qa-question">{item.content}</p>
                        <p className="mt-2 border-l-2 pl-2.5 text-sm" style={{ borderColor: accent, color: theme.muted }} data-testid="qa-answer">{item.answer}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {profile.music.length > 0 && (
                <section className="border-t pt-5" style={{ borderColor: theme.cardBorder }} data-testid="music-widget">
                  <h2 className="mb-2 font-heading text-sm font-bold">On repeat</h2>
                  <ul className="space-y-2">
                    {profile.music.map((track, index) => (
                      <li key={`${track.title}-${index}`}>
                        <a
                          href={preview ? undefined : track.url || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => preview && event.preventDefault()}
                          className="flex items-center gap-3 rounded-xl border px-3 py-2"
                          style={{ borderColor: theme.cardBorder }}
                        >
                          <span className="grid size-8 place-items-center rounded-lg" style={{ background: `${accent}16`, color: accent }}>♪</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{track.title}</span>
                            <span className="block truncate text-xs" style={{ color: theme.muted }}>{track.artist}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </article>

          <footer className="flex flex-col items-center justify-between gap-2 px-2 py-5 text-[10px] sm:flex-row" style={{ color: theme.muted }}>
            <span className="font-mono uppercase tracking-[0.16em]">A little more you, everywhere</span>
            <span>Member since {memberSince} · Made with AURA</span>
          </footer>
        </main>

        <ShareModal open={shareOpen} onOpenChange={setShareOpen} username={profile.username} name={profile.name} />
      </div>
    );
  }

  if (appearance.theme === "creator-hub" || !preview || appearanceOverride) {
    const hubText = hubLightMode ? "#201b27" : "#F7F4FF";
    const hubPanelStyle = {
      ...cardStyle,
      background: hubLightMode
        ? "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,244,251,0.96))"
        : "linear-gradient(145deg, rgba(20,20,25,0.96), rgba(12,12,16,0.96))",
      borderColor: hubLightMode ? "rgba(65,49,82,0.14)" : "rgba(255,255,255,0.1)",
      boxShadow: hubLightMode
        ? `0 18px 50px rgba(66,48,82,0.10), 0 0 30px ${accent}0D`
        : `0 18px 60px rgba(0,0,0,0.3), inset 0 1px rgba(255,255,255,0.035), 0 0 30px ${accent}0D`,
    };
    const profileSince = new Date(profile.created_at).toLocaleDateString("en", { month: "long", year: "numeric" });

    return (
      <div
        className={cn("creator-hub relative min-h-svh overflow-hidden", hubLightMode && "creator-hub-light")}
        style={{
          fontFamily: fontStack(appearance.font),
          background: hubLightMode
            ? "radial-gradient(ellipse at 50% 0%, #fff 0%, #f3eee8 62%)"
            : "radial-gradient(ellipse at 50% 0%, #11101a 0%, #08080b 48rem)",
          color: hubText,
        }}
        data-testid="profile-canvas"
        data-profile-layout="creator-hub"
        data-preview={preview}
        data-color-mode={hubLightMode ? "light" : "dark"}
      >
        {appearance.effects && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden data-testid="profile-ambient-effects">
            <div className="profile-effect-wash absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 8%, ${accent}12, transparent 42%)` }} />
          </div>
        )}

        <main className={cn(
          "relative mx-auto grid w-full max-w-[1440px] items-start gap-4 pb-24",
          preview
            ? "grid-cols-1 px-3 pt-9"
            : "grid-cols-1 px-4 pt-5 sm:gap-5 sm:px-6 lg:grid-cols-12 lg:px-8",
        )}>
          <header className={cn("flex items-center justify-between", !preview && "lg:col-span-12")}>
            <Link
              to="/"
              className={cn("inline-flex items-center gap-2.5 text-sm font-bold tracking-wide", hubLightMode ? "text-[#201b27]" : "text-white")}
              aria-label="AURA home"
              data-testid="profile-home-link"
            >
              <span className={cn(
                "creator-hub-logo-mark grid size-8 place-items-center rounded-full text-sm font-black",
                hubLightMode ? "bg-[#201b27] text-white" : "bg-white text-[#201b27]",
              )}>A</span>
              <span>AURA <span className="ml-1 font-mono text-[10px] font-medium tracking-[0.18em] text-white/45">STUDIO</span></span>
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHubLightMode((light) => !light)}
                className={cn(
                  "grid size-9 place-items-center rounded-full border transition-colors",
                  hubLightMode
                    ? "border-[#342d3b]/15 bg-[#342d3b]/5 text-[#342d3b] hover:bg-[#342d3b]/10"
                    : "border-white/15 bg-white/[0.04] text-white hover:bg-white/10",
                )}
                aria-label={hubLightMode ? "Switch profile to dark theme" : "Switch profile to light theme"}
                title={hubLightMode ? "Switch to dark theme" : "Switch to light theme"}
                data-testid="creator-hub-theme-toggle"
              >
                {hubLightMode ? <Moon className="size-4" /> : <Sun className="size-4" />}
              </button>
              {!preview && socialLinks.length > 0 && (
                <a
                  href={preview ? undefined : socialLinks[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => {
                    if (preview) event.preventDefault();
                    else void apiPost(`/u/${profile.username}/links/${socialLinks[0].id}/click`, {}).catch(() => undefined);
                  }}
                  className="hidden items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/35 sm:inline-flex"
                >
                  Let’s connect <ExternalLink className="size-3.5" />
                </a>
              )}
              <Button
                size="sm"
                className={cn("hub-primary-button rounded-full text-white", preview ? "size-9 p-0" : "px-4")}
                style={{ background: `linear-gradient(110deg, ${accent}, #C056E8)` }}
                onClick={() => setMsgOpen(true)}
                aria-label="Say hello"
                title="Say hello"
              >
                <MessageCircle className="size-4" />
                {!preview && "Say hello"}
              </Button>
            </div>
          </header>

          <section
            className={cn(
              "relative isolate flex flex-col justify-center overflow-hidden",
              preview
                ? "min-h-0 gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-3"
                : "min-h-[400px] p-4 sm:min-h-[430px] sm:p-7 lg:col-span-8 lg:p-8",
            )}
            data-testid="creator-hub-hero"
          >
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white/[0.015] via-transparent to-violet-500/[0.04]" />
            <div className={cn(
              "grid min-w-0 items-center gap-5",
              preview ? "grid-cols-1" : "sm:grid-cols-[minmax(0,1fr)_minmax(210px,0.9fr)] lg:gap-2",
            )}>
              <div className={cn("min-w-0", preview ? "order-1 text-center" : "order-2 text-center sm:order-1 sm:text-left")}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/75">
                  <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#34D399]" />
                  Online · Always here
                </span>
                <h1 className={cn(
                  "mt-5 break-words font-extrabold leading-[0.98] tracking-[-0.06em]",
                  preview ? "text-2xl" : "text-4xl sm:text-5xl lg:text-[3.6rem]",
                )} data-testid="profile-name">
                  <span className="text-white">{profile.name}</span>
                  {profile.plan !== "free" && (
                    <BadgeCheck className="ml-2 inline size-5 align-middle sm:size-6" style={{ color: "#1d9bf0" }} aria-label={`${profile.plan} member`} />
                  )}
                </h1>
                <p className="mt-3 text-sm font-semibold text-white/85">
                  {profile.interests.slice(0, 3).join(" · ") || "Creator · Explorer · Dreamer"}
                </p>
                <p className="mt-1 font-mono text-xs text-white/45" data-testid="profile-username">@{profile.username}</p>
                <p className={cn("max-w-xl text-sm leading-6 text-white/65 sm:text-base sm:leading-7", preview ? "mt-3" : "mt-4")} data-testid="profile-bio">
                  {profile.bio || `A little about ${profile.name} — explore my links, projects, and latest updates.`}
                </p>

                <div className={cn("flex flex-wrap justify-center sm:justify-start", preview ? "mt-3 gap-1.5" : "mt-5 gap-2")}>
                  {[
                    { label: "Links", value: links.length },
                    { label: "Projects", value: gallery.length },
                    { label: "Followers", value: followers },
                  ].map((stat) => (
                    <span
                      key={stat.label}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] text-white/65",
                        preview ? "min-w-0 gap-1 px-2 py-1.5 text-[11px]" : "min-w-24 px-3 py-2 text-xs",
                      )}
                    >
                      <span className="font-semibold text-white">{stat.value}</span> {stat.label}
                    </span>
                  ))}
                </div>

                <div className={cn("flex flex-wrap justify-center sm:justify-start", preview ? "mt-4 gap-2" : "mt-6 gap-2.5")}>
                  <Button
                    size="sm"
                    className="rounded-full px-5 text-white shadow-lg"
                    style={{ background: `linear-gradient(110deg, ${accent}, #C056E8)`, boxShadow: `0 8px 28px ${accent}55` }}
                    onClick={() => document.getElementById("creator-hub-links")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    <ExternalLink className="size-4" /> Explore links
                  </Button>
                  {!preview && !(me?.username === profile.username) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full border border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                      onClick={() => toggleFollow.mutate()}
                      disabled={toggleFollow.isPending}
                      data-testid="follow-button"
                    >
                      <Heart className="size-4" fill={following ? accent : "none"} />
                      {following ? "Following" : "Follow"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full border border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setShareOpen(true);
                      trackViewShare("share");
                    }}
                    data-testid="profile-share-button"
                  >
                    <Share2 className="size-4" /> Share
                  </Button>
                </div>
              </div>

              <div className={cn("flex justify-center", preview ? "order-2" : "order-1 sm:order-2 sm:justify-end")}>
                <div className={cn(
                  "creator-hub-avatar-stage relative grid w-full place-items-center",
                  preview ? "h-[200px] max-w-full" : "h-[20rem] max-w-[19rem] sm:h-[22rem] lg:h-[24rem]",
                )}
                  style={{ perspective: "900px", transformStyle: "preserve-3d" }}
                >
                  <div className="creator-hub-orbit-ring creator-hub-orbit-ring-wide absolute inset-x-[-18%] top-1/2 h-28 -translate-y-1/2 rotate-[-14deg] rounded-[50%] border border-violet-200/25" />
                  <div className="creator-hub-orbit-ring absolute inset-x-[-12%] top-1/2 h-40 -translate-y-1/2 rotate-[12deg] rounded-[50%] border border-dashed border-white/10" />
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.name}
                      className="absolute inset-y-0 left-1/2 h-full w-[86%] object-contain grayscale [mask-image:linear-gradient(to_bottom,#000_82%,transparent)]"
                      style={{ transform: "translateX(-50%) translateZ(0)" }}
                      data-testid="profile-avatar"
                    />
                  ) : (
                    <div className="relative grid h-full w-[70%] place-items-center text-8xl font-extrabold text-white/90" style={{ transform: "translateZ(0)" }} data-testid="profile-avatar" aria-hidden="true">
                      {profile.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {socialLinks.slice(0, 8).map((link, index) => {
                    const def = platformDef(link.platform);
                    const Icon = def.icon;
                    const orbitIndex = index % 3;
                    return (
                      <span
                        key={`orbit-${link.id}`}
                        className="creator-hub-orbit absolute left-1/2 top-1/2"
                        style={{
                          "--orbit-angle": `${index * 45}deg`,
                          "--orbit-tilt": `${[58, -58, 76][orbitIndex]}deg`,
                          "--orbit-radius": preview
                            ? `${[62, 74, 86][orbitIndex]}px`
                            : `${[112, 132, 152][orbitIndex]}px`,
                        } as CSSProperties}
                      >
                        <a
                          href={preview ? undefined : link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${def.label} — ${link.title}`}
                          title={def.label}
                          onClick={(event) => {
                            if (preview) event.preventDefault();
                            else void apiPost(`/u/${profile.username}/links/${link.id}/click`, {}).catch(() => undefined);
                          }}
                          className="creator-hub-orbit-icon grid size-10 place-items-center rounded-2xl border border-white/15 bg-[#111116]/90 shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur transition hover:scale-110 hover:border-violet-300/50 sm:size-11"
                          style={{ color: def.color }}
                        >
                          <Icon size={20} />
                        </a>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className={cn("rounded-[1.75rem] border p-4 backdrop-blur-xl sm:p-6", !preview && "lg:col-span-4")} style={hubPanelStyle} data-testid="creator-hub-about">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-bold">About me</h2>
              {profile.plan !== "free" && <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-200">{profile.plan}</span>}
            </div>
            <p className="mt-4 text-sm leading-6 text-white/65">
              {profile.bio || `Explore ${profile.name}’s links, work, and latest updates.`}
            </p>
            <div className="mt-5 space-y-3 border-t border-white/10 pt-4 text-sm">
              {profile.location && (
                <p className="flex items-center gap-3 text-white/75"><MapPin className="size-4 text-violet-300" /> <span className="text-white/45">Location</span><span className="ml-auto text-right">{profile.location}</span></p>
              )}
              <p className="flex items-center gap-3 text-white/75"><CalendarHeart className="size-4 text-violet-300" /> <span className="text-white/45">Member since</span><span className="ml-auto">{profileSince}</span></p>
              <p className="flex items-center gap-3 text-white/75"><ExternalLink className="size-4 text-violet-300" /> <span className="text-white/45">Destinations</span><span className="ml-auto">{links.length} links</span></p>
            </div>
            {profile.interests.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.interests.map((interest) => (
                  <span key={interest} className="rounded-full border border-violet-200/10 bg-violet-300/[0.08] px-2.5 py-1 text-xs text-violet-100/80">{interest}</span>
                ))}
              </div>
            )}
          </section>

          <section id="creator-hub-links" className={cn("rounded-[1.75rem] border p-4 backdrop-blur-xl sm:p-6", !preview && "lg:col-span-4")} style={hubPanelStyle} data-testid="creator-hub-links">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-bold">My universe</h2>
                <p className="mt-1 text-xs text-white/45">Find me around the web</p>
              </div>
              <span className="grid size-9 place-items-center rounded-xl bg-violet-400/10 text-violet-200"><ExternalLink className="size-4" /></span>
            </div>
            {socialLinks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {socialLinks.map((link) => {
                  const def = platformDef(link.platform);
                  const Icon = def.icon;
                  return (
                    <a
                      key={link.id}
                      href={preview ? undefined : link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${def.label} — ${link.title}`}
                      title={def.label}
                      onClick={(event) => {
                        if (preview) event.preventDefault();
                        else void apiPost(`/u/${profile.username}/links/${link.id}/click`, {}).catch(() => undefined);
                      }}
                      className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.045] transition-colors hover:border-violet-300/40 hover:bg-violet-400/10"
                      style={{ color: def.color }}
                    >
                      <Icon size={18} />
                    </a>
                  );
                })}
              </div>
            )}
            <div className="mt-4 space-y-2.5">
              {links.length ? links.map((link) => {
                const Icon = platformDef(link.platform).icon;
                return (
                  <a
                    key={link.id}
                    href={preview ? undefined : link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => {
                      if (preview) event.preventDefault();
                      else void apiPost(`/u/${profile.username}/links/${link.id}/click`, {}).catch(() => undefined);
                    }}
                    className="group flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-violet-300/35 hover:bg-white/[0.09] hover:shadow-[0_10px_28px_rgba(0,0,0,0.24)]"
                    data-testid={`link-card-${link.id}`}
                  >
                    {link.icon_url ? (
                      <img src={link.icon_url} alt="" className="size-9 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${accent}, #C056E8)` }}>
                        <Icon size={17} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white/90">{link.title}</span>
                      {link.description && <span className="block truncate text-xs text-white/45">{link.description}</span>}
                    </span>
                    <ExternalLink className="size-4 shrink-0 text-white/35 transition-colors group-hover:text-violet-200" />
                  </a>
                );
              }) : (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/45">Links will appear here.</p>
              )}
            </div>
          </section>

          <section className={cn("rounded-[1.75rem] border p-4 backdrop-blur-xl sm:p-6", !preview && "lg:col-span-5")} style={hubPanelStyle} data-testid="profile-gallery">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-bold">My life</h2>
                <p className="mt-1 text-xs text-white/45">A glimpse into my world</p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">{gallery.length} moments</span>
            </div>
            {gallery.length ? (
              <div className={cn("grid grid-cols-2 gap-2", !preview && "sm:grid-cols-3")}>
                {gallery.map((item) => (
                  <figure key={item.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    <ExpandableGalleryImage item={item} className="aspect-square" />
                    {item.caption && <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-6 text-xs text-white/90">{item.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            ) : (
              <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-white/10 bg-black/10 px-5 text-center">
                <p className="text-sm text-white/45">Photos and projects will appear here.</p>
              </div>
            )}
          </section>

          <section className={cn("rounded-[1.75rem] border p-4 backdrop-blur-xl sm:p-6", !preview && "lg:col-span-3")} style={hubPanelStyle} data-testid="anonymous-message-box">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-heading text-lg font-bold"><MessageCircle className="size-4 text-violet-300" /> Anonymous ask</h2>
                <p className="mt-1 text-xs text-white/45">No name, no pressure. Just say hello.</p>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">Anonymous</span>
            </div>
            {profile.daily_question && <p className="mt-4 text-sm font-medium text-violet-100/80" data-testid="daily-question">{profile.daily_question}</p>}
            {msgOpen ? (
              <div className="mt-4 space-y-2.5">
                <Textarea
                  value={msgText}
                  onChange={(event) => setMsgText(event.target.value)}
                  placeholder="Type your question…"
                  rows={3}
                  maxLength={500}
                  data-testid="message-content-input"
                  className="border-white/10 bg-black/25 text-white placeholder:text-white/35"
                />
                <Input
                  value={msgName}
                  onChange={(event) => setMsgName(event.target.value)}
                  placeholder="Name (optional)"
                  maxLength={30}
                  data-testid="message-name-input"
                  className="border-white/10 bg-black/25 text-white placeholder:text-white/35"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-white/40">{msgText.length}/500</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="text-white/65 hover:bg-white/10 hover:text-white" onClick={() => setMsgOpen(false)} data-testid="message-cancel-button">Cancel</Button>
                    <Button
                      size="sm"
                      className="text-white"
                      style={{ background: accent }}
                      disabled={sendMessage.isPending || msgText.trim().length < 2}
                      onClick={() => sendMessage.mutate()}
                      data-testid="message-send-button"
                    >
                      {sendMessage.isPending ? "Sending…" : "Send"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMsgOpen(true)}
                className="mt-5 flex w-full items-center justify-between rounded-full border border-white/10 bg-black/25 px-4 py-3 text-left text-sm text-white/40 transition-colors hover:border-violet-300/35 hover:text-white/70"
              >
                Type your question…
                <span className="grid size-8 place-items-center rounded-full text-white" style={{ background: accent }}><MessageCircle className="size-4" /></span>
              </button>
            )}
          </section>

          {poll && (
            <section className={cn("rounded-[1.75rem] border p-4 backdrop-blur-xl sm:p-6", !preview && "lg:col-span-4")} style={hubPanelStyle} data-testid="poll-widget">
              <h2 className="font-heading text-lg font-bold">Join the conversation</h2>
              <p className="mb-4 mt-2 text-sm text-white/65" data-testid="poll-question">{poll.question}</p>
              <div className="space-y-2">
                {poll.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => !preview && !votedOption && votePoll.mutate(option.id)}
                    disabled={preview || !!votedOption || votePoll.isPending}
                    className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default"
                    style={{ borderColor: theme.cardBorder, background: votedOption === option.id ? `${accent}25` : "rgba(255,255,255,0.04)", color: theme.text }}
                    data-testid={`poll-option-${option.id}`}
                  >
                    <span>{option.text}</span>
                    {votedOption && <span className="text-xs text-white/50">{option.votes} votes</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {qa.length > 0 && (
            <section className={cn("rounded-[1.75rem] border p-4 backdrop-blur-xl sm:p-6", !preview && "lg:col-span-8")} style={hubPanelStyle} data-testid="qa-wall">
              <h2 className="font-heading text-lg font-bold">From the community</h2>
              <div className={cn("mt-4 grid gap-3", !preview && "sm:grid-cols-2")}>
                {qa.slice(0, 4).map((item) => (
                  <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" data-testid="qa-item">
                    <p className="text-xs text-violet-200/70">{item.sender_name} asked</p>
                    <p className="mt-1 text-sm font-medium text-white/85" data-testid="qa-question">{item.content}</p>
                    <p className="mt-3 border-l-2 border-violet-400/50 pl-3 text-sm leading-relaxed text-white/60" data-testid="qa-answer">{item.answer}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {profile.music.length > 0 && (
            <section className={cn("rounded-[1.75rem] border p-4 backdrop-blur-xl sm:p-6", !preview && "lg:col-span-4")} style={hubPanelStyle} data-testid="music-widget">
              <h2 className="font-heading text-lg font-bold">On repeat</h2>
              <ul className="mt-3 space-y-2">
                {profile.music.map((track, index) => (
                  <li key={`${track.title}-${index}`}>
                    <a
                      href={preview ? undefined : track.url || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => preview && event.preventDefault()}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                      data-testid="music-track"
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-violet-400/10 text-violet-200">♪</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white/85">{track.title}</span>
                        <span className="block truncate text-xs text-white/45">{track.artist}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className={cn("flex flex-col items-center justify-between gap-4 rounded-full border border-white/10 bg-black/20 px-5 py-4 text-xs text-white/45 backdrop-blur sm:flex-row", !preview && "lg:col-span-12")}>
            <span>{profile.location || "AURA creator"} · Member since {profileSince}</span>
            <span className="flex items-center gap-1">
              Built with <Heart className="size-3 text-violet-300" /> AURA
              {!preview && <Link to="/pricing" className="ml-2 underline underline-offset-4" data-testid="profile-footer-pricing-link">Create yours</Link>}
            </span>
            {socialLinks.length > 0 && (
              <span className="flex items-center gap-2">
                {socialLinks.slice(0, 6).map((link) => {
                  const Icon = platformDef(link.platform).icon;
                  return (
                    <a
                      key={`footer-${link.id}`}
                      href={preview ? undefined : link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${platformDef(link.platform).label} — ${link.title}`}
                      onClick={(event) => preview && event.preventDefault()}
                      className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] hover:text-violet-200"
                    >
                      <Icon size={15} />
                    </a>
                  );
                })}
              </span>
            )}
          </footer>
        </main>

        <ShareModal open={shareOpen} onOpenChange={setShareOpen} username={profile.username} name={profile.name} />
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden", preview ? "min-h-full" : "min-h-svh")}
      style={{ background: theme.bg, color: theme.text, fontFamily: fontStack(appearance.font) }}
      data-testid="profile-canvas"
    >
      {/* animated aurora backdrop */}
      {appearance.effects && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden data-testid="profile-ambient-effects">
          <div
            className="profile-effect-wash absolute inset-0"
            style={{ background: `radial-gradient(ellipse at 50% 14%, ${accent}20 0%, transparent 52%)` }}
          />
          <div
            className="aurora-blob absolute -top-24 left-[-12%] h-80 w-80 rounded-full opacity-35"
            style={{ background: accent }}
          />
          <div
            className="aurora-blob-slow absolute right-[-14%] top-[28rem] h-96 w-96 rounded-full opacity-20"
            style={{ background: "#EC4899" }}
          />
          <div
            className="aurora-blob absolute bottom-[-8rem] left-[12%] h-72 w-72 rounded-full opacity-15"
            style={{ background: "#38BDF8", animationDelay: "-6s" }}
          />
        </div>
      )}

      {/* cover */}
      <div className={cn("relative h-48 overflow-hidden sm:h-56", !preview && "lg:h-64")}>
        {profile.cover_url ? (
          /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(profile.cover_url) ? (
            <video
              src={profile.cover_url}
              className="size-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              data-testid="profile-cover-video"
            />
          ) : (
          <img
            src={profile.cover_url}
            alt=""
            className="h-full w-full object-cover"
            data-testid="profile-cover"
          />
          )
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-indigo-600/60 via-violet-600/50 to-pink-500/50" />
        )}
        <div className="absolute inset-0" style={{ background: theme.coverScrim, backdropFilter: "blur(2px)" }} />
        <div
          className="pointer-events-none absolute -bottom-12 left-[-12%] h-28 w-[124%] rounded-[50%_50%_0_0/75%_75%_0_0] blur-2xl"
          style={{ background: theme.surface, opacity: 0.94 }}
          aria-hidden
        />
      </div>

      <div
        className={cn(
          "relative mx-auto w-full space-y-5 px-4",
          preview
            ? "max-w-lg pb-10"
            : "max-w-2xl pb-28",
        )}
      >
        {/* identity block */}
        <div className="-mt-14 flex flex-col items-center text-center">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.name}
              className="size-24 rounded-full object-cover ring-4 shadow-xl"
              style={{ borderColor: accent, boxShadow: `0 8px 30px ${accent}55` }}
              data-testid="profile-avatar"
            />
          ) : (
            <div
              className="grid size-24 place-items-center rounded-full text-3xl font-bold ring-4"
              style={{ background: `${accent}33`, color: theme.text, borderColor: accent }}
            >
              {profile.name.charAt(0)}
            </div>
          )}
          <h1
            className="mt-3 flex items-center gap-1.5 text-2xl font-bold tracking-tight"
            data-testid="profile-name"
          >
            {profile.name}
            {profile.plan !== "free" && (
              <BadgeCheck className="size-5" style={{ color: "#1d9bf0" }} aria-label={`${profile.plan} member`} />
            )}
          </h1>
          <p className="font-mono text-sm" style={{ color: theme.muted }} data-testid="profile-username">
            @{profile.username}
          </p>
          {profile.bio && (
            <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: theme.text }} data-testid="profile-bio">
              {profile.bio}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
            {profile.location && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
                style={{ background: theme.chipBg, color: theme.chipText }}
                data-testid="profile-location"
              >
                <MapPin className="size-3" /> {profile.location}
              </span>
            )}
            {profile.interests.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2.5 py-1"
                style={{ background: theme.chipBg, color: theme.chipText }}
                data-testid="profile-interest-chip"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* actions */}
        <div className="flex items-center justify-center gap-2" data-testid="profile-actions-row">
          <Button
            size="sm"
            className="rounded-full text-white shadow-lg"
            style={{ background: accent, boxShadow: `0 8px 24px ${accent}44` }}
            onClick={() => {
              setMsgOpen((v) => !v);
            }}
            data-testid="anonymous-message-open-button"
          >
            <MessageCircle className="size-4" /> Send a message
          </Button>
          {!(me?.username === profile.username) && !preview && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              style={{ border: `1px solid ${theme.cardBorder}`, color: theme.text }}
              onClick={() => toggleFollow.mutate()}
              disabled={toggleFollow.isPending}
              data-testid="follow-button"
            >
              <Heart className="size-4" fill={following ? accent : "none"} />
              {following ? "Following" : "Follow"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            style={{ border: `1px solid ${theme.cardBorder}`, color: theme.text }}
            onClick={() => {
              setShareOpen(true);
              trackViewShare("share");
            }}
            data-testid="profile-share-button"
          >
            <Share2 className="size-4" /> Share
          </Button>
        </div>

        {/* social icon row */}
        {socialLinks.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2" data-testid="social-links-row">
            {socialLinks.map((link) => {
              const def = platformDef(link.platform);
              const Icon = def.icon;
              return (
                <a
                  key={link.id}
                  href={preview ? undefined : link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${def.label} — ${link.title}`}
                  title={def.label}
                  onClick={(e) => {
                    if (preview) e.preventDefault();
                    else void apiPost(`/u/${profile.username}/links/${link.id}/click`, {}).catch(() => undefined);
                  }}
                  className="link-card grid size-10 place-items-center rounded-full border"
                  style={{ ...cardStyle, color: def.color }}
                  data-testid={`social-link-${link.platform}`}
                >
                  {link.icon_url ? (
                    <img src={link.icon_url} alt="" className="size-5 rounded-full object-cover" />
                  ) : (
                    <Icon size={17} />
                  )}
                </a>
              );
            })}
          </div>
        )}

        {/* rich link cards */}
        {cardLinks.length > 0 && (
          <div className="space-y-3">
            {cardLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => clickLink(link.id, link.url)}
                className={cn(
                  "link-card w-full overflow-hidden rounded-2xl border text-left",
                  link.thumbnail_url ? "flex flex-col" : "flex items-center gap-3 p-3",
                )}
                style={cardStyle}
                data-testid={`link-card-${link.id}`}
              >
                {link.thumbnail_url && (
                  <img
                    src={link.thumbnail_url}
                    alt={`${link.title} cover`}
                    className="h-32 w-full object-cover"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                )}
                <span className={cn("flex w-full items-center gap-3", link.thumbnail_url && "p-3")}>
                  {link.icon_url ? (
                    <img
                      src={link.icon_url}
                      alt=""
                      className="size-11 shrink-0 rounded-xl border object-cover"
                      style={{ borderColor: theme.cardBorder }}
                    />
                  ) : (
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-white"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
                  >
                    {(() => {
                      const Icon = platformDef(link.platform).icon;
                      return <Icon size={20} color="#fff" />;
                    })()}
                  </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold" data-testid="link-card-title">
                      {link.title}
                    </span>
                    {link.description && (
                      <span className="block truncate text-xs" style={{ color: theme.muted }}>
                        {link.description}
                      </span>
                    )}
                  </span>
                  <ExternalLink className="size-4 shrink-0" style={{ color: theme.muted }} />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* gallery */}
        {gallery.length > 0 && (
          <section className="rounded-2xl border p-4" style={cardStyle} data-testid="profile-gallery">
            <h2 className="label-caps mb-3" style={{ color: theme.muted }}>
              Gallery
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((item) => (
                <figure key={item.id} className="group relative overflow-hidden rounded-xl">
                  <ExpandableGalleryImage item={item} className="aspect-square" />
                  {item.caption && (
                    <figcaption
                      className="absolute inset-x-0 bottom-0 truncate px-1.5 py-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
                    >
                      {item.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* music on repeat */}
        {profile.music.length > 0 && (
          <section className="rounded-2xl border p-4" style={cardStyle} data-testid="music-widget">
            <h2 className="label-caps mb-3" style={{ color: theme.muted }}>
              ♪ On repeat
            </h2>
            <ul className="space-y-2">
              {profile.music.map((track, i) => (
                <li key={`${track.title}-${i}`}>
                  <a
                    href={preview ? undefined : track.url || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => preview && e.preventDefault()}
                    className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors"
                    style={{ color: theme.text }}
                    data-testid="music-track"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-sm"
                      style={{ background: `${accent}22`, color: accent }}
                    >
                      ♪
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{track.title}</span>
                      {track.artist && (
                        <span className="block truncate text-xs" style={{ color: theme.muted }}>
                          {track.artist}
                        </span>
                      )}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* daily question + anonymous message box */}
        <section className="rounded-2xl border p-4" style={cardStyle} data-testid="anonymous-message-box">
          <h2 className="label-caps mb-2" style={{ color: theme.muted }}>
            Ask anything
          </h2>
          {profile.daily_question && (
            <p className="mb-3 flex items-start gap-2 text-sm font-medium" data-testid="daily-question">
              <CalendarHeart className="mt-0.5 size-4 shrink-0" style={{ color: accent }} />
              {profile.daily_question}
            </p>
          )}
          {msgOpen ? (
            <div className="space-y-2">
              <Textarea
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                placeholder="Write something nice, curious or unhinged — it's anonymous…"
                rows={3}
                maxLength={500}
                data-testid="message-content-input"
              />
              <Input
                value={msgName}
                onChange={(e) => setMsgName(e.target.value)}
                placeholder="Sign with a name (optional) — otherwise you stay anonymous"
                maxLength={30}
                data-testid="message-name-input"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: theme.muted }}>
                  {msgText.length}/500
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setMsgOpen(false)}
                    data-testid="message-cancel-button"
                    style={{ color: theme.text }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="text-white"
                    style={{ background: accent }}
                    disabled={sendMessage.isPending || msgText.trim().length < 2}
                    onClick={() => sendMessage.mutate()}
                    data-testid="message-send-button"
                  >
                    {sendMessage.isPending ? "Sending…" : "Send anonymously"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: theme.muted }}>
              Drop a question, a compliment or a dare — {profile.name} sees it privately first.
            </p>
          )}
        </section>

        {/* live poll */}
        {poll && (
          <section className="rounded-2xl border p-4" style={cardStyle} data-testid="poll-widget">
            <h2 className="label-caps mb-1" style={{ color: theme.muted }}>
              Poll of the day
            </h2>
            <p className="mb-3 text-sm font-semibold" data-testid="poll-question">
              {poll.question}
            </p>
            <div className="space-y-2" aria-live="polite">
              {poll.options.map((option) => {
                const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                const mine = votedOption === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => !votedOption && votePoll.mutate(option.id)}
                    className="relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition-all duration-300"
                    style={{
                      ...cardStyle,
                      borderColor: mine ? accent : theme.cardBorder,
                      cursor: votedOption ? "default" : "pointer",
                    }}
                    data-testid={`poll-option-${option.id}`}
                  >
                    {votedOption && (
                      <span
                        className="absolute inset-y-0 left-0 transition-all duration-500"
                        style={{ width: `${pct}%`, background: `${accent}22` }}
                        aria-hidden
                      />
                    )}
                    <span className="relative flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <ThumbsUp className="size-3.5" style={{ color: mine ? accent : theme.muted }} />
                        {option.text}
                      </span>
                      {votedOption && (
                        <span className="font-mono text-xs" style={{ color: theme.muted }}>
                          {pct}%
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {votedOption && (
              <p className="mt-2 text-xs" style={{ color: theme.muted }}>
                {totalVotes} votes so far
              </p>
            )}
          </section>
        )}

        {/* public Q&A wall */}
        {qa.length > 0 && (
          <section className="space-y-3" data-testid="qa-wall">
            <h2 className="label-caps px-1" style={{ color: theme.muted }}>
              Answered questions
            </h2>
            {qa.map((item) => (
              <article key={item.id} className="rounded-2xl border p-4" style={cardStyle} data-testid="qa-item">
                <p className="text-sm">
                  <span className="font-mono text-xs" style={{ color: accent }}>
                    Q
                  </span>{" "}
                  <span className="text-xs" style={{ color: theme.muted }}>
                    {item.sender_name} asked
                  </span>
                  <span className="mt-1 block font-medium" data-testid="qa-question">
                    {item.content}
                  </span>
                </p>
                <div className="mt-3 flex gap-2.5">
                  {profile.avatar_url && (
                    <img src={profile.avatar_url} alt="" className="size-7 shrink-0 rounded-full object-cover" />
                  )}
                  <p
                    className="rounded-2xl rounded-tl-md px-3 py-2 text-sm leading-relaxed"
                    style={{ background: `${accent}18` }}
                    data-testid="qa-answer"
                  >
                    {item.answer || "(answered — see their story)"}
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* footer */}
        <footer className="pt-2 text-center text-xs" style={{ color: theme.muted }}>
          <p>member since {new Date(profile.created_at).toLocaleDateString("en", { month: "long", year: "numeric" })}</p>
          <p className="mt-1 flex items-center justify-center gap-1">
            made with <Heart className="size-3" style={{ color: accent }} /> on AURA
            {!preview && (
              <Link to="/pricing" className="ml-1 underline" data-testid="profile-footer-pricing-link">
                get yours
              </Link>
            )}
          </p>
        </footer>
      </div>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        username={profile.username}
        name={profile.name}
      />
    </div>
  );
}
