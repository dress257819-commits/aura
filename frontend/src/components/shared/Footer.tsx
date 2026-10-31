import { Link } from "react-router-dom";
export function Footer() {
  return (
    <footer className="border-t py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center">
        <Link to="/" className="group flex items-center gap-2" data-testid="footer-logo-link">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-transform duration-300 group-hover:rotate-12">
            A
          </span>
          <span className="font-heading text-lg font-bold tracking-tight text-foreground">AURA</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/explore" className="hover:text-foreground" data-testid="footer-explore-link">
            Explore
          </Link>
          <Link to="/leaderboard" className="hover:text-foreground" data-testid="footer-leaderboard-link">
            Rankings
          </Link>
          <Link to="/pricing" className="hover:text-foreground" data-testid="footer-pricing-link">
            Pricing
          </Link>
          <Link to="/auth" className="hover:text-foreground" data-testid="footer-auth-link">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
