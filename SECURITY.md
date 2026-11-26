# Security

## Reporting a problem
If you find a security problem in Radio Night, please report it privately through GitHub: open the **Security** tab of this repository and choose **Report a vulnerability**. Please do not open a public issue for it. I will reply as soon as I can.

Useful things to include: what you found, how to reproduce it, and what you think the impact is.

## What is in scope
The live game at https://radionight.app and the code in this repository: the API routes, the access-code and rate-limit logic, and the way speech and model replies are served.

Please do not: run load tests or automated floods against the live site (it has real, capped provider costs), try to read other people's sessions, or test with other people's accounts.

## Design notes that help a review
- Provider keys, the session secret and the database URL are server-side only and are never sent to the browser. Hooks in `.kiro/hooks/` block commands that would print them.
- The solution of the mystery is public in this repository by design (see the spoiler note in the README). It is kept out of the browser bundle, and the game's rules are enforced on the server.
- Per-visitor limits use the address that Fly.io's proxy sets (`Fly-Client-IP`), not `X-Forwarded-For`. See `docs/adr/0003-rate-limiting.md`.
