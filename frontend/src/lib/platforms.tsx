// Social platform registry: brand icons from @icons-pack/react-simple-icons with
// lucide glyph fallbacks for platforms simple-icons doesn't ship.
import type { ComponentType, CSSProperties } from "react";
import {
  SiInstagram, SiFacebook, SiTiktok, SiYoutube, SiWhatsapp, SiSnapchat, SiX,
  SiDiscord, SiTelegram, SiGithub, SiSpotify, SiTwitch,
  SiSoundcloud, SiItchdotio, SiMessenger,
} from "@icons-pack/react-simple-icons";
import { Link2, Globe } from "lucide-react";
import { Linkedin } from "@/lib/lucide-react";

export interface PlatformDef {
  label: string;
  color: string;
  iconColor: string;
  iconBackground?: string;
  icon: ComponentType<{ size?: number | string; color?: string; className?: string }>;
  social: boolean; // true → shown in the compact icon row on profiles
}

export const PLATFORMS: Record<string, PlatformDef> = {
  instagram: { label: "Instagram", color: "#E1306C", iconColor: "#FFFFFF", iconBackground: "#E1306C", icon: SiInstagram, social: true },
  facebook: { label: "Facebook", color: "#1877F2", iconColor: "#FFFFFF", iconBackground: "#1877F2", icon: SiFacebook, social: true },
  tiktok: { label: "TikTok", color: "#111111", iconColor: "#111111", iconBackground: "#FFFFFF", icon: SiTiktok, social: true },
  youtube: { label: "YouTube", color: "#FF0000", iconColor: "#FFFFFF", iconBackground: "#FF0000", icon: SiYoutube, social: true },
  whatsapp: { label: "WhatsApp", color: "#25D366", iconColor: "#FFFFFF", iconBackground: "#25D366", icon: SiWhatsapp, social: true },
  snapchat: { label: "Snapchat", color: "#FFFC00", iconColor: "#111111", iconBackground: "#FFFC00", icon: SiSnapchat, social: true },
  x: { label: "X", color: "#111111", iconColor: "#111111", iconBackground: "#FFFFFF", icon: SiX, social: true },
  linkedin: { label: "LinkedIn", color: "#0A66C2", iconColor: "#FFFFFF", iconBackground: "#0A66C2", icon: Linkedin, social: true },
  discord: { label: "Discord", color: "#5865F2", iconColor: "#FFFFFF", iconBackground: "#5865F2", icon: SiDiscord, social: true },
  telegram: { label: "Telegram", color: "#26A5E4", iconColor: "#FFFFFF", iconBackground: "#26A5E4", icon: SiTelegram, social: true },
  github: { label: "GitHub", color: "#111111", iconColor: "#111111", iconBackground: "#FFFFFF", icon: SiGithub, social: true },
  spotify: { label: "Spotify", color: "#1DB954", iconColor: "#FFFFFF", iconBackground: "#1DB954", icon: SiSpotify, social: true },
  twitch: { label: "Twitch", color: "#9146FF", iconColor: "#FFFFFF", iconBackground: "#9146FF", icon: SiTwitch, social: true },
  soundcloud: { label: "SoundCloud", color: "#FF5500", iconColor: "#FFFFFF", iconBackground: "#FF5500", icon: SiSoundcloud, social: true },
  itch: { label: "itch.io", color: "#FA5C5C", iconColor: "#FFFFFF", iconBackground: "#FA5C5C", icon: SiItchdotio, social: true },
  messenger: { label: "Messenger", color: "#00B2FF", iconColor: "#FFFFFF", iconBackground: "#00B2FF", icon: SiMessenger, social: true },
  custom: { label: "Website", color: "#8B5CF6", iconColor: "#FFFFFF", iconBackground: "#8B5CF6", icon: Globe, social: false },
};

export const PLATFORM_KEYS = Object.keys(PLATFORMS);

export function platformDef(key: string): PlatformDef {
  return PLATFORMS[key] ?? { label: "Link", color: "#8B5CF6", iconColor: "#FFFFFF", icon: Link2, social: false };
}

export function platformIconStyle(key: string) {
  const platform = platformDef(key);
  const background = platform.iconBackground ?? platform.color;
  return {
    background,
    color: platform.iconColor,
    "--orbit-icon-background": background,
  } satisfies CSSProperties & { "--orbit-icon-background": string };
}

export function platformOrbitIconStyle(lightMode: boolean) {
  const background = lightMode ? "#111111" : "#FFFFFF";
  return {
    background,
    color: lightMode ? "#FFFFFF" : "#111111",
    "--orbit-icon-background": background,
  } satisfies CSSProperties & { "--orbit-icon-background": string };
}
