#!/usr/bin/env node
/**
 * Kiro hook (PostFileSave on .gitignore): the contest requires the /.kiro directory
 * to be committed, and ignoring it can disqualify the entry. Fails loudly if any
 * part of .kiro has become ignored.
 */
import { execFileSync } from "node:child_process";

const paths = [".kiro/steering/architecture.md", ".kiro/specs/launch-plan.md", ".kiro/hooks/project-hooks.json"];
const ignored = paths.filter((p) => {
  try {
    execFileSync("git", ["check-ignore", "-q", p]);
    return true; // exit 0 means it is ignored
  } catch {
    return false;
  }
});
if (ignored.length) {
  console.error(`.gitignore now ignores ${ignored.join(", ")}. The Kiroween rules require /.kiro to be committed: remove that rule.`);
  process.exit(1);
}
console.log(".kiro is still committed (not ignored).");
