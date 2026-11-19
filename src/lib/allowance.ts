/**
 * lib/allowance.ts
 * How much voice and how many model-played replies each visitor gets (ADR 0014).
 * SERVER-ONLY.
 *
 *   - Everyone gets a small taste of voice (PUBLIC_VOICE_CHARS). When it is used up
 *     the game carries on in text: the written lines, with captions.
 *   - An access code (for judges and friends) raises the voice allowance
 *     (CODE_VOICE_CHARS) and the model-reply allowance.
 *   - Model-played replies are capped per visitor too, so a script cannot run up the
 *     model bill; past the cap a character answers with the written lines only.
 *
 * Access codes are configured as ACCESS_CODES="label:sha256hex,label:sha256hex".
 * Only hashes live in the environment; the label (for example "judges") is what is
 * recorded on the visitor's session, never the code. Make a hash with
 *   node -e "console.log(require('crypto').createHash('sha256').update('THE-CODE').digest('hex'))"
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { SessionRecord } from "./store";

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

/** Characters of speech for a visitor without a code: the opening and a dozen or so replies. */
export const publicVoiceChars = () => num("PUBLIC_VOICE_CHARS", 4000);
/** Characters of speech for a visitor with a code: more than a full playthrough. */
export const codeVoiceChars = () => num("CODE_VOICE_CHARS", 60000);
export const publicModelReplies = () => num("PUBLIC_MODEL_REPLIES", 120);
export const codeModelReplies = () => num("CODE_MODEL_REPLIES", 400);

export function voiceAllowance(session: Pick<SessionRecord, "voiceCharsAllowance">): number {
  return session.voiceCharsAllowance ?? publicVoiceChars();
}

export function voiceLeft(session: Pick<SessionRecord, "voiceCharsAllowance" | "voiceCharsUsed">): number {
  return Math.max(0, voiceAllowance(session) - session.voiceCharsUsed);
}

export function modelRepliesLeft(session: Pick<SessionRecord, "accessLabel" | "modelRepliesUsed">): number {
  const cap = session.accessLabel ? codeModelReplies() : publicModelReplies();
  return Math.max(0, cap - session.modelRepliesUsed);
}

const hash = (code: string) => createHash("sha256").update(code.trim().toUpperCase()).digest();

/** The label of the access code, or null if it is not a valid code. Constant time per configured code. */
export function checkAccessCode(code: string, configured = process.env.ACCESS_CODES ?? ""): string | null {
  if (typeof code !== "string" || code.trim().length < 4 || code.length > 64) return null;
  const given = hash(code);
  let match: string | null = null;
  for (const entry of configured.split(",")) {
    const [label, hex] = entry.split(":").map((x) => x?.trim());
    if (!label || !hex || !/^[0-9a-f]{64}$/i.test(hex)) continue;
    if (timingSafeEqual(given, Buffer.from(hex, "hex")) && !match) match = label.slice(0, 40);
  }
  return match;
}

/** The hash to put in ACCESS_CODES for a code (codes are compared without case or surrounding space). */
export function accessCodeHash(code: string): string {
  return hash(code).toString("hex");
}
