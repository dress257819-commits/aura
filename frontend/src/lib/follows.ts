const LOCAL_FOLLOWS_PREFIX = "mosaic-demo-follows:";

function readLocalFollows(userId: string): Set<string> {
  const raw = window.localStorage.getItem(`${LOCAL_FOLLOWS_PREFIX}${userId}`);
  if (!raw) return new Set();

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((username) => typeof username === "string")) {
    throw new Error("Saved follows are invalid. Clear this browser's local AURA data and try again.");
  }
  return new Set(parsed);
}

export function isLocallyFollowing(userId: string, username: string): boolean {
  return readLocalFollows(userId).has(username.toLowerCase());
}

export function setLocalFollowing(userId: string, username: string, following: boolean): void {
  const follows = readLocalFollows(userId);
  const normalizedUsername = username.toLowerCase();
  if (following) follows.add(normalizedUsername);
  else follows.delete(normalizedUsername);
  window.localStorage.setItem(`${LOCAL_FOLLOWS_PREFIX}${userId}`, JSON.stringify([...follows]));
}
