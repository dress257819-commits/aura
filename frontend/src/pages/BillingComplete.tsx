import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiPost, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { MeProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function BillingComplete() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const sessionId = searchParams.get("session_id");
  const status = searchParams.get("status");
  const confirm = useMutation({
    mutationFn: () =>
      apiPost<MeProfile>(
        `/me/billing/confirm?session_id=${encodeURIComponent(sessionId ?? "")}`,
        {},
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  useEffect(() => {
    if (sessionId && !confirm.isPending && !confirm.isSuccess && !confirm.isError) {
      confirm.mutate();
    }
  }, [sessionId, confirm]);

  const failed = status === "failed" || confirm.isError || (!sessionId && status !== "success");
  const waiting = Boolean(sessionId && confirm.isPending);
  const complete = status === "success" || confirm.isSuccess;

  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-lg rounded-3xl border bg-card p-8 text-center shadow-sm">
        {waiting ? (
          <LoaderCircle className="mx-auto size-10 animate-spin text-primary" />
        ) : failed ? (
          <XCircle className="mx-auto size-10 text-destructive" />
        ) : complete ? (
          <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
        ) : (
          <LoaderCircle className="mx-auto size-10 animate-spin text-primary" />
        )}
        <h1 className="mt-4 font-heading text-2xl font-bold">
          {waiting
            ? "Verifying your payment"
            : failed
              ? "Payment not completed"
              : complete
                ? "You’re all set"
                : "Checking payment"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {waiting
            ? "We’re confirming the checkout directly with the payment provider. Keep this page open for a moment."
            : failed
              ? confirm.error instanceof ApiError
                ? confirm.error.detail
                : "We couldn't confirm your payment, so premium access remains locked. If funds were deducted, contact support before trying again."
              : complete
                ? `Your payment is confirmed. Your ${me?.plan ?? "premium"} plan is active.`
                : "Loading your payment status…"}
        </p>
        {sessionId && confirm.isError && (
          <Button className="mt-6" variant="outline" onClick={() => void confirm.mutate()}>
            Verify again
          </Button>
        )}
        <Link
          to={complete ? "/dashboard" : "/pricing"}
          className={cn(buttonVariants({ variant: failed ? "default" : "outline" }), "mt-6")}
        >
          {complete ? "Go to your studio" : "Return to pricing"}
        </Link>
      </section>
    </main>
  );
}
