/**
 * lib/session.ts
 * Guest session token management.
 * SERVER-ONLY — never import this from client components.
 *
 * Token scheme:
 *   - A cryptographically random 24-byte value (urlsafe base64)
 *   - HMAC-SHA256 of the random bytes using GUEST_TOKEN_SECRET
 *   - Only the HMAC hash is stored in the database
 *   - The raw token is set as an httpOnly, Secure, SameSite=Strict cookie
 */

import { createHmac, randomBytes } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "rn_guest_token";
const TOKEN_EXPIRY_DAYS = 30;

function getSecret(): string {
  const secret = process.env.GUEST_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "GUEST_TOKEN_SECRET is not set or too short. See .env.example."
    );
  }
  return secret;
}

export function generateGuestToken(): { raw: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  const hash = createHmac("sha256", getSecret()).update(raw).digest("hex");
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return createHmac("sha256", getSecret()).update(raw).digest("hex");
}

export function makeExpiryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + TOKEN_EXPIRY_DAYS);
  return d;
}

export async function getGuestTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export function buildCookieHeader(raw: string): string {
  const expires = makeExpiryDate().toUTCString();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${raw}; HttpOnly${secure}; SameSite=Strict; Path=/; Expires=${expires}`;
}
