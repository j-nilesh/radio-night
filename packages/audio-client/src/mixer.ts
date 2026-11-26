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

import { pcm16ToFloat32, sampleRateFromContentType, PcmCoalescer } from "./pcm";

export type BusName = "dialogue" | "music" | "fx";

/** Receives named events about a clip's life (for development telemetry). */
export type ClipObserver = (event: string, data: Record<string, unknown>) => void;

/** A streamed line of audio, prepared early and played when its turn comes. */
export type Clip = {
  /** Resolves when the clip finishes or is stopped. Rejects if it could not be played. */
  play(): Promise<void>;
  stop(reason?: string): void;
  readonly failed: boolean;
  readonly stopped: boolean;
};

type Playing = { bus: BusName; stop: (reason?: string) => void };

export type StartOptions = {
  loop?: boolean;
  /** This sound's own volume, 0 and up (the bus volume applies on top). Default 1. */
  gain?: number;
  fadeInSec?: number;
  /** Lower this sound while speech plays. Default true; stings and effects pass false. */
  duck?: boolean;
};

/** A sound started with startBuffer(). */
export type SoundHandle = {
  /** Fade out over `fadeOutSec` (default 0.5) and stop. */
  stop(fadeOutSec?: number): void;
  /** Move this sound's own volume to `value` over `overSec`. */
  setLevel(value: number, overSec?: number): void;
  readonly stopped: boolean;
  /** Resolves when the sound has ended or been stopped. */
  readonly ended: Promise<void>;
};

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

// Speech starts once this much has arrived (or the stream ends), but never waits longer than the cap.
const START_BUFFER_SEC = 0.15;
const START_BUFFER_MAX_WAIT_MS = 600;
// Only this much speech is handed to the audio graph ahead of the play position. The server sends
// audio much faster than it plays, so scheduling every block on arrival put well over a hundred
// nodes into the graph at once for a long line (the 28 s opening), in a burst at the very moment
// the room sound and music start. Phones struggle with that. A few seconds ahead is plenty to ride
// out a stalled page, and the rest waits its turn.
const LOOKAHEAD_SEC = 2.5;
const LOOKAHEAD_CHECK_MS = 250;

export class AudioMixer {
  private ctx: AudioContext | null = null;
  private buses: Partial<Record<BusName, GainNode>> = {};
  private duckNodes: Partial<Record<BusName, GainNode>> = {};
  private masterGain: GainNode | null = null;
  private settings: MixerSettings;
  private isDucking = false;
  private playing = new Set<Playing>();
  private dialogueCount = 0;
  private dialogueAnalyser: AnalyserNode | null = null;
  private levelBuffer: Float32Array<ArrayBuffer> | null = null;

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

    // A level tap on the dialogue bus for the VU meter. It sits in series (bus → analyser →
    // master) because Safari only runs an analyser that has an output.
    const dialogueBus = this.buses.dialogue as GainNode;
    this.dialogueAnalyser = this.ctx.createAnalyser();
    this.dialogueAnalyser.fftSize = 512;
    dialogueBus.disconnect();
    dialogueBus.connect(this.dialogueAnalyser);
    this.dialogueAnalyser.connect(this.masterGain);

    // Ducking acts on a stage in front of the music and fx buses that only
    // beds (ambience, music) go through. One-shot stings and effects bypass it,
    // so a chime that lands as narration begins is heard at its full level.
    for (const bus of ["music", "fx"] as BusName[]) {
      const duckNode = this.ctx.createGain();
      duckNode.gain.value = 1;
      duckNode.connect(this.buses[bus] as GainNode);
      this.duckNodes[bus] = duckNode;
    }

    return this.ctx;
  }

  get isInitialized(): boolean {
    return this.ctx !== null;
  }

  /**
   * How loud speech is right now, 0 (silent) to 1, after the dialogue volume.
   * 0 before the mixer starts. Read once per animation frame by the VU meter.
   */
  dialogueLevel(): number {
    const analyser = this.dialogueAnalyser;
    if (!analyser) return 0;
    if (!this.levelBuffer || this.levelBuffer.length !== analyser.fftSize) {
      this.levelBuffer = new Float32Array(analyser.fftSize);
    }
    analyser.getFloatTimeDomainData(this.levelBuffer);
    let sum = 0;
    for (const v of this.levelBuffer) sum += v * v;
    return Math.min(1, Math.sqrt(sum / this.levelBuffer.length));
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

  /** Decode a downloaded sound file (wav, mp3, ogg...) into a playable buffer. */
  async decode(data: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.initialize();
    return ctx.decodeAudioData(data.slice(0));
  }

  /**
   * Start a decoded sound on a bus, optionally looping, with its own volume and
   * fades. Used for ambience, music and sound effects (not for speech, which is
   * streamed through prepare()). The bus's ducking and gain still apply on top.
   */
  startBuffer(bus: BusName, buffer: AudioBuffer, opts: StartOptions = {}): SoundHandle {
    const ctx = this.initialize();
    const busNode = this.buses[bus];
    if (!busNode) throw new Error(`Bus '${bus}' not found`);

    const level = Math.max(0, opts.gain ?? 1);
    const fadeInSec = Math.max(0, opts.fadeInSec ?? 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = !!opts.loop;
    const own = ctx.createGain();
    own.gain.setValueAtTime(fadeInSec > 0 ? 0 : level, ctx.currentTime);
    if (fadeInSec > 0) own.gain.linearRampToValueAtTime(level, ctx.currentTime + fadeInSec);
    source.connect(own);
    // Beds duck under speech; one-shots (duck: false) do not.
    own.connect(opts.duck === false ? busNode : (this.duckNodes[bus] ?? busNode));

    let stopped = false;
    let resolveEnded!: () => void;
    const ended = new Promise<void>((r) => (resolveEnded = r));
    const cleanup = () => {
      stopped = true;
      try { source.disconnect(); } catch { /* already disconnected */ }
      try { own.disconnect(); } catch { /* already disconnected */ }
      resolveEnded();
    };
    source.onended = cleanup;
    source.start();

    return {
      ended,
      get stopped() { return stopped; },
      setLevel: (value, overSec = 0.3) => {
        if (stopped) return;
        const now = ctx.currentTime;
        own.gain.cancelScheduledValues(now);
        own.gain.setValueAtTime(own.gain.value, now);
        own.gain.linearRampToValueAtTime(Math.max(0, value), now + Math.max(0.01, overSec));
      },
      stop: (fadeOutSec = 0.5) => {
        if (stopped) return;
        const now = ctx.currentTime;
        const fade = Math.max(0.02, fadeOutSec);
        own.gain.cancelScheduledValues(now);
        own.gain.setValueAtTime(own.gain.value, now);
        own.gain.linearRampToValueAtTime(0, now + fade);
        try { source.stop(now + fade + 0.02); } catch { /* already ended */ }
      },
    };
  }

  /**
   * Gets a streamed line of speech ready on the given bus.
   *
   * The audio is fetched at once and decoded as it arrives, so by the time
   * play() is called (often while the previous line is still speaking) it is
   * already buffering, and play() can begin before the line has finished
   * downloading. Raw 16-bit PCM from the server is turned into Web Audio
   * buffers and scheduled back to back, which behaves identically in every
   * browser; compressed audio (not used by the game) is decoded whole.
   */
  prepare(bus: BusName, url: string, observe?: ClipObserver): Clip {
    const ctx = this.initialize();
    const busNode = this.buses[bus];
    if (!busNode) throw new Error(`Bus '${bus}' not found`);

    const startedAt = performance.now();
    const emit = (event: string, data: Record<string, unknown> = {}) => {
      try {
        observe?.(event, { sinceRequestMs: Math.round(performance.now() - startedAt), ...data });
      } catch {
        /* an observer must never break playback */
      }
    };
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const abort = new AbortController();
    const pending: AudioBuffer[] = [];
    const sources = new Set<AudioBufferSourceNode>();
    const coalescer = new PcmCoalescer();
    let sampleRate = 24_000;
    let carry: Uint8Array | null = null;

    let streamDone = false;
    let stopped = false;
    let failed = false;
    let playing = false;
    let counted = false;
    let settled = false;
    let firstSoundEmitted = false;
    let nextStart = 0;
    let audioSeconds = 0;
    let totalBytes = 0;
    let underruns = 0;
    let maxLive = 0; // most audio nodes alive at once, for telemetry
    let lookTimer: ReturnType<typeof setTimeout> | null = null;
    let playCalledAt = 0;

    let finish!: () => void;
    let fail!: (e: Error) => void;
    const finished = new Promise<void>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    finished.catch(() => undefined); // a clip nobody plays must not raise an unhandled rejection

    const entry: Playing = { bus, stop: (reason) => clip.stop(reason) };
    this.playing.add(entry);

    const settle = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (gateTimer) clearTimeout(gateTimer);
      gateTimer = null;
      if (lookTimer) clearTimeout(lookTimer);
      lookTimer = null;
      this.playing.delete(entry);
      if (counted) {
        counted = false;
        this.endPlaying(bus);
      }
      if (err) fail(err);
      else finish();
    };

    const checkDone = () => {
      if (playing && streamDone && pending.length === 0 && sources.size === 0 && !stopped && !settled) {
        emit("ended", {
          audioSeconds: round2(audioSeconds),
          bytes: totalBytes,
          underruns,
          maxLiveSources: maxLive,
          playedMs: Math.round(performance.now() - playCalledAt),
        });
        settle();
      }
    };

    // Starting on the very first network chunk (about 40 ms of sound) left a small
    // gap about 150 ms into every line, because the next chunk arrived late. So
    // wait for a little audio first, but never for long.
    let gateOpen = false;
    let gateTimer: ReturnType<typeof setTimeout> | null = null;
    const bufferedSec = () => pending.reduce((n, b) => n + b.duration, 0);

    const schedule = () => {
      if (!playing || stopped) return;
      if (!gateOpen) {
        if (streamDone || bufferedSec() >= START_BUFFER_SEC) {
          gateOpen = true;
          if (gateTimer) clearTimeout(gateTimer);
          gateTimer = null;
        } else {
          if (!gateTimer) {
            gateTimer = setTimeout(() => {
              gateTimer = null;
              gateOpen = true;
              schedule();
            }, START_BUFFER_MAX_WAIT_MS);
          }
          return;
        }
      }
      while (pending.length > 0 && nextStart - ctx.currentTime < LOOKAHEAD_SEC) {
        const buffer = pending.shift() as AudioBuffer;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(busNode);

        const now = ctx.currentTime;
        if (nextStart < now) {
          // The audio did not arrive as fast as it plays: there will be a gap.
          if (firstSoundEmitted) {
            underruns += 1;
            emit("underrun", { lateMs: Math.round((now - nextStart) * 1000) });
          }
          nextStart = now + 0.02;
        }
        if (!firstSoundEmitted) {
          firstSoundEmitted = true;
          emit("first_sound", {
            sincePlayMs: Math.round(performance.now() - playCalledAt),
            scheduledInMs: Math.round((nextStart - now) * 1000),
          });
        }
        source.start(nextStart);
        nextStart += buffer.duration;
        sources.add(source);
        if (sources.size > maxLive) maxLive = sources.size;
        source.onended = () => {
          sources.delete(source);
          schedule(); // room for the next block
          checkDone();
        };
      }
      // Blocks are waiting beyond the lookahead: look again shortly, in case no block ends first.
      if (pending.length > 0 && !lookTimer && !stopped && !settled) {
        lookTimer = setTimeout(() => {
          lookTimer = null;
          schedule();
        }, LOOKAHEAD_CHECK_MS);
      }
    };

    const toBuffer = (bytes: Uint8Array): AudioBuffer | null => {
      const converted = pcm16ToFloat32(bytes, carry);
      carry = converted.carry;
      if (converted.samples.length === 0) return null;
      const buffer = ctx.createBuffer(1, converted.samples.length, sampleRate);
      buffer.getChannelData(0).set(converted.samples);
      return buffer;
    };
    const feed = (bytes: Uint8Array) => {
      const buffer = toBuffer(bytes);
      if (!buffer) return;
      audioSeconds += buffer.duration;
      pending.push(buffer);
      schedule();
    };

    // Fetch and decode immediately, whether or not play() has been called yet.
    void (async () => {
      try {
        emit("request");
        const res = await fetch(url, { signal: abort.signal });
        const contentType = res.headers.get("content-type") ?? "";
        emit("headers", {
          status: res.status,
          type: contentType || undefined,
          source: res.headers.get("x-speech-source") ?? undefined,
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const isPcm = contentType.toLowerCase().startsWith("audio/l16");
        sampleRate =
          Number(res.headers.get("x-audio-sample-rate")) || sampleRateFromContentType(contentType) || 24_000;

        const reader = res.body.getReader();
        const encoded: Uint8Array[] = [];
        let firstChunk = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || value.byteLength === 0) continue;
          totalBytes += value.byteLength;
          if (firstChunk) {
            firstChunk = false;
            emit("first_chunk", { bytes: value.byteLength });
          }
          if (isPcm) {
            const block = coalescer.push(value);
            if (block) feed(block);
          } else {
            encoded.push(value);
          }
        }

        if (isPcm) {
          const rest = coalescer.flush();
          if (rest) feed(rest);
        } else if (encoded.length > 0) {
          const whole = new Uint8Array(encoded.reduce((n, c) => n + c.byteLength, 0));
          let offset = 0;
          for (const c of encoded) {
            whole.set(c, offset);
            offset += c.byteLength;
          }
          const buffer = await ctx.decodeAudioData(whole.buffer.slice(whole.byteOffset, whole.byteOffset + whole.byteLength));
          audioSeconds += buffer.duration;
          pending.push(buffer);
        }

        streamDone = true;
        emit("stream_done", { bytes: totalBytes, audioSeconds: round2(audioSeconds) });
        schedule();
        checkDone();
      } catch (err) {
        if (stopped) return;
        failed = true;
        streamDone = true;
        emit("error", { message: err instanceof Error ? err.message : String(err) });
        if (playing && audioSeconds > 0) {
          checkDone(); // let what already arrived finish playing
        } else {
          settle(new Error("The audio could not be played."));
        }
      }
    })();

    const clip: Clip = {
      get failed() {
        return failed;
      },
      get stopped() {
        return stopped;
      },
      play: async () => {
        if (stopped) return;
        if (failed && audioSeconds === 0) throw new Error("The audio could not be played.");
        await this.resume();
        if (stopped) return;

        playing = true;
        playCalledAt = performance.now();
        counted = true;
        this.beginPlaying(bus);
        nextStart = ctx.currentTime + 0.05;
        emit("play_called", { bufferedMs: Math.round(pending.reduce((n, b) => n + b.duration, 0) * 1000) });
        schedule();
        checkDone();
        await finished;
      },
      stop: (reason = "stopped") => {
        if (stopped) return;
        stopped = true;
        abort.abort(); // abandon the download
        for (const source of sources) {
          try {
            source.stop();
          } catch {
            /* already ended */
          }
          try {
            source.disconnect();
          } catch {
            /* already disconnected */
          }
        }
        sources.clear();
        pending.length = 0;
        emit("stopped", {
          reason,
          playedMs: playing ? Math.round(performance.now() - playCalledAt) : 0,
          audioSeconds: round2(audioSeconds),
        });
        settle();
      },
    };
    return clip;
  }

  /** Stops everything playing or waiting on a bus (or on every bus). */
  stopAll(bus?: BusName, reason?: string): void {
    for (const entry of Array.from(this.playing)) {
      if (!bus || entry.bus === bus) entry.stop(reason);
    }
  }

  /** How many clips are playing or waiting on a bus. */
  playingCount(bus: BusName): number {
    let n = 0;
    for (const entry of this.playing) if (entry.bus === bus) n += 1;
    return n;
  }

  /** What the audio hardware is doing, for development telemetry. */
  diagnostics(): Record<string, unknown> {
    const c = this.ctx as (AudioContext & { outputLatency?: number }) | null;
    return c
      ? { state: c.state, sampleRate: c.sampleRate, baseLatencyMs: Math.round((c.baseLatency ?? 0) * 1000), outputLatencyMs: Math.round((c.outputLatency ?? 0) * 1000) }
      : { state: "none" };
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
      const node = this.duckNodes[bus];
      if (!node) continue;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(duckFactor, now + attackSec);
    }
  }

  /** Restores music and fx gain after dialogue ends */
  unduck(): void {
    if (!this.ctx || !this.isDucking) return;
    this.isDucking = false;

    const now = this.ctx.currentTime;
    const releaseSec = DUCK_RELEASE_MS / 1000;

    for (const bus of ["music", "fx"] as BusName[]) {
      const node = this.duckNodes[bus];
      if (!node) continue;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(1, now + releaseSec);
    }
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  setGain(bus: BusName, value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.settings[bus] = clamped;

    // Ducking lives on its own stage, so the slider can be applied at any time
    const node = this.buses[bus];
    if (node && this.ctx) {
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
    // Safari on iPhone reports "interrupted" (not in the standard type) after a call or a
    // screen lock, so resume from anything that is not running or closed.
    const state = this.ctx?.state as string | undefined;
    if (this.ctx && state && state !== "running" && state !== "closed") {
      await this.ctx.resume();
    }
  }

  destroy(): void {
    this.ctx?.close();
    this.ctx = null;
    this.buses = {};
    this.duckNodes = {};
    this.dialogueAnalyser = null;
    this.levelBuffer = null;
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
