/**
 * POST /api/access
 * Adds an access code to the visitor's current session, so a judge or a friend who
 * already started playing gets the larger voice allowance without losing the case.
 * Body: { code }. Answers { ok: true } or a plain error.
 *
 * Security: the guest cookie identifies the session; codes are compared as hashes
 * (lib/allowance.ts); attempts are rate limited per IP; the response never says
 * which code matched, and the label stored is not the code.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGuestTokenFromCookie, hashToken } from "../../../lib/session";
import { getStore } from "../../../lib/store";
import { checkAccessCode, codeVoiceChars } from "../../../lib/allowance";
import { clientIp, enforce, RULES } from "../../../lib/rate-limit";

const Body = z.object({ code: z.string().min(1).max(64) });

export async function POST(req: NextRequest) {
  try {
    const limited = enforce([[RULES.accessCode(), clientIp(req)]]);
    if (limited) return limited;
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Enter an access code." }, { status: 400 });

    const rawToken = await getGuestTokenFromCookie();
    if (!rawToken) return NextResponse.json({ error: "Start an investigation first, then add the code." }, { status: 401 });
    const store = getStore();
    const session = await store.findSessionByToken(hashToken(rawToken));
    if (!session) return NextResponse.json({ error: "Start an investigation first, then add the code." }, { status: 401 });

    const label = checkAccessCode(parsed.data.code);
    if (!label) return NextResponse.json({ error: "That access code isn't recognised." }, { status: 400 });
    await store.setAccess(session.id, label, codeVoiceChars());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/access]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
