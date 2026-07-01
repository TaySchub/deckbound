# Changelog

All notable changes to Deckbound are recorded here. Newest at the top.
Format is deliberately simple and plain-language.

## [Unreleased]

### Added
- **Issue #3 — map & core, game loop.** The canvas now draws the level's single
  fixed path and the **core** (Wellspring) we defend, rendered by a real game
  loop with a stable *fixed timestep* (60 updates/sec, independent of screen
  refresh rate). A small debug readout (fps · elapsed time · update count) and a
  glowing dot travelling the path make it obvious the loop is ticking. The
  travelling dot is only a temporary liveness indicator — not an enemy. Reusable
  path helper (`pointAtDistance`) is ready for enemy movement in #4. File:
  `main.js` (plus label/footer updates in `index.html`). Still plain canvas — no
  new dependencies.
- **Task 1 — project skeleton.** A minimal HTML5 + JavaScript page: a titled
  page ("Deckbound") with a game-canvas placeholder that draws a simple frame
  and title text. No game logic yet. Files: `index.html`, `style.css`,
  `main.js`.
- **Studio Feed workflow** (`.github/workflows/studio-feed.yml`): posts to the
  `#studio-feed` Slack channel on every push and on an hourly heartbeat.
- Project docs versioned at repo root: `PROJECT.md`, `GAME_BRIEF.md`.
- `README.md`, `.gitignore`, `docs/ideas-parked.md`, and a beginner setup guide
  (`SETUP-AND-LAUNCH.md`).
