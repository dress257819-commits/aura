import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { PlanInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
}

export function UpgradeModal({ open, onOpenChange, reason }: UpgradeModalProps) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiGet<PlanInfo[]>("/plans"),
  });

  const upgrade = useMutation({
    mutationFn: (plan: string) => apiPost<PlanInfo>("/me/upgrade", { plan }),
    onSuccess: (_data, plan) => {
      toast.success(`You're on the ${plan} plan — everything is unlocked.`);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.detail : "Upgrade failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="upgrade-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-xl font-bold">
            <Crown className="size-5 text-amber-400" /> Unlock your full AURA
          </DialogTitle>
          <DialogDescription>
            {reason ?? "This feature lives on a higher plan. Upgrade instantly — it's a one-tap demo checkout."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {(plans ?? []).map((plan) => {
            const current = me?.plan === plan.key;
            return (
              <div
                key={plan.key}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  current ? "border-primary/60 bg-primary/5" : "hover:border-primary/40"
                )}
                data-testid={`upgrade-plan-${plan.key}`}
              >
                <div className="flex items-center justify-between gap-3">
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
                  <div className="text-right">
                    <p className="font-heading text-lg font-bold">
                      {plan.price === 0 ? "$0" : `$${plan.price}`}
                      <span className="text-xs font-normal text-muted-foreground">/mo</span>
                    </p>
                    <Button
                      size="sm"
                      variant={current ? "secondary" : "default"}
                      className="mt-1 w-full"
                      disabled={current || upgrade.isPending}
                      data-testid={`upgrade-confirm-${plan.key}`}
                      onClick={() =>
                        me
                          ? upgrade.mutate(plan.key)
                          : navigate("/auth")
                      }
                    >
                      {current ? "Active" : me ? "Switch" : "Sign in"}
                    </Button>
                  </div>
                </div>
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="mt-0.5 size-3 shrink-0 text-emerald-500" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
