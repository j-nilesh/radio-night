/**
 * GET /admin/usage
 * The owner's view of what the game is spending (ADR 0014): voice characters,
 * speech recognition and model use per day by provider, with estimated cost, and
 * visitors per day (with a code, and how many used up their voice taste).
 *
 * Protected by HTTP Basic authentication: user "admin", password ADMIN_PASSWORD.
 * Without ADMIN_PASSWORD set, the page does not exist (404). No player text is
 * stored or shown here, only counts.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getStore, type UsageDay, type VisitorDay } from "../../../lib/store";
import { speechBudgetStatus } from "../../../lib/speech";
import { codeModelReplies, codeVoiceChars, publicModelReplies, publicVoiceChars } from "../../../lib/allowance";
import { clientIp, enforce } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";

const sha = (s: string) => createHash("sha256").update(s).digest();

function authorised(req: NextRequest, password: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const [user, ...rest] = Buffer.from(header.slice(6), "base64").toString("utf8").split(":");
  return user === "admin" && timingSafeEqual(sha(rest.join(":")), sha(password));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const money = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
const int = (n: number) => Math.round(n).toLocaleString("en-US");

function unitsLabel(feature: string, units: number): string {
  if (feature === "tts") return `${int(units)} characters`;
  if (feature === "stt") return `${(units / 60).toFixed(1)} minutes`;
  return `${int(units)} tokens`;
}

function page(usage: UsageDay[], visitors: VisitorDay[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const monthCost = usage.filter((u) => u.day.startsWith(month)).reduce((n, u) => n + u.costUsd, 0);
  const todayCost = usage.filter((u) => u.day === today).reduce((n, u) => n + u.costUsd, 0);
  const budget = speechBudgetStatus();
  const days = [...new Set([...usage.map((u) => u.day), ...visitors.map((v) => v.day)])].sort().reverse();

  const rows = days
    .map((day) => {
      const u = usage.filter((x) => x.day === day);
      const v = visitors.find((x) => x.day === day);
      const cost = u.reduce((n, x) => n + x.costUsd, 0);
      const detail = u.map((x) => `${esc(x.provider)} ${esc(x.feature)}: ${unitsLabel(x.feature, x.units)} (${money(x.costUsd)})`).join("<br>");
      return `<tr><td>${day}</td><td>${v ? `${v.visitors} visitors, ${v.runs} runs<br>${v.withCode} with a code, ${v.voiceCapped} used up their voice` : "none"}</td><td>${detail || "none"}</td><td class="n">${money(cost)}</td></tr>`;
    })
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Radio Night usage</title>
<style>body{font:15px/1.5 system-ui,sans-serif;background:#141210;color:#eee;margin:0;padding:20px;max-width:960px}h1{font-size:22px}table{border-collapse:collapse;width:100%;margin-top:12px}td,th{border-bottom:1px solid #333;padding:8px;text-align:left;vertical-align:top}.n{text-align:right;white-space:nowrap}.cards{display:flex;flex-wrap:wrap;gap:12px}.card{background:#221f1b;border:1px solid #3d3830;border-radius:8px;padding:12px 16px;min-width:180px}.card b{display:block;font-size:20px;color:#fcd34d}small{color:#999}</style></head><body>
<h1>Radio Night usage</h1>
<div class="cards">
<div class="card"><b>${money(todayCost)}</b>estimated today (UTC)</div>
<div class="card"><b>${money(monthCost)}</b>estimated this month</div>
<div class="card"><b>${int(budget.used)} / ${int(budget.cap)}</b>voice characters today, all visitors (resets on restart)</div>
</div>
<p><small>Allowances: ${int(publicVoiceChars())} voice characters and ${publicModelReplies()} model replies per visitor; with a code ${int(codeVoiceChars())} and ${codeModelReplies()}. Fixed narration (opening, rooms, endings) is not counted against visitors. Costs are estimates from list prices; the provider dashboards are the record.</small></p>
<table><thead><tr><th>Day (UTC)</th><th>Visitors</th><th>Provider use</th><th class="n">Est. cost</th></tr></thead><tbody>${rows || `<tr><td colspan="4">Nothing yet.</td></tr>`}</tbody></table>
</body></html>`;
}

export async function GET(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password || password.length < 12) return new NextResponse(null, { status: 404 });

  const limited = enforce([[{ name: "admin", max: 30, windowMs: 60_000 }, clientIp(req)]]);
  if (limited) return limited;

  if (!authorised(req, password)) {
    return new NextResponse("Sign in to see usage.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Radio Night usage", charset="UTF-8"' } });
  }
  try {
    const store = getStore();
    const [usage, visitors] = await Promise.all([store.usageByDay(31), store.visitorsByDay(31, publicVoiceChars())]);
    return new NextResponse(page(usage, visitors), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  } catch (err) {
    console.error("[GET /admin/usage]", err instanceof Error ? err.message : err);
    return new NextResponse("Usage is not available right now.", { status: 500 });
  }
}
