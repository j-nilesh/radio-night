/**
 * audio-client/cues.ts
 * Plays the story's non-speech sound: a looping ambience under each scene,
 * optional music, and one-shot stings and effects.
 *
 * It is driven by data (a list of cues) rather than by any one mystery, and it
 * talks to the mixer through a small interface so it can be tested without a
 * browser. Sound must never get in the way of the game, so a missing file, a
 * failed download or a decode error just means silence, and is reported to an
 * optional observer.
 *
 * Settings (volume, ducking) belong to the mixer and never touch run state.
 */

import type { BusName, SoundHandle, StartOptions } from "./mixer";

export type CueKind = "ambience" | "music" | "sting" | "sfx";

export type CueDef = {
  id: string;
  /** Path relative to the player's base URL. */
  file: string;
  kind: CueKind;
  bus: BusName;
  /** This cue's own volume (the bus volume applies on top). */
  gain: number;
  fadeInSec?: number;
  fadeOutSec?: number;
};

/** The part of the mixer the cue player needs. AudioMixer provides it. */
export interface CueMixer<Buffer> {
  decode(data: ArrayBuffer): Promise<Buffer>;
  startBuffer(bus: BusName, buffer: Buffer, opts?: StartOptions): SoundHandle;
}

export type CueObserver = (event: string, data: Record<string, unknown>) => void;

type BedKind = "ambience" | "music";

type Bed = {
  cueId: string | null;
  def?: CueDef;
  handle?: SoundHandle;
  /** Bumped on every change, so a slow download cannot start a cue that is no longer wanted. */
  token: number;
};

const DEFAULT_FADE_IN = 2;
const DEFAULT_FADE_OUT = 1.5;
const HUSH_SEC = 0.15;
const RESTORE_SEC = 0.8;
/** A sting asked for twice this quickly (for example two clues at once) plays once. */
const SAME_CUE_GAP_MS = 400;

export class CuePlayer<Buffer> {
  private readonly defs = new Map<string, CueDef>();
  private readonly loaded = new Map<string, Promise<Buffer | null>>();
  private readonly beds: Record<BedKind, Bed> = {
    ambience: { cueId: null, token: 0 },
    music: { cueId: null, token: 0 },
  };
  private readonly lastPlayed = new Map<string, number>();
  private hushed = false;

  constructor(
    private readonly mixer: CueMixer<Buffer>,
    cues: CueDef[],
    private readonly options: {
      baseUrl?: string;
      fetchFn?: typeof fetch;
      observe?: CueObserver;
      now?: () => number;
    } = {}
  ) {
    for (const cue of cues) this.defs.set(cue.id, cue);
  }

  has(cueId: string): boolean {
    return this.defs.has(cueId);
  }

  /** Download and decode cues ahead of time so they start without a pause. */
  preload(cueIds: string[]): void {
    for (const id of cueIds) {
      const def = this.defs.get(id);
      if (def) void this.load(def);
    }
  }

  /**
   * Make `cueId` the looping bed of this kind, crossfading from the current one.
   * `null` fades the bed out. Asking for what is already playing does nothing.
   */
  async setBed(kind: BedKind, cueId: string | null): Promise<void> {
    const bed = this.beds[kind];
    if (cueId === bed.cueId) return;

    bed.cueId = cueId;
    const token = ++bed.token;
    const previous = bed.handle;
    const previousDef = bed.def;
    bed.handle = undefined;
    bed.def = undefined;
    previous?.stop(previousDef?.fadeOutSec ?? DEFAULT_FADE_OUT);

    if (cueId === null) return;
    const def = this.defs.get(cueId);
    if (!def || def.kind !== kind) {
      this.emit("cue.unknown", { cue: cueId, kind });
      return;
    }

    const buffer = await this.load(def);
    if (!buffer || bed.token !== token) return; // failed, or the player has moved on

    try {
      bed.def = def;
      bed.handle = this.mixer.startBuffer(def.bus, buffer, {
        loop: true,
        gain: this.hushed ? 0 : def.gain,
        fadeInSec: def.fadeInSec ?? DEFAULT_FADE_IN,
      });
      this.emit("cue.bed", { cue: cueId, kind });
    } catch (err) {
      this.emit("cue.error", { cue: cueId, message: err instanceof Error ? err.message : String(err) });
    }
  }

  /** Play a sting or effect once. Silent while hushed (the player is speaking). */
  async play(cueId: string): Promise<void> {
    const def = this.defs.get(cueId);
    if (!def || def.kind === "ambience" || def.kind === "music") {
      this.emit("cue.unknown", { cue: cueId });
      return;
    }
    if (this.hushed) return;

    const now = (this.options.now ?? Date.now)();
    const last = this.lastPlayed.get(cueId);
    if (last !== undefined && now - last < SAME_CUE_GAP_MS) return;
    this.lastPlayed.set(cueId, now);

    const buffer = await this.load(def);
    if (!buffer || this.hushed) return;
    try {
      this.mixer.startBuffer(def.bus, buffer, { gain: def.gain, fadeInSec: def.fadeInSec });
      this.emit("cue.play", { cue: cueId });
    } catch (err) {
      this.emit("cue.error", { cue: cueId, message: err instanceof Error ? err.message : String(err) });
    }
  }

  /**
   * Quieten the beds while the player speaks, so a microphone near a shared
   * speaker hears the person and not the room tone.
   */
  hush(): void {
    this.hushed = true;
    for (const bed of Object.values(this.beds)) bed.handle?.setLevel(0, HUSH_SEC);
  }

  /** Bring the beds back after hush(). */
  restore(): void {
    if (!this.hushed) return;
    this.hushed = false;
    for (const bed of Object.values(this.beds)) {
      if (bed.handle && bed.def) bed.handle.setLevel(bed.def.gain, RESTORE_SEC);
    }
  }

  /** Fade out everything this player started. */
  stopAll(fadeOutSec = DEFAULT_FADE_OUT): void {
    for (const bed of Object.values(this.beds)) {
      bed.token += 1;
      bed.cueId = null;
      bed.handle?.stop(fadeOutSec);
      bed.handle = undefined;
      bed.def = undefined;
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private load(def: CueDef): Promise<Buffer | null> {
    const cached = this.loaded.get(def.id);
    if (cached) return cached;

    const fetchFn = this.options.fetchFn ?? (typeof fetch === "function" ? fetch : undefined);
    const url = `${this.options.baseUrl ?? ""}${def.file}`;
    const started = (this.options.now ?? Date.now)();

    const promise = (async () => {
      try {
        if (!fetchFn) throw new Error("no fetch available");
        const res = await fetchFn(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await this.mixer.decode(await res.arrayBuffer());
        this.emit("cue.loaded", { cue: def.id, ms: (this.options.now ?? Date.now)() - started });
        return buffer;
      } catch (err) {
        this.emit("cue.load_failed", { cue: def.id, message: err instanceof Error ? err.message : String(err) });
        return null;
      }
    })();
    this.loaded.set(def.id, promise);
    return promise;
  }

  private emit(event: string, data: Record<string, unknown>): void {
    try {
      this.options.observe?.(event, data);
    } catch {
      /* an observer must never break the sound */
    }
  }
}
