// Paparazzi tier 2: one flash cycle freezes the frontmost TWO in-range dishes and
// leaves the rest alone. Behavior only — no freeze durations asserted.
import { loadEngine, assert, done, makeEnemy, makeTower } from "./_engine.mjs";

const E = loadEngine();
console.log("doublefreeze.test — Paparazzi t2 freezes exactly 2 of 3 in-range dishes");

E.reset();
// Three dishes in range, distinct path distances so "frontmost two" is deterministic.
const e1 = makeEnemy({ x: 200, y: 100, dist: 300 });
const e2 = makeEnemy({ x: 250, y: 100, dist: 200 });
const e3 = makeEnemy({ x: 300, y: 100, dist: 100 });
E.game.enemies.push(e1, e2, e3);
const frost = makeTower("frost", { x: 100, y: 100, range: 500, cooldown: 1.1,
  freezeDur: 1.0, slowDur: 3.0, slowFactor: 0.62, freezeTargets: 2 });
E.game.towers.push(frost);

E.updateTowers(1 / 60);                         // fires two flash orbs at the frontmost two
assert(E.game.projectiles.length === 2, "one flash cycle launches two orbs");
let steps = 0;
while (E.game.projectiles.length && steps < 400) { E.moveProjectiles(1 / 60); steps++; }

const frozen = [e1, e2, e3].filter((e) => e.freezeTimer > 0);
assert(frozen.length === 2, "exactly two dishes are frozen");
assert(e1.freezeTimer > 0 && e2.freezeTimer > 0, "the frontmost two are the frozen ones");
assert(e3.freezeTimer === 0, "the third dish is untouched");

// Control: a base frost (no freezeTargets) freezes only one.
E.reset();
const a = makeEnemy({ x: 200, y: 100, dist: 300 });
const b = makeEnemy({ x: 250, y: 100, dist: 200 });
E.game.enemies.push(a, b);
E.game.towers.push(makeTower("frost", { x: 100, y: 100, range: 500, cooldown: 1.1, freezeDur: 1.0, slowDur: 3.0, slowFactor: 0.62 }));
E.updateTowers(1 / 60);
assert(E.game.projectiles.length === 1, "base frost launches a single orb (freeze is gated on the upgrade)");

done("doublefreeze");
