import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Crown, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Footer } from "@/components/shared/Footer";
import { Navbar } from "@/components/shared/Navbar";
import { UpgradeModal } from "@/components/shared/UpgradeModal";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiGet, ApiError } from "@/lib/api";
import { nepalPriceFor } from "@/lib/billing";
import { useMe } from "@/lib/hooks";
import type { PlanInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Pricing() {
  const { data: me } = useMe();
  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiGet<PlanInfo[]>("/plans"),
  });
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [selectedRegion, setSelectedRegion] = useState<"international" | "nepal">("international");
  const plans = plansQuery.data ?? [];
  const promotionActive = plans.some((plan) => plan.promotion_active);
  const promotionEnd = plans.find((plan) => plan.promotion_ends_at)?.promotion_ends_at;
  const promotionEndLabel = promotionEnd
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" })
      .format(new Date(promotionEnd))
    : "the end of the 30-day offer";

  return (
    <div className="min-h-svh bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <header className="mx-auto max-w-2xl text-center">
          <p className="label-caps text-primary">AURA pricing</p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-5xl">
            {promotionActive ? "Premium is free for 30 days." : "Start free. Grow loud."}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {promotionActive
              ? `Every AURA feature is unlocked for everyone until ${promotionEndLabel}.`
              : "Choose the plan that fits your AURA. Secure checkout is available internationally and in Nepal."}
          </p>
        </header>

        {plansQuery.isError && (
          <p role="alert" className="mx-auto mt-8 max-w-xl text-center text-sm text-destructive">
            {plansQuery.error instanceof ApiError
              ? plansQuery.error.detail
              : "Plan details could not be loaded. Please try again."}
          </p>
        )}

        {promotionActive ? (
          <section
            className="mx-auto mt-10 max-w-2xl rounded-3xl border border-primary/30 bg-card p-6 shadow-xl shadow-indigo-500/10 sm:p-9"
            aria-labelledby="all-features-heading"
            data-testid="pricing-all-free"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 font-heading text-xl font-bold">
                  <Sparkles className="size-5 text-primary" /> AURA — all features
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The complete creator studio, free for everyone during this offer.
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                FREE FOR 30 DAYS
              </span>
            </div>

            <p className="mt-6 font-heading text-5xl font-bold tracking-tight">
              $0<span className="ml-2 text-base font-normal text-muted-foreground">during the offer</span>
            </p>
            <h2 id="all-features-heading" className="sr-only">All AURA features included during the offer</h2>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {(plans[0]?.features ?? []).map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Link
                to={me ? "/dashboard" : "/auth"}
                className={cn(buttonVariants(), "w-full")}
                data-testid="pricing-get-started"
              >
                {me ? "Open your studio" : "Create your free account"}
              </Link>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Free access ends {promotionEndLabel}. No payment is taken during the offer.
            </p>
          </section>
        ) : (
          <>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {plans.map((plan) => {
                const current = me?.plan === plan.key;
                const featured = plan.key === "pro";
                const nepalPrice = nepalPriceFor(plan);
                return (
                  <article
                    key={plan.key}
                    className={cn(
                      "link-card relative flex flex-col rounded-3xl border bg-card p-7",
                      featured && "border-primary/50 shadow-xl shadow-indigo-500/10",
                    )}
                    data-testid={`pricing-card-${plan.key}`}
                  >
                    {featured && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 shadow-lg">
                        <Zap className="size-3" /> Most popular
                      </Badge>
                    )}
                    <h2 className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight">
                      {plan.key === "creator" && <Crown className="size-5 text-amber-400" />} {plan.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                    <p className="mt-5 font-heading text-5xl font-bold tracking-tight">
                      ${plan.price}
                      <span className="text-base font-normal text-muted-foreground">/mo</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {nepalPrice.estimated ? "Approx. " : ""}
                      NPR {nepalPrice.amount.toLocaleString()} / 30 days in Nepal
                      {nepalPrice.estimated ? " (at 135 NPR/USD)" : ""}
                    </p>
                    <ul className="mt-6 flex-1 space-y-2.5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                          <span className="text-foreground/90">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {current ? (
                      <Button variant="secondary" className="mt-7 w-full" disabled data-testid={`pricing-current-${plan.key}`}>
                        Your current plan
                      </Button>
                    ) : me ? (
                      <Button
                        className={cn("mt-7 w-full", featured && "shadow-lg shadow-indigo-500/25")}
                        variant={plan.price === 0 ? "outline" : "default"}
                        onClick={() => {
                          setSelectedPlan(plan.key);
                          setUpgradeOpen(true);
                        }}
                        data-testid={`pricing-choose-${plan.key}`}
                      >
                        {plan.price === 0 ? "Switch to Free" : `Upgrade to ${plan.name}`}
                      </Button>
                    ) : (
                      <Link
                        to="/auth"
                        className={cn(buttonVariants({ variant: plan.price === 0 ? "outline" : "default" }), "mt-7 w-full")}
                        data-testid={`pricing-start-${plan.key}`}
                      >
                        {plan.price === 0 ? "Start free" : `Start with ${plan.name}`}
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>

            <section className="mt-12 grid gap-5 md:grid-cols-2" aria-label="Payment regions">
              <article className="rounded-3xl border bg-card p-6">
                <p className="label-caps text-primary">International payments</p>
                <h2 className="mt-2 font-heading text-xl font-bold">Pay securely with Stripe</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Monthly subscriptions in USD. Stripe securely handles card details and recurring billing.
                </p>
                <Button
                  className="mt-5"
                  onClick={() => {
                    setSelectedRegion("international");
                    setSelectedPlan("pro");
                    setUpgradeOpen(true);
                  }}
                  data-testid="pricing-international-payment"
                >
                  International checkout
                </Button>
              </article>
              <article className="rounded-3xl border bg-card p-6">
                <p className="label-caps text-primary">Nepal payments</p>
                <h2 className="mt-2 font-heading text-xl font-bold">Pay with eSewa or Khalti</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Nepalese rupee pricing. Each payment activates 30 days of access; renew whenever you need.
                </p>
                <Button
                  className="mt-5"
                  variant="outline"
                  onClick={() => {
                    setSelectedRegion("nepal");
                    setSelectedPlan("pro");
                    setUpgradeOpen(true);
                  }}
                  data-testid="pricing-nepal-payment"
                >
                  Nepal checkout · eSewa / Khalti
                </Button>
              </article>
            </section>

            <p className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 text-center text-xs text-muted-foreground">
              <ShieldCheck className="size-4" />
              Premium access activates only after the selected payment provider verifies payment.
            </p>
          </>
        )}
      </main>
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        initialPlan={selectedPlan}
        initialRegion={selectedRegion}
      />
      <Footer />
    </div>
  );
}
