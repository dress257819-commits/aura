// Visitor identity + tracking helpers (per-browser, used for poll dedupe and message rate limits).
export function visitorId(): string {
  let id = localStorage.getItem("mosaic_visitor_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("mosaic_visitor_id", id);
  }
  return id;
}

// One profile_view per browser session per username — StrictMode double-fires are real.
export function shouldTrackView(username: string): boolean {
  const key = `mosaic_viewed_${username}`;
  if (sessionStorage.getItem(key)) return false;
  sessionStorage.setItem(key, "1");
  return true;
}
