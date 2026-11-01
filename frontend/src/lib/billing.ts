import type { PlanInfo } from "@/lib/types";

const DEFAULT_NPR_PER_USD = 135;

export function nepalPriceFor(plan: Pick<PlanInfo, "price" | "nepal_price">) {
  if (typeof plan.nepal_price === "number" && Number.isFinite(plan.nepal_price)) {
    return { amount: plan.nepal_price, estimated: false };
  }
  return {
    amount: Math.round(plan.price * DEFAULT_NPR_PER_USD),
    estimated: true,
  };
}
