import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight, BarChart3, Check, Eye, EyeOff, Heart, Image, Inbox, Link2, MousePointerClick,
  Trophy, Wand2,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PhoneFrame } from "@/components/shared/PhoneFrame";
import { ProfileCanvas } from "@/components/profile/ProfileCanvas";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { apiGet, apiPatch, ApiError } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { DEMO_ANALYTICS_SUMMARY, DEMO_PROFILE_BUNDLE } from "@/lib/demo";
import { useMe } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { AnalyticsSummary, MeProfile, ProfileBundle } from "@/lib/types";

export default function DashboardHome() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const leaderboardVisibility = useMutation({
    mutationFn: (visible: boolean) =>
      apiPatch<MeProfile>("/me/profile", { leaderboard_visible: visible }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["me"], updated);
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success(updated.leaderboard_visible ? "You’re on the creator rankings" : "You’ve left the creator rankings");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.detail : "Could not update your ranking preference");
    },
  });
  const exploreVisibility = useMutation({
    mutationFn: (visible: boolean) =>
      apiPatch<MeProfile>("/me/profile", { explore_visible: visible }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["me"], updated);
      void queryClient.invalidateQueries({ queryKey: ["explore"] });
      toast.success(updated.explore_visible ? "Your profile is visible in Explore" : "Your profile is hidden from Explore");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.detail : "Could not update your Explore visibility");
    },
  });
  const { data: analytics } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      try {
        return await apiGet<AnalyticsSummary>("/me/analytics");
      } catch {
        return DEMO_ANALYTICS_SUMMARY;
      }
    },
    enabled: !!me,
    retry: false,
    staleTime: 60_000,
  });
  const { data: bundle } = useQuery({
    queryKey: ["profile", me?.username, "dash"],
    queryFn: async () => {
      if (!me) return DEMO_PROFILE_BUNDLE;
      try {
        return await apiGet<ProfileBundle>(`/u/${me.username}`);
      } catch {
        return DEMO_PROFILE_BUNDLE;
      }
    },
    enabled: !!me,
    retry: false,
    staleTime: 60_000,
  });

  const metrics = [
    { label: "Profile views", value: analytics?.totals.profile_view ?? 0, icon: Eye, testid: "metric-views" },
    { label: "Link clicks", value: analytics?.totals.link_click ?? 0, icon: MousePointerClick, testid: "metric-clicks" },
    { label: "Messages", value: analytics?.totals.message_received ?? 0, icon: Inbox, testid: "metric-messages" },
    { label: "Followers", value: analytics?.followers ?? 0, icon: Heart, testid: "metric-followers" },
  ];

  const quick = [
    { to: "/dashboard/story-studio", label: "New story graphic", icon: Wand2, testid: "quick-story" },
    { to: "/dashboard/links", label: "Add a link", icon: Link2, testid: "quick-links" },
    { to: "/dashboard/showcase", label: "Add showcase content", icon: Image, testid: "quick-showcase" },
    { to: "/dashboard/analytics", label: "Deep analytics", icon: BarChart3, testid: "quick-analytics" },
  ];

  const checklist = [
    { done: !!me?.avatar_url, label: "Add a profile photo", detail: "A clear portrait helps people recognize you.", to: "/dashboard/customize" },
    { done: !!bundle && bundle.links.length > 0, label: "Add your first link", detail: "Make your important pages easy to find.", to: "/dashboard/links" },
    { done: !!bundle && bundle.gallery.length > 0, label: "Add a photo or moment", detail: "Show visitors what you create.", to: "/dashboard/showcase" },
  ];
  const completedChecklistItems = checklist.filter((item) => item.done).length;

  return (
    <DashboardShell active="Overview">
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,380px)]">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-8">
            <div className="pointer-events-none absolute -right-10 -top-14 size-48 rounded-full bg-primary/5 blur-3xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="label-caps mb-2 text-muted-foreground">Your creator studio</p>
                <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                  Hey {me?.name.split(" ")[0]}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Start with a few small steps. Your changes appear in the live preview.
                </p>
              </div>
              <Link
                to={`/u/${me?.username}`}
                className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3.5 py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                data-testid="overview-profile-url"
              >
                <span className="truncate">/u/{me?.username}</span>
                <ArrowUpRight className="size-3.5 shrink-0" />
              </Link>
            </div>
          </header>

          <Card className="border-primary/15 bg-card shadow-sm" data-testid="getting-started-card">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-heading font-bold">Your first steps</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {completedChecklistItems} of {checklist.length} complete · Do them in any order.
                  </p>
                </div>
                <span className="grid size-10 place-items-center rounded-2xl bg-primary/8 text-primary">
                  <Check className="size-5" />
                </span>
              </div>
              <div
                className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Getting started progress"
                aria-valuemin={0}
                aria-valuemax={checklist.length}
                aria-valuenow={completedChecklistItems}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${(completedChecklistItems / checklist.length) * 100}%` }}
                />
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                {checklist.map((item) => (
                  <li key={item.label} className="min-w-0">
                    <Link
                      to={item.to}
                      className="flex h-full min-h-20 items-start gap-2.5 rounded-xl bg-muted/50 px-3 py-3 transition-colors hover:bg-muted"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px]",
                          item.done ? "border-emerald-500 bg-emerald-500 text-white" : "text-muted-foreground"
                        )}
                        aria-hidden
                      >
                        {item.done ? <Check className="size-3" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-snug">{item.label}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map((m) => (
              <Card key={m.label} size="sm" className="group border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
                <CardContent className="p-3.5 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-8 place-items-center rounded-xl bg-primary/8 text-primary">
                      <m.icon className="size-4" />
                    </span>
                    <span className="label-caps text-[9px] text-muted-foreground">14 days</span>
                  </div>
                  <p className="mt-3 font-heading text-2xl font-bold tracking-tight sm:text-[1.7rem]" data-testid={m.testid}>
                    {m.value.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* pending messages nudge + quick actions */}
          <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/8 text-primary">
                  <Inbox className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-heading font-bold">
                    {analytics?.messages_pending
                      ? `${analytics.messages_pending} anonymous message${analytics.messages_pending > 1 ? "s" : ""} waiting`
                      : "Inbox zero — for now"}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {analytics?.messages_pending
                      ? "Moderate them, answer publicly, or turn the best into a story."
                      : "Share your profile to get the anonymous messages flowing."}
                  </p>
                </div>
              </div>
              <Link
                to="/dashboard/messages"
                className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
                data-testid="overview-open-inbox-button"
              >
                Open inbox <ArrowUpRight className="size-4" />
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card shadow-sm">
            <CardContent className="flex items-start gap-3.5 p-4 sm:p-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">
                {me?.explore_visible !== false
                  ? <Eye className="size-4" aria-hidden="true" />
                  : <EyeOff className="size-4" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <label htmlFor="explore-visible" className="cursor-pointer text-sm font-semibold">
                    Show my profile in Explore
                  </label>
                  <Checkbox
                    id="explore-visible"
                    checked={me?.explore_visible !== false}
                    disabled={exploreVisibility.isPending}
                    onCheckedChange={(checked) => exploreVisibility.mutate(checked === true)}
                    data-testid="explore-visibility-checkbox"
                  />
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {me?.explore_visible === false
                    ? "Hidden from Explore. Your profile link still works."
                    : "Visible to everyone in Explore. Turn this off to hide your profile there."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card shadow-sm">
            <CardContent className="flex items-start gap-3.5 p-4 sm:p-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">
                <Trophy className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <label htmlFor="leaderboard-visible" className="cursor-pointer text-sm font-semibold">
                    Show my profile in creator rankings
                  </label>
                  <Checkbox
                    id="leaderboard-visible"
                    checked={me?.leaderboard_visible ?? false}
                    disabled={leaderboardVisibility.isPending}
                    onCheckedChange={(checked) => leaderboardVisibility.mutate(checked === true)}
                    data-testid="leaderboard-visibility-checkbox"
                  />
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Opt in to a 14-day ranking by link clicks and poll votes. Profile views and
                  all-time followers appear as context. You can change this any time.
                </p>
                <Link to="/leaderboard" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  View the rankings <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <section aria-label="Quick actions">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-base font-bold tracking-tight">Make it yours</h2>
              <span className="label-caps text-muted-foreground">Quick actions</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quick.map((q) => (
                <Link
                  key={q.to}
                  to={q.to}
                  className="link-card group flex min-h-28 flex-col items-center justify-center gap-2.5 rounded-2xl border border-border/70 bg-card p-3 text-center text-xs font-semibold shadow-sm sm:min-h-32 sm:p-4 sm:text-sm"
                  data-testid={q.testid}
                >
                  <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary transition-transform group-hover:scale-105">
                    <q.icon className="size-[18px]" />
                  </span>
                  {q.label}
                </Link>
              ))}
            </div>
          </section>

        </div>

        {/* live phone preview */}
        <div className="min-w-0 xl:sticky xl:top-20">
          <section className="rounded-3xl border border-border/70 bg-card/70 p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="label-caps text-muted-foreground">Live preview</p>
                <p className="mt-1 text-xs text-muted-foreground">Your page, as visitors see it</p>
              </div>
              <Link
                to={`/u/${me?.username}`}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-9 shrink-0 rounded-full")}
                aria-label="Open your public profile"
                data-testid="overview-preview-profile-button"
              >
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
            {bundle ? (
              <PhoneFrame>
                <ProfileCanvas bundle={bundle} appearanceOverride={bundle.profile.appearance} preview />
              </PhoneFrame>
            ) : (
              <PhoneFrame>
                <div className="min-h-full animate-pulse bg-background p-5 pt-14">
                  <div className="h-28 rounded-2xl bg-muted" />
                  <div className="mx-auto -mt-10 size-20 rounded-full border-4 border-background bg-muted" />
                  <div className="mx-auto mt-3 h-4 w-2/3 rounded-full bg-muted" />
                  <div className="mx-auto mt-2 h-3 w-1/2 rounded-full bg-muted" />
                  <div className="mt-7 space-y-3">
                    <div className="h-12 rounded-xl bg-muted" />
                    <div className="h-12 rounded-xl bg-muted" />
                    <div className="h-12 rounded-xl bg-muted" />
                  </div>
                </div>
              </PhoneFrame>
            )}
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Public profile <span className="font-mono">/u/{me?.username}</span>
            </p>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
