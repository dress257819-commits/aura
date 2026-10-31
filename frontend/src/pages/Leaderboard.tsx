import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Crown, Eye, MousePointerClick, Trophy, Users, Vote } from "lucide-react";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { apiGet } from "@/lib/api";
import type { LeaderboardResponse } from "@/lib/types";

const MEDALS = [Crown, Trophy, Trophy];

export default function Leaderboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => apiGet<LeaderboardResponse>("/leaderboard"),
    staleTime: 60_000,
  });
  const entries = data?.entries ?? [];
  const leaders = entries.slice(0, 3);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="max-w-2xl">
          <p className="premium-kicker text-primary">AURA COMMUNITY</p>
          <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            The creator rankings.
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            See which profiles are getting noticed. Rankings use real link clicks and poll votes
            from the last {data?.period_days ?? 14} days; creators choose whether to appear here.
          </p>
        </header>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { icon: MousePointerClick, title: "Link clicks", body: "People following through to what you share." },
            { icon: Vote, title: "Poll votes", body: "Visitors joining in with your questions." },
            { icon: Eye, title: "Profile views", body: "Shown as context, not counted as interactions." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border bg-card p-4">
              <Icon className="size-4 text-primary" />
              <h2 className="mt-3 text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="mt-10 grid gap-3" aria-label="Loading creator rankings">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-2xl border bg-card" />
            ))}
          </div>
        )}

        {isError && (
          <div className="mt-10 rounded-2xl border bg-card p-6 text-sm text-muted-foreground" role="alert">
            Rankings couldn’t load right now. Please try again in a moment.
          </div>
        )}

        {!isLoading && !isError && entries.length === 0 && (
          <div className="mt-10 rounded-3xl border bg-card px-6 py-10 text-center sm:px-10">
            <Users className="mx-auto size-8 text-primary" />
            <h2 className="mt-4 font-heading text-2xl font-bold tracking-tight">
              The first spot is open.
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Rankings are opt-in. Turn on “Show my profile in rankings” in your studio to join.
              Your public stats are limited to profile views, link clicks, poll votes, and followers.
            </p>
            <Link
              to="/auth"
              className="premium-link mt-6"
              data-testid="leaderboard-create-profile"
            >
              Create your profile <ArrowRight className="size-4" />
            </Link>
          </div>
        )}

        {leaders.length > 0 && (
          <section className="mt-10" aria-labelledby="leaderboard-top-heading">
            <h2 id="leaderboard-top-heading" className="premium-kicker">TOP CREATORS</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {leaders.map((entry) => {
                const Medal = MEDALS[entry.rank - 1] ?? Trophy;
                return (
                  <Link
                    key={entry.username}
                    to={`/u/${entry.username}`}
                    className={`link-card rounded-2xl border bg-card p-5 ${
                      entry.rank === 1 ? "md:-translate-y-2 md:shadow-lg" : ""
                    }`}
                    data-testid={`leaderboard-top-${entry.rank}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Medal className="size-5" />
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">#{entry.rank}</span>
                    </div>
                    <div className="mt-5 flex items-center gap-3">
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt="" className="size-11 rounded-full object-cover" />
                      ) : (
                        <span className="grid size-11 place-items-center rounded-full bg-muted font-semibold">
                          {entry.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{entry.name}</span>
                        <span className="block truncate font-mono text-xs text-muted-foreground">@{entry.username}</span>
                      </span>
                    </div>
                    <p className="mt-5 font-heading text-3xl font-bold tracking-tight">
                      {entry.interactions.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">interactions · {data?.period_days ?? 14} days</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {entry.link_clicks.toLocaleString()} clicks · {entry.poll_votes.toLocaleString()} votes
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {entries.length > leaders.length && (
          <section className="mt-12" aria-labelledby="leaderboard-list-heading">
            <div className="flex items-end justify-between gap-4">
              <h2 id="leaderboard-list-heading" className="font-heading text-2xl font-bold tracking-tight">
                More creators
              </h2>
              <span className="text-xs text-muted-foreground">Ranked by clicks + poll votes</span>
            </div>
            <div className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card">
              {entries.slice(3).map((entry) => (
                <div
                  key={entry.username}
                  className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[2rem_1fr_repeat(5,4.5rem)] sm:px-5"
                  data-testid={`leaderboard-row-${entry.rank}`}
                >
                  <span className="font-mono text-sm text-muted-foreground">#{entry.rank}</span>
                  <Link to={`/u/${entry.username}`} className="flex min-w-0 items-center gap-3 hover:underline">
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt="" className="size-9 rounded-full object-cover" />
                    ) : (
                      <span className="grid size-9 place-items-center rounded-full bg-muted text-sm font-semibold">
                        {entry.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{entry.name}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">@{entry.username}</span>
                    </span>
                  </Link>
                  {[
                    { label: "total", value: entry.interactions },
                    { label: "clicks", value: entry.link_clicks },
                    { label: "votes", value: entry.poll_votes },
                    { label: "views", value: entry.profile_views },
                    { label: "followers", value: entry.followers },
                  ].map((metric, index) => (
                    <span
                      key={metric.label}
                      className={`text-right ${index > 0 ? "hidden sm:block" : ""}`}
                    >
                      <span className="block font-semibold">{metric.value.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground">{metric.label}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
