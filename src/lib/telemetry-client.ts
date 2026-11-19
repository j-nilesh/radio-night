/**
 * lib/telemetry-client.ts
 * DEVELOPMENT-ONLY browser side of playtest telemetry. Batches events and
 * sends them to /api/dev/telemetry. If the server says telemetry is off (404),
 * it switches itself off for the rest of the page's life.
 * Delete with lib/telemetry.ts before launch.
 */

type Pending = { name: string; at: number; data?: Record<string, unknown> };

let runId: string | undefined;
let queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
// A production build never sends telemetry (the server would refuse it anyway).
let disabled = process.env.NODE_ENV === "production";

export function setTelemetryRun(id: string | undefined): void {
  runId = id;
}

export function track(name: string, data?: Record<string, unknown>): void {
  if (disabled || typeof window === "undefined") return;
  queue.push({ name, at: Date.now(), data });
  if (queue.length >= 25) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), 800);
}

export async function flush(useBeacon = false): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (disabled || queue.length === 0) return;
  const body = JSON.stringify({ runId, events: queue });
  queue = [];
  try {
    if (useBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      navigator.sendBeacon("/api/dev/telemetry", new Blob([body], { type: "application/json" }));
      return;
    }
    const res = await fetch("/api/dev/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: body.length < 60_000,
    });
    if (res.status === 404) disabled = true; // telemetry is off on this server
  } catch {
    /* telemetry must never disturb the game */
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void flush(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush(true);
  });
}
