import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, Search } from "lucide-react";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { ExploreCard } from "@/lib/types";
import { themeOf } from "@/lib/themes";

const TAGS = ["Design", "Tech", "Music", "Gaming", "Fitness", "Photography", "Art"];

export default function Explore() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: cards, isLoading } = useQuery({
    queryKey: ["explore", q, tag],
    queryFn: () => apiGet<ExploreCard[]>(`/explore?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`),
  });

  const follow = useMutation({
    mutationFn: (username: string) => apiPost<{ following: boolean }>(`/u/${username}/follow`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["explore"] }),
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Sign in to follow creators");
        navigate("/auth", { state: { from: "/explore" } });
      } else {
        toast.error("Couldn't follow right now");
      }
    },
  });

  return (
    <div className="min-h-svh bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <header className="max-w-xl">
          <p className="label-caps text-primary">discovery</p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Discover your corner of the AURA community
          </h1>
          <p className="mt-2 text-muted-foreground">
            Real profiles, live right now. Follow the ones that spark something.
          </p>
        </header>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search creators, bios, vibes…"
              className="pl-9"
              data-testid="explore-search-input"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setTag(tag === t ? "" : t)}
                className="shrink-0"
                data-testid={`explore-tag-${t.toLowerCase()}`}
              >
                <Badge variant={tag === t ? "default" : "secondary"} className="cursor-pointer px-3 py-1.5">
                  {t}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl border bg-card" />
            ))}
          {cards?.length === 0 && (
            <p className="col-span-full py-16 text-center text-muted-foreground" data-testid="explore-empty">
              No profiles match that yet — try another vibe.
            </p>
          )}
          {cards?.map((card) => (
            <article
              key={card.username}
              className="link-card overflow-hidden rounded-2xl border bg-card"
              data-testid={`explore-card-${card.username}`}
            >
              <div className="h-16" style={{ background: themeOf({ theme: card.theme }).accent }} />
              <div className="p-5 pt-0">
                <div className="-mt-8 flex items-end justify-between">
                  {card.avatar_url ? (
                    <img
                      src={card.avatar_url}
                      alt={card.name}
                      className="size-16 rounded-full object-cover ring-4 ring-card"
                    />
                  ) : (
                    <span className="grid size-16 place-items-center rounded-full bg-primary/15 font-heading text-xl font-bold text-primary ring-4 ring-card">
                      {card.name.charAt(0)}
                    </span>
                  )}
                  {card.plan !== "free" && (
                    <Badge variant="secondary" className="mb-1 capitalize">
                      {card.plan}
                    </Badge>
                  )}
                </div>
                <Link to={`/u/${card.username}`} data-testid={`explore-profile-link-${card.username}`}>
                  <h2 className="mt-3 font-heading text-lg font-bold tracking-tight hover:underline">
                    {card.name}
                  </h2>
                </Link>
                <p className="font-mono text-xs text-muted-foreground">@{card.username}</p>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm text-muted-foreground">{card.bio}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {card.interests.slice(0, 3).map((i) => (
                    <Badge key={i} variant="outline" className="text-[11px]">
                      {i}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground" data-testid={`explore-followers-${card.username}`}>
                    {card.followers} followers
                  </span>
                  {me?.username !== card.username && (
                    <Button
                      size="sm"
                      variant={card.following ? "secondary" : "outline"}
                      onClick={() => follow.mutate(card.username)}
                      disabled={follow.isPending}
                      aria-pressed={card.following}
                      data-testid={`explore-follow-button-${card.username}`}
                    >
                      <Heart className="size-4" fill={card.following ? "currentColor" : "none"} />
                      {card.following ? "Following" : "Follow"}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
