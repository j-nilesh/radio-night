/**
 * lib/crossfade.ts
 * The small state machine behind a room picture that fades from the old image
 * to the new one when the player changes room. Pure, so it can be tested
 * without a browser.
 *
 * `current` is the picture on top; `previous` is the one underneath while the
 * fade runs, and goes away once it has finished.
 */

export type Fade<T extends { src: string }> = {
  current: T | null;
  previous: T | null;
};

export function startFade<T extends { src: string }>(image: T | null): Fade<T> {
  return { current: image, previous: null };
}

/**
 * A new picture is asked for. The old one stays underneath until the fade ends.
 * Asking for the picture that is already showing changes nothing.
 */
export function advance<T extends { src: string }>(state: Fade<T>, incoming: T | null): Fade<T> {
  if ((incoming?.src ?? null) === (state.current?.src ?? null)) return state;
  return { current: incoming, previous: state.current };
}

/** The fade has finished: drop the picture underneath. */
export function settle<T extends { src: string }>(state: Fade<T>): Fade<T> {
  return state.previous === null ? state : { current: state.current, previous: null };
}
