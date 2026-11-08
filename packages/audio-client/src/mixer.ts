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
   * Plays an ArrayBuffer through the specified bus.
   * Returns a Promise that resolves when playback ends.
   */
  async play(
    bus: BusName,
    audioData: ArrayBuffer
  ): Promise<void> {
    const ctx = this.initialize();

    return new Promise((resolve, reject) => {
      ctx.decodeAudioData(
        audioData.slice(0),
        (buffer) => {
          const source = ctx.createBufferSource();
          source.buffer = buffer;

          const busNode = this.buses[bus];
          if (!busNode) {
            reject(new Error(`Bus '${bus}' not found`));
            return;
          }

          source.connect(busNode);
          source.onended = () => resolve();
          source.start();
        },
        (err) => reject(err)
      );
    });
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
