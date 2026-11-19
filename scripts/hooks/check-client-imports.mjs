#!/usr/bin/env node
/**
 * Kiro hook (PostFileSave on src/**): browser code must never import the solution
 * (truth.ts), the full image manifest, or server-only modules that hold keys.
 * Scans every "use client" file under src/ and fails with the offending lines.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = [/truth/, /images-manifest/, /\/images["']/, /lib\/(providers|speech|store|session|allowance|usage)["']/, /\bprocess\.env\.(?!NODE_ENV\b)[A-Z_]+/];
const offenders = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) {
      const text = readFileSync(p, "utf8");
      if (!/^\s*["']use client["']/m.test(text.slice(0, 400))) continue;
      text.split("\n").forEach((line, i) => {
        const isImport = /^\s*import\b/.test(line);
        if (FORBIDDEN.some((re, k) => (k < 4 ? isImport : true) && re.test(line))) offenders.push(`${p}:${i + 1}: ${line.trim()}`);
      });
    }
  }
};
walk("src");
if (offenders.length) {
  console.error("Browser code must not import server-only or secret material:\n" + offenders.join("\n"));
  process.exit(1);
}
console.log("Browser code imports nothing server-only.");
