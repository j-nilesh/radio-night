# 0008. Player audio goes through our server, not straight to a provider

Status: Accepted. Revisit only if the game cannot work without a change.

## Context

The second family playtest measured about 3.4 s from the end of a question to the first sound of the reply (p50). Speech recognition is the largest part: about 1.5 s, growing with the length of the question (1.3 s under 3 s of audio, 2.0 s over 6 s). Streaming recognition from the browser to Deepgram while the player talks would save roughly 1.2 s, bringing the wait to about 2.2 s.

## Decision

Do not do that. The recording is uploaded to our server, which sends it to Deepgram. The target of 2 to 3 seconds will be pursued some other way, or accepted, before this is reconsidered.

## Why

- Audio that passes through our server can be checked, rate-limited, budgeted and dropped there. Browser-to-provider streaming would need a short-lived key handed to the browser, which moves control of that traffic out of our hands.
- The privacy page can state a simple fact: audio is sent to our server and passed to the speech provider, not kept.
- 3 to 4 seconds was judged fine in play by the player; a very fast reply feels unnatural for a conversation with a character.

## Consequences

- The wait stays near 3 s. Other levers, in order of cost: shorter model replies, starting voice synthesis on the first sentence while the model finishes, and a faster model for short exchanges.
- While waiting, the ambience swells briefly (ADR 0006), so the pause reads as the room rather than a stall.
- Prompt caching for the model was tried and reverted: the cache missed on most turns because per-question text sits inside the cached block.
