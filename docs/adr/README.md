# Architecture decision records

Short records of decisions that shaped the project, why they were made, and what they cost. Newer records may supersede older ones; the status line says so.

| # | Decision | Status |
|---|---|---|
| [0001](0001-chained-voice-pipeline.md) | Chained speech pipeline, not speech-to-speech | Accepted |
| [0002](0002-pcm-streaming-playback.md) | Stream raw PCM over fetch and play it with Web Audio | Accepted |
| [0003](0003-rate-limiting.md) | In-process rate limiting, shared storage later | Accepted, with a known limit |
| [0004](0004-model-played-characters.md) | Model-played characters behind authored clues and a reply guard | Accepted |
| [0005](0005-store-and-saves.md) | Neon for saves, with an in-memory fallback for development | Accepted, Neon not yet connected |
| [0006](0006-sound-cues.md) | Data-driven ambience and stings with placeholder assets | Accepted |
| [0007](0007-dev-telemetry.md) | Development-only playtest telemetry | Accepted, to be removed before launch |
| [0008](0008-audio-stays-on-our-server.md) | Player audio goes through our server, not straight to a provider | Accepted |
| [0009](0009-usage-limits-and-access.md) | Text first, a little voice, an access code for more | Accepted as a plan; not built yet |
| [0010](0010-images-and-art-direction.md) | Photographic 1981 look, manifest-driven images, placeholders first, nothing unearned reaches the browser | Accepted |
| [0011](0011-multi-provider-cast.md) | The cast is voiced by three providers, each voice pinned to its provider, behind one router | Accepted; sound and music not yet regenerated for shipping |
