import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, Check, ChevronDown, ExternalLink, Image, Inbox, LayoutDashboard, Link2,
  Palette, UserRound, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useMe } from "@/lib/hooks";
import { apiGet, ApiError } from "@/lib/api";
import { endSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { MessageCounts } from "@/lib/types";

const NAV = [
  { to: "/dashboard", label: "Overview", description: "Your activity and next steps", icon: LayoutDashboard, testid: "dash-nav-overview" },
  { to: "/dashboard/customize", label: "Customize", description: "Edit your profile and page design", icon: Palette, testid: "dash-nav-customize" },
  { to: "/dashboard/links", label: "Links", description: "Add and organize your links", icon: Link2, testid: "dash-nav-links" },
  { to: "/dashboard/showcase", label: "Showcase", description: "Photos, projects, and polls", icon: Image, testid: "dash-nav-showcase" },
  { to: "/dashboard/messages", label: "Messages", description: "Read and manage your inbox", icon: Inbox, testid: "dash-nav-messages" },
  { to: "/dashboard/story-studio", label: "Story Studio", description: "Create a story to share", icon: Wand2, testid: "dash-nav-story" },
  { to: "/dashboard/analytics", label: "Analytics", description: "See how your page is doing", icon: BarChart3, testid: "dash-nav-analytics" },
];

export function DashboardShell({ children, active }: { children: ReactNode; active: string }) {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const { data: pendingMessages, isError: messageCountError, error: messageCountErrorDetail } = useQuery({
    queryKey: ["my-messages", "count"],
    queryFn: () => apiGet<MessageCounts>("/me/messages/count"),
    enabled: !!me,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const pendingCount = pendingMessages?.pending ?? 0;
  const activeItem = NAV.find((item) => item.label === active) ?? NAV[0];
  const sidebarItems = [
    ...NAV,
    { to: `/u/${me?.username ?? ""}`, label: "Profile", icon: UserRound, testid: "dash-nav-profile" },
  ];

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
            <Link to="/dashboard" className="flex items-center gap-2" data-testid="dash-logo-link">
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
        <nav aria-label="Dashboard pages" className="px-3 pb-3 lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="group flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border/70 bg-gradient-to-r from-card to-muted/40 px-3.5 text-left shadow-sm transition-all hover:border-primary/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Dashboard menu. Current page: ${activeItem.label}`}
              data-testid="dashboard-mobile-menu"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <activeItem.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Dashboard menu</span>
                <span className="mt-1 block truncate text-sm font-semibold text-foreground">{activeItem.label}</span>
              </span>
              {activeItem.label === "Messages" && pendingCount > 0 && (
                <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                  {pendingCount} new
                </span>
              )}
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border/70 bg-background/80 text-muted-foreground transition-transform group-data-[popup-open]:rotate-180">
                <ChevronDown className="size-4" aria-hidden="true" />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl border-border/70 bg-popover/95 p-2 shadow-xl backdrop-blur-md"
              data-testid="dashboard-mobile-menu-options"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
                  Go to a page
                </DropdownMenuLabel>
                <div className="space-y-1">
                  {NAV.map((item) => (
                    <DropdownMenuItem
                      key={item.to}
                      onClick={() => navigate(item.to)}
                      className={cn(
                        "min-h-[58px] gap-3 rounded-xl border border-transparent px-2.5 py-2 text-sm transition-colors",
                        active === item.label
                          ? "border-primary/15 bg-primary/[0.07] text-foreground focus:bg-primary/10"
                          : "hover:border-border/60 hover:bg-muted/70",
                      )}
                      aria-current={active === item.label ? "page" : undefined}
                      data-testid={item.testid}
                    >
                      <span className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-xl",
                        active === item.label ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}>
                        <item.icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold leading-tight">{item.label}</span>
                        <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{item.description}</span>
                      </span>
                      {item.label === "Messages" && pendingCount > 0 && (
                        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                          {pendingCount} new
                        </span>
                      )}
                      {active === item.label && <Check className="size-4 shrink-0 text-primary" aria-label="Current page" />}
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        {/* desktop sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-56 shrink-0 flex-col border-r p-4 lg:flex">
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
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
            <p className="font-heading font-bold">Manage your plan</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Review available features and payment options on the pricing page.
            </p>
            <Link to="/pricing" className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline">
              View plans
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
