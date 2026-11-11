/**
 * lib/line-key.ts
 * A short, stable key for one spoken line, computed from its signed audio link.
 * Used only by development telemetry so that the server's record of an audio
 * request and the browser's record of playing it can be matched up.
 * Safe to import from both server and browser code.
 */
export function lineKeyFromUrl(url: string): string {
  const t = url.includes("t=") ? url.slice(url.indexOf("t=") + 2).split("&")[0] : url;
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
