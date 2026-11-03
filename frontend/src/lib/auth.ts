import type { MeProfile } from "./types";

const SESSION_KEY = "mosaic-demo-session";
const USERS_KEY = "mosaic-demo-users";

const EMPTY_USER: MeProfile = {
  id: "demo-user",
  email: "simran@aura.app",
  username: "simran",
  name: "Simran Khadka",
  bio: "Good food, better fits, and little things worth sharing.",
  location: "Kathmandu",
  avatar_url: "",
  cover_url: "",
  interests: ["streetwear", "comfort food", "music"],
  daily_question: "What's your current comfort-food order?",
  music: [],
  appearance: {
    theme: "minimal",
    font: "jakarta",
    accent: "#6366F1",
    card_style: "rounded",
    glass: 2,
    effects: true,
    custom_css: "",
  },
  explore_visible: true,
  leaderboard_visible: false,
  plan: "pro",
  created_at: new Date().toISOString(),
};

function readUsers(): MeProfile[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) return [EMPTY_USER];
    const parsed = JSON.parse(raw) as MeProfile[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [EMPTY_USER];
  } catch {
    return [EMPTY_USER];
  }
}

function writeUsers(users: MeProfile[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getLocalMe(): MeProfile | null {
  if (typeof window === "undefined") return null;

  const sessionUserId = window.localStorage.getItem(SESSION_KEY);
  if (!sessionUserId) return null;

  const users = readUsers();
  return users.find((user) => user.id === sessionUserId) ?? null;
}

export function persistLocalSession(user: MeProfile): void {
  if (typeof window === "undefined") return;

  const users = readUsers();
  const existingIndex = users.findIndex((entry) => entry.id === user.id || entry.email === user.email);
  if (existingIndex >= 0) {
    users[existingIndex] = { ...users[existingIndex], ...user };
  } else {
    users.push(user);
  }

  writeUsers(users);
  window.localStorage.setItem(SESSION_KEY, user.id);
}

export function clearLocalSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function authenticateLocalUser(email: string, password: string): MeProfile | null {
  const normalizedEmail = email.trim().toLowerCase();
  const users = readUsers();
  const match = users.find((user) => user.email.toLowerCase() === normalizedEmail);

  if (!match) return null;
  if (normalizedEmail === EMPTY_USER.email.toLowerCase() && password === "mosaic123") return match;
  if (password.length >= 8) return match;
  return null;
}

export function createLocalUser(input: { email: string; password: string; name: string; username: string }): MeProfile {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  const name = input.name.trim() || username;
  const user: MeProfile = {
    ...EMPTY_USER,
    id: `local-${Date.now()}`,
    email,
    username,
    name,
    plan: "free",
    created_at: new Date().toISOString(),
  };

  const users = readUsers();
  if (!users.some((entry) => entry.email.toLowerCase() === email || entry.username.toLowerCase() === username)) {
    users.push(user);
    writeUsers(users);
  }

  persistLocalSession(user);
  return user;
}
