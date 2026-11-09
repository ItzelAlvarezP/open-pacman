# AGENTS.md

Pac-Man clone in vanilla JS for practicing **spec-driven development**. No framework, no build step, no dependencies, no tests, no CI.

## Run and verify

- There is no toolchain (no `package.json`). Verify by playing: `python3 -m http.server -d src` → http://localhost:8000 or just open `src/index.html`.

## Architecture gotchas

- No ES modules: files are plain `<script>` tags sharing globals. Order in `index.html` matters — `maze.js` (map data + start positions) → `game.js` (`createGame`/`update`) → `render.js` (`draw`) → `main.js` (rAF loop + keyboard). New files must be registered there before the file that consumes them.
- Movement is in **fractional grid cells per frame** (`PACMAN_SPEED = 0.125` = one cell every 8 frames so positions realign); rendering multiplies by `TILE = 20`. Don't mix cell coords and pixel coords.
- The map is a single source of truth: `MAZE_STR` in `maze.js` (31 strings of 28 chars). Canvas is sized from it: 28×31 grid, `20px` tiles, `560×620` canvas. Tunnel on row 14 wraps horizontally.

## Spec-driven workflow (the repo's core convention)

- Skills `spec` and `spec-impl` live in `.agents/skills/`, pinned by `skills-lock.json`.
- Specs go in `specs/NN-slug.md`; lifecycle: Draft/Borrador → Approved/Aprobado → Implemented/Implementado. Only **Approved** specs may be implemented via `/spec-impl`, which creates branch `spec-NN-slug` and pauses after each plan step.
- Don't write code during `/spec`, and never implement beyond a spec's scope during `/spec-impl`. Out-of-scope requests → note for the next spec.
- The directory has no `.git` yet — check before any flow that assumes git (branches, diffs, `spec-impl`).

## Conventions

- Human-facing content (UI strings, README, specs, comments): **Spanish**. Code identifiers: English.
- `*:Zone.Identifier` files are WSL metadata artifacts from copied files — noise, not source; safe to ignore/delete.
