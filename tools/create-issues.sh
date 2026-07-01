#!/usr/bin/env bash
#
# create-issues.sh — creates Deckbound's 14 backlog Issues on GitHub, in order.
#
# Prereqs: you've run `gh auth login` and this folder is a GitHub repo
# (see SETUP-AND-LAUNCH.md). Run from the repo root:  bash tools/create-issues.sh
#
# Safe to read before running. It ONLY creates labels and issues — it does not
# push code, change settings, or deploy anything.

set -euo pipefail

echo "Ensuring labels exist..."
# --force updates the label if it already exists; ignore errors if identical.
gh label create feature    --color 1D76DB --description "New functionality"        --force
gh label create fix        --color D93F0B --description "A correction to a bug"     --force
gh label create bug        --color B60205 --description "Something is broken"       --force
gh label create research   --color 5319E7 --description "A decision-ready brief"    --force
gh label create compliance --color 0E8A16 --description "Licensing / originality"   --force

# Helper: create one issue.  args: <label> <title> <body>
new_issue () {
  local label="$1"; local title="$2"; local body="$3"
  echo "Creating: $title"
  gh issue create --label "$label" --title "$title" --body "$body"
}

echo
echo "Creating backlog issues in order..."

# ---- Foundation ----
new_issue feature "1. Foundation: project skeleton" \
"Minimal HTML5 + JavaScript project: a titled page with a game-canvas placeholder, building and running locally. No game logic yet. Keep it clean and well-commented.

Done when: the page opens locally, shows the title and a canvas placeholder, and the code is readable/commented."

new_issue feature "2. Foundation: deploy (needs approval to enable Pages)" \
"Blank page live on GitHub Pages, openable on Mac + iPhone via the Pages link.

NOTE: enabling GitHub Pages requires the developer's explicit approval (see PROJECT.md guardrails). Prepare everything; do not enable Pages without the go-ahead.

Done when: the developer has approved, Pages is enabled, and the placeholder page opens on both Mac and iPhone."

# ---- Core game ----
new_issue feature "3. Core: map & core, game loop" \
"A single fixed path drawn on the canvas plus a 'core' to defend. A running game loop (update + render each frame).

Done when: the map path and core render, and a stable game loop is ticking."

new_issue feature "4. Core: enemy movement & lose condition" \
"An enemy walks the fixed path from start to the core. If enough enemies reach the core, you lose.

Done when: enemies visibly travel the path, reaching the core has an effect, and a lose state can trigger."

new_issue feature "5. Core: wave system & win condition" \
"Escalating waves of enemies. Surviving all waves on the map = win.

Done when: waves spawn in sequence, get harder, and clearing the last wave triggers a win."

new_issue feature "6. Core: basic tower" \
"A single-target, auto-firing tower. It targets enemies in range; enemies take damage and die.

Done when: a placed tower auto-fires at enemies in range and can kill them."

new_issue feature "7. Core: currency economy" \
"Earn currency per kill and/or per wave; spend it to place towers.

Done when: currency is shown, increases from kills/waves, and is spent when placing towers (can't place if you can't afford it)."

# ---- The hook ----
new_issue feature "8. Hook: deck & hand" \
"Prep phase draws a hand of tower cards from a deck; you place towers from your hand.

Done when: a prep phase deals a hand from a deck, and placing a tower comes from playing a card."

new_issue feature "9. Hook: live-during-wave placing & upgrading" \
"Stay hands-on during the wave: place and upgrade towers while enemies march (the locked 'interactive' pacing from GAME_BRIEF).

Done when: the player can place and upgrade towers live while a wave is running, not only in prep."

new_issue feature "10. Hook: tower variety (~5-6 cards)" \
"Around 5-6 tower cards with distinct behaviors, e.g. single-target, splash, slow, long-range, cheap-but-weak.

Done when: ~5-6 meaningfully different tower cards exist and are placeable."

# ---- Depth ----
new_issue feature "11. Depth: enemy variety (~3-4 types)" \
"Around 3-4 enemy types with stats that escalate across ~10 waves.

Done when: ~3-4 distinct enemy types appear and the ~10-wave curve escalates."

new_issue feature "12. Depth: tower upgrades" \
"Spend currency to upgrade towers you've already placed.

Done when: placed towers can be upgraded for a cost, with a visible effect (e.g. more damage/range)."

new_issue feature "13. Depth: meta-progression" \
"A deck-build screen between runs plus 1-2 unlockable cards, to prove the meta loop.

Done when: between runs the player can adjust their deck and unlock at least 1-2 new cards."

# ---- Milestone ----
new_issue feature "14. Milestone: polish & playtest (first version done)" \
"Basic UI/feedback, balance the ~10-wave curve, make the full loop fun and stable end to end. This is 'first version done.'

Done when: the prep -> wave -> resolve loop plays end to end, is stable, and the ~10-wave curve feels fair and fun."

echo
echo "Done. View them with:  gh issue list"
