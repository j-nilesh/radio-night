# 0002. Stream raw PCM over fetch and play it with Web Audio

Status: Accepted (Safari behaviour not yet confirmed in a playtest)

## Context

Speech was first served as MP3 and played in an `<audio>` element. A family playtest on Safari showed every line requested twice and slow starts. Safari probes media with `Range: bytes=0-1` and expects a `206` reply; a streamed response answers `200` with the whole body, so Safari fell back to downloading each line in full.

## Decision

Ask Deepgram for headerless 16-bit PCM (24 kHz mono), stream it to the browser with `fetch`, and schedule it as Web Audio buffers on the dialogue bus. The signed link carries the audio format.

## Rejected

- Implementing Range and `206` for streamed audio: it would force buffering the whole line and lose the early start.
- MediaSource: not dependable on iOS.

## Consequences

- Playback behaves the same in every browser, and the dialogue bus ducking and gain apply to speech.
- The server keeps one upstream synthesis per line and shares it with every listener (`LiveAudio` in `src/lib/speech.ts`); finished lines are cached in a byte-bounded cache.
- PCM is larger than MP3, so a cached line costs memory. The cache is capped at 80 MB and 300 entries.
- The cache and the daily character budget are per process (see ADR 0003).
- Open item for deployment: the signed link carries the spoken text (signed, not encrypted), so on a host whose request logs record URLs, each spoken line would appear in them. Before a public launch, replace the text in the link with an opaque id that points at the line held server-side (needs the shared store from ADR 0005), or confirm the host's logs omit query strings.
