/**
 * audio-client/mixer.ts
 * Web Audio API mixer with three independent buses.
 *
 * Buses:
 *   dialogue  — character speech and narration (highest priority)
 *   music     — background score
 *   fx        — ambient sound effects and atmosphere
 *
 * Features:
 *   - Independent gain control per bus
 *   - Automatic ducking: music + fx volume drops when dialogue plays
 *   - Dialogue Focus preset: more aggressive ducking for shared/noisy rooms
 *   - Settings persisted in localStorage (NOT in run state)
 *   - Smooth gain transitions (no hard cuts)
 */

export type BusName = "dialogue" | "music" | "fx";

/** A streamed line of audio, prepared early and played when its turn comes. */
export type Clip = {
  /** Resolves when the clip finishes or is stopped. Rejects if the browser could not play it. */
  play(): Promise<void>;
  stop(): void;
  readonly failed: boolean;
  readonly stopped: boolean;
};

type Playing = { bus: BusName; stop: () => void };

export type MixerSettings = {
  dialogue: number; // 0–1
  music: number;
  fx: number;
  dialogueFocusEnabled: boolean;
};

export type AudioBusGains = Record<BusName, number>;

const STORAGE_KEY = "radio-night-mixer-settings";

const DEFAULTS: MixerSettings = {
  dialogue: 1.0,
  music: 0.35,
  fx: 0.55,
  dialogueFocusEnabled: false,
};

// Ducking configuration
const DUCK_FACTOR = 0.3; // music/fx reduced to 30% during dialogue
const DIALOGUE_FOCUS_DUCK_FACTOR = 0.1; // more aggressive for shared rooms
const DUCK_ATTACK_MS = 80; // time to duck down
const DUCK_RELEASE_MS = 600; // time to restore after dialogue ends

export class AudioMixer {
  private ctx: AudioContext | null = null;
  private buses: Partial<Record<BusName, GainNode>> = {};
  private masterGain: GainNode | null = null;
  private settings: MixerSettings;
  private isDucking = false;
  private playing = new Set<Playing>();
  private dialogueCount = 0;

  constructor() {
    this.settings = this.loadSettings();
  }

  /** Must be called from a user gesture (e.g. click/tap) to unlock browser audio */
  initialize(): AudioContext {
    if (this.ctx) return this.ctx;

    this.ctx = new AudioContext();

    // Master gain → destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);

    // Bus gain nodes
    for (const bus of ["dialogue", "music", "fx"] as BusName[]) {
      const node = this.ctx.createGain();
      node.gain.value = this.settings[bus];
      node.connect(this.masterGain);
      this.buses[bus] = node;
    }

    return this.ctx;
  }

  get isInitialized(): boolean {
    return this.ctx !== null;
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  /**
   * Plays a fully downloaded recording through the specified bus.
   * Resolves when playback ends or is stopped. Used as the fallback when a
   * browser will not stream; prefer prepare() so playback can start early.
   */
  async play(bus: BusName, audioData: ArrayBuffer): Promise<void> {
    const ctx = this.initialize();
    await this.resume();

    const busNode = this.buses[bus];
    if (!busNode) throw new Error(`Bus '${bus}' not found`);

    const buffer = await ctx.decodeAudioData(audioData.slice(0));
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(busNode);

    const entry: Playing = { bus, stop: () => { try { source.stop(); } catch { /* already ended */ } } };
    this.playing.add(entry);
    this.beginPlaying(bus);

    return new Promise<void>((resolve) => {
      source.onended = () => {
        this.playing.delete(entry);
        this.endPlaying(bus);
        resolve();
      };
      source.start();
    });
  }

  /**
   * Gets a streamed clip ready on the given bus. The browser starts buffering at
   * once, so by the time play() is called (often while the previous line is still
   * speaking) the audio is already arriving. play() can begin before the file is
   * complete, which is what makes a reply audible within a second or so.
   */
  prepare(bus: BusName, url: string): Clip {
    const ctx = this.initialize();
    const busNode = this.buses[bus];
    if (!busNode) throw new Error(`Bus '${bus}' not found`);

    const el = new Audio();
    el.preload = "auto";
    el.src = url;
    const node = ctx.createMediaElementSource(el);
    node.connect(busNode);

    let stopped = false;
    let failed = false;
    let counted = false;
    let finish!: () => void;
    let fail!: (e: Error) => void;
    const ended = new Promise<void>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    ended.catch(() => undefined); // an unplayed clip must not raise an unhandled rejection

    el.addEventListener("ended", () => finish());
    el.addEventListener("error", () => {
      if (stopped) return;
      failed = true;
      fail(new Error("The audio could not be played."));
    });

    const entry: Playing = { bus, stop: () => clip.stop() };
    this.playing.add(entry);

    const release = () => {
      this.playing.delete(entry);
      try { node.disconnect(); } catch { /* already disconnected */ }
      if (counted) {
        counted = false;
        this.endPlaying(bus);
      }
    };

    const clip: Clip = {
      get failed() { return failed; },
      get stopped() { return stopped; },
      play: async () => {
        if (stopped) return;
        await this.resume();
        if (stopped) return;
        counted = true;
        this.beginPlaying(bus);
        try {
          await el.play();
          await ended;
        } catch (err) {
          if (!stopped) failed = true;
          throw err;
        } finally {
          release();
        }
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        el.pause();
        el.removeAttribute("src");
        el.load(); // abandon the download
        finish();
        release();
      },
    };
    return clip;
  }

  /** Stops everything playing or waiting on a bus (or on every bus). */
  stopAll(bus?: BusName): void {
    for (const entry of Array.from(this.playing)) {
      if (!bus || entry.bus === bus) entry.stop();
    }
  }

  // Music and effects duck while any dialogue is playing, and recover when none is.
  private beginPlaying(bus: BusName): void {
    if (bus !== "dialogue") return;
    this.dialogueCount += 1;
    this.duck();
  }

  private endPlaying(bus: BusName): void {
    if (bus !== "dialogue") return;
    this.dialogueCount = Math.max(0, this.dialogueCount - 1);
    if (this.dialogueCount === 0) this.unduck();
  }

  /**
   * Ducks music and fx during dialogue playback.
   * Call before playing dialogue; call unduck() when done.
   */
  duck(): void {
    if (!this.ctx || this.isDucking) return;
    this.isDucking = true;

    const duckFactor = this.settings.dialogueFocusEnabled
      ? DIALOGUE_FOCUS_DUCK_FACTOR
      : DUCK_FACTOR;

    const now = this.ctx.currentTime;
    const attackSec = DUCK_ATTACK_MS / 1000;

    for (const bus of ["music", "fx"] as BusName[]) {
      const node = this.buses[bus];
      if (!node) continue;
      const target = this.settings[bus] * duckFactor;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(target, now + attackSec);
    }
  }

  /** Restores music and fx gain after dialogue ends */
  unduck(): void {
    if (!this.ctx || !this.isDucking) return;
    this.isDucking = false;

    const now = this.ctx.currentTime;
    const releaseSec = DUCK_RELEASE_MS / 1000;

    for (const bus of ["music", "fx"] as BusName[]) {
      const node = this.buses[bus];
      if (!node) continue;
      const target = this.settings[bus];
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(target, now + releaseSec);
    }
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  setGain(bus: BusName, value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.settings[bus] = clamped;

    // Apply immediately (unless currently ducked)
    const node = this.buses[bus];
    if (node && this.ctx && !this.isDucking) {
      const now = this.ctx.currentTime;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(clamped, now + 0.02);
    }

    this.saveSettings();
  }

  setDialogueFocus(enabled: boolean): void {
    this.settings.dialogueFocusEnabled = enabled;
    this.saveSettings();
  }

  getSettings(): Readonly<MixerSettings> {
    return { ...this.settings };
  }

  // ---------------------------------------------------------------------------
  // Persistence (localStorage only — NOT run state)
  // ---------------------------------------------------------------------------

  private loadSettings(): MixerSettings {
    if (typeof localStorage === "undefined") return { ...DEFAULTS };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw) as Partial<MixerSettings>;
      return {
        dialogue: parsed.dialogue ?? DEFAULTS.dialogue,
        music: parsed.music ?? DEFAULTS.music,
        fx: parsed.fx ?? DEFAULTS.fx,
        dialogueFocusEnabled:
          parsed.dialogueFocusEnabled ?? DEFAULTS.dialogueFocusEnabled,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  private saveSettings(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
  }

  // ---------------------------------------------------------------------------
  // Resume (required after browser suspends AudioContext)
  // ---------------------------------------------------------------------------

  async resume(): Promise<void> {
    if (this.ctx?.state === "suspended") {
      await this.ctx.resume();
    }
  }

  destroy(): void {
    this.ctx?.close();
    this.ctx = null;
    this.buses = {};
    this.masterGain = null;
  }
}

// Singleton for use across the app
let _mixerInstance: AudioMixer | null = null;

export function getMixer(): AudioMixer {
  if (!_mixerInstance) {
    _mixerInstance = new AudioMixer();
  }
  return _mixerInstance;
}
