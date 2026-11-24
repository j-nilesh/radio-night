/**
 * scripts/make-access-code.ts
 * Makes a new access code: 20 random characters from an alphabet without
 * look-alikes, about 100 bits, far beyond guessing. Prints the code (give it to
 * the person) and the entry to put in ACCESS_CODES (label:hash).
 *
 *   npm run make:code -- judges
 *
 * The code is shown once and never stored here. Then:
 *   fly secrets set ACCESS_CODES="judges:<hash>,friends:<hash>" -a radio-night
 * Setting ACCESS_CODES replaces the old value, so a short code stops working at once.
 */
import { randomInt } from "node:crypto";
import { accessCodeHash } from "../src/lib/allowance";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1
const label = (process.argv[2] ?? "judges").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "judges";
const body = Array.from({ length: 20 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const code = body.match(/.{5}/g)!.join("-"); // groups of five are easier to read out and to paste

console.log(`Code for ${label}:  ${code}`);
console.log(`ACCESS_CODES entry: ${label}:${accessCodeHash(code)}`);
