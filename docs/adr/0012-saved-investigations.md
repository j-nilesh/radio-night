# 0012. Saved investigations: autosave on the server, continue from the browser's cookie

Status: Accepted. Saves are only durable once Neon is connected (ADR 0005); until then they last as long as the server process.

## Context
A player may quit mid-investigation and come back later, expecting to be told where they stand. The game already saved every action: the run's state lives on the server, is updated after each question, room change and find, and is tied to an httpOnly guest cookie (30 days). What was missing was a way back in and a reminder on arrival: starting from the home page always began a new case, a returning player landed in the room with only "you pick up where you left off", and the conversation log was not restored.

## Decision
- **No save button.** Every action is the save. The server's run state is authoritative.
- **Continue is found through the cookie, not the browser's storage.** `GET /api/runs/current` looks up the most recently saved run for the guest token and returns a short summary: the room, how many people have been questioned and finds are in the casebook, and when it was last played. No cookie, an unknown token or a revoked session answer `{ run: null }`. The home page and the Begin Investigation page show a Continue card from it.
- **The summary is built from the player's view**, like the spoken recap, so it can reveal nothing the player has not earned. No state, flags or truth leave the server.
- **A returning run opens on a "Where you left off" screen** with the narrator's recap in writing (the same recap as the in-game "recap" command, with a greeting), and speaks it when the player continues with sound. The click on that screen is also what unlocks browser audio.
- **Starting over is deliberate.** A new run issues a new guest token and replaces the cookie, so the saved run becomes unreachable. The Begin Investigation page therefore asks for a second press ("Yes, replace it and start over") when a save exists.
- **Closed cases are not offered for continuing.** A finished run shows its ending screen if opened directly, and the home page offers Begin Investigation again.
- **The conversation log is not saved.** The casebook (what you found and what you were told) is the lasting record, and the recap reads from it. Keeping verbatim transcripts would conflict with the privacy rule that only decision codes are retained.
- **The in-memory store now lives on `globalThis`**, so a development hot reload no longer erases runs.

## Why
- The cookie already identifies the player, so no extra identifier (and no personal data) is needed, which matches "no accounts" in the project's scope.
- Server-side lookup avoids a second copy of "which run is mine" in localStorage that could disagree with the server.
- A recap from the casebook is short, cannot spoil, and costs about 350 characters of narrator voice per return, only if the player chooses sound.

## Consequences
- **One saved investigation per browser.** Playing on another device or clearing cookies loses access to the save. Cross-device continuation would need either accounts (out of scope) or a resume link or code. Neither is built.
- **Durability depends on Neon.** With the in-memory store, a server restart or a new deploy erases every save. This must be connected before the public launch.
- **Expiry is not enforced.** Guest sessions record a 30-day expiry and the cookie lapses after 30 days, but the store does not check `expiresAt` when reading a run, and the cookie is not renewed by play. Security rules say sessions should expire after 30 days of inactivity; a sliding expiry (renew on each action, reject past `expiresAt`) is still to do.
- **Orphaned runs.** Replacing a save leaves the old run in the database, unreachable. A clean-up job for runs with no recent activity is worth adding once there is real data.
- The Neon implementation of `findLatestRunForToken` follows the same join and ownership rule as `findRunForToken` but has not been run against a live database.
