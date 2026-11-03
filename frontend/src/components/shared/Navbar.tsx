import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Menu } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useMe } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const navLinkClass = (path: string) =>
    cn(
      "rounded-full px-3 py-2 transition-colors hover:bg-muted hover:text-foreground",
      pathname === path ? "bg-primary/10 text-primary" : "text-foreground/75",
    );

  return (
    <header className="sticky top-0 z-40 border-x-0 border-t-0 glass-panel">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6">
        <Link to={me ? "/dashboard" : "/"} className="flex items-center gap-2 group" data-testid="nav-logo-link">
          <span className="grid size-8 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-transform duration-300 group-hover:rotate-12">
            A
          </span>
          <span className="font-heading text-lg font-bold tracking-tight text-foreground">AURA</span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-border/60 bg-background/50 p-1 text-sm font-medium sm:flex">
          <Link to="/explore" aria-current={pathname === "/explore" ? "page" : undefined} className={navLinkClass("/explore")} data-testid="nav-explore-link">
            Explore
          </Link>
          <Link to="/leaderboard" aria-current={pathname === "/leaderboard" ? "page" : undefined} className={navLinkClass("/leaderboard")} data-testid="nav-leaderboard-link">
            Rankings
          </Link>
          <Link to="/pricing" aria-current={pathname === "/pricing" ? "page" : undefined} className={navLinkClass("/pricing")} data-testid="nav-pricing-link">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {me ? (
            <Link
              to="/dashboard"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "order-1 rounded-full px-2 text-foreground/80 hover:text-foreground sm:order-3 sm:px-3")}
              data-testid="nav-dashboard-link"
            >
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "order-1 hidden rounded-full text-foreground/80 hover:text-foreground sm:inline-flex")}
                data-testid="nav-signin-link"
              >
                Sign in
              </Link>
              <Link
                to="/auth"
                className={cn(buttonVariants({ size: "sm" }), "order-1 premium-nav-cta sm:order-3")}
                data-testid="nav-cta-link"
              >
                <span className="sm:hidden">Create</span>
                <span className="hidden sm:inline">Create your profile</span>
              </Link>
            </>
          )}
          <div className="order-2 sm:order-2">
            <ThemeToggle />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="order-3 grid size-9 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-muted sm:hidden"
              aria-label="Open site navigation"
              data-testid="mobile-nav-menu"
            >
              <Menu className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl border-border/70 p-1.5 shadow-lg">
              <DropdownMenuItem onClick={() => navigate("/explore")}>
                Explore creators
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/leaderboard")}
                data-testid="mobile-nav-leaderboard-link"
              >
                Creator rankings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/pricing")}>
                Pricing
              </DropdownMenuItem>
              {!me && <DropdownMenuItem onClick={() => navigate("/auth")}>Sign in</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
