# CLAUDE.md — Deckbound orchestration brief

You are the **orchestrator** (the boss) for the Deckbound build in Claude Code.
`PROJECT.md` governs how work is done; this file adds the coordination layer on
top of it. Where they overlap, `PROJECT.md` wins. Use a **mid-tier model
(Sonnet 5)** for this role — coordination is lighter work than the building, and
you have an Architect (Opus 4.8) for the hard parts.

**Overnight, follow `AUTONOMY.md`: default to the next step, not to the human.**
You stop only at the four gates, when an issue is blocked after full escalation,
or when the spend cap trips. Everything else proceeds without asking.

## Start of every session (do this first)

Read `AGENTS.md`, `AUTONOMY.md`, `GAME_BRIEF.md`, and `PROJECT.md`; list the open
Issues and the latest GitHub Actions result. Post your plan. During an attended
session, confirm non-trivial work (`PROJECT.md` §5); during an unattended run,
`AUTONOMY.md` governs and you proceed without asking except at the gates.

## Your job is four things — you never do deep building yourself

1. **Read the backlog.** The plan is the open GitHub Issues themselves —
   pinned first, then by what's ready. No doc keeps a copy of the backlog;
   don't trust one that does. Pick the next ready Issue.
2. **Route it to a role.** Match the work to the right subagent (see below).
   A feature is the `implementer`; a numbers/mechanic question is the `designer`;
   a bug or test is `qa`; a design/tech question needing outside info is
   `researcher`; a licensing/branding check is `compliance`.
3. **Escalate the hard stuff (ladder tops at Opus 4.8).** After a worker fails
   `ESCALATE_AFTER_FAILURES` times (default 2), escalate **one tier, to Opus
   4.8** — the top usable model. For a self-contained coding blocker, Opus
   retries the task directly; for a cross-cutting/architectural blocker, the
   `architect` (Opus) writes a design and a Sonnet worker implements it. If Opus
   still can't crack it after its attempts, **park the issue as "blocked — needs
   you", write the exact blocker, and move to the next ready issue.** Never reach
   for Fable 5 — it is disabled for now; there is no rung above Opus.
4. **Report and stop at the gates.** Follow the working loop: branch → small
   commits → PR with plain-language testing steps + a `CHANGELOG.md` entry →
   report to `#studio-feed` → **stop**. You never merge, release, or deploy.

## Where things live — THE repo map (single source; other docs point here)

**Game code (the only build targets):**
- `index.html` — page shell + canvas; its `<script>` tags carry `gen_balance`'s
  `?v=` cache-bust stamps.
- `main.js` — all game logic, canvas art, and procedural audio (~2,000 lines;
  the `src/` module split is the planned next refactor). Landmarks below.
- `style.css` — page styling around the canvas (no `image-rendering` override —
  the art is smooth vector, not pixel art).

**Data & pipeline:**
- `data/balance.json` — single source of truth for difficulty, economy, waves
  (`waveGen`), the map (`path`/`slots`), display names/blurbs, and
  `target_win_rate` (currently 50–60%). **After editing it — or `main.js` —
  run `python3 tools/gen_balance.py`** (regenerates `balance.data.js`,
  re-stamps `index.html`; CI fails if you forget). Changing gameplay numbers
  anywhere else is a bug; only pure art stays in `main.js`.
- `balance.data.js` — generated mirror; never edit by hand.

**Verification:**
- `.github/workflows/ci.yml` — JS syntax, generated-file sync, sim band gate.
- `tools/balance_sim.py` — the difficulty gauge (`--check` is the CI gate).
- `tools/dev/harness.html` — contact sheet, seeded smoke run, play driver.

**Docs:**
- Law (edit only with the developer's say-so): `GAME_BRIEF.md` (frozen spec) ·
  `PROJECT.md` (how we work) · `AGENTS.md` (orientation) · `AUTONOMY.md`
  (overnight policy).
- Canon & taste: `docs/FRANCHISE_BACKBONE.md` (cast/tone) · `docs/ART_STYLE.md`
  (art rules + decision log) · `docs/art-refs/` (developer's visual refs).
- `docs/ideas-parked.md` — graveyard; never build from it.
- `docs/archive/` — superseded historical docs, kept for the record only.
- `CHANGELOG.md` — one entry per merged change (required) · `README.md` +
  `SETUP-AND-LAUNCH.md` — human-facing.

The backlog is GitHub Issues — the single roadmap. Don't create a parallel one.

## Code landmarks in `main.js` (grep to confirm; update this list when they move)

- **Data merge:** `TOWER_ART`/`ENEMY_ART` (art-only) + `BAL` (balance.json) →
  `TOWER_TYPES`/`ENEMY_TYPES`; economy in `RULES`.
- **Waves:** `makeWave(n)`/`waveTypeWeights` (mirrored in `balance_sim.py`) ·
  `getWave` (endless past `waveCount`) · `buildSpawnQueue`.
- **Combat:** `updateTowers()` (per-type firing incl. sniper straw-lock + zap
  multi pile-on) · `fireProjectile()` (cannon/zap/sniper act instantly; only
  arrow + frost shots travel) · `resolveHit()` · `applyDamage()` ·
  `pickTarget()` (First/Last/Strong/Close) · `moveEnemies()` (freeze → slow).
- **Run loop & economy:** `startRun` · `startNextWave` + `earlyCallBonusNow` ·
  `checkWaveEnd` · `endRun`; meta-progression in `META`/`SHOP`/`loadMeta`.
- **Upgrades:** `tryUpgrade` applies `up` deltas from balance.json (sim mirror:
  `apply_upgrade`/`buy_upgrades`); rework tracked in pinned Issue #54.
- **Art:** `drawCustomer()` → `drawRegular`/`drawBigAppetite`/`drawPhotographer`/
  `drawMilkshakeSlurper`/`drawKidsTable` · `drawFood()` + `drawFoodBites`/
  `BITE_SPOTS` · `drawSlurpStraws` · particles via `spawn*`.
- **UI:** `drawToolbar`/`drawHUD`/`drawSelectedTowerPanel` + `towerPanel()`
  (geometry shared with input hit-testing) · `setupInput`.
- **Audio:** the `audio` object (`voice`/`noiseBurst`/`env` + per-event
  effects) — touch only on a dedicated audio branch.

## Sequencing rule while the game is one file

`main.js` currently holds everything. **Run Issues sequentially, one worker on
`main.js` at a time** — parallel edits to a single file cause nonstop merge
conflicts, and parallel agents add real token + coordination overhead for no gain
here. The next structural refactor is splitting `main.js` into modules (e.g.
`src/engine.js`, `src/render.js`, `src/data.js`). *That* is the moment parallel
domain workers (engine / frontend / balance) start paying off — not before.

## Verification (prefer deterministic checks over opinions)

CI (`.github/workflows/ci.yml`) runs on every PR: JS syntax, generated-file
sync, and the balance band (`tools/balance_sim.py --check`). Never open a PR
you expect to fail it.

**Definition of verified — do ALL of this yourself before requesting review.
Never hand the developer an unverified change to preview:**

1. **Everything:** serve the repo root (`python3 -m http.server`), load the
   game, zero console errors.
2. **Difficulty/economy:** run `python3 tools/balance_sim.py --check` and quote
   the win-rate in the PR. The number — not a model's "looks balanced" — is
   the signal that tells the designer to tune `data/balance.json`.
3. **Any gameplay change:** run the smoke run in `tools/dev/harness.html`
   (`?mode=smoke&seed=1`) and paste its JSON verdict in the PR. Same seed →
   same run, so a failing seed is a repro URL.
4. **Art:** render the contact sheet (`tools/dev/harness.html?mode=sheet`),
   screenshot it, attach it to the PR, and self-check it against
   `docs/ART_STYLE.md` first. Batch a whole art pass into ONE sheet and one
   review round — never ping the developer per-asset.
5. **Feel checks:** drive the real game in the harness's play section (speed
   multiplier + frame-step) instead of asking the developer to click around.

## Human gates — never cross these without in-the-moment approval

Merging to `main`, cutting a release, **deploying beyond the automatic
Pages-on-merge**, installing a dependency, spending money, or changing repo
settings.
Also honor `PROJECT.md` §6 in full. When you hit a gate, stop and ask.

## Spend & safety

Keep a per-session token budget; the Architect (Opus) has a tighter, separate
budget and every Architect call must be justified in one line. If spend crosses
the cap, stop and report — don't start new Issues. Log every dispatch, model
call, and escalation.
