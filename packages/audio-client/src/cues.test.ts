import { describe, expect, it } from "vitest";
import { CuePlayer, type CueDef, type CueMixer } from "./cues";
import type { SoundHandle, StartOptions, BusName } from "./mixer";

type Started = { bus: BusName; buffer: string; opts?: StartOptions; handle: FakeHandle };

class FakeHandle implements SoundHandle {
  stopped = false;
  levels: Array<[number, number | undefined]> = [];
  stopFade: number | undefined;
  ended = Promise.resolve();
  stop(fade?: number) {
    this.stopped = true;
    this.stopFade = fade;
  }
  setLevel(v: number, over?: number) {
    this.levels.push([v, over]);
  }
}

function setup(files: Record<string, string | number>, cues: CueDef[]) {
  const started: Started[] = [];
  const events: Array<[string, Record<string, unknown>]> = [];
  const requests: string[] = [];
  const mixer: CueMixer<string> = {
    async decode(data) {
      return new TextDecoder().decode(data);
    },
    startBuffer(bus, buffer, opts) {
      const handle = new FakeHandle();
      started.push({ bus, buffer, opts, handle });
      return handle;
    },
  };
  const fetchFn = (async (url: string) => {
    requests.push(url);
    const body = files[url];
    if (typeof body === "number") return new Response("nope", { status: body });
    if (body === undefined) return new Response("missing", { status: 404 });
    return new Response(body);
  }) as unknown as typeof fetch;
  let clock = 1000;
  const player = new CuePlayer(mixer, cues, {
    baseUrl: "/audio/",
    fetchFn,
    observe: (e, d) => events.push([e, d]),
    now: () => clock,
  });
  return { player, started, events, requests, tick: (ms: number) => (clock += ms) };
}

const cue = (id: string, kind: CueDef["kind"], extra: Partial<CueDef> = {}): CueDef => ({
  id,
  file: `${id}.wav`,
  kind,
  bus: kind === "ambience" || kind === "sfx" ? "fx" : "music",
  gain: 0.5,
  ...extra,
});

const CUES = [cue("amb-a", "ambience"), cue("amb-b", "ambience"), cue("ding", "sfx"), cue("score", "music")];
const FILES = { "/audio/amb-a.wav": "A", "/audio/amb-b.wav": "B", "/audio/ding.wav": "D", "/audio/score.wav": "S" };

describe("ambience beds", () => {
  it("starts a looping bed with the cue's own gain and a fade in", async () => {
    const { player, started } = setup(FILES, CUES);
    await player.setBed("ambience", "amb-a");
    expect(started).toHaveLength(1);
    expect(started[0].buffer).toBe("A");
    expect(started[0].opts).toMatchObject({ loop: true, gain: 0.5 });
    expect(started[0].opts?.fadeInSec).toBeGreaterThan(0);
  });

  it("asking for the bed that is already playing does nothing", async () => {
    const { player, started, requests } = setup(FILES, CUES);
    await player.setBed("ambience", "amb-a");
    await player.setBed("ambience", "amb-a");
    expect(started).toHaveLength(1);
    expect(requests).toEqual(["/audio/amb-a.wav"]);
  });

  it("crossfades: the old bed fades out as the new one starts", async () => {
    const { player, started } = setup(FILES, CUES);
    await player.setBed("ambience", "amb-a");
    await player.setBed("ambience", "amb-b");
    expect(started[0].handle.stopped).toBe(true);
    expect(started[0].handle.stopFade).toBeGreaterThan(0);
    expect(started[1].buffer).toBe("B");
    expect(started[1].handle.stopped).toBe(false);
  });

  it("null fades the bed out and starts nothing", async () => {
    const { player, started } = setup(FILES, CUES);
    await player.setBed("ambience", "amb-a");
    await player.setBed("ambience", null);
    expect(started[0].handle.stopped).toBe(true);
    expect(started).toHaveLength(1);
  });

  it("a slow download for a bed the player has already left never starts", async () => {
    const { player, started } = setup(FILES, CUES);
    const slow = player.setBed("ambience", "amb-a"); // not awaited yet
    await player.setBed("ambience", "amb-b");
    await slow;
    expect(started.map((s) => s.buffer)).toEqual(["B"]);
  });

  it("music and ambience are separate beds", async () => {
    const { player, started } = setup(FILES, CUES);
    await player.setBed("ambience", "amb-a");
    await player.setBed("music", "score");
    expect(started.map((s) => s.bus)).toEqual(["fx", "music"]);
    expect(started[0].handle.stopped).toBe(false);
  });

  it("refuses a cue of the wrong kind", async () => {
    const { player, started, events } = setup(FILES, CUES);
    await player.setBed("ambience", "ding");
    expect(started).toHaveLength(0);
    expect(events.map((e) => e[0])).toContain("cue.unknown");
  });
});

describe("a sound that cannot be loaded is silence, never an error", () => {
  it("a missing file", async () => {
    const { player, started, events } = setup({}, CUES);
    await expect(player.setBed("ambience", "amb-a")).resolves.toBeUndefined();
    await expect(player.play("ding")).resolves.toBeUndefined();
    expect(started).toHaveLength(0);
    expect(events.filter((e) => e[0] === "cue.load_failed")).toHaveLength(2);
  });

  it("a server error, and a file that will not decode", async () => {
    const { player } = setup({ "/audio/amb-a.wav": 500 }, CUES);
    await expect(player.setBed("ambience", "amb-a")).resolves.toBeUndefined();

    const started: unknown[] = [];
    const broken = new CuePlayer<string>(
      {
        decode: async () => {
          throw new Error("bad data");
        },
        startBuffer: () => {
          started.push(1);
          return new FakeHandle();
        },
      },
      CUES,
      { baseUrl: "/audio/", fetchFn: (async () => new Response("x")) as unknown as typeof fetch }
    );
    await expect(broken.setBed("ambience", "amb-b")).resolves.toBeUndefined();
    expect(started).toHaveLength(0);
  });

  it("a failed file is not requested again on every scene change", async () => {
    const { player, requests } = setup({}, CUES);
    await player.setBed("ambience", "amb-a");
    await player.setBed("ambience", "amb-b");
    await player.setBed("ambience", "amb-a");
    expect(requests.filter((r) => r.endsWith("amb-a.wav"))).toHaveLength(1);
  });
});

describe("one-shot sounds", () => {
  it("plays a sound effect once, without looping", async () => {
    const { player, started } = setup(FILES, CUES);
    await player.play("ding");
    expect(started).toHaveLength(1);
    expect(started[0].opts?.loop).toBeUndefined();
  });

  it("plays a sting asked for twice in a moment only once, but again later", async () => {
    const { player, started, tick } = setup(FILES, CUES);
    await player.play("ding");
    await player.play("ding");
    expect(started).toHaveLength(1);
    tick(1000);
    await player.play("ding");
    expect(started).toHaveLength(2);
  });

  it("will not play a bed as a one-shot", async () => {
    const { player, started } = setup(FILES, CUES);
    await player.play("amb-a");
    expect(started).toHaveLength(0);
  });
});

describe("hush while the player speaks", () => {
  it("lowers the beds, and brings them back to their own gain", async () => {
    const { player, started } = setup(FILES, CUES);
    await player.setBed("ambience", "amb-a");
    player.hush();
    expect(started[0].handle.levels.at(-1)?.[0]).toBe(0);
    player.restore();
    expect(started[0].handle.levels.at(-1)?.[0]).toBe(0.5);
  });

  it("makes no one-shot sound while hushed", async () => {
    const { player, started } = setup(FILES, CUES);
    player.hush();
    await player.play("ding");
    expect(started).toHaveLength(0);
  });

  it("a bed that finishes loading while hushed starts silent, then comes back", async () => {
    const { player, started } = setup(FILES, CUES);
    player.hush();
    await player.setBed("ambience", "amb-a");
    expect(started[0].opts?.gain).toBe(0);
    player.restore();
    expect(started[0].handle.levels.at(-1)?.[0]).toBe(0.5);
  });
});

describe("ducking", () => {
  it("beds duck under speech, but stings and effects do not", async () => {
    const { player, started } = setup(FILES, CUES);
    await player.setBed("ambience", "amb-a");
    await player.play("ding");
    expect(started[0].opts?.duck).toBe(true);
    expect(started[1].opts?.duck).toBe(false);
  });
});

describe("swelling the room while the characters think", () => {
  it("lift raises the beds above their own gain, settle returns them", async () => {
    const { player, started } = setup(FILES, CUES);
    await player.setBed("ambience", "amb-a");
    player.lift();
    const lifted = started[0].handle.levels.at(-1)?.[0] ?? 0;
    expect(lifted).toBeGreaterThan(0.5);
    expect(lifted).toBeLessThanOrEqual(1);
    player.settle();
    expect(started[0].handle.levels.at(-1)?.[0]).toBe(0.5);
  });

  it("a bed that starts while lifted starts swelled", async () => {
    const { player, started } = setup(FILES, CUES);
    player.lift();
    await player.setBed("ambience", "amb-a");
    expect(started[0].opts?.gain).toBeGreaterThan(0.5);
  });

  it("hush wins over lift: the microphone never hears a swelled room", async () => {
    const { player, started } = setup(FILES, CUES);
    await player.setBed("ambience", "amb-a");
    player.lift();
    player.hush();
    expect(started[0].handle.levels.at(-1)?.[0]).toBe(0);
    player.restore();
    // still lifted after the microphone closes
    expect(started[0].handle.levels.at(-1)?.[0]).toBeGreaterThan(0.5);
    player.settle();
    expect(started[0].handle.levels.at(-1)?.[0]).toBe(0.5);
  });

  it("lifting twice or settling without a lift does nothing", async () => {
    const { player, started } = setup(FILES, CUES);
    await player.setBed("ambience", "amb-a");
    player.settle();
    expect(started[0].handle.levels).toHaveLength(0);
    player.lift();
    player.lift();
    expect(started[0].handle.levels).toHaveLength(1);
  });
});

describe("stopAll", () => {
  it("fades out every bed and forgets them", async () => {
    const { player, started } = setup(FILES, CUES);
    await player.setBed("ambience", "amb-a");
    await player.setBed("music", "score");
    player.stopAll(0.2);
    expect(started.every((s) => s.handle.stopped && s.handle.stopFade === 0.2)).toBe(true);
    await player.setBed("ambience", "amb-a"); // can start again afterwards
    expect(started).toHaveLength(3);
  });
});
