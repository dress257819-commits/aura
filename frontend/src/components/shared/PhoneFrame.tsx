import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [touchScrollActive, setTouchScrollActive] = useState(false);
  const [touchDevice, setTouchDevice] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: none) and (pointer: coarse)");
    const updateTouchDevice = () => setTouchDevice(mediaQuery.matches);
    updateTouchDevice();
    mediaQuery.addEventListener("change", updateTouchDevice);
    return () => mediaQuery.removeEventListener("change", updateTouchDevice);
  }, []);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea || !touchDevice) return;

    let previousY: number | null = null;
    const centerY = (touches: TouchList) =>
      Array.from(touches).reduce((total, touch) => total + touch.clientY, 0) / touches.length;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        previousY = centerY(event.touches);
        setTouchScrollActive(true);
      }
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length < 2 || previousY === null) return;
      const currentY = centerY(event.touches);
      scrollArea.scrollTop -= currentY - previousY;
      previousY = currentY;
      event.preventDefault();
    };
    const stopTouchScroll = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        previousY = null;
        setTouchScrollActive(false);
      }
    };

    scrollArea.addEventListener("touchstart", handleTouchStart, { passive: true });
    scrollArea.addEventListener("touchmove", handleTouchMove, { passive: false });
    scrollArea.addEventListener("touchend", stopTouchScroll, { passive: true });
    scrollArea.addEventListener("touchcancel", stopTouchScroll, { passive: true });
    return () => {
      scrollArea.removeEventListener("touchstart", handleTouchStart);
      scrollArea.removeEventListener("touchmove", handleTouchMove);
      scrollArea.removeEventListener("touchend", stopTouchScroll);
      scrollArea.removeEventListener("touchcancel", stopTouchScroll);
    };
  }, [touchDevice]);

  return (
    <>
      {touchScrollActive && (
        <div
          className="fixed inset-0 z-40 bg-black/35 transition-opacity"
          aria-hidden="true"
          data-testid="phone-scroll-backdrop"
        />
      )}
      <div
        className={cn(
          "relative mx-auto w-full max-w-[340px] rounded-[2.6rem] border-[5px] border-neutral-900 bg-neutral-950 p-1.5 shadow-2xl shadow-black/15",
          touchScrollActive && "z-50",
          className,
        )}
        data-testid="phone-frame"
      >
        <div className="absolute left-1/2 top-3.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black/90" />
        <div
          ref={scrollAreaRef}
          className="overflow-x-hidden rounded-[2rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            height,
            overflowY: touchDevice ? "hidden" : "auto",
            touchAction: touchDevice ? "pan-y" : "auto",
          }}
          data-testid="phone-preview-scroll-area"
        >
          {children}
        </div>
      </div>
    </>
  );
}
