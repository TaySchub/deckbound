# Blue-Plate Special

*(working title — formerly Deckbound)*

A tower-defense deckbuilder themed **hungry customers vs. runaway food**: seat
restaurant customers (your tower cards) along a diner conveyor belt and eat the
dishes trying to escape to the dish return — surviving escalating waves, then
collecting and upgrading new customers between runs.

- **What it is / the vision:** see [`GAME_BRIEF.md`](GAME_BRIEF.md) (the frozen spec).
- **How we work / the rules:** see [`PROJECT.md`](PROJECT.md).
- **How to run and deploy it (beginner-friendly):** see [`SETUP-AND-LAUNCH.md`](SETUP-AND-LAUNCH.md).
- **What changed and when:** see [`CHANGELOG.md`](CHANGELOG.md).

## Run it locally

Open `index.html` in a web browser — that's it for now. (Double-click the file,
or see `SETUP-AND-LAUNCH.md` for a tiny local web server if you prefer.)

## Status

**v1 shipped; post-v1 in progress** — live at <https://tayschub.github.io/blueplate/>:
the full prep→wave→resolve loop with **10 customer towers** (each with one named
role and two upgrade paths), 4 runaway foods, **endless generated waves** (your
score is how far you get), an enemy status-effect system (smoke, ranch coats,
sample marks), per-tower targeting, auto-start rounds, save & continue, and
between-run meta-progression. The live backlog is GitHub Issues at
[TaySchub/blueplate](https://github.com/TaySchub/blueplate).

## Tech

Plain HTML5 + CSS + JavaScript, hosted on GitHub Pages, playable in a browser
on Mac and iPhone. We may add [Phaser 3](https://phaser.io/) later if the
real-time action needs it. Original assets only — no branded content.
