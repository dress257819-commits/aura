import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@/components/ui/button";
import { ProfileCanvas } from "@/components/profile/ProfileCanvas";
import { apiGet, apiPost } from "@/lib/api";
import { getLocalMe } from "@/lib/auth";
import { isLocallyFollowing } from "@/lib/follows";
import { shouldTrackView } from "@/lib/visitor";
import type { ProfileBundle } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();

  const { data: bundle, isLoading, isError, error } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const bundle = await apiGet<ProfileBundle>(`/u/${username}`);
      const localMe = getLocalMe();
      if (!localMe || !username) return bundle;

      const localFollowing = isLocallyFollowing(localMe.id, username);
      return {
        ...bundle,
        following: bundle.following || localFollowing,
        followers: bundle.followers + Number(localFollowing && !bundle.following),
      };
    },
    retry: false,
    enabled: !!username,
  });

  const trackView = useMutation({
    mutationFn: () => apiPost(`/u/${username}/events`, { type: "profile_view", ref: "" }),
  });

  // one profile_view per browser session per profile
  useEffect(() => {
    if (bundle && username && shouldTrackView(username)) {
      trackView.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, username]);

  if (isLoading) {
    return (
      <div className="min-h-svh bg-background">
        <div className="mx-auto max-w-lg space-y-4 px-4 py-16">
          <div className="mx-auto h-44 animate-pulse rounded-2xl bg-muted" />
          <div className="mx-auto size-24 animate-pulse rounded-full bg-muted" />
          <div className="mx-auto h-4 w-40 animate-pulse rounded bg-muted" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !bundle) {
    const status = (error as { status?: number })?.status;
    return (
      <div className="grid min-h-svh place-items-center bg-background px-4 text-center">
        <div>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
            {status === 404 ? "404" : "offline"}
          </p>
          <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight">
            {status === 404 ? `@${username} hasn't created an AURA page yet` : "Profile couldn't load"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {status === 404
              ? "It could be yours in the next two minutes."
              : "Try again in a moment."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/auth" className={cn(buttonVariants())} data-testid="profile-claim-link">
              Claim this username
            </Link>
            <Link to="/explore" className={cn(buttonVariants({ variant: "outline" }))} data-testid="profile-explore-link">
              Explore creators
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh" data-testid="profile-page">
      <ProfileCanvas bundle={bundle} />
    </div>
  );
}
