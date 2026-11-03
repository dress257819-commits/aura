import { Link } from "react-router-dom";
import { useMe } from "@/lib/hooks";

export function Footer() {
  const { data: me } = useMe();

  return (
    <footer className="border-t py-8 sm:py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center">
        <Link to={me ? "/dashboard" : "/"} className="group flex items-center gap-2" data-testid="footer-logo-link">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-transform duration-300 group-hover:rotate-12">
            A
          </span>
          <span className="font-heading text-lg font-bold tracking-tight text-foreground">AURA</span>
        </Link>
        <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link to="/explore" className="hover:text-foreground" data-testid="footer-explore-link">
            Explore
          </Link>
          <Link to="/leaderboard" className="hover:text-foreground" data-testid="footer-leaderboard-link">
            Rankings
          </Link>
          <Link to="/pricing" className="hover:text-foreground" data-testid="footer-pricing-link">
            Pricing
          </Link>
          {me
            ? <Link to="/dashboard" className="hover:text-foreground" data-testid="footer-dashboard-link">Dashboard</Link>
            : <Link to="/auth" className="hover:text-foreground" data-testid="footer-auth-link">Sign in</Link>}
        </nav>
      </div>
    </footer>
  );
}
