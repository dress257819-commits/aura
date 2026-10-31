// Profile theme presets + font pairings. Shared by the public profile renderer,
// the customization studio preview and the story studio.
import type { Appearance } from "@/lib/types";

export interface ProfileTheme {
  key: string;
  name: string;
  creatorOnly?: boolean;
  bg: string;            // css background
  surface: string;       // solid base shade used to blend profile covers into the page
  text: string;
  muted: string;
  card: string;          // card background (rgba ok)
  cardBorder: string;
  chipBg: string;
  chipText: string;
  accent: string;        // default accent for the theme
  coverScrim: string;    // gradient scrim over the cover image
}

export const PROFILE_THEMES: Record<string, ProfileTheme> = {
  aurora: {
    key: "aurora",
    name: "Midnight Aurora",
    bg: "radial-gradient(120% 90% at 15% 0%, #1B2140 0%, rgba(27,33,64,0) 55%), radial-gradient(100% 80% at 90% 10%, #2B1147 0%, rgba(43,17,71,0) 50%), #0B0D11",
    surface: "#0B0D11",
    text: "#F3F4F6",
    muted: "#9CA3AF",
    card: "rgba(255,255,255,0.055)",
    cardBorder: "rgba(255,255,255,0.10)",
    chipBg: "rgba(99,102,241,0.16)",
    chipText: "#C7D2FE",
    accent: "#6366F1",
    coverScrim: "linear-gradient(180deg, rgba(11,13,17,0.05) 40%, rgba(11,13,17,0.92) 100%)",
  },
  minimal: {
    key: "minimal",
    name: "Clean Minimal",
    bg: "#F8FAFC",
    surface: "#F8FAFC",
    text: "#0F172A",
    muted: "#64748B",
    card: "#FFFFFF",
    cardBorder: "#E2E8F0",
    chipBg: "#EEF2FF",
    chipText: "#4338CA",
    accent: "#4F46E5",
    coverScrim: "linear-gradient(180deg, rgba(248,250,252,0) 40%, rgba(248,250,252,0.95) 100%)",
  },
  "aura-editorial": {
    key: "aura-editorial",
    name: "AURA Editorial",
    bg: "#F3EEE8",
    surface: "#F3EEE8",
    text: "#171615",
    muted: "#6F6A64",
    card: "#F8F5F1",
    cardBorder: "#E3DCD2",
    chipBg: "#EEE8E0",
    chipText: "#625A50",
    accent: "#947442",
    coverScrim: "linear-gradient(180deg, rgba(31,28,21,0.04) 35%, rgba(45,37,24,0.46) 100%)",
  },
  matcha: {
    key: "matcha",
    name: "Matcha Warmth",
    bg: "radial-gradient(120% 90% at 80% 0%, #E7F0E4 0%, rgba(231,240,228,0) 60%), #F4F1E8",
    surface: "#F4F1E8",
    text: "#1C2A22",
    muted: "#5C6B5F",
    card: "rgba(255,255,255,0.72)",
    cardBorder: "rgba(28,42,34,0.10)",
    chipBg: "#DDEBD8",
    chipText: "#22577A",
    accent: "#2F855A",
    coverScrim: "linear-gradient(180deg, rgba(244,241,232,0) 40%, rgba(244,241,232,0.95) 100%)",
  },
  cyber: {
    key: "cyber",
    name: "Cyber Tokyo",
    bg: "radial-gradient(110% 80% at 10% 5%, #2A0A3D 0%, rgba(42,10,61,0) 55%), radial-gradient(90% 70% at 95% 20%, #083344 0%, rgba(8,51,68,0) 55%), #0A0714",
    surface: "#0A0714",
    text: "#F5D0FE",
    muted: "#B0A7C9",
    card: "rgba(236,72,153,0.075)",
    cardBorder: "rgba(236,72,153,0.28)",
    chipBg: "rgba(236,72,153,0.16)",
    chipText: "#F9A8D4",
    accent: "#EC4899",
    coverScrim: "linear-gradient(180deg, rgba(10,7,20,0.05) 40%, rgba(10,7,20,0.92) 100%)",
  },
  neo: {
    key: "neo",
    name: "Neo-Brutalist",
    bg: "#FDF0D5",
    surface: "#FDF0D5",
    text: "#111111",
    muted: "#4B4B4B",
    card: "#FFFFFF",
    cardBorder: "#111111",
    chipBg: "#FFE066",
    chipText: "#111111",
    accent: "#111111",
    coverScrim: "linear-gradient(180deg, rgba(253,240,213,0) 40%, rgba(253,240,213,0.96) 100%)",
  },
  luxe: {
    key: "luxe",
    name: "Luxe Noir",
    creatorOnly: true,
    bg: "radial-gradient(110% 85% at 50% 0%, #241C0A 0%, rgba(36,28,10,0) 60%), #0C0A06",
    surface: "#0C0A06",
    text: "#F5EBD0",
    muted: "#A89877",
    card: "rgba(250,204,21,0.055)",
    cardBorder: "rgba(250,204,21,0.22)",
    chipBg: "rgba(250,204,21,0.12)",
    chipText: "#FDE68A",
    accent: "#D4AF37",
    coverScrim: "linear-gradient(180deg, rgba(12,10,6,0.05) 40%, rgba(12,10,6,0.94) 100%)",
  },
  "creator-hub": {
    key: "creator-hub",
    name: "Futuristic Creator Hub",
    bg: "radial-gradient(ellipse at 50% 0%, #21133B 0%, #0A0910 48rem)",
    surface: "#0A0910",
    text: "#F7F4FF",
    muted: "#B7ADC9",
    card: "rgba(25,21,34,0.78)",
    cardBorder: "rgba(208,177,255,0.18)",
    chipBg: "rgba(157,93,255,0.16)",
    chipText: "#DCC4FF",
    accent: "#9B5CFF",
    coverScrim: "linear-gradient(180deg, rgba(7,6,12,0.16) 12%, rgba(10,9,16,0.78) 78%, #0A0910 100%)",
  },
};

export const FONT_OPTIONS: Record<string, { name: string; stack: string }> = {
  jakarta: { name: "Plus Jakarta", stack: "'Plus Jakarta Sans Variable', sans-serif" },
  "dm-sans": { name: "DM Sans", stack: "'DM Sans Variable', sans-serif" },
  sora: { name: "Sora", stack: "'Sora Variable', sans-serif" },
  "space-grotesk": { name: "Space Grotesk", stack: "'Space Grotesk Variable', sans-serif" },
  playfair: { name: "Playfair Display", stack: "'Playfair Display Variable', serif" },
  lora: { name: "Lora", stack: "'Lora Variable', serif" },
};

export function themeOf(appearance: Appearance | { theme: string }): ProfileTheme {
  return PROFILE_THEMES[(appearance as { theme: string }).theme] ?? PROFILE_THEMES.aurora;
}

export function fontStack(key: string): string {
  return (FONT_OPTIONS[key] ?? FONT_OPTIONS.jakarta).stack;
}

// Story studio gradient presets
export const STORY_PRESETS = [
  { key: "violet", name: "Violet Dream", from: "#2E1065", via: "#6D28D9", to: "#EC4899" },
  { key: "sunset", name: "Sunset Heat", from: "#7C2D12", via: "#EA580C", to: "#FACC15" },
  { key: "ocean", name: "Deep Ocean", from: "#082F49", via: "#0369A1", to: "#22D3EE" },
  { key: "noir", name: "Noir", from: "#09090B", via: "#27272A", to: "#52525B" },
  { key: "matcha", name: "Matcha", from: "#14532D", via: "#16A34A", to: "#BEF264" },
  { key: "candy", name: "Candy Pop", from: "#BE185D", via: "#F472B6", to: "#FDE68A" },
];

export const STORY_STICKERS = ["♡", "⚡", "🔥", "✿", "☾", "♪", "✺", "❋", "◉"];
