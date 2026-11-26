# 0017. One way to play: the solo and together choice is removed
Status: Accepted (26 November 2026)
## Context
The start page asked "How will you play?" with Play Solo or Play Together. The two did exactly the same thing. The choice was stored on the run and shown in the game header ("Solo"), and nothing else read it. A first-time player was asked to decide something that changed nothing, and the header tag raised the question of what it meant.
## Decision
The game has one way to play. The choice is removed from the start page and the header. Playing with a room of people stays as a way to use the game (connect a speaker, take turns asking), described in plain words on the front page, not as a mode.
## Consequences
- New runs are always created as "solo". The `playMode` field stays in the run record, the database column and the API (default "solo", still accepted so an older open page keeps working), so no migration and no change to saved runs.
- If a shared-speaker experience ever needs different behaviour (for example turn order or a quieter microphone), it can be added then, with a reason a player can see.
