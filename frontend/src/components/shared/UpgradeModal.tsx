import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Crown, CreditCard, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { nepalPriceFor } from "@/lib/billing";
import { useMe } from "@/lib/hooks";
import type { BillingOptions, CheckoutResponse, PlanInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
  initialPlan?: string;
  initialRegion?: "international" | "nepal";
}

export function UpgradeModal({
  open,
  onOpenChange,
  reason,
  initialPlan = "pro",
  initialRegion = "international",
}: UpgradeModalProps) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [region, setRegion] = useState<"international" | "nepal">(initialRegion);
  const [provider, setProvider] = useState("stripe");
  useEffect(() => {
    if (open) {
      setSelectedPlan(initialPlan);
      setRegion(initialRegion);
      setProvider(initialRegion === "international" ? "stripe" : "esewa");
    }
  }, [initialPlan, initialRegion, open]);
  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiGet<PlanInfo[]>("/plans"),
  });
  const billingOptionsQuery = useQuery({
    queryKey: ["billing-options"],
    queryFn: () => apiGet<BillingOptions>("/billing/options"),
  });
  const plans = plansQuery.data;
  const options = billingOptionsQuery.data;

  const upgrade = useMutation({
    mutationFn: () =>
      apiPost<CheckoutResponse>("/me/billing/checkout", {
        plan: selectedPlan,
        region,
        provider,
      }),
    onSuccess: (checkout) => {
      if (checkout.provider === "esewa") {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = checkout.checkout_url;
        Object.entries(checkout.form_fields).forEach(([name, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        form.remove();
        return;
      }
      window.location.assign(checkout.checkout_url);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.detail : "Upgrade failed"),
  });
  const downgrade = useMutation({
    mutationFn: () => apiPost("/me/billing/downgrade", {}),
    onSuccess: () => {
      toast.success("Your account is now on the Free plan.");
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.detail : "Downgrade failed"),
  });

  const selected = plans?.find((plan) => plan.key === selectedPlan);
  const providerReady =
    region === "international"
      ? Boolean(options?.international.stripe)
      : selected?.nepal_price != null &&
        (provider === "esewa" ? Boolean(options?.nepal.esewa) : Boolean(options?.nepal.khalti));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" data-testid="upgrade-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-xl font-bold">
            <Crown className="size-5 text-amber-400" /> Unlock your full AURA
          </DialogTitle>
          <DialogDescription>
            {reason ?? "Choose a plan and complete a secure payment. Your plan activates after the provider confirms payment."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {(plans ?? []).map((plan) => {
            const current = me?.plan === plan.key;
            const nepalPrice = nepalPriceFor(plan);
            return (
              <button
                type="button"
                key={plan.key}
                onClick={() => setSelectedPlan(plan.key)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  selectedPlan === plan.key ? "border-primary/60 bg-primary/5" : "hover:border-primary/40"
                )}
                data-testid={`upgrade-plan-${plan.key}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading font-bold">
                      {plan.name}
                      {current && (
                        <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                          current
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                  </div>
                  {selectedPlan === plan.key && <Check className="mt-1 size-4 shrink-0 text-primary" />}
                </div>
                <p className="mt-2 font-heading text-lg font-bold">
                  {region === "international"
                    ? `$${plan.price} USD`
                    : `${nepalPrice.estimated ? "≈ " : ""}NPR ${nepalPrice.amount.toLocaleString()}`}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {region === "international" ? "/month" : "/30 days"}
                  </span>
                </p>
              </button>
            );
          })}
        </div>
        {plansQuery.isError && (
          <p role="alert" className="text-sm text-destructive">
            {plansQuery.error instanceof ApiError
              ? plansQuery.error.detail
              : "Plan details could not be loaded. Please try again."}
          </p>
        )}
        <div className="space-y-3 rounded-2xl border p-4">
          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Payment region">
            {(["international", "nepal"] as const).map((choice) => (
              <Button
                key={choice}
                type="button"
                role="tab"
                aria-selected={region === choice}
                variant={region === choice ? "default" : "outline"}
                onClick={() => {
                  setRegion(choice);
                  setProvider(choice === "international" ? "stripe" : "esewa");
                }}
                data-testid={`billing-region-${choice}`}
              >
                {choice === "international" ? "International · USD" : "Nepal · NPR"}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(region === "international"
              ? [{ key: "stripe", label: "Stripe", detail: "Secure monthly subscription" }]
              : [
                  { key: "esewa", label: "eSewa", detail: "Pay in Nepalese rupees" },
                  { key: "khalti", label: "Khalti", detail: "Pay in Nepalese rupees" },
                ]
            ).map((method) => (
              <button
                key={method.key}
                type="button"
                onClick={() => setProvider(method.key)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  provider === method.key ? "border-primary bg-primary/5" : "hover:border-primary/40",
                )}
                data-testid={`billing-provider-${method.key}`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <CreditCard className="size-4 text-primary" /> {method.label}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{method.detail}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Nepal plans are paid for 30 days and can be renewed manually. Stripe renews monthly.
          </p>
        </div>
        {region === "nepal" && selected?.nepal_price == null && (
          <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
            The displayed NPR price is an estimate using 135 NPR/USD. Checkout requires the updated billing API to provide the exact price.
          </p>
        )}
        {selected && selected.key === me?.plan && (
          <p className="text-sm text-muted-foreground">This is your current plan.</p>
        )}
        {selected?.key === "free" && me?.plan !== "free" && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Switching to Free ends premium access immediately. It does not refund previous payments.
          </p>
        )}
        {billingOptionsQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {billingOptionsQuery.error instanceof ApiError &&
            billingOptionsQuery.error.status === 404
              ? "The billing API is outdated. Restart the backend to enable checkout and use its configured Nepal pricing."
              : billingOptionsQuery.error instanceof ApiError
                ? billingOptionsQuery.error.detail
                : "Payment options could not be loaded. Please try again."}
          </p>
        ) : selected?.key !== "free" && !providerReady && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            This payment method is not configured yet. Ask the site owner to add its merchant credentials.
          </p>
        )}
        <Button
          className="w-full"
          disabled={!selected || (!!me && selected.key === me.plan) || (!!me && selected.key !== "free" && !providerReady) || upgrade.isPending || downgrade.isPending}
          onClick={() => {
            if (!me) {
              navigate("/auth");
            } else if (selected?.key === "free") {
              if (window.confirm("Switch to Free now? Your premium access will end immediately and previous payments will not be refunded.")) {
                downgrade.mutate();
              }
            } else {
              upgrade.mutate();
            }
          }}
          data-testid="upgrade-checkout-button"
        >
          {upgrade.isPending || downgrade.isPending
            ? <LoaderCircle className="size-4 animate-spin" />
            : <CreditCard className="size-4" />}
          {!me
            ? "Sign in to continue"
            : selected?.key === "free"
              ? "Switch to Free"
              : `Continue with ${provider === "stripe" ? "Stripe" : provider === "esewa" ? "eSewa" : "Khalti"}`}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Payments are verified by the provider before premium access is enabled.
        </p>
      </DialogContent>
    </Dialog>
  );
}
