import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight, BarChart3, Eye, Heart, Inbox, Link2, LoaderCircle,
  MessageCircle, MousePointerClick, RefreshCw, Share2, Vote,
} from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { AnalyticsSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function dateLabel(date: string): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}

function fullDateLabel(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export default function DashboardAnalytics() {
  const { data: me } = useMe();
  const analyticsQuery = useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiGet<AnalyticsSummary>("/me/analytics"),
    enabled: !!me,
    staleTime: 60_000,
    retry: false,
  });
  const analytics = analyticsQuery.data;
  const totals = analytics?.totals;
  const days = analytics?.days ?? [];
  const peakDay = days.reduce(
    (peak, day) => (day.views > peak.views ? day : peak),
    { date: "", views: 0 },
  );
  const maxLinkClicks = Math.max(1, ...(analytics?.top_links.map((link) => link.clicks) ?? []));
  const hasActivity = Boolean(
    totals && (
      totals.profile_view || totals.link_click || totals.message_received ||
      totals.poll_vote || totals.share
    ),
  );

  const metrics = [
    { label: "Profile views", value: totals?.profile_view ?? 0, icon: Eye, tone: "text-sky-600 bg-sky-500/10" },
    { label: "Link clicks", value: totals?.link_click ?? 0, icon: MousePointerClick, tone: "text-violet-600 bg-violet-500/10" },
    { label: "Messages received", value: totals?.message_received ?? 0, icon: Inbox, tone: "text-amber-600 bg-amber-500/10" },
    { label: "Followers", value: analytics?.followers ?? 0, icon: Heart, tone: "text-rose-600 bg-rose-500/10", allTime: true },
  ];

  return (
    <DashboardShell active="Analytics">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-caps text-muted-foreground">Insights</p>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Understand how people discover and interact with your AURA page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Last 14 days
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void analyticsQuery.refetch()}
              disabled={analyticsQuery.isFetching}
              data-testid="analytics-refresh"
            >
              {analyticsQuery.isFetching
                ? <LoaderCircle className="size-3.5 animate-spin" />
                : <RefreshCw className="size-3.5" />}
              Refresh
            </Button>
            <Link
              to={`/u/${me?.username ?? ""}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              data-testid="analytics-view-profile"
            >
              View profile <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </header>

        {analyticsQuery.isError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Analytics couldn’t load</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {analyticsQuery.error instanceof ApiError
                    ? analyticsQuery.error.detail
                    : "Check your connection and try again."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void analyticsQuery.refetch()}
                disabled={analyticsQuery.isFetching}
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {analyticsQuery.isLoading ? (
          <div className="space-y-5" aria-label="Loading analytics" aria-busy="true">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-28 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
              <div className="h-[370px] animate-pulse rounded-2xl bg-muted" />
              <div className="h-[370px] animate-pulse rounded-2xl bg-muted" />
            </div>
          </div>
        ) : analytics ? (
          <>
            <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {metrics.map((metric) => (
                <Card key={metric.label} className="border-border/70 shadow-sm">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`grid size-9 place-items-center rounded-xl ${metric.tone}`}>
                        <metric.icon className="size-[18px]" />
                      </span>
                      <span className="label-caps text-[9px] text-muted-foreground">
                        {metric.allTime ? "All time" : "14 days"}
                      </span>
                    </div>
                    <p className="mt-4 font-heading text-2xl font-bold tracking-tight sm:text-3xl" data-testid={`analytics-${metric.label.toLowerCase().replaceAll(" ", "-")}`}>
                      {numberFormat.format(metric.value)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{metric.label}</p>
                  </CardContent>
                </Card>
              ))}
            </section>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
              <Card className="min-w-0 border-border/70 shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-heading text-base font-bold">Engagement over time</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Daily profile views, link clicks, and messages.
                      </p>
                    </div>
                    <BarChart3 className="size-5 text-muted-foreground" aria-hidden="true" />
                  </div>

                  <div className="mt-5 h-[280px] w-full" role="img" aria-label="Line chart of daily profile views, link clicks, and messages over the last 14 days">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={dateLabel}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                          minTickGap={24}
                        />
                        <YAxis
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        />
                        <Tooltip
                          labelFormatter={(label) => fullDateLabel(String(label))}
                          formatter={(value) => numberFormat.format(Number(value ?? 0))}
                          contentStyle={{
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            color: "var(--foreground)",
                            fontSize: 12,
                          }}
                        />
                        <Line type="monotone" dataKey="views" name="Profile views" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="clicks" name="Link clicks" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="messages" name="Messages" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                      <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-indigo-500" />Profile views</span>
                      <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-emerald-500" />Link clicks</span>
                      <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-amber-500" />Messages</span>
                    </div>
                    {peakDay.date && peakDay.views > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Best day: <span className="font-semibold text-foreground">{dateLabel(peakDay.date)}</span>
                        {" · "}{numberFormat.format(peakDay.views)} views
                      </p>
                    )}
                  </div>
                  {!hasActivity && (
                    <div className="mt-4 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      No activity yet. Share your profile to start seeing views, clicks, and messages here.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-heading text-base font-bold">Top links</h2>
                      <p className="mt-1 text-xs text-muted-foreground">Ranked by all-time clicks.</p>
                    </div>
                    <Link2 className="size-5 text-muted-foreground" aria-hidden="true" />
                  </div>

                  {analytics.top_links.length > 0 ? (
                    <ol className="mt-5 space-y-4">
                      {analytics.top_links.map((link, index) => (
                        <li key={link.id} className="min-w-0" data-testid={`analytics-top-link-${index + 1}`}>
                          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate font-medium">{link.title}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {numberFormat.format(link.clicks)}
                            </span>
                          </div>
                          <div
                            className="h-2 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-label={`${link.title} clicks relative to your most clicked link`}
                            aria-valuemin={0}
                            aria-valuemax={maxLinkClicks}
                            aria-valuenow={link.clicks}
                          >
                            <div
                              className="h-full rounded-full bg-primary transition-[width]"
                              style={{ width: `${(link.clicks / maxLinkClicks) * 100}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="mt-5 rounded-xl border border-dashed px-4 py-6 text-center">
                      <p className="text-sm font-medium">Your links are waiting to be discovered</p>
                      <p className="mt-1 text-xs text-muted-foreground">Add a link and share your page to see clicks here.</p>
                      <Link
                        to="/dashboard/links"
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
                      >
                        Manage links <ArrowUpRight className="size-3.5" />
                      </Link>
                    </div>
                  )}

                  {analytics.top_links.length > 0 && (
                    <Link
                      to="/dashboard/links"
                      className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Manage links <ArrowUpRight className="size-3.5" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            </div>

            <section aria-label="More engagement" className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,1fr)]">
              <Card className="border-border/70 shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <h2 className="font-heading text-base font-bold">More ways people engage</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Poll votes and profile shares in the last 14 days.</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      { label: "Poll votes", value: totals?.poll_vote ?? 0, icon: Vote },
                      { label: "Shares", value: totals?.share ?? 0, icon: Share2 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-muted/50 p-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <item.icon className="size-4" />
                          <span className="text-xs">{item.label}</span>
                        </div>
                        <p className="mt-2 font-heading text-xl font-bold tabular-nums">
                          {numberFormat.format(item.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <h2 className="font-heading text-base font-bold">Your community</h2>
                  <p className="mt-1 text-xs text-muted-foreground">A quick look at your conversations.</p>
                  <div className="mt-4 space-y-3">
                    <Link
                      to="/dashboard/messages"
                      className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3 transition-colors hover:bg-muted"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <Inbox className="size-4 text-primary" /> Pending messages
                      </span>
                      <span className="font-semibold tabular-nums">{numberFormat.format(analytics.messages_pending)}</span>
                    </Link>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MessageCircle className="size-4" /> AI chat messages
                      </span>
                      <span className="font-semibold tabular-nums">{numberFormat.format(analytics.chat_messages ?? 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
