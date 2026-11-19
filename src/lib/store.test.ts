/**
 * The saved-investigation lookup: which run "continue" offers, and who may see it.
 * Runs against the in-memory store (no DATABASE_URL in tests); the Neon store has
 * the same contract and is checked once a database is connected.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { RunState } from "@game-core";
import { getStore, type RunRecord } from "./store";

const state = (revision: number) => ({ revision }) as unknown as RunState;
const run = (id: string, guestSessionId: string, revision = 0): RunRecord => ({
  id,
  guestSessionId,
  caseId: "radio-night-s01",
  caseVersion: "v1",
  playMode: "solo",
  revision,
  stateJson: state(revision),
});
const later = (ms = 5) => new Promise((r) => setTimeout(r, ms));

let tag = 0;
beforeEach(() => {
  tag++;
});

describe("findLatestRunForToken", () => {
  it("returns nothing for a token that owns no run", async () => {
    expect(await getStore().findLatestRunForToken(`nobody-${tag}`)).toBeNull();
  });

  it("returns the run saved for that token, with when it was last saved", async () => {
    const store = getStore();
    const session = await store.createSession(`tok-a-${tag}`, new Date(Date.now() + 1e9));
    await store.createRun(run(`run-a-${tag}`, session.id));
    const found = await store.findLatestRunForToken(`tok-a-${tag}`);
    expect(found?.run.id).toBe(`run-a-${tag}`);
    expect(found?.run.updatedAt).toBeInstanceOf(Date);
  });

  it("picks the most recently saved run when a token has several", async () => {
    const store = getStore();
    const session = await store.createSession(`tok-b-${tag}`, new Date(Date.now() + 1e9));
    await store.createRun(run(`old-${tag}`, session.id));
    await later();
    await store.createRun(run(`new-${tag}`, session.id));
    expect((await store.findLatestRunForToken(`tok-b-${tag}`))?.run.id).toBe(`new-${tag}`);
    // Playing the older one makes it the latest
    await later();
    await store.updateRunState(`old-${tag}`, state(1), 0);
    expect((await store.findLatestRunForToken(`tok-b-${tag}`))?.run.id).toBe(`old-${tag}`);
  });

  it("never shows one player's run to another token", async () => {
    const store = getStore();
    const mine = await store.createSession(`tok-mine-${tag}`, new Date(Date.now() + 1e9));
    const theirs = await store.createSession(`tok-theirs-${tag}`, new Date(Date.now() + 1e9));
    await store.createRun(run(`mine-${tag}`, mine.id));
    await store.createRun(run(`theirs-${tag}`, theirs.id));
    expect((await store.findLatestRunForToken(`tok-mine-${tag}`))?.run.id).toBe(`mine-${tag}`);
    expect((await store.findLatestRunForToken(`tok-theirs-${tag}`))?.run.id).toBe(`theirs-${tag}`);
    expect(await store.findLatestRunForToken(`tok-forged-${tag}`)).toBeNull();
  });

  it("remembers saves across a development hot reload", async () => {
    const first = getStore();
    const session = await first.createSession(`tok-c-${tag}`, new Date(Date.now() + 1e9));
    await first.createRun(run(`run-c-${tag}`, session.id));
    // A reload re-evaluates the module but the store lives on globalThis
    expect(getStore()).toBe(first);
    expect((await getStore().findLatestRunForToken(`tok-c-${tag}`))?.run.id).toBe(`run-c-${tag}`);
  });
});
