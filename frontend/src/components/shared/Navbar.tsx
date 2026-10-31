import { Link, useNavigate } from "react-router-dom";
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

  return (
    <header className="sticky top-0 z-40 glass-panel border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 group" data-testid="nav-logo-link">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-transform duration-300 group-hover:rotate-12">
            A
          </span>
          <span className="font-heading text-lg font-bold tracking-tight text-foreground">AURA</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-foreground/80 sm:flex">
          <Link to="/explore" className="transition-colors hover:text-foreground" data-testid="nav-explore-link">
            Explore
          </Link>
          <Link to="/leaderboard" className="transition-colors hover:text-foreground" data-testid="nav-leaderboard-link">
            Rankings
          </Link>
          <Link to="/pricing" className="transition-colors hover:text-foreground" data-testid="nav-pricing-link">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {me ? (
            <Link
              to="/dashboard"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "order-1 rounded-full text-foreground/80 hover:text-foreground sm:order-3")}
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
                className={cn(buttonVariants({ size: "sm" }), "order-1 hidden premium-nav-cta sm:inline-flex sm:order-3")}
                data-testid="nav-cta-link"
              >
                Create your profile
              </Link>
            </>
          )}
          <div className="order-2 sm:order-2">
            <ThemeToggle />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="order-3 grid size-9 place-items-center rounded-full text-foreground hover:bg-muted sm:hidden"
              aria-label="Open site navigation"
              data-testid="mobile-nav-menu"
            >
              <Menu className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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
