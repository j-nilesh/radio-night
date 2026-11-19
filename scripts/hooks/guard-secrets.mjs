#!/usr/bin/env node
/**
 * Kiro hook (PreToolUse, shell): refuse a command that would print secrets into the
 * conversation, for example `cat .env.local` or `echo $ELEVENLABS_API_KEY`.
 * Kiro passes the tool call as JSON on stdin; exit 2 blocks the call and the
 * message on stderr explains why. Anything else is allowed (exit 0).
 *
 * Reading .env.local inside a script that never prints values (for example piping
 * keys to `fly secrets import`) is fine and is not matched here.
 */
let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  const text = input.replace(/\\"/g, '"');
  const printsEnvFile = /\b(cat|less|more|head|tail|bat|nl|strings|xxd|od)\b[^|;&\n]*\.env(\.local|\.production)?\b(?!\.example)/;
  const echoesSecret = /\b(echo|printf|printenv)\b[^|;&\n]*\$\{?[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL)\b/;
  const listsSecrets = /\bfly\s+secrets\s+(list|show)\b[^|;&\n]*--json/;
  if (printsEnvFile.test(text) || echoesSecret.test(text) || listsSecrets.test(text)) {
    process.stderr.write(
      "Blocked by the guard-secrets hook: this command would print secret values (API keys, passwords, the database URL) into the conversation. Read them inside a script that never prints them, or print only the variable names.\n"
    );
    process.exit(2);
  }
  process.exit(0);
});
