# Design — Larger map, wave generation, endless groundwork

Design pass for Feature 3 (developer-approved post-v1). Written at the Opus tier
before coding, per the working loop. Two implementation steps: **(a)** larger
map + formula-driven finite rounds; **(b)** endless groundwork behind a toggle.

## Goals & constraints

- Keep the 16:9 (800×450) canvas and the existing data-driven architecture
  (everything difficulty/map lives in `data/balance.json`, mirrored to the game
  via `balance.data.js`; the sim reads the same file).
- "More rounds" and "endless" should fall out of **one mechanism** — a wave
  *generator* — not a longer authored table.
- Finite play stays the default and keeps the win condition. Endless is built
  but **off by default**; turning the game into survival/score is the
  developer's call (flagged, not taken).

## (a) Larger map

The map is already data-driven (`map.path`, `map.slots`, `map.coreRadius`), so a
bigger map is just new data. New path: a rightward **serpentine** with six
vertical switchback lanes (≈2300 px vs the old ≈1350 px), core at the end. Ten
tower slots sit in the gaps between lanes so a tower can cover two adjacent
lanes. The sim reads the new path/slots and validates combat on it automatically.

## (a) Wave generation replaces the authored table

Remove the fixed 10-entry `waves` array; add a `waveGen` block of base
parameters, and generate wave *n* from a formula in BOTH the game (`makeWave` in
`main.js`) and the sim (ported `make_wave` in `balance_sim.py`), reading the same
`waveGen` from `balance.json`.

`makeWave(n)` (n is 0-indexed) →
- **hp** = round(`hpBase` × `hpGrowth`^n)
- **speed** = min(`speedMax`, `speedBase` + `speedStep`×n)
- **interval** = max(`intervalMin`, `intervalBase` − `intervalStep`×n)
- **count** = `baseCount` + round(`countStep`×n)
- **comp**: split `count` across enemy types by weights that shift with n
  (mote always; runner from wave 2; swarm from wave 3; brute from wave 5), so the
  mix escalates. Every included type gets ≥1; the leftover goes to the heaviest
  weight.

`waveGen.waveCount` sets the finite length (target ≈20, up from 10). The game
builds `WAVES = [makeWave(0)…makeWave(waveCount-1)]`; win = clear the last.

## (b) Endless groundwork

- `waveGen.endless` (default **false**) — a runtime finite/endless toggle on the
  hub. Because `makeWave(n)` is a pure formula, endless just keeps calling it for
  n past `waveCount`; no new content needed.
- **Wave counter**: finite shows "Wave n/total"; endless shows "Wave n" + a score.
- **Score**: accumulates from kills/waves; shown in endless and on the summary.
- Endless removes the win condition (survival/score). Default is finite so the
  win condition stays. **The finite-vs-endless / win-condition question is
  surfaced for the developer, not decided here.**

## Verification

- Finite: `gen_balance` → `balance_sim` reference strategy in the **45–60%** band
  over the new map + ~20 formula waves; enemies traverse the longer path.
- Endless: sim runs endless and reports **median waves survived** for the
  reference (difficulty signal instead of win-rate); it should be neither
  trivial (never dies) nor brutal (dies almost immediately).
