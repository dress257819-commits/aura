import { useEffect, useRef, useState } from "react";

const COLORS = ["#55E7F2", "#42D9C6", "#D9F56A", "#FFE36E", "#FFAA66", "#F16C69"] as const;
const MAX_PARTICLES = 48;
const MAX_POINTS_PER_STRAND = 56;

interface TrailPoint {
  x: number;
  y: number;
  time: number;
  distance: number;
}

interface Strand {
  color: string;
  width: number;
  opacity: number;
  maxLength: number;
  lifetime: number;
  offset: number;
  points: TrailPoint[];
}

interface Fragment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  time: number;
  lastUpdate: number;
  lifetime: number;
  shape: "dot" | "line";
  rotation: number;
}

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

function createStrands(): Strand[] {
  return COLORS.map((color, index) => ({
    color,
    width: randomBetween(0.55, 1.15),
    opacity: randomBetween(0.38, 0.76),
    maxLength: randomBetween(150, 250),
    lifetime: randomBetween(650, 950),
    offset: (index - (COLORS.length - 1) / 2) * randomBetween(0.65, 1.25),
    points: [],
  }));
}

export function CursorTrail() {
  const [enabled, setEnabled] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateEnabled = () => setEnabled(finePointer.matches && !reducedMotion.matches);
    updateEnabled();
    finePointer.addEventListener("change", updateEnabled);
    reducedMotion.addEventListener("change", updateEnabled);

    return () => {
      finePointer.removeEventListener("change", updateEnabled);
      reducedMotion.removeEventListener("change", updateEnabled);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    const strands = createStrands();
    const particles: Fragment[] = [];
    let frameId: number | null = null;
    let previousPointer: { x: number; y: number } | null = null;
    let distanceSinceFragment = 0;
    let pixelRatio = 1;

    const resizeCanvas = () => {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * pixelRatio);
      canvas.height = Math.round(window.innerHeight * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const clearCanvas = () => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };

    const hasVisibleTrail = (now: number) => (
      strands.some((strand) => {
        const latest = strand.points[strand.points.length - 1];
        return latest !== undefined && now - latest.time < strand.lifetime;
      }) || particles.some((particle) => now - particle.time < particle.lifetime)
    );

    const draw = (now: number) => {
      clearCanvas();

      for (const strand of strands) {
        const points = strand.points;
        if (points.length < 2) continue;

        const head = points[points.length - 1];
        context.lineWidth = strand.width;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = strand.color;

        for (let index = 1; index < points.length; index += 1) {
          const previous = points[index - 1];
          const point = points[index];
          const next = points[index + 1];
          const age = now - point.time;
          const distanceBehind = head.distance - point.distance;
          const timeOpacity = Math.max(0, 1 - age / strand.lifetime);
          const distanceOpacity = Math.max(0, 1 - distanceBehind / strand.maxLength);
          const opacity = Math.min(timeOpacity, distanceOpacity) * strand.opacity;
          if (opacity <= 0) continue;

          const startX = index === 1 ? previous.x : (previous.x + point.x) / 2;
          const startY = index === 1 ? previous.y : (previous.y + point.y) / 2;
          const endX = next ? (point.x + next.x) / 2 : point.x;
          const endY = next ? (point.y + next.y) / 2 : point.y;
          context.globalAlpha = opacity;
          context.beginPath();
          context.moveTo(startX, startY);
          context.quadraticCurveTo(point.x, point.y, endX, endY);
          context.stroke();
        }
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        const age = now - particle.time;
        const progress = age / particle.lifetime;
        if (progress >= 1) {
          particles.splice(index, 1);
          continue;
        }

        const seconds = Math.min(now - particle.lastUpdate, 32) / 1000;
        particle.x += particle.vx * seconds;
        particle.y += particle.vy * seconds;
        particle.vx *= 0.985;
        particle.vy *= 0.985;
        particle.lastUpdate = now;

        context.globalAlpha = (1 - progress) * 0.72;
        context.fillStyle = particle.color;
        if (particle.shape === "dot") {
          context.beginPath();
          context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          context.fill();
        } else {
          context.save();
          context.translate(particle.x, particle.y);
          context.rotate(particle.rotation + progress * 0.7);
          context.fillRect(-particle.size, -0.45, particle.size * 2, 0.9);
          context.restore();
        }
      }

      context.globalAlpha = 1;
    };

    const animate = (now: number) => {
      frameId = null;
      draw(now);
      if (hasVisibleTrail(now)) frameId = window.requestAnimationFrame(animate);
      else clearCanvas();
    };

    const startAnimation = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(animate);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      const coalesced = event.getCoalescedEvents?.();
      const samples = coalesced?.length ? coalesced : [event];
      for (const sample of samples) {
        const { clientX: x, clientY: y } = sample;
        const now = performance.now();
        const movementX = previousPointer ? x - previousPointer.x : 0;
        const movementY = previousPointer ? y - previousPointer.y : 0;
        const movementLength = Math.hypot(movementX, movementY);
        const normalX = movementLength > 0 ? -movementY / movementLength : 0;
        const normalY = movementLength > 0 ? movementX / movementLength : 0;
        const steps = Math.min(12, Math.max(1, Math.ceil(movementLength / 6)));

        for (let step = 1; step <= steps; step += 1) {
          const progress = step / steps;
          const sampleX = previousPointer ? previousPointer.x + movementX * progress : x;
          const sampleY = previousPointer ? previousPointer.y + movementY * progress : y;

          for (const strand of strands) {
            const points = strand.points;
            const previous = points[points.length - 1];
            const jitter = randomBetween(-1.6, 1.6);
            const point: TrailPoint = {
              x: sampleX + normalX * strand.offset + normalX * jitter + randomBetween(-0.7, 0.7),
              y: sampleY + normalY * strand.offset + normalY * jitter + randomBetween(-0.7, 0.7),
              time: now,
              distance: previous
                ? previous.distance + Math.hypot(sampleX - previous.x, sampleY - previous.y)
                : 0,
            };
            points.push(point);

            while (
              points.length > 2
              && (point.distance - points[0].distance > strand.maxLength || points.length > MAX_POINTS_PER_STRAND)
            ) {
              points.shift();
            }
          }
        }

        distanceSinceFragment += movementLength;
        if (distanceSinceFragment >= 17 && particles.length < MAX_PARTICLES) {
          distanceSinceFragment %= 17;
          particles.push({
            x: x + randomBetween(-4, 4),
            y: y + randomBetween(-4, 4),
            vx: randomBetween(-21, 21),
            vy: randomBetween(-24, 16),
            size: randomBetween(0.7, 1.45),
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            time: now,
            lastUpdate: now,
            lifetime: randomBetween(260, 520),
            shape: Math.random() < 0.72 ? "dot" : "line",
            rotation: randomBetween(-Math.PI, Math.PI),
          });
        }

        previousPointer = { x, y };
      }

      startAnimation();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (frameId !== null) window.cancelAnimationFrame(frameId);
        frameId = null;
      } else if (hasVisibleTrail(performance.now())) {
        startAnimation();
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      clearCanvas();
    };
  }, [enabled]);

  if (!enabled) return null;

  return <canvas ref={canvasRef} className="cursor-trail-canvas" aria-hidden="true" />;
}
