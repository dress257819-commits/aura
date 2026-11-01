import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, ExternalLink, Image, Inbox, LayoutDashboard, Link2, Palette,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useMe } from "@/lib/hooks";
import { apiGet, ApiError } from "@/lib/api";
import { endSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { MessageCounts } from "@/lib/types";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, testid: "dash-nav-overview" },
  { to: "/dashboard/links", label: "Links", icon: Link2, testid: "dash-nav-links" },
  { to: "/dashboard/showcase", label: "Showcase", icon: Image, testid: "dash-nav-showcase" },
  { to: "/dashboard/messages", label: "Messages", icon: Inbox, testid: "dash-nav-messages" },
  { to: "/dashboard/story-studio", label: "Story Studio", icon: Wand2, testid: "dash-nav-story" },
  { to: "/dashboard/customize", label: "Customize", icon: Palette, testid: "dash-nav-customize" },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3, testid: "dash-nav-analytics" },
];

export function DashboardShell({ children, active }: { children: ReactNode; active: string }) {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: pendingMessages, isError: messageCountError, error: messageCountErrorDetail } = useQuery({
    queryKey: ["my-messages", "count"],
    queryFn: () => apiGet<MessageCounts>("/me/messages/count"),
    enabled: !!me,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const pendingCount = pendingMessages?.pending ?? 0;

  useEffect(() => {
    if (messageCountError) {
      toast.error(messageCountErrorDetail instanceof ApiError
        ? messageCountErrorDetail.detail
        : "Couldn't load your inbox count");
    }
  }, [messageCountError, messageCountErrorDetail]);

  // signed-out visitors land on the auth page
  useEffect(() => {
    if (!isLoading && !me) navigate("/auth", { replace: true });
  }, [isLoading, me, navigate]);

  if (isLoading) {
    return (
      <div className="grid min-h-svh place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm">Loading your studio…</p>
        </div>
      </div>
    );
  }
  if (!me) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-svh bg-background">
      {/* top bar */}
      <header className="sticky top-0 z-40 border-b glass-panel border-x-0 border-t-0">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2" data-testid="dash-logo-link">
              <span className="grid size-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                A
              </span>
              <span className="hidden font-heading text-lg font-bold tracking-tight sm:block">AURA</span>
            </Link>
            <span className="label-caps hidden text-muted-foreground sm:block">studio</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/u/${me.username}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              data-testid="dash-view-profile-button"
            >
              <ExternalLink className="size-4" />
              <span className="hidden sm:inline">View profile</span>
            </Link>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void endSession("/auth")}
              data-testid="dash-signout-button"
            >
              Sign out
            </Button>
          </div>
        </div>
        {/* mobile nav */}
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active === item.label
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={item.testid}
            >
              <item.icon className="size-3.5" /> {item.label}
              {item.label === "Messages" && pendingCount > 0 && (
                <span
                  className="grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                  aria-label={`${pendingCount} unread messages`}
                  data-testid="messages-nav-count"
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        {/* desktop sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-56 shrink-0 flex-col border-r p-4 lg:flex">
          <nav className="space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active === item.label
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                data-testid={item.testid}
              >
                <item.icon className="size-4" /> {item.label}
                {item.label === "Messages" && pendingCount > 0 && (
                  <span
                    className="ml-auto grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                    aria-label={`${pendingCount} unread messages`}
                    data-testid="messages-nav-count"
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border bg-card p-4 text-sm">
            <p className="font-heading font-bold capitalize">
              {me.plan} plan
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {me.plan === "free" && "5 links, 3 themes — upgrade for the full studio"}
              {me.plan === "pro" && "15 links, all core themes & glass controls"}
              {me.plan === "creator" && "100 links, custom CSS & the Luxe theme"}
            </p>
            {me.plan !== "creator" && (
              <Button
                size="sm"
                className="mt-3 w-full shadow-lg shadow-indigo-500/25"
                onClick={() => navigate("/pricing", { state: { from: location.pathname } })}
                data-testid="dash-upgrade-button"
              >
                Upgrade
              </Button>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
