import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { Navbar } from "@/components/shared/Navbar";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="min-h-svh bg-background">
      <Navbar />
      <main className="grid place-items-center px-4 py-32 text-center">
        <div>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">404</p>
          <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight">
            This page doesn't exist (yet)
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
            The profile you're looking for may have been renamed — or its creator is still
            composing it.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/" className={cn(buttonVariants())} data-testid="notfound-home-link">
              Back home
            </Link>
            <Link to="/explore" className={cn(buttonVariants({ variant: "outline" }))} data-testid="notfound-explore-link">
              Explore creators
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
