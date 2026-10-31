import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Device frame for live previews — renders a scrollable mini page inside a phone silhouette. */
export function PhoneFrame({
  children,
  className,
  height = 640,
}: {
  children: ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[340px] rounded-[2.6rem] border-[5px] border-neutral-900 bg-neutral-950 p-1.5 shadow-2xl shadow-black/15",
        className
      )}
      data-testid="phone-frame"
    >
      <div className="absolute left-1/2 top-3.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black/90" />
      <div
        className="overflow-y-auto rounded-[2rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ height }}
      >
        {children}
      </div>
    </div>
  );
}
